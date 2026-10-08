import bcrypt from "bcrypt";
import { PrismaClient, TipoVehiculo, TipoRespuestaItem } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CLAVE_FECHA_VIGENCIA, PLACEHOLDER_FECHA_VIGENCIA } from "../lib/settings/constants";
import { SEED_FECHA_VENCIMIENTO_TECNICOMECANICA, SEED_USERS, SEED_VEHICULOS } from "./seed-usuarios";

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

// Password de desarrollo para los usuarios seed (ver prisma/seed-usuarios.ts). Se puede sobreescribir
// con la variable de entorno SEED_USER_PASSWORD. NUNCA usar este valor por
// defecto en un ambiente real: los usuarios de producción no se crean con
// este script sino con una contraseña propia.
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Cambiar123!";

// Catálogo REAL del checklist, auditado contra el formato oficial FO-SVS-23
// y autorizado por el dueño de producto — reemplaza al catálogo del Slice 1
// (moto-only, sin fluidos). Reestructuración de la fase soporte-moto-carro
// (Slice 2, A1/A2): cuatro categorías ("Documentación", "Inspección Visual",
// "Fluidos", "Equipo de prevención"), cada ítem branchea por `tipoVehiculo`
// (`undefined` = aplica a MOTO y CARRO) y declara `tipoRespuesta` (por
// defecto BINARIO; TRIESTADO para los 3 ítems de fluidos).
//
// "Frenos" (el sistema de frenos en sí) es BINARIO y compartido — distinto
// de "Nivel líquido de frenos" (TRIESTADO, Fluidos): confirmado
// explícitamente con el dueño de producto para no confundir los dos ítems.
//
// "Equipo de prevención" es una categoría compartida conceptualmente, pero
// sus ítems concretos son 100% específicos por tipo: MOTO usa "Canguro de
// emergencia vial", CARRO usa "Botiquín" + "Extintor" — ningún ítem de esta
// categoría tiene `tipoVehiculo: undefined`.
const CHECKLIST: Array<{
  nombre: string;
  orden: number;
  items: Array<{
    nombre: string;
    orden: number;
    slugs: string[];
    // Imágenes propias para CARRO en preguntas compartidas con moto: si el
    // vehículo es CARRO reemplazan a `slugs` (ver lib/inspections/imagenes.ts).
    slugsCarro?: string[];
    pideUbicacion?: boolean;
    tipoVehiculo?: TipoVehiculo;
    tipoRespuesta?: TipoRespuestaItem;
  }>;
}> = [
  // Orden del recorrido guiado (pedido del dueño de producto, 2026-09-18):
  // Inspección Visual → Fluidos → Equipo de prevención (los tres ítem por
  // ítem) → Documentación (una sola lista) → declaración del conductor.
  {
    nombre: "Documentación",
    orden: 4,
    items: [
      { nombre: "Tarjeta de propiedad / Licencia de tránsito", orden: 1, slugs: [] },
      { nombre: "SOAT", orden: 2, slugs: [] },
      { nombre: "Revisión técnicomecánica", orden: 3, slugs: [] },
      { nombre: "Licencia de conducción", orden: 4, slugs: [] },
      { nombre: "Cédula de ciudadanía", orden: 5, slugs: [] },
    ],
  },
  {
    nombre: "Inspección Visual",
    orden: 1,
    items: [
      { nombre: "Espejos", orden: 1, slugs: ["espejos"], slugsCarro: ["espejos-carro.webp"] },
      { nombre: "Frenos", orden: 2, slugs: ["frenos"], slugsCarro: ["frenos-carro.webp"] },
      {
        nombre: "Luces externas con direccionales",
        orden: 3,
        slugs: ["direccionales"],
        tipoVehiculo: TipoVehiculo.MOTO,
      },
      { nombre: "Llantas", orden: 4, slugs: ["llantas"], tipoVehiculo: TipoVehiculo.MOTO },
      { nombre: "Casco", orden: 5, slugs: ["casco"], tipoVehiculo: TipoVehiculo.MOTO },
      {
        nombre: "Luces altas, bajas, reversa e internas con direccionales",
        orden: 6,
        slugs: ["luces-carro.webp"],
        tipoVehiculo: TipoVehiculo.CARRO,
      },
      {
        nombre: "Llantas, incluye repuesto",
        orden: 7,
        slugs: ["llantas-repuesto.webp"],
        tipoVehiculo: TipoVehiculo.CARRO,
      },
      { nombre: "Cinturones de seguridad", orden: 8, slugs: ["cinturones-seguridad.webp"], tipoVehiculo: TipoVehiculo.CARRO },
      { nombre: "Limpiabrisas", orden: 9, slugs: ["limpiabrisas.webp"], tipoVehiculo: TipoVehiculo.CARRO },
    ],
  },
  {
    nombre: "Fluidos",
    orden: 2,
    items: [
      {
        nombre: "Nivel de aceite",
        orden: 1,
        slugs: ["nivel-aceite"],
        slugsCarro: ["nivel-aceite-carro.webp"],
        tipoRespuesta: TipoRespuestaItem.TRIESTADO,
      },
      {
        nombre: "Nivel líquido de frenos",
        orden: 2,
        slugs: ["nivel-liquido-frenos"],
        slugsCarro: ["nivel-liquido-frenos-carro.webp"],
        tipoRespuesta: TipoRespuestaItem.TRIESTADO,
      },
      {
        nombre: "Nivel refrigerante",
        orden: 3,
        slugs: ["nivel-refrigerante"],
        slugsCarro: ["nivel-refrigerante-carro.webp"],
        tipoRespuesta: TipoRespuestaItem.TRIESTADO,
      },
    ],
  },
  {
    nombre: "Equipo de prevención",
    orden: 3,
    items: [
      { nombre: "Canguro de emergencia vial", orden: 1, slugs: ["canguro-emergencia"], tipoVehiculo: TipoVehiculo.MOTO },
      { nombre: "Botiquín", orden: 2, slugs: ["botiquin.webp"], tipoVehiculo: TipoVehiculo.CARRO },
      { nombre: "Extintor", orden: 3, slugs: ["extintor.webp"], tipoVehiculo: TipoVehiculo.CARRO },
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

  for (const { email, name, role, cedula, tipoVehiculo, sede } of SEED_USERS) {
    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        cedula,
        role,
        activo: true,
        conductorActivo: true,
        tipoVehiculo: tipoVehiculo ?? null,
        sede: sede ?? null,
      },
      create: {
        email,
        name,
        cedula,
        role,
        passwordHash,
        conductorActivo: true,
        tipoVehiculo: tipoVehiculo ?? null,
        sede: sede ?? null,
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
      // Un slug con extensión ("botiquin.webp") se usa tal cual; sin extensión
      // es jpg, salvo los PNG listados arriba.
      const urlImagen = (slug: string) =>
        slug.includes(".") ? `/checklist/${slug}` : `/checklist/${slug}.${PNG_SLUGS.has(slug) ? "png" : "jpg"}`;
      const imagenesUrl = item.slugs.map(urlImagen);
      const imagenesCarroUrl = (item.slugsCarro ?? []).map(urlImagen);
      const pideUbicacion = item.pideUbicacion ?? false;
      // `tipoVehiculo` sin declarar en CHECKLIST → null en la base (aplica a
      // MOTO y CARRO, A1 del design). `tipoRespuesta` sin declarar → BINARIO
      // (default del schema).
      const tipoVehiculo = item.tipoVehiculo ?? null;
      const tipoRespuesta = item.tipoRespuesta ?? TipoRespuestaItem.BINARIO;

      if (existing) {
        await prisma.checklistItem.update({
          where: { id: existing.id },
          data: { orden: item.orden, imagenesUrl, imagenesCarroUrl, pideUbicacion, tipoVehiculo, tipoRespuesta },
        });
      } else {
        await prisma.checklistItem.create({
          data: {
            categoryId: createdCategory.id,
            nombre: item.nombre,
            orden: item.orden,
            imagenesUrl,
            imagenesCarroUrl,
            pideUbicacion,
            tipoVehiculo,
            tipoRespuesta,
          },
        });
      }
    }
  }

  const totalItems = CHECKLIST.reduce((sum, category) => sum + category.items.length, 0);
  console.log(
    `Seed OK: ${CHECKLIST.length} categorías y ${totalItems} ítems de checklist creados/actualizados.`,
  );

  // Un vehículo demo por Recorredor (relación 1:1 `User.vehicleId`, decisión
  // del usuario, 2026-09-18): MOTO de Bogotá, CARRO y MOTO de Olariari. Idempotente:
  // `vehicleId` es unique y cada par es fijo, así que correr el seed de nuevo
  // no choca.
  for (const { placa, tipo, tipoVehiculo, hojaDeVida, usuarioEmail } of SEED_VEHICULOS) {
    const vehiculo = await prisma.vehicle.upsert({
      where: { placa },
      update: {
        activo: true,
        fechaVencimientoTecnicomecanica: SEED_FECHA_VENCIMIENTO_TECNICOMECANICA,
        tipoVehiculo,
        ...hojaDeVida,
      },
      create: {
        placa,
        tipo,
        activo: true,
        fechaVencimientoTecnicomecanica: SEED_FECHA_VENCIMIENTO_TECNICOMECANICA,
        tipoVehiculo,
        ...hojaDeVida,
      },
    });
    await prisma.user.update({ where: { email: usuarioEmail }, data: { vehicleId: vehiculo.id } });
    console.log(`Seed OK: vehículo demo "${placa}" (${tipoVehiculo}) vinculado a ${usuarioEmail}.`);
  }

  // Fase soporte-moto-carro (Slice 4, ADR A5): placeholder de
  // "Fecha vigencia" del PDF hasta que un Administrador defina la fecha
  // real desde /admin/configuracion (ver lib/settings/actions.ts). `create`
  // siembra el placeholder; `update` queda vacío a propósito para no pisar
  // un valor real ya configurado por un Administrador si el seed se corre
  // de nuevo. `CLAVE_FECHA_VIGENCIA`/`PLACEHOLDER_FECHA_VIGENCIA` vienen de
  // lib/settings/constants.ts (sin "server-only", a diferencia de
  // lib/settings/queries.ts) para que este script pueda importarlas sin
  // arrastrar esa dependencia, manteniendo una sola fuente de verdad.
  await prisma.appSetting.upsert({
    where: { clave: CLAVE_FECHA_VIGENCIA },
    update: {},
    create: { clave: CLAVE_FECHA_VIGENCIA, valor: PLACEHOLDER_FECHA_VIGENCIA },
  });
  console.log('Seed OK: configuración "formato.fechaVigencia" sembrada con placeholder.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
