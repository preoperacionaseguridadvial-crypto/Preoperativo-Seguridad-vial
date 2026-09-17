import bcrypt from "bcrypt";
import { PrismaClient, Role } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

// Password de desarrollo para los 4 usuarios seed. Se puede sobreescribir
// con la variable de entorno SEED_USER_PASSWORD. NUNCA usar este valor por
// defecto en un ambiente real: los usuarios de producción no se crean con
// este script sino con una contraseña propia.
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Cambiar123!";

const SEED_USERS: Array<{ email: string; name: string; role: Role; cedula: string }> = [
  { email: "trabajador@ess.local", name: "Trabajador Demo", role: Role.TRABAJADOR, cedula: "1001234567" },
  { email: "supervisor@ess.local", name: "Supervisor Demo", role: Role.SUPERVISOR, cedula: "1002345678" },
  { email: "director@ess.local", name: "Director Demo", role: Role.DIRECTOR, cedula: "1003456789" },
  { email: "sst@ess.local", name: "SST Demo", role: Role.SST, cedula: "1004567890" },
  // Usuario de PRUEBA para entrar al panel de administración — la cuenta
  // real que va a operar el dueño de producto se crea desde adentro del
  // panel (o se reemplaza esta con credenciales propias).
  { email: "admin@ess.local", name: "Administrador Demo", role: Role.ADMINISTRADOR, cedula: "1005678901" },
];

// Datos de conductor (Fase B, FO-SVS-23) para los 4 usuarios seed: fecha de
// vencimiento del pase futura (no vencida) y activo para operar. Solo el
// TRABAJADOR opera realmente como conductor en el flujo actual, pero se
// setean en los 4 para no dejar valores nulos en el ambiente de desarrollo.
const SEED_FECHA_VENCIMIENTO_PASE = new Date("2027-06-30T00:00:00.000Z");

// Vencimiento de tecnicomecánica del vehículo demo, también futuro.
const SEED_FECHA_VENCIMIENTO_TECNICOMECANICA = new Date("2027-03-15T00:00:00.000Z");

// Catálogo REAL del checklist, auditado contra el formato oficial FO-SVS-23
// (columna MOTOS) y autorizado por el dueño de producto — reemplaza al
// catálogo anterior (5 categorías con datos inventados). Dos categorías:
// "Inspección Visual" (7 ítems, con foto(s) de referencia) y
// "Documentación" (10 ítems, sin foto — el formato oficial no trae imagen
// para estos, la UI cae al placeholder neutro).
//
// Rines, Extintor, Botiquín y "Documentos exigidos por la compañía" se
// eliminan por completo: no existen para motos en el formato oficial.
//
// "Rayones" tiene `pideUbicacion: true` — reusa la misma zona física que
// "Estado de la latonería" (misma imagen) pero pide siempre un texto
// "¿Dónde?" al trabajador, no solo cuando queda en FALLA. Ver comentario en
// prisma/schema.prisma.
const CHECKLIST: Array<{
  nombre: string;
  orden: number;
  items: Array<{
    nombre: string;
    orden: number;
    slugs: string[];
    pideUbicacion?: boolean;
  }>;
}> = [
  {
    nombre: "Inspección Visual",
    orden: 1,
    items: [
      { nombre: "Luces Altas y Bajas", orden: 1, slugs: ["luces-altas", "luces-bajas"] },
      { nombre: "Direccionales y Estacionarias", orden: 2, slugs: ["direccionales", "luces-estacionarias"] },
      { nombre: "Luz de Reversa", orden: 3, slugs: ["luz-reversa"] },
      { nombre: "Espejos en buen estado", orden: 4, slugs: ["espejos"] },
      { nombre: "Llantas en buen estado", orden: 5, slugs: ["llantas"] },
      { nombre: "Estado de la latonería", orden: 6, slugs: ["carroceria-latoneria"] },
      { nombre: "Rayones", orden: 7, slugs: ["carroceria-latoneria"], pideUbicacion: true },
    ],
  },
  {
    nombre: "Documentación",
    orden: 2,
    items: [
      { nombre: "SOAT", orden: 1, slugs: [] },
      { nombre: "Cédula de ciudadanía", orden: 2, slugs: [] },
      { nombre: "Carné de la compañía", orden: 3, slugs: [] },
      { nombre: "Tarjeta de propiedad", orden: 4, slugs: [] },
      { nombre: "Credencial SSP", orden: 5, slugs: [] },
      { nombre: "Licencia de conducción vigente", orden: 6, slugs: [] },
      { nombre: "Carné ARL", orden: 7, slugs: [] },
      { nombre: "Carné EPS", orden: 8, slugs: [] },
      { nombre: "Copia parafiscales mes en curso", orden: 9, slugs: [] },
      { nombre: "Copia salvoconducto autenticada", orden: 10, slugs: [] },
    ],
  },
];

const CATEGORIAS_VIGENTES = CHECKLIST.map((c) => c.nombre);
const ITEMS_VIGENTES_POR_CATEGORIA = new Map(
  CHECKLIST.map((c) => [c.nombre, new Set(c.items.map((i) => i.nombre))]),
);

