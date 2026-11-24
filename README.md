# Cuentas

App para registrar gastos e ingresos. Funciona en el celular y en cualquier dispositivo con internet.

**Tecnología:** Node.js + Express + PostgreSQL (plan gratis de Supabase). El mismo servidor sirve la API y la interfaz.

**Costo: $0** — Render Free + Supabase Free.

**Multiusuario:** cada persona se registra con email y contraseña y ve **solo sus propios datos**. Todos comparten el mismo deploy y la misma APK; la separación se hace con `usuario_id` en cada tabla.

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

1. Copiá `.env.example` como `.env` y completá las dos variables:
   ```bash
   cp .env.example .env
   # DATABASE_URL= cadena de Supabase
   # JWT_SECRET= clave aleatoria (openssl rand -hex 32)
   # EMAIL_USER= tu Gmail
   # EMAIL_APP_PASSWORD= contraseña de aplicación de Gmail (16 caracteres, sin espacios)
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
   - `EMAIL_USER`: tu Gmail (ej. `laresoftuy@gmail.com`).
   - `EMAIL_APP_PASSWORD`: contraseña de aplicación de Gmail (16 caracteres sin espacios).
   - `APP_URL`: la URL pública de Render (ej. `https://cuentas-xxxx.onrender.com`).
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
5. Para cambiar la contraseña, abrí **Cambiar Contraseña** (al final de la pantalla), ingresá la actual y la nueva dos veces. Los botones **👁️ Ver / 🙈 Ocultar** sirven para revisar lo escrito.

La sesión queda guardada en el dispositivo 30 días. Si otra persona usa el mismo celular, debe cerrar sesión e iniciar con su cuenta.

### ¿Olvidaste la contraseña?

1. En el login, clic en **¿Olvidaste tu contraseña?** y escribí el email de la cuenta.
2. Llega un correo con un enlace válido **30 minutos** y de **un solo uso** (revisá Spam).
3. Al abrirlo se muestra la pantalla para escribir la nueva contraseña dos veces.
4. Después volvés al login e ingresás con la contraseña nueva.

Si el correo no aparece, podés volver a pedirlo. Por seguridad la respuesta es siempre la misma, sin importar si el email existe. Para crear la contraseña de aplicación de Gmail: activá 2 pasos en https://myaccount.google.com/security y generá una en https://myaccount.google.com/apppasswords.

> Los registros que existían antes de activar los usuarios se asignan automáticamente a la **primera cuenta que se cree**.

---

## 5. APK para el celular (opcional)

La PWA ya está preparada (`manifest.webmanifest`, `sw.js`, iconos). Con Capacitor se genera el APK:

```bash
npm install
npx cap add android
# editar capacitor.config.json con la URL de Render y cleartext: false
npx cap sync
cd android && ./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Requiere JDK 21 y Android SDK instalados.

> Como la APK solo muestra la página de Render, **no hay que recompilarla** al cambiar la interfaz o agregar usuarios. El service worker se actualiza solo (cache `cuentas-v2`).

---

## Limitaciones del plan gratuito

- **Render Free** se duerme tras 15 minutos sin visitas; la primera carga después de eso tarda ~1 minuto.
- **Supabase Free** pausa el proyecto tras 7 días con poca actividad. Unos pocos registros por semana lo evitan. Si se pausa, se reactiva desde el dashboard y los datos se conservan.
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
