import bcrypt from "bcrypt";
import { PrismaClient, TipoRespuestaItem } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CLAVE_FECHA_VIGENCIA, PLACEHOLDER_FECHA_VIGENCIA } from "../lib/settings/constants";
import { SEED_FECHA_VENCIMIENTO_TECNICOMECANICA, SEED_USERS, SEED_VEHICULOS } from "./seed-usuarios";
import { resolverModoSeed } from "./seed-modo";
import { CHECKLIST } from "./catalogo-checklist";

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

// Password de desarrollo para los usuarios seed (ver prisma/seed-usuarios.ts). Se puede sobreescribir
// con la variable de entorno SEED_USER_PASSWORD. NUNCA usar este valor por
// defecto en un ambiente real: los usuarios de producción no se crean con
// este script sino con una contraseña propia.
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Cambiar123!";

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
  // Producción: solo catálogo y configuración (ver prisma/seed-modo.ts).
  const modo = resolverModoSeed(process.env);
  console.log(
    modo.produccion
      ? "Seed: modo producción → solo catálogo y configuración (sin usuarios demo ni limpieza)."
      : "Seed: modo desarrollo → catálogo + usuarios y vehículos demo.",
  );

  if (modo.datosDemo) {
    await sembrarUsuariosDemo();
  }
  if (modo.limpiarDatosPrueba) {
    await limpiarDatosDePruebaObsoletos();
  }
  await sembrarCatalogo();
  if (modo.datosDemo) {
    await sembrarVehiculosDemo();
  }
  await sembrarConfiguracion();
}

async function sembrarUsuariosDemo() {
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
}

async function sembrarCatalogo() {
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
}

async function sembrarVehiculosDemo() {
  // Un vehículo demo por Recorredor (relación 1:1 `User.vehicleId`, decisión
  // del usuario, 2026-09-18): MOTO de Bogotá, CARRO y MOTO de Oleariari. Idempotente:
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
}

async function sembrarConfiguracion() {
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
