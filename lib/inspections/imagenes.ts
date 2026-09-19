import type { TipoVehiculo } from "@/generated/prisma/enums";

/**
 * Imágenes de referencia de un ítem del checklist según el tipo de vehículo.
 * Las preguntas compartidas entre moto y carro (Espejos, Frenos, fluidos)
 * muestran una imagen distinta en cada caso (pedido del dueño de producto,
 * 2026-09-18): `imagenesCarroUrl` reemplaza a `imagenesUrl` solo cuando el
 * vehículo es CARRO y el ítem tiene imagen propia para carro. Un vehículo
 * legacy sin tipo se trata como MOTO (el sistema era solo de motos).
 */
export function imagenesDelItem(
  item: { imagenesUrl: string[]; imagenesCarroUrl: string[] },
  tipoVehiculo: TipoVehiculo | null,
): string[] {
  return tipoVehiculo === "CARRO" && item.imagenesCarroUrl.length > 0 ? item.imagenesCarroUrl : item.imagenesUrl;
}

/** Imagen del odómetro que se muestra en la pantalla de kilometraje. */
export function imagenKilometraje(tipoVehiculo: TipoVehiculo | null): string {
  return tipoVehiculo === "CARRO" ? "/checklist/kilometraje-carro.webp" : "/checklist/kilometraje.png";
}
