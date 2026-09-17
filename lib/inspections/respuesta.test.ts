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

  it("es false para BAJO — decisión confirmada: solo dato/observación, no novedad", () => {
    expect(esNovedad(RespuestaChecklist.BAJO)).toBe(false);
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

  it("TRIESTADO acepta solo BUENO/BAJO/MALO", () => {
    expect(valoresPermitidos(TipoRespuestaItem.TRIESTADO)).toEqual([
      RespuestaChecklist.BUENO,
      RespuestaChecklist.BAJO,
      RespuestaChecklist.MALO,
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
  it("incluye respuestas en FALLA (binario) y en MALO (triestado)", () => {
    const respuestas = [
      { id: "a", valor: RespuestaChecklist.OK },
      { id: "b", valor: RespuestaChecklist.FALLA },
      { id: "c", valor: RespuestaChecklist.BUENO },
      { id: "d", valor: RespuestaChecklist.BAJO },
      { id: "e", valor: RespuestaChecklist.MALO },
    ];

    const noConformes = filtrarNoConformes(respuestas);

    expect(noConformes.map((r) => r.id)).toEqual(["b", "e"]);
  });

  it("devuelve vacío cuando no hay ninguna respuesta en FALLA o MALO", () => {
    const respuestas = [
      { id: "a", valor: RespuestaChecklist.OK },
      { id: "b", valor: RespuestaChecklist.BUENO },
      { id: "c", valor: RespuestaChecklist.BAJO },
    ];

    expect(filtrarNoConformes(respuestas)).toEqual([]);
  });
});
