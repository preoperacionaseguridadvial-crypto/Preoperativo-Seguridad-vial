import { describe, expect, it } from "vitest";
import { Role } from "@/generated/prisma/client";
import { puedeAccederARuta, rutaInicioPorRol } from "@/lib/auth/route-roles";

describe("rutaInicioPorRol", () => {
  it("el TRABAJADOR tiene su inicio en /inspecciones", () => {
    expect(rutaInicioPorRol(Role.TRABAJADOR)).toBe("/inspecciones");
  });

  it.each(Object.values(Role).filter((rol) => rol !== Role.TRABAJADOR))("%s se queda en /", (rol) => {
    expect(rutaInicioPorRol(rol)).toBe("/");
  });

  it("el inicio de cada rol es una ruta que el proxy le permite abrir (sin bucles)", () => {
    for (const rol of Object.values(Role)) {
      expect(puedeAccederARuta(rol, rutaInicioPorRol(rol))).toBe(true);
    }
  });
});
