// Ventanas de horario en que el recorredor puede hacer la inspección
// (regla de producto 2026-10-20). Hora de Bogotá; inicio incluido, fin
// excluido: a las 6:30 en punto la ventana ya cerró. Sin `server-only`: el
// aviso automático del cliente también necesita saber cuándo cierra.
import { rangoDiaBogota } from "@/lib/fechas/formato";

export type Turno = 1 | 2;

export type Ventana = { turno: Turno; inicio: Date; fin: Date };

const MS_POR_MINUTO = 60 * 1000;

// Minutos desde la medianoche de Bogotá.
const VENTANAS: { turno: Turno; inicio: number; fin: number }[] = [
  { turno: 1, inicio: 5 * 60 + 45, fin: 6 * 60 + 30 },
  { turno: 2, inicio: 17 * 60 + 45, fin: 18 * 60 + 30 },
];

/** Ventana abierta en `ahora`, o null si está fuera de horario. */
export function ventanaActual(ahora: Date): Ventana | null {
  const { desde } = rangoDiaBogota(ahora);
  for (const { turno, inicio, fin } of VENTANAS) {
    const inicioVentana = new Date(desde.getTime() + inicio * MS_POR_MINUTO);
    const finVentana = new Date(desde.getTime() + fin * MS_POR_MINUTO);
    if (ahora >= inicioVentana && ahora < finVentana) {
      return { turno, inicio: inicioVentana, fin: finVentana };
    }
  }
  return null;
}

/**
 * Inicio de la última ventana que ya abrió en `ahora`: la actual si hay una
 * abierta; si no, la que acaba de cerrar (la de hoy, o la de las 17:45 de ayer
 * antes de las 05:45). Define a qué turno pertenece "lo pendiente".
 */
export function inicioUltimaVentana(ahora: Date): Date {
  const { desde } = rangoDiaBogota(ahora);
  const inicios = VENTANAS.map(({ inicio }) => new Date(desde.getTime() + inicio * MS_POR_MINUTO));
  const abiertas = inicios.filter((inicio) => inicio <= ahora);
  if (abiertas.length > 0) return abiertas[abiertas.length - 1];
  // Antes de la primera ventana del día: la última de ayer (Bogotá no tiene DST).
  const ultima = VENTANAS[VENTANAS.length - 1];
  return new Date(desde.getTime() - 24 * 60 * MS_POR_MINUTO + ultima.inicio * MS_POR_MINUTO);
}

export function estaEnVentana(ahora: Date): boolean {
  return ventanaActual(ahora) !== null;
}
