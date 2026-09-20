// Adaptador de navegador para `comprimirImagen` (compresion-cliente.ts):
// decodificación con createImageBitmap (o <img> como respaldo) y recodificación
// con canvas.toBlob.
//
// ATENCIÓN: esto NO se puede ejercitar en Node (no hay DOM ni canvas en el
// entorno de Vitest) y por eso no tiene pruebas automáticas. Hay que verificarlo
// a mano en un teléfono real: prompt de permiso de cámara, orientación EXIF,
// HEIC en iOS, y límites de memoria del canvas en equipos de gama baja. Toda la
// lógica de decisión sí está cubierta en compresion-cliente.test.ts.
//
// Solo se llama en runtime desde el navegador (handler de `change`); nada de
// acá toca `window`/`document` al importarse.

import {
  comprimirImagen,
  type DependenciasCompresion,
  type ImagenDecodificada,
} from "./compresion-cliente";

type FuenteDibujable = ImageBitmap | HTMLImageElement;

/** Respaldo: decodifica vía <img>; los navegadores modernos aplican la orientación EXIF por defecto. */
function decodificarConImg(file: File): Promise<ImagenDecodificada<FuenteDibujable>> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ ancho: img.naturalWidth, alto: img.naturalHeight, fuente: img });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El navegador no pudo decodificar la imagen."));
    };
    img.src = url;
  });
}

async function decodificar(file: File): Promise<ImagenDecodificada<FuenteDibujable>> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        ancho: bitmap.width,
        alto: bitmap.height,
        fuente: bitmap,
        liberar: () => bitmap.close(),
      };
    } catch {
      // Algunos navegadores no aceptan el segundo argumento o no leen el
      // formato con createImageBitmap: se intenta por <img>.
    }
  }
  return decodificarConImg(file);
}

async function codificarJpeg(
  imagen: ImagenDecodificada<FuenteDibujable>,
  ancho: number,
  alto: number,
  calidad: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  try {
    const contexto = canvas.getContext("2d");
    if (!contexto) return null;
    // Fondo blanco: JPEG no tiene transparencia (un PNG con alfa quedaría negro).
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, ancho, alto);
    contexto.imageSmoothingQuality = "high";
    contexto.drawImage(imagen.fuente, 0, 0, ancho, alto);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", calidad);
    });
  } finally {
    // Suelta el buffer del canvas cuanto antes (importante en equipos de poca RAM).
    canvas.width = 0;
    canvas.height = 0;
  }
}

const dependenciasNavegador: DependenciasCompresion<FuenteDibujable> = {
  decodificar,
  codificarJpeg,
};

/** Comprime `file` con las APIs reales del navegador. Nunca lanza (ver `comprimirImagen`). */
export function comprimirFotoEnNavegador(file: File): Promise<File> {
  return comprimirImagen(file, dependenciasNavegador);
}
