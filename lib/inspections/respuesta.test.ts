import { describe, expect, it } from "vitest";
import { RespuestaChecklist, TipoRespuestaItem } from "@/generated/prisma/client";
import { esNovedad, valoresPermitidos } from "@/lib/inspections/respuesta";

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
