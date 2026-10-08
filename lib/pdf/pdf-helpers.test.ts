import { describe, expect, it } from "vitest";
import { RespuestaChecklist, Sede, TipoFirma } from "@/generated/prisma/client";
import { PLACEHOLDER_FECHA_VIGENCIA } from "@/lib/settings/queries";
import {
  cajasFirmaPdf,
  categoriasGenericasPdf,
  clasificarInspeccionVisual,
  fotoPorTipo,
  formatFechaVigenciaPdf,
  formatoValorItemPdf,
  formatSiNoPdf,
  observacionesAprobacionPdf,
} from "@/lib/pdf/pdf-helpers";

// Corrección Slice 2 (hallazgo CRITICAL #3): el PDF partía "Inspección
// Visual" por posición fija (`.slice(0,3)` / `.slice(3)`), asumiendo el
// orden MOTO-only del Slice 1. El catálogo actual (prisma/seed.ts) empieza
// con "Espejos"/"Frenos" (no son de luces) antes de cualquier ítem de luces,
// y el conteo/orden difiere por tipo de vehículo (MOTO 5 ítems, CARRO 6).
// `clasificarInspeccionVisual` clasifica por nombre ("Luces..."), no por
// posición ni cantidad.
describe("clasificarInspeccionVisual", () => {
  function item(nombre: string) {
    return { id: nombre, checklistItem: { nombre } };
  }

  it("catálogo MOTO real (prisma/seed.ts): Espejos y Frenos van a estadoGeneral, no a luces", () => {
    const items = [
      item("Espejos"),
      item("Frenos"),
      item("Luces externas con direccionales"),
      item("Llantas"),
      item("Casco"),
    ];

    const { luces, estadoGeneral } = clasificarInspeccionVisual(items);

    expect(luces.map((i) => i.id)).toEqual(["Luces externas con direccionales"]);
    expect(estadoGeneral.map((i) => i.id)).toEqual(["Espejos", "Frenos", "Llantas", "Casco"]);
  });

  it("catálogo CARRO real (prisma/seed.ts): clasifica igual, con el ítem de luces del texto largo de CARRO", () => {
    const items = [
      item("Espejos"),
      item("Frenos"),
      item("Luces altas, bajas, reversa e internas con direccionales"),
      item("Llantas, incluye repuesto"),
      item("Cinturones de seguridad"),
      item("Limpiabrisas"),
    ];

    const { luces, estadoGeneral } = clasificarInspeccionVisual(items);

    expect(luces.map((i) => i.id)).toEqual(["Luces altas, bajas, reversa e internas con direccionales"]);
    expect(estadoGeneral.map((i) => i.id)).toEqual([
      "Espejos",
      "Frenos",
      "Llantas, incluye repuesto",
      "Cinturones de seguridad",
      "Limpiabrisas",
    ]);
  });

  it("es independiente del orden de entrada (no depende de posición)", () => {
    const items = [item("Casco"), item("Luces externas con direccionales"), item("Espejos")];

    const { luces, estadoGeneral } = clasificarInspeccionVisual(items);

    expect(luces.map((i) => i.id)).toEqual(["Luces externas con direccionales"]);
    expect(estadoGeneral.map((i) => i.id)).toEqual(["Casco", "Espejos"]);
  });
});

// Corrección Slice 2 (hallazgo CRITICAL #2): el PDF solo buscaba
// "Inspección Visual" y "Documentación" por nombre exacto — "Fluidos" y
// "Equipo de prevención" (presentes en `data.respuestas`) nunca se
// renderizaban. `categoriasGenericasPdf` devuelve cualquier categoría que no
// tenga su propia sección fija en el PDF, para que el componente las
// renderice todas (genérico: no hardcodea "Fluidos"/"Equipo de prevención"
// por nombre, así tampoco se rompe si se agrega una categoría nueva).
describe("categoriasGenericasPdf", () => {
  function categoria(nombre: string) {
    return { categoria: { nombre }, items: [] as unknown[] };
  }

  it("excluye Inspección Visual y Documentación (tienen sección fija propia)", () => {
    const respuestasPorCategoria = [
      categoria("Documentación"),
      categoria("Inspección Visual"),
      categoria("Fluidos"),
      categoria("Equipo de prevención"),
    ];

    const genericas = categoriasGenericasPdf(respuestasPorCategoria);

    expect(genericas.map((c) => c.categoria.nombre)).toEqual(["Fluidos", "Equipo de prevención"]);
  });

  it("no omite ninguna categoría genérica aunque solo exista una", () => {
    const respuestasPorCategoria = [categoria("Documentación"), categoria("Fluidos")];

    const genericas = categoriasGenericasPdf(respuestasPorCategoria);

    expect(genericas.map((c) => c.categoria.nombre)).toEqual(["Fluidos"]);
  });
});

