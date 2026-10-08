// Aviso de confirmación en el Inicio del Supervisor tras firmar una decisión.
//
// Después de que el Supervisor firma (app/(supervisor)/aprobaciones/[id]/firma)
// vuelve a su INICIO (resumen de pendientes + accesos) —no al detalle— para
// seguir con la próxima inspección; la decisión viaja en la URL solo para
// mostrar el aviso. Es un dato de presentación: nunca se usa para decidir
// nada, y cualquier valor inesperado en la URL se descarta (no se muestra
// texto arbitrario).

import { Role } from "@/generated/prisma/enums";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";

const DECISIONES = {
  APROBADA: "aprobada",
  RECHAZADA: "rechazada",
} as const;

// Placas colombianas y similares: solo letras/números, longitud acotada.
const PLACA_VALIDA = /^[A-Z0-9]{3,10}$/;

// Aprobación de la primera etapa (Supervisor Oleariari): la inspección sigue
// pendiente (el status no cambia) y pasa al Director de Operaciones.
const DECISION_ENVIADA_AL_DIRECTOR = "enviada";

/**
 * URL del Inicio al que se vuelve tras guardar la firma del aprobador.
 * `primeraEtapa` indica que firmó el Supervisor Oleariari: si aprobó, el status
 * sigue pendiente y el aviso dice que se envió al Director.
 */
export function urlInicioTrasFirma(status: string, placa: string, primeraEtapa = false): string {
  const decision =
    DECISIONES[status as keyof typeof DECISIONES] ?? (primeraEtapa ? DECISION_ENVIADA_AL_DIRECTOR : undefined);
  if (!decision) {
    return "/";
  }
  const params = new URLSearchParams({ decision, placa });
  return `/?${params.toString()}`;
}

export type AvisoDecision = { tono: "ok" | "rechazo"; texto: string };

/** Aviso a mostrar en el Inicio, o `null` si la URL no trae una decisión válida. */
export function avisoDecisionFirmada(params: { decision?: string; placa?: string }): AvisoDecision | null {
  if (
    params.decision !== "aprobada" &&
    params.decision !== "rechazada" &&
    params.decision !== DECISION_ENVIADA_AL_DIRECTOR
  ) {
    return null;
  }
  const placa = params.placa && PLACA_VALIDA.test(params.placa) ? `${params.placa} ` : "";
  if (params.decision === DECISION_ENVIADA_AL_DIRECTOR) {
    return {
      tono: "ok",
      texto: `Inspección ${placa}aprobada y enviada al ${etiquetaRol(Role.SUPERVISOR)}.`,
    };
  }
  return {
    tono: params.decision === "aprobada" ? "ok" : "rechazo",
    texto: `Inspección ${placa}${params.decision} y firmada.`,
  };
}
