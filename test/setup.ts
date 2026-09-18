// Setup global de Vitest: corre antes de importar cualquier archivo de test
// (ver vitest.config.ts -> test.setupFiles), así que esto se ejecuta antes
// de que lib/prisma.ts lea `process.env.DATABASE_URL` al instanciar el
// PrismaClient singleton.
//
// Estrategia de datos de test: Postgres real, no mocks. Las reglas de
// negocio que hay que proteger acá (constraints @@unique de inmutabilidad,
// transacciones de responderItem, defaults now() del servidor) son
// justamente comportamiento de la base de datos — mockear Prisma les
// restaría valor. Se reusa el contenedor Docker existente
// (docker-compose.yml, preop-postgres, puerto 5433) con una base separada
// de la de desarrollo (`preoperacional_test`), migrada aparte con
// `prisma migrate deploy` (ver npm script "test:db:migrate").
//
// No se puede usar un archivo `.env.test` (bloqueado por permisos del
// entorno de este agente para escribir dotenv en la raíz del repo), así que
// el valor por defecto vive acá. Se puede sobreescribir seteando
// DATABASE_URL en el entorno antes de correr `npm test` si se quiere apuntar
// a otra base.
process.env.DATABASE_URL ??=
  "postgresql://preop:preop@localhost:5433/preoperacional_test";

// Mismo motivo que DATABASE_URL de arriba: no se puede usar `.env.test` en
// este entorno. `getSignedReadUrl` (lib/storage/s3.ts) solo firma una URL de
// forma local (no hace ninguna llamada de red real), pero igual exige
// `S3_BUCKET` seteada o lanza — necesario desde que
// `getInspectionForSupervisor` empezó a firmar la URL de las fotos diarias
// también (fase soporte-moto-carro, Slice 5, A7), no solo las de Novedad.
process.env.S3_BUCKET ??= "preop-test-bucket";

// Corrección Slice 5 (hallazgo WARNING reliability — test de render
// permanente de InspeccionPdfDocument): a diferencia de `getSignedReadUrl`
// de arriba, @react-pdf/renderer SÍ intenta un fetch real de red por cada
// <Image src={url}> al renderizar un PDF (aunque el fallo de esa carga se
// atrapa y degrada con un console.warn — ver @react-pdf/layout,
// fetchImage — nunca tumba el render). Sin `S3_ENDPOINT`, el cliente S3 usa
// el endpoint público real de AWS (lib/storage/s3.ts, createS3Client) y ese
// fetch intentaría salir a Internet real, algo que no se puede garantizar
// en todos los entornos de CI/sandbox. Se apunta al mismo contenedor MinIO
// local (docker-compose.yml, `preop-minio`, puerto 9010) que ya usa este
// proyecto en desarrollo (ver `.env`), para que ese fetch sea local y
// rápido (éxito o 403/404, nunca un cuelgue de red externa) sin necesidad
// de subir ningún objeto real: alcanza con que la URL firmada resuelva a un
// host local.
process.env.S3_ENDPOINT ??= "http://localhost:9010";
process.env.S3_ACCESS_KEY_ID ??= "preopadmin";
process.env.S3_SECRET_ACCESS_KEY ??= "preopadmin123";
