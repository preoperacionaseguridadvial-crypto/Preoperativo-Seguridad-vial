import { proximaVentanaAprobacion, ventanaAprobacionAbierta } from "@/lib/horarios/plazo-aprobacion";

// Qué ve un aprobador sobre el horario de decisión de una inspección pendiente
// (cola y detalle). Pura y sin dependencias de servidor: las pantallas solo
// pintan lo que sale de acá. La regla real la sigue aplicando el servidor al
// decidir (`exigirPlazoParaDecidir`); esto únicamente decide qué se muestra.

export const MENSAJE_ENVIADA_FUERA_DE_HORARIO =
  "Enviada fuera de horario, pendiente de revisión. Solo puede aprobar o rechazar entre las 5:45 y las 8:00 a. m. o entre las 5:45 y las 8:00 p. m.";

export type EstadoPlazoAprobador = {
  /** Se envió bajo una habilitación de SST fuera del horario de inspección. */
  fueraDeHorario: boolean;
  /** Instante en que cierra la ventana de aprobación abierta ahora; `null` si todas están cerradas. */
  cierra: Date | null;
  /** Instante en que abre la próxima ventana de aprobación; `null` si hay una abierta ahora. */
  abre: Date | null;
  /** No hay ventana abierta. Ahí solo decide con habilitación de SST. */
  fueraDeVentana: boolean;
  /** Fin de la habilitación vigente del aprobador; solo si hace falta (fuera de ventana). */
  habilitadoHasta: Date | null;
  /** Si las acciones de aprobar/rechazar deben mostrarse. */
  puedeDecidir: boolean;
};

export function estadoPlazoParaAprobador(params: {
  inspection: { enviadaFueraDeHorario: boolean };
  ahora: Date;
  /** `hasta` de la habilitación APROBACION vigente del aprobador, si tiene una. */
  habilitacionHasta: Date | null;
}): EstadoPlazoAprobador {
  const { inspection, ahora, habilitacionHasta } = params;
  const abierta = ventanaAprobacionAbierta(ahora);
  const fueraDeVentana = abierta === null;
  const habilitadoHasta =
    fueraDeVentana && habilitacionHasta !== null && habilitacionHasta > ahora ? habilitacionHasta : null;
  return {
    fueraDeHorario: inspection.enviadaFueraDeHorario,
    cierra: abierta?.fin ?? null,
    abre: fueraDeVentana ? proximaVentanaAprobacion(ahora).inicio : null,
    fueraDeVentana,
    habilitadoHasta,
    puedeDecidir: !fueraDeVentana || habilitadoHasta !== null,
  };
}
