# AGENTS.md

Proyecto **Cuentas** (raíz del repo): API Node/Express + frontend vanilla servido por el mismo servidor. No hay build, bundler ni tests automáticos.

## Comandos y verificación
- `npm install`; `npm start` → `node server.js` (puerto `PORT` o 3000).
- `package.json` solo tiene `start`: **no** existe `npm test`, lint ni typecheck. Verificá con `node --check <archivo>` y probando endpoints con la app levantada.
- En este entorno `node` no está en PATH; usá `/mnt/c/Program Files/nodejs/node.exe` para los `--check`.

## Memoria
- Al empezar, lee `MEMORY.md` para conocer el estado del proyecto y las decisiones tomadas.
- Al terminar una tarea, actualízalo: estado actual, decisiones importantes (con su porqué) y errores a evitar.
- Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte.
- Si algo se convierte en una regla permanente, propón moverlo a `AGENTS.md` en lugar de dejarlo en la memoria.
- No guardes nunca datos sensibles (claves, tokens, datos personales). 

## Configuración
- Copiar `.env.example` a `.env`. `DATABASE_URL` y `JWT_SECRET` son obligatorios: el servidor llama a `process.exit(1)` si faltan. `.env` está en `.gitignore`, nunca commitearlo.
- Opcionales para recuperación: `BREVO_API_KEY`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `APP_URL`. En Render se usa la API HTTPS de Brevo (SMTP bloqueado); Gmail SMTP es solo fallback local.
- `JWT_SECRET` debe coincidir entre local y Render; cambiarlo invalida todas las sesiones.

## Base de datos (Supabase)
- El esquema **no está completo en el repo**: `gastos` e `ingresos` ya existen en Supabase. `inicializarDB()` crea `usuarios`/`recuperaciones`, agrega `usuario_id` con FK, índices y migra `monto` a `NUMERIC(12,2)` si son enteros.
- No eliminar esa migración: es la forma en que producción recibe cambios de esquema sin acceso al dashboard. Es idempotente y corre en cada arranque.
- `pg.types.setTypeParser(1700, Number)` convierte NUMERIC a número; sin esto `toFixed`/sumas del frontend fallan.
- Toda consulta de datos debe filtrar por `usuario_id = req.usuario.id` (también DELETE y `/balance`). El aislamiento multiusuario depende de eso.

## Frontend / PWA
- `index.html`, `script.js` y `style.css` se sirven tal cual: se editan directo, sin transpilación. Textos y comentarios en español.
- `sw.js` hace caché cache-first de archivos estáticos. Al cambiar `index.html`/`script.js`/`style.css`/iconos, subir `NOMBRE_CACHE` (hoy `cuentas-v13`) o los usuarios ven UI vieja. Las rutas de API están excluidas a propósito.
- Ojo: el README menciona cache `cuentas-v2`; la fuente real es `sw.js` (`cuentas-v13`).
- `capacitor.config.json` apunta a la URL de Render: la APK de Android y la PWA del iPhone no requieren recompilar al cambiar la web. En iPhone se agrega con Safari → Compartir → Agregar a pantalla de inicio; las etiquetas `apple-touch-icon`/`apple-mobile-web-app-*` son intencionales.
- El WebView de la APK no descarga `<a download>` con blob, no expone `navigator.share` **y ignora `window.print()`**: en la APK los reportes se envían por correo (`POST /reporte/email`, adjunto vía Brevo) al email del token. En navegadores se descarga el PDF de `GET /reporte`. Si algún día se recompila con `@capacitor/filesystem` + `@capacitor/share`, `pluginsGuardadoDisponibles()` los detecta y guarda/comparte el PDF sin correo.

## Auth y validaciones
- Tokens propios: `base64url(payload).base64url(HMAC-SHA256)`, 30 días. Contraseñas con `scrypt` + sal y `timingSafeEqual`. No hay dependencias `jsonwebtoken`/`bcrypt`.
- Recuperación: token de un solo uso guardado como SHA-256 en `recuperaciones`, expira en 30 min; rate limit en memoria (3 por 10 min). La respuesta es genérica a propósito para no revelar emails.
- `validarFecha()` rechaza fechas futuras y del mes anterior, usa hora local (nunca UTC).
- Montos: > 0 y hasta 2 decimales; inputs con `min="0.01"` y `step="0.01"`.

## Deploy y Git
- Push a `main` en `https://github.com/laresoft/Api.git` dispara el Blueprint de Render (`render.yaml`, Node 22, plan free). Verificar con la URL pública; no hay credenciales de Render en este entorno.
- GitHub no acepta contraseña para Git: el push necesita un PAT (`ghp_...`) como password; usuario `laresoft`. No hay credenciales guardadas acá.
- No hay identidad global de Git: commitear con `git -C /home/lester/Project/Api -c user.name='Lare' -c user.email='laresoftuy@gmail.com' commit -m "..."`.
- `.gitignore` excluye `.env`, `android/`, `www/` y `*.apk`; no esperarlos en el repo.

## Archivos sensibles
- `server.js` tiene middleware que devuelve 404 para `/.env`, `/.git`, `/android/`, `.apk`, `/server.js`, `/package.json`, etc. Mantenerlo al agregar rutas estáticas.

## Límites
- ✅ Siempre: respetar las reglas de fechas, mantener los textos en español.
- ✅ Siempre: actualizar `MEMORY.md` al terminar cada tarea.
- ⚠️ Pregunta antes: crear archivos nuevos, cambiar el formato de los datos guardados.
- 🚫 Nunca: añadir un paso de build. 