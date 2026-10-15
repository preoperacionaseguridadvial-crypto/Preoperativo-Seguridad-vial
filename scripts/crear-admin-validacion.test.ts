import { describe, expect, it } from "vitest";
import { describirBase, validarDatosAdmin } from "./crear-admin-validacion";

const validos = {
  nombre: "  Ana Pérez ",
  email: " Ana.Perez@ESS.com.co ",
  cedula: " 1012345678 ",
  password: "ClaveSegura2026",
  confirmacion: "ClaveSegura2026",
};

describe("validarDatosAdmin", () => {
  it("normaliza nombre, email (minúsculas) y cédula", () => {
    expect(validarDatosAdmin(validos)).toEqual({
      ok: true,
      datos: { nombre: "Ana Pérez", email: "ana.perez@ess.com.co", cedula: "1012345678", password: "ClaveSegura2026" },
    });
  });

  it("la cédula es opcional", () => {
    const r = validarDatosAdmin({ ...validos, cedula: "  " });
    expect(r.ok && r.datos.cedula).toBeNull();
  });

  it("exige nombre", () => {
    expect(validarDatosAdmin({ ...validos, nombre: " " })).toEqual({ ok: false, error: "El nombre es obligatorio." });
  });

  it("exige un email con formato válido", () => {
    expect(validarDatosAdmin({ ...validos, email: "ana-sin-arroba" })).toEqual({
      ok: false,
      error: "El email no es válido.",
    });
  });

  it("exige al menos 12 caracteres de contraseña para el administrador", () => {
    expect(validarDatosAdmin({ ...validos, password: "Corta123", confirmacion: "Corta123" })).toEqual({
      ok: false,
      error: "La contraseña debe tener al menos 12 caracteres.",
    });
  });

  it("exige que la confirmación coincida", () => {
    expect(validarDatosAdmin({ ...validos, confirmacion: "OtraClave2026" })).toEqual({
      ok: false,
      error: "Las contraseñas no coinciden.",
    });
  });
});

describe("describirBase", () => {
  it("muestra host y base sin usuario ni contraseña", () => {
    expect(describirBase("postgresql://postgres:s3cr3t@shuttle.proxy.rlwy.net:12345/railway")).toBe(
      "shuttle.proxy.rlwy.net:12345/railway",
    );
  });

  it("devuelve null si la URL no es de Postgres", () => {
    expect(describirBase("mysql://u:p@host/db")).toBeNull();
    expect(describirBase("no es una url")).toBeNull();
  });
});
