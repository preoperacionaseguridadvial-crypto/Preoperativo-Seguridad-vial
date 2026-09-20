// Compresión de fotos en el navegador antes de subirlas. Módulo puro: sin
// "use server", sin "server-only" y sin tocar `window`/`document` al importarse.
// Toda la lógica de decisión (cuándo dejar pasar el original, cuánto reducir,
// cuándo caer al original) vive acá y se prueba en Node; las piezas propias del
// navegador (decodificar con createImageBitmap y codificar con canvas.toBlob)
// se INYECTAN — la implementación real está en `adaptador-navegador.ts`.
//
// Por qué: una foto de cámara de teléfono pesa 3–12 MB; el servidor
// (lib/storage/validar-archivo.ts) topa las fotos en 8 MB, solo acepta
// JPEG/PNG/WebP y el límite global de server actions es 10 MB. Reducir el lado
// largo a 1920 px y recodificar a JPEG deja cada foto en unos cientos de KB.
// Recodificar además elimina los metadatos EXIF/GPS de la foto original (la
// ubicación del trabajador no viaja al servidor). Cuando se deja pasar el
// original sin recodificar (foto ya pequeña) esos metadatos sí se conservan.

/** Lado largo máximo (px) de la foto enviada; nunca se amplía. */
export const MAX_LADO_PX = 1920;
/** Calidad de recodificación JPEG (0–1). */
export const CALIDAD_JPEG = 0.8;
/**
 * Peso máximo (bytes) por debajo del cual, si además el tipo es soportado y
 * está dentro de `MAX_LADO_PX`, se envía el original sin tocar.
 */
export const UMBRAL_CONSERVAR_BYTES = 1024 * 1024;

const TIPOS_SOPORTADOS: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
const NOMBRE_POR_DEFECTO = "foto";

function normalizarTipo(tipo: string): string {
  return tipo.split(";")[0].trim().toLowerCase();
}

/** ¿El servidor acepta este tipo de imagen tal cual (JPEG/PNG/WebP)? */
export function esTipoSoportado(tipo: string): boolean {
  return TIPOS_SOPORTADOS.includes(normalizarTipo(tipo));
}

/**
 * Dimensiones de salida: el lado largo queda en `maxLado` como máximo,
 * conservando la proporción, redondeado a enteros, sin ampliar y con un
 * mínimo de 1 px por lado. Lanza si las dimensiones o el límite no son
 * números positivos finitos.
 */
export function calcularDimensionesDestino(
  ancho: number,
  alto: number,
  maxLado: number,
): { ancho: number; alto: number } {
  const validas = [ancho, alto, maxLado].every((n) => Number.isFinite(n) && n > 0);
  if (!validas) {
    throw new RangeError(`Dimensiones inválidas: ${ancho}x${alto} (máximo ${maxLado}).`);
  }
  const ladoLargo = Math.max(ancho, alto);
  if (ladoLargo <= maxLado) {
    return { ancho: Math.max(1, Math.round(ancho)), alto: Math.max(1, Math.round(alto)) };
  }
  const escala = maxLado / ladoLargo;
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/**
 * Regla de pass-through: se envía el original sin recodificar solo si es un
 * tipo que el servidor acepta, pesa `umbralBytes` o menos y su lado largo está
 * dentro de `maxLado`. Un HEIC (o tipo vacío) nunca se conserva: el servidor lo
 * rechazaría.
 */
export function debeConservarOriginal(
  datos: { tipo: string; bytes: number; ancho: number; alto: number },
  limites: { umbralBytes?: number; maxLado?: number } = {},
): boolean {
  const { umbralBytes = UMBRAL_CONSERVAR_BYTES, maxLado = MAX_LADO_PX } = limites;
  return (
    esTipoSoportado(datos.tipo) &&
    datos.bytes <= umbralBytes &&
    Math.max(datos.ancho, datos.alto) <= maxLado
  );
}

/**
 * Nombre del archivo recodificado: reemplaza la última extensión por `.jpg`
 * (o la agrega). Un nombre vacío o sin base ("", ".png") pasa a "foto.jpg".
 */
export function nombreJpeg(nombreOriginal: string): string {
  const nombre = nombreOriginal.trim();
  const punto = nombre.lastIndexOf(".");
  const base = punto === -1 ? nombre : nombre.slice(0, punto);
  return `${base || NOMBRE_POR_DEFECTO}.jpg`;
}

/** Imagen ya decodificada (con la orientación EXIF aplicada), lista para dibujar. */
export type ImagenDecodificada<TFuente = unknown> = {
  ancho: number;
  alto: number;
  /** Lo que el codificador sabe dibujar (ImageBitmap, HTMLImageElement, un fake…). */
  fuente: TFuente;
  /** Libera memoria de la imagen (p. ej. `ImageBitmap.close()`). */
  liberar?: () => void;
};

/** Piezas dependientes del navegador, inyectadas para poder probar la lógica en Node. */
export type DependenciasCompresion<TFuente = unknown> = {
  decodificar: (file: File) => Promise<ImagenDecodificada<TFuente>>;
  /** Devuelve el JPEG ya escalado a `ancho`x`alto`, o `null` si el navegador no pudo. */
  codificarJpeg: (
    imagen: ImagenDecodificada<TFuente>,
    ancho: number,
    alto: number,
    calidad: number,
  ) => Promise<Blob | null>;
};

function liberarSinFallar(imagen: ImagenDecodificada<unknown>): void {
  try {
    imagen.liberar?.();
  } catch {
    // Liberar memoria es best-effort: nunca debe invalidar el resultado.
  }
}

/**
 * Devuelve el `File` que conviene subir: la foto recomprimida a JPEG, o el
 * MISMO `file` original (misma referencia) cuando no hace falta o no se pudo
 * comprimir. Nunca lanza: ante cualquier fallo (decodificación, canvas,
 * `toBlob` nulo, HEIC que el navegador no lee) se devuelve el original y el
 * servidor decide con su propia validación en español.
 */
export async function comprimirImagen<TFuente>(
  file: File,
  deps: DependenciasCompresion<TFuente>,
): Promise<File> {
  let imagen: ImagenDecodificada<TFuente>;
  try {
    imagen = await deps.decodificar(file);
  } catch {
    return file;
  }

  try {
    const destino = calcularDimensionesDestino(imagen.ancho, imagen.alto, MAX_LADO_PX);
    if (
      debeConservarOriginal({ tipo: file.type, bytes: file.size, ancho: imagen.ancho, alto: imagen.alto })
    ) {
      return file;
    }

    const blob = await deps.codificarJpeg(imagen, destino.ancho, destino.alto, CALIDAD_JPEG);
    if (!blob) return file;

    // Si recomprimir no ayudó, se envía el original — salvo que el original sea
    // de un tipo que el servidor rechaza (HEIC): ahí el JPEG es la única opción
    // válida aunque pese más.
    if (esTipoSoportado(file.type) && blob.size >= file.size) return file;

    return new File([blob], nombreJpeg(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    liberarSinFallar(imagen);
  }
}
