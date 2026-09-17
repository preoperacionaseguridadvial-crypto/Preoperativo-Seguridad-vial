"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/requireRole";
import { Role, Prisma, TipoVehiculo } from "@/generated/prisma/client";
import { uploadObject, deleteObject } from "@/lib/storage/s3";

// Server actions del panel de administración (Administrador): crear/editar
// vehículos. Ningún vehículo se borra (mismo principio de inmutabilidad que
// el resto del sistema) — se desactiva con `activo`.

function esErrorPlacaDuplicada(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// Allow-list de tipos MIME aceptados para la foto del vehículo (a
// diferencia de `subirFotoNovedad`, lib/inspections/actions.ts:257, acá
// nunca se admite un PDF — siempre es una foto). La extensión del key de
// S3 se deriva de este MIME ya validado, nunca del nombre de archivo que
// manda el cliente (`foto.name`), para no construir una key con datos no
// confiables (ver fix de sanitización de key más abajo).
const EXTENSION_POR_MIME_VEHICULO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Sube la foto de la hoja de vida a S3/MinIO (mismo patrón que
 * `subirFotoNovedad`, lib/inspections/actions.ts:268 — solo se guarda el
 * `s3Key`, nunca una URL pública permanente) y devuelve el key generado.
 *
 * `placa` se sanea a alfanumérico + guion antes de usarse en la key: ya
 * llega `.trim().toUpperCase()`'da desde el caller, pero no filtrada de
 * `/` ni `..`, y una placa/`foto.name` maliciosos no deberían poder escapar
 * el prefijo `vehiculos/<placa>/` del bucket compartido.
 */
async function subirFotoVehiculo(placa: string, foto: File): Promise<string> {
  const extension = EXTENSION_POR_MIME_VEHICULO[foto.type];
  if (!extension) {
    throw new Error("La foto debe ser una imagen (JPG, PNG o WEBP).");
  }
  const placaSegura = placa.replace(/[^A-Za-z0-9-]/g, "");
  const buffer = Buffer.from(await foto.arrayBuffer());
  const key = `vehiculos/${placaSegura}/${randomUUID()}.${extension}`;
  await uploadObject({ key, body: buffer, contentType: foto.type });
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

/**
 * Indica si un vehículo YA tenía la hoja de vida completa (mismos campos
 * que exige `validarHojaDeVida`, sin `tipoVehiculo` porque ese quedó
 * backfilleado a MOTO para todo vehículo existente en la migración
 * `20260917185725_tipo_vehiculo_hoja_de_vida`). Vehículos dados de alta
 * antes de esa migración no tienen marca/modelo/color/motor/chasis — no se
 * les exige completarlos retroactivamente solo por editarlos o
 * desactivarlos (regla D4: nullable-first / validación en la capa de
 * server action, nunca bloqueo de datos legacy). Mismo patrón que
 * `actualizarUsuario` en lib/admin/user-actions.ts, que solo exige
 * cédula/tipoVehiculo para TRABAJADOR y deja legacy sin tocar.
 */
function tieneHojaDeVidaCompleta(vehiculo: {
  marca: string | null;
  modelo: string | null;
  color: string | null;
  numeroMotor: string | null;
  numeroChasis: string | null;
}): boolean {
  return Boolean(
    vehiculo.marca?.trim() &&
      vehiculo.modelo?.trim() &&
      vehiculo.color?.trim() &&
      vehiculo.numeroMotor?.trim() &&
      vehiculo.numeroChasis?.trim(),
  );
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
    // La foto ya se subió a S3 antes de este `create` — si la escritura en
    // base de datos falla (ej. placa duplicada), el objeto queda huérfano
    // en el bucket. Se borra como acción compensatoria; si ese borrado
    // también falla, se registra pero no se lanza un segundo error (no
    // debe enmascarar la falla original de la escritura).
    await deleteObject(fotoS3Key).catch((cleanupErr) => {
      console.error("No se pudo borrar la foto huérfana de S3 tras un error al crear el vehículo.", {
        fotoS3Key,
        cleanupErr,
      });
    });
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

  const vehiculoActual = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehiculoActual) {
    throw new Error("El vehículo no existe.");
  }

  // La hoja de vida ya existe desde el alta para vehículos dados de alta
  // con ella completa: acá se puede editar (incluida la foto, si se sube
  // una nueva) pero NO se vuelve a exigir. Vehículos legacy (backfill de la
  // migración `20260917185725_tipo_vehiculo_hoja_de_vida`, sin
  // marca/modelo/color/motor/chasis) siguen siendo editables/desactivables
  // sin forzar a completarla en la misma solicitud — pero si el admin
  // intenta cargar CUALQUIERA de esos campos, se exige que quede completa
  // (no se acepta una hoja de vida a medias).
  const intentaCargarHojaDeVida = [
    data.marca,
    data.modelo,
    data.color,
    data.numeroMotor,
    data.numeroChasis,
  ].some((valor) => valor?.trim());
  if (tieneHojaDeVidaCompleta(vehiculoActual) || intentaCargarHojaDeVida) {
    validarHojaDeVida(data);
  }

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
    // Mismo caso que en `crearVehiculo`: si se subió una foto nueva en esta
    // misma solicitud (`fotoS3Key` truthy) y el `update` de Prisma falla
    // después, el objeto queda huérfano en S3 — se borra como acción
    // compensatoria sin enmascarar el error original si el borrado falla.
    if (fotoS3Key) {
      await deleteObject(fotoS3Key).catch((cleanupErr) => {
        console.error(
          "No se pudo borrar la foto huérfana de S3 tras un error al actualizar el vehículo.",
          { fotoS3Key, cleanupErr },
        );
      });
    }
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