// Mismo hallazgo CRITICAL #2/#3: el PDF solo sabía dibujar OK/FALLA
// (binario). Los ítems TRIESTADO de fluidos (BUENO/BAJO/MALO) necesitan su
// propio texto — antes de este fix, un MALO se hubiera mostrado como si
// fuera "OK." (bug de presentación, no solo de omisión de categoría).
describe("formatoValorItemPdf", () => {
  it("BINARIO: OK y FALLA", () => {
    expect(formatoValorItemPdf(RespuestaChecklist.OK)).toEqual({ texto: "✓ OK.", estilo: "ok" });
    expect(formatoValorItemPdf(RespuestaChecklist.FALLA)).toEqual({
      texto: "X FALLA, DAÑO, FALTANTE",
      estilo: "falla",
    });
  });

  it("TRIESTADO: BUENO, BAJO y MALO tienen textos distintos entre sí y de OK/FALLA", () => {
    const bueno = formatoValorItemPdf(RespuestaChecklist.BUENO);
    const bajo = formatoValorItemPdf(RespuestaChecklist.BAJO);
    const malo = formatoValorItemPdf(RespuestaChecklist.MALO);

    expect(bueno.estilo).toBe("ok");
    expect(bajo.estilo).toBe("warn");
    expect(malo.estilo).toBe("falla");

    const textos = new Set([bueno.texto, bajo.texto, malo.texto, "✓ OK.", "X FALLA, DAÑO, FALTANTE"]);
    expect(textos.size).toBe(5);
  });
});

// Corrección Slice 4 (hallazgo CRITICAL #1): `InspeccionPdfDocument`
// imprimía `data.fechaVigencia` tal cual, sin distinguir el placeholder
// sembrado por el seed de una fecha real configurada por un Administrador —
// en el PDF oficial firmado, ambos se veían idénticos. `formatFechaVigenciaPdf`
// marca el placeholder de forma inequívoca para que el componente lo
// resalte visualmente.
describe("formatFechaVigenciaPdf", () => {
  it("marca el placeholder con un sufijo inequívoco y esPlaceholder=true", () => {
    const resultado = formatFechaVigenciaPdf(PLACEHOLDER_FECHA_VIGENCIA);

    expect(resultado.esPlaceholder).toBe(true);
    expect(resultado.texto).toBe(`${PLACEHOLDER_FECHA_VIGENCIA} (SIN CONFIGURAR)`);
  });

  it("devuelve una fecha real configurada tal cual, sin marcar", () => {
    const resultado = formatFechaVigenciaPdf("31/12/2027");

    expect(resultado.esPlaceholder).toBe(false);
    expect(resultado.texto).toBe("31/12/2027");
  });
});

// Fase soporte-moto-carro, Slice 5 (A6/A7): las fotos diarias (LATERAL,
// PLACA) y la declaración de estado del conductor no tenían ninguna
// representación en el PDF. `fotoPorTipo` y `formatSiNoPdf` son la lógica
// pura que el componente necesita para dibujarlas, separada para poder
// testearla sin renderizar PDF/React (mismo criterio que el resto de este
// archivo).
describe("fotoPorTipo", () => {
  function foto(tipo: string) {
    return { id: tipo, tipo, s3Key: `key-${tipo}`, url: `https://s3.example/${tipo}` };
  }

  it("encuentra la foto LATERAL cuando existen ambas", () => {
    const fotos = [foto("LATERAL"), foto("PLACA")];
    expect(fotoPorTipo(fotos, "LATERAL")).toEqual(foto("LATERAL"));
  });

  it("encuentra la foto PLACA cuando existen ambas", () => {
    const fotos = [foto("LATERAL"), foto("PLACA")];
    expect(fotoPorTipo(fotos, "PLACA")).toEqual(foto("PLACA"));
  });

  it("devuelve null si el tipo pedido todavía no se subió", () => {
    const fotos = [foto("LATERAL")];
    expect(fotoPorTipo(fotos, "PLACA")).toBeNull();
  });
});

describe("formatSiNoPdf", () => {
  it("true -> Sí", () => {
    expect(formatSiNoPdf(true)).toBe("Sí");
  });

  it("false -> No", () => {
    expect(formatSiNoPdf(false)).toBe("No");
  });

  it("null (todavía sin responder) -> raya", () => {
    expect(formatSiNoPdf(null)).toBe("—");
  });
});

