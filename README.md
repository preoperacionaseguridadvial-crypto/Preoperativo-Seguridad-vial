# Preoperacional Seguridad Vial — ESS LTDA

App para que los motorizados de seguridad vial de ESS LTDA hagan inspecciones
preoperacionales diarias de sus motos desde el celular, con aprobación por
parte de un Supervisor.

## Estado actual: Fase 2 (checklist del trabajador) — completada

### Fase 1 (cimientos)

- Scaffold Next.js (App Router, TypeScript, ESLint, Tailwind).
- PWA (manifest + service worker vía Serwist, íconos placeholder).
- Schema de Prisma (`User`, `Vehicle`, `Inspection`, `AuditLog`) con
  PostgreSQL.
- Auth con NextAuth (Credentials + bcrypt, sesión JWT). Sin registro
  público: los usuarios se crean con el seed script.
- Proxy (`proxy.ts`, antes "middleware") con protección de rutas por rol +
  helper `requireRole` para validar permisos dentro de server
  actions/route handlers.
- AuditLog helper (`lib/audit.ts`), enganchado al login exitoso como prueba
  de concepto.

### Fase 2 (checklist del trabajador)

No incluye todavía: aprobación del Supervisor, dashboard ni reportes (Fase
3+). Lo que sí incluye:

- Catálogo de checklist (`ChecklistCategory`/`ChecklistItem`) sembrado por
  `prisma/seed.ts`: Luces, Llantas/Rines, Carrocería, Elementos de
  Seguridad, Documentación.
- Flujo guiado paso a paso para el TRABAJADOR bajo `/inspecciones`
  (protegido por rol en `proxy.ts`): elegir vehículo → medidas
  (kilometraje/combustible/presión) → un ítem de checklist por pantalla
  (✓ Conforme / ✕ No conforme / N/A) → novedad + foto opcional cuando un
  ítem queda No conforme → resultado final (¿puede operar?) → confirmación
  → envío.
- Modelos nuevos: `InspectionItemResponse`, `Novedad`, `Photo`, y en
  `Inspection` los campos `nivelCombustible`, `presionLlantas`,
  `puedeOperar`, `justificacionNoOperar`.
- Server actions en `lib/inspections/actions.ts` (todas validan rol
  TRABAJADOR + ownership de la inspección con `requireRole`, y auditan con
  `logAudit`): `iniciarInspeccion`, `registrarKilometraje`,
  `responderItem`, `subirFotoNovedad`, `registrarResultado`,
  `enviarInspeccion`.
- Storage de fotos S3-compatible genérico (`lib/storage/s3.ts`, sirve para
  AWS S3, Cloudflare R2 o MinIO sin cambiar código): solo se guarda el
  `s3Key` en base de datos, nunca una URL pública permanente.

### Reglas de negocio inmutables (aplican a todo el sistema)

Ver comentarios en `prisma/schema.prisma` y `lib/auth/`. En resumen: no hay
ventana horaria para iniciar una inspección, los timestamps oficiales
siempre los pone el servidor, ninguna inspección se borra, y todo permiso
se valida en el backend (nunca solo en el frontend).

## Cómo levantar el proyecto

### 1. Requisitos

- Node.js 20+
- Una base PostgreSQL (local o remota).

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Completar `DATABASE_URL` con una conexión real a PostgreSQL, y generar un
`NEXTAUTH_SECRET`:

```bash
npx auth secret
```

**Nota (Fase 2):** el sandbox de esta sesión tiene bloqueado el acceso a
`.env.example` (lectura y escritura), así que las variables nuevas de S3 no
se pudieron agregar ahí directamente. Agregalas a mano a tu `.env` (mismo
formato que el resto del archivo):

```bash
S3_ENDPOINT=              # opcional: solo para R2/MinIO (ej: https://<account>.r2.cloudflarestorage.com). Vacío = AWS S3.
S3_BUCKET=preoperacional-fotos
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

### 4. Migrar y sembrar la base de datos

```bash
npm run prisma:migrate
npm run prisma:seed
```

El seed crea 4 usuarios de prueba (uno por rol), todos con la misma
password de desarrollo `Cambiar123!` (sobreescribible con la variable de
entorno `SEED_USER_PASSWORD` antes de correr el seed):

| Email                  | Rol         |
| ----------------------- | ----------- |
| trabajador@ess.local    | TRABAJADOR  |
| supervisor@ess.local    | SUPERVISOR  |
| director@ess.local      | DIRECTOR    |
| sst@ess.local            | SST         |

### 5. Correr en desarrollo

```bash
npm run dev
```

Abrir http://localhost:3000 — redirige a `/login` si no hay sesión.

### 6. Probar el flujo de inspección (Fase 2)

1. Iniciar sesión con `trabajador@ess.local` / `Cambiar123!`.
2. Desde `/` (home), tocar "Ir a inspecciones" (o entrar directo a
   `/inspecciones`).
3. Elegir el vehículo demo "ABC123" (creado por el seed) para iniciar una
   inspección nueva.
4. Completar kilometraje/combustible/presión, luego responder cada ítem
   del checklist. Al marcar "No conforme" en alguno, cargar la descripción
   de la novedad y, opcionalmente, subir una foto (requiere el bucket S3
   configurado; sin eso, ese paso específico falla — el resto del flujo no
   depende de S3).
5. En la pantalla de resultado, elegir si el vehículo puede operar
   (justificación obligatoria si la respuesta es "No").
6. Confirmar y enviar. La inspección queda en `PENDIENTE_APROBACION` o
   `NO_APTA_PARA_OPERAR` según corresponda (Fase 3 agrega la revisión del
   Supervisor sobre ese estado).
7. Si se cierra la app a mitad de camino, volver a entrar a
   `/inspecciones` — la inspección `EN_PROCESO` aparece para retomarla
   desde donde quedó.

## Notas técnicas

- **Prisma 7**: usa `prisma.config.ts` (ya no `package.json#prisma`) y el
  generador `prisma-client` (no `prisma-client-js`), que **requiere un
  driver adapter explícito** — se usa `@prisma/adapter-pg` (ver
  `lib/prisma.ts` y `prisma/seed.ts`). El cliente generado vive en
  `generated/prisma/` (gitignored, se regenera con `npm run
  prisma:generate`).
