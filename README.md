# Cuentas

App para registrar gastos e ingresos. Funciona en el celular y en cualquier dispositivo con internet.

**Tecnología:** Node.js + Express + PostgreSQL (plan gratis de Supabase). El mismo servidor sirve la API y la interfaz.

**Costo: $0** — Render Free + Supabase Free.

**Multiusuario:** cada persona se registra con email y contraseña y ve **solo sus propios datos**. Todos comparten el mismo deploy y la misma APK; la separación se hace con `usuario_id` en cada tabla. Opcionalmente se puede ingresar con huella (passkeys), sin guardar la huella en el servidor.

---

## 1. Crear la base de datos en Supabase (gratis)

1. Entrá a https://supabase.com y creá cuenta (**Continue with GitHub** es lo más rápido).
2. **New project**:
   - Name: `cuentas`
   - Database Password: generala y guardala
   - Region: la más cercana a ti
   - Plan: **Free**
3. Cuando el proyecto esté listo, arriba a la derecha clic en **Connect** (o en **⚙️ Project Settings → Database → Connection string**).
4. Elegí **Session pooler** y copiá la URI. Reemplazá `[YOUR-PASSWORD]` por tu contraseña de base de datos y asegurate de que termine con `?sslmode=require`.

> La cadena se parece a:
> ```
> postgresql://postgres.TU_REF:TU_CLAVE@aws-0-TU_REGION.pooler.supabase.com:5432/postgres?sslmode=require
> ```
> Si la clave tiene caracteres especiales (`@ # & ?` / espacios), codificalos (por ejemplo `@` → `%40`).

---

## 2. Configurar y probar en local

1. Copiá `.env.example` como `.env` y completá las variables:
   ```bash
   cp .env.example .env
   # DATABASE_URL= cadena de Supabase
   # JWT_SECRET= clave aleatoria (openssl rand -hex 32)
   # BREVO_API_KEY= key de API de Brevo (xkeysib-...)
   # EMAIL_USER= remitente verificado en Brevo (o tu Gmail si probás SMTP en local)
   # EMAIL_APP_PASSWORD= contraseña de aplicación de Gmail (solo para prueba local)
   # APP_URL= http://localhost:3000
   ```
2. Instalá dependencias y arrancá:
   ```bash
   npm install
   npm start
   ```
3. Abrí http://localhost:3000, creá una cuenta y registrá gastos/ingresos.

> `.env` está en `.gitignore`: **nunca** se sube a GitHub. La clave `JWT_SECRET` debe ser la misma en local y en Render.

---

## 3. Desplegar en Render (gratis)

1. Creá un repositorio en GitHub (puede ser privado).
2. Subí el código:
   ```bash
   git init
   git add .
   git commit -m "Cuentas con Supabase"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
   Verificá antes que `.env` no aparezca en `git status`.
3. En https://dashboard.render.com → **New → Blueprint** → conectá GitHub → elegí el repo.
4. Render detecta `render.yaml`. Cuando te pida las variables, pegá:
   - `DATABASE_URL`: la misma cadena del paso 1.
   - `JWT_SECRET`: la misma clave aleatoria del paso 2.
   - `BREVO_API_KEY`: key de **API** de Brevo (empieza con `xkeysib-`). Render Free bloquea los puertos SMTP, así que en producción se envía por HTTPS con Brevo (plan gratis, 300 correos/día).
   - `EMAIL_USER`: el remitente verificado en Brevo (ej. `laresoftuy@gmail.com`). Si es un dominio gratuito, Brevo puede mostrarlo como `...@brevosend.com`.
   - `APP_URL`: la URL pública de Render (ej. `https://cuentas-xxxx.onrender.com`), **sin barra final**. Debe coincidir exactamente con el origen que usa el navegador; si no, las passkeys no funcionan.
   - `EMAIL_APP_PASSWORD`: opcional, solo para probar SMTP de Gmail en local (en Render no se usa porque el puerto está bloqueado).
