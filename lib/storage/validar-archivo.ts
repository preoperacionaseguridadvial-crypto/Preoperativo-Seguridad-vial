// Validación compartida de archivos subidos por el usuario (fotos de
// inspección, firma, adjuntos de novedad) antes de mandarlos a S3/MinIO.
// Módulo puro, sin "use server" ni "server-only": lo importan varias server
// actions y los tests.
//
// El navegador controla `file.type` y `file.name`, así que ninguno de los dos
// es confiable. La validación se apoya en tres cosas: una lista blanca de
// tipos MIME por uso, un tope de tamaño por uso y los "magic bytes" del
// contenido real (la firma del formato). El `contentType` y la extensión de la
// key en S3 se derivan del tipo YA validado, nunca de `file.name`.
//
// Límite global: `experimental.serverActions.bodySizeLimit` (next.config.ts,
// 10 MB) acota el cuerpo completo de la request; los topes de acá son por
// archivo y quedan por debajo de ese techo.

const MB = 1024 * 1024;

/** Tope de las fotos diarias de inspección (LATERAL/PLACA). */
export const MAX_FOTO_INSPECCION_BYTES = 8 * MB;
/** Tope de la firma manuscrita (un PNG de canvas pesa pocos KB). */
export const MAX_FIRMA_BYTES = 1 * MB;
/** Tope del adjunto de una novedad (foto o PDF). */
export const MAX_ADJUNTO_NOVEDAD_BYTES = 8 * MB;

type FormatoArchivo = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const EXTENSION_POR_FORMATO: Record<FormatoArchivo, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Firma real del contenido de cada formato.
const COINCIDE_CON_FORMATO: Record<FormatoArchivo, (bytes: Uint8Array) => boolean> = {
  // FF D8 FF
  "image/jpeg": (bytes) => empiezaCon(bytes, [0xff, 0xd8, 0xff]),
  // 89 50 4E 47 0D 0A 1A 0A
  "image/png": (bytes) => empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  // "RIFF" <4 bytes de tamaño> "WEBP"
  "image/webp": (bytes) =>
    empiezaCon(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    empiezaCon(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50]),
  // "%PDF-"
  "application/pdf": (bytes) => empiezaCon(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
};

function empiezaCon(bytes: Uint8Array, firma: readonly number[]): boolean {
  return bytes.length >= firma.length && firma.every((byte, i) => bytes[i] === byte);
}

/** Reglas de un uso concreto: qué formatos acepta, cuánto pesa y cómo se le avisa al usuario. */
export type PerfilArchivo = {
  formatosPermitidos: readonly FormatoArchivo[];
  maxBytes: number;
  /** Sujeto del mensaje de tamaño ("La foto no puede superar 8 MB."). */
  sujeto: string;
  /** Mensaje cuando el tipo declarado no está en la lista blanca. */
  mensajeTipoNoPermitido: string;
};

export const PERFIL_FOTO_INSPECCION: PerfilArchivo = {
  formatosPermitidos: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: MAX_FOTO_INSPECCION_BYTES,
  sujeto: "La foto",
  mensajeTipoNoPermitido: "La foto debe ser una imagen JPG, PNG o WEBP.",
};

export const PERFIL_FIRMA: PerfilArchivo = {
  formatosPermitidos: ["image/png"],
  maxBytes: MAX_FIRMA_BYTES,
  sujeto: "La firma",
  mensajeTipoNoPermitido: "La firma debe ser una imagen PNG.",
};

export const PERFIL_ADJUNTO_NOVEDAD: PerfilArchivo = {
  formatosPermitidos: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  maxBytes: MAX_ADJUNTO_NOVEDAD_BYTES,
  sujeto: "El archivo",
  mensajeTipoNoPermitido: "El archivo debe ser una imagen (JPG, PNG o WEBP) o un PDF.",
};

export type ArchivoValidado = {
  buffer: Buffer;
  /** Tipo validado (nunca el declarado por el cliente sin verificar). */
  contentType: FormatoArchivo;
  /** Extensión sin punto derivada de `contentType`. */
  extension: string;
};

function normalizarTipo(tipo: string): string {
  return tipo.split(";")[0].trim().toLowerCase();
}

/**
 * Valida tipo declarado (lista blanca), tamaño y contenido real (magic bytes)
 * de `file` contra `perfil`, en ese orden — el tamaño se comprueba antes de
 * leer el archivo a memoria. Devuelve el contenido ya leído junto con el
 * `contentType` y la extensión derivados del tipo validado. Lanza `Error` con
 * un mensaje en español apto para mostrar al usuario.
 */
export async function validarArchivo(file: File, perfil: PerfilArchivo): Promise<ArchivoValidado> {
  const declarado = normalizarTipo(file.type);
  const formato = perfil.formatosPermitidos.find((permitido) => permitido === declarado);
  if (!formato) {
    throw new Error(perfil.mensajeTipoNoPermitido);
  }

  if (file.size > perfil.maxBytes) {
    throw new Error(`${perfil.sujeto} no puede superar ${perfil.maxBytes / MB} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!COINCIDE_CON_FORMATO[formato](buffer)) {
    throw new Error("El contenido del archivo no corresponde al tipo indicado: sube un archivo válido.");
  }

  return { buffer, contentType: formato, extension: EXTENSION_POR_FORMATO[formato] };
}
