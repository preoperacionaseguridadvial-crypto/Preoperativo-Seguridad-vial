import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede, TipoFirma } from "@/generated/prisma/client";
import {
  esRolAprobador,
  esperandoA,
  estadoEtapaOleariari,
  etapaParaRol,
  etapaPendiente,
  textoEsperandoAprobacion,
  tipoFirmaPendiente,
  whereColaPendientes,
} from "@/lib/inspections/cola-aprobacion";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

const AHORA = new Date("2026-10-07T15:00:00Z");

function datos(
  overrides: Partial<{
    status: InspectionStatus;
    sede: Sede | null;
    reviewedAt: Date | null;
    revisadaSupervisorOleariariAt: Date | null;
    supervisorId: string | null;
    supervisorOleariariId: string | null;
  }> = {},
) {
  return {
    status: InspectionStatus.PENDIENTE_APROBACION,
    sede: Sede.BOGOTA as Sede | null,
    reviewedAt: null as Date | null,
    revisadaSupervisorOleariariAt: null as Date | null,
    supervisorId: null as string | null,
    supervisorOleariariId: null as string | null,
    ...overrides,
  };
}

describe("esRolAprobador", () => {
  it("solo SUPERVISOR y SUPERVISOR_OLEARIARI aprueban", () => {
    expect(esRolAprobador(Role.SUPERVISOR)).toBe(true);
    expect(esRolAprobador(Role.SUPERVISOR_OLEARIARI)).toBe(true);
    expect(esRolAprobador(Role.TRABAJADOR)).toBe(false);
    expect(esRolAprobador(Role.DIRECTOR)).toBe(false);
    expect(esRolAprobador(Role.SST)).toBe(false);
    expect(esRolAprobador(Role.ADMINISTRADOR)).toBe(false);
  });
});

describe("etapaPendiente — a quién espera la inspección", () => {
  it("Bogotá pendiente espera al Director", () => {
    expect(etapaPendiente(datos())).toBe("DIRECTOR");
  });

  it("una legacy sin sede espera al Director", () => {
    expect(etapaPendiente(datos({ sede: null }))).toBe("DIRECTOR");
  });

  it("Oleariari sin la primera etapa espera al Supervisor Oleariari", () => {
    expect(etapaPendiente(datos({ sede: Sede.OLEARIARI }))).toBe("OLEARIARI");
  });

  it("Oleariari con la primera etapa aprobada espera al Director", () => {
    expect(etapaPendiente(datos({ sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: AHORA }))).toBe("DIRECTOR");
  });

  it("NO_APTA_PARA_OPERAR también es revisable", () => {
    expect(etapaPendiente(datos({ status: InspectionStatus.NO_APTA_PARA_OPERAR, sede: Sede.OLEARIARI }))).toBe("OLEARIARI");
  });

  it("una inspección ya decidida o en un estado no revisable no espera a nadie", () => {
    expect(etapaPendiente(datos({ status: InspectionStatus.APROBADA, reviewedAt: AHORA }))).toBeNull();
    expect(etapaPendiente(datos({ status: InspectionStatus.RECHAZADA, reviewedAt: AHORA, sede: Sede.OLEARIARI }))).toBeNull();
    expect(etapaPendiente(datos({ status: InspectionStatus.EN_PROCESO }))).toBeNull();
    expect(etapaPendiente(datos({ reviewedAt: AHORA }))).toBeNull();
  });
});

