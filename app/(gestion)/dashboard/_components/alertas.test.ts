import { describe, expect, it } from "vitest";
import { alertasAdicionales, hrefBanner, textoBanner } from "./alertas";

describe("textoBanner", () => {
  it("reproduce el texto del panel de referencia", () => {
    expect(textoBanner(1, 2)).toBe("1 inspección rechazada y 2 pendientes de aprobación requieren tu atención");
  });

  it("pluraliza sustantivos y verbo según las cantidades", () => {
    expect(textoBanner(3, 1)).toBe("3 inspecciones rechazadas y 1 pendiente de aprobación requieren tu atención");
    expect(textoBanner(1, 1)).toBe("1 inspección rechazada y 1 pendiente de aprobación requieren tu atención");
  });

  it("con un solo tipo de alerta nombra la inspección (no queda un 'pendientes' huérfano)", () => {
    expect(textoBanner(2, 0)).toBe("2 inspecciones rechazadas requieren tu atención");
    expect(textoBanner(0, 2)).toBe("2 inspecciones pendientes de aprobación requieren tu atención");
  });

  it("el verbo va en singular solo cuando hay una única inspección en total", () => {
    expect(textoBanner(1, 0)).toBe("1 inspección rechazada requiere tu atención");
    expect(textoBanner(0, 1)).toBe("1 inspección pendiente de aprobación requiere tu atención");
  });

  it("devuelve null cuando no hay nada que atender", () => {
    expect(textoBanner(0, 0)).toBeNull();
  });
});

describe("hrefBanner", () => {
  it("apunta al listado filtrado cuando solo hay un tipo de alerta", () => {
    expect(hrefBanner(2, 0)).toBe("/consulta-inspecciones?estado=RECHAZADA");
    expect(hrefBanner(0, 2)).toBe("/consulta-inspecciones?estado=PENDIENTE_APROBACION");
  });

  it("apunta al listado completo cuando hay ambos tipos", () => {
    expect(hrefBanner(1, 2)).toBe("/consulta-inspecciones");
  });
});

describe("alertasAdicionales", () => {
  it("lista los vehículos con 2 o más novedades, los peores primero, máximo 3", () => {
    const alertas = alertasAdicionales({
      vehiculos: [
        { placa: "AAA111", novedades: 1 },
        { placa: "BBB222", novedades: 2 },
        { placa: "CCC333", novedades: 5 },
        { placa: "DDD444", novedades: 3 },
        { placa: "EEE555", novedades: 4 },
      ],
      topFalla: undefined,
    });
    expect(alertas.map((a) => a.texto)).toEqual([
      "Vehículo CCC333 con 5 novedades en el período",
      "Vehículo EEE555 con 4 novedades en el período",
      "Vehículo DDD444 con 3 novedades en el período",
    ]);
    expect(alertas[0].href).toBe("/consulta-inspecciones?placa=CCC333");
  });

  it("codifica la placa en el href", () => {
    const [alerta] = alertasAdicionales({ vehiculos: [{ placa: "A B&1", novedades: 2 }], topFalla: undefined });
    expect(alerta.href).toBe("/consulta-inspecciones?placa=A%20B%261");
  });

  it("agrega el ítem con más fallas solo si tiene 3 o más, sin link", () => {
    expect(alertasAdicionales({ vehiculos: [], topFalla: { nombre: "Frenos", cantidad: 3 } })).toEqual([
      { texto: "“Frenos” presenta 3 fallas en el período" },
    ]);
    expect(alertasAdicionales({ vehiculos: [], topFalla: { nombre: "Frenos", cantidad: 2 } })).toEqual([]);
  });

  it("sin datos no hay alertas adicionales", () => {
    expect(alertasAdicionales({ vehiculos: [], topFalla: undefined })).toEqual([]);
  });
});
