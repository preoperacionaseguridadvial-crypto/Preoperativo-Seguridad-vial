const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * Texto corto de "hace cuánto" para la lista de pendientes del Supervisor
 * (p. ej. "hace 35 min"). Pensado para leerse de un vistazo en el celular: le
 * dice al Supervisor cuánto lleva esperando cada inspección sin obligarlo a
 * comparar fechas. Una fecha futura (reloj desfasado) cuenta como "hace un
 * momento" en vez de mostrar un valor negativo.
 */
export function tiempoTranscurrido(fecha: Date | null, ahora: Date = new Date()): string | null {
  if (!fecha) {
    return null;
  }
  const diff = ahora.getTime() - fecha.getTime();
  if (diff < MINUTO) {
    return "hace un momento";
  }
  if (diff < HORA) {
    return `hace ${Math.floor(diff / MINUTO)} min`;
  }
  if (diff < DIA) {
    return `hace ${Math.floor(diff / HORA)} h`;
  }
  const dias = Math.floor(diff / DIA);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}
