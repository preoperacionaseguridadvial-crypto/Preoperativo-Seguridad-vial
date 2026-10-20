import { Sede } from "@/generated/prisma/enums";

// Plazo de decisión de los aprobadores (regla de producto 2026-10-20): 60
// minutos por etapa. Sin dependencias de servidor, para que la UI (cola y
// detalle) y las server actions calculen exactamente lo mismo.
//
// Bogotá / legacy sin sede (una etapa): desde el envío (`completedAt`).
// Oleariari etapa 1: desde el envío. Oleariari etapa 2 (Director): desde la
// revisión del Supervisor Oleariari. Se lee de los datos de la inspección y
// no de `etapaPendiente` porque esa función exige conocer la firma, que acá
// no cambia el inicio del plazo.

export const PLAZO_APROBACION_MINUTOS = 60;

export type DatosPlazo = {
  sede: Sede | null;
  completedAt: Date | null;
  revisadaSupervisorOleariariAt: Date | null;
};

/** Instante desde el que corre el plazo de la etapa pendiente, o `null` si no hay envío. */
export function inicioPlazoEtapa(inspection: DatosPlazo): Date | null {
  if (inspection.sede === Sede.OLEARIARI && inspection.revisadaSupervisorOleariariAt !== null) {
    return inspection.revisadaSupervisorOleariariAt;
  }
  return inspection.completedAt;
}

/** Instante en que vence el plazo de la etapa pendiente. */
export function vencePlazo(inspection: DatosPlazo): Date | null {
  const inicio = inicioPlazoEtapa(inspection);
  return inicio === null ? null : new Date(inicio.getTime() + PLAZO_APROBACION_MINUTOS * 60_000);
}

/** Vencido desde el instante de vencimiento (inclusive): se decide mientras `ahora < vence`. */
export function plazoVencido(inspection: DatosPlazo, ahora: Date): boolean {
  const vence = vencePlazo(inspection);
  return vence !== null && ahora >= vence;
}
