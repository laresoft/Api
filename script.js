// Script principal para la aplicación de control de gastos e ingresos
// Conecta los formularios con la API REST

// Detección automática de la dirección de la API:
// - Si abres la página desde el servidor (http://localhost:3000 o
//   http://192.168.x.x:3000 en el celular), usamos rutas relativas.
//   Así no importa desde qué dispositivo se abra: siempre apunta al servidor correcto.
// - Si abres el archivo index.html directamente (file://), usamos localhost
//   como opción por defecto (la API debe estar corriendo en la misma computadora).
const API_BASE = (() => {
  const esServidor = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  return esServidor ? '' : 'http://localhost:3000';
})();

// Elementos del DOM para Gastos
const formGasto = document.getElementById('form-gasto');
const categoriaGasto = document.getElementById('categoria-gasto');
const descripcionGasto = document.getElementById('descripcion-gasto');
const modoFecha = document.getElementById('modo-fecha');
const modoMes = document.getElementById('modo-mes');
const campoFecha = document.getElementById('campo-fecha');
const campoMes = document.getElementById('campo-mes');
const fechaLista = document.getElementById('fecha-lista');
const mesLista = document.getElementById('mes-lista');
const resultadoGastos = document.getElementById('resultado-gastos');

// Elementos del DOM para Ingresos
const formIngreso = document.getElementById('form-ingreso');
const fechaIngreso = document.getElementById('fecha-ingreso');
const descripcionIngreso = document.getElementById('descripcion-ingreso');
const modoIngresoFecha = document.getElementById('modo-ingreso-fecha');
const modoIngresoMes = document.getElementById('modo-ingreso-mes');
const campoIngresoFecha = document.getElementById('campo-ingreso-fecha');
const campoIngresoMes = document.getElementById('campo-ingreso-mes');
const fechaListaIngreso = document.getElementById('fecha-lista-ingreso');
const mesListaIngreso = document.getElementById('mes-lista-ingreso');
const resultadoIngresos = document.getElementById('resultado-ingresos');
const mesBalance = document.getElementById('mes-balance');
const resultadoBalance = document.getElementById('resultado-balance');

