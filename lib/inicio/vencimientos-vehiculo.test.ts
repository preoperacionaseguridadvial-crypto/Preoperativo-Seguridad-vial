import { describe, expect, it } from "vitest";
import { DIAS_POR_VENCER } from "@/lib/admin/vencimientos";
import { alertasDocumentosVehiculo, chipsDocumentosVehiculo } from "@/lib/inicio/vencimientos-vehiculo";

const ahora = new Date("2026-10-07T15:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const enDias = (dias: number) => new Date(ahora.getTime() + dias * DIA);

describe("alertasDocumentosVehiculo", () => {
  it("sin fechas o vigentes: no hay alertas", () => {
    expect(
      alertasDocumentosVehiculo(
        { fechaVencimientoSoat: null, fechaVencimientoTecnicomecanica: enDias(DIAS_POR_VENCER + 5) },
        ahora,
      ),
    ).toEqual([]);
  });

  it("documento vencido: alerta VENCIDO con el nombre del documento", () => {
    const alertas = alertasDocumentosVehiculo(
      { fechaVencimientoSoat: enDias(-3), fechaVencimientoTecnicomecanica: null },
      ahora,
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ documento: "SOAT", estado: "VENCIDO" });
    expect(alertas[0].texto).toBe("SOAT vencido el 4 oct 2026");
  });

  it("documento por vencer: alerta POR_VENCER con los días que faltan", () => {
    const alertas = alertasDocumentosVehiculo(
      { fechaVencimientoSoat: null, fechaVencimientoTecnicomecanica: enDias(5) },
      ahora,
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ documento: "Tecnomecánica", estado: "POR_VENCER" });
    expect(alertas[0].texto).toBe("Tecnomecánica vence en 5 días");
  });

  it("singular cuando falta un día", () => {
    const [alerta] = alertasDocumentosVehiculo(
      { fechaVencimientoSoat: enDias(1), fechaVencimientoTecnicomecanica: null },
      ahora,
    );
    expect(alerta.texto).toBe("SOAT vence en 1 día");
  });

  it("vence hoy más tarde cuenta como 'hoy'", () => {
    const [alerta] = alertasDocumentosVehiculo(
      { fechaVencimientoSoat: new Date(ahora.getTime() + 60_000), fechaVencimientoTecnicomecanica: null },
      ahora,
    );
    expect(alerta.texto).toBe("SOAT vence hoy");
  });

  it("ordena primero los vencidos y mantiene SOAT antes que tecnomecánica", () => {
    const alertas = alertasDocumentosVehiculo(
      { fechaVencimientoSoat: enDias(10), fechaVencimientoTecnicomecanica: enDias(-1) },
      ahora,
    );
    expect(alertas.map((a) => a.documento)).toEqual(["Tecnomecánica", "SOAT"]);
  });
});

describe("chipsDocumentosVehiculo", () => {
  it("siempre devuelve SOAT y tecnomecánica, con su estado y tono", () => {
    const chips = chipsDocumentosVehiculo(
      { fechaVencimientoSoat: enDias(200), fechaVencimientoTecnicomecanica: enDias(-2) },
      ahora,
    );
    expect(chips).toEqual([
      { documento: "SOAT", estado: "VIGENTE", texto: "SOAT vigente", tono: "ok" },
      { documento: "Tecnomecánica", estado: "VENCIDO", texto: "Tecnomecánica vencida el 5 oct 2026", tono: "crit" },
    ]);
  });

  it("sin fecha cargada: neutral; por vencer: advertencia", () => {
    const chips = chipsDocumentosVehiculo(
      { fechaVencimientoSoat: null, fechaVencimientoTecnicomecanica: enDias(3) },
      ahora,
    );
    expect(chips[0]).toMatchObject({ estado: "SIN_FECHA", texto: "SOAT sin fecha", tono: "neutral" });
    expect(chips[1]).toMatchObject({ estado: "POR_VENCER", texto: "Tecnomecánica vence en 3 días", tono: "warn" });
  });
});
