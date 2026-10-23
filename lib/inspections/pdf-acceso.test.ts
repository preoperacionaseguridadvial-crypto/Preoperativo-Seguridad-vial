import { describe, expect, it } from "vitest";
import { Role, InspectionStatus } from "@/generated/prisma/client";
import { puedeDescargarPdf } from "@/lib/inspections/pdf-acceso";

describe("puedeDescargarPdf", () => {
  it("SST puede descargar inspecciones con resultado", () => {
    for (const status of [
      InspectionStatus.ENVIADA,
      InspectionStatus.PENDIENTE_APROBACION,
      InspectionStatus.APROBADA,
      InspectionStatus.RECHAZADA,
      InspectionStatus.NO_APTA_PARA_OPERAR,
    ]) {
      expect(puedeDescargarPdf(Role.SST, status)).toBe(true);
    }
  });

  it("SST no puede descargar inspecciones en proceso ni canceladas", () => {
    expect(puedeDescargarPdf(Role.SST, InspectionStatus.EN_PROCESO)).toBe(false);
    expect(puedeDescargarPdf(Role.SST, InspectionStatus.CANCELADA)).toBe(false);
  });

  it("ningún otro rol puede descargar", () => {
    for (const rol of Object.values(Role).filter((r) => r !== Role.SST)) {
      expect(puedeDescargarPdf(rol, InspectionStatus.APROBADA)).toBe(false);
    }
  });
});
