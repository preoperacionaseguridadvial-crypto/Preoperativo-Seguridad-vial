// Aviso de confirmación en la lista de Aprobaciones tras firmar una decisión.
//
// Después de que el Supervisor firma (app/(supervisor)/aprobaciones/[id]/firma)
// vuelve a la LISTA de pendientes —no al detalle— para seguir con la próxima
// inspección; la decisión viaja en la URL solo para mostrar el aviso. Es un
// dato de presentación: nunca se usa para decidir nada, y cualquier valor
// inesperado en la URL se descarta (no se muestra texto arbitrario).

const DECISIONES = {
  APROBADA: "aprobada",
  RECHAZADA: "rechazada",
} as const;

// Placas colombianas y similares: solo letras/números, longitud acotada.
const PLACA_VALIDA = /^[A-Z0-9]{3,10}$/;

/** URL de la lista a la que se vuelve tras guardar la firma del Supervisor. */
export function urlListaTrasFirma(status: string, placa: string): string {
  const decision = DECISIONES[status as keyof typeof DECISIONES];
  if (!decision) {
    return "/aprobaciones";
  }
  const params = new URLSearchParams({ decision, placa });
  return `/aprobaciones?${params.toString()}`;
}

export type AvisoDecision = { tono: "ok" | "rechazo"; texto: string };

/** Aviso a mostrar en la lista, o `null` si la URL no trae una decisión válida. */
export function avisoDecisionFirmada(params: { decision?: string; placa?: string }): AvisoDecision | null {
  if (params.decision !== "aprobada" && params.decision !== "rechazada") {
    return null;
  }
  const placa = params.placa && PLACA_VALIDA.test(params.placa) ? `${params.placa} ` : "";
  return {
    tono: params.decision === "aprobada" ? "ok" : "rechazo",
    texto: `Inspección ${placa}${params.decision} y firmada.`,
  };
}
