import { rangoDiaBogota } from "@/lib/fechas/formato";

// Horario de decisión de los aprobadores (regla de producto 2026-11-07):
// ventanas fijas de 5:45 a 8:00 a. m. y de 5:45 a 8:00 p. m. (Bogotá; inicio
// incluido, fin excluido). Una inspección pendiente puede aprobarse o
// rechazarse en CUALQUIER ventana abierta mientras siga pendiente: no hay
// vencimiento ni queda atada a la ventana en que se envió o revisó. Fuera de
// toda ventana el aprobador necesita una habilitación APROBACION de SST. Sin
// dependencias de servidor, para que la UI (cola y detalle) y las server
// actions calculen exactamente lo mismo.

const MS_POR_MINUTO = 60_000;
const MINUTOS_POR_DIA = 24 * 60;

// Minutos desde la medianoche de Bogotá.
const VENTANAS_APROBACION: { inicio: number; fin: number }[] = [
  { inicio: 5 * 60 + 45, fin: 8 * 60 },
  { inicio: 17 * 60 + 45, fin: 20 * 60 },
];

export type VentanaAprobacion = { inicio: Date; fin: Date };

/** Ventanas de hoy y de mañana (Bogotá) respecto de `ahora`, en orden cronológico. */
function ventanasCercanas(ahora: Date): VentanaAprobacion[] {
  const { desde } = rangoDiaBogota(ahora);
  const ventanas: VentanaAprobacion[] = [];
  for (const dia of [0, 1]) {
    const base = desde.getTime() + dia * MINUTOS_POR_DIA * MS_POR_MINUTO;
    for (const v of VENTANAS_APROBACION) {
      ventanas.push({
        inicio: new Date(base + v.inicio * MS_POR_MINUTO),
        fin: new Date(base + v.fin * MS_POR_MINUTO),
      });
    }
  }
  return ventanas;
}

/** Ventana de aprobación abierta en `ahora` (inicio incluido, fin excluido), o `null` si todas están cerradas. */
export function ventanaAprobacionAbierta(ahora: Date): VentanaAprobacion | null {
  return ventanasCercanas(ahora).find((v) => ahora >= v.inicio && ahora < v.fin) ?? null;
}

/** Hay una ventana de aprobación abierta en `ahora`: ahí se decide sin habilitación de SST. */
export function enVentanaAprobacion(ahora: Date): boolean {
  return ventanaAprobacionAbierta(ahora) !== null;
}

/** Primera ventana que abre estrictamente después de `ahora`. */
export function proximaVentanaAprobacion(ahora: Date): VentanaAprobacion {
  const proxima = ventanasCercanas(ahora).find((v) => v.inicio > ahora);
  // Con hoy y mañana siempre queda al menos una ventana futura.
  if (!proxima) throw new Error("Sin próxima ventana de aprobación para el instante dado");
  return proxima;
}
