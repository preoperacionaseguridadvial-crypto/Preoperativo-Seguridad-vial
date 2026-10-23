import { describe, expect, it } from "vitest";
import {
  etiquetaRespuesta,
  etiquetaRespuestaConIcono,
  pistaSiAplica,
} from "@/lib/inspections/etiquetas-respuesta";

describe("etiquetaRespuesta", () => {
  it("muestra OK y FALLA como Bueno y Malo (el valor guardado no cambia)", () => {
    expect(etiquetaRespuesta("OK")).toBe("Bueno");
    expect(etiquetaRespuesta("FALLA")).toBe("Malo");
  });

  it("conserva Bueno, Bajo y Malo de los fluidos / histórico", () => {
    expect(etiquetaRespuesta("BUENO")).toBe("Bueno");
    expect(etiquetaRespuesta("BAJO")).toBe("Bajo");
    expect(etiquetaRespuesta("MALO")).toBe("Malo");
  });
});

describe("etiquetaRespuestaConIcono", () => {
  it("usa ✓ para lo conforme y ✕ para lo que crea novedad", () => {
    expect(etiquetaRespuestaConIcono("OK")).toBe("✓ Bueno");
    expect(etiquetaRespuestaConIcono("BUENO")).toBe("✓ Bueno");
    expect(etiquetaRespuestaConIcono("FALLA")).toBe("✕ Malo");
    expect(etiquetaRespuestaConIcono("MALO")).toBe("✕ Malo");
    expect(etiquetaRespuestaConIcono("BAJO")).toBe("✕ Bajo");
  });
});

describe("pistaSiAplica", () => {
  it("solo MOTO en líquido de frenos y refrigerante", () => {
    expect(pistaSiAplica("MOTO", "Nivel líquido de frenos")).toBe("(si aplica)");
    expect(pistaSiAplica("MOTO", "Nivel refrigerante")).toBe("(si aplica)");
  });

  it("no aplica a CARRO ni a otros ítems de MOTO", () => {
    expect(pistaSiAplica("CARRO", "Nivel líquido de frenos")).toBeNull();
    expect(pistaSiAplica("CARRO", "Nivel refrigerante")).toBeNull();
    expect(pistaSiAplica("MOTO", "Nivel de aceite")).toBeNull();
    expect(pistaSiAplica("MOTO", "Frenos")).toBeNull();
  });

  it("un vehículo legacy sin tipo se trata como MOTO", () => {
    expect(pistaSiAplica(null, "Nivel refrigerante")).toBe("(si aplica)");
  });

  it("ignora tildes y mayúsculas del nombre del ítem", () => {
    expect(pistaSiAplica("MOTO", "NIVEL LIQUIDO DE FRENOS")).toBe("(si aplica)");
  });
});
