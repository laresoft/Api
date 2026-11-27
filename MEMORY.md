# MEMORY.md — Cuentas
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resumí o eliminá lo que ya no aporte.

## Estado actual
- App publicada en Render (`https://cuentas-k956.onrender.com`) con PostgreSQL en Supabase.
- Funciona en Android (APK Capacitor) y en iPhone como PWA agregada desde Safari.
- Montos de gastos e ingresos aceptan hasta 2 decimales; balance y listados los muestran con `toFixed(2)`.
- Categoría `Auto` disponible en Gastos Semifijos, con descripción sugerida `Combustible`.
- Reportes PDF de gastos e ingresos, por día o por mes, con detalle + total y balance en modo mes. Los meses incluyen un comentario económico breve (flujo, margen/déficit y categoría de mayor peso). Descarga directa en navegadores; en la APK se envían por correo al usuario.
- `AGENTS.md` y `MEMORY.md` están en la raíz del repo y ya fueron pusheados.
- Heartbeat antipausa de Supabase Free: `GET /api/heartbeat` actualiza la fila única `app_actividad`. El usuario configura cron-job.org cada 12 h con alerta por email; no se generan gastos/ingresos falsos.
- Passkeys implementadas en web/iPhone (Fase 1) y preparadas para APK (Fase 2): WebAuthn se habilita en el WebView mediante `scripts/parchear-android.js` y se compila con GitHub Actions.

## Decisiones (y por qué)
- Cualquiera debe poder abrirlo con doble clic e instalarlo.
- Fecha editable en el formulario: permite registrar días pasados pero no días posteriores al actual.
- Los cambios de esquema de la BD se aplican en `inicializarDB()` al arrancar: no hay acceso al dashboard de Supabase.
- iPhone usa PWA (Agregar a pantalla de inicio) en vez de IPA: no requiere Mac ni cuenta de Apple Developer.
- El service worker solo cachea archivos de interfaz; cada cambio visual exige subir `NOMBRE_CACHE` en `sw.js` (hoy `cuentas-v20`).
- "Cambiar Contraseña" ya no es una sección de `<main>`: vive en el modal `#modal-perfil`, abierto desde el botón `Perfil` del header (entre el email y `Cerrar sesión`). Título `Perfil`, nombre del usuario en grande (`usuario.nombre`, fallback al email) y correo como texto no editable con etiqueta `Correo:`. Se cierra con botón, clic fuera o `Esc`.
- `#barra-usuario` tiene fondo claro redondeado dentro del header azul: nombre + `Perfil` + `Cerrar sesión` comparten esa banda. El header sigue siendo `sticky`.
- Al cambiar la contraseña desde Perfil se actualiza la copia guardada en el dispositivo si "Recordar contraseña" está activa; si está desmarcada, se borra. `POST /cambiar-contrasena` no cambió.
- El encabezado es `position: sticky` con `z-index: 100`; el modal de bienvenida usa 1000 para quedar por encima.
- El login precarga el último email y, con la casilla "Recordar contraseña" activada por defecto, también la contraseña desde `localStorage`. Al desmarcarla se borra la contraseña guardada. Es un riesgo asumido a pedido del usuario: en un dispositivo compartido cualquiera podría verla.
- Si se cambia la contraseña por el flujo de recuperación, se borra la copia guardada para no completar una contraseña vencida.
- Los PDF se generan en el servidor con `pdfkit` (Helvetica, sin emojis ni fuentes externas); `generarPDFReporte()` devuelve un Buffer reusable para descarga o correo.
- Passkeys: la huella nunca se guarda; solo clave pública + contador. Al registrar la primera huella se borra la contraseña de `localStorage` y se desmarca “Recordar contraseña” (decisión del usuario). La contraseña manual y el email siguen como respaldo.
- WebAuthn depende de `APP_URL` = origen exacto sin barra final; si cambia el dominio hay que volver a registrar huellas. Requiere Node 22 (ya configurado en `render.yaml`).
- Fase 2: huella del certificado `8F:DA:...:31` (pública) hardcodeada en `server.js` como `HUELLA_APK`; se publica en `/.well-known/assetlinks.json` y se acepta como origin `android:apk-key-hash:j9pvo1UJKllPrdAiSfq1aCcrFVuSBfz-3ns3t9aSkTE`. La clave privada está en Secrets de GitHub; si se regenera, cambiar también el origin esperado.
- Android WebView oculta `PublicKeyCredential` hasta habilitar WebAuthn; por eso el frontend ya no fuerza ocultar botones por plataforma, solo comprueba capacidades del navegador.
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
- Confirmar que cron-job.org recibe `200` de `/api/heartbeat` y que Supabase no vuelve a pausarse.
- Probar en iPhone PWA: registrar huella desde Perfil, cerrar sesión e ingresar con **👆 Ingresar con huella**. Si `APP_URL` no coincide con el origen real, WebAuthn falla con error de rpId/origin.
- Ejecutar el workflow **Compilar APK de Cuentas** en GitHub Actions, descargar `cuentas-apk`, instalar la APK y probar registrar/usar huella en Android. Si falla con `DOMAIN_NOT_ASSOCIATED`, revisar `assetlinks.json` y esperar propagación de Google.