describe("etapaParaRol — le toca a este rol", () => {
  it("el Supervisor Oleariari solo actúa en la primera etapa de Oleariari", () => {
    expect(etapaParaRol(Role.SUPERVISOR_OLEARIARI, datos({ sede: Sede.OLEARIARI }))).toBe("OLEARIARI");
    expect(etapaParaRol(Role.SUPERVISOR_OLEARIARI, datos({ sede: Sede.BOGOTA }))).toBeNull();
    expect(
      etapaParaRol(Role.SUPERVISOR_OLEARIARI, datos({ sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: AHORA })),
    ).toBeNull();
  });

  it("el Director actúa en Bogotá, legacy y Oleariari ya aprobada por la primera etapa", () => {
    expect(etapaParaRol(Role.SUPERVISOR, datos({ sede: Sede.BOGOTA }))).toBe("DIRECTOR");
    expect(etapaParaRol(Role.SUPERVISOR, datos({ sede: null }))).toBe("DIRECTOR");
    expect(
      etapaParaRol(Role.SUPERVISOR, datos({ sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: AHORA })),
    ).toBe("DIRECTOR");
  });

  it("el Director NO actúa en Oleariari antes de la primera etapa", () => {
    expect(etapaParaRol(Role.SUPERVISOR, datos({ sede: Sede.OLEARIARI }))).toBeNull();
  });

  it("otros roles nunca tienen turno", () => {
    expect(etapaParaRol(Role.TRABAJADOR, datos())).toBeNull();
    expect(etapaParaRol(Role.DIRECTOR, datos())).toBeNull();
    expect(etapaParaRol(Role.SST, datos())).toBeNull();
  });
});

describe("esperandoA / textoEsperandoAprobacion", () => {
  it("nombra al aprobador con los cargos reales", () => {
    expect(esperandoA(datos({ sede: Sede.OLEARIARI }))).toBe(Role.SUPERVISOR_OLEARIARI);
    expect(esperandoA(datos())).toBe(Role.SUPERVISOR);
    expect(esperandoA(datos({ reviewedAt: AHORA }))).toBeNull();
    expect(textoEsperandoAprobacion(datos({ sede: Sede.OLEARIARI }))).toBe(
      "Esperando aprobación del Supervisor Oleariari",
    );
    expect(textoEsperandoAprobacion(datos())).toBe("Esperando aprobación del Director de Operaciones");
    expect(textoEsperandoAprobacion(datos({ reviewedAt: AHORA }))).toBeNull();
  });
});

describe("estadoEtapaOleariari — texto para consulta", () => {
  it("no aplica a Bogotá ni a legacy", () => {
    expect(estadoEtapaOleariari(datos())).toBeNull();
    expect(estadoEtapaOleariari(datos({ sede: null }))).toBeNull();
  });

  it("pendiente de la primera etapa", () => {
    expect(estadoEtapaOleariari(datos({ sede: Sede.OLEARIARI }))).toBe("Pendiente Supervisor Oleariari");
  });

  it("aprobada por el Supervisor Oleariari y pendiente del Director", () => {
    expect(
      estadoEtapaOleariari(datos({ sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: AHORA })),
    ).toBe("Aprobada por Supervisor Oleariari · pendiente Director de Operaciones");
  });

  it("rechazada en la primera etapa", () => {
    expect(
      estadoEtapaOleariari(
        datos({
          sede: Sede.OLEARIARI,
          status: InspectionStatus.RECHAZADA,
          reviewedAt: AHORA,
          revisadaSupervisorOleariariAt: AHORA,
          supervisorOleariariId: "x",
        }),
      ),
    ).toBe("Rechazada por Supervisor Oleariari");
  });

  it("decidida por el Director tras la primera etapa", () => {
    expect(
      estadoEtapaOleariari(
        datos({
          sede: Sede.OLEARIARI,
          status: InspectionStatus.APROBADA,
          reviewedAt: AHORA,
          revisadaSupervisorOleariariAt: AHORA,
          supervisorId: "d",
          supervisorOleariariId: "x",
        }),
      ),
    ).toBe("Aprobada por Supervisor Oleariari y Director de Operaciones");
    expect(
      estadoEtapaOleariari(
        datos({
          sede: Sede.OLEARIARI,
          status: InspectionStatus.RECHAZADA,
          reviewedAt: AHORA,
          revisadaSupervisorOleariariAt: AHORA,
          supervisorId: "d",
          supervisorOleariariId: "x",
        }),
      ),
    ).toBe("Aprobada por Supervisor Oleariari · rechazada por Director de Operaciones");
  });
});

