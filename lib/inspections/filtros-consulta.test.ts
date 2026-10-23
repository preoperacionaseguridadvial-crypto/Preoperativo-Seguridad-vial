import { describe, expect, it } from "vitest";
import {
  contarPorEstado,
  etiquetaEstado,
  etiquetaConteo,
  parsearFiltrosConsulta,
} from "@/lib/inspections/filtros-consulta";

describe("parsearFiltrosConsulta", () => {
  it("devuelve todo undefined sin parámetros", () => {
    const r = parsearFiltrosConsulta({});
    expect(r.filtros).toEqual({
      conductor: undefined,
      placa: undefined,
      estado: undefined,
      fechaDesde: undefined,
      fechaHasta: undefined,
    });
    expect(r.hayFiltrosActivos).toBe(false);
  });

  it("recorta espacios y trata vacíos como undefined", () => {
    const r = parsearFiltrosConsulta({ conductor: "  Ana  ", placa: "   ", estado: "" });
    expect(r.filtros.conductor).toBe("Ana");
    expect(r.filtros.placa).toBeUndefined();
    expect(r.filtros.estado).toBeUndefined();
    expect(r.hayFiltrosActivos).toBe(true);
  });

  it("valida el estado contra el enum", () => {
    expect(parsearFiltrosConsulta({ estado: "APROBADA" }).filtros.estado).toBe("APROBADA");
    expect(parsearFiltrosConsulta({ estado: "INVENTADO" }).filtros.estado).toBeUndefined();
  });

  it("parsea fechas válidas como medianoche UTC", () => {
    const r = parsearFiltrosConsulta({ fechaDesde: "2026-10-01", fechaHasta: "2026-10-23" });
    expect(r.filtros.fechaDesde?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(r.filtros.fechaHasta?.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  });

  it("ignora fechas inválidas", () => {
    const r = parsearFiltrosConsulta({ fechaDesde: "abc", fechaHasta: "2026-02-31" });
    expect(r.filtros.fechaDesde).toBeUndefined();
    expect(r.filtros.fechaHasta).toBeUndefined();
    expect(r.hayFiltrosActivos).toBe(false);
  });

  it("devuelve los valores crudos para repoblar el formulario", () => {
    const r = parsearFiltrosConsulta({ conductor: " Ana ", estado: "INVENTADO", fechaDesde: "2026-10-01" });
    expect(r.valoresFormulario).toEqual({
      conductor: "Ana",
      placa: "",
      estado: "",
      fechaDesde: "2026-10-01",
      fechaHasta: "",
    });
  });
});

describe("contarPorEstado", () => {
  it("cuenta total, aprobadas, pendientes y canceladas", () => {
    const c = contarPorEstado([
      { status: "APROBADA" },
      { status: "APROBADA" },
      { status: "PENDIENTE_APROBACION" },
      { status: "CANCELADA" },
      { status: "RECHAZADA" },
      { status: "EN_PROCESO" },
    ]);
    expect(c).toEqual({ total: 6, aprobadas: 2, pendientes: 1, canceladas: 1 });
  });

  it("devuelve ceros para lista vacía", () => {
    expect(contarPorEstado([])).toEqual({ total: 0, aprobadas: 0, pendientes: 0, canceladas: 0 });
  });
});

describe("etiquetaConteo", () => {
  it("maneja singular y plural", () => {
    expect(etiquetaConteo(1, "inspección", "inspecciones")).toBe("inspección");
    expect(etiquetaConteo(0, "inspección", "inspecciones")).toBe("inspecciones");
    expect(etiquetaConteo(5, "inspección", "inspecciones")).toBe("inspecciones");
  });
});

describe("etiquetaEstado", () => {
  it("etiqueta los estados", () => {
    expect(etiquetaEstado("PENDIENTE_APROBACION")).toBe("Pendiente");
    expect(etiquetaEstado("CANCELADA")).toBe("Cancelada");
    expect(etiquetaEstado("APROBADA")).toBe("Aprobada");
    expect(etiquetaEstado("NO_APTA_PARA_OPERAR")).toBe("No apta");
    expect(etiquetaEstado("OTRO")).toBe("OTRO");
  });

});
