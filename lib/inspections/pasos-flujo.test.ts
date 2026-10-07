import { describe, expect, it } from "vitest";
import { PASOS_INSPECCION, construirPasosFlujo, pasoAnterior, pasoSiguiente } from "@/lib/inspections/pasos-flujo";

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

describe("construirPasosFlujo", () => {
  const catalogo = [
    { nombre: "Documentación", items: [{ id: "d1" }, { id: "d2" }] },
    { nombre: "Inspección Visual", items: [{ id: "v1" }, { id: "v2" }] },
    { nombre: "Fluidos", items: [{ id: "f1" }] },
  ];

  it("sigue el orden de getNextStepPath: kilometraje, checklist ítem por ítem, declaración, fotos, resultado y confirmar", () => {
    expect(construirPasosFlujo(catalogo, "Documentación", 3)).toEqual([
      "medidas",
      "checklist",
      "checklist/v1",
      "checklist/v2",
      "checklist/f1",
      "estado-conductor?paso=1",
      "estado-conductor?paso=2",
      "estado-conductor?paso=3",
      "fotos",
      "resultado",
      "confirmar",
    ]);
  });

  it("la categoría de documentos es UN solo paso (la pantalla de lista) en la posición que ocupa en el catálogo", () => {
    const pasos = construirPasosFlujo(
      [
        { nombre: "Inspección Visual", items: [{ id: "v1" }] },
        { nombre: "Documentación", items: [{ id: "d1" }, { id: "d2" }] },
      ],
      "Documentación",
      3,
    );

    expect(pasos.slice(0, 3)).toEqual(["medidas", "checklist/v1", "checklist"]);
  });

  it("no agrega el paso de la lista si el catálogo no tiene documentos", () => {
    const pasos = construirPasosFlujo([{ nombre: "Fluidos", items: [{ id: "f1" }] }], "Documentación", 3);

    expect(pasos).not.toContain("checklist");
    expect(pasos[1]).toBe("checklist/f1");
  });
});

describe("pasoAnterior / pasoSiguiente", () => {
  const pasos = ["medidas", "checklist", "checklist/v1", "fotos", "confirmar"];

  it("devuelve el paso previo en el orden del flujo", () => {
    expect(pasoAnterior(pasos, "checklist/v1")).toBe("checklist");
    expect(pasoAnterior(pasos, "confirmar")).toBe("fotos");
  });

  it("el primer paso no tiene anterior", () => {
    expect(pasoAnterior(pasos, "medidas")).toBeNull();
  });

  it("un paso desconocido no tiene anterior ni siguiente", () => {
    expect(pasoAnterior(pasos, "checklist/otro")).toBeNull();
    expect(pasoSiguiente(pasos, "checklist/otro")).toBeNull();
  });

  it("devuelve el paso siguiente y null en el último", () => {
    expect(pasoSiguiente(pasos, "medidas")).toBe("checklist");
    expect(pasoSiguiente(pasos, "confirmar")).toBeNull();
  });
});
