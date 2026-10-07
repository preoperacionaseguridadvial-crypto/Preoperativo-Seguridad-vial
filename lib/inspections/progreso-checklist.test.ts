import { describe, expect, it } from "vitest";
import { contarProgresoChecklist } from "@/lib/inspections/progreso-checklist";

describe("contarProgresoChecklist", () => {
  it("catálogo vacío: cero de cero", () => {
    expect(contarProgresoChecklist([])).toEqual({ total: 0, revisados: 0 });
  });

  it("cuenta como revisado todo ítem con respuesta (cualquiera distinta de PENDIENTE)", () => {
    const catalogo = [
      { items: [{ estado: "OK" }, { estado: "FALLA" }, { estado: "PENDIENTE" }] },
      { items: [{ estado: "BUENO" }, { estado: "PENDIENTE" }] },
    ] as const;
    expect(contarProgresoChecklist(catalogo)).toEqual({ total: 5, revisados: 3 });
  });
});
