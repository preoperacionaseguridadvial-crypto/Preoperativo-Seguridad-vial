// Lógica pura detrás de las tarjetas KPI y las barras de ranking del
// dashboard. Sin React ni Prisma: se prueba directo (metricas.test.ts).

/** Proporción `parte / total` en %, con un decimal (misma convención que `tasaAprobacion`). 0 si el total es 0. */
export function porcentaje(parte: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

/** "25%" / "66.7%" — el número JS ya omite el decimal cuando es entero. */
export function formatoPorcentaje(valor: number): string {
  return `${valor}%`;
}

export type DireccionVariacion = "sube" | "baja" | "igual";

/**
 * Variación relativa contra el período anterior. `null` cuando ambos valen 0
 * (no hay nada que comparar). Regla histórica del dashboard, conservada: con
 * período anterior en 0 y actual > 0 la variación se reporta como 100%. El
 * porcentaje es siempre absoluto; el signo lo lleva `direccion`.
 */
export function variacion(actual: number, anterior: number): { porcentaje: number; direccion: DireccionVariacion } | null {
  if (anterior === 0 && actual === 0) return null;
  const relativa = anterior === 0 ? 100 : Math.round(((actual - anterior) / anterior) * 1000) / 10;
  const direccion: DireccionVariacion = relativa > 0 ? "sube" : relativa < 0 ? "baja" : "igual";
  return { porcentaje: Math.abs(relativa), direccion };
}

export type TonoVariacion = "bueno" | "malo" | "neutro";

/**
 * `invertido`: métricas donde un valor más alto es peor (Rechazadas, Con
 * novedades) — el tono se invierte, pero la flecha siempre refleja la
 * dirección real del número.
 */
export function tonoVariacion(direccion: DireccionVariacion, invertido: boolean): TonoVariacion {
  if (direccion === "igual") return "neutro";
  const mejora = invertido ? direccion === "baja" : direccion === "sube";
  return mejora ? "bueno" : "malo";
}

/** Geometría de un anillo de progreso SVG: `stroke-dasharray = "arco resto"`. */
export function geometriaAnillo(fraccion: number, radio: number): { circunferencia: number; arco: number; resto: number } {
  const circunferencia = 2 * Math.PI * radio;
  const acotada = Number.isFinite(fraccion) ? Math.min(1, Math.max(0, fraccion)) : 0;
  const arco = circunferencia * acotada;
  return { circunferencia, arco, resto: circunferencia - arco };
}

export type TonoSeveridad = "critico" | "serio" | "atencion" | "bajo";

/**
 * Tono de una barra de ranking según su proporción respecto del máximo del
 * ranking (no según su posición): dos barras con el mismo valor reciben el
 * mismo color. El número siempre se muestra al lado — el color es un
 * refuerzo, nunca el único canal.
 */
export function tonoSeveridad(valor: number, maximo: number): TonoSeveridad {
  if (maximo <= 0) return "bajo";
  const proporcion = valor / maximo;
  if (proporcion >= 0.75) return "critico";
  if (proporcion >= 0.5) return "serio";
  if (proporcion >= 0.25) return "atencion";
  return "bajo";
}
