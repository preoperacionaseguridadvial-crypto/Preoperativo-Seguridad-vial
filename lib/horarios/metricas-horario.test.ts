import { describe, expect, it } from "vitest";
import { Sede } from "@/generated/prisma/enums";
import { decisionesDeInspeccion, minutosEntre, promedioMinutos, type DatosDecision } from "@/lib/horarios/metricas-horario";

// Hora de Bogotá (UTC-5) del 10/10/2026: 12:00 UTC = 7:00 a. m. (dentro de la ventana 5:45-8:00).
const t = (hhmm: string) => new Date(`2026-10-10T${hhmm}:00Z`);

function base(over: Partial<DatosDecision>): DatosDecision {
  return {
    sede: Sede.BOGOTA,
    completedAt: t("12:00"),
    approvedAt: null,
    rejectedAt: null,
    revisadaSupervisorOleariariAt: null,
    supervisorId: null,
    supervisorOleariariId: null,
    ...over,
  };
}

describe("minutosEntre / promedioMinutos", () => {
  it("calcula minutos y promedia con un decimal", () => {
    expect(minutosEntre(t("12:00"), t("12:30"))).toBe(30);
    expect(promedioMinutos([10, 20, 25])).toBe(18.3);
    expect(promedioMinutos([])).toBeNull();
  });
});

describe("decisionesDeInspeccion", () => {
  it("Bogotá: una sola etapa SUPERVISOR desde el envío", () => {
    const d = decisionesDeInspeccion(base({ approvedAt: t("12:20"), supervisorId: "dir" }));
    expect(d).toEqual([{ etapa: "SUPERVISOR", aprobadorId: "dir", minutos: 20, fueraDePlazo: false }]);
  });

  it("marca fuera de plazo desde que cierra la ventana (8:00 a. m. inclusive)", () => {
    const d = decisionesDeInspeccion(base({ rejectedAt: t("13:00"), supervisorId: "dir" }));
    expect(d[0]).toMatchObject({ minutos: 60, fueraDePlazo: true });
    const antes = decisionesDeInspeccion(base({ rejectedAt: t("12:59"), supervisorId: "dir" }));
    expect(antes[0]).toMatchObject({ fueraDePlazo: false });
  });

  it("más de 60 minutos dentro de la ventana no es fuera de plazo", () => {
    const d = decisionesDeInspeccion(base({ completedAt: t("11:00"), approvedAt: t("12:30"), supervisorId: "dir" }));
    expect(d[0]).toMatchObject({ minutos: 90, fueraDePlazo: false });
  });

  it("decidida antes de que abra su ventana cuenta como fuera de plazo", () => {
    // Enviada 10:00 a. m. (15:00 UTC), decidida 3:00 p. m. (20:00 UTC) con habilitación: su ventana abre a las 5:45 p. m.
    const d = decisionesDeInspeccion(base({ completedAt: t("15:00"), approvedAt: t("20:00"), supervisorId: "dir" }));
    expect(d[0]).toMatchObject({ fueraDePlazo: true });
  });

  it("decidida dentro de la ventana siguiente a un envío tardío no es fuera de plazo", () => {
    // Enviada 10:00 a. m., decidida 6:00 p. m. (23:00 UTC).
    const d = decisionesDeInspeccion(base({ completedAt: t("15:00"), approvedAt: t("23:00"), supervisorId: "dir" }));
    expect(d[0]).toMatchObject({ fueraDePlazo: false });
  });

  it("Oleariari aprobada en dos etapas: etapa 1 desde el envío, etapa 2 desde la revisión", () => {
    const d = decisionesDeInspeccion(
      base({
        sede: Sede.OLEARIARI,
        revisadaSupervisorOleariariAt: t("12:10"),
        supervisorOleariariId: "so",
        approvedAt: t("13:30"),
        supervisorId: "dir",
      }),
    );
    expect(d).toEqual([
      { etapa: "SUPERVISOR_OLEARIARI", aprobadorId: "so", minutos: 10, fueraDePlazo: false },
      { etapa: "SUPERVISOR", aprobadorId: "dir", minutos: 80, fueraDePlazo: true },
    ]);
  });

  it("Oleariari rechazada en etapa 1: solo una decisión de etapa 1", () => {
    const d = decisionesDeInspeccion(
      base({
        sede: Sede.OLEARIARI,
        revisadaSupervisorOleariariAt: t("12:15"),
        rejectedAt: t("12:15"),
        supervisorOleariariId: "so",
      }),
    );
    expect(d).toEqual([{ etapa: "SUPERVISOR_OLEARIARI", aprobadorId: "so", minutos: 15, fueraDePlazo: false }]);
  });

  it("Oleariari con etapa 1 hecha y sin decisión final: solo la etapa 1", () => {
    const d = decisionesDeInspeccion(
      base({ sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: t("12:05"), supervisorOleariariId: "so" }),
    );
    expect(d).toHaveLength(1);
  });

  it("sin decisiones o sin envío: lista vacía", () => {
    expect(decisionesDeInspeccion(base({}))).toEqual([]);
    expect(decisionesDeInspeccion(base({ completedAt: null, approvedAt: t("12:20"), supervisorId: "d" }))).toEqual([]);
  });
});
