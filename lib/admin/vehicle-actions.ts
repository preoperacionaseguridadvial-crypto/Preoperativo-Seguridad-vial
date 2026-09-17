"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/requireRole";
import { Role, Prisma } from "@/generated/prisma/client";

// Server actions del panel de administración (Administrador): crear/editar
// vehículos. Ningún vehículo se borra (mismo principio de inmutabilidad que
// el resto del sistema) — se desactiva con `activo`.

function esErrorPlacaDuplicada(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function crearVehiculo(data: {
  placa: string;
  tipo: string;
  fechaVencimientoTecnicomecanica?: Date;
}) {
  const session = await requireRole([Role.ADMINISTRADOR]);

  const placaLimpia = data.placa.trim().toUpperCase();
  const tipoLimpio = data.tipo.trim();
  if (!placaLimpia || !tipoLimpio) {
    throw new Error("Placa y tipo son obligatorios.");
  }

  let vehiculo;
  try {
    vehiculo = await prisma.vehicle.create({
      data: {
        placa: placaLimpia,
        tipo: tipoLimpio,
        fechaVencimientoTecnicomecanica: data.fechaVencimientoTecnicomecanica ?? null,
      },
    });
  } catch (err) {
    if (esErrorPlacaDuplicada(err)) {
      throw new Error("Ya existe un vehículo con esa placa.");
    }
    throw err;
  }

  await logAudit({
    userId: session.user.id,
    action: "CREAR_VEHICULO",
    entityType: "Vehicle",
    entityId: vehiculo.id,
    metadata: { placa: vehiculo.placa },
  });

  return vehiculo;
}

export async function actualizarVehiculo(
  vehicleId: string,
  data: {
    placa: string;
    tipo: string;
    activo: boolean;
    fechaVencimientoTecnicomecanica?: Date | null;
  },
) {
  const session = await requireRole([Role.ADMINISTRADOR]);

  const placaLimpia = data.placa.trim().toUpperCase();
  const tipoLimpio = data.tipo.trim();
  if (!placaLimpia || !tipoLimpio) {
    throw new Error("Placa y tipo son obligatorios.");
  }

  let vehiculo;
  try {
    vehiculo = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        placa: placaLimpia,
        tipo: tipoLimpio,
        activo: data.activo,
        fechaVencimientoTecnicomecanica: data.fechaVencimientoTecnicomecanica ?? null,
      },
    });
  } catch (err) {
    if (esErrorPlacaDuplicada(err)) {
      throw new Error("Ya existe un vehículo con esa placa.");
    }
    throw err;
  }

  await logAudit({
    userId: session.user.id,
    action: "ACTUALIZAR_VEHICULO",
    entityType: "Vehicle",
    entityId: vehicleId,
    metadata: { placa: vehiculo.placa, activo: data.activo },
  });

  return vehiculo;
}
