import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth/config";
import { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import { estadoLegible, parseFiltrosDesdeQuery } from "@/lib/inspections/reportes-queries";
import { getReporteHorarios, type ReporteHorarios } from "@/lib/horarios/reportes-horario";
import { ETIQUETA_ETAPA } from "@/lib/horarios/metricas-horario";
import { claveDiaBogota, formatFechaCorta, formatFechaHora, formatHora } from "@/lib/fechas/formato";

// Node.js (exceljs no corre en Edge Runtime) — mismo criterio que
// app/api/inspecciones/[id]/pdf/route.ts.
export const runtime = "nodejs";

// Nunca cachear: el Excel tiene que reflejar los filtros y el estado real
// de cada request, igual que el PDF individual.
export const dynamic = "force-dynamic";

/**
 * Exporta a `.xlsx` el detalle tabular de inspecciones que cumplen los
 * filtros del dashboard "Informes de Gerencia" — es la contraparte de
 * "Descargar PDF" (que sigue siendo por inspección puntual, formato oficial
 * FO-SVS-23, sin cambios). Este Excel es solo datos/reportes, no reemplaza
 * ni modifica el PDF individual.
 *
 * Autorización: mismo criterio que protege /dashboard en proxy.ts
 * (DIRECTOR/SST) — se revalida acá porque un Route Handler no pasa por el
 * middleware de rutas de página.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (session.user.role !== "DIRECTOR" && session.user.role !== "SST") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filtrosReporte = parseFiltrosDesdeQuery(query);

  const inspecciones = await getAllInspeccionesForOversight({
    conductor: undefined,
    placa: query.placa || undefined,
    estado: filtrosReporte.status,
    fechaDesde: filtrosReporte.fechaDesde,
    fechaHasta: filtrosReporte.fechaHasta,
    workerId: filtrosReporte.workerId,
    supervisorId: filtrosReporte.supervisorId,
    puedeOperar: filtrosReporte.puedeOperar,
    sede: filtrosReporte.sede,
  });
  const horarios = await getReporteHorarios(filtrosReporte);

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Inspecciones");

  hoja.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Hora", key: "hora", width: 10 },
    { header: "Recorredor", key: "trabajador", width: 24 },
    { header: "Placa", key: "placa", width: 12 },
    { header: "Kilometraje", key: "kilometraje", width: 14 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Resultado", key: "resultado", width: 12 },
    { header: "Novedades", key: "novedades", width: 12 },
    { header: "Director de Operaciones", key: "supervisor", width: 24 },
    { header: "Aprobación", key: "aprobacion", width: 30 },
  ];
  hoja.getRow(1).font = { bold: true };

  // Fecha y hora van como TEXTO ya en hora de Colombia (no como celdas Date): una
  // celda Date de Excel no lleva zona y se vería en la zona del servidor/lector.
  for (const inspection of inspecciones) {
    hoja.addRow({
      fecha: formatFechaCorta(inspection.startedAt),
      hora: formatHora(inspection.startedAt),
      trabajador: inspection.worker.name,
      placa: inspection.vehicle.placa,
      kilometraje: inspection.kilometraje ?? "",
      estado: estadoLegible(inspection.status),
      resultado: inspection.puedeOperar === null ? "" : inspection.puedeOperar ? "Sí" : "No",
      novedades: inspection._count.novedades,
      supervisor: inspection.supervisor?.name ?? "",
      aprobacion:
        inspection.reviewedAt === null
          ? "Pendiente"
          : `${estadoLegible(inspection.status)} — ${formatFechaHora(inspection.reviewedAt)}`,
    });
  }

  agregarHojasHorarios(workbook, horarios);

  const buffer = await workbook.xlsx.writeBuffer();
  const fecha = claveDiaBogota(new Date()).replaceAll("-", "");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="informe-inspecciones-${fecha}.xlsx"`,
    },
  });
}


/** Hojas de "Cumplimiento de horarios": mismos filtros de fecha y sede que la hoja de inspecciones (ver reportes-horario.ts). */
function agregarHojasHorarios(workbook: ExcelJS.Workbook, h: ReporteHorarios) {
  const hoja = (nombre: string, columnas: [string, number][], filas: (string | number)[][]) => {
    const ws = workbook.addWorksheet(nombre);
    ws.columns = columnas.map(([header, width], i) => ({ header, key: `c${i}`, width }));
    ws.getRow(1).font = { bold: true };
    for (const fila of filas) ws.addRow(fila);
  };

  hoja(
    "Fuera de horario",
    [["Recorredor", 28], ["Enviadas fuera de horario", 24], ["Intentos bloqueados", 20]],
    h.fueraDeHorario.map((f) => [f.nombre, f.enviadasFueraDeHorario, f.intentosBloqueados]),
  );
  hoja(
    "Duración inspección",
    [["Recorredor", 28], ["Inspecciones", 14], ["Promedio (min)", 16]],
    h.duracionPorRecorredor.map((f) => [f.nombre, f.inspecciones, f.promedioMinutos]),
  );
  hoja(
    "Respuesta aprobadores",
    [["Aprobador", 28], ["Etapa", 24], ["Decisiones", 12], ["Promedio (min)", 16]],
    h.respuestaPorAprobador.map((f) => [f.nombre, ETIQUETA_ETAPA[f.etapa], f.decisiones, f.promedioMinutos]),
  );
  hoja(
    "Aprobaciones vencidas",
    [["Aprobador", 28], ["Decididas fuera de plazo", 24], ["Intentos bloqueados", 20]],
    [
      ...h.vencidasPorAprobador.map((f) => [f.nombre, f.decididasFueraDePlazo, f.intentosBloqueados]),
      [`Pendientes vencidos ahora — ${ETIQUETA_ETAPA.SUPERVISOR_OLEARIARI}`, h.pendientesVencidas.SUPERVISOR_OLEARIARI, ""],
      [`Pendientes vencidos ahora — ${ETIQUETA_ETAPA.SUPERVISOR}`, h.pendientesVencidas.SUPERVISOR, ""],
    ],
  );
  hoja(
    "Habilitaciones SST",
    [["Tipo", 14], ["Beneficiario", 28], ["Desde", 18], ["Hasta", 18], ["Justificación", 50], ["Otorgada por", 24], ["Fecha", 18]],
    h.habilitaciones.map((x) => [
      x.tipo === "RECORREDOR" ? "Recorredor" : "Aprobación",
      x.beneficiario,
      formatFechaHora(x.desde),
      formatFechaHora(x.hasta),
      x.justificacion,
      x.otorgadaPor,
      formatFechaHora(x.createdAt),
    ]),
  );
}
