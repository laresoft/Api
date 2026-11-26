// Script principal para la aplicación de control de gastos e ingresos
// Incluye inicio de sesión: cada usuario ve solamente sus propios datos.

// Detección automática de la dirección de la API:
// - Si abres la página desde el servidor (http://localhost:3000, la URL de Render
//   o la APK), usamos rutas relativas: siempre apunta al servidor correcto.
// - Si abres index.html directamente (file://), usamos localhost por defecto.
const API_BASE = (() => {
  const esServidor = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  return esServidor ? '' : 'http://localhost:3000';
})();

const CLAVE_TOKEN = 'cuentas-token';

// --- Sesión y llamadas a la API ---

function obtenerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

function guardarToken(token) {
  localStorage.setItem(CLAVE_TOKEN, token);
}

async function apiJSON(ruta, opciones = {}) {
  const headers = { ...(opciones.headers || {}) };
  const token = obtenerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opciones.body !== undefined) headers['Content-Type'] = 'application/json';

  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE}${ruta}`, { ...opciones, headers });
  } catch (error) {
    throw new Error('No se pudo conectar con el servidor. Revisá tu conexión.');
  }

  let datos = {};
  try {
    datos = await respuesta.json();
  } catch (error) {
    // Una respuesta sin JSON también es un error
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta !== '/login' && ruta !== '/registro') {
      cerrarSesion('Tu sesión venció. Iniciá sesión nuevamente.');
    }
    throw new Error(datos.error || 'Ocurrió un error en la solicitud');
  }

  return datos;
}

// Igual que apiJSON, pero para respuestas binarias (PDF)
async function apiBlob(ruta) {
  const headers = {};
  const token = obtenerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE}${ruta}`, { headers });
  } catch (error) {
    throw new Error('No se pudo conectar con el servidor. Revisá tu conexión.');
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401) cerrarSesion('Tu sesión venció. Iniciá sesión nuevamente.');
    let datos = {};
    try { datos = await respuesta.json(); } catch (error) { /* sin JSON */ }
    throw new Error(datos.error || 'No se pudo generar el reporte');
  }

  return respuesta.blob();
}

// --- Pantalla de acceso ---

const auth = document.getElementById('auth');
const app = document.getElementById('app');
const barraUsuario = document.getElementById('barra-usuario');
const usuarioEmail = document.getElementById('usuario-email');
const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
const authTitulo = document.getElementById('auth-titulo');
const authMensaje = document.getElementById('auth-mensaje');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const btnLogin = document.getElementById('btn-login');
const btnRegistro = document.getElementById('btn-registro');
const btnAlternarAuth = document.getElementById('btn-alternar-auth');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const registroNombre = document.getElementById('registro-nombre');
const registroEmail = document.getElementById('registro-email');
const registroPassword = document.getElementById('registro-password');
const registroConfirmar = document.getElementById('registro-confirmar');
const modalBienvenida = document.getElementById('modal-bienvenida');
const bienvenidaTitulo = document.getElementById('bienvenida-titulo');
const bienvenidaMensaje = document.getElementById('bienvenida-mensaje');
const btnBienvenidaContinuar = document.getElementById('btn-bienvenida-continuar');

// Pantallas de recuperación de contraseña
const olvide = document.getElementById('olvide');
const restablecer = document.getElementById('restablecer');
const btnOlvide = document.getElementById('btn-olvide');
const formRecuperar = document.getElementById('form-recuperar');
const btnRecuperar = document.getElementById('btn-recuperar');
const recuperarEmail = document.getElementById('recuperar-email');
const mensajeRecuperar = document.getElementById('mensaje-recuperar');
const formRestablecer = document.getElementById('form-restablecer');
const btnRestablecer = document.getElementById('btn-restablecer');
const restablecerPassword = document.getElementById('restablecer-password');
const restablecerConfirmar = document.getElementById('restablecer-confirmar');
const mensajeRestablecer = document.getElementById('mensaje-restablecer');
const mensajeToken = document.getElementById('mensaje-token');

let mostrandoRegistro = false;

