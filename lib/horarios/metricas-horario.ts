import { Sede } from "@/generated/prisma/enums";
import { fueraDeVentanaDesde } from "@/lib/horarios/plazo-aprobacion";

// Agregaciones puras de las métricas de cumplimiento de horarios (sin acceso a
// base de datos, para poder probarlas con fechas fijas). Las consultas viven en
// lib/horarios/reportes-horario.ts.

export type EtapaAprobacion = "SUPERVISOR_OLEARIARI" | "SUPERVISOR";

export const ETIQUETA_ETAPA: Record<EtapaAprobacion, string> = {
  SUPERVISOR_OLEARIARI: "Supervisor Oleariari",
  SUPERVISOR: "Director de Operaciones",
};

export type DatosDecision = {
  sede: Sede | null;
  completedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  revisadaSupervisorOleariariAt: Date | null;
  supervisorId: string | null;
  supervisorOleariariId: string | null;
};

export type Decision = {
  etapa: EtapaAprobacion;
  aprobadorId: string;
  minutos: number;
  /** Decidida fuera de la ventana de aprobación de su etapa (antes de abrir o ya cerrada). */
  fueraDePlazo: boolean;
};

export function minutosEntre(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / 60_000;
}

/** Promedio con un decimal, o `null` si no hay datos. */
export function promedioMinutos(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const suma = valores.reduce((acc, v) => acc + v, 0);
  return Math.round((suma / valores.length) * 10) / 10;
}

function decision(etapa: EtapaAprobacion, aprobadorId: string, inicio: Date, fin: Date): Decision {
  const minutos = minutosEntre(inicio, fin);
  return { etapa, aprobadorId, minutos, fueraDePlazo: fueraDeVentanaDesde(inicio, fin) };
}

/**
 * Decisiones tomadas sobre una inspección, una por etapa decidida:
 * - Bogotá / sin sede: etapa SUPERVISOR, desde el envío hasta aprobación/rechazo.
 * - Oleariari etapa 1: desde el envío hasta `revisadaSupervisorOleariariAt` (también
 *   cuando la rechaza: el rechazo de etapa 1 fija `rejectedAt` y `revisada…` y deja
 *   `supervisorId` nulo).
 * - Oleariari etapa 2: desde `revisada…` hasta aprobación/rechazo del Director.
 */
export function decisionesDeInspeccion(insp: DatosDecision): Decision[] {
  if (insp.completedAt === null) return [];
  const resultado: Decision[] = [];
  const decisionFinal = insp.approvedAt ?? insp.rejectedAt;

  if (insp.sede === Sede.OLEARIARI) {
    if (insp.revisadaSupervisorOleariariAt !== null && insp.supervisorOleariariId !== null) {
      resultado.push(
        decision("SUPERVISOR_OLEARIARI", insp.supervisorOleariariId, insp.completedAt, insp.revisadaSupervisorOleariariAt),
      );
      if (decisionFinal !== null && insp.supervisorId !== null) {
        resultado.push(decision("SUPERVISOR", insp.supervisorId, insp.revisadaSupervisorOleariariAt, decisionFinal));
      }
    }
    return resultado;
  }

  if (decisionFinal !== null && insp.supervisorId !== null) {
    resultado.push(decision("SUPERVISOR", insp.supervisorId, insp.completedAt, decisionFinal));
  }
  return resultado;
}
