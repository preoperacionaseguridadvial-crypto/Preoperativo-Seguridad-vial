import fs from "node:fs";
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { InspeccionParaPdf } from "@/lib/inspections/pdf-queries";
import { TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";
import { categoriasGenericasPdf, clasificarInspeccionVisual, formatoValorItemPdf } from "@/lib/pdf/pdf-helpers";

// Componente de presentación puro: recibe los datos ya resueltos por
// `getInspeccionParaPdf` (lib/inspections/pdf-queries.ts). No accede a
// Prisma ni a `auth()` — eso vive en el route handler
// (app/api/inspecciones/[id]/pdf/route.ts).
//
// La composición reproduce el formato oficial FO-SVS-23 (columna MOTOS),
// verificado celda por celda contra
// `public/FO-SVS-23 Inspeccion Vehiculos V1 (1).xlsx` (ver anchos de
// columna abajo). El Excel es solo la referencia visual: nunca se lee ni
// se sirve desde acá.

// Anchos de columna reales del .xlsx (extraídos de <cols> en el XML del
// sheet): A=8.33 B=11.33 C=12.44 D=9 E=12.89 F=16 -> bloque CARROS (A:F) =
// 69.99. G=12 H=14.89 I=10 J=23.66 -> bloque MOTOS (G:J) = 60.55. Total
// A:J = 130.55. El sistema es exclusivamente de motos: el bloque CARROS se
// conserva en su posición/ancho pero se deja en blanco (sin grilla, sin
// ítems) — no se estira MOTOS a todo el ancho, no se rediseña el formato.
const CARROS_PCT = 54; // 69.99 / 130.55
const MOTOS_PCT = 46; // 60.55 / 130.55

// La zona de resultado + firmas (filas 71-74 del Excel) NO está dividida
// por tipo de vehículo: es un único bloque compartido de ancho A:F (mismo
// 54% de arriba), con el texto instructivo fijo ocupando G:J (46%) al
// lado. Dentro de ese bloque A:F, conductor = A:C (32.10) y
// supervisor = D:F (37.89).
const FIRMA_CONDUCTOR_PCT = 46; // 32.10 / 69.99
const FIRMA_SUPERVISOR_PCT = 54; // 37.89 / 69.99

// Textos literales del formato oficial (tal cual figuran en el Excel,
// incluida su ortografía real — el objetivo es digitalizar el documento,
// no corregirlo).
const TXT = {
  formatoTitulo: "Formato",
  formatoSubtitulo: "Inspeccion Vehiculos",
  codigo: "Codigo:  FO-SVS-23",
  version: "Versión: 1",
  vigencia: "Fecha vigencia: 30/08/2016",
  nivelesBanner: "ANTES DE PRENDER EL MOTOR REVISE NIVELES",
  subtituloLuces: "ENCIENDA LAS LUCES DEL VEHICULO Y VERIFIQUE",
  subtituloEstadoGeneral: "ESTADO GENERAL DEL VEHICULO",
  documentosTitulo: "DOCUMENTOS CONDUCTORES",
  novedadesBanner:
    "EN CASO DE FALLA, DAÑO O FALTANTE DESCRIBA BREVEMENTE, ES OBLIGACION DEL CONDUCTOR REPORTAR LAS FALLAS ANTES DE UTILIZAR EL VEHICULO PARA CUALQUIER OPERACIÓN",
  resultadoTitulo: "LA UNIDAD PUEDE SALIR A OPERAR",
  textoInstructivo:
    "LA UNIDAD DEBE SER REVISADA DE MANERA EFECTIVA, EL CONDUCTOR ESTA CAPACITADO PARA DETERMINAR CUANDO UNA UNIDAD ES RIESGOSA PARA SALIR A OPERAR, SI EL CONDUCTOR DETERMINA QUE LA UNIDAD NO DEBE SALIR LO DEBE SUTENTAR BREVEMENTE",
  declaracion: "El conductor declara que la unidad esta en condiciones de salir a operar.",
  firmaConductor: "NOMBRE Y FIRMA DEL CONDUCTOR",
  firmaSupervisor: "NOMBRE Y FIRMA DEL SUPERVISOR",
  evidenciaFotografica: "EVIDENCIA FOTOGRÁFICA",
  novedadesTitulo: "NOVEDADES",
};

const ESTADO_APROBACION_LABELS: Record<string, string> = {
  PENDIENTE_APROBACION: "PENDIENTE DE APROBACIÓN",
  NO_APTA_PARA_OPERAR: "PENDIENTE DE APROBACIÓN (NO APTA PARA OPERAR)",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
  EN_PROCESO: "EN PROCESO",
  ENVIADA: "ENVIADA",
  CANCELADA: "CANCELADA",
};

const LOGO_PATH = path.join(process.cwd(), "public", "logo", "ess-ltda.png");
const logoBuffer = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 30,
    paddingHorizontal: 22,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  border: { borderWidth: 1, borderColor: "#111111" },

  // Encabezado
  header: { flexDirection: "row", borderWidth: 1, borderColor: "#111111", marginBottom: 4 },
  headerLogoCell: {
    width: "18%",
    borderRightWidth: 1,
    borderColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  headerLogo: { width: 50, height: 56, objectFit: "contain" },
  headerTitleCell: {
    width: "52%",
    borderRightWidth: 1,
    borderColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  headerTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center" },
  headerSubtitle: { fontSize: 11, textAlign: "center", marginTop: 2 },
  headerMetaCell: { width: "30%", justifyContent: "center", padding: 4, gap: 2 },
  headerMetaText: { fontSize: 8 },

  // Datos de la inspección
  datosGrid: { borderWidth: 1, borderColor: "#111111", marginBottom: 4 },
  datosRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111111" },
  datosRowLast: { flexDirection: "row" },
  datosCell: {
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 1,
    borderColor: "#111111",
    padding: 3,
  },
  datosCellLast: { flexGrow: 1, flexBasis: 0, padding: 3 },
  datosLabel: { fontSize: 6.5, color: "#444444" },
  datosValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginTop: 1 },

  // Banner ancho completo
  bannerFull: {
    borderWidth: 1,
    borderColor: "#111111",
    padding: 3,
    marginBottom: 4,
    backgroundColor: "#EFEFEF",
  },
  bannerFullText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textAlign: "center" },

  // Banda checklist: a pedido explícito del usuario (2026-08-21) el bloque
  // MOTOS ocupa el 100% del ancho en vez del 46% original del Excel — ya no
  // se deja el hueco de 54% que ocupaba CARROS en el formato oficial.
  checklistBand: { borderWidth: 1, borderColor: "#111111", marginBottom: 4 },
  motosBlock: { width: "100%" },
  seccionSubtitulo: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#DDDDDD",
    padding: 2,
    borderBottomWidth: 1,
    borderColor: "#111111",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#CCCCCC",
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  itemNombre: { fontSize: 7.5, flexShrink: 1, paddingRight: 4 },
  itemValorOk: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  // Estado intermedio de los ítems TRIESTADO (fluidos en BAJO) — no es una
  // falla (no crea Novedad, ver esNovedad() en lib/inspections/respuesta.ts)
  // pero tampoco es un OK liso, por eso un color propio (ámbar) en vez de
  // reusar itemValorOk/itemValorFalla.
  itemValorWarn: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#B45309" },
  itemValorFalla: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  // Novedades
  novedadesSeccion: { borderWidth: 1, borderColor: "#111111", marginBottom: 4 },
  novedadItem: { borderBottomWidth: 1, borderColor: "#CCCCCC", padding: 4 },
  novedadHeaderRow: { flexDirection: "row", justifyContent: "space-between" },
  novedadItemNombre: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  novedadCampo: { fontSize: 7.5, marginTop: 1 },

  // Resultado + firmas
  resultadoBand: { flexDirection: "row", borderWidth: 1, borderColor: "#111111" },
  resultadoBloqueIzq: { width: `${CARROS_PCT}%` },
  resultadoTituloRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 4,
    borderBottomWidth: 1,
    borderColor: "#111111",
  },
  resultadoTexto: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  resultadoSiNo: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  declaracionTexto: {
    fontSize: 7,
    padding: 4,
    borderBottomWidth: 1,
    borderColor: "#111111",
  },
  firmasRow: { flexDirection: "row" },
  firmaCajaConductor: {
    width: `${FIRMA_CONDUCTOR_PCT}%`,
    borderRightWidth: 1,
    borderColor: "#111111",
    padding: 4,
    minHeight: 70,
  },
  firmaCajaSupervisor: { width: `${FIRMA_SUPERVISOR_PCT}%`, padding: 4, minHeight: 70 },
  firmaImagen: { width: "100%", height: 36, objectFit: "contain", marginVertical: 2 },
  firmaLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textAlign: "center" },
  firmaNombre: { fontSize: 7.5, textAlign: "center", marginTop: 2 },
  firmaCedula: { fontSize: 6.5, color: "#444444", textAlign: "center" },
  firmaFecha: { fontSize: 6, color: "#444444", textAlign: "center" },
  firmaVacia: { fontSize: 6.5, color: "#888888", textAlign: "center", marginTop: 20 },
  resultadoBloqueDer: {
    width: `${MOTOS_PCT}%`,
    borderLeftWidth: 1,
    borderColor: "#111111",
    padding: 5,
  },
  textoInstructivo: { fontSize: 6.5, lineHeight: 1.3 },

  // Estado de aprobación (fuera del cuerpo oficial del formato)
  aprobacionBox: {
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#111111",
    padding: 4,
  },
  aprobacionTitulo: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  aprobacionObservacion: { fontSize: 7.5, marginTop: 2 },

  footer: {
    position: "absolute",
    bottom: 10,
    left: 22,
    right: 22,
    fontSize: 6,
    color: "#888888",
    textAlign: "center",
  },

  // Evidencia fotográfica (páginas separadas)
  evidenciaTitulo: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  fotoBloque: { marginBottom: 12, borderWidth: 1, borderColor: "#111111", padding: 6 },
  fotoInfo: { fontSize: 8, marginBottom: 4 },
  fotoInfoLabel: { fontFamily: "Helvetica-Bold" },
  fotoImagen: { width: "100%", maxHeight: 320, objectFit: "contain" },
});