// Botones "Ver / Ocultar" para poder corregir la contraseña antes de enviar
function ocultarContrasenas() {
  document.querySelectorAll('.btn-ver-contra').forEach(boton => {
    const campo = document.getElementById(boton.dataset.ver);
    campo.type = 'password';
    boton.textContent = '👁️ Ver';
    boton.setAttribute('aria-label', 'Ver contraseña');
  });
}

document.querySelectorAll('.btn-ver-contra').forEach(boton => {
  boton.addEventListener('click', () => {
    const campo = document.getElementById(boton.dataset.ver);
    const estabaVisible = campo.type === 'text';
    campo.type = estabaVisible ? 'password' : 'text';
    boton.textContent = estabaVisible ? '👁️ Ver' : '🙈 Ocultar';
    boton.setAttribute('aria-label', estabaVisible ? 'Ver contraseña' : 'Ocultar contraseña');
    campo.focus();
  });
});

function mostrarAuth(mensaje = '') {
  app.classList.add('oculto');
  barraUsuario.classList.add('oculto');
  olvide.classList.add('oculto');
  restablecer.classList.add('oculto');
  auth.classList.remove('oculto');
  authMensaje.textContent = mensaje;
}

function mostrarOlvide() {
  app.classList.add('oculto');
  barraUsuario.classList.add('oculto');
  auth.classList.add('oculto');
  restablecer.classList.add('oculto');
  olvide.classList.remove('oculto');
  mensajeRecuperar.textContent = '';
  mensajeRecuperar.classList.remove('ok');
  recuperarEmail.value = loginEmail.value.trim();
  recuperarEmail.focus();
}

function mostrarRestablecer() {
  app.classList.add('oculto');
  barraUsuario.classList.add('oculto');
  auth.classList.add('oculto');
  olvide.classList.add('oculto');
  restablecer.classList.remove('oculto');
}

function mostrarApp(usuario) {
  auth.classList.add('oculto');
  app.classList.remove('oculto');
  barraUsuario.classList.remove('oculto');
  usuarioEmail.textContent = usuario.nombre || usuario.email || '';
}

function cerrarSesion(mensaje = '') {
  localStorage.removeItem(CLAVE_TOKEN);
  modalBienvenida.classList.add('oculto');
  olvide.classList.add('oculto');
  restablecer.classList.add('oculto');
  formLogin.reset();
  formRegistro.reset();
  ocultarContrasenas();
  mostrarAuth(mensaje);
}

// Nombre a mostrar en el saludo (si no cargó nombre, usamos el email)
function nombreParaSaludo(usuario) {
  let nombre = String(usuario.nombre || '').trim();
  if (!nombre) nombre = String(usuario.email || '').split('@')[0] || 'usuario';
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

function abrirBienvenida(usuario, esRegistro) {
  const nombre = nombreParaSaludo(usuario);

  // Armamos el título con nodos para que el nombre vaya en negrita sin HTML crudo
  bienvenidaTitulo.textContent = esRegistro ? '¡Bienvenido, ' : '¡Hola de nuevo, ';
  const nombreResaltado = document.createElement('strong');
  nombreResaltado.textContent = nombre;
  bienvenidaTitulo.appendChild(nombreResaltado);
  bienvenidaTitulo.appendChild(document.createTextNode('!'));

  bienvenidaMensaje.textContent = esRegistro
    ? 'Tu cuenta ya está lista. Desde ahora podés registrar tus gastos e ingresos.'
    : 'Qué gusto verte otra vez. Todo sigue donde lo dejaste.';
  modalBienvenida.classList.remove('oculto');
  btnBienvenidaContinuar.focus();
}

btnBienvenidaContinuar.addEventListener('click', () => {
  modalBienvenida.classList.add('oculto');
  const usuario = sesionPendiente;
  sesionPendiente = null;
  if (usuario) {
    mostrarApp(usuario);
    cargarDatos();
  }
});

let sesionPendiente = null;

btnAlternarAuth.addEventListener('click', () => {
  mostrandoRegistro = !mostrandoRegistro;
  formLogin.classList.toggle('oculto', mostrandoRegistro);
  formRegistro.classList.toggle('oculto', !mostrandoRegistro);
  authTitulo.textContent = mostrandoRegistro ? 'Crear cuenta' : 'Iniciar sesión';
  btnAlternarAuth.textContent = mostrandoRegistro
    ? '¿Ya tenés cuenta? Iniciá sesión'
    : '¿No tenés cuenta? Registrate';
  authMensaje.textContent = '';
});

btnOlvide.addEventListener('click', mostrarOlvide);

document.querySelectorAll('[data-volver-login]').forEach(boton => {
  boton.addEventListener('click', () => {
    window.history.replaceState({}, '', '/');
    mostrarAuth();
  });
});

formRecuperar.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnRecuperar.disabled = true;
  mensajeRecuperar.textContent = 'Enviando…';
  mensajeRecuperar.classList.remove('ok');

  try {
    const datos = await apiJSON('/recuperar', {
      method: 'POST',
      body: JSON.stringify({ email: recuperarEmail.value.trim() })
    });
    mensajeRecuperar.textContent = datos.mensaje;
    mensajeRecuperar.classList.add('ok');
  } catch (error) {
    mensajeRecuperar.textContent = error.message;
  } finally {
    btnRecuperar.disabled = false;
  }
});

