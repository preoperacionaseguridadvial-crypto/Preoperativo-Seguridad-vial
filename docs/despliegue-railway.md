# Despliegue en Railway + Cloudflare R2

Guía para publicar la aplicación con la app y PostgreSQL en **Railway** (plan Hobby) y las fotos y documentos en **Cloudflare R2** (plan gratuito).

| Pieza | Dónde | Notas |
|---|---|---|
| App Next.js | Servicio de Railway conectado al repositorio de GitHub | `npm run build` y `npm start` |
| PostgreSQL | Servicio Postgres de Railway | Mismo proyecto de Railway |
| Fotos y documentos | Bucket privado de Cloudflare R2 | Compatible con S3; `lib/storage/s3.ts` funciona sin cambios |

## 1. Cloudflare R2

1. Activar R2 en la cuenta de Cloudflare.
2. Crear un bucket **privado** (por ejemplo `preop-fotos`). No hace falta acceso público ni CORS: el servidor sube los archivos y el navegador los lee con URLs firmadas.
3. Crear un token de API de R2 con permiso **Object Read & Write** limitado a ese bucket.
4. Guardar: Account ID, Access Key ID, Secret Access Key y nombre del bucket.

## 2. Railway

1. Nuevo proyecto → **Deploy from GitHub repo** → este repositorio, rama `main`.
2. En el mismo proyecto: **New → Database → PostgreSQL**.
3. En el servicio de la app, pestaña **Settings**:
   - **Build command:** `npm run build` (incluye `prisma generate`).
   - **Pre-deploy command:** `npm run db:desplegar` (aplica migraciones y siembra el catálogo).
   - **Start command:** `npm start`.
4. Pestaña **Settings → Networking**: generar un dominio público (`*.up.railway.app`) o conectar uno propio.
5. En la configuración de uso de la cuenta, definir un **tope de gasto** mensual.

## 3. Variables de entorno (servicio de la app)

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia al servicio Postgres) |
| `NODE_ENV` | `production` |
| `SEED_MODO` | `produccion` |
| `AUTH_SECRET` | Cadena aleatoria. Generarla localmente con `npx auth secret` o `openssl rand -base64 33`. No compartirla ni guardarla en el repositorio. |
| `AUTH_TRUST_HOST` | `true` (la app corre detrás del proxy de Railway) |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | Nombre del bucket de R2 |
| `S3_ACCESS_KEY_ID` | Access Key ID del token de R2 |
| `S3_SECRET_ACCESS_KEY` | Secret Access Key del token de R2 |
| `TZ` | `America/Bogota` |

`S3_PUBLIC_ENDPOINT` no se usa en producción (solo sirve para MinIO local).

## 4. Seed en producción

`npm run db:desplegar` corre `prisma migrate deploy` y luego `prisma db seed`. Con `NODE_ENV=production` o `SEED_MODO=produccion` (ver `prisma/seed-modo.ts`) el seed:

- crea o actualiza el catálogo del checklist y la configuración inicial;
- **no** crea los usuarios ni los vehículos demo (contraseña de desarrollo conocida);
- **no** corre la limpieza de datos de prueba, que borra todas las fotos, novedades y respuestas.

Es idempotente: se puede correr en cada despliegue.

## 5. Después del primer despliegue

1. Crear el primer usuario Administrador real desde un PC con el repositorio instalado, en PowerShell o CMD (en Git Bash anteponer `winpty`):
   ```
   npx tsx scripts/crear-admin.ts
   ```
   El script pide la `DATABASE_PUBLIC_URL` del servicio Postgres (Railway → Postgres → Variables) y la contraseña de forma oculta, muestra a qué base va a escribir y pide confirmación. Nunca modifica un usuario existente. Los demás usuarios se crean después desde el panel de Administrador.
2. Probar el flujo completo desde un celular: inicio de sesión, inspección, fotos, firma, PDF y aprobación del supervisor.
3. Revisar en Postgres → **Backups** que las copias automáticas estén activas.
