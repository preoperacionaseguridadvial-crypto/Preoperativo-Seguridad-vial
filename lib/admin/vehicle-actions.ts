"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/requireRole";
import { Role, Prisma, TipoVehiculo } from "@/generated/prisma/client";
import { uploadObject } from "@/lib/storage/s3";

// Server actions del panel de administración (Administrador): crear/editar
// vehículos. Ningún vehículo se borra (mismo principio de inmutabilidad que
// el resto del sistema) — se desactiva con `activo`.

function esErrorPlacaDuplicada(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Sube la foto de la hoja de vida a S3/MinIO (mismo patrón que
 * `subirFotoNovedad`, lib/inspections/actions.ts:268 — solo se guarda el
 * `s3Key`, nunca una URL pública permanente) y devuelve el key generado.
 */
async function subirFotoVehiculo(placa: string, foto: File): Promise<string> {
  const buffer = Buffer.from(await foto.arrayBuffer());
  const extension = foto.name.includes(".") ? foto.name.split(".").pop() : "jpg";
  const key = `vehiculos/${placa}/${randomUUID()}.${extension}`;
  await uploadObject({ key, body: buffer, contentType: foto.type || "image/jpeg" });
  return key;
}

/**
 * Valida los campos obligatorios de la hoja de vida (spec: vehicle-profile
 * — foto + marca/modelo/color/motor/chasis). Se captura al dar de alta el
 * vehículo (SST/Administrador); `actualizarVehiculo` deja estos campos
 * editables sin volver a exigir la foto (ya existe una).
 */
function validarHojaDeVida(data: {
  tipoVehiculo?: TipoVehiculo;
  marca?: string;
  modelo?: string;
  color?: string;
  numeroMotor?: string;
  numeroChasis?: string;
}) {
  if (!data.tipoVehiculo) {
    throw new Error("El tipo de vehículo es obligatorio.");
  }
  if (!data.marca?.trim()) {
    throw new Error("La marca es obligatoria.");
  }
  if (!data.modelo?.trim()) {
    throw new Error("El modelo es obligatorio.");
  }
  if (!data.color?.trim()) {
    throw new Error("El color es obligatorio.");
  }
  if (!data.numeroMotor?.trim()) {
    throw new Error("El número de motor es obligatorio.");
  }
  if (!data.numeroChasis?.trim()) {
    throw new Error("El número de chasis es obligatorio.");
  }
}

export async function crearVehiculo(data: {
  placa: string;
  tipo: string;
  tipoVehiculo?: TipoVehiculo;
  foto?: File;
  marca?: string;
  modelo?: string;
  color?: string;
  numeroMotor?: string;
  numeroChasis?: string;
  fechaVencimientoSoat?: Date;
  fechaVencimientoTarjetaTransito?: Date;
  fechaVencimientoTecnicomecanica?: Date;
}) {
  const session = await requireRole([Role.ADMINISTRADOR]);

  const placaLimpia = data.placa.trim().toUpperCase();
  const tipoLimpio = data.tipo.trim();
  if (!placaLimpia || !tipoLimpio) {
    throw new Error("Placa y tipo son obligatorios.");
  }

  if (!data.foto || data.foto.size === 0) {
    throw new Error("La foto del vehículo es obligatoria.");
  }
  validarHojaDeVida(data);

  const fotoS3Key = await subirFotoVehiculo(placaLimpia, data.foto);

  let vehiculo;
  try {
    vehiculo = await prisma.vehicle.create({
      data: {
        placa: placaLimpia,
        tipo: tipoLimpio,
        tipoVehiculo: data.tipoVehiculo,
        fotoS3Key,
        marca: data.marca?.trim(),
        modelo: data.modelo?.trim(),
        color: data.color?.trim(),
        numeroMotor: data.numeroMotor?.trim(),
        numeroChasis: data.numeroChasis?.trim(),
        fechaVencimientoSoat: data.fechaVencimientoSoat ?? null,
        fechaVencimientoTarjetaTransito: data.fechaVencimientoTarjetaTransito ?? null,
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
    tipoVehiculo?: TipoVehiculo;
    foto?: File;
    marca?: string;
    modelo?: string;
    color?: string;
    numeroMotor?: string;
    numeroChasis?: string;
    fechaVencimientoSoat?: Date | null;
    fechaVencimientoTarjetaTransito?: Date | null;
    fechaVencimientoTecnicomecanica?: Date | null;
  },
) {
  const session = await requireRole([Role.ADMINISTRADOR]);

  const placaLimpia = data.placa.trim().toUpperCase();
  const tipoLimpio = data.tipo.trim();
  if (!placaLimpia || !tipoLimpio) {
    throw new Error("Placa y tipo son obligatorios.");
  }

  // La hoja de vida ya existe desde el alta: acá se puede editar (incluida
  // la foto, si se sube una nueva) pero NO se vuelve a exigir — a
  // diferencia de `crearVehiculo`, que sí la requiere.
  validarHojaDeVida(data);
  const fotoS3Key =
    data.foto && data.foto.size > 0 ? await subirFotoVehiculo(placaLimpia, data.foto) : undefined;

  let vehiculo;
  try {
    vehiculo = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        placa: placaLimpia,
        tipo: tipoLimpio,
        activo: data.activo,
        tipoVehiculo: data.tipoVehiculo,
        ...(fotoS3Key ? { fotoS3Key } : {}),
        marca: data.marca?.trim(),
        modelo: data.modelo?.trim(),
        color: data.color?.trim(),
        numeroMotor: data.numeroMotor?.trim(),
        numeroChasis: data.numeroChasis?.trim(),
        fechaVencimientoSoat: data.fechaVencimientoSoat ?? null,
        fechaVencimientoTarjetaTransito: data.fechaVencimientoTarjetaTransito ?? null,
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