formRestablecer.addEventListener('submit', async (e) => {
  e.preventDefault();
  mensajeRestablecer.textContent = '';
  mensajeRestablecer.classList.remove('ok');

  if (restablecerPassword.value !== restablecerConfirmar.value) {
    mensajeRestablecer.textContent = 'Las contraseñas no coinciden';
    return;
  }
  if (restablecerPassword.value.length < 6) {
    mensajeRestablecer.textContent = 'La contraseña debe tener al menos 6 caracteres';
    return;
  }

  const token = new URLSearchParams(window.location.search).get('token') || '';
  btnRestablecer.disabled = true;
  try {
    const datos = await apiJSON('/restablecer', {
      method: 'POST',
      body: JSON.stringify({ token, password: restablecerPassword.value })
    });
    formRestablecer.classList.add('oculto');
    mensajeToken.textContent = '✅ Todo listo';
    mensajeRestablecer.textContent = datos.mensaje;
    mensajeRestablecer.classList.add('ok');
    localStorage.removeItem(CLAVE_TOKEN);
    setTimeout(() => { window.location.href = '/'; }, 2500);
  } catch (error) {
    mensajeRestablecer.textContent = error.message;
  } finally {
    btnRestablecer.disabled = false;
  }
});

async function verificarEnlaceRestablecer() {
  mostrarRestablecer();
  const token = new URLSearchParams(window.location.search).get('token') || '';

  if (!token) {
    mensajeToken.textContent = 'El enlace no es válido. Pedí uno nuevo desde el inicio de sesión.';
    return;
  }

  mensajeToken.textContent = 'Verificando el enlace…';
  try {
    const datos = await apiJSON(`/api/restablecer/validar?token=${encodeURIComponent(token)}`);
    if (datos.valido) {
      mensajeToken.textContent = 'Elegí una contraseña nueva para tu cuenta.';
      formRestablecer.classList.remove('oculto');
      restablecerPassword.focus();
    } else {
      mensajeToken.textContent = 'El enlace venció o ya se usó. Pedí uno nuevo desde el inicio de sesión.';
    }
  } catch (error) {
    mensajeToken.textContent = error.message;
  }
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnLogin.disabled = true;
  authMensaje.textContent = 'Ingresando…';

  try {
    const datos = await apiJSON('/login', {
      method: 'POST',
      body: JSON.stringify({
        email: loginEmail.value.trim(),
        password: loginPassword.value
      })
    });
    guardarToken(datos.token);
    loginPassword.value = '';
    await entrarApp(datos.usuario, { bienvenida: true, esRegistro: false });
  } catch (error) {
    authMensaje.textContent = error.message;
  } finally {
    btnLogin.disabled = false;
  }
});

formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (registroPassword.value !== registroConfirmar.value) {
    authMensaje.textContent = 'Las contraseñas no coinciden';
    return;
  }

  btnRegistro.disabled = true;
  authMensaje.textContent = 'Creando cuenta…';

  try {
    const datos = await apiJSON('/registro', {
      method: 'POST',
      body: JSON.stringify({
        nombre: registroNombre.value.trim(),
        email: registroEmail.value.trim(),
        password: registroPassword.value
      })
    });
    guardarToken(datos.token);
    registroPassword.value = '';
    registroConfirmar.value = '';
    await entrarApp(datos.usuario, { bienvenida: true, esRegistro: true });
  } catch (error) {
    authMensaje.textContent = error.message;
  } finally {
    btnRegistro.disabled = false;
  }
});

btnCerrarSesion.addEventListener('click', () => {
  cerrarSesion('Sesión cerrada. Ingresá para continuar.');
});

async function entrarApp(usuario, opciones = {}) {
  const { bienvenida = false, esRegistro = false } = opciones;

  if (bienvenida) {
    sesionPendiente = usuario;
    abrirBienvenida(usuario, esRegistro);
    return;
  }

  mostrarApp(usuario);
  await cargarDatos();
}

async function cargarDatos() {
  await Promise.all([cargarGastos(), cargarIngresos(), calcularBalance()]);
}

async function verificarSesion() {
  // Si llegamos desde el correo, mostramos la pantalla de nueva contraseña
  if (window.location.pathname === '/restablecer') {
    await verificarEnlaceRestablecer();
    return;
  }

  if (!obtenerToken()) {
    mostrarAuth();
    return;
  }

  authMensaje.textContent = 'Verificando sesión…';
  try {
    const usuario = await apiJSON('/api/me');
    await entrarApp(usuario);
  } catch (error) {
    // Si era una sesión vencida, apiJSON ya borró el token
    authMensaje.textContent = obtenerToken()
      ? `${error.message}. Probá recargar la página.`
      : '';
  }
}

// --- Elementos del DOM para Gastos ---

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
const btnPdfGastos = document.getElementById('btn-pdf-gastos');

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
const btnPdfIngresos = document.getElementById('btn-pdf-ingresos');
const mesBalance = document.getElementById('mes-balance');
const resultadoBalance = document.getElementById('resultado-balance');

