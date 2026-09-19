import "server-only";

/**
 * Determina si la declaración de estado del conductor de una inspección
 * amerita una advertencia visible para el Supervisor (A6 del design de
 * soporte-moto-carro). Una respuesta "preocupante" en cualquiera de las 3
 * preguntas NO bloquea el envío ni transiciona el estado (D8, confirmado) —
 * el Supervisor sigue siendo el único que decide aprobar/rechazar. Es dato
 * DERIVADO, calculado siempre a partir de los 3 campos de `Inspection`,
 * nunca guardado como flag propio: así no puede quedar desactualizado.
 * `null` (todavía sin responder) nunca cuenta como preocupante — el gate
 * real de "faltan respuestas" vive en `enviarInspeccion`
 * (lib/inspections/actions.ts), no acá.
 *
 * Se considera preocupante:
 * - SÍ a "¿toma medicamentos/sustancia/condición que afecte su capacidad?"
 * - NO a "¿está en condiciones físicas y mentales adecuadas?"
 * - SÍ a "¿ha consumido alcohol o alguna sustancia?"
 */
export function requiereAtencionEstadoConductor(inspection: {
  tomaMedicamentos: boolean | null;
  condicionesAptas: boolean | null;
  consumioAlcohol: boolean | null;
}): boolean {
  return (
    inspection.tomaMedicamentos === true ||
    inspection.condicionesAptas === false ||
    inspection.consumioAlcohol === true
  );
}

/**
 * Preguntas de la declaración del conductor, en el orden en que se muestran:
 * una pantalla por pregunta (pedido del dueño de producto, 2026-09-18), con el
 * texto textual del formato. `campo` es la columna de `Inspection` donde se
 * guarda la respuesta; `imagen` es la ilustración de apoyo (public/).
 */
export const PREGUNTAS_ESTADO_CONDUCTOR = [
  {
    campo: "tomaMedicamentos",
    texto:
      "¿Se encuentra bajo los efectos de algún medicamento, sustancia o condición que pueda afectar su capacidad para conducir de manera segura?",
    ayudaSi: 'Si respondió "Sí": informar al responsable antes de iniciar el recorrido.',
    imagen: "/estado-conductor/medicamentos.jpg",
  },
  {
    campo: "condicionesAptas",
    texto: "¿Se encuentra en condiciones físicas y mentales adecuadas para conducir de manera segura?",
    ayudaSi: undefined,
    imagen: "/estado-conductor/condiciones-aptas.jpg",
  },
  {
    campo: "consumioAlcohol",
    texto: "¿Ha consumido alcohol o alguna sustancia que pueda afectar su capacidad para conducir?",
    ayudaSi: undefined,
    imagen: "/estado-conductor/alcohol.jpg",
  },
] as const;

export type CampoEstadoConductor = (typeof PREGUNTAS_ESTADO_CONDUCTOR)[number]["campo"];

/**
 * Número (1..3) de la primera pregunta sin responder, o `null` si la
 * declaración ya está completa. Con esto la pantalla sabe cuál mostrar y se
 * puede retomar a mitad de camino sin perder lo ya contestado.
 */
export function siguientePreguntaEstadoConductor(
  inspection: Record<CampoEstadoConductor, boolean | null>,
): 1 | 2 | 3 | null {
  const indice = PREGUNTAS_ESTADO_CONDUCTOR.findIndex((pregunta) => inspection[pregunta.campo] === null);
  return indice === -1 ? null : ((indice + 1) as 1 | 2 | 3);
}
