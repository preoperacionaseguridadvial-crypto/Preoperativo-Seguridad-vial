// Bogotá está en UTC-5 todo el año (Colombia no usa horario de verano).
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Rango [desde, hasta] del día calendario de Bogotá que contiene `ahora`.
 * El dashboard agrupa por día UTC (que cambia a las 7 p. m. en Colombia);
 * para "hoy" en el inicio se usa el día local, que es el que la gente espera.
 */
export function rangoDiaBogota(ahora: Date): { desde: Date; hasta: Date } {
  const local = new Date(ahora.getTime() - OFFSET_BOGOTA_MS);
  const desde = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + OFFSET_BOGOTA_MS,
  );
  return { desde, hasta: new Date(desde.getTime() + MS_POR_DIA - 1) };
}
