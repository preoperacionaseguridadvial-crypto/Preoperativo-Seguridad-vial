import { describe, expect, it } from "vitest";
import { pasosInicio } from "@/lib/inspections/pasos-inicio";

describe("pasosInicio", () => {
  it("lista los 5 pasos de la vista previa en el orden del flujo, sin el de firma", () => {
    const pasos = pasosInicio(24);
    expect(pasos.map((paso) => paso.titulo)).toEqual([
      "Kilometraje",
      "Checklist del vehículo",
      "Declaración del conductor",
      "Fotos del vehículo",
      "Declaración final",
    ]);
    expect(pasos.map((paso) => paso.icono)).toEqual(["kilometraje", "checklist", "conductor", "fotos", "resultado"]);
  });

  it("menciona la cantidad de ítems en el checklist", () => {
    expect(pasosInicio(24)[1].subtitulo).toBe("Documentos y revisión de cada ítem (24 ítems)");
    expect(pasosInicio(1)[1].subtitulo).toBe("Documentos y revisión de cada ítem (1 ítem)");
  });

  it("omite la cantidad cuando no hay catálogo", () => {
    expect(pasosInicio(0)[1].subtitulo).toBe("Documentos y revisión de cada ítem");
  });

  it("describe los demás pasos", () => {
    const subtitulos = pasosInicio(5).map((paso) => paso.subtitulo);
    expect(subtitulos[0]).toBe("Registra el kilometraje actual");
    expect(subtitulos[2]).toBe("3 preguntas sobre tu estado");
    expect(subtitulos[3]).toBe("Foto lateral y foto de la placa");
    expect(subtitulos[4]).toBe("Si la unidad está en condiciones de operar");
  });
});
