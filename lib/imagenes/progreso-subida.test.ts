import { describe, expect, it } from "vitest";
import {
  ESTADO_INICIAL_SUBIDA,
  calcularPorcentaje,
  estaOcupada,
  interpretarRespuestaSubida,
  reducirSubida,
  textoProgreso,
  type EstadoSubida,
} from "@/lib/imagenes/progreso-subida";

describe("calcularPorcentaje", () => {
  it("redondea y acota a 0..100", () => {
    expect(calcularPorcentaje(0, 200)).toBe(0);
    expect(calcularPorcentaje(50, 200)).toBe(25);
    expect(calcularPorcentaje(199, 200)).toBe(100);
    expect(calcularPorcentaje(500, 200)).toBe(100);
    expect(calcularPorcentaje(-5, 200)).toBe(0);
  });
  it("total desconocido o cero -> 0 (sin NaN)", () => {
    expect(calcularPorcentaje(10, 0)).toBe(0);
    expect(calcularPorcentaje(10, Number.NaN)).toBe(0);
  });
});

describe("reducirSubida — flujo feliz", () => {
  it("reposo -> optimizando -> subiendo (progreso real) -> guardada", () => {
    let s: EstadoSubida = ESTADO_INICIAL_SUBIDA;
    expect(s.fase).toBe("reposo");
    s = reducirSubida(s, { tipo: "elegida" });
    expect(s).toMatchObject({ fase: "optimizando", porcentaje: 0 });
    s = reducirSubida(s, { tipo: "optimizada" });
    expect(s).toMatchObject({ fase: "subiendo", porcentaje: 0 });
    s = reducirSubida(s, { tipo: "progreso", cargado: 30, total: 120 });
    expect(s).toMatchObject({ fase: "subiendo", porcentaje: 25 });
    s = reducirSubida(s, { tipo: "completada" });
    expect(s).toMatchObject({ fase: "guardada", porcentaje: 100 });
  });

  it("el porcentaje nunca retrocede", () => {
    let s = reducirSubida(reducirSubida(ESTADO_INICIAL_SUBIDA, { tipo: "elegida" }), { tipo: "optimizada" });
    s = reducirSubida(s, { tipo: "progreso", cargado: 80, total: 100 });
    s = reducirSubida(s, { tipo: "progreso", cargado: 10, total: 100 });
    expect(s.porcentaje).toBe(80);
  });
});

describe("reducirSubida — errores y reintento", () => {
  it("el error guarda el mensaje y permite volver a empezar", () => {
    let s = reducirSubida(ESTADO_INICIAL_SUBIDA, { tipo: "elegida" });
    s = reducirSubida(s, { tipo: "error", mensaje: "Sin conexión." });
    expect(s).toMatchObject({ fase: "error", mensaje: "Sin conexión." });
    s = reducirSubida(s, { tipo: "elegida" });
    expect(s).toMatchObject({ fase: "optimizando", porcentaje: 0, mensaje: null });
  });
  it("reintentar tras un error vuelve directo a subir (la foto ya está optimizada)", () => {
    const err = reducirSubida(ESTADO_INICIAL_SUBIDA, { tipo: "error", mensaje: "x" });
    expect(reducirSubida(err, { tipo: "reintentar" })).toMatchObject({
      fase: "subiendo",
      porcentaje: 0,
      mensaje: null,
    });
    const reposo = ESTADO_INICIAL_SUBIDA;
    expect(reducirSubida(reposo, { tipo: "reintentar" })).toBe(reposo);
  });
  it("eventos fuera de fase se ignoran (progreso tardío tras un error)", () => {
    const err = reducirSubida(ESTADO_INICIAL_SUBIDA, { tipo: "error", mensaje: "x" });
    expect(reducirSubida(err, { tipo: "progreso", cargado: 1, total: 2 })).toBe(err);
    expect(reducirSubida(err, { tipo: "completada" })).toBe(err);
  });
  it("una foto nueva no se acepta mientras hay una subida en curso (doble toque)", () => {
    const optimizando = reducirSubida(ESTADO_INICIAL_SUBIDA, { tipo: "elegida" });
    expect(reducirSubida(optimizando, { tipo: "elegida" })).toBe(optimizando);
  });
});

describe("estaOcupada / textoProgreso", () => {
  it("ocupada solo mientras optimiza o sube", () => {
    const fases = ["reposo", "optimizando", "subiendo", "guardada", "error"] as const;
    expect(fases.map((fase) => estaOcupada({ fase, porcentaje: 0, mensaje: null }))).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
  });
  it("textos en español para cada fase", () => {
    const base = { mensaje: null };
    expect(textoProgreso({ ...base, fase: "optimizando", porcentaje: 0 })).toBe("Optimizando foto…");
    expect(textoProgreso({ ...base, fase: "subiendo", porcentaje: 42 })).toBe("Subiendo 42 %");
    expect(textoProgreso({ ...base, fase: "subiendo", porcentaje: 100 })).toBe("Guardando…");
    expect(textoProgreso({ ...base, fase: "guardada", porcentaje: 100 })).toBe("✓ Foto guardada");
    expect(textoProgreso({ ...base, fase: "reposo", porcentaje: 0 })).toBeNull();
  });
});

describe("interpretarRespuestaSubida", () => {
  it("200 + { ok: true } -> ok", () => {
    expect(interpretarRespuestaSubida(200, '{"ok":true}')).toEqual({ ok: true });
  });
  it("error JSON -> su mensaje", () => {
    expect(interpretarRespuestaSubida(400, '{"ok":false,"error":"La foto es muy pesada."}')).toEqual({
      ok: false,
      error: "La foto es muy pesada.",
    });
  });
  it("respuesta que no es JSON (p. ej. redirección al login) -> mensaje de sesión", () => {
    const r = interpretarRespuestaSubida(200, "<html>login</html>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sesión/);
  });
  it("500 sin cuerpo útil -> mensaje genérico", () => {
    const r = interpretarRespuestaSubida(500, "");
    expect(r).toEqual({ ok: false, error: "No se pudo guardar la foto. Intentá de nuevo." });
  });
});
