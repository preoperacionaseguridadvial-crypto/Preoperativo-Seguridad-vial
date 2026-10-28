import { Sede } from "@/generated/prisma/enums";
import { rangoDiaBogota } from "@/lib/fechas/formato";

// Horario de decisión de los aprobadores (regla de producto 2026-10-28):
// ventanas fijas de 5:45 a 8:00 a. m. y de 5:45 a 8:00 p. m. (Bogotá; inicio
// incluido, fin excluido). Reemplaza el plazo de 60 minutos. Sin dependencias
// de servidor, para que la UI (cola y detalle) y las server actions calculen
// exactamente lo mismo.
//
// Cada etapa pendiente queda atada a UNA ventana: la primera que termina
// después de que la etapa empezó (la que estaba abierta, o la siguiente en
// abrir). Su fin es el vencimiento y no revive en una ventana posterior; fuera
// de su ventana el aprobador necesita una habilitación APROBACION de SST.
//
// Bogotá / legacy sin sede (una etapa): desde el envío (`completedAt`).
// Oleariari etapa 1: desde el envío. Oleariari etapa 2 (Director): desde la
// revisión del Supervisor Oleariari. Se lee de los datos de la inspección y
// no de `etapaPendiente` porque esa función exige conocer la firma, que acá
// no cambia el inicio de la etapa.

const MS_POR_MINUTO = 60_000;
const MINUTOS_POR_DIA = 24 * 60;

// Minutos desde la medianoche de Bogotá.
const VENTANAS_APROBACION: { inicio: number; fin: number }[] = [
  { inicio: 5 * 60 + 45, fin: 8 * 60 },
  { inicio: 17 * 60 + 45, fin: 20 * 60 },
];

export type VentanaAprobacion = { inicio: Date; fin: Date };

export type DatosPlazo = {
  sede: Sede | null;
  completedAt: Date | null;
  revisadaSupervisorOleariariAt: Date | null;
};

/** Instante desde el que corre la etapa pendiente, o `null` si no hay envío. */
export function inicioPlazoEtapa(inspection: DatosPlazo): Date | null {
  if (inspection.sede === Sede.OLEARIARI && inspection.revisadaSupervisorOleariariAt !== null) {
    return inspection.revisadaSupervisorOleariariAt;
  }
  return inspection.completedAt;
}

/** Ventana de aprobación de una etapa que empezó en `inicio`: la primera que termina después de ese instante. */
export function ventanaAprobacionDesde(inicio: Date): VentanaAprobacion {
  const { desde } = rangoDiaBogota(inicio);
  // Hoy y mañana (Bogotá): hay dos ventanas por día y `inicio` cae a lo sumo en la segunda de hoy.
  for (const dia of [0, 1]) {
    const base = desde.getTime() + dia * MINUTOS_POR_DIA * MS_POR_MINUTO;
    for (const ventana of VENTANAS_APROBACION) {
      const fin = new Date(base + ventana.fin * MS_POR_MINUTO);
      if (fin > inicio) return { inicio: new Date(base + ventana.inicio * MS_POR_MINUTO), fin };
    }
  }
  throw new Error("Sin ventana de aprobación para el instante dado");
}

/** Ventana de aprobación de la etapa pendiente, o `null` si no hay envío. */
export function ventanaAprobacion(inspection: DatosPlazo): VentanaAprobacion | null {
  const inicio = inicioPlazoEtapa(inspection);
  return inicio === null ? null : ventanaAprobacionDesde(inicio);
}

/** Instante en que vence el plazo de la etapa pendiente (fin de su ventana). */
export function vencePlazo(inspection: DatosPlazo): Date | null {
  return ventanaAprobacion(inspection)?.fin ?? null;
}

/** Vencido desde el instante de vencimiento (inclusive): se decide mientras `ahora < vence`. */
export function plazoVencido(inspection: DatosPlazo, ahora: Date): boolean {
  const vence = vencePlazo(inspection);
  return vence !== null && ahora >= vence;
}

/** `instante` cae fuera de la ventana de una etapa que empezó en `inicioEtapa` (antes de abrir o ya cerrada). */
export function fueraDeVentanaDesde(inicioEtapa: Date, instante: Date): boolean {
  const ventana = ventanaAprobacionDesde(inicioEtapa);
  return instante < ventana.inicio || instante >= ventana.fin;
}

/**
 * El aprobador está fuera del horario de su etapa: antes de que abra su
 * ventana o ya cerrada. Sin envío no hay horario y no cuenta como fuera. Es lo
 * que exige una habilitación de SST para decidir.
 */
export function fueraDeVentanaAprobacion(inspection: DatosPlazo, ahora: Date): boolean {
  const inicio = inicioPlazoEtapa(inspection);
  return inicio !== null && fueraDeVentanaDesde(inicio, ahora);
}
