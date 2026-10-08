// Recorte de la firma al área realmente dibujada (lógica pura, sin canvas).
//
// Por qué: el lienzo de firma es alto para que sea cómodo firmar con el dedo
// en el celular, pero el PDF muestra la firma en una caja baja con
// `objectFit: "contain"` (lib/pdf/InspeccionPdfDocument.tsx). Exportar el
// lienzo completo dejaría mucho espacio vacío arriba/abajo y la firma saldría
// diminuta en el PDF; recortando al trazo (+ margen) la firma ocupa la caja.

export type Punto = { x: number; y: number };
export type Limites = { minX: number; minY: number; maxX: number; maxY: number };
export type Area = { x: number; y: number; ancho: number; alto: number };

/** Amplía los límites acumulados del trazo para incluir `punto`. */
export function ampliarLimites(limites: Limites | null, punto: Punto): Limites {
  if (!limites) {
    return { minX: punto.x, minY: punto.y, maxX: punto.x, maxY: punto.y };
  }
  return {
    minX: Math.min(limites.minX, punto.x),
    minY: Math.min(limites.minY, punto.y),
    maxX: Math.max(limites.maxX, punto.x),
    maxY: Math.max(limites.maxY, punto.y),
  };
}

/**
 * Área a exportar: los límites del trazo más `margen` px por lado, recortada
 * a los bordes del lienzo, en enteros y nunca menor a 1x1. Sin límites (no se
 * dibujó nada) devuelve el lienzo completo.
 */
export function areaDeRecorte(
  limites: Limites | null,
  lienzo: { ancho: number; alto: number },
  margen: number,
): Area {
  if (!limites) {
    return { x: 0, y: 0, ancho: lienzo.ancho, alto: lienzo.alto };
  }
  const x = Math.max(0, Math.floor(limites.minX - margen));
  const y = Math.max(0, Math.floor(limites.minY - margen));
  const derecha = Math.min(lienzo.ancho, Math.ceil(limites.maxX + margen));
  const abajo = Math.min(lienzo.alto, Math.ceil(limites.maxY + margen));
  return { x, y, ancho: Math.max(1, derecha - x), alto: Math.max(1, abajo - y) };
}
