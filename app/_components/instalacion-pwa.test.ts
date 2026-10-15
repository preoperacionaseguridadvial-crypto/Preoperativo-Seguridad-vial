import { describe, expect, it } from "vitest";
import { detectarPlataforma, DIAS_SILENCIO, debeMostrarAviso } from "@/app/_components/instalacion-pwa";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1";
const ESCRITORIO =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

describe("detectarPlataforma", () => {
  it("reconoce Android", () => {
    expect(detectarPlataforma(ANDROID_CHROME)).toBe("android");
  });

  it("reconoce iPhone en Safari", () => {
    expect(detectarPlataforma(IPHONE_SAFARI)).toBe("ios");
  });

  it("reconoce iPhone en otro navegador (no puede instalar desde ahí)", () => {
    expect(detectarPlataforma(IPHONE_CHROME)).toBe("ios-otro-navegador");
  });

  it("trata el escritorio como no móvil", () => {
    expect(detectarPlataforma(ESCRITORIO)).toBe("escritorio");
  });
});

describe("debeMostrarAviso", () => {
  const ahora = new Date("2026-10-15T12:00:00Z").getTime();
  const base = { plataforma: "android" as const, instalada: false, descartadoEn: null, ahora };

  it("se muestra en un celular sin la app instalada", () => {
    expect(debeMostrarAviso(base)).toBe(true);
  });

  it("no se muestra si la app ya está abierta como instalada", () => {
    expect(debeMostrarAviso({ ...base, instalada: true })).toBe(false);
  });

  it("no se muestra en escritorio", () => {
    expect(debeMostrarAviso({ ...base, plataforma: "escritorio" })).toBe(false);
  });

  it("respeta el descarte durante los días de silencio", () => {
    const ayer = ahora - 24 * 60 * 60 * 1000;
    expect(debeMostrarAviso({ ...base, descartadoEn: ayer })).toBe(false);
  });

  it("vuelve a mostrarse cuando pasan los días de silencio", () => {
    const vencido = ahora - (DIAS_SILENCIO + 1) * 24 * 60 * 60 * 1000;
    expect(debeMostrarAviso({ ...base, descartadoEn: vencido })).toBe(true);
  });
});
