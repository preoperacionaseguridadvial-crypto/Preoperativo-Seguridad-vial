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
