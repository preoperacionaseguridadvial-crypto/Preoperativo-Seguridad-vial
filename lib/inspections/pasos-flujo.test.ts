import { describe, expect, it } from "vitest";
import {
  PASOS_INSPECCION,
  construirPasosFlujo,
  pasoAnterior,
  pasoSiguiente,
  pasosChecklistEnOrden,
} from "@/lib/inspections/pasos-flujo";

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
  // `orden` de cada ítem es GLOBAL (orden del recorrido), no por categoría.
  const catalogo = [
    { nombre: "Documentación", items: [{ id: "d1", orden: 1 }, { id: "d2", orden: 2 }] },
    { nombre: "Inspección Visual", items: [{ id: "v1", orden: 10 }, { id: "v2", orden: 50 }] },
    { nombre: "Fluidos", items: [{ id: "f1", orden: 30 }] },
  ];

  it("kilometraje, documentos (una lista), ítems por orden global, declaración, fotos, resultado y confirmar", () => {
    expect(construirPasosFlujo(catalogo, "Documentación", 3)).toEqual([
      "medidas",
      "checklist",
      "checklist/v1",
      "checklist/f1",
      "checklist/v2",
      "estado-conductor?paso=1",
      "estado-conductor?paso=2",
      "estado-conductor?paso=3",
      "fotos",
      "resultado",
      "confirmar",
    ]);
  });

  it("los ítems de distintas categorías se intercalan según su orden global", () => {
    const pasos = construirPasosFlujo(
      [
        { nombre: "Inspección Visual", items: [{ id: "frenos", orden: 50 }, { id: "espejos", orden: 90 }] },
        { nombre: "Fluidos", items: [{ id: "aceite", orden: 30 }, { id: "refrigerante", orden: 60 }] },
      ],
      "Documentación",
      3,
    );

    expect(pasos.slice(0, 5)).toEqual([
      "medidas",
      "checklist/aceite",
      "checklist/frenos",
      "checklist/refrigerante",
      "checklist/espejos",
    ]);
  });

  it("la categoría de documentos es UN solo paso y va siempre primero, esté donde esté en el catálogo", () => {
    const pasos = construirPasosFlujo(
      [
        { nombre: "Inspección Visual", items: [{ id: "v1", orden: 10 }] },
        { nombre: "Documentación", items: [{ id: "d1", orden: 1 }, { id: "d2", orden: 2 }] },
      ],
      "Documentación",
      3,
    );

    expect(pasos.slice(0, 3)).toEqual(["medidas", "checklist", "checklist/v1"]);
  });

  it("no agrega el paso de la lista si el catálogo no tiene documentos", () => {
    const pasos = construirPasosFlujo([{ nombre: "Fluidos", items: [{ id: "f1", orden: 1 }] }], "Documentación", 3);

    expect(pasos).not.toContain("checklist");
    expect(pasos[1]).toBe("checklist/f1");
  });
});

describe("pasosChecklistEnOrden", () => {
  it("devuelve la lista de documentos primero y luego los ítems por orden global (empate: orden del catálogo)", () => {
    const pasos = pasosChecklistEnOrden(
      [
        { nombre: "A", items: [{ id: "a1", orden: 5 }, { id: "a2", orden: 9 }] },
        { nombre: "Documentación", items: [{ id: "d1", orden: 1 }] },
        { nombre: "B", items: [{ id: "b1", orden: 5 }] },
      ],
      "Documentación",
    );

    expect(pasos).toEqual([
      { tipo: "lista" },
      { tipo: "item", id: "a1", categoria: "A" },
      { tipo: "item", id: "b1", categoria: "B" },
      { tipo: "item", id: "a2", categoria: "A" },
    ]);
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
