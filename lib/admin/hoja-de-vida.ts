import { randomUUID } from "node:crypto";
import { TipoVehiculo } from "@/generated/prisma/client";
import { uploadObject, deleteObject } from "@/lib/storage/s3";
import { MAX_FOTO_BYTES } from "@/lib/admin/foto-vehiculo";

// Piezas compartidas de la hoja de vida del vehículo de un trabajador: foto
// (S3/MinIO), validación de los campos obligatorios y lectura desde un
// FormData. Vivían en `vehicle-actions.ts` cuando había un módulo de
// vehículos aparte; desde que el vehículo se crea/edita junto con su usuario
// (lib/admin/user-actions.ts) son la única fuente de estas reglas. Sin
// "use server": exporta constantes y funciones sincrónicas, no server actions.

export { MAX_FOTO_BYTES };

// Allow-list de tipos MIME aceptados para la foto del vehículo (a diferencia
// de `subirFotoNovedad`, lib/inspections/actions.ts, acá nunca se admite un
// PDF — siempre es una foto). La extensión del key de S3 se deriva de este
// MIME ya validado, nunca del nombre de archivo que manda el cliente
// (`foto.name`), para no construir una key con datos no confiables.
const EXTENSION_POR_MIME_VEHICULO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Descripción libre de `Vehicle.tipo` (columna NOT NULL heredada) derivada
 * del único select de tipo de vehículo del formulario, para no pedirlo dos
 * veces. Mismos valores que usa el seed.
 */
export const TIPO_DESCRIPTIVO: Record<TipoVehiculo, string> = {
  MOTO: "Motocicleta",
  CARRO: "Automóvil",
};

/** Datos del vehículo del trabajador tal como llegan del formulario. */
export type DatosVehiculo = {
  placa?: string;
  foto?: File;
  marca?: string;
  modelo?: string;
  color?: string;
  fechaVencimientoSoat?: Date | null;
  fechaVencimientoTecnicomecanica?: Date | null;
};

export const normalizarPlaca = (placa?: string | null) => placa?.trim().toUpperCase() ?? "";

/** `true` si el formulario trae ALGÚN dato del vehículo (no todo vacío). */
export function hayDatosDeVehiculo(vehiculo?: DatosVehiculo): boolean {
  if (!vehiculo) return false;
  const textos = [vehiculo.placa, vehiculo.marca, vehiculo.modelo, vehiculo.color];
  const fechas = [vehiculo.fechaVencimientoSoat, vehiculo.fechaVencimientoTecnicomecanica];
  return (
    textos.some((valor) => valor?.trim()) ||
    fechas.some(Boolean) ||
    Boolean(vehiculo.foto && vehiculo.foto.size > 0)
  );
}

/** Valida tipo MIME (solo imágenes) y tamaño, antes de subir nada a S3. */
export function validarFotoVehiculo(foto: File): void {
  if (!EXTENSION_POR_MIME_VEHICULO[foto.type]) {
    throw new Error("La foto debe ser una imagen (JPG, PNG o WEBP).");
  }
  if (foto.size > MAX_FOTO_BYTES) {
    throw new Error(`La foto no puede superar ${MAX_FOTO_BYTES / (1024 * 1024)} MB.`);
  }
}

/**
 * Sube la foto de la hoja de vida a S3/MinIO (mismo patrón que
 * `subirFotoNovedad`, lib/inspections/actions.ts — solo se guarda el
 * `s3Key`, nunca una URL pública permanente) y devuelve el key generado.
 *
 * `placa` se sanea a alfanumérico + guion antes de usarse en la key: ya llega
 * `.trim().toUpperCase()`'da desde el caller, pero no filtrada de `/` ni
 * `..`, y una placa maliciosa no debería poder escapar el prefijo
 * `vehiculos/<placa>/` del bucket compartido.
 */
export async function subirFotoVehiculo(placa: string, foto: File): Promise<string> {
  validarFotoVehiculo(foto);
  const extension = EXTENSION_POR_MIME_VEHICULO[foto.type];
  const placaSegura = placa.replace(/[^A-Za-z0-9-]/g, "");
  const buffer = Buffer.from(await foto.arrayBuffer());
  const key = `vehiculos/${placaSegura}/${randomUUID()}.${extension}`;
  await uploadObject({ key, body: buffer, contentType: foto.type });
  return key;
}

/**
 * Acción compensatoria: la foto se sube a S3 ANTES de escribir en la base, así
 * que si la escritura falla el objeto queda huérfano. Se borra en best-effort;
 * si el borrado también falla solo se registra, para no enmascarar el error
 * original de la escritura.
 */
export async function borrarFotoHuerfana(fotoS3Key: string, contexto: string): Promise<void> {
  await deleteObject(fotoS3Key).catch((cleanupErr) => {
    console.error(`No se pudo borrar la foto huérfana de S3 tras un error al ${contexto}.`, {
      fotoS3Key,
      cleanupErr,
    });
  });
}

/**
 * Valida los campos obligatorios de la hoja de vida: tipo, marca, modelo y
 * color. El alta del trabajador los exige junto con la foto; la edición los
 * deja editables sin volver a exigir la foto.
 */
export function validarHojaDeVida(data: {
  tipoVehiculo?: TipoVehiculo | null;
  marca?: string;
  modelo?: string;
  color?: string;
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
}

/**
 * Indica si un vehículo YA tenía la hoja de vida completa (mismos campos que
 * exige `validarHojaDeVida`, sin `tipoVehiculo`, que quedó backfilleado a
 * MOTO). Vehículos anteriores a la migración de hoja de vida no tienen
 * marca/modelo/color — no se les exige completarlos retroactivamente solo por
 * editarlos (regla D4: nullable-first / validación en la capa de server
 * action, nunca bloqueo de datos legacy).
 */
export function tieneHojaDeVidaCompleta(vehiculo: {
  marca: string | null;
  modelo: string | null;
  color: string | null;
}): boolean {
  return Boolean(vehiculo.marca?.trim() && vehiculo.modelo?.trim() && vehiculo.color?.trim());
}

/**
 * `true` si se está intentando cargar CUALQUIER campo obligatorio de la hoja
 * de vida (marca, modelo, color).
 */
export function intentaCargarHojaDeVida(vehiculo?: DatosVehiculo): boolean {
  return [vehiculo?.marca, vehiculo?.modelo, vehiculo?.color].some((valor) => valor?.trim());
}

function leerFecha(formData: FormData, campo: string): Date | null {
  const crudo = formData.get(campo)?.toString();
  if (!crudo) return null;
  const fecha = new Date(crudo);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Arma los datos del vehículo a partir de los campos del formulario de usuario. */
export function leerVehiculoDeFormulario(formData: FormData): DatosVehiculo {
  const texto = (campo: string) => formData.get(campo)?.toString() ?? "";
  const foto = formData.get("foto");
  return {
    placa: texto("placa"),
    foto: foto instanceof File && foto.size > 0 ? foto : undefined,
    marca: texto("marca"),
    modelo: texto("modelo"),
    color: texto("color"),
    fechaVencimientoSoat: leerFecha(formData, "fechaVencimientoSoat"),
    fechaVencimientoTecnicomecanica: leerFecha(formData, "fechaVencimientoTecnicomecanica"),
  };
}
