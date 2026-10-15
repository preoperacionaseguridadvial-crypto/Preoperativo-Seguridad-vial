/**
 * Reglas puras del aviso "Instalar aplicación" (AvisoInstalacionPwa.tsx),
 * separadas del componente para poder probarlas sin navegador.
 */

export type Plataforma = "android" | "ios" | "ios-otro-navegador" | "escritorio";

/** Días que el aviso queda oculto después de que el usuario lo cierra. */
export const DIAS_SILENCIO = 7;

export const CLAVE_DESCARTE = "aviso-instalacion-descartado-en";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function detectarPlataforma(userAgent: string): Plataforma {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    // En iOS solo Safari permite "Agregar a inicio"; Chrome (CriOS), Firefox
    // (FxiOS) y Edge (EdgiOS) no ofrecen esa opción en todas las versiones.
    return /CriOS|FxiOS|EdgiOS/i.test(userAgent) ? "ios-otro-navegador" : "ios";
  }
  if (/Android/i.test(userAgent)) return "android";
  return "escritorio";
}

export function debeMostrarAviso({
  plataforma,
  instalada,
  descartadoEn,
  ahora,
}: {
  plataforma: Plataforma;
  instalada: boolean;
  descartadoEn: number | null;
  ahora: number;
}): boolean {
  if (instalada || plataforma === "escritorio") return false;
  if (descartadoEn !== null && ahora - descartadoEn < DIAS_SILENCIO * MS_POR_DIA) return false;
  return true;
}
