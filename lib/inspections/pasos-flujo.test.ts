import { describe, expect, it } from "vitest";
import { PASOS_INSPECCION } from "@/lib/inspections/pasos-flujo";

describe("PASOS_INSPECCION", () => {
  // Mismo orden que `getNextStepPath` (lib/inspections/queries.ts):
  // kilometraje -> checklist -> declaración del conductor -> fotos ->
  // resultado -> confirmar/firmar.
  it("sigue el orden real del flujo guiado del trabajador", () => {
    expect(PASOS_INSPECCION.map((paso) => paso.clave)).toEqual([
      "medidas",
      "checklist",
      "estado-conductor",
      "fotos",
      "resultado",
      "confirmar",
    ]);
  });

  it("cada paso tiene título y descripción", () => {
    for (const paso of PASOS_INSPECCION) {
      expect(paso.titulo.length).toBeGreaterThan(0);
      expect(paso.descripcion.length).toBeGreaterThan(0);
    }
  });
});
