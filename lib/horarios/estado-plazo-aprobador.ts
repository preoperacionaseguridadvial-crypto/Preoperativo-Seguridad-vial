import {
  fueraDeVentanaAprobacion,
  plazoVencido,
  ventanaAprobacion,
  type DatosPlazo,
} from "@/lib/horarios/plazo-aprobacion";

// Qué ve un aprobador sobre el horario de decisión de una inspección pendiente
// (cola y detalle). Pura y sin dependencias de servidor: las pantallas solo
// pintan lo que sale de acá. La regla real la sigue aplicando el servidor al
// decidir (`exigirPlazoParaDecidir`); esto únicamente decide qué se muestra.

export const MENSAJE_ENVIADA_FUERA_DE_HORARIO =
  "Enviada fuera de horario, pendiente de revisión. Solo puede aprobar o rechazar entre las 5:45 y las 8:00 a. m. o entre las 5:45 y las 8:00 p. m.";

export type EstadoPlazoAprobador = {
  /** Se envió bajo una habilitación de SST fuera del horario de inspección. */
  fueraDeHorario: boolean;
  /** Instante en que abre (o abrió) la ventana de aprobación de la etapa pendiente. */
  abre: Date | null;
  /** Instante en que vence (o venció) la ventana de aprobación de la etapa pendiente. */
  vence: Date | null;
  vencido: boolean;
  /** Fuera de la ventana: aún no abrió o ya venció. Ahí solo decide con habilitación de SST. */
  fueraDeVentana: boolean;
  /** Fin de la habilitación vigente del aprobador; solo si hace falta (fuera de la ventana). */
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
  const ventana = ventanaAprobacion(inspection);
  const fueraDeVentana = fueraDeVentanaAprobacion(inspection, ahora);
  const habilitadoHasta =
    fueraDeVentana && habilitacionHasta !== null && habilitacionHasta > ahora ? habilitacionHasta : null;
  return {
    fueraDeHorario: inspection.enviadaFueraDeHorario,
    abre: ventana?.inicio ?? null,
    vence: ventana?.fin ?? null,
    vencido: plazoVencido(inspection, ahora),
    fueraDeVentana,
    habilitadoHasta,
    puedeDecidir: !fueraDeVentana || habilitadoHasta !== null,
  };
}
