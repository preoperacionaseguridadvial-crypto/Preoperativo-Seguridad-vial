import { describe, expect, it } from "vitest";
import { RespuestaChecklist, TipoRespuestaItem } from "@/generated/prisma/client";
import { esNovedad, filtrarNoConformes, valoresPermitidos } from "@/lib/inspections/respuesta";

// `esNovedad`/`valoresPermitidos` son funciones puras (A2 del design de
// soporte-moto-carro): un solo lugar de verdad para "¿este valor crea una
// Novedad?" y "¿qué valores acepta este ítem?", usado por `responderItem`
// (lib/inspections/actions.ts) y, más adelante, por la UI y el PDF.
describe("esNovedad", () => {
  it("es true para FALLA (binario)", () => {
    expect(esNovedad(RespuestaChecklist.FALLA)).toBe(true);
  });

  it("es true para MALO (triestado)", () => {
    expect(esNovedad(RespuestaChecklist.MALO)).toBe(true);
  });

  // Pedido del dueño de producto (2026-10-19): BAJO reemplaza a MALO en los
  // fluidos y hereda su función — crea Novedad como FALLA.
  it("es true para BAJO (reemplaza a MALO en fluidos)", () => {
    expect(esNovedad(RespuestaChecklist.BAJO)).toBe(true);
  });

  it("es false para OK y BUENO", () => {
    expect(esNovedad(RespuestaChecklist.OK)).toBe(false);
    expect(esNovedad(RespuestaChecklist.BUENO)).toBe(false);
  });
});

describe("valoresPermitidos", () => {
  it("BINARIO acepta solo OK/FALLA", () => {
    expect(valoresPermitidos(TipoRespuestaItem.BINARIO)).toEqual([
      RespuestaChecklist.OK,
      RespuestaChecklist.FALLA,
    ]);
  });

  // Pedido del dueño de producto (2026-10-19): los fluidos solo se marcan
  // Bueno o Bajo; "Malo" ya no es una opción al inspeccionar. MALO sigue en
  // el enum solo para leer inspecciones históricas.
  it("TRIESTADO acepta solo BUENO/BAJO (MALO ya no se ofrece)", () => {
    expect(valoresPermitidos(TipoRespuestaItem.TRIESTADO)).toEqual([
      RespuestaChecklist.BUENO,
      RespuestaChecklist.BAJO,
    ]);
  });
});

// Corrección Slice 2 (hallazgo CRITICAL #5): la pantalla de confirmar
// (app/(worker)/inspecciones/[id]/confirmar/page.tsx), donde el conductor ve
// el resumen justo antes de firmar, filtraba `valor === "FALLA"` a mano en
// vez de reusar `esNovedad()` — un ítem TRIESTADO en MALO (que sí crea
// Novedad) quedaba fuera de "Ítems en falla" y de "Novedades reportadas"
// justo antes de la firma. `filtrarNoConformes` es la única fuente de verdad
// para ese filtro, reusando `esNovedad()`.
describe("filtrarNoConformes", () => {
  it("incluye respuestas en FALLA (binario), BAJO y MALO histórico (triestado)", () => {
    const respuestas = [
      { id: "a", valor: RespuestaChecklist.OK },
      { id: "b", valor: RespuestaChecklist.FALLA },
      { id: "c", valor: RespuestaChecklist.BUENO },
      { id: "d", valor: RespuestaChecklist.BAJO },
      { id: "e", valor: RespuestaChecklist.MALO },
    ];

    const noConformes = filtrarNoConformes(respuestas);

    expect(noConformes.map((r) => r.id)).toEqual(["b", "d", "e"]);
  });

  it("devuelve vacío cuando todas las respuestas son OK o BUENO", () => {
    const respuestas = [
      { id: "a", valor: RespuestaChecklist.OK },
      { id: "b", valor: RespuestaChecklist.BUENO },
    ];

    expect(filtrarNoConformes(respuestas)).toEqual([]);
  });
});
