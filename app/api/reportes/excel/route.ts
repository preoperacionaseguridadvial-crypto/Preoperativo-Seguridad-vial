import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth/config";
import { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import { estadoLegible, parseFiltrosDesdeQuery } from "@/lib/inspections/reportes-queries";

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
  });

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Inspecciones");

  hoja.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Hora", key: "hora", width: 10 },
    { header: "Trabajador", key: "trabajador", width: 24 },
    { header: "Placa", key: "placa", width: 12 },
    { header: "Kilometraje", key: "kilometraje", width: 14 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Resultado", key: "resultado", width: 12 },
    { header: "Novedades", key: "novedades", width: 12 },
    { header: "Supervisor", key: "supervisor", width: 24 },
    { header: "Aprobación", key: "aprobacion", width: 30 },
  ];
  hoja.getRow(1).font = { bold: true };

  for (const inspection of inspecciones) {
    hoja.addRow({
      fecha: new Intl.DateTimeFormat("es-CO", { dateStyle: "short" }).format(inspection.startedAt),
      hora: new Intl.DateTimeFormat("es-CO", { timeStyle: "short" }).format(inspection.startedAt),
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
          : `${estadoLegible(inspection.status)} — ${new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(inspection.reviewedAt)}`,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fecha = new Intl.DateTimeFormat("en-CA").format(new Date()).replaceAll("-", "");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="informe-inspecciones-${fecha}.xlsx"`,
    },
  });
}

