import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";

describe("isPublicPath", () => {
  it("deja pasar el login y los endpoints de NextAuth sin sesión", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/csrf")).toBe(true);
  });

  it("deja leer los textos legales sin sesión (se enlazan desde el login)", () => {
    expect(isPublicPath("/terminos")).toBe(true);
    expect(isPublicPath("/privacidad")).toBe(true);
  });

  it("exige sesión en el resto de la app", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/inspecciones")).toBe(false);
    expect(isPublicPath("/admin/usuarios")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/terminos-falsos")).toBe(false);
  });
});