// Funciones de fecha LOCAL (nunca UTC)
function fechaLocalISO(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function mesLocalISO(fecha = new Date()) {
  return fechaLocalISO(fecha).substring(0, 7);
}

// Mapeo de categorías a descripciones predeterminadas para gastos
const descripcionesPorCategoria = {
  Vivienda: 'Pago de vivienda',
  Seguros: 'Prima de seguro',
  Electricidad: 'Factura de electricidad',
  Agua: 'Factura de agua',
  Internet: 'Suscripción de internet',
  Celular: 'Recarga o plan de celular',
  Alimentación: 'Compra de alimentos',
  Transporte: 'Pasaje o combustible',
  Salud: 'Consulta o medicamento',
  Higiene: 'Productos de higiene',
  Salidas: 'Salida con amigos',
  Entretenimiento: 'Cine, juegos, etc.',
  Ahorro: 'Ahorro mensual',
  'Fondo Emergencia': 'Aporte al fondo de emergencia',
  Ropa: 'Prenda de vestir',
  Zapatos: 'Par de zapatos',
  Otros: 'Otro gasto'
};

// Sugerir una descripción al cambiar de categoría (el usuario puede editarla)
categoriaGasto.addEventListener('change', (e) => {
  const seleccion = e.target.value;
  const sugerencia = descripcionesPorCategoria[seleccion] || '';
  const valorActual = descripcionGasto.value.trim();
  const eraSugerencia = Object.values(descripcionesPorCategoria).includes(valorActual);

  // Solo rellenamos si está vacío o si aún tiene una sugerencia anterior.
  // Si el usuario escribió su propio texto, lo respetamos.
  if (!valorActual || eraSugerencia) {
    descripcionGasto.value = sugerencia;
  }
});

// Manejar formulario de gasto
formGasto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fecha = document.getElementById('fecha-gasto').value;
  const categoria = categoriaGasto.value;
  const descripcion = descripcionGasto.value;
  const monto = parseFloat(document.getElementById('monto-gasto').value);

  if (!fecha || !categoria || !descripcion || isNaN(monto) || monto <= 0) {
    alert('Por favor complete todos los campos correctamente');
    return;
  }

  try {
    const respuesta = await fetch(`${API_BASE}/gastos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, categoria, descripcion, monto })
    });

    const data = await respuesta.json();
    if (respuesta.ok) {
      alert(data.mensaje || 'Gasto guardado correctamente');
      formGasto.reset();
      descripcionGasto.value = '';
      categoriaGasto.selectedIndex = 0;
      cargarGastos();
      calcularBalance();
    } else {
      alert(data.error || 'Error al guardar el gasto');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('No se pudo conectar con el servidor. Asegúrese de que esté corriendo.');
  }
});

// Devuelve el modo activo: 'fecha' o 'mes'
function modoSeleccionado() {
  return modoMes.checked ? 'mes' : 'fecha';
}

// Muestra u oculta el calendario según el modo elegido, y recarga la lista
function actualizarCampos() {
  const modo = modoSeleccionado();
  campoFecha.classList.toggle('oculto', modo !== 'fecha');
  campoMes.classList.toggle('oculto', modo !== 'mes');
  cargarGastos();
}

// Escuchar cambios en el selector y en los calendarios
modoFecha.addEventListener('change', actualizarCampos);
modoMes.addEventListener('change', actualizarCampos);
fechaLista.addEventListener('change', cargarGastos);
mesLista.addEventListener('change', cargarGastos);

// Cargar lista de gastos según el modo elegido
function cargarGastos() {
  const modo = modoSeleccionado();
  const valor = modo === 'mes' ? mesLista.value : fechaLista.value;

  if (!valor) {
    resultadoGastos.innerHTML = '<p>Elige una fecha o un mes para ver los gastos.</p>';
    return;
  }

  const consulta = modo === 'mes' ? `mes=${valor}` : `fecha=${valor}`;

  fetch(`${API_BASE}/gastos?${consulta}`)
    .then(res => res.json())
    .then(data => {
      let html = '';

      if (modo === 'mes') {
        const total = data.reduce((suma, gasto) => suma + gasto.monto, 0);
        html += `<div class="resumen-mes">
          <strong>Total del mes: $${total.toFixed(2)}</strong>
          <br><small>${data.length} gasto${data.length === 1 ? '' : 's'} registrado${data.length === 1 ? '' : 's'}</small>
        </div>`;
      }

      if (data.length === 0) {
        html += '<p>No hay gastos registrados para el criterio seleccionado.</p>';
      } else {
        data.forEach(gasto => {
          html += `<div class="item-gasto">
            <div>
              <strong>${gasto.categoria}: ${gasto.descripcion}</strong>
              <br><small>$${gasto.monto.toFixed(2)} - ${gasto.fecha} - ${gasto.tipo}</small>
            </div>
            <button type="button" class="btn-eliminar" onclick="eliminarGasto(${gasto.id})">🗑️ Eliminar</button>
          </div>`;
        });
      }

      resultadoGastos.innerHTML = html;
    })
    .catch(err => {
      console.error('Error cargando gastos:', err);
      resultadoGastos.innerHTML = '<p>Error al cargar los gastos. Revisa que la API esté corriendo.</p>';
    });
}

// Eliminar un gasto (con confirmación) y recargar todo
async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;

  try {
    const respuesta = await fetch(`${API_BASE}/gastos/${id}`, { method: 'DELETE' });
    const data = await respuesta.json();

    if (respuesta.ok) {
      alert(data.mensaje);
      cargarGastos();
      calcularBalance();
    } else {
      alert(data.error || 'No se pudo eliminar el gasto');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión al eliminar el gasto');
  }
}

// --- Lista de ingresos ---

function modoIngresoSeleccionado() {
  return modoIngresoMes.checked ? 'mes' : 'fecha';
}

function actualizarCamposIngresos() {
  const modo = modoIngresoSeleccionado();
  campoIngresoFecha.classList.toggle('oculto', modo !== 'fecha');
  campoIngresoMes.classList.toggle('oculto', modo !== 'mes');
  cargarIngresos();
}

modoIngresoFecha.addEventListener('change', actualizarCamposIngresos);
modoIngresoMes.addEventListener('change', actualizarCamposIngresos);
fechaListaIngreso.addEventListener('change', cargarIngresos);
mesListaIngreso.addEventListener('change', cargarIngresos);

function cargarIngresos() {
  const modo = modoIngresoSeleccionado();
  const valor = modo === 'mes' ? mesListaIngreso.value : fechaListaIngreso.value;

  if (!valor) {
    resultadoIngresos.innerHTML = '<p>Elige una fecha o un mes para ver los ingresos.</p>';
    return;
  }

  const consulta = modo === 'mes' ? `mes=${valor}` : `fecha=${valor}`;

  fetch(`${API_BASE}/ingresos?${consulta}`)
    .then(res => res.json())
    .then(data => {
      let html = '';

      if (modo === 'mes') {
        const total = data.reduce((suma, ingreso) => suma + ingreso.monto, 0);
        html += `<div class="resumen-mes">
          <strong>Total del mes: $${total.toFixed(2)}</strong>
          <br><small>${data.length} ingreso${data.length === 1 ? '' : 's'} registrado${data.length === 1 ? '' : 's'}</small>
        </div>`;
      }

      if (data.length === 0) {
        html += '<p>No hay ingresos registrados para el criterio seleccionado.</p>';
      } else {
        data.forEach(ingreso => {
          html += `<div class="item-ingreso">
            <div>
              <strong>${ingreso.descripcion}</strong>
              <br><small>$${ingreso.monto.toFixed(2)} - ${ingreso.fecha}</small>
            </div>
            <button type="button" class="btn-eliminar" onclick="eliminarIngreso(${ingreso.id})">🗑️ Eliminar</button>
          </div>`;
        });
      }

      resultadoIngresos.innerHTML = html;
    })
    .catch(err => {
      console.error('Error cargando ingresos:', err);
      resultadoIngresos.innerHTML = '<p>Error al cargar los ingresos. Revisa que la API esté corriendo.</p>';
    });
}

async function eliminarIngreso(id) {
  if (!confirm('¿Eliminar este ingreso?')) return;

  try {
    const respuesta = await fetch(`${API_BASE}/ingresos/${id}`, { method: 'DELETE' });
    const data = await respuesta.json();

    if (respuesta.ok) {
      alert(data.mensaje);
      cargarIngresos();
      calcularBalance();
    } else {
      alert(data.error || 'No se pudo eliminar el ingreso');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión al eliminar el ingreso');
  }
}

// Manejar formulario de ingreso
formIngreso.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fecha = document.getElementById('fecha-ingreso').value;
  const descripcion = document.getElementById('descripcion-ingreso').value;
  const monto = parseFloat(document.getElementById('monto-ingreso').value);

  if (!fecha || !descripcion || isNaN(monto) || monto <= 0) {
    alert('Por favor complete todos los campos correctamente');
    return;
  }

  try {
    const respuesta = await fetch(`${API_BASE}/ingresos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, descripcion, monto })
    });

    const data = await respuesta.json();
    if (respuesta.ok) {
      alert(data.mensaje || 'Ingreso guardado correctamente');
      formIngreso.reset();
      cargarIngresos();
      calcularBalance();
    } else {
      alert(data.error || 'Error al guardar el ingreso');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('No se pudo conectar con el servidor.');
  }
});

