export type TipoFotoGuia = "lateral" | "placa";
export type TipoVehiculoGuia = "MOTO" | "CARRO";

const INSTRUCCION: Record<TipoFotoGuia, string> = {
  lateral: "Ubícate a 2–3 metros, de lado. Que se vea el vehículo completo, de rueda a rueda.",
  placa: "Acércate a la placa trasera. Que se lean todas las letras y números.",
};

// La guía de moto es una foto real (WebP); la de carro sigue siendo una
// ilustración (SVG) hasta tener sus fotos.
const EXTENSION = { moto: "webp", carro: "svg" } as const;

/**
 * Imagen e instrucción de la guía de cada foto diaria. Un vehículo legacy
 * sin tipo se trata como MOTO, igual que el resto de la app.
 */
export function guiaDeFoto(tipo: TipoFotoGuia, tipoVehiculo: TipoVehiculoGuia | null | undefined) {
  const variante = tipoVehiculo === "CARRO" ? "carro" : "moto";
  return { src: `/fotos-guia/${tipo}-${variante}.${EXTENSION[variante]}`, instruccion: INSTRUCCION[tipo] };
}