- **NextAuth v5 (beta)**: sesión **JWT**, no "database". El Credentials
  provider de NextAuth no admite estrategia "database" sin un adapter, y no
  se pidió un modelo `Session` en el schema — JWT es la opción correcta acá
  y evita una tabla de sesiones que esta fase no necesita.
- **Proxy vs. Middleware**: Next.js 16 renombró `middleware.ts` a
  `proxy.ts` (deprecando el nombre anterior). El archivo se separó en dos
  configs de NextAuth: `lib/auth/base-config.ts` (sin providers, la usa
  `proxy.ts`) y `lib/auth/config.ts` (config completa con el Credentials
  provider + bcrypt + Prisma, usada por el resto de la app). Esto evita
  cargar bcrypt/Prisma en cada request que pasa por Proxy — es el patrón
  recomendado de Auth.js para split-config.
- **PWA**: se usa `@serwist/next` (fork mantenido de `next-pwa`, que está
  sin publicar desde 2022) en **modo "configurator"**, que no depende de
  webpack — necesario porque Next.js 16 usa Turbopack por defecto tanto en
  `next dev` como en `next build`, y el modo clásico de `@serwist/next`
  (basado en un plugin de webpack) no funciona con Turbopack. El service
  worker se genera con `serwist build` como paso separado dentro de `npm
  run build` (ver `serwist.config.js` y `app/sw.ts`). En desarrollo el
  service worker no se registra (no existe `public/sw.js` hasta que se
  compila).
- **Colores/íconos del manifest** (`#0B3B60` azul oscuro, `#2E9BD6`
  celeste) son **provisorios** — no son la identidad visual oficial de ESS
  LTDA. Reemplazar cuando el logo/branding oficial esté disponible (ver
  comentarios en `public/manifest.json`).
- **Build sin base de datos real**: `prisma generate` (y por lo tanto
  `next build`, que lo necesita para tipar el cliente) requiere que
  `DATABASE_URL` esté definida, pero no necesita poder conectarse de
  verdad — un valor dummy alcanza:

  ```bash
  DATABASE_URL="postgresql://user:pass@localhost:5432/dummy" \
  NEXTAUTH_SECRET="dummy-secret-for-build-only" \
  NEXTAUTH_URL="http://localhost:3000" \
  npm run build
  ```

  Para correr la app de verdad (`npm run dev`/`npm start` con login
  funcional) sí hace falta un PostgreSQL real y correr las migraciones.

## Verificación

- `npx tsc --noEmit` — sin errores.
- `npm run lint` — sin errores ni warnings.
- `npm run build` — exitoso (usando el `DATABASE_URL` dummy de arriba).

## Qué falta (fases siguientes)

- Revisión/aprobación por parte del Supervisor: hoy `enviarInspeccion` deja
  la inspección en `PENDIENTE_APROBACION` o `NO_APTA_PARA_OPERAR`, pero no
  existe ninguna pantalla ni server action para que el Supervisor la
  apruebe/rechace (`supervisorId`, `approvedAt`, `rejectedAt`,
  `reviewedAt` ya existen en el schema desde Fase 1, sin usar todavía).
- Dashboard para Supervisor/Director/SST.
- Reportes.
- Páginas protegidas por rol para Supervisor/Director/SST en
  `ROLE_ROUTE_PREFIXES` (`proxy.ts`) — hoy solo está `"/inspecciones":
  ["TRABAJADOR"]`.
- Reemplazar los íconos/colores placeholder del manifest por la identidad
  visual oficial de ESS LTDA.
- Definir una base de datos real (dev/staging/prod) y correr la migración
  de Fase 2 — hoy el schema solo se verificó con Prisma Client generado
  contra una URL dummy (`npx prisma generate`), nunca contra una base
  real. Cuando haya un PostgreSQL real:

  ```bash
  npm run prisma:migrate -- --name checklist-fase-2
  npm run prisma:seed      # puebla el catálogo de checklist + vehículo demo "ABC123"
  ```
- Configurar un bucket S3-compatible real (AWS S3, R2 o MinIO) con las
  variables de entorno nuevas (ver sección de configuración arriba) — sin
  esto, `subirFotoNovedad` falla al intentar subir.
- El caso de "novedad general" (no ligada a un ítem puntual) quedó
  modelado en `Novedad.inspectionId` pero sin UI/acción que lo cree en esta
  fase (ver duda de modelado en el reporte de Fase 2).
