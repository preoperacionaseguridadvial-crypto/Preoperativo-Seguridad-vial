import { describe, expect, it } from "vitest";
import { Role, Sede } from "@/generated/prisma/enums";
import { construirMensaje, planDeEvento } from "@/lib/notificaciones/mensajes-inspeccion";

const DATOS = { inspectionId: "insp1", placa: "ABC123", trabajador: "Juan Pérez" };

describe("planDeEvento", () => {
  it("ENVIADA en Bogotá o sin sede: Director de Operaciones + SST", () => {
    const esperado = [
      { audiencia: "APROBADOR", roles: [Role.SUPERVISOR] },
      { audiencia: "SST", roles: [Role.SST] },
    ];
    expect(planDeEvento("ENVIADA", Sede.BOGOTA)).toEqual(esperado);
    expect(planDeEvento("ENVIADA", null)).toEqual(esperado);
  });

  it("ENVIADA en Oleariari: Supervisor Oleariari + SST", () => {
    expect(planDeEvento("ENVIADA", Sede.OLEARIARI)).toEqual([
      { audiencia: "APROBADOR", roles: [Role.SUPERVISOR_OLEARIARI] },
      { audiencia: "SST", roles: [Role.SST] },
    ]);
  });

  it("primera etapa de Oleariari aprobada: solo SST (el Director la ve recién con la firma)", () => {
    expect(planDeEvento("REVISADA_SUPERVISOR_OLEARIARI", Sede.OLEARIARI)).toEqual([
      { audiencia: "SST", roles: [Role.SST] },
    ]);
  });

  it("pasa al Director (firma de la primera etapa): solo el Director", () => {
    expect(planDeEvento("PENDIENTE_DIRECTOR", Sede.OLEARIARI)).toEqual([
      { audiencia: "APROBADOR", roles: [Role.SUPERVISOR] },
    ]);
  });

  it.each(["APROBADA", "RECHAZADA"] as const)("%s: el trabajador + SST", (evento) => {
    expect(planDeEvento(evento, Sede.BOGOTA)).toEqual([
      { audiencia: "TRABAJADOR", roles: [] },
      { audiencia: "SST", roles: [Role.SST] },
    ]);
  });
});

describe("construirMensaje", () => {
  it("ENVIADA al aprobador: va al detalle de aprobación e incluye placa y trabajador", () => {
    const m = construirMensaje("ENVIADA", "APROBADOR", DATOS);
    expect(m.url).toBe("/aprobaciones/insp1");
    expect(m.titulo).toMatch(/por revisar/i);
    expect(m.cuerpo).toContain("ABC123");
    expect(m.cuerpo).toContain("Juan Pérez");
    expect(m.tag).toBe("inspeccion-insp1");
  });

  it("ENVIADA a SST: va a la consulta", () => {
    expect(construirMensaje("ENVIADA", "SST", DATOS).url).toBe("/consulta-inspecciones/insp1");
  });

  it("ENVIADA como no apta: lo dice en el cuerpo", () => {
    expect(construirMensaje("ENVIADA", "APROBADOR", { ...DATOS, noApta: true }).cuerpo).toMatch(/no apto/i);
    expect(construirMensaje("ENVIADA", "APROBADOR", DATOS).cuerpo).not.toMatch(/no apto/i);
  });

  it("REVISADA_SUPERVISOR_OLEARIARI a SST: indica la primera etapa", () => {
    const m = construirMensaje("REVISADA_SUPERVISOR_OLEARIARI", "SST", DATOS);
    expect(m.titulo).toMatch(/Supervisor Oleariari/);
    expect(m.url).toBe("/consulta-inspecciones/insp1");
  });

  it("PENDIENTE_DIRECTOR al aprobador: va al detalle de aprobación", () => {
    const m = construirMensaje("PENDIENTE_DIRECTOR", "APROBADOR", DATOS);
    expect(m.url).toBe("/aprobaciones/insp1");
    expect(m.cuerpo).toContain("ABC123");
  });

  it("APROBADA al trabajador: va a la pantalla de su inspección y dice quién aprobó", () => {
    const m = construirMensaje("APROBADA", "TRABAJADOR", { ...DATOS, decididoPor: "Director de Operaciones" });
    expect(m.url).toBe("/inspecciones/insp1/enviada");
    expect(m.titulo).toMatch(/aprobada/i);
    expect(m.cuerpo).toContain("Director de Operaciones");
  });

  it("RECHAZADA al trabajador: incluye quién y el motivo", () => {
    const m = construirMensaje("RECHAZADA", "TRABAJADOR", {
      ...DATOS,
      decididoPor: "Supervisor Oleariari",
      observacion: "Falta la foto de la placa",
    });
    expect(m.titulo).toMatch(/rechazada/i);
    expect(m.cuerpo).toContain("Supervisor Oleariari");
    expect(m.cuerpo).toContain("Falta la foto de la placa");
  });

  it("RECHAZADA a SST: nombra al trabajador y va a la consulta", () => {
    const m = construirMensaje("RECHAZADA", "SST", { ...DATOS, decididoPor: "Director de Operaciones", observacion: "x" });
    expect(m.cuerpo).toContain("Juan Pérez");
    expect(m.url).toBe("/consulta-inspecciones/insp1");
  });

  it("recorta una observación larga", () => {
    const m = construirMensaje("RECHAZADA", "TRABAJADOR", { ...DATOS, observacion: "a".repeat(500) });
    expect(m.cuerpo.length).toBeLessThan(250);
    expect(m.cuerpo).toContain("…");
  });

  it("decisión sin quién ni motivo: igual arma un texto válido", () => {
    expect(construirMensaje("APROBADA", "SST", DATOS).cuerpo).toContain("ABC123");
    expect(construirMensaje("RECHAZADA", "TRABAJADOR", DATOS).cuerpo).not.toMatch(/undefined|null/);
  });
});
