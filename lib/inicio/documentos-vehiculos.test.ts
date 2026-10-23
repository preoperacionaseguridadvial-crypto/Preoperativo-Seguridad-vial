import { describe, expect, it } from "vitest";
import { resumenDocumentosVehiculos } from "@/lib/inicio/documentos-vehiculos";

describe("resumenDocumentosVehiculos", () => {
  it("sin vehículos por atender está al día", () => {
    expect(resumenDocumentosVehiculos(0)).toEqual({
      alDia: true,
      texto: "Todos los SOAT y tecnomecánicas están al día.",
    });
  });

  it("con un vehículo usa el singular", () => {
    expect(resumenDocumentosVehiculos(1)).toEqual({
      alDia: false,
      texto: "1 vehículo con documentos vencidos o por vencer",
    });
  });

  it("con varios usa el plural", () => {
    expect(resumenDocumentosVehiculos(3)).toEqual({
      alDia: false,
      texto: "3 vehículos con documentos vencidos o por vencer",
    });
  });
});
