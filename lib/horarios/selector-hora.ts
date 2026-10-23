// Helpers puros del selector de hora y de la vista rápida de las habilitaciones.
// El valor que viaja al servidor sigue siendo "HH:MM" en 24 h.

const PASO_MINUTOS = 5;
const MAXIMO_DIA = 23 * 60 + 55;

function aMinutosDelDia(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return 0;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return Math.min(Math.max(total, 0), MAXIMO_DIA + 4);
}

function deMinutosDelDia(total: number): string {
  const h = Math.floor(total / 60);
  const mi = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/** Suma minutos sin pasar de la medianoche: tope en 23:55. */
export function sumarMinutos(hhmm: string, minutos: number): string {
  return deMinutosDelDia(Math.min(aMinutosDelDia(hhmm) + minutos, MAXIMO_DIA));
}

const FORMATO_BOGOTA = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Bogota",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Hora actual de Bogotá como "HH:MM", redondeada hacia abajo a 5 min. */
export function horaActualRedondeada(ahora: Date): string {
  const partes = FORMATO_BOGOTA.formatToParts(ahora);
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const mi = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return deMinutosDelDia(h * 60 + Math.floor(mi / PASO_MINUTOS) * PASO_MINUTOS);
}

/** "17:30" -> "5:30 p. m." */
export function formatearHora12(hhmm: string): string {
  const total = aMinutosDelDia(hhmm);
  const h24 = Math.min(Math.floor(total / 60), 23);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(total % 60).padStart(2, "0")} ${h24 >= 12 ? "p. m." : "a. m."}`;
}

/** Horas rápidas del panel "Seleccionar hora" (24 h). */
export const HORAS_FRECUENTES = ["06:00", "07:00", "08:00", "09:00", "12:00", "18:00", "19:00", "21:00"] as const;

/** "07:05" -> { horas: 7, minutos: 5 }; vacío o inválido -> 0:00. */
export function partesDeHora(hhmm: string): { horas: number; minutos: number } {
  const total = aMinutosDelDia(hhmm);
  return { horas: Math.min(Math.floor(total / 60), 23), minutos: total % 60 };
}

function aHHMMDePartes(horas: number, minutos: number): string {
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

/** Suma o resta horas dando la vuelta 23 <-> 0; no toca los minutos. */
export function ajustarHoras(hhmm: string, delta: 1 | -1): string {
  const { horas, minutos } = partesDeHora(hhmm);
  return aHHMMDePartes((horas + delta + 24) % 24, minutos);
}

/** Mueve los minutos de 5 en 5 dando la vuelta 55 <-> 0, sin acarrear a la hora. */
export function ajustarMinutos(hhmm: string, delta: 1 | -1): string {
  const { horas, minutos } = partesDeHora(hhmm);
  const paso = delta === 1 ? Math.floor(minutos / PASO_MINUTOS) + 1 : Math.ceil(minutos / PASO_MINUTOS) - 1;
  const celdas = 60 / PASO_MINUTOS;
  return aHHMMDePartes(horas, (((paso % celdas) + celdas) % celdas) * PASO_MINUTOS);
}

/** Ambos extremos presentes y `hasta` posterior a `desde`. */
export function rangoValido(desde: string, hasta: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(desde) && /^\d{1,2}:\d{2}$/.test(hasta) && aMinutosDelDia(hasta) > aMinutosDelDia(desde);
}

/** "1 h 30 min", "2 h", "45 min" o "-" si el rango no es válido. */
export function duracionTexto(desde: string, hasta: string): string {
  if (!rangoValido(desde, hasta)) return "-";
  const total = aMinutosDelDia(hasta) - aMinutosDelDia(desde);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h > 0 ? `${h} h` : "", m > 0 ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** "5:30 p. m. – 6:30 p. m." o "No definido" si falta un extremo. */
export function formatearRango(desde: string, hasta: string): string {
  if (!desde || !hasta) return "No definido";
  return `${formatearHora12(desde)} – ${formatearHora12(hasta)}`;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function partesFecha(iso: string): { anio: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

/** "2026-10-24" -> "24 de octubre de 2026"; "-" si es vacía o inválida. */
export function formatearFechaLarga(iso: string): string {
  const p = partesFecha(iso);
  return p ? `${p.dia} de ${MESES[p.mes - 1]} de ${p.anio}` : "-";
}
