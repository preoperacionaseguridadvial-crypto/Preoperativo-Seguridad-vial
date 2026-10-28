// Textos de la pantalla de bloqueo por horario. Puro y sin `server-only`: lo
// usan páginas del servidor y los `error.tsx` (componentes de cliente).

export type MotivoPantallaBloqueo = "INICIO" | "CONTINUAR" | "APROBACION" | "GENERICO";

export const INDICACION_HABILITACION =
  "Comuníquese con la Administradora SST para que le otorgue la habilitación.";

export const TEXTOS_BLOQUEO: Record<MotivoPantallaBloqueo, { titulo: string; mensaje: string }> = {
  INICIO: {
    titulo: "Fuera de horario",
    mensaje: "Solo puede iniciar o descartar una inspección entre las 5:45 y las 6:30 a. m. o entre las 5:45 y las 6:30 p. m.",
  },
  CONTINUAR: {
    titulo: "Terminó el horario de inspección",
    mensaje: "Esta inspección se inició en un horario que ya cerró, por lo que no es posible continuarla ni enviarla.",
  },
  APROBACION: {
    titulo: "Fuera del horario de aprobación",
    mensaje: "Solo puede aprobar o rechazar entre las 5:45 y las 8:00 a. m. o entre las 5:45 y las 8:00 p. m.",
  },
  GENERICO: {
    titulo: "No se pudo completar la acción",
    mensaje: "Si el horario de inspección terminó, la acción queda bloqueada hasta que SST la habilite.",
  },
};
