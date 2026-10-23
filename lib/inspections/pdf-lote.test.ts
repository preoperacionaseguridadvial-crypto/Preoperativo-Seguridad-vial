import { describe, expect, it } from "vitest";
import {
  MAX_PDFS_POR_LOTE,
  contarDescargables,
  nombreArchivoPdf,
  nombreArchivoZip,
  queryStringFiltros,
} from "./pdf-lote";

describe("queryStringFiltros", () => {
  it("omite vacíos y codifica valores", () => {
    expect(
      queryStringFiltros({ conductor: "Juan Pérez", placa: "", estado: "APROBADA", fechaDesde: "2026-10-01", fechaHasta: "" }),
    ).toBe("conductor=Juan+P%C3%A9rez&estado=APROBADA&fechaDesde=2026-10-01");
  });

  it("sin filtros devuelve cadena vacía", () => {
    expect(queryStringFiltros({ conductor: "", placa: "", estado: "", fechaDesde: "", fechaHasta: "" })).toBe("");
  });
});

describe("contarDescargables", () => {
  const lista = [{ status: "APROBADA" }, { status: "EN_PROCESO" }, { status: "CANCELADA" }, { status: "PENDIENTE_APROBACION" }] as const;

  it("SST cuenta solo estados descargables", () => {
    expect(contarDescargables("SST", [...lista])).toBe(2);
  });

  it("otros roles no descargan nada", () => {
    expect(contarDescargables("DIRECTOR", [...lista])).toBe(0);
  });

  it("el tope es 300", () => {
    expect(MAX_PDFS_POR_LOTE).toBe(300);
  });
});

describe("nombreArchivoPdf", () => {
  it("usa placa limpia, día de Bogotá e id", () => {
    // 2026-10-02T03:00Z = 2026-10-01 22:00 en Bogotá
    expect(nombreArchivoPdf({ placa: "ab-12 3", startedAt: new Date("2026-10-02T03:00:00Z"), id: "xyz" })).toBe(
      "FO-SVS-23_ab123_20261001_xyz.pdf",
    );
  });
});

describe("nombreArchivoZip", () => {
  const hoy = new Date("2026-10-23T15:00:00Z");
  it("con rango", () => {
    expect(nombreArchivoZip({ fechaDesde: "2026-10-01", fechaHasta: "2026-10-31" }, hoy)).toBe(
      "inspecciones_2026-10-01_2026-10-31.zip",
    );
  });
  it("solo desde", () => {
    expect(nombreArchivoZip({ fechaDesde: "2026-10-01", fechaHasta: "" }, hoy)).toBe("inspecciones_desde_2026-10-01.zip");
  });
  it("solo hasta", () => {
    expect(nombreArchivoZip({ fechaDesde: "", fechaHasta: "2026-10-31" }, hoy)).toBe("inspecciones_hasta_2026-10-31.zip");
  });
  it("sin rango usa la fecha de hoy (Bogotá)", () => {
    expect(nombreArchivoZip({ fechaDesde: "", fechaHasta: "" }, hoy)).toBe("inspecciones_2026-10-23.zip");
  });
});
