// Estado de un vencimiento de documento (SOAT, tecnomecánica) para la hoja
// de vida del usuario. "Vencido" usa el mismo
// criterio que el dashboard (`getDashboardMetrics`,
// lib/inspections/supervisor-queries.ts: fecha < ahora, contra la hora del
// servidor). No existía un umbral de "por vencer": `DIAS_POR_VENCER` es una
// decisión nueva de esta pantalla, en un solo lugar para ajustarla.

export type EstadoVencimiento = "SIN_FECHA" | "VIGENTE" | "POR_VENCER" | "VENCIDO";

export const DIAS_POR_VENCER = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function estadoVencimiento(
  fecha: Date | null | undefined,
  ahora: Date = new Date(),
): EstadoVencimiento {
  if (!fecha) return "SIN_FECHA";
  const diferencia = fecha.getTime() - ahora.getTime();
  if (diferencia < 0) return "VENCIDO";
  if (diferencia <= DIAS_POR_VENCER * MS_POR_DIA) return "POR_VENCER";
  return "VIGENTE";
}
