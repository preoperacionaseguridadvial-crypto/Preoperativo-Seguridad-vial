import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede, TipoFirma } from "@/generated/prisma/client";
import {
  esRolAprobador,
  esperandoA,
  estadoEtapaOlariari,
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
    revisadaSupervisorOlariariAt: Date | null;
    supervisorId: string | null;
    supervisorOlariariId: string | null;
  }> = {},
) {
  return {
    status: InspectionStatus.PENDIENTE_APROBACION,
    sede: Sede.BOGOTA as Sede | null,
    reviewedAt: null as Date | null,
    revisadaSupervisorOlariariAt: null as Date | null,
    supervisorId: null as string | null,
    supervisorOlariariId: null as string | null,
    ...overrides,
  };
}

describe("esRolAprobador", () => {
  it("solo SUPERVISOR y SUPERVISOR_OLARIARI aprueban", () => {
    expect(esRolAprobador(Role.SUPERVISOR)).toBe(true);
    expect(esRolAprobador(Role.SUPERVISOR_OLARIARI)).toBe(true);
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

  it("Olariari sin la primera etapa espera al Supervisor Olariari", () => {
    expect(etapaPendiente(datos({ sede: Sede.OLARIARI }))).toBe("OLARIARI");
  });

  it("Olariari con la primera etapa aprobada espera al Director", () => {
    expect(etapaPendiente(datos({ sede: Sede.OLARIARI, revisadaSupervisorOlariariAt: AHORA }))).toBe("DIRECTOR");
  });

  it("NO_APTA_PARA_OPERAR también es revisable", () => {
    expect(etapaPendiente(datos({ status: InspectionStatus.NO_APTA_PARA_OPERAR, sede: Sede.OLARIARI }))).toBe("OLARIARI");
  });

  it("una inspección ya decidida o en un estado no revisable no espera a nadie", () => {
    expect(etapaPendiente(datos({ status: InspectionStatus.APROBADA, reviewedAt: AHORA }))).toBeNull();
    expect(etapaPendiente(datos({ status: InspectionStatus.RECHAZADA, reviewedAt: AHORA, sede: Sede.OLARIARI }))).toBeNull();
    expect(etapaPendiente(datos({ status: InspectionStatus.EN_PROCESO }))).toBeNull();
    expect(etapaPendiente(datos({ reviewedAt: AHORA }))).toBeNull();
  });
});

describe("etapaParaRol — le toca a este rol", () => {
  it("el Supervisor Olariari solo actúa en la primera etapa de Olariari", () => {
    expect(etapaParaRol(Role.SUPERVISOR_OLARIARI, datos({ sede: Sede.OLARIARI }))).toBe("OLARIARI");
    expect(etapaParaRol(Role.SUPERVISOR_OLARIARI, datos({ sede: Sede.BOGOTA }))).toBeNull();
    expect(
      etapaParaRol(Role.SUPERVISOR_OLARIARI, datos({ sede: Sede.OLARIARI, revisadaSupervisorOlariariAt: AHORA })),
    ).toBeNull();
  });

  it("el Director actúa en Bogotá, legacy y Olariari ya aprobada por la primera etapa", () => {
    expect(etapaParaRol(Role.SUPERVISOR, datos({ sede: Sede.BOGOTA }))).toBe("DIRECTOR");
    expect(etapaParaRol(Role.SUPERVISOR, datos({ sede: null }))).toBe("DIRECTOR");
    expect(
      etapaParaRol(Role.SUPERVISOR, datos({ sede: Sede.OLARIARI, revisadaSupervisorOlariariAt: AHORA })),
    ).toBe("DIRECTOR");
  });

  it("el Director NO actúa en Olariari antes de la primera etapa", () => {
    expect(etapaParaRol(Role.SUPERVISOR, datos({ sede: Sede.OLARIARI }))).toBeNull();
  });

  it("otros roles nunca tienen turno", () => {
    expect(etapaParaRol(Role.TRABAJADOR, datos())).toBeNull();
    expect(etapaParaRol(Role.DIRECTOR, datos())).toBeNull();
    expect(etapaParaRol(Role.SST, datos())).toBeNull();
  });
});

describe("esperandoA / textoEsperandoAprobacion", () => {
  it("nombra al aprobador con los cargos reales", () => {
    expect(esperandoA(datos({ sede: Sede.OLARIARI }))).toBe(Role.SUPERVISOR_OLARIARI);
    expect(esperandoA(datos())).toBe(Role.SUPERVISOR);
    expect(esperandoA(datos({ reviewedAt: AHORA }))).toBeNull();
    expect(textoEsperandoAprobacion(datos({ sede: Sede.OLARIARI }))).toBe(
      "Esperando aprobación del Supervisor Olariari",
    );
    expect(textoEsperandoAprobacion(datos())).toBe("Esperando aprobación del Director de Operaciones");
    expect(textoEsperandoAprobacion(datos({ reviewedAt: AHORA }))).toBeNull();
  });
});

describe("estadoEtapaOlariari — texto para consulta", () => {
  it("no aplica a Bogotá ni a legacy", () => {
    expect(estadoEtapaOlariari(datos())).toBeNull();
    expect(estadoEtapaOlariari(datos({ sede: null }))).toBeNull();
  });

  it("pendiente de la primera etapa", () => {
    expect(estadoEtapaOlariari(datos({ sede: Sede.OLARIARI }))).toBe("Pendiente Supervisor Olariari");
  });

  it("aprobada por el Supervisor Olariari y pendiente del Director", () => {
    expect(
      estadoEtapaOlariari(datos({ sede: Sede.OLARIARI, revisadaSupervisorOlariariAt: AHORA })),
    ).toBe("Aprobada por Supervisor Olariari · pendiente Director de Operaciones");
  });

  it("rechazada en la primera etapa", () => {
    expect(
      estadoEtapaOlariari(
        datos({
          sede: Sede.OLARIARI,
          status: InspectionStatus.RECHAZADA,
          reviewedAt: AHORA,
          revisadaSupervisorOlariariAt: AHORA,
          supervisorOlariariId: "x",
        }),
      ),
    ).toBe("Rechazada por Supervisor Olariari");
  });

  it("decidida por el Director tras la primera etapa", () => {
    expect(
      estadoEtapaOlariari(
        datos({
          sede: Sede.OLARIARI,
          status: InspectionStatus.APROBADA,
          reviewedAt: AHORA,
          revisadaSupervisorOlariariAt: AHORA,
          supervisorId: "d",
          supervisorOlariariId: "x",
        }),
      ),
    ).toBe("Aprobada por Supervisor Olariari y Director de Operaciones");
    expect(
      estadoEtapaOlariari(
        datos({
          sede: Sede.OLARIARI,
          status: InspectionStatus.RECHAZADA,
          reviewedAt: AHORA,
          revisadaSupervisorOlariariAt: AHORA,
          supervisorId: "d",
          supervisorOlariariId: "x",
        }),
      ),
    ).toBe("Aprobada por Supervisor Olariari · rechazada por Director de Operaciones");
  });
});

describe("tipoFirmaPendiente — firma que le falta a este usuario", () => {
  const base = {
    reviewedAt: null as Date | null,
    revisadaSupervisorOlariariAt: null as Date | null,
    supervisorId: null as string | null,
    supervisorOlariariId: null as string | null,
  };

  it("el Supervisor Olariari firma tras su decisión de la primera etapa", () => {
    const i = { ...base, revisadaSupervisorOlariariAt: AHORA, supervisorOlariariId: "so" };
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLARIARI, "so", i, [])).toBe(TipoFirma.SUPERVISOR_OLARIARI);
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLARIARI, "so", i, [TipoFirma.SUPERVISOR_OLARIARI])).toBeNull();
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLARIARI, "otro", i, [])).toBeNull();
    expect(tipoFirmaPendiente(Role.SUPERVISOR_OLARIARI, "so", base, [])).toBeNull();
  });

  it("el Director firma tras decidir; la firma del Supervisor Olariari no cuenta", () => {
    const i = { ...base, reviewedAt: AHORA, supervisorId: "d", revisadaSupervisorOlariariAt: AHORA, supervisorOlariariId: "so" };
    expect(tipoFirmaPendiente(Role.SUPERVISOR, "d", i, [TipoFirma.SUPERVISOR_OLARIARI])).toBe(TipoFirma.SUPERVISOR);
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
    revisadaSupervisorOlariariAt?: Date | null;
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
        revisadaSupervisorOlariariAt: overrides.revisadaSupervisorOlariariAt ?? null,
      },
    });
  }

  async function ids(role: typeof Role.SUPERVISOR | typeof Role.SUPERVISOR_OLARIARI) {
    const filas = await prisma.inspection.findMany({ where: whereColaPendientes(role), select: { id: true } });
    return filas.map((f) => f.id).sort();
  }

  it("cada rol ve solo su cola", async () => {
    const bogota = await crear({ sede: Sede.BOGOTA });
    const legacy = await crear({ sede: null });
    const olariariEtapa1 = await crear({ sede: Sede.OLARIARI });
    const olariariNoApta = await crear({ sede: Sede.OLARIARI, status: InspectionStatus.NO_APTA_PARA_OPERAR });
    const olariariEtapa2 = await crear({ sede: Sede.OLARIARI, revisadaSupervisorOlariariAt: new Date() });
    await crear({ sede: Sede.BOGOTA, status: InspectionStatus.APROBADA, reviewedAt: new Date() });
    await crear({ sede: Sede.OLARIARI, status: InspectionStatus.EN_PROCESO });
    await crear({
      sede: Sede.OLARIARI,
      status: InspectionStatus.RECHAZADA,
      reviewedAt: new Date(),
      revisadaSupervisorOlariariAt: new Date(),
    });

    expect(await ids(Role.SUPERVISOR_OLARIARI)).toEqual([olariariEtapa1.id, olariariNoApta.id].sort());
    expect(await ids(Role.SUPERVISOR)).toEqual([bogota.id, legacy.id, olariariEtapa2.id].sort());
  });
});