type Respuesta = InspeccionParaPdf["respuestas"][number];
type Novedad = InspeccionParaPdf["novedades"][number];

function formatFecha(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

function formatFechaHora(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(date);
}

const ESTILO_VALOR_ITEM: Record<ReturnType<typeof formatoValorItemPdf>["estilo"], Style> = {
  ok: styles.itemValorOk,
  warn: styles.itemValorWarn,
  falla: styles.itemValorFalla,
};

function ChecklistItemRow({ respuesta }: { respuesta: Respuesta }) {
  // Cubre tanto BINARIO (OK/FALLA) como TRIESTADO (BUENO/BAJO/MALO, ítems de
  // fluidos) — antes solo distinguía OK de "todo lo demás", ver
  // lib/pdf/pdf-helpers.ts (hallazgo CRITICAL #2/#3 de la corrección Slice 2).
  const { texto, estilo } = formatoValorItemPdf(respuesta.valor);
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemNombre}>{respuesta.checklistItem.nombre}</Text>
      <Text style={ESTILO_VALOR_ITEM[estilo]}>{texto}</Text>
    </View>
  );
}

function FirmaCaja({
  titulo,
  nombre,
  cedula,
  firma,
  estilo,
}: {
  titulo: string;
  nombre: string | null;
  cedula?: string | null;
  firma: { url: string; createdAt: Date } | null | undefined;
  estilo: Style;
}) {
  return (
    <View style={estilo}>
      <Text style={styles.firmaLabel}>{titulo}</Text>
      {firma ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image no acepta alt */}
          <Image src={firma.url} style={styles.firmaImagen} />
          <Text style={styles.firmaNombre}>{nombre ?? "—"}</Text>
          {cedula && <Text style={styles.firmaCedula}>C.C. {cedula}</Text>}
          <Text style={styles.firmaFecha}>{formatFechaHora(firma.createdAt)}</Text>
        </>
      ) : (
        <Text style={styles.firmaVacia}>Sin firma registrada</Text>
      )}
    </View>
  );
}

