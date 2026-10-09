import { describe, expect, it } from "vitest";
import { destinoPorAutorizacion, RUTA_AUTORIZACION } from "@/lib/auth/gate-autorizacion";

describe("destinoPorAutorizacion", () => {
  it.each(["/", "/inspecciones", "/inspecciones/abc/confirmar", "/admin/usuarios", "/dashboard", "/aprobaciones/x"])(
    "sin autorización, %s manda a la pantalla de autorización",
    (pathname) => {
      expect(destinoPorAutorizacion(pathname, false)).toBe(RUTA_AUTORIZACION);
    },
  );

  it("sin autorización, la propia pantalla de autorización se deja abrir", () => {
    expect(destinoPorAutorizacion(RUTA_AUTORIZACION, false)).toBeNull();
  });

  it("con autorización, deja pasar a cualquier página", () => {
    expect(destinoPorAutorizacion("/", true)).toBeNull();
    expect(destinoPorAutorizacion("/inspecciones", true)).toBeNull();
  });

  it("con autorización, no vuelve a mostrar la pantalla: manda al inicio", () => {
    expect(destinoPorAutorizacion(RUTA_AUTORIZACION, true)).toBe("/");
  });

  it("una sesión anterior a esta función (sin el dato) se trata como no autorizada", () => {
    expect(destinoPorAutorizacion("/", undefined)).toBe(RUTA_AUTORIZACION);
  });
});
