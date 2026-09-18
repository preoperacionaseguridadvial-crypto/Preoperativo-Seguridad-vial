import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth/config";
import { getInspeccionParaPdf } from "@/lib/inspections/pdf-queries";
import { InspeccionPdfDocument } from "@/lib/pdf/InspeccionPdfDocument";

// @react-pdf/renderer necesita Node.js (usa fs para leer el logo y fuentes
// del sistema PDF) — no puede correr en Edge Runtime.
export const runtime = "nodejs";

// Sin esto, Next.js cachea la respuesta de este GET (Full Route Cache) y
// puede servir el PDF de una request anterior — inaceptable acá: cada
// inspección tiene que reflejar su estado real en cada descarga, y la
// autorización (rol/pertenencia) tiene que revalidarse en cada request, no
// reusarse de una sesión anterior.
export const dynamic = "force-dynamic";

/**
 * Descarga el PDF FO-SVS-23 de una inspección puntual.
 *
 * Autorización (no hay prefijo de ruta en proxy.ts para /api/inspecciones,
 * así que la validación de rol vive acá, igual que en toda mutación
 * sensible — ver lib/auth/requireRole.ts):
 * - Únicamente SST puede descargar el PDF oficial. Ni el propio
 *   TRABAJADOR dueño de la inspección, ni SUPERVISOR ni DIRECTOR tienen
 *   acceso — pueden ver el detalle en pantalla (consulta-inspecciones,
 *   aprobaciones), pero la descarga del documento firmado queda
 *   restringida a SST.
 *
 * No existe si la inspección sigue EN_PROCESO (sin firma de conductor ni
 * resultado final, no hay nada oficial que documentar todavía) ni si está
 * CANCELADA (se descartó, nunca hubo nada oficial que documentar).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (session.user.role !== "SST") {
    // 404 sin distinguir "no existe" de "no autorizado": no se filtra
    // existencia a quien no tiene permiso.
    return NextResponse.json({ error: "Inspección no encontrada." }, { status: 404 });
  }

  const inspection = await getInspeccionParaPdf(id);
  if (!inspection || inspection.status === "EN_PROCESO" || inspection.status === "CANCELADA") {
    return NextResponse.json({ error: "Inspección no encontrada." }, { status: 404 });
  }

  const buffer = await renderToBuffer(InspeccionPdfDocument({ data: inspection }));

  const fecha = new Intl.DateTimeFormat("en-CA").format(inspection.startedAt).replaceAll("-", "");
  const placa = inspection.vehicle.placa.replace(/[^a-zA-Z0-9]/g, "");
  const filename = `FO-SVS-23_${placa}_${fecha}_${inspection.id}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
