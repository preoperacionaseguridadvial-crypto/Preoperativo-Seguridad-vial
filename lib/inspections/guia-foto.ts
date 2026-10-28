// `llanta_*` es el tipo de foto en minúscula, igual que el segmento de la URL de
// subida (`/fotos/<tipo>/subir`).
export type TipoFotoGuiaLlanta =
  | "llanta_delantera"
  | "llanta_trasera"
  | "llanta_delantera_izquierda"
  | "llanta_delantera_derecha"
  | "llanta_trasera_izquierda"
  | "llanta_trasera_derecha";
export type TipoFotoGuia = "lateral" | "placa" | TipoFotoGuiaLlanta;
export type TipoVehiculoGuia = "MOTO" | "CARRO";

const INSTRUCCION: Record<TipoFotoGuia, string> = {
  lateral: "Ubícate a 2–3 metros, de lado. Que se vea el vehículo completo, de rueda a rueda.",
  placa: "Acércate a la placa trasera. Que se lean todas las letras y números.",
  llanta_delantera: "Ubícate a 1–2 metros de la llanta delantera. Que se vea completa y su desgaste.",
  llanta_trasera: "Ubícate a 1–2 metros de la llanta trasera. Que se vea completa y su desgaste.",
  llanta_delantera_izquierda:
    "Ubícate a 1–2 metros de la llanta delantera izquierda. Que se vea completa y su desgaste.",
  llanta_delantera_derecha:
    "Ubícate a 1–2 metros de la llanta delantera derecha. Que se vea completa y su desgaste.",
  llanta_trasera_izquierda:
    "Ubícate a 1–2 metros de la llanta trasera izquierda. Que se vea completa y su desgaste.",
  llanta_trasera_derecha: "Ubícate a 1–2 metros de la llanta trasera derecha. Que se vea completa y su desgaste.",
};

// Las fotos de llanta reutilizan la foto de referencia del ítem de llantas de
// cada tipo de vehículo (public/checklist/), salvo la trasera de moto, que
// tiene guía propia para que no se confunda con la delantera.
const GUIA_LLANTAS_SRC = { moto: "/checklist/llantas.jpg", carro: "/checklist/llantas-repuesto.webp" } as const;
const GUIA_LLANTA_TRASERA_MOTO_SRC = "/fotos-guia/llanta-trasera-moto.webp";

// La guía de moto es una foto real (WebP); la de carro sigue siendo una
// ilustración (SVG) hasta tener sus fotos.
const EXTENSION = { moto: "webp", carro: "svg" } as const;

/**
 * Imagen e instrucción de la guía de cada foto. Un vehículo legacy sin tipo se
 * trata como MOTO, igual que el resto de la app.
 */
export function guiaDeFoto(tipo: TipoFotoGuia, tipoVehiculo: TipoVehiculoGuia | null | undefined) {
  const variante = tipoVehiculo === "CARRO" ? "carro" : "moto";
  if (tipo === "lateral" || tipo === "placa") {
    return { src: `/fotos-guia/${tipo}-${variante}.${EXTENSION[variante]}`, instruccion: INSTRUCCION[tipo] };
  }
  if (tipo === "llanta_trasera" && variante === "moto") {
    return { src: GUIA_LLANTA_TRASERA_MOTO_SRC, instruccion: INSTRUCCION[tipo] };
  }
  return { src: GUIA_LLANTAS_SRC[variante], instruccion: INSTRUCCION[tipo] };
}