// Elementos del DOM para cambiar contraseña
const formContrasena = document.getElementById('form-contrasena');
const btnCambiarContrasena = document.getElementById('btn-cambiar-contrasena');
const contraActual = document.getElementById('contra-actual');
const contraNueva = document.getElementById('contra-nueva');
const contraConfirmar = document.getElementById('contra-confirmar');
const mensajeContrasena = document.getElementById('mensaje-contrasena');

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
  Auto: 'Combustible',
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
  const monto = Number(document.getElementById('monto-gasto').value);

  if (!fecha || !categoria || !descripcion || isNaN(monto) || monto <= 0) {
    alert('Por favor complete todos los campos correctamente');
    return;
  }

  try {
    const data = await apiJSON('/gastos', {
      method: 'POST',
      body: JSON.stringify({ fecha, categoria, descripcion, monto })
    });
    alert(data.mensaje || 'Gasto guardado correctamente');
    formGasto.reset();
    descripcionGasto.value = '';
    categoriaGasto.selectedIndex = 0;
    document.getElementById('fecha-gasto').value = fechaLocalISO();
    cargarGastos();
    calcularBalance();
  } catch (error) {
    alert(error.message);
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

modoFecha.addEventListener('change', actualizarCampos);
modoMes.addEventListener('change', actualizarCampos);
fechaLista.addEventListener('change', cargarGastos);
mesLista.addEventListener('change', cargarGastos);

// Cargar lista de gastos según el modo elegido
async function cargarGastos() {
  if (!obtenerToken() || app.classList.contains('oculto')) return;

  const modo = modoSeleccionado();
  const valor = modo === 'mes' ? mesLista.value : fechaLista.value;

  if (!valor) {
    resultadoGastos.innerHTML = '<p>Elige una fecha o un mes para ver los gastos.</p>';
    return;
  }

  const consulta = modo === 'mes' ? `mes=${valor}` : `fecha=${valor}`;

  try {
    const data = await apiJSON(`/gastos?${consulta}`);
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
  } catch (error) {
    resultadoGastos.innerHTML = `<p>${error.message}</p>`;
  }
}

// Eliminar un gasto (con confirmación) y recargar todo
async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;

  try {
    const data = await apiJSON(`/gastos/${id}`, { method: 'DELETE' });
    alert(data.mensaje);
    cargarGastos();
    calcularBalance();
  } catch (error) {
    alert(error.message);
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

async function cargarIngresos() {
  if (!obtenerToken() || app.classList.contains('oculto')) return;

  const modo = modoIngresoSeleccionado();
  const valor = modo === 'mes' ? mesListaIngreso.value : fechaListaIngreso.value;

  if (!valor) {
    resultadoIngresos.innerHTML = '<p>Elige una fecha o un mes para ver los ingresos.</p>';
    return;
  }

  const consulta = modo === 'mes' ? `mes=${valor}` : `fecha=${valor}`;

  try {
    const data = await apiJSON(`/ingresos?${consulta}`);
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
  } catch (error) {
    resultadoIngresos.innerHTML = `<p>${error.message}</p>`;
  }
}

async function eliminarIngreso(id) {
  if (!confirm('¿Eliminar este ingreso?')) return;

  try {
    const data = await apiJSON(`/ingresos/${id}`, { method: 'DELETE' });
    alert(data.mensaje);
    cargarIngresos();
    calcularBalance();
  } catch (error) {
    alert(error.message);
  }
}

// En la APK (WebView de Capacitor) no funciona la descarga con <a download>:
// se usa el diálogo de impresión del sistema para guardar el PDF.
function esWebViewAndroid() {
  if (typeof window.Capacitor !== 'undefined') {
    if (typeof window.Capacitor.getPlatform === 'function') {
      return window.Capacitor.getPlatform() === 'android';
    }
    if (window.Capacitor.platform === 'android') return true;
  }
  // WebView de Android: "Version/4.0 Chrome" o "; wv" en el user agent
  return /Android/.test(navigator.userAgent) && /(Version\/4\.0 Chrome|; wv)/.test(navigator.userAgent);
}

// Si la APK se recompila con @capacitor/filesystem y @capacitor/share,
// los plugins aparecen acá y el botón guarda/comparte el PDF sin pasar por email.
function pluginsGuardadoDisponibles() {
  const plugins = window.Capacitor && window.Capacitor.Plugins;
  return !!(plugins && plugins.Filesystem && plugins.Share);
}

function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] || '');
    lector.onerror = () => reject(new Error('No se pudo leer el PDF'));
    lector.readAsDataURL(blob);
  });
}

async function guardarConPluginNativo(blob, nombreArchivo) {
  const plugins = window.Capacitor.Plugins;
  const datos = await blobABase64(blob);
  const archivo = await plugins.Filesystem.writeFile({
    path: nombreArchivo,
    data: datos,
    directory: 'DOCUMENTS'
  });
  await plugins.Share.share({ files: [archivo.uri], title: nombreArchivo });
}

