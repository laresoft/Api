# Cuentas

App para registrar gastos e ingresos. Funciona en el celular y en cualquier dispositivo con internet.

**Tecnología:** Node.js + Express + SQLite. El mismo servidor sirve la API y la interfaz.

---

## Desplegar en la nube (accesible desde cualquier lugar)

### Antes de empezar

Necesitas:
- Una cuenta de **GitHub** (gratis): https://github.com
- Una cuenta de **Render** (gratis): https://render.com
- El proyecto ya está preparado con `render.yaml`, `.gitignore` y `package.json`

> **Importante sobre los datos:** Render tiene un plan Free, pero su sistema de archivos es temporal: la base de datos SQLite se borraría cada vez que el servicio se reinicia (y el plan Free se apaga solo después de 15 minutos de inactividad). Para que los gastos no se pierdan, el blueprint usa el plan **Starter** (~USD 7/mes) con un **disco persistente** de 1 GB (~USD 0,25/mes). No se suben tus datos actuales: la base en la nube empieza vacía.

### Paso 1 — Subir el código a GitHub

1. Crea un repositorio nuevo en GitHub (puede ser privado).
2. En tu computadora, abre una terminal en la carpeta del proyecto y ejecuta:

```bash
cd /home/lester/Project/Api

git init
git add .
git commit -m "Primera versión de Cuentas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Si estás en **Windows**, abre PowerShell en la carpeta del proyecto y usa los mismos comandos (el `cd` cambia, por ejemplo `cd C:\Users\TuNombre\Project\Api`).

> Verifica que `gastos.db` y `node_modules/` **no** se suban: ya están excluidos en `.gitignore`.

### Paso 2 — Crear el servicio en Render

1. Entra a https://dashboard.render.com
2. **New → Blueprint**
3. Conecta tu cuenta de GitHub y elige el repositorio que acabas de subir.
4. Render detectará automáticamente `render.yaml` y mostrará el servicio `cuentas` con su disco.
5. Haz clic en **Apply** y espera unos minutos a que termine el build.

### Paso 3 — Usar la app

Cuando el deploy termine, Render te dará una URL así:

```
https://cuentas-xxxx.onrender.com
```

Ábrela desde el celular, la PC de Windows o cualquier dispositivo con internet. La interfaz y la API están en esa misma dirección.

Cada vez que hagas `git push`, Render actualiza la app automáticamente.

---

## Ejecutar en local (opcional)

### Windows

1. Instala Node.js desde https://nodejs.org (versión 22 o superior).
2. Copia la carpeta del proyecto (sin `node_modules` ni `gastos.db`).
3. Abre PowerShell en esa carpeta y ejecuta:

```powershell
npm install
npm start
```

4. Abre `http://localhost:3000`. Para entrar desde el celular, usa la IP que muestra la terminal (misma WiFi).

### Linux / macOS

```bash
npm install
npm start
```

---

## Alternativa 100% gratuita (más pasos)

Si no quieres pagar el plan Starter, la opción gratuita es cambiar SQLite por **Postgres gratis de Supabase**:

1. Crear un proyecto en https://supabase.com (plan free, no expira).
2. Instalar el paquete `pg` y adaptar `server.js` para conectarse con `DATABASE_URL`.
3. Usar el plan Free de Render para la app (sin disco).

No está implementado porque agrega complejidad. Si te interesa, se puede hacer en una siguiente versión.

---

## Cambios preparados para la nube

- `server.js`: usa `process.env.PORT` y `process.env.DB_PATH`
- `render.yaml`: define el servicio, el disco persistente y las variables de entorno
- `.gitignore`: excluye dependencias y datos locales
