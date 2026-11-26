const express = require('express');
const pg = require('pg');
const { Pool } = pg;
const cors = require('cors');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { promisify } = require('util');

require('dotenv').config();

const app = express();
// En la nube (Render) el puerto lo asigna la plataforma; en local usamos 3000
const port = process.env.PORT || 3000;

// middlewares
app.use(cors());
app.use(express.json());

// Nunca servir archivos sensibles ni el código del servidor
app.use((req, res, next) => {
  const ruta = req.path.toLowerCase();
  const sensible =
    ruta.startsWith('/.env') ||
    ruta.startsWith('/.git') ||
    ruta.startsWith('/android/') ||
    ruta.endsWith('.apk') ||
    ruta === '/qr-cuentas.png' ||
    ['/server.js', '/package.json', '/package-lock.json', '/readme.md', '/render.yaml'].includes(ruta);

  if (sensible) return res.status(404).end();
  next();
});

// La pantalla de restablecer usa el mismo index.html; el frontend decide qué mostrar
app.get('/restablecer', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Servir el frontend (index.html, style.css, script.js) desde este mismo servidor
app.use(express.static(__dirname));

// Base de datos PostgreSQL (Supabase). La URL se lee del archivo .env / variable de entorno.
if (!process.env.DATABASE_URL) {
  console.error('ERROR: falta DATABASE_URL. Poné la cadena de Supabase en el archivo .env');
  process.exit(1);
}

// Clave para firmar los tokens de sesión (nunca se sube a GitHub)
const CLAVE_SESION = process.env.JWT_SECRET;
if (!CLAVE_SESION) {
  console.error('ERROR: falta JWT_SECRET. Generá una clave con: openssl rand -hex 32');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Postgres devuelve las columnas NUMERIC como string. Las convertimos a número
// para que el frontend pueda sumar y formatear montos con decimales normalmente.
pg.types.setTypeParser(1700, Number);

// Envío de correos para recuperar la contraseña.
// Render Free bloquea los puertos SMTP (25/465/587), así que en producción se usa
// la API HTTPS de Brevo. Gmail SMTP queda como alternativa para uso local.
const URL_APP = process.env.APP_URL || 'https://cuentas-k956.onrender.com';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_REMITENTE = process.env.EMAIL_USER || 'laresoftuy@gmail.com';

const transportista = (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    })
  : null;

async function enviarCorreoRecuperacion({ para, nombre, enlace }) {
  const asunto = 'Restablecé tu contraseña de Cuentas';
  const texto = `Hola ${nombre}:\n\nRecibimos un pedido para cambiar tu contraseña.\n\nAbrí este enlace (válido 30 minutos):\n${enlace}\n\nSi no lo pediste, ignorá este correo.\n`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
    <h2>Restablecé tu contraseña</h2>
    <p>Hola ${nombre}, recibimos un pedido para cambiar tu contraseña en Cuentas.</p>
    <p style="margin:24px 0">
      <a href="${enlace}" style="background:#27ae60;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block">Nueva contraseña</a>
    </p>
    <p>El enlace vence en 30 minutos y solo se puede usar una vez.</p>
    <p>Si no lo pediste, podés ignorar este correo.</p>
  </div>`;

  if (BREVO_API_KEY) {
    const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'Cuentas', email: EMAIL_REMITENTE },
        to: [{ email: para, name: nombre }],
        subject: asunto,
        textContent: texto,
        htmlContent: html
      })
    });

    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).slice(0, 200);
      throw new Error(`Brevo HTTP ${respuesta.status}: ${detalle}`);
    }
    return;
  }

  if (!transportista) {
    throw new Error('No hay proveedor de email configurado');
  }

  await transportista.sendMail({
    from: `"Cuentas" <${EMAIL_REMITENTE}>`,
    to: para,
    subject: asunto,
    text: texto,
    html: html
  });
}

const scrypt = promisify(crypto.scrypt);
const DURACION_SESION = 60 * 60 * 24 * 30; // 30 días, en segundos
const DURACION_RECUPERACION = 30 * 60 * 1000; // 30 minutos, en milisegundos

// Límite simple: máximo 3 pedidos por email cada 10 minutos
const intentosRecuperacion = new Map();

function permiteRecuperar(email) {
  const ahora = Date.now();
  const recientes = (intentosRecuperacion.get(email) || [])
    .filter(instante => ahora - instante < 10 * 60 * 1000);

  if (recientes.length >= 3) {
    intentosRecuperacion.set(email, recientes);
    return false;
  }

  recientes.push(ahora);
  intentosRecuperacion.set(email, recientes);
  return true;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// --- Contraseñas y tokens (usamos solo crypto, sin dependencias extra) ---

async function hashearContrasena(contrasena) {
  const sal = crypto.randomBytes(16).toString('hex');
  const derivada = await scrypt(contrasena, sal, 64);
  return `${sal}:${derivada.toString('hex')}`;
}

async function verificarContrasena(contrasena, guardada) {
  const [sal, hex] = String(guardada).split(':');
  if (!sal || !hex) return false;
  const derivada = await scrypt(contrasena, sal, 64);
  const esperada = Buffer.from(hex, 'hex');
  return derivada.length === esperada.length && crypto.timingSafeEqual(derivada, esperada);
}

function crearToken(usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = Buffer.from(JSON.stringify({
    sub: usuario.id,
    email: usuario.email,
    iat: ahora,
    exp: ahora + DURACION_SESION
  })).toString('base64url');

  const firma = crypto.createHmac('sha256', CLAVE_SESION).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
}

function leerToken(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;

  const [cuerpo, firma] = partes;
  const esperada = crypto.createHmac('sha256', CLAVE_SESION).update(cuerpo).digest('base64url');
  const recibida = Buffer.from(firma);
  const correcta = Buffer.from(esperada);

  if (recibida.length !== correcta.length || !crypto.timingSafeEqual(recibida, correcta)) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    if (!datos.sub || !datos.exp || datos.exp < Math.floor(Date.now() / 1000)) return null;
    return datos;
  } catch (error) {
    return null;
  }
}

// Middleware: exige un token válido en todas las rutas de datos
function requerirAuth(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  const datos = leerToken(token);

  if (!datos) {
    return res.status(401).json({ error: 'Sesión expirada o no válida. Iniciá sesión nuevamente.' });
  }

  req.usuario = { id: datos.sub, email: datos.email };
  next();
}

// Inicializar la base de datos (crea las tablas si no existen)
async function inicializarDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nombre TEXT,
      password_hash TEXT NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Las tablas ya existían sin usuario: agregamos la columna sin borrar los registros.
  // Los registros sin usuario se asignan a la primera cuenta que se cree (ver /registro).
  await pool.query(`
    ALTER TABLE gastos
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
  `);
  await pool.query(`
    ALTER TABLE ingresos
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_gastos_usuario ON gastos(usuario_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ingresos_usuario ON ingresos(usuario_id)');

  // Los montos permiten decimales: si alguna columna quedó como entero, la convertimos.
  // Se ejecuta en cada arranque; si ya es NUMERIC no hace nada.
  for (const tabla of ['gastos', 'ingresos']) {
    const columna = await pool.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'monto'`,
      [tabla]
    );
    if (columna.rowCount && ['integer', 'bigint', 'smallint'].includes(columna.rows[0].data_type)) {
      await pool.query(`ALTER TABLE ${tabla} ALTER COLUMN monto TYPE NUMERIC(12,2) USING monto::numeric`);
      console.log(`  Migrado ${tabla}.monto a NUMERIC(12,2)`);
    }
  }

  // Tokens de un solo uso para recuperar la contraseña
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recuperaciones (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expira_en TIMESTAMPTZ NOT NULL,
      usado BOOLEAN NOT NULL DEFAULT FALSE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_recuperaciones_token ON recuperaciones(token_hash)');
}

// Validación de fecha compartida (local, nunca UTC; sin fechas futuras ni del mes anterior)
function validarFecha(fecha, res) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha));
  if (!coincidencia) {
    res.status(400).json({ error: 'Formato de fecha no válido' });
    return false;
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fechaObj = new Date(anio, mes - 1, dia);

  // new Date corrige fechas imposibles (ej. 31/02), así que verificamos que coincida
  if (fechaObj.getFullYear() !== anio || fechaObj.getMonth() !== mes - 1 || fechaObj.getDate() !== dia) {
    res.status(400).json({ error: 'La fecha no es válida' });
    return false;
  }

  const hoy = new Date();
  const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  if (fechaObj > fechaHoy) {
    res.status(400).json({ error: 'No se puede ingresar una fecha posterior a la actual' });
    return false;
  }

  const esMesAnterior =
    fechaObj.getFullYear() < hoy.getFullYear() ||
    (fechaObj.getFullYear() === hoy.getFullYear() && fechaObj.getMonth() < hoy.getMonth());

  if (esMesAnterior) {
    res.status(400).json({ error: 'No se puede ingresar datos del mes anterior' });
    return false;
  }

  return true;
}

// --- Cuentas de usuario ---

// Registrar una cuenta nueva
app.post('/registro', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const contrasena = String(req.body.password || '');
  const nombre = String(req.body.nombre || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ingresá un email válido' });
  }
  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const hash = await hashearContrasena(contrasena);
    const resultado = await pool.query(
      `INSERT INTO usuarios (email, nombre, password_hash)
       VALUES ($1, $2, $3) RETURNING id, email, nombre`,
      [email, nombre || null, hash]
    );
    const usuario = resultado.rows[0];

    // Si es la primera cuenta, heredan los registros de prueba que ya estaban en la BD
    const total = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
    if (total.rows[0].n === 1) {
      await pool.query('UPDATE gastos SET usuario_id = $1 WHERE usuario_id IS NULL', [usuario.id]);
      await pool.query('UPDATE ingresos SET usuario_id = $1 WHERE usuario_id IS NULL', [usuario.id]);
    }

    res.status(201).json({
      token: crearToken(usuario),
      usuario,
      mensaje: 'Cuenta creada correctamente'
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    }
    console.error('Error al registrar usuario:', error.message);
    res.status(500).json({ error: 'No se pudo crear la cuenta' });
  }
});

// Iniciar sesión
app.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const contrasena = String(req.body.password || '');

  try {
    const resultado = await pool.query(
      'SELECT id, email, nombre, password_hash FROM usuarios WHERE email = $1',
      [email]
    );

    if (resultado.rowCount === 0 || !await verificarContrasena(contrasena, resultado.rows[0].password_hash)) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const usuario = resultado.rows[0];
    res.json({
      token: crearToken(usuario),
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
      mensaje: 'Sesión iniciada'
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);
    res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
});

// Datos del usuario de la sesión actual
app.get('/api/me', requerirAuth, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, email, nombre FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );
    if (resultado.rowCount === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado. Iniciá sesión nuevamente.' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error leyendo usuario:', error.message);
    res.status(500).json({ error: 'No se pudo leer el usuario' });
  }
});

// Cambiar la contraseña del usuario actual
app.post('/cambiar-contrasena', requerirAuth, async (req, res) => {
  const actual = String(req.body.contrasenaActual || '');
  const nueva = String(req.body.contrasenaNueva || '');

  if (!actual || nueva.length < 6) {
    return res.status(400).json({ error: 'Completá la contraseña actual y la nueva (mínimo 6 caracteres)' });
  }
  if (actual === nueva) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente de la actual' });
  }

  try {
    const resultado = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );
    if (resultado.rowCount === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado. Iniciá sesión nuevamente.' });
    }

    // Usamos 400 (no 401) para que el frontend no cierre la sesión por un error de tipeo
    if (!await verificarContrasena(actual, resultado.rows[0].password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hash = await hashearContrasena(nueva);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.usuario.id]);

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

// --- Recuperación de contraseña ---

const MENSAJE_GENERAL_RECUPERACION =
  'Si existe una cuenta con ese email, enviamos un enlace para restablecer la contraseña. Revisá también la carpeta de Spam.';

// Pedir el enlace de recuperación
app.post('/recuperar', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();

  // Siempre la misma respuesta: así no se revela qué emails están registrados
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !permiteRecuperar(email)) {
    return res.json({ mensaje: MENSAJE_GENERAL_RECUPERACION });
  }

  try {
    const usuario = await pool.query(
      'SELECT id, email, nombre FROM usuarios WHERE email = $1',
      [email]
    );

    if (usuario.rowCount > 0) {
      const u = usuario.rows[0];
      const token = crypto.randomBytes(32).toString('hex');

      // Invalidamos los enlaces anteriores de este usuario
      await pool.query(
        'UPDATE recuperaciones SET usado = TRUE WHERE usuario_id = $1 AND usado = FALSE',
        [u.id]
      );
      await pool.query(
        `INSERT INTO recuperaciones (usuario_id, token_hash, expira_en)
         VALUES ($1, $2, $3)`,
        [u.id, hashToken(token), new Date(Date.now() + DURACION_RECUPERACION)]
      );

      await enviarCorreoRecuperacion({
        para: u.email,
        nombre: u.nombre || 'usuario',
        enlace: `${URL_APP}/restablecer?token=${token}`
      });
    }
  } catch (error) {
    // No mostramos el error al usuario para no revelar si el email existe
    console.error('Error en recuperación:', error.message);
  }

  res.json({ mensaje: MENSAJE_GENERAL_RECUPERACION });
});

// Confirmar que el enlace sigue siendo válido (lo usa la pantalla de restablecer)
app.get('/api/restablecer/validar', async (req, res) => {
  const token = String(req.query.token || '');

  try {
    const resultado = await pool.query(
      `SELECT id FROM recuperaciones
       WHERE token_hash = $1 AND usado = FALSE AND expira_en > NOW()`,
      [hashToken(token)]
    );
    res.json({ valido: resultado.rowCount > 0 });
  } catch (error) {
    console.error('Error validando enlace:', error.message);
    res.status(500).json({ error: 'No se pudo validar el enlace' });
  }
});

// Guardar la nueva contraseña usando el token del correo
app.post('/restablecer', async (req, res) => {
  const token = String(req.body.token || '');
  const contrasena = String(req.body.password || '');

  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const recuperacion = await cliente.query(
      `SELECT id, usuario_id FROM recuperaciones
       WHERE token_hash = $1 AND usado = FALSE AND expira_en > NOW()
       FOR UPDATE`,
      [hashToken(token)]
    );

    if (recuperacion.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return res.status(400).json({ error: 'El enlace venció o no es válido. Solicitá uno nuevo.' });
    }

    const hash = await hashearContrasena(contrasena);
    await cliente.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2',
      [hash, recuperacion.rows[0].usuario_id]);
    await cliente.query('UPDATE recuperaciones SET usado = TRUE WHERE usuario_id = $1',
      [recuperacion.rows[0].usuario_id]);

    await cliente.query('COMMIT');
    res.json({ mensaje: 'Contraseña actualizada correctamente. Ya podés iniciar sesión.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al restablecer contraseña:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  } finally {
    cliente.release();
  }
});

// --- Gastos ---

// Registrar un nuevo gasto
app.post('/gastos', requerirAuth, async (req, res) => {
  const { fecha, categoria, descripcion } = req.body;
  const monto = Number(req.body.monto);

  if (!fecha || !categoria || !descripcion || !Number.isFinite(monto) || monto <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(String(req.body.monto))) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios y el monto debe ser mayor a 0 (hasta 2 decimales)' });
  }

  if (!validarFecha(fecha, res)) return;

  const categoriasFijas = ['Vivienda', 'Seguros', 'Electricidad', 'Agua', 'Internet', 'Celular'];
  const categoriasSemifijas = ['Alimentación', 'Transporte', 'Salud', 'Higiene'];
  const categoriasOcasionales = ['Salidas', 'Entretenimiento', 'Ahorro', 'Fondo Emergencia', 'Ropa', 'Zapatos', 'Otros'];

  let tipo;
  if (categoriasFijas.includes(categoria)) {
    tipo = 'fijo';
  } else if (categoriasSemifijas.includes(categoria)) {
    tipo = 'semifijo';
  } else if (categoriasOcasionales.includes(categoria)) {
    tipo = 'ocasional';
  } else {
    return res.status(400).json({ error: 'Categoría no válida' });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO gastos (fecha, categoria, descripcion, monto, tipo, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [fecha, categoria, descripcion, monto, tipo, req.usuario.id]
    );

    res.json({ id: resultado.rows[0].id, mensaje: 'Gasto registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar gasto:', error.message);
    res.status(500).json({ error: 'No se pudo registrar el gasto' });
  }
});

// Eliminar un gasto (solo del usuario actual)
app.delete('/gastos/:id', requerirAuth, async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM gastos WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [req.params.id, req.usuario.id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ mensaje: 'Gasto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar gasto:', error.message);
    res.status(500).json({ error: 'No se pudo eliminar el gasto' });
  }
});

// Listar gastos del usuario por fecha o mes
app.get('/gastos', requerirAuth, async (req, res) => {
  const { fecha, mes } = req.query;
  const params = [req.usuario.id];
  let sql = 'SELECT id, fecha, categoria, descripcion, monto, tipo FROM gastos WHERE usuario_id = $1';

  if (fecha) {
    params.push(fecha);
    sql += ` AND fecha = $${params.length}`;
  }

  if (mes) {
    params.push(`${mes}%`);
    sql += ` AND fecha LIKE $${params.length}`;
  }

  sql += ' ORDER BY fecha DESC, id DESC';

  try {
    const resultado = await pool.query(sql, params);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar gastos:', error.message);
    res.status(500).json({ error: 'No se pudieron listar los gastos' });
  }
});

// --- Ingresos ---

// Registrar un nuevo ingreso
app.post('/ingresos', requerirAuth, async (req, res) => {
  const { fecha, descripcion } = req.body;
  const monto = Number(req.body.monto);

  if (!fecha || !descripcion || !Number.isFinite(monto) || monto <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(String(req.body.monto))) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios y el monto debe ser mayor a 0 (hasta 2 decimales)' });
  }

  if (!validarFecha(fecha, res)) return;

  try {
    const resultado = await pool.query(
      `INSERT INTO ingresos (fecha, descripcion, monto, usuario_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [fecha, descripcion, monto, req.usuario.id]
    );

    res.json({ id: resultado.rows[0].id, mensaje: 'Ingreso registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar ingreso:', error.message);
    res.status(500).json({ error: 'No se pudo registrar el ingreso' });
  }
});

// Listar ingresos del usuario por fecha o mes
app.get('/ingresos', requerirAuth, async (req, res) => {
  const { fecha, mes } = req.query;
  const params = [req.usuario.id];
  let sql = 'SELECT id, fecha, descripcion, monto FROM ingresos WHERE usuario_id = $1';

  if (fecha) {
    params.push(fecha);
    sql += ` AND fecha = $${params.length}`;
  }

  if (mes) {
    params.push(`${mes}%`);
    sql += ` AND fecha LIKE $${params.length}`;
  }

  sql += ' ORDER BY fecha DESC, id DESC';

  try {
    const resultado = await pool.query(sql, params);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar ingresos:', error.message);
    res.status(500).json({ error: 'No se pudieron listar los ingresos' });
  }
});

// Eliminar un ingreso (solo del usuario actual)
app.delete('/ingresos/:id', requerirAuth, async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM ingresos WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [req.params.id, req.usuario.id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }

    res.json({ mensaje: 'Ingreso eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar ingreso:', error.message);
    res.status(500).json({ error: 'No se pudo eliminar el ingreso' });
  }
});

// Balance del mes, solo de los datos del usuario
app.get('/balance', requerirAuth, async (req, res) => {
  const { mes } = req.query;
  const params = [req.usuario.id];
  let where = ' WHERE usuario_id = $1';

  if (mes) {
    params.push(`${mes}%`);
    where += ` AND fecha LIKE $${params.length}`;
  }

  try {
    // Los alias van entre comillas para que Postgres respete mayúsculas/minúsculas
    const [resultadoGastos, resultadoIngresos] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(monto), 0) AS "totalGastos" FROM gastos${where}`, params),
      pool.query(`SELECT COALESCE(SUM(monto), 0) AS "totalIngresos" FROM ingresos${where}`, params)
    ]);

    const totalGastos = Number(resultadoGastos.rows[0].totalGastos);
    const totalIngresos = Number(resultadoIngresos.rows[0].totalIngresos);
    const balance = totalIngresos - totalGastos;

    res.json({ mes, totalIngresos, totalGastos, balance });
  } catch (error) {
    console.error('Error calculando balance:', error.message);
    res.status(500).json({ error: 'No se pudo calcular el balance' });
  }
});

// Generar un reporte PDF de gastos o ingresos, solo del usuario autenticado
app.get('/reporte', requerirAuth, async (req, res) => {
  const { tipo, modo, valor } = req.query;

  const formatoValor = modo === 'fecha' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;
  if (!['gastos', 'ingresos'].includes(tipo) || !['fecha', 'mes'].includes(modo) ||
      typeof valor !== 'string' || !formatoValor.test(valor)) {
    return res.status(400).json({ error: 'Parámetros del reporte no válidos' });
  }

  const tabla = tipo;
  const columnas = tipo === 'gastos'
    ? 'id, fecha, categoria, descripcion, monto, tipo'
    : 'id, fecha, descripcion, monto';
  const params = [req.usuario.id];
  let where = ' WHERE usuario_id = $1';

  if (modo === 'fecha') {
    params.push(valor);
    where += ` AND fecha = $${params.length}`;
  } else {
    params.push(`${valor}%`);
    where += ` AND fecha LIKE $${params.length}`;
  }

  try {
    const consultas = [pool.query(
      `SELECT ${columnas} FROM ${tabla}${where} ORDER BY fecha DESC, id DESC`, params
    )];

    if (modo === 'mes') {
      const otraTabla = tipo === 'gastos' ? 'ingresos' : 'gastos';
      consultas.push(pool.query(
        `SELECT COALESCE(SUM(monto), 0) AS total FROM ${otraTabla}${where}`, params
      ));
    }

    const resultados = await Promise.all(consultas);
    const filas = resultados[0].rows;
    const total = filas.reduce((suma, fila) => suma + Number(fila.monto), 0);
    const periodo = modo === 'mes' ? `Mes ${valor}` : `Día ${valor}`;
    const emision = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${tipo}-${valor}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    doc.pipe(res);

    const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const xFecha = 45;
    const xDescripcion = 130;
    const xMonto = 45 + ancho - 85;
    const anchoDescripcion = xMonto - xDescripcion - 10;

    doc.font('Helvetica-Bold').fontSize(18).text('Cuentas', { align: 'center' });
    doc.fontSize(12).text(`Reporte de ${tipo}`, { align: 'center' });
    doc.font('Helvetica').fontSize(10)
      .text(`${periodo}  |  Emitido: ${emision}  |  Usuario: ${req.usuario.email || '-'}`, { align: 'center' });

    let y = doc.y + 16;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Fecha', xFecha, y, { width: 80 });
    doc.text('Descripción', xDescripcion, y, { width: anchoDescripcion });
    doc.text('Monto', xMonto, y, { width: 85, align: 'right' });
    y += 16;
    doc.moveTo(xFecha, y - 4).lineTo(xFecha + ancho, y - 4).stroke();
    doc.font('Helvetica').fontSize(9);

    filas.forEach((fila) => {
      const descripcion = tipo === 'gastos'
        ? `${fila.categoria}: ${fila.descripcion} (${fila.tipo})`
        : fila.descripcion;
      const altura = doc.heightOfString(descripcion, { width: anchoDescripcion }) + 8;

      if (y + altura > doc.page.height - doc.page.margins.bottom - 70) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      doc.text(fila.fecha, xFecha, y, { width: 80 });
      doc.text(descripcion, xDescripcion, y, { width: anchoDescripcion });
      doc.text(`$${Number(fila.monto).toFixed(2)}`, xMonto, y, { width: 85, align: 'right' });
      y += altura;
    });

    y += 6;
    doc.moveTo(xFecha, y).lineTo(xFecha + ancho, y).stroke();
    y += 12;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`${filas.length} ${tipo === 'gastos' ? 'gasto' : 'ingreso'}${filas.length === 1 ? '' : 's'} registrado${filas.length === 1 ? '' : 's'}`, xFecha, y);
    doc.text(`Total: $${total.toFixed(2)}`, xMonto - 60, y, { width: 145, align: 'right' });
    y += 20;

    if (filas.length === 0) {
      doc.font('Helvetica').fontSize(10)
        .text('No hay registros para el período seleccionado.', xFecha, y);
    }

    if (modo === 'mes') {
      const otroTotal = Number(resultados[1].rows[0].total);
      const ingresos = tipo === 'gastos' ? total : otroTotal;
      const gastos = tipo === 'gastos' ? otroTotal : total;

      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(`Ingresos: $${ingresos.toFixed(2)}`, xFecha, y); y += 16;
      doc.text(`Gastos: $${gastos.toFixed(2)}`, xFecha, y); y += 16;
      doc.text(`Balance: $${(ingresos - gastos).toFixed(2)}`, xFecha, y);
    }

    doc.end();
  } catch (error) {
    console.error('Error al generar reporte:', error.message);
    res.status(500).json({ error: 'No se pudo generar el reporte' });
  }
});

// Obtener las direcciones IP locales de la computadora
function obtenerIPsLocales() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Inicializar y empezar el servidor
inicializarDB()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log('=============================================');
      console.log('  CUENTAS - API y frontend funcionando');
      console.log('=============================================');
      console.log('  Base de datos: PostgreSQL (Supabase)');
      console.log('  Autenticación: usuario + contraseña');

      if (process.env.RENDER) {
        console.log('  Modo nube: accesible desde la URL que te da Render');
      } else {
        console.log(`  En esta computadora: http://localhost:${port}`);
        const ips = obtenerIPsLocales();
        if (ips.length > 0) {
          ips.forEach(ip => {
            console.log(`  En el celular (mismo WiFi): http://${ip}:${port}`);
          });
        }
      }
      console.log('=============================================');
    });
  })
  .catch((error) => {
    console.error('No se pudo conectar a la base de datos:', error.message);
    console.error('Revisá la DATABASE_URL en tu archivo .env');
    process.exit(1);
  });
