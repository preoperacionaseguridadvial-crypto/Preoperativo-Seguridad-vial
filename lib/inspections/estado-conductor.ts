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
