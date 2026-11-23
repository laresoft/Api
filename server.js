const express = require('express');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const path = require('path');
const os = require('os');
const app = express();
// En la nube (Render) el puerto lo asigna la plataforma; en local usamos 3000
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir el frontend (index.html, style.css, script.js) desde este mismo servidor
app.use(express.static(__dirname));

// Base de datos SQLite.
// En la nube usamos DB_PATH (un disco persistente). En local, el archivo de siempre.
const rutaBaseDeDatos = process.env.DB_PATH || path.join(__dirname, 'gastos.db');
let db = new sqlite3.Database(rutaBaseDeDatos, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Conexión a la base de datos establecida');
});

// Inicializar la base de datos
function inicializarDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS gastos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          categoria TEXT NOT NULL,
          descripcion TEXT NOT NULL,
          monto REAL NOT NULL CHECK(monto > 0),
          tipo TEXT NOT NULL CHECK(tipo IN ('fijo', 'semifijo', 'ocasional'))
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS ingresos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          descripcion TEXT NOT NULL,
          monto REAL NOT NULL CHECK(monto > 0)
        )
      `);
    });
    resolve();
  });
}

// Rutas para Gastos

// 1. Registrar un nuevo gasto
app.post('/gastos', async (req, res) => {
  const { fecha, categoria, descripcion, monto } = req.body;

  // Validación: todos los campos obligatorios
  if (!fecha || !categoria || !descripcion || monto === undefined || monto <= 0) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios y el monto debe ser mayor a 0' });
  }

  // Validación: fecha no puede ser posterior a la actual ni del mes anterior
  const fechaObj = new Date(fecha);
  const hoy = new Date();

  // Usar fecha local, nunca UTC
  const fechaLocal = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate()
  );

  // Verificar que la fecha no sea posterior a hoy
  if (fechaObj > fechaLocal) {
    return res.status(400).json({ error: 'No se puede ingresar una fecha posterior a la actual' });
  }

  // Verificar que no sea del mes anterior (mismo día/mes pero año/anterior)
  const esMesAnterior =
    fechaObj.getFullYear() < hoy.getFullYear() ||
    (fechaObj.getFullYear() === hoy.getFullYear() &&
      fechaObj.getMonth() < hoy.getMonth());

  if (esMesAnterior) {
    return res.status(400).json({ error: 'No se puede ingresar datos del mes anterior' });
  }

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

  const sql = `INSERT INTO gastos (fecha, categoria, descripcion, monto, tipo) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [fecha, categoria, descripcion, monto, tipo], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastId, mensaje: 'Gasto registrado correctamente' });
  });
});

// 2. Eliminar un gasto
app.delete('/gastos/:id', (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM gastos WHERE id = ?`;
  db.run(sql, [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json({ mensaje: 'Gasto eliminado correctamente' });
  });
});

// 3. Listar gastos por fecha o mes
app.get('/gastos', (req, res) => {
  const { fecha, mes } = req.query;
  let sql = `SELECT * FROM gastos WHERE 1=1`;
  let params = [];

  if (fecha) {
    // Filtrar por fecha exacta (YYYY-MM-DD)
    sql += ` AND fecha = ?`;
    params.push(fecha);
  }

  if (mes) {
    // Filtrar por mes (YYYY-MM)
    sql += ` AND fecha LIKE ?`;
    params.push(`${mes}%`);
  }

  sql += ` ORDER BY fecha DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Rutas para Ingresos

// 4. Registrar un nuevo ingreso
app.post('/ingresos', async (req, res) => {
  const { fecha, descripcion, monto } = req.body;

  // Validación: todos los campos obligatorios
  if (!fecha || !descripcion || monto === undefined || monto <= 0) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios y el monto debe ser mayor a 0' });
  }

  // Validación: fecha no puede ser posterior a la actual
  const fechaObj = new Date(fecha);
  const hoy = new Date();

  // Usar fecha local, nunca UTC
  const fechaLocal = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate()
  );

  // Verificar que la fecha no sea posterior a hoy
  if (fechaObj > fechaLocal) {
    return res.status(400).json({ error: 'No se puede ingresar una fecha posterior a la actual' });
  }

  // Verificar que no sea del mes anterior
  const esMesAnterior =
    fechaObj.getFullYear() < hoy.getFullYear() ||
    (fechaObj.getFullYear() === hoy.getFullYear() &&
      fechaObj.getMonth() < hoy.getMonth());

  if (esMesAnterior) {
    return res.status(400).json({ error: 'No se puede ingresar datos del mes anterior' });
  }

  const sql = `INSERT INTO ingresos (fecha, descripcion, monto) VALUES (?, ?, ?)`;
  db.run(sql, [fecha, descripcion, monto], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastId, mensaje: 'Ingreso registrado correctamente' });
  });
});

// 4b. Listar ingresos por fecha o mes
app.get('/ingresos', (req, res) => {
  const { fecha, mes } = req.query;
  let sql = `SELECT * FROM ingresos WHERE 1=1`;
  let params = [];

  if (fecha) {
    sql += ` AND fecha = ?`;
    params.push(fecha);
  }

  if (mes) {
    sql += ` AND fecha LIKE ?`;
    params.push(`${mes}%`);
  }

  sql += ` ORDER BY fecha DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 4c. Eliminar un ingreso
app.delete('/ingresos/:id', (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM ingresos WHERE id = ?`;
  db.run(sql, [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }
    res.json({ mensaje: 'Ingreso eliminado correctamente' });
  });
});

// 5. Balance en el mes
app.get('/balance', (req, res) => {
  const { mes } = req.query;

  let sqlGastos = `SELECT COALESCE(SUM(monto), 0) as totalGastos FROM gastos`;
  let sqlIngresos = `SELECT COALESCE(SUM(monto), 0) as totalIngresos FROM ingresos`;
  let params = [];

  if (mes) {
    sqlGastos += ` WHERE fecha LIKE ?`;
    sqlIngresos += ` WHERE fecha LIKE ?`;
    params.push(`${mes}%`);
  }

  db.get(sqlGastos, params, (err, rowGastos) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    db.get(sqlIngresos, params, (err, rowIngresos) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const totalGastos = rowGastos.totalGastos;
      const totalIngresos = rowIngresos.totalIngresos;
      const balance = totalIngresos - totalGastos;

      res.json({
        mes,
        totalIngresos,
        totalGastos,
        balance
      });
    });
  });
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
inicializarDB().then(() => {
  // Escuchar en todas las interfaces para que el celular pueda conectarse
  app.listen(port, '0.0.0.0', () => {
    console.log('=============================================');
    console.log('  CUENTAS - API y frontend funcionando');
    console.log('=============================================');
    console.log(`  Base de datos: ${rutaBaseDeDatos}`);

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
});