/**
 * Limpieza de datos de prueba locales previa a la reestructuración del
 * catálogo (Fase A, FO-SVS-23). Son inspecciones de prueba de desarrollo —
 * no hay datos reales de producción en este ambiente — cuyas
 * InspectionItemResponse/Novedad/Photo apuntan a ChecklistItem que van a
 * eliminarse o fusionarse y quedarían huérfanas/inválidas (ej: el enum
 * RespuestaChecklist pierde CONFORME/NO_CONFORME/NO_APLICA). Se borran en
 * este orden por las FK (Photo → Novedad → InspectionItemResponse). No se
 * toca User ni Vehicle.
 */
async function limpiarDatosDePruebaObsoletos() {
  const photos = await prisma.photo.deleteMany({});
  const novedades = await prisma.novedad.deleteMany({});
  const respuestas = await prisma.inspectionItemResponse.deleteMany({});
  console.log(
    `Seed: limpieza de datos de prueba obsoletos → ${photos.count} fotos, ${novedades.count} novedades, ${respuestas.count} respuestas de checklist eliminadas.`,
  );

  // Ítems y categorías del catálogo anterior que ya no existen en el
  // formato oficial (Rines, Extintor, Botiquín, "Documentos exigidos por la
  // compañía", y las categorías "Luces"/"Llantas/Rines"/"Carrocería"/
  // "Elementos de Seguridad" fusionadas en "Inspección Visual").
  const categoriasObsoletas = await prisma.checklistCategory.findMany({
    where: { nombre: { notIn: CATEGORIAS_VIGENTES } },
  });
  const itemsVigentesEnCategoriaActual = await prisma.checklistItem.findMany({
    where: {
      category: { nombre: { in: CATEGORIAS_VIGENTES } },
    },
    select: { id: true, nombre: true, categoryId: true, category: { select: { nombre: true } } },
  });
  const itemsObsoletosIds = itemsVigentesEnCategoriaActual
    .filter((item) => !ITEMS_VIGENTES_POR_CATEGORIA.get(item.category.nombre)?.has(item.nombre))
    .map((item) => item.id);

  const itemsBorrados = await prisma.checklistItem.deleteMany({
    where: {
      OR: [{ categoryId: { in: categoriasObsoletas.map((c) => c.id) } }, { id: { in: itemsObsoletosIds } }],
    },
  });
  const categoriasBorradas = await prisma.checklistCategory.deleteMany({
    where: { id: { in: categoriasObsoletas.map((c) => c.id) } },
  });
  console.log(
    `Seed: catálogo anterior → ${itemsBorrados.count} ítems y ${categoriasBorradas.count} categorías obsoletas eliminadas.`,
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const { email, name, role, cedula } of SEED_USERS) {
    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        cedula,
        role,
        activo: true,
        fechaVencimientoPase: SEED_FECHA_VENCIMIENTO_PASE,
        conductorActivo: true,
      },
      create: {
        email,
        name,
        cedula,
        role,
        passwordHash,
        fechaVencimientoPase: SEED_FECHA_VENCIMIENTO_PASE,
        conductorActivo: true,
      },
    });
  }

  console.log(`Seed OK: ${SEED_USERS.length} usuarios creados/actualizados.`);
  console.log(`Password de desarrollo para todos: "${SEED_PASSWORD}"`);
  console.log("(sobreescribible con la variable de entorno SEED_USER_PASSWORD)");

  await limpiarDatosDePruebaObsoletos();

  // "luces-altas" se subió como .png (el resto del catálogo usa .jpg) — ver public/checklist/README.md.
  const PNG_SLUGS = new Set(["luces-altas"]);

  for (const category of CHECKLIST) {
    const createdCategory = await prisma.checklistCategory.upsert({
      where: { nombre: category.nombre },
      update: { orden: category.orden },
      create: { nombre: category.nombre, orden: category.orden },
    });

    for (const item of category.items) {
      const existing = await prisma.checklistItem.findFirst({
        where: { categoryId: createdCategory.id, nombre: item.nombre },
      });
      const imagenesUrl = item.slugs.map(
        (slug) => `/checklist/${slug}.${PNG_SLUGS.has(slug) ? "png" : "jpg"}`,
      );
      const pideUbicacion = item.pideUbicacion ?? false;

      if (existing) {
        await prisma.checklistItem.update({
          where: { id: existing.id },
          data: { orden: item.orden, imagenesUrl, pideUbicacion },
        });
      } else {
        await prisma.checklistItem.create({
          data: {
            categoryId: createdCategory.id,
            nombre: item.nombre,
            orden: item.orden,
            imagenesUrl,
            pideUbicacion,
          },
        });
      }
    }
  }

  const totalItems = CHECKLIST.reduce((sum, category) => sum + category.items.length, 0);
  console.log(
    `Seed OK: ${CHECKLIST.length} categorías y ${totalItems} ítems de checklist creados/actualizados.`,
  );

  // Vehículo demo para poder probar el flujo de inspección de punta a punta.
  await prisma.vehicle.upsert({
    where: { placa: "ABC123" },
    update: { activo: true, fechaVencimientoTecnicomecanica: SEED_FECHA_VENCIMIENTO_TECNICOMECANICA },
    create: {
      placa: "ABC123",
      tipo: "Motocicleta",
      activo: true,
      fechaVencimientoTecnicomecanica: SEED_FECHA_VENCIMIENTO_TECNICOMECANICA,
    },
  });
  console.log('Seed OK: vehículo demo "ABC123" creado/actualizado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