// roles-oleariari: cuántas cajas de firma lleva el FO-SVS-23 según la sede. La
// inspección de Oleariari pasa por dos aprobadores (3 firmas); la de Bogotá y
// una legacy sin sede, por uno (2 firmas, con la caja del aprobador rotulada
// con el cargo real).
describe("cajasFirmaPdf", () => {
  it("Bogotá: 2 cajas, conductor y Director de Operaciones", () => {
    const cajas = cajasFirmaPdf(Sede.BOGOTA);
    expect(cajas.map((c) => c.tipo)).toEqual([TipoFirma.CONDUCTOR, TipoFirma.SUPERVISOR]);
    expect(cajas.map((c) => c.titulo)).toEqual([
      "NOMBRE Y FIRMA DEL CONDUCTOR",
      "NOMBRE Y FIRMA DEL DIRECTOR DE OPERACIONES",
    ]);
  });

  it("una inspección legacy sin sede se dibuja como Bogotá", () => {
    expect(cajasFirmaPdf(null).map((c) => c.tipo)).toEqual([TipoFirma.CONDUCTOR, TipoFirma.SUPERVISOR]);
    expect(cajasFirmaPdf(undefined)).toHaveLength(2);
  });

  it("Oleariari: 3 cajas, conductor, Supervisor Oleariari y Director de Operaciones", () => {
    const cajas = cajasFirmaPdf(Sede.OLEARIARI);
    expect(cajas.map((c) => c.tipo)).toEqual([
      TipoFirma.CONDUCTOR,
      TipoFirma.SUPERVISOR_OLEARIARI,
      TipoFirma.SUPERVISOR,
    ]);
    expect(cajas.map((c) => c.titulo)).toEqual([
      "NOMBRE Y FIRMA DEL CONDUCTOR",
      "NOMBRE Y FIRMA DEL SUPERVISOR OLEARIARI",
      "NOMBRE Y FIRMA DEL DIRECTOR DE OPERACIONES",
    ]);
  });

  it("los anchos suman 100% para que las cajas entren en el ancho de la página", () => {
    for (const sede of [Sede.BOGOTA, Sede.OLEARIARI, null]) {
      const total = cajasFirmaPdf(sede).reduce((suma, c) => suma + c.anchoPct, 0);
      expect(total).toBeCloseTo(100, 5);
    }
  });
});

describe("observacionesAprobacionPdf", () => {
  const base = {
    status: "APROBADA",
    sede: Sede.OLEARIARI as Sede | null,
    observacionesSupervisor: null as string | null,
    observacionesSupervisorOleariari: null as string | null,
  };

  it("Bogotá aprobada: solo la observación del Director de Operaciones", () => {
    expect(
      observacionesAprobacionPdf({ ...base, sede: Sede.BOGOTA, observacionesSupervisor: "Todo en orden." }),
    ).toEqual(["Observación del Director de Operaciones: Todo en orden."]);
  });

  it("Oleariari: primero la del Supervisor Oleariari, luego la del Director", () => {
    expect(
      observacionesAprobacionPdf({
        ...base,
        observacionesSupervisor: "Conforme.",
        observacionesSupervisorOleariari: "Visto en sitio.",
      }),
    ).toEqual([
      "Observación del Supervisor Oleariari: Visto en sitio.",
      "Observación del Director de Operaciones: Conforme.",
    ]);
  });

  it("rechazada en la primera etapa: solo la del Supervisor Oleariari", () => {
    expect(
      observacionesAprobacionPdf({
        ...base,
        status: "RECHAZADA",
        observacionesSupervisorOleariari: "Falta el casco.",
      }),
    ).toEqual(["Observación del Supervisor Oleariari: Falta el casco."]);
  });

  it("la del Director solo se muestra una vez decidida (aprobada o rechazada)", () => {
    expect(
      observacionesAprobacionPdf({ ...base, status: "PENDIENTE_APROBACION", observacionesSupervisor: "x" }),
    ).toEqual([]);
  });

  it("la del Supervisor Oleariari se muestra aunque la inspección siga pendiente del Director", () => {
    expect(
      observacionesAprobacionPdf({
        ...base,
        status: "PENDIENTE_APROBACION",
        observacionesSupervisorOleariari: "Visto en sitio.",
      }),
    ).toEqual(["Observación del Supervisor Oleariari: Visto en sitio."]);
  });

  it("sin observaciones no devuelve nada", () => {
    expect(observacionesAprobacionPdf(base)).toEqual([]);
  });
});
