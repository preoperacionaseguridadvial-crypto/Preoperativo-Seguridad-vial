// Helpers puros del módulo SST "Inspecciones fuera de horario": conversión de
// fecha + hora locales de Bogotá a instante UTC y estado de una habilitación.
// Bogotá es UTC-5 todo el año (sin horario de verano).

const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_HORA = /^(\d{2}):(\d{2})$/;

export type EstadoHabilitacion = "VIGENTE" | "PROGRAMADA" | "FINALIZADA";

/**
 * "2026-10-21" + "05:45" (hora de Bogotá) -> instante UTC. `null` si el formato
 * o el calendario no son válidos (p. ej. 30 de febrero, 24:00).
 */
export function instanteBogota(fecha: string, hora: string): Date | null {
  const f = FORMATO_FECHA.exec(fecha);
  const h = FORMATO_HORA.exec(hora);
  if (!f || !h) return null;
  const [anio, mes, dia] = [Number(f[1]), Number(f[2]), Number(f[3])];
  const [horas, minutos] = [Number(h[1]), Number(h[2])];
  if (horas > 23 || minutos > 59) return null;

  const utc = Date.UTC(anio, mes - 1, dia, horas, minutos);
  const comprobacion = new Date(utc);
  // Date.UTC desborda (30 feb -> 2 mar): se descarta si el día cambió.
  if (comprobacion.getUTCMonth() !== mes - 1 || comprobacion.getUTCDate() !== dia) return null;
  return new Date(utc + OFFSET_BOGOTA_MS);
}

/** `desde` incluido, `hasta` excluido: misma semántica que `habilitacionVigente`. */
export function estadoHabilitacion(
  habilitacion: { desde: Date; hasta: Date },
  ahora: Date,
): EstadoHabilitacion {
  if (ahora < habilitacion.desde) return "PROGRAMADA";
  if (ahora < habilitacion.hasta) return "VIGENTE";
  return "FINALIZADA";
}