// Descargar el PDF con el mismo modo y período que esté activo en la lista
async function descargarReporte(tipo) {
  const esGasto = tipo === 'gastos';
  const modo = esGasto ? modoSeleccionado() : modoIngresoSeleccionado();
  const valor = esGasto
    ? (modo === 'mes' ? mesLista.value : fechaLista.value)
    : (modo === 'mes' ? mesListaIngreso.value : fechaListaIngreso.value);

  if (!valor) {
    alert(modo === 'mes' ? 'Elegí un mes para generar el PDF.' : 'Elegí una fecha para generar el PDF.');
    return;
  }

  const boton = esGasto ? btnPdfGastos : btnPdfIngresos;
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = '⏳ Generando...';

  try {
    const consulta = `tipo=${tipo}&modo=${modo}&valor=${encodeURIComponent(valor)}`;

    if (esWebViewAndroid()) {
      const nombreArchivo = `reporte-${tipo}-${valor}.pdf`;

      if (pluginsGuardadoDisponibles()) {
        const blob = await apiBlob(`/reporte?${consulta}`);
        await guardarConPluginNativo(blob, nombreArchivo);
      } else {
        const data = await apiJSON(`/reporte/email?${consulta}`, { method: 'POST' });
        alert(`${data.mensaje}. Revisá tu correo: el PDF está adjunto y podés guardarlo en el celular.`);
      }
      return;
    }

    const blob = await apiBlob(`/reporte?${consulta}`);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `reporte-${tipo}-${valor}.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    alert(error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

btnPdfGastos.addEventListener('click', () => descargarReporte('gastos'));
btnPdfIngresos.addEventListener('click', () => descargarReporte('ingresos'));

// Manejar formulario de ingreso
formIngreso.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fecha = document.getElementById('fecha-ingreso').value;
  const descripcion = descripcionIngreso.value;
  const monto = Number(document.getElementById('monto-ingreso').value);

  if (!fecha || !descripcion || isNaN(monto) || monto <= 0) {
    alert('Por favor complete todos los campos correctamente');
    return;
  }

  try {
    const data = await apiJSON('/ingresos', {
      method: 'POST',
      body: JSON.stringify({ fecha, descripcion, monto })
    });
    alert(data.mensaje || 'Ingreso guardado correctamente');
    formIngreso.reset();
    document.getElementById('fecha-ingreso').value = fechaLocalISO();
    cargarIngresos();
    calcularBalance();
  } catch (error) {
    alert(error.message);
  }
});

// Cambiar la contraseña de la cuenta actual
formContrasena.addEventListener('submit', async (e) => {
  e.preventDefault();
  mensajeContrasena.textContent = '';
  mensajeContrasena.classList.remove('ok');

  if (contraNueva.value !== contraConfirmar.value) {
    mensajeContrasena.textContent = 'Las contraseñas nuevas no coinciden';
    return;
  }
  if (contraNueva.value.length < 6) {
    mensajeContrasena.textContent = 'La nueva contraseña debe tener al menos 6 caracteres';
    return;
  }

  btnCambiarContrasena.disabled = true;
  try {
    const data = await apiJSON('/cambiar-contrasena', {
      method: 'POST',
      body: JSON.stringify({
        contrasenaActual: contraActual.value,
        contrasenaNueva: contraNueva.value
      })
    });
    formContrasena.reset();
    ocultarContrasenas();
    mensajeContrasena.textContent = `${data.mensaje} Ya podés usarla para entrar.`;
    mensajeContrasena.classList.add('ok');
  } catch (error) {
    mensajeContrasena.textContent = error.message;
  } finally {
    btnCambiarContrasena.disabled = false;
  }
});

// Calcular balance
async function calcularBalance() {
  if (!obtenerToken() || app.classList.contains('oculto')) return;

  const mes = mesBalance.value;

  if (!mes) {
    resultadoBalance.innerHTML = '<p>Elige un mes para calcular el balance.</p>';
    return;
  }

  try {
    const data = await apiJSON(`/balance?mes=${mes}`);
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
  } catch (error) {
    resultadoBalance.innerHTML = `<p>${error.message}</p>`;
  }
}

mesBalance.addEventListener('change', calcularBalance);

// Registrar el service worker (solo funciona en HTTPS o localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err =>
      console.log('Service worker no disponible:', err)
    );
  });
}

// Al iniciar: fechas por defecto y verificación de sesión guardada
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

  if (esWebViewAndroid()) {
    const texto = pluginsGuardadoDisponibles() ? '💾 Guardar PDF' : '📧 Enviar PDF';
    btnPdfGastos.textContent = texto;
    btnPdfIngresos.textContent = texto;
  }

  verificarSesion();
});