describe("tipoFirmaPendiente — firma que le falta a este usuario", () => {
  const base = {
    reviewedAt: null as Date | null,
    revisadaSupervisorOleariariAt: null as Date | null,
    supervisorId: null as string | null,
    supervisorOleariariId: null as string | null,
  };

  it("el Supervisor Oleariari firma tras su decisión de la primera etapa", () => {
    const i = { ...base, revisadaSupervisorOleariariAt: AHORA, supervisorOleariariId: "so" };
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLEARIARI, "so", i, [])).toBe(TipoFirma.SUPERVISOR_OLEARIARI);
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLEARIARI, "so", i, [TipoFirma.SUPERVISOR_OLEARIARI])).toBeNull();
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLEARIARI, "otro", i, [])).toBeNull();
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLEARIARI, "so", base, [])).toBeNull();
  });

  it("el Director firma tras decidir; la firma del Supervisor Oleariari no cuenta", () => {
    const i = { ...base, reviewedAt: AHORA, supervisorId: "d", revisadaSupervisorOleariariAt: AHORA, supervisorOleariariId: "so" };
    expect(tipoFirmaPendiente(Role.SUPERVISOR, "d", i, [TipoFirma.SUPERVISOR_OLEARIARI])).toBe(TipoFirma.SUPERVISOR);
    expect(tipoFirmaPendiente(Role.SUPERVISOR, "d", i, [TipoFirma.SUPERVISOR])).toBeNull();
    expect(tipoFirmaPendiente(Role.SUPERVISOR, "otro", i, [])).toBeNull();
    expect(tipoFirmaPendiente(Role.SUPERVISOR, "d", { ...i, reviewedAt: null }, [])).toBeNull();
  });

  it("otros roles no firman como aprobadores", () => {
    const i = { ...base, reviewedAt: AHORA, supervisorId: "x" };
    expect(tipoFirmaPendiente(Role.TRABAJADOR, "x", i, [])).toBeNull();
    expect(tipoFirmaPendiente(Role.SST, "x", i, [])).toBeNull();
  });
});

describe("whereColaPendientes (Postgres real)", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });
  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  async function crear(overrides: {
    sede: Sede | null;
    status?: InspectionStatus;
    reviewedAt?: Date | null;
    revisadaSupervisorOleariariAt?: Date | null;
  }) {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    return prisma.inspection.create({
      data: {
        workerId: worker.id,
        conductorId: worker.id,
        vehicleId: vehicle.id,
        status: overrides.status ?? InspectionStatus.PENDIENTE_APROBACION,
        completedAt: new Date(),
        sede: overrides.sede,
        reviewedAt: overrides.reviewedAt ?? null,
        revisadaSupervisorOleariariAt: overrides.revisadaSupervisorOleariariAt ?? null,
      },
    });
  }

  async function ids(role: typeof Role.SUPERVISOR | typeof Role.SUPERVISOR_OLEARIARI) {
    const filas = await prisma.inspection.findMany({ where: whereColaPendientes(role), select: { id: true } });
    return filas.map((f) => f.id).sort();
  }

  it("cada rol ve solo su cola", async () => {
    const bogota = await crear({ sede: Sede.BOGOTA });
    const legacy = await crear({ sede: null });
    const oleariariEtapa1 = await crear({ sede: Sede.OLEARIARI });
    const oleariariNoApta = await crear({ sede: Sede.OLEARIARI, status: InspectionStatus.NO_APTA_PARA_OPERAR });
    const oleariariEtapa2 = await crear({ sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: new Date() });
    await crear({ sede: Sede.BOGOTA, status: InspectionStatus.APROBADA, reviewedAt: new Date() });
    await crear({ sede: Sede.OLEARIARI, status: InspectionStatus.EN_PROCESO });
    await crear({
      sede: Sede.OLEARIARI,
      status: InspectionStatus.RECHAZADA,
      reviewedAt: new Date(),
      revisadaSupervisorOleariariAt: new Date(),
    });

    expect(await ids(Role.SUPERVISOR_OLEARIARI)).toEqual([oleariariEtapa1.id, oleariariNoApta.id].sort());
    expect(await ids(Role.SUPERVISOR)).toEqual([bogota.id, legacy.id, oleariariEtapa2.id].sort());
  });
});
