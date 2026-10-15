import { describe, expect, it } from "vitest";
import { resolverModoSeed } from "./seed-modo";

describe("resolverModoSeed", () => {
  it("en desarrollo (sin variables) siembra datos demo y limpia datos de prueba", () => {
    expect(resolverModoSeed({})).toEqual({ produccion: false, datosDemo: true, limpiarDatosPrueba: true });
  });

  it("con NODE_ENV=production solo siembra catálogo: sin demo y sin limpieza", () => {
    expect(resolverModoSeed({ NODE_ENV: "production" })).toEqual({
      produccion: true,
      datosDemo: false,
      limpiarDatosPrueba: false,
    });
  });

  it("con SEED_MODO=produccion también es modo producción aunque NODE_ENV no lo sea", () => {
    expect(resolverModoSeed({ NODE_ENV: "development", SEED_MODO: "produccion" })).toEqual({
      produccion: true,
      datosDemo: false,
      limpiarDatosPrueba: false,
    });
  });

  it("SEED_MODO no puede forzar datos demo en producción", () => {
    expect(resolverModoSeed({ NODE_ENV: "production", SEED_MODO: "desarrollo" }).datosDemo).toBe(false);
  });

  it("ignora mayúsculas y espacios en SEED_MODO", () => {
    expect(resolverModoSeed({ SEED_MODO: "  Produccion " }).produccion).toBe(true);
  });
});
