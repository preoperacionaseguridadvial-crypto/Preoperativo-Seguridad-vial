import { describe, expect, it } from "vitest";
import { InspectionStatus, Sede } from "@/generated/prisma/client";
import { VENTANA_REUSO_INSPECCION_HORAS } from "@/lib/inspections/reuso-inspeccion";
import { accionPrincipalTrabajador, tonoEstadoInspeccion } from "@/lib/inicio/accion-trabajador";

const ahora = new Date("2026-10-07T15:00:00Z");
const HORA = 60 * 60 * 1000;
const hace = (horas: number) => new Date(ahora.getTime() - horas * HORA);

function inspeccion(
  status: InspectionStatus,
  extra: Partial<{
    id: string;
    startedAt: Date;
    completedAt: Date | null;
    reviewedAt: Date | null;
    observacionesSupervisor: string | null;
    sede: Sede | null;
    revisadaSupervisorOleariariAt: Date | null;
    firmaSupervisorOleariari: boolean;
  }> = {},
) {
  return {
    id: "insp-1",
    status,
    startedAt: hace(2),
    completedAt: null,
    reviewedAt: null,
    observacionesSupervisor: null,
    sede: Sede.BOGOTA as Sede | null,
    revisadaSupervisorOleariariAt: null as Date | null,
    firmaSupervisorOleariari: false,
    ...extra,
  };
}