// Calcular balance
function calcularBalance() {
  const mes = mesBalance.value;

  if (!mes) {
    resultadoBalance.innerHTML = '<p>Elige un mes para calcular el balance.</p>';
    return;
  }

  fetch(`${API_BASE}/balance?mes=${mes}`)
    .then(res => res.json())
    .then(data => {
      const esPositivo = data.balance >= 0;
      resultadoBalance.innerHTML = `
        <div class="balance-tarjetas">
          <div class="balance-tarjeta ingreso">
            <span class="etiqueta">Ingresos</span>
            <strong>$${data.totalIngresos.toFixed(2)}</strong>
          </div>
          <div class="balance-tarjeta gasto">
            <span class="etiqueta">Gastos</span>
            <strong>$${data.totalGastos.toFixed(2)}</strong>
          </div>
          <div class="balance-tarjeta total ${esPositivo ? 'positivo' : 'negativo'}">
            <span class="etiqueta">Balance</span>
            <strong>$${data.balance.toFixed(2)}</strong>
            <small>${esPositivo ? '✅ Positivo' : '⚠️ Negativo'}</small>
          </div>
        </div>
      `;
    })
    .catch(err => console.error('Error calculando balance:', err));
}

// También recalcular automáticamente al cambiar el mes del balance
mesBalance.addEventListener('change', calcularBalance);

// Registrar el service worker (solo funciona en HTTPS o localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err =>
      console.log('Service worker no disponible:', err)
    );
  });
}

// Al iniciar: dejar todo listo con la fecha local de hoy
document.addEventListener('DOMContentLoaded', () => {
  const hoy = fechaLocalISO();
  const mesActual = mesLocalISO();

  document.getElementById('fecha-gasto').value = hoy;
  document.getElementById('fecha-ingreso').value = hoy;
  fechaLista.value = hoy;
  mesLista.value = mesActual;
  fechaListaIngreso.value = hoy;
  mesListaIngreso.value = mesActual;
  mesBalance.value = mesActual;

  // Muestra los calendarios correctos y carga los datos de hoy
  actualizarCampos();
  actualizarCamposIngresos();
  calcularBalance();
});