5. En unos minutos te da la URL:
   ```
   https://cuentas-xxxx.onrender.com
   ```

Cada `git push` actualiza la app automáticamente. Si cambiás `JWT_SECRET`, las sesiones existentes quedan inválidas y hay que volver a iniciar sesión.

---

## 4. Cómo usarla con varias personas

1. Abrí la URL (o la APK) y clic en **¿No tenés cuenta? Registrate**.
2. Ingresá email y contraseña (mínimo 6 caracteres) → **Crear cuenta**.
3. Cada persona ve su propio balance, gastos e ingresos.
4. **Cerrar sesión** está arriba a la derecha, al lado del nombre.
5. Para cambiar la contraseña, abrí **Perfil** (en el encabezado), ingresá la actual y la nueva dos veces. Los botones **👁️ Ver / 🙈 Ocultar** sirven para revisar lo escrito.

La sesión queda guardada en el dispositivo 30 días. Si otra persona usa el mismo celular, debe cerrar sesión e iniciar con su cuenta.

### Vista de inicio

Después de entrar (y de cerrar el modal de bienvenida) aparece una vista de inicio con la descripción de la aplicación y tres accesos: **Gastos**, **Ingresos** y **Balance**. Cada acceso abre solo esa parte; el botón **← Volver al inicio** vuelve al menú. El encabezado sigue fijo arriba.

### Modo claro y oscuro

La app sigue automáticamente el modo del celular: si activás el modo oscuro desde Ajustes, la interfaz cambia sola y vuelve al claro al desactivarlo. No hay botón: usa la preferencia del sistema (`prefers-color-scheme`), y también cambia el color de la barra del navegador o la PWA. El cuadro del sistema de la huella lo pintan Android/iOS, no la app.

### Ingresar con huella

En Android (APK), iPhone (PWA agregada desde Safari) y navegadores con WebAuthn aparece **👆 Ingresar con huella** en el login. Para activarlo:

1. Entrá con tu contraseña y abrí **Perfil** → **👆 Registrar huella**.
2. Confirmá con la huella o el PIN del dispositivo.
3. Desde entonces podés ingresar con **👆 Ingresar con huella**. En **Perfil** ves el estado **Registrado** y el botón **Quitar** para cada huella.

En Android la interfaz habla solo de **Huella**: el cuadro del sistema puede pedir huella o PIN según el dispositivo.

Cuando este dispositivo ya tiene una huella registrada, al **abrir la app** se pide la huella automáticamente, sin tocar ningún botón. Si no se reconoce en **3 intentos**, el botón de huella desaparece y la app te lleva a **usuario y contraseña**. El contador se reinicia cuando entrás con tu contraseña o después de 15 minutos. Hasta entonces, el ingreso con huella queda desactivado. Al entrar con huella, automática o manual, se muestra el modal de bienvenida, igual que con contraseña.

El servidor guarda solo una **clave pública**: la huella nunca sale del teléfono. Al registrar la primera huella se borra la contraseña guardada en ese dispositivo y se desmarca **Recordar contraseña**; la contraseña escrita a mano sigue funcionando como respaldo, al igual que la recuperación por email.

> En la **APK compilada con el workflow de abajo** los botones también aparecen: el WebView tiene WebAuthn habilitado y la app está asociada al dominio mediante `/.well-known/assetlinks.json`. WebAuthn exige HTTPS (o `localhost`) y que `APP_URL` sea exactamente el origen de la app. Una APK vieja (sin recompilar) seguirá usando solo contraseña.

### ¿Olvidaste la contraseña?

1. En el login, clic en **¿Olvidaste tu contraseña?** y escribí el email de la cuenta.
2. Llega un correo con un enlace válido **30 minutos** y de **un solo uso** (revisá Spam).
3. Al abrirlo se muestra la pantalla para escribir la nueva contraseña dos veces.
4. Después volvés al login e ingresás con la contraseña nueva.

Si el correo no aparece, podés volver a pedirlo (y revisar Spam). Por seguridad la respuesta es siempre la misma, sin importar si el email existe.

