// Helpers puros del selector de hora (12 h, minutos de 5 en 5) de las
// habilitaciones. El valor que viaja al servidor sigue siendo "HH:MM" en 24 h.

export type Periodo = "AM" | "PM";
export type PartesHora = { hora12: number; minuto: number; periodo: Periodo };

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

/** "17:32" -> 5:30 p. m. (minutos redondeados hacia abajo a múltiplos de 5). */
export function aPartes(hhmm: string): PartesHora {
  const total = aMinutosDelDia(hhmm);
  const h24 = Math.min(Math.floor(total / 60), 23);
  const minuto = Math.floor((total % 60) / PASO_MINUTOS) * PASO_MINUTOS;
  return { hora12: h24 % 12 === 0 ? 12 : h24 % 12, minuto, periodo: h24 >= 12 ? "PM" : "AM" };
}

/** Partes en 12 h -> "HH:MM" en 24 h (12 a. m. = 00, 12 p. m. = 12). */
export function aHHMM({ hora12, minuto, periodo }: PartesHora): string {
  const h24 = (hora12 % 12) + (periodo === "PM" ? 12 : 0);
  return deMinutosDelDia(h24 * 60 + minuto);
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
