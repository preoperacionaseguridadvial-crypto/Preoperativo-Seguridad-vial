import { describe, expect, it } from "vitest";
import { accionesRapidasPara, puedeExportarExcel } from "./acciones-rapidas";

// Reglas de acceso espejo de proxy.ts / app/api/reportes/excel/route.ts:
// el panel de "Acciones rápidas" solo ofrece enlaces que el rol del visor
// realmente puede abrir (nada que termine en 403 o en redirect).
describe("puedeExportarExcel", () => {
  it("solo DIRECTOR y SST (la ruta responde 403 al resto, incluido ADMINISTRADOR)", () => {
    expect(puedeExportarExcel("DIRECTOR")).toBe(true);
    expect(puedeExportarExcel("SST")).toBe(true);
    expect(puedeExportarExcel("ADMINISTRADOR")).toBe(false);
    expect(puedeExportarExcel("TRABAJADOR")).toBe(false);
  });
});

describe("accionesRapidasPara", () => {
  const urlExcel = "/api/reportes/excel?fechaDesde=2026-09-01";

  it("SST ve todas: consulta, rechazadas, pendientes, Excel y gestión de usuarios", () => {
    const acciones = accionesRapidasPara("SST", urlExcel);
    expect(acciones.map((a) => a.href)).toEqual([
      "/consulta-inspecciones",
      "/consulta-inspecciones?estado=RECHAZADA",
      "/consulta-inspecciones?estado=PENDIENTE_APROBACION",
      urlExcel,
      "/admin/usuarios",
    ]);
  });

  it("DIRECTOR no ve la administración de usuarios (proxy lo redirigiría) pero sí el Excel", () => {
    const hrefs = accionesRapidasPara("DIRECTOR", urlExcel).map((a) => a.href);
    expect(hrefs).toContain(urlExcel);
    expect(hrefs).not.toContain("/admin/usuarios");
  });

  it("ADMINISTRADOR ve usuarios pero no el Excel (la ruta responde 403)", () => {
    const hrefs = accionesRapidasPara("ADMINISTRADOR", urlExcel).map((a) => a.href);
    expect(hrefs).toContain("/admin/usuarios");
    expect(hrefs).not.toContain(urlExcel);
  });

  it("el Excel se marca como descarga (<a> normal) y el resto navega con <Link>", () => {
    const acciones = accionesRapidasPara("SST", urlExcel);
    expect(acciones.find((a) => a.href === urlExcel)?.descarga).toBe(true);
    expect(acciones.filter((a) => a.descarga)).toHaveLength(1);
  });
});
