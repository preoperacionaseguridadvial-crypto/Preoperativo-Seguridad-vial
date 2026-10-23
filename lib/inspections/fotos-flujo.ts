// Fotos que se piden DENTRO del recorrido del checklist, justo después de un
// ítem (feature checklist-bueno-malo, 2026-10-23). Hoy una sola: la foto de las
// llantas de la MOTO, después del ítem "Llantas". Distinta de las fotos diarias
// lateral/placa, que se piden juntas en `/fotos` después de la declaración del
// conductor.
//
// Módulo puro (sin Prisma ni "server-only"): lo usan el recorrido
// (lib/inspections/pasos-flujo.ts, queries.ts), la validación de envío y la
// guía de la foto. La regla vive en un solo lugar para que "se pide la foto" y
// "es obligatoria para enviar" nunca puedan divergir.

/** Clave del paso de foto en el recorrido (la ruta es `/foto-<clave>`). */
export type ClaveFotoFlujo = "llantas";

// Nombre del ítem de la MOTO tras el cual se pide la foto. Se identifica por
// nombre, igual que "(si aplica)" (lib/inspections/etiquetas-respuesta.ts): el
// catálogo no tiene un flag para esto y no se renombran ítems.
const ITEM_LLANTAS_MOTO = "Llantas";

/**
 * Foto que se pide justo después de este ítem, o `null`. Solo MOTO (un vehículo
 * legacy sin tipo es MOTO): el CARRO nunca la pide.
 */
export function fotoDespuesDelItem(
  tipoVehiculo: "MOTO" | "CARRO" | null | undefined,
  nombreItem: string,
): ClaveFotoFlujo | null {
  const esMoto = tipoVehiculo !== "CARRO";
  return esMoto && nombreItem === ITEM_LLANTAS_MOTO ? "llantas" : null;
}
