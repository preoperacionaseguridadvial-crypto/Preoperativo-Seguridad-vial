// Formato y límites de día en hora de Colombia. Módulo ÚNICO para mostrar
// fechas y horas: sin `server-only`, lo usan componentes de servidor, de
// cliente y el PDF.
//
// Los instantes se guardan en UTC (`now()` del servidor). Si se formatean sin
// `timeZone`, Intl usa la zona del PROCESO: en un servidor en UTC todas las
// horas saldrían 5 h adelantadas. Por eso aquí la zona va SIEMPRE fija. Los
// turnos son rotativos y la hora debe ser exacta, no depende del servidor.

export const ZONA_COLOMBIA = "America/Bogota";
const LOCALE = "es-CO";
const VACIO = "—";

// Bogotá está en UTC-5 todo el año (Colombia no usa horario de verano).
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

type Fecha = Date | null | undefined;

function formateador(opciones: Intl.DateTimeFormatOptions): (fecha: Fecha) => string {
  const intl = new Intl.DateTimeFormat(LOCALE, opciones);
  return (fecha) => (fecha ? intl.format(fecha) : VACIO);
}

const enBogota = (o: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({ ...o, timeZone: ZONA_COLOMBIA });

/** Fecha y hora cortas de Bogotá: "7/10/26, 7:30 p. m.". */
export const formatFechaHora = formateador(enBogota({ dateStyle: "short", timeStyle: "short" }));

/** Fecha (día/mes/año completo) y hora de Bogotá: "7/10/2026, 7:30 p. m.". */
export const formatFechaHoraMedia = formateador(enBogota({ dateStyle: "medium", timeStyle: "short" }));

/** Solo la hora de Bogotá: "7:30 p. m.". */
export const formatHora = formateador(enBogota({ timeStyle: "short" }));

/** Día de Bogotá con año completo: "7/10/2026". */
export const formatFecha = formateador(enBogota({ dateStyle: "medium" }));

/** Día de Bogotá corto: "7/10/26". */
export const formatFechaCorta = formateador(enBogota({ dateStyle: "short" }));

/** Día de Bogotá en palabras: "miércoles, 7 de octubre de 2026". */
export const formatFechaLarga = formateador(enBogota({ dateStyle: "full" }));

/**
 * Campos de solo fecha (vencimiento de SOAT / tecnomecánica): se guardan como
 * día calendario a medianoche UTC (`<input type="date">`), así que se formatean
 * en UTC. En Bogotá saldría el día anterior.
 */
export const formatFechaSoloDia = formateador({ dateStyle: "medium", timeZone: "UTC" });

const intlSoloDiaPartes = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Día calendario (UTC) como "4 oct 2026" (el corto de es-CO mete "de" entre las partes). */
export function formatFechaSoloDiaCompacta(fecha: Fecha): string {
  if (!fecha) return VACIO;
  const partes = intlSoloDiaPartes.formatToParts(fecha);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("day")} ${parte("month").replace(".", "")} ${parte("year")}`;
}

// ---------------------------------------------------------------------------
// Días de Bogotá
// ---------------------------------------------------------------------------

/** Día calendario de Bogotá de un instante, como "2026-10-07". */
export function claveDiaBogota(instante: Date): string {
  return new Date(instante.getTime() - OFFSET_BOGOTA_MS).toISOString().slice(0, 10);
}

/**
 * Rango [desde, hasta] del día calendario de Bogotá que contiene `ahora`.
 * "Hoy" es el día local (a las 7 p. m. de Bogotá el día UTC ya cambió).
 */
export function rangoDiaBogota(ahora: Date): { desde: Date; hasta: Date } {
  const local = new Date(ahora.getTime() - OFFSET_BOGOTA_MS);
  const desde = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + OFFSET_BOGOTA_MS,
  );
  return { desde, hasta: new Date(desde.getTime() + MS_POR_DIA - 1) };
}

/**
 * Instante en que empieza (00:00 en Bogotá) un día calendario que llega como
 * medianoche UTC, p. ej. lo que produce `new Date("2026-09-10")` desde un
 * `<input type="date">`.
 */
export function inicioDiaBogotaDeFecha(diaCalendario: Date): Date {
  const medianocheUtc = Date.UTC(
    diaCalendario.getUTCFullYear(),
    diaCalendario.getUTCMonth(),
    diaCalendario.getUTCDate(),
  );
  return new Date(medianocheUtc + OFFSET_BOGOTA_MS);
}

/** Último milisegundo (23:59:59.999 en Bogotá) de un día calendario (medianoche UTC). */
export function finDiaBogotaDeFecha(diaCalendario: Date): Date {
  return new Date(inicioDiaBogotaDeFecha(diaCalendario).getTime() + MS_POR_DIA - 1);
}
