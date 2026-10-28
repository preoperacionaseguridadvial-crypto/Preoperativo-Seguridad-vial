// Fotos que se piden DENTRO del recorrido del checklist, justo después de un
// ítem (feature checklist-bueno-malo, 2026-10-23; una foto por llanta desde
// fotos-llantas-por-posicion, 2026-10-28). Hoy una sola parada, `llantas`, que
// pide UNA foto por llanta: 2 en MOTO (delantera, trasera) y 4 en CARRO
// (delantera/trasera, izquierda/derecha; el repuesto no se fotografía).
// Distinta de las fotos diarias lateral/placa, que se piden juntas en `/fotos`
// después de la declaración del conductor.
//
// Módulo puro (sin Prisma ni "server-only"): lo usan el recorrido
// (lib/inspections/pasos-flujo.ts, queries.ts), la validación de subida y de
// envío, la página del paso y el PDF. La regla vive en un solo lugar para que
// "se pide la foto", "se puede subir" y "es obligatoria para enviar" nunca
// puedan divergir.

/** Clave del paso de foto en el recorrido (la ruta es `/foto-<clave>`). */
export type ClaveFotoFlujo = "llantas";

/**
 * Tipos de foto por llanta. Los valores coinciden con el enum
 * `TipoFotoInspeccion` de Prisma (el literal de string es compatible); el
 * `LLANTAS` legado (una foto de ambas llantas) NO está acá a propósito: ya no
 * se pide ni se puede subir.
 */
export type TipoFotoLlanta =
  | "LLANTA_DELANTERA"
  | "LLANTA_TRASERA"
  | "LLANTA_DELANTERA_IZQUIERDA"
  | "LLANTA_DELANTERA_DERECHA"
  | "LLANTA_TRASERA_IZQUIERDA"
  | "LLANTA_TRASERA_DERECHA";

type TipoVehiculoFoto = "MOTO" | "CARRO" | null | undefined;

// Nombre del ítem de llantas de cada tipo de vehículo, tras el cual se piden las
// fotos. Se identifica por nombre, igual que "(si aplica)"
// (lib/inspections/etiquetas-respuesta.ts): el catálogo no tiene un flag para
// esto y no se renombran ítems (ver prisma/catalogo-checklist.ts).
const ITEM_LLANTAS_MOTO = "Llantas";
const ITEM_LLANTAS_CARRO = "Llantas, incluye repuesto";

// Posiciones que se fotografían, en el orden en que se muestran (pantalla y PDF).
const LLANTAS_MOTO: readonly TipoFotoLlanta[] = ["LLANTA_DELANTERA", "LLANTA_TRASERA"];
const LLANTAS_CARRO: readonly TipoFotoLlanta[] = [
  "LLANTA_DELANTERA_IZQUIERDA",
  "LLANTA_DELANTERA_DERECHA",
  "LLANTA_TRASERA_IZQUIERDA",
  "LLANTA_TRASERA_DERECHA",
];

const ETIQUETA_FOTO_LLANTA: Record<TipoFotoLlanta, string> = {
  LLANTA_DELANTERA: "Llanta delantera",
  LLANTA_TRASERA: "Llanta trasera",
  LLANTA_DELANTERA_IZQUIERDA: "Llanta delantera izquierda",
  LLANTA_DELANTERA_DERECHA: "Llanta delantera derecha",
  LLANTA_TRASERA_IZQUIERDA: "Llanta trasera izquierda",
  LLANTA_TRASERA_DERECHA: "Llanta trasera derecha",
};

/**
 * Foto que se pide justo después de este ítem, o `null`. Un vehículo legacy sin
 * tipo es MOTO. Cada tipo reconoce solo el nombre de su propio ítem de llantas.
 */
export function fotoDespuesDelItem(tipoVehiculo: TipoVehiculoFoto, nombreItem: string): ClaveFotoFlujo | null {
  const nombreLlantas = tipoVehiculo === "CARRO" ? ITEM_LLANTAS_CARRO : ITEM_LLANTAS_MOTO;
  return nombreItem === nombreLlantas ? "llantas" : null;
}

/** Fotos de llanta que se piden al vehículo, en orden de posición (legacy sin tipo = MOTO). */
export function llantasDeVehiculo(tipoVehiculo: TipoVehiculoFoto): TipoFotoLlanta[] {
  return [...(tipoVehiculo === "CARRO" ? LLANTAS_CARRO : LLANTAS_MOTO)];
}

/** `true` si `tipo` es una foto de llanta que este tipo de vehículo puede subir. */
export function esFotoLlantaDeVehiculo(tipoVehiculo: TipoVehiculoFoto, tipo: string): boolean {
  return (llantasDeVehiculo(tipoVehiculo) as string[]).includes(tipo);
}

/** Todos los tipos de foto de llanta (de cualquier vehículo), p. ej. para el PDF. */
export function todasLasFotosDeLlanta(): TipoFotoLlanta[] {
  return [...LLANTAS_MOTO, ...LLANTAS_CARRO];
}

export function etiquetaFotoLlanta(tipo: TipoFotoLlanta): string {
  return ETIQUETA_FOTO_LLANTA[tipo];
}
