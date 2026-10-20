import { plazoVencido, vencePlazo, type DatosPlazo } from "@/lib/horarios/plazo-aprobacion";

// Qué ve un aprobador sobre el plazo de una inspección pendiente (cola y
// detalle). Pura y sin dependencias de servidor: las pantallas solo pintan lo
// que sale de acá. La regla real la sigue aplicando el servidor al decidir
// (`exigirPlazoParaDecidir`); esto únicamente decide qué se muestra.

export const MENSAJE_ENVIADA_FUERA_DE_HORARIO =
  "Enviada fuera de horario, pendiente de revisión. Tiene 60 minutos para aprobar o rechazar.";

export type EstadoPlazoAprobador = {
  /** Se envió bajo una habilitación de SST fuera del horario de inspección. */
  fueraDeHorario: boolean;
  /** Instante en que vence (o venció) el plazo de la etapa pendiente. */
  vence: Date | null;
  vencido: boolean;
  /** Fin de la habilitación vigente del aprobador; solo si hace falta (plazo vencido). */
  habilitadoHasta: Date | null;
  /** Si las acciones de aprobar/rechazar deben mostrarse. */
  puedeDecidir: boolean;
};

export function estadoPlazoParaAprobador(params: {
  inspection: DatosPlazo & { enviadaFueraDeHorario: boolean };
  ahora: Date;
  /** `hasta` de la habilitación APROBACION vigente del aprobador, si tiene una. */
  habilitacionHasta: Date | null;
}): EstadoPlazoAprobador {
  const { inspection, ahora, habilitacionHasta } = params;
  const vencido = plazoVencido(inspection, ahora);
  const habilitadoHasta =
    vencido && habilitacionHasta !== null && habilitacionHasta > ahora ? habilitacionHasta : null;
  return {
    fueraDeHorario: inspection.enviadaFueraDeHorario,
    vence: vencePlazo(inspection),
    vencido,
    habilitadoHasta,
    puedeDecidir: !vencido || habilitadoHasta !== null,
  };
}
