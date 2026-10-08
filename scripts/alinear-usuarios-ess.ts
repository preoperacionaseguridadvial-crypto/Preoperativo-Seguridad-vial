// Alinea los usuarios demo de la base de DESARROLLO con los cargos reales de ESS
// (feature roles-oleariari). Solo desarrollo: nunca corre contra la base de test
// ni contra una base que no sea la local.
//
//   npx tsx --env-file=.env --conditions=react-server scripts/alinear-usuarios-ess.ts
//
// - Renombra EN SITIO los usuarios demo anteriores (trabajador@ → recorredor.bogota@,
//   supervisor@ → director.operaciones@, sst@ → admin.sst@, y los de la sede con
//   la ortografía vieja recorredor/supervisor.olariari@ → .oleariari@): conservan su id,
//   inspecciones, firmas y auditoría. Actualiza también el nombre visible.
// - Crea los usuarios nuevos que falten (recorredor.oleariari@ con su moto OLA123 y
//   supervisor.oleariari@), con la password de desarrollo.
// - Es idempotente: correrlo de nuevo no cambia nada.
//
// Un esquema con `provider = "prisma-client"` emite TypeScript, por eso se corre
// con tsx y no con node.
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  RENOMBRES_USUARIOS_DEMO,
  SEED_FECHA_VENCIMIENTO_TECNICOMECANICA,
  SEED_USERS,
  SEED_VEHICULOS,
} from "../prisma/seed-usuarios";

const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Cambiar123!";

// Usuarios que este script da de alta si faltan. Los demás usuarios demo del
// seed (p. ej. el Recorredor de carro) los crea `npm run prisma:seed`, no esto.
const USUARIOS_NUEVOS = new Set(["recorredor.oleariari@ess.local", "supervisor.oleariari@ess.local"]);

function esBaseLocalDeDesarrollo(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const base = pathname.replace(/^\//, "");
    const local = hostname === "localhost" || hostname === "127.0.0.1";
    return local && base.length > 0 && !/test/i.test(base);
  } catch {
    return false;
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!esBaseLocalDeDesarrollo(url)) {
    throw new Error(
      "DATABASE_URL no es una base local de desarrollo (o parece la de test): no se toca nada.",
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  const nombreSeed = new Map(SEED_USERS.map((u) => [u.email, u.name]));

  try {
    // 1) Renombres en sitio (solo si el anterior existe y el nuevo todavía no).
    for (const { anterior, nuevo } of RENOMBRES_USUARIOS_DEMO) {
      const [viejo, yaExiste] = await Promise.all([
        prisma.user.findUnique({ where: { email: anterior } }),
        prisma.user.findUnique({ where: { email: nuevo } }),
      ]);
      if (!viejo) {
        console.log(`= ${anterior}: no existe (${yaExiste ? `ya está como ${nuevo}` : "se creará con el seed"}).`);
      } else if (yaExiste) {
        console.log(`! ${anterior} y ${nuevo} existen a la vez: no se renombra, revisar a mano.`);
      } else {
        await prisma.user.update({
          where: { id: viejo.id },
          data: { email: nuevo, name: nombreSeed.get(nuevo) ?? viejo.name },
        });
        console.log(`+ ${anterior} → ${nuevo} (id ${viejo.id} conservado).`);
      }
    }

    // 2) Usuarios nuevos que falten (y su vehículo, si les corresponde).
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    for (const seed of SEED_USERS.filter((u) => USUARIOS_NUEVOS.has(u.email))) {
      if (await prisma.user.findUnique({ where: { email: seed.email } })) continue;

      const vehiculoSeed = SEED_VEHICULOS.find((v) => v.usuarioEmail === seed.email);
      const vehiculo = vehiculoSeed
        ? await prisma.vehicle.upsert({
            where: { placa: vehiculoSeed.placa },
            update: {},
            create: {
              placa: vehiculoSeed.placa,
              tipo: vehiculoSeed.tipo,
              activo: true,
              fechaVencimientoTecnicomecanica: SEED_FECHA_VENCIMIENTO_TECNICOMECANICA,
              tipoVehiculo: vehiculoSeed.tipoVehiculo,
              ...vehiculoSeed.hojaDeVida,
            },
          })
        : null;

      await prisma.user.create({
        data: {
          email: seed.email,
          name: seed.name,
          cedula: seed.cedula,
          role: seed.role,
          passwordHash,
          conductorActivo: true,
          tipoVehiculo: seed.tipoVehiculo ?? null,
          sede: seed.sede ?? null,
          vehicleId: vehiculo?.id ?? null,
        },
      });
      console.log(`+ ${seed.email} creado (${seed.role}${seed.sede ? `, ${seed.sede}` : ""}${vehiculo ? `, vehículo ${vehiculo.placa}` : ""}).`);
    }

    // 3) Estado final de los usuarios demo.
    const demo = await prisma.user.findMany({
      where: {
        email: {
          in: [...RENOMBRES_USUARIOS_DEMO.map((r) => r.nuevo), ...USUARIOS_NUEVOS, "director@ess.local", "admin@ess.local"],
        },
      },
      orderBy: { email: "asc" },
      select: { email: true, name: true, role: true, sede: true, vehicle: { select: { placa: true } } },
    });
    console.table(demo.map((u) => ({ ...u, vehicle: u.vehicle?.placa ?? "—" })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
