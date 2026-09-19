import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TipoVehiculo } from "@/generated/prisma/enums";
import { imagenKilometraje, imagenesDelItem } from "@/lib/inspections/imagenes";

// Las preguntas compartidas entre moto y carro (Espejos, Frenos, fluidos)
// muestran una imagen distinta según el tipo de vehículo (pedido del dueño de
// producto, 2026-09-18): `imagenesCarroUrl` reemplaza a `imagenesUrl` solo
// cuando el vehículo es CARRO y el ítem tiene imagen propia para carro.
describe("imagenesDelItem", () => {
  const compartido = {
    imagenesUrl: ["/checklist/espejos.jpg"],
    imagenesCarroUrl: ["/checklist/espejos-carro.webp"],
  };

  it("MOTO usa las imágenes de siempre", () => {
    expect(imagenesDelItem(compartido, TipoVehiculo.MOTO)).toEqual(["/checklist/espejos.jpg"]);
  });

  it("CARRO usa las imágenes propias de carro cuando el ítem las tiene", () => {
    expect(imagenesDelItem(compartido, TipoVehiculo.CARRO)).toEqual(["/checklist/espejos-carro.webp"]);
  });

  it("CARRO cae a las imágenes de siempre cuando el ítem no tiene imagen de carro", () => {
    const item = { imagenesUrl: ["/checklist/botiquin.webp"], imagenesCarroUrl: [] };
    expect(imagenesDelItem(item, TipoVehiculo.CARRO)).toEqual(["/checklist/botiquin.webp"]);
  });

  it("un vehículo legacy sin tipo se trata como MOTO (el sistema era solo de motos)", () => {
    expect(imagenesDelItem(compartido, null)).toEqual(["/checklist/espejos.jpg"]);
  });
});

describe("imagenKilometraje", () => {
  it("devuelve el odómetro de carro para CARRO y el de moto para MOTO o sin tipo", () => {
    expect(imagenKilometraje(TipoVehiculo.CARRO)).toBe("/checklist/kilometraje-carro.webp");
    expect(imagenKilometraje(TipoVehiculo.MOTO)).toBe("/checklist/kilometraje.png");
    expect(imagenKilometraje(null)).toBe("/checklist/kilometraje.png");
  });

  it("los archivos existen en public/", () => {
    for (const tipo of [TipoVehiculo.MOTO, TipoVehiculo.CARRO]) {
      expect(existsSync(join(process.cwd(), "public", imagenKilometraje(tipo))), tipo).toBe(true);
    }
  });
});