Para configurar el envío: en Brevo (https://www.brevo.com/, plan Free) ir a **Settings → Senders, Domains, IPs → Senders → Add a sender** y verificar la dirección con el código de 6 dígitos. Después en **Settings → SMTP & API → API Keys & MCP → Generate API key**, copiar la key `xkeysib-...` y cargarla como `BREVO_API_KEY`. No usar la key SMTP (`xsmtpsib-...`). Las cuentas nuevas de Brevo pueden tardar unas horas en habilitarse para enviar.

> Los registros que existían antes de activar los usuarios se asignan automáticamente a la **primera cuenta que se cree**.

---

## 5. APK para el celular (opcional)

La PWA ya está preparada (`manifest.webmanifest`, `sw.js`, iconos). La forma recomendada de generar la APK es con **GitHub Actions**, sin instalar Android Studio:

1. En GitHub → pestaña **Actions** → **Compilar APK de Cuentas** → **Run workflow** → **main**.
2. Al terminar, descargar el artefacto **`cuentas-apk`** y descomprimirlo.
3. Instalar `app-release.apk` en el celular (habilitar “instalar apps desconocidas”).

El workflow regenera el proyecto Android, aplica el parche de WebAuthn desde `scripts/parchear-android.js`, firma con un keystore guardado como secrets y deja el APK firmado. No hace falta JDK ni SDK en tu PC.

> Como la APK solo muestra la página de Render, **no hay que recompilarla** al cambiar la interfaz o agregar usuarios. El service worker se actualiza solo (cache actual: `cuentas-v31`, definido en `sw.js`). Solo volvé a compilar si cambia `capacitor.config.json`, el parche nativo o las dependencias.

### Huella y WebAuthn en la APK

El servidor publica la asociación en `https://cuentas-k956.onrender.com/.well-known/assetlinks.json` con las relaciones `common.handle_all_urls` y `common.get_login_creds`, y la huella SHA-256 del certificado con que se firma la APK (`com.cuentas.app`). Ese valor es público; la clave privada del keystore vive solo en los Secrets de GitHub (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). Si se regenera el keystore, hay que actualizar `HUELLA_APK` en `server.js` y volver a compilar.

La app también declara la asociación inversa: el parche agrega `asset_statements` a `strings.xml` y su `meta-data` al `AndroidManifest.xml`, apuntando al mismo `assetlinks.json` (tomado de `capacitor.config.json`). Sin ese paso Credential Manager rechaza el RP ID aunque el archivo del servidor esté bien.

El parche nativo activa WebAuthn, verifica `getWebAuthenticationSupport()` y recarga la WebView para que `PublicKeyCredential` exista antes de que corra el `script.js`. El dispositivo necesita **Android System WebView 131 o superior** (actualizable desde Play Store), Google Play Services actualizado y una pantalla de bloqueo configurada. Si el WebView es viejo, en **Perfil** aparece *“Huella no disponible en este dispositivo…”* en vez de los botones; abriendo la web en Chrome con `?diag=1` se ven los motivos exactos. La contraseña sigue funcionando igual.

En **Perfil**, la lista de huellas no muestra texto: solo el botón **Quitar** para cada una. Cuando hay al menos una huella registrada, el botón **👆 Registrar huella** pasa a decir **Registrado** y queda desactivado; si se quitan todas, vuelve a **👆 Registrar huella** y se activa. El servidor sigue guardando internamente el dispositivo, pero la interfaz no lo exhibe.

> El keystore de esta APK es nuevo: **desinstalá la APK anterior antes de instalar esta**. Android no permite actualizar una app firmada con otro certificado. Las huellas registradas con la firma anterior deben registrarse de nuevo.

### Reportes PDF en la APK
El WebView de Android no permite descargas con `<a download>` ni `window.print()`. Por eso, dentro de la APK el botón dice **📧 Enviar PDF** y manda el archivo adjunto al correo de la cuenta (Brevo). En Safari/Chrome el botón descarga el PDF directamente.

Para guardar el PDF desde la propia app (sin correo), sí hace falta recompilar la APK agregando los plugins:

```bash
npm install @capacitor/filesystem @capacitor/share
npx cap sync android
cd android && ./gradlew assembleDebug
```

El `script.js` detecta `Capacitor.Plugins.Filesystem` y `Capacitor.Plugins.Share`: si están presentes, el botón cambia a **💾 Guardar PDF** y usa esos plugins automáticamente.

---

## Limitaciones del plan gratuito

- **Requisitos de passkeys:** Node 22 en el servidor, HTTPS (o `localhost`), `APP_URL` igual al origen real y `assetlinks.json` accesible sin redirecciones. Si cambiara el dominio de Render o el certificado de la APK, habría que registrar las huellas de nuevo.
- **Render Free** se duerme tras 15 minutos sin visitas; la primera carga después de eso tarda ~1 minuto.
- **Supabase Free** pausa el proyecto tras 7 días con poca actividad. `GET /api/heartbeat` mantiene una escritura mínima (configuralo en cron-job.org cada 12 h con alerta por email). Si igual se pausa, se reactiva desde el dashboard y los datos se conservan.
- Supabase Free **no incluye backups automáticos**. Si los datos te importan, exportalos de vez en cuando desde el dashboard.

---

## Endpoints

Las rutas marcadas con 🔒 requieren la cabecera `Authorization: Bearer <token>`, que se obtiene al registrar o iniciar sesión.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Interfaz web (pantalla de acceso si no hay sesión) |
| `POST` | `/registro` | Crear cuenta (email, password, nombre opcional) → devuelve token |
| `POST` | `/login` | Iniciar sesión → devuelve token |
| `GET` | `/api/me` | 🔒 Datos del usuario actual |
| `POST` | `/api/passkey/registro/opciones` | 🔒 Iniciar registro de huella (devuelve opciones WebAuthn) |
| `POST` | `/api/passkey/registro/verificar` | 🔒 Verificar y guardar la clave pública de la huella |
| `GET` | `/api/passkey` | 🔒 Listar huellas de la cuenta |
| `DELETE` | `/api/passkey/:id` | 🔒 Quitar una huella de la cuenta |
| `POST` | `/api/passkey/autenticar/opciones` | Iniciar ingreso con huella (sin contraseña) |
| `POST` | `/api/passkey/autenticar/verificar` | Verificar la huella → devuelve token |
| `POST` | `/cambiar-contrasena` | 🔒 Cambiar contraseña (contraseña actual + nueva) |
| `POST` | `/recuperar` | Pedir enlace de recuperación por email |
| `GET` | `/restablecer?token=...` | Pantalla de nueva contraseña |
| `GET` | `/api/restablecer/validar?token=...` | Validar enlace de recuperación |
| `POST` | `/restablecer` | Guardar la nueva contraseña con el token del email |
| `POST` | `/gastos` | 🔒 Registrar gasto |
| `GET` | `/gastos?fecha=YYYY-MM-DD` | 🔒 Gastos del usuario en un día |
| `GET` | `/gastos?mes=YYYY-MM` | 🔒 Gastos del usuario en un mes |
| `DELETE` | `/gastos/:id` | 🔒 Eliminar gasto propio |
| `POST` | `/ingresos` | 🔒 Registrar ingreso |
| `GET` | `/ingresos?fecha=YYYY-MM-DD` | 🔒 Ingresos del usuario en un día |
| `GET` | `/ingresos?mes=YYYY-MM` | 🔒 Ingresos del usuario en un mes |
| `DELETE` | `/ingresos/:id` | 🔒 Eliminar ingreso propio |
| `GET` | `/balance?mes=YYYY-MM` | 🔒 Ingresos, gastos y balance del mes del usuario |
| `GET` | `/api/heartbeat` | Latido antipausa de Supabase Free (actualiza una fila, sin datos personales) |
| `GET` | `/.well-known/assetlinks.json` | Asociación del dominio con la APK (passkeys en WebView) |