describe("accionPrincipalTrabajador", () => {
  it("sin inspecciones: invita a iniciar una", () => {
    const accion = accionPrincipalTrabajador(null, ahora);
    expect(accion.estado).toBe("INICIAR");
    expect(accion.boton).toEqual({ texto: "Iniciar inspección", href: "/inspecciones" });
  });

  it("EN_PROCESO reciente: continuar esa inspección", () => {
    const accion = accionPrincipalTrabajador(inspeccion(InspectionStatus.EN_PROCESO, { id: "abc" }), ahora);
    expect(accion.estado).toBe("CONTINUAR");
    expect(accion.boton).toEqual({ texto: "Continuar inspección", href: "/inspecciones/abc" });
  });

  // iniciarInspeccion descarta una EN_PROCESO más vieja que la ventana de
  // reuso y abre una nueva: el CTA no puede prometer "continuar" ahí.
  it("EN_PROCESO más vieja que la ventana de reuso: iniciar una nueva", () => {
    const vieja = inspeccion(InspectionStatus.EN_PROCESO, {
      startedAt: hace(VENTANA_REUSO_INSPECCION_HORAS + 1),
    });
    const accion = accionPrincipalTrabajador(vieja, ahora);
    expect(accion.estado).toBe("INICIAR");
    expect(accion.boton?.href).toBe("/inspecciones");
  });

  it.each([InspectionStatus.ENVIADA, InspectionStatus.PENDIENTE_APROBACION])(
    "%s: enviada, esperando aprobación, y permite iniciar una nueva",
    (status) => {
      const accion = accionPrincipalTrabajador(
        inspeccion(status, { completedAt: new Date(ahora.getTime() - 35 * 60_000) }),
        ahora,
      );
      expect(accion.estado).toBe("ESPERANDO");
      expect(accion.titulo).toBe("Esperando aprobación del Director de Operaciones");
      expect(accion.detalle).toBe("Enviada hace 35 min");
      expect(accion.boton).toEqual({ texto: "Hacer una nueva inspección", href: "/inspecciones" });
    },
  );

  it("Oleariari sin la primera etapa: espera al Supervisor Oleariari", () => {
    const accion = accionPrincipalTrabajador(
      inspeccion(InspectionStatus.PENDIENTE_APROBACION, {
        sede: Sede.OLEARIARI,
        completedAt: new Date(ahora.getTime() - 10 * 60_000),
      }),
      ahora,
    );
    expect(accion.estado).toBe("ESPERANDO");
    expect(accion.titulo).toBe("Esperando aprobación del Supervisor Oleariari");
    expect(accion.detalle).toBe("Enviada hace 10 min");
  });

  it("Oleariari aprobada por el Supervisor Oleariari pero sin firmar: espera su firma", () => {
    const accion = accionPrincipalTrabajador(
      inspeccion(InspectionStatus.PENDIENTE_APROBACION, {
        sede: Sede.OLEARIARI,
        revisadaSupervisorOleariariAt: hace(1),
        completedAt: hace(2),
      }),
      ahora,
    );
    expect(accion.titulo).toBe("Esperando la firma del Supervisor Oleariari");
    expect(accion.detalle).toBe("Ya la aprobó el Supervisor Oleariari · Enviada hace 2 h");
  });

  it("Oleariari aprobada y firmada por el Supervisor Oleariari: espera al Director de Operaciones", () => {
    const accion = accionPrincipalTrabajador(
      inspeccion(InspectionStatus.PENDIENTE_APROBACION, {
        sede: Sede.OLEARIARI,
        revisadaSupervisorOleariariAt: hace(1),
        firmaSupervisorOleariari: true,
        completedAt: hace(2),
      }),
      ahora,
    );
    expect(accion.titulo).toBe("Esperando aprobación del Director de Operaciones");
    expect(accion.detalle).toBe("Ya la aprobó el Supervisor Oleariari · Enviada hace 2 h");
  });

  it("APROBADA reciente: muestra aprobada y permite iniciar una nueva", () => {
    const accion = accionPrincipalTrabajador(
      inspeccion(InspectionStatus.APROBADA, { reviewedAt: hace(3) }),
      ahora,
    );
    expect(accion.estado).toBe("APROBADA");
    expect(accion.titulo).toBe("Aprobada");
    expect(accion.detalle).toBe("hace 3 h");
    expect(accion.boton).toEqual({ texto: "Hacer una nueva inspección", href: "/inspecciones" });
  });

  it("RECHAZADA reciente: muestra la observación del supervisor y permite repetir", () => {
    const accion = accionPrincipalTrabajador(
      inspeccion(InspectionStatus.RECHAZADA, {
        reviewedAt: hace(1),
        observacionesSupervisor: "Falta la foto de la placa",
      }),
      ahora,
    );
    expect(accion.estado).toBe("RECHAZADA");
    expect(accion.titulo).toBe("Rechazada");
    expect(accion.detalle).toBe("Falta la foto de la placa");
    expect(accion.boton).toEqual({ texto: "Hacer una nueva inspección", href: "/inspecciones" });
  });

  it("RECHAZADA sin observación: detalle genérico", () => {
    const accion = accionPrincipalTrabajador(inspeccion(InspectionStatus.RECHAZADA), ahora);
    expect(accion.detalle).toBe("No se dejaron observaciones.");
  });

  it("NO_APTA_PARA_OPERAR: avisa que no está apta y permite iniciar una nueva", () => {
    const accion = accionPrincipalTrabajador(inspeccion(InspectionStatus.NO_APTA_PARA_OPERAR), ahora);
    expect(accion.estado).toBe("NO_APTA");
    expect(accion.titulo).toBe("No apta para operar");
    expect(accion.boton).toEqual({ texto: "Hacer una nueva inspección", href: "/inspecciones" });
  });

  it("NO_APTA de Oleariari: nombra a quién la revisa", () => {
    const accion = accionPrincipalTrabajador(
      inspeccion(InspectionStatus.NO_APTA_PARA_OPERAR, { sede: Sede.OLEARIARI }),
      ahora,
    );
    expect(accion.detalle).toBe("Tu vehículo no debe operar hasta que lo revise el Supervisor Oleariari.");
  });

  it.each([
    InspectionStatus.APROBADA,
    InspectionStatus.RECHAZADA,
    InspectionStatus.NO_APTA_PARA_OPERAR,
    InspectionStatus.PENDIENTE_APROBACION,
    InspectionStatus.ENVIADA,
  ])("%s de hace más de la ventana de reuso cuenta como vieja: iniciar una nueva", (status) => {
    const vieja = inspeccion(status, { startedAt: hace(VENTANA_REUSO_INSPECCION_HORAS + 1) });
    const accion = accionPrincipalTrabajador(vieja, ahora);
    expect(accion.estado).toBe("INICIAR");
    expect(accion.boton).toEqual({ texto: "Iniciar inspección", href: "/inspecciones" });
  });
});

describe("tonoEstadoInspeccion", () => {
  it("asigna un tono por estado", () => {
    expect(tonoEstadoInspeccion(InspectionStatus.APROBADA)).toBe("ok");
    expect(tonoEstadoInspeccion(InspectionStatus.RECHAZADA)).toBe("crit");
    expect(tonoEstadoInspeccion(InspectionStatus.NO_APTA_PARA_OPERAR)).toBe("crit");
    expect(tonoEstadoInspeccion(InspectionStatus.PENDIENTE_APROBACION)).toBe("warn");
    expect(tonoEstadoInspeccion(InspectionStatus.ENVIADA)).toBe("warn");
    expect(tonoEstadoInspeccion(InspectionStatus.EN_PROCESO)).toBe("info");
    expect(tonoEstadoInspeccion(InspectionStatus.CANCELADA)).toBe("neutral");
  });
});
