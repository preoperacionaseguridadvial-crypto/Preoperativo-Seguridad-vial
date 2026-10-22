// Cuándo debe aparecer el aviso de "superó el horario" mientras el recorredor
// hace la inspección. Sin `server-only`: lo calcula el layout del servidor,
// pero la regla es la de `exigirHorarioParaContinuar` (importarla traería server-only).
import { ventanaActual } from "@/lib/horarios/ventanas";

export type CierreDelAviso = {
  /** Instante en que el aviso debe mostrarse (`ahora` si ya corresponde). */
  cierre: Date;
  /** Instante cuya hora se cita en el texto ("Superó el horario de las ..."). */
  hora: Date;
};

export function cierreDelAviso(params: {
  startedAt: Date;
  ahora: Date;
  habilitacionHasta: Date | null;
}): CierreDelAviso {
  const { startedAt, ahora, habilitacionHasta } = params;

  // Con habilitación vigente el trabajador puede seguir hasta que termine.
  if (habilitacionHasta) return { cierre: habilitacionHasta, hora: habilitacionHasta };

  const ventana = ventanaActual(ahora);
  if (ventana && startedAt >= ventana.inicio) {
    return { cierre: ventana.fin, hora: ventana.fin };
  }

  // Ya fuera de horario: se avisa de inmediato y se cita el cierre del turno
  // en que empezó (si empezó dentro de alguno; si no, la hora actual).
  return { cierre: ahora, hora: ventanaActual(startedAt)?.fin ?? ahora };
}
