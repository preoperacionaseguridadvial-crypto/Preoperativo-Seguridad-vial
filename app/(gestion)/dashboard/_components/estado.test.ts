import { describe, expect, it } from "vitest";
import { segmentosEstado, tonoAprobacion, tonoEstado } from "./estado";

describe("segmentosEstado", () => {
  it("calcula valor, porcentaje y etiqueta interna de cada segmento (caso del panel de referencia)", () => {
    const { total, segmentos } = segmentosEstado({ total: 24, aprobadas: 16, rechazadas: 6, pendientes: 2 });
    expect(total).toBe(24);
    expect(segmentos.map((s) => s.key)).toEqual(["aprobadas", "rechazadas", "pendientes"]);
    expect(segmentos[0]).toMatchObject({ valor: 16, porcentaje: 66.7, etiquetaInterna: "16 (66.7%)" });
    expect(segmentos[1]).toMatchObject({ valor: 6, porcentaje: 25, etiquetaInterna: "6 (25%)" });
    // 8.3% es demasiado angosto para etiquetar dentro del segmento.
    expect(segmentos[2]).toMatchObject({ valor: 2, porcentaje: 8.3, etiquetaInterna: null });
  });

  it("agrega el segmento 'otros' con lo que no es aprobada/rechazada/pendiente para que las partes sumen el total", () => {
    const { total, segmentos } = segmentosEstado({ total: 30, aprobadas: 10, rechazadas: 5, pendientes: 5 });
    expect(total).toBe(30);
    const otros = segmentos.find((s) => s.key === "otros");
    expect(otros).toMatchObject({ valor: 10, porcentaje: 33.3 });
    expect(segmentos.reduce((acc, s) => acc + s.valor, 0)).toBe(30);
  });

  it("no incluye 'otros' cuando no hay resto", () => {
    const { segmentos } = segmentosEstado({ total: 8, aprobadas: 4, rechazadas: 2, pendientes: 2 });
    expect(segmentos.find((s) => s.key === "otros")).toBeUndefined();
  });

  it("segmentos angostos (<10%) no llevan etiqueta interna: la leyenda y el tooltip la cargan", () => {
    const { segmentos } = segmentosEstado({ total: 100, aprobadas: 95, rechazadas: 3, pendientes: 2 });
    expect(segmentos[1].etiquetaInterna).toBeNull();
    expect(segmentos[2].etiquetaInterna).toBeNull();
  });

  it("segmentos medianos (10%-22%) muestran solo el número", () => {
    const { segmentos } = segmentosEstado({ total: 20, aprobadas: 14, rechazadas: 3, pendientes: 3 });
    expect(segmentos[1]).toMatchObject({ porcentaje: 15, etiquetaInterna: "3" });
  });

  it("sin inspecciones devuelve total 0 y ningún porcentaje NaN", () => {
    const { total, segmentos } = segmentosEstado({ total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0 });
    expect(total).toBe(0);
    expect(segmentos.every((s) => s.valor === 0 && s.porcentaje === 0 && s.etiquetaInterna === null)).toBe(true);
  });

  it("si las partes exceden el total declarado, usa la suma de las partes como total", () => {
    const { total } = segmentosEstado({ total: 3, aprobadas: 2, rechazadas: 2, pendientes: 0 });
    expect(total).toBe(4);
  });
});

describe("tonoEstado", () => {
  it("mapea cada estado de inspección a un tono", () => {
    expect(tonoEstado("APROBADA")).toBe("ok");
    expect(tonoEstado("RECHAZADA")).toBe("falla");
    expect(tonoEstado("NO_APTA_PARA_OPERAR")).toBe("falla");
    expect(tonoEstado("PENDIENTE_APROBACION")).toBe("aviso");
    expect(tonoEstado("EN_PROCESO")).toBe("info");
    expect(tonoEstado("ENVIADA")).toBe("info");
    expect(tonoEstado("CANCELADA")).toBe("neutro");
  });

  it("un estado desconocido cae en neutro", () => {
    expect(tonoEstado("OTRO")).toBe("neutro");
  });
});

describe("tonoAprobacion", () => {
  it("sin revisión del supervisor la aprobación está pendiente (aviso), sea cual sea el estado", () => {
    expect(tonoAprobacion(false, "PENDIENTE_APROBACION")).toBe("aviso");
    expect(tonoAprobacion(false, "NO_APTA_PARA_OPERAR")).toBe("aviso");
  });

  it("con revisión refleja el estado final", () => {
    expect(tonoAprobacion(true, "APROBADA")).toBe("ok");
    expect(tonoAprobacion(true, "RECHAZADA")).toBe("falla");
  });
});
