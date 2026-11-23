# Cuentas

App para registrar gastos e ingresos. Funciona en el celular y en cualquier dispositivo con internet.

**Tecnología:** Node.js + Express + PostgreSQL (plan gratis de Supabase). El mismo servidor sirve la API y la interfaz.

**Costo: $0** — Render Free + Supabase Free.

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

1. Copiá `.env.example` como `.env` y pegá tu cadena:
   ```bash
   cp .env.example .env
   # editá .env y reemplazá el valor de DATABASE_URL
   ```
2. Instalá dependencias y arrancá:
   ```bash
   npm install
   npm start
   ```
3. Abrí http://localhost:3000

> `.env` está en `.gitignore`: **nunca** se sube a GitHub.

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
4. Render detecta `render.yaml`. Cuando te pida `DATABASE_URL`, pegá **la misma cadena** del paso 1 → **Apply**.
5. En unos minutos te da la URL:
   ```
   https://cuentas-xxxx.onrender.com
   ```

Abrila desde el celular o desde una PC con Windows: no hay que instalar nada, solo un navegador.

Cada `git push` actualiza la app automáticamente.

---

## 4. APK para el celular (opcional)

La PWA ya está preparada (`manifest.webmanifest`, `sw.js`, iconos). Con Capacitor se genera el APK:

```bash
npm install
npx cap add android
# editar capacitor.config.json con la URL de Render y cleartext: false
npx cap sync
cd android && ./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Requiere JDK 21 y Android SDK instalados.

---

## Limitaciones del plan gratuito

- **Render Free** se duerme tras 15 minutos sin visitas; la primera carga después de eso tarda ~1 minuto.
- **Supabase Free** pausa el proyecto tras 7 días con poca actividad. Unos pocos registros por semana lo evitan. Si se pausa, se reactiva desde el dashboard y los datos se conservan.
- Supabase Free **no incluye backups automáticos**. Si los datos te importan, exportalos de vez en cuando desde el dashboard.

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Interfaz web |
| `POST` | `/gastos` | Registrar gasto |
| `GET` | `/gastos?fecha=YYYY-MM-DD` | Gastos de un día |
| `GET` | `/gastos?mes=YYYY-MM` | Gastos de un mes |
| `DELETE` | `/gastos/:id` | Eliminar gasto |
| `POST` | `/ingresos` | Registrar ingreso |
| `GET` | `/ingresos?fecha=YYYY-MM-DD` | Ingresos de un día |
| `GET` | `/ingresos?mes=YYYY-MM` | Ingresos de un mes |
| `DELETE` | `/ingresos/:id` | Eliminar ingreso |
| `GET` | `/balance?mes=YYYY-MM` | Ingresos, gastos y balance del mes |