export function InspeccionPdfDocument({ data }: { data: InspeccionParaPdf }) {
  const categoriasOrdenadas = [...new Map(data.respuestas.map((r) => [r.checklistItem.category.id, r.checklistItem.category])).values()].sort(
    (a, b) => a.orden - b.orden,
  );

  const respuestasPorCategoria = categoriasOrdenadas.map((categoria) => ({
    categoria,
    items: data.respuestas
      .filter((r) => r.checklistItem.categoryId === categoria.id)
      .sort((a, b) => a.checklistItem.orden - b.checklistItem.orden),
  }));

  // "Inspección Visual" se subdivide en dos subtítulos del formato oficial:
  // "ENCIENDA LAS LUCES..." (ítems que mencionan luces) y "ESTADO GENERAL
  // DEL VEHICULO" (el resto). Antes esto se partía por posición fija
  // (`.slice(0,3)`/`.slice(3)`), asumiendo el orden MOTO-only del Slice 1 —
  // el catálogo actual branchea por tipo de vehículo (MOTO 5 ítems / CARRO 6
  // ítems, distinto orden, ver prisma/seed.ts) así que la clasificación
  // ahora es por nombre, no por posición (hallazgo CRITICAL #3 de la
  // corrección Slice 2, ver lib/pdf/pdf-helpers.ts). Se busca la categoría
  // por nombre exacto (fijo en prisma/seed.ts) en vez de por posición, para
  // no romper si algún día cambia el `orden` en la base.
  const visual = respuestasPorCategoria.find((c) => c.categoria.nombre === "Inspección Visual");
  const documentacion = respuestasPorCategoria.find((c) => c.categoria.nombre === "Documentación");

  const { luces: lucesItems, estadoGeneral: estadoGeneralItems } = clasificarInspeccionVisual(
    visual?.items ?? [],
  );
  const documentoItems = documentacion?.items ?? [];
  // Corrección Slice 2 (hallazgo CRITICAL #2): antes solo se renderizaban
  // "Inspección Visual" y "Documentación" — "Fluidos" y "Equipo de
  // prevención" quedaban afuera del PDF aunque `data.respuestas` sí las
  // trajera. `categoriasGenericasPdf` devuelve cualquier categoría sin
  // sección fija propia (genérico: no se hardcodea a esos dos nombres, para
  // no volver a romperse si se agrega una categoría nueva).
  const categoriasGenericas = categoriasGenericasPdf(respuestasPorCategoria);

  const novedades: Novedad[] = data.novedades;
  const novedadesConFotos = novedades.filter((n) => n.photos.length > 0);

  const estadoAprobacionLabel = ESTADO_APROBACION_LABELS[data.status] ?? data.status;
  const decidida = data.reviewedAt !== null;

  // "LA UNIDAD PUEDE SALIR A OPERAR" es el veredicto oficial del formato
  // FO-SVS-23 — lo responde el Supervisor al aprobar/rechazar, no el
  // trabajador (aclaración del dueño de producto, 2026-08-21). Mientras no
  // haya decisión, no se puede afirmar SI ni NO todavía.
  const decisionSupervisor = data.status === "APROBADA" ? "SI" : data.status === "RECHAZADA" ? "NO" : "PENDIENTE";

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ENCABEZADO */}
        <View style={styles.header}>
          <View style={styles.headerLogoCell}>
            {logoBuffer ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image no acepta alt
              <Image src={logoBuffer} style={styles.headerLogo} />
            ) : (
              <Text style={{ fontSize: 6 }}>ESS LTDA</Text>
            )}
          </View>
          <View style={styles.headerTitleCell}>
            <Text style={styles.headerTitle}>{TXT.formatoTitulo}</Text>
            <Text style={styles.headerSubtitle}>{TXT.formatoSubtitulo}</Text>
          </View>
          <View style={styles.headerMetaCell}>
            <Text style={styles.headerMetaText}>{TXT.codigo}</Text>
            <Text style={styles.headerMetaText}>{TXT.version}</Text>
            <Text style={styles.headerMetaText}>{TXT.vigencia}</Text>
          </View>
        </View>

        {/* DATOS DE LA INSPECCIÓN */}
        <View style={styles.datosGrid}>
          <View style={styles.datosRow}>
            <View style={styles.datosCell}>
              <Text style={styles.datosLabel}>Fecha</Text>
              <Text style={styles.datosValue}>{formatFecha(data.startedAt)}</Text>
            </View>
            <View style={styles.datosCell}>
              <Text style={styles.datosLabel}>Hora</Text>
              <Text style={styles.datosValue}>
                {new Intl.DateTimeFormat("es-CO", { timeStyle: "short" }).format(data.startedAt)}
              </Text>
            </View>
            <View style={styles.datosCell}>
              <Text style={styles.datosLabel}>Conductor</Text>
              <Text style={styles.datosValue}>{data.conductor.name}</Text>
            </View>
            <View style={styles.datosCellLast}>
              <Text style={styles.datosLabel}>Fecha Vencimiento Pase / Conductor Activo</Text>
              <Text style={styles.datosValue}>
                {formatFecha(data.conductor.fechaVencimientoPase)} — {data.conductor.conductorActivo ? "Activo" : "Inactivo"}
              </Text>
            </View>
          </View>
          <View style={styles.datosRowLast}>
            <View style={styles.datosCell}>
              <Text style={styles.datosLabel}>Placa de la Unidad</Text>
              <Text style={styles.datosValue}>{data.vehicle.placa}</Text>
            </View>
            <View style={styles.datosCell}>
              <Text style={styles.datosLabel}>Kilometraje</Text>
              <Text style={styles.datosValue}>{data.kilometraje ?? "—"} km</Text>
            </View>
            <View style={styles.datosCell}>
              <Text style={styles.datosLabel}>Quién Hace la Inspección</Text>
              <Text style={styles.datosValue}>{data.worker.name}</Text>
            </View>
            <View style={styles.datosCellLast}>
              <Text style={styles.datosLabel}>Fecha Vencimiento Tecnicomecánica</Text>
              <Text style={styles.datosValue}>{formatFecha(data.vehicle.fechaVencimientoTecnicomecanica)}</Text>
            </View>
          </View>
        </View>

        {/* ESTADO DE APROBACIÓN — fuera del cuerpo oficial del formato; va
            primero para que se vea de entrada en qué quedó la inspección. */}
        <View style={styles.aprobacionBox} wrap={false}>
          <Text style={styles.aprobacionTitulo}>Estado: {estadoAprobacionLabel}</Text>
          {decidida && <Text style={styles.novedadCampo}>Decidida el {formatFechaHora(data.reviewedAt)}</Text>}
          {!data.puedeOperar && data.justificacionNoOperar && (
            <Text style={styles.aprobacionObservacion}>Justificación del conductor: {data.justificacionNoOperar}</Text>
          )}
          {data.status === "RECHAZADA" && data.observacionesSupervisor && (
            <Text style={styles.aprobacionObservacion}>Observación del supervisor: {data.observacionesSupervisor}</Text>
          )}
          {data.status === "APROBADA" && data.observacionesSupervisor && (
            <Text style={styles.aprobacionObservacion}>Observación del supervisor: {data.observacionesSupervisor}</Text>
          )}
        </View>

        {/* BANNER ANCHO COMPLETO (fila 28 del Excel, no exclusivo de carros) */}
        <View style={styles.bannerFull}>
          <Text style={styles.bannerFullText}>{TXT.nivelesBanner}</Text>
        </View>

        {/* CHECKLIST — bloque MOTOS a todo el ancho (ver comentario en
            styles.checklistBand sobre por qué ya no se deja el hueco de
            CARROS acá). */}
        <View style={styles.checklistBand}>
          <View style={styles.motosBlock}>
            <Text style={styles.seccionSubtitulo}>{TXT.subtituloLuces}</Text>
            {lucesItems.map((r) => (
              <ChecklistItemRow key={r.id} respuesta={r} />
            ))}
            <Text style={styles.seccionSubtitulo}>{TXT.subtituloEstadoGeneral}</Text>
            {estadoGeneralItems.map((r) => (
              <ChecklistItemRow key={r.id} respuesta={r} />
            ))}
            <Text style={styles.seccionSubtitulo}>{TXT.documentosTitulo}</Text>
            {documentoItems.map((r) => (
              <ChecklistItemRow key={r.id} respuesta={r} />
            ))}
            {categoriasGenericas.map((c) => (
              <View key={c.categoria.id}>
                <Text style={styles.seccionSubtitulo}>{c.categoria.nombre.toUpperCase()}</Text>
                {c.items.map((r) => (
                  <ChecklistItemRow key={r.id} respuesta={r} />
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* NOVEDADES (solo si existen) */}
        {novedades.length > 0 && (
          <View>
            <View style={styles.bannerFull}>
              <Text style={styles.bannerFullText}>{TXT.novedadesBanner}</Text>
            </View>
            <View style={styles.novedadesSeccion}>
              {novedades.map((novedad) => (
                <View key={novedad.id} style={styles.novedadItem} wrap={false}>
                  <View style={styles.novedadHeaderRow}>
                    <Text style={styles.novedadItemNombre}>
                      {(novedad.inspectionItemResponse?.checklistItem.nombre ?? "Novedad general").toUpperCase()}
                    </Text>
                    <Text style={styles.novedadItemNombre}>X FALLA, DAÑO, FALTANTE</Text>
                  </View>
                  <Text style={styles.novedadCampo}>Tipo: {TIPO_NOVEDAD_LABELS[novedad.tipo]}</Text>
                  {novedad.ubicacion && <Text style={styles.novedadCampo}>Ubicación: {novedad.ubicacion}</Text>}
                  <Text style={styles.novedadCampo}>Descripción: {novedad.descripcion}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* RESULTADO + FIRMAS (bloque compartido, no dividido por tipo de vehículo) */}
        <View style={styles.resultadoBand} wrap={false}>
          <View style={styles.resultadoBloqueIzq}>
            <View style={styles.resultadoTituloRow}>
              <Text style={styles.resultadoTexto}>{TXT.resultadoTitulo}</Text>
              <Text style={styles.resultadoSiNo}>{decisionSupervisor}</Text>
            </View>
            <Text style={styles.declaracionTexto}>
              {TXT.declaracion} {data.puedeOperar === null ? "" : data.puedeOperar ? "(Declaró: SÍ)" : "(Declaró: NO)"}
            </Text>
            <View style={styles.firmasRow}>
              <FirmaCaja
                titulo={TXT.firmaConductor}
                nombre={data.conductor.name}
                cedula={data.conductor.cedula}
                firma={data.firmas.conductor}
                estilo={styles.firmaCajaConductor}
              />
              <FirmaCaja
                titulo={TXT.firmaSupervisor}
                nombre={data.supervisor?.name ?? null}
                cedula={data.supervisor?.cedula}
                firma={data.firmas.supervisor}
                estilo={styles.firmaCajaSupervisor}
              />
            </View>
          </View>
          <View style={styles.resultadoBloqueDer}>
            <Text style={styles.textoInstructivo}>{TXT.textoInstructivo}</Text>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `FO-SVS-23 — ${data.vehicle.placa} — página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>

      {/* EVIDENCIA FOTOGRÁFICA — solo si existen fotos, en página(s) separadas */}
      {novedadesConFotos.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <Text style={styles.evidenciaTitulo}>{TXT.evidenciaFotografica}</Text>
          {novedadesConFotos.map((novedad) =>
            novedad.photos.map((photo) => (
              <View key={photo.id} style={styles.fotoBloque} wrap={false}>
                <Text style={styles.fotoInfo}>
                  <Text style={styles.fotoInfoLabel}>Ítem: </Text>
                  {novedad.inspectionItemResponse?.checklistItem.nombre ?? "Novedad general"}
                  {"   "}
                  <Text style={styles.fotoInfoLabel}>Tipo: </Text>
                  {TIPO_NOVEDAD_LABELS[novedad.tipo]}
                  {"   "}
                  <Text style={styles.fotoInfoLabel}>Ubicación: </Text>
                  {novedad.ubicacion ?? "—"}
                </Text>
                <Text style={styles.fotoInfo}>
                  <Text style={styles.fotoInfoLabel}>Descripción: </Text>
                  {novedad.descripcion}
                </Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image no acepta alt */}
                <Image src={photo.url} style={styles.fotoImagen} />
              </View>
            )),
          )}
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) => `FO-SVS-23 — ${data.vehicle.placa} — página ${pageNumber} de ${totalPages}`}
            fixed
          />
        </Page>
      )}
    </Document>
  );
}
