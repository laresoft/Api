const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const os = require('os');

require('dotenv').config();

const app = express();
// En la nube (Render) el puerto lo asigna la plataforma; en local usamos 3000
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Nunca servir archivos sensibles (serve-static ya ignora dotfiles, pero lo dejamos explícito)
app.use((req, res, next) => {
  if (/(^|\/)\.env(\.|$)|(^|\/)\.git(\/|$)|^\/android\//.test(req.path)) {
    return res.status(404).end();
  }
  next();
});

// Servir el frontend (index.html, style.css, script.js) desde este mismo servidor
app.use(express.static(__dirname));

// Base de datos PostgreSQL (Supabase). La URL se lee del archivo .env / variable de entorno.
if (!process.env.DATABASE_URL) {
  console.error('ERROR: falta DATABASE_URL. Poné la cadena de Supabase en el archivo .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Inicializar la base de datos (crea las tablas si no existen)
async function inicializarDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos (
      id SERIAL PRIMARY KEY,
      fecha TEXT NOT NULL,
      categoria TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      monto DOUBLE PRECISION NOT NULL CHECK (monto > 0),
      tipo TEXT NOT NULL CHECK (tipo IN ('fijo', 'semifijo', 'ocasional'))
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingresos (
      id SERIAL PRIMARY KEY,
      fecha TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      monto DOUBLE PRECISION NOT NULL CHECK (monto > 0)
    )
  `);
}

// Validación de fecha compartida (local, nunca UTC; sin fechas futuras ni del mes anterior)
function validarFecha(fecha, res) {
  const fechaObj = new Date(fecha);
  const hoy = new Date();

  const fechaLocal = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate()
  );

  if (fechaObj > fechaLocal) {
    res.status(400).json({ error: 'No se puede ingresar una fecha posterior a la actual' });
    return false;
  }

  const esMesAnterior =
    fechaObj.getFullYear() < hoy.getFullYear() ||
    (fechaObj.getFullYear() === hoy.getFullYear() &&
      fechaObj.getMonth() < hoy.getMonth());

  if (esMesAnterior) {
    res.status(400).json({ error: 'No se puede ingresar datos del mes anterior' });
    return false;
  }

  return true;
}

// Rutas para Gastos

// 1. Registrar un nuevo gasto
app.post('/gastos', async (req, res) => {
  const { fecha, categoria, descripcion, monto } = req.body;

  // Validación: todos los campos obligatorios
  if (!fecha || !categoria || !descripcion || monto === undefined || monto <= 0) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios y el monto debe ser mayor a 0' });
  }

  if (!validarFecha(fecha, res)) return;

  // Determinar el tipo de categoría
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
      `INSERT INTO gastos (fecha, categoria, descripcion, monto, tipo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [fecha, categoria, descripcion, monto, tipo]
    );

    res.json({ id: resultado.rows[0].id, mensaje: 'Gasto registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar gasto:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. Eliminar un gasto
app.delete('/gastos/:id', async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM gastos WHERE id = $1 RETURNING id', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ mensaje: 'Gasto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar gasto:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Listar gastos por fecha o mes
app.get('/gastos', async (req, res) => {
  const { fecha, mes } = req.query;
  let sql = 'SELECT * FROM gastos WHERE 1=1';
  const params = [];

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
    res.status(500).json({ error: error.message });
  }
});

// Rutas para Ingresos

// 4. Registrar un nuevo ingreso
app.post('/ingresos', async (req, res) => {
  const { fecha, descripcion, monto } = req.body;

  if (!fecha || !descripcion || monto === undefined || monto <= 0) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios y el monto debe ser mayor a 0' });
  }

  if (!validarFecha(fecha, res)) return;

  try {
    const resultado = await pool.query(
      `INSERT INTO ingresos (fecha, descripcion, monto)
       VALUES ($1, $2, $3) RETURNING id`,
      [fecha, descripcion, monto]
    );

    res.json({ id: resultado.rows[0].id, mensaje: 'Ingreso registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar ingreso:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4b. Listar ingresos por fecha o mes
app.get('/ingresos', async (req, res) => {
  const { fecha, mes } = req.query;
  let sql = 'SELECT * FROM ingresos WHERE 1=1';
  const params = [];

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
    res.status(500).json({ error: error.message });
  }
});

// 4c. Eliminar un ingreso
app.delete('/ingresos/:id', async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM ingresos WHERE id = $1 RETURNING id', [req.params.id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }

    res.json({ mensaje: 'Ingreso eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar ingreso:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 5. Balance en el mes
app.get('/balance', async (req, res) => {
  const { mes } = req.query;
  const params = [];
  let where = '';

  if (mes) {
    params.push(`${mes}%`);
    where = ' WHERE fecha LIKE $1';
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
    res.status(500).json({ error: error.message });
  }
});

// Obtener las direcciones IP locales de la computadora
function obtenerIPsLocales() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre]) {
      // Solo IPv4 y no internas (127.0.0.1)
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
