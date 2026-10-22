import { describe, expect, it } from "vitest";
import {
  COOKIE_SESION_NAVEGADOR,
  esCookieDeSesion,
  recordarDesdeCredenciales,
  sesionExpiradaPorNavegador,
} from "@/lib/auth/recordarme";

describe("sesionExpiradaPorNavegador", () => {
  it("con Recordarme desmarcado y sin marcador (se cerró el navegador) la sesión terminó", () => {
    expect(sesionExpiradaPorNavegador({ recordar: false, tieneMarcador: false })).toBe(true);
  });

  it("con Recordarme desmarcado y el marcador presente la sesión sigue", () => {
    expect(sesionExpiradaPorNavegador({ recordar: false, tieneMarcador: true })).toBe(false);
  });

  it("con Recordarme marcado nunca expira por cerrar el navegador", () => {
    expect(sesionExpiradaPorNavegador({ recordar: true, tieneMarcador: false })).toBe(false);
  });

  it("un token anterior a esta función (sin el dato) se trata como Recordarme marcado", () => {
    expect(sesionExpiradaPorNavegador({ recordar: undefined, tieneMarcador: false })).toBe(false);
  });
});

describe("recordarDesdeCredenciales", () => {
  it("solo el texto 'false' desmarca; cualquier otro valor o ausencia recuerda", () => {
    expect(recordarDesdeCredenciales("false")).toBe(false);
    expect(recordarDesdeCredenciales("true")).toBe(true);
    expect(recordarDesdeCredenciales(undefined)).toBe(true);
  });
});

describe("esCookieDeSesion", () => {
  it("reconoce la cookie de sesión de NextAuth, con prefijo seguro y en trozos", () => {
    expect(esCookieDeSesion("authjs.session-token")).toBe(true);
    expect(esCookieDeSesion("__Secure-authjs.session-token")).toBe(true);
    expect(esCookieDeSesion("authjs.session-token.0")).toBe(true);
  });

  it("no toca otras cookies", () => {
    expect(esCookieDeSesion("authjs.csrf-token")).toBe(false);
    expect(esCookieDeSesion(COOKIE_SESION_NAVEGADOR)).toBe(false);
  });
});
