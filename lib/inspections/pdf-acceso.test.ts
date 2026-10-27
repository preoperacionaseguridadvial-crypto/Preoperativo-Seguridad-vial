import { describe, expect, it } from "vitest";
import { Role, InspectionStatus } from "@/generated/prisma/client";
import { puedeDescargarPdf } from "@/lib/inspections/pdf-acceso";

describe("puedeDescargarPdf", () => {
  it.each([Role.SST, Role.ADMINISTRADOR])("%s puede descargar inspecciones con resultado", (rol) => {
    for (const status of [
      InspectionStatus.ENVIADA,
      InspectionStatus.PENDIENTE_APROBACION,
      InspectionStatus.APROBADA,
      InspectionStatus.RECHAZADA,
      InspectionStatus.NO_APTA_PARA_OPERAR,
    ]) {
      expect(puedeDescargarPdf(rol, status)).toBe(true);
    }
  });

  it.each([Role.SST, Role.ADMINISTRADOR])("%s no puede descargar inspecciones en proceso ni canceladas", (rol) => {
    expect(puedeDescargarPdf(rol, InspectionStatus.EN_PROCESO)).toBe(false);
    expect(puedeDescargarPdf(rol, InspectionStatus.CANCELADA)).toBe(false);
  });

  it("ningún otro rol puede descargar", () => {
    for (const rol of Object.values(Role).filter((r) => r !== Role.SST && r !== Role.ADMINISTRADOR)) {
      expect(puedeDescargarPdf(rol, InspectionStatus.APROBADA)).toBe(false);
    }
  });
});
