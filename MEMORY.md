# MEMORY.md — Cuentas
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resumí o eliminá lo que ya no aporte.

## Estado actual
- App publicada en Render (`https://cuentas-k956.onrender.com`) con PostgreSQL en Supabase.
- Funciona en Android (APK Capacitor) y en iPhone como PWA agregada desde Safari.
- Montos de gastos e ingresos aceptan hasta 2 decimales; balance y listados los muestran con `toFixed(2)`.
- Reportes PDF de gastos e ingresos, por día o por mes, con detalle + total y balance en modo mes. Los meses incluyen un comentario económico breve (flujo, margen/déficit y categoría de mayor peso). Descarga directa en navegadores; en la APK se envían por correo al usuario.
- `AGENTS.md` y `MEMORY.md` están en la raíz del repo y ya fueron pusheados.

## Decisiones (y por qué)
- Cualquiera debe poder abrirlo con doble clic e instalarlo.
- Fecha editable en el formulario: permite registrar días pasados pero no días posteriores al actual.
- Los cambios de esquema de la BD se aplican en `inicializarDB()` al arrancar: no hay acceso al dashboard de Supabase.
- iPhone usa PWA (Agregar a pantalla de inicio) en vez de IPA: no requiere Mac ni cuenta de Apple Developer.
- El service worker solo cachea archivos de interfaz; cada cambio visual exige subir `NOMBRE_CACHE` en `sw.js` (hoy `cuentas-v11`).
- Los PDF se generan en el servidor con `pdfkit` (Helvetica, sin emojis ni fuentes externas); `generarPDFReporte()` devuelve un Buffer reusable para descarga o correo.
- En la APK (WebView) no funcionan `<a download>` con blob, `navigator.share` ni `window.print()`: se envía el PDF por correo con `POST /reporte/email`. Para guardarlo dentro de la app hace falta recompilar con `@capacitor/filesystem` y `@capacitor/share`; el frontend ya detecta esos plugins.

## Aprendizajes y errores a evitar
- GitHub no acepta contraseña para Git: el push necesita un PAT (`ghp_...`) con usuario `laresoft`.
- No hay identidad global de Git: usar `-c user.name='Lare' -c user.email='laresoftuy@gmail.com'` al commitear.
- `node` no está en PATH en este entorno: usar `/mnt/c/Program Files/nodejs/node.exe` para `node --check`.
- `pg` devuelve NUMERIC como string: sin `pg.types.setTypeParser(1700, Number)` rompen `toFixed` y los `reduce`.
- En `generarPDFReporte`, `total` es la suma del tipo de reporte y `otroTotal` la de la tabla contraria: invertirlos deja ingresos/gastos y balance al revés.
- No asumir `npm test`/lint: `package.json` solo tiene `start`.

## Próximos pasos
- Confirmar en producción que un monto `12.50` se guarda y suma con decimales (no se pudo probar contra la BD desde este entorno).
- Si se recupera el acceso a Supabase, verificar que `gastos.monto` e `ingresos.monto` sean `NUMERIC(12,2)`.
