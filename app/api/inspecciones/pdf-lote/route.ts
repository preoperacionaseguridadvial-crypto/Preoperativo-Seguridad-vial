import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Zip, ZipPassThrough } from "fflate";
import { auth } from "@/lib/auth/config";
import { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import { getInspeccionParaPdf } from "@/lib/inspections/pdf-queries";
import { InspeccionPdfDocument } from "@/lib/pdf/InspeccionPdfDocument";
import { parsearFiltrosConsulta } from "@/lib/inspections/filtros-consulta";
import { puedeDescargarPdf } from "@/lib/inspections/pdf-acceso";
import {
  MAX_PDFS_POR_LOTE,
  nombreArchivoPdf,
  nombreArchivoZip,
} from "@/lib/inspections/pdf-lote";
import { tienePermisosSst } from "@/lib/auth/permisos";

// Igual que el PDF individual: @react-pdf/renderer necesita Node.js y la
// autorización debe revalidarse en cada request (sin Full Route Cache).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga un ZIP con el PDF FO-SVS-23 de cada inspección que coincide con los
 * filtros de la consulta (mismos query params). Solo SST; solo estados que
 * `puedeDescargarPdf` permite. El ZIP se emite en streaming: los PDFs se
 * renderizan de a uno y se empujan al ZIP apenas están listos (sin deflate: el
 * PDF ya viene comprimido), así que nunca hay más de un PDF en memoria.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!tienePermisosSst(session.user.role)) {
    return NextResponse.json({ error: "Inspecciones no encontradas." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const { filtros, valoresFormulario } = parsearFiltrosConsulta({
    conductor: searchParams.get("conductor") ?? undefined,
    placa: searchParams.get("placa") ?? undefined,
    estado: searchParams.get("estado") ?? undefined,
    fechaDesde: searchParams.get("fechaDesde") ?? undefined,
    fechaHasta: searchParams.get("fechaHasta") ?? undefined,
  });

  const rol = session.user.role;
  const ids = (await getAllInspeccionesForOversight(filtros))
    .filter((i) => puedeDescargarPdf(rol, i.status))
    .map((i) => i.id);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "No hay inspecciones descargables con esos filtros." },
      { status: 404 },
    );
  }
  if (ids.length > MAX_PDFS_POR_LOTE) {
    return NextResponse.json(
      { error: `Hay ${ids.length} inspecciones; acota el filtro (máximo ${MAX_PDFS_POR_LOTE} por descarga).` },
      { status: 422 },
    );
  }

  // Si el cliente cancela la descarga, se deja de renderizar: sin esto el
  // servidor seguiría generando cientos de PDFs que nadie va a recibir.
  let cancelado = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((error, chunk, final) => {
        if (cancelado) return;
        if (error) {
          controller.error(error);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      try {
        for (const id of ids) {
          if (cancelado) {
            zip.terminate();
            return;
          }
          const inspection = await getInspeccionParaPdf(id);
          // Pudo cambiar de estado entre la lista y el render: se omite.
          if (!inspection || !puedeDescargarPdf(rol, inspection.status)) continue;

          const buffer = await renderToBuffer(InspeccionPdfDocument({ data: inspection }));
          const entrada = new ZipPassThrough(
            nombreArchivoPdf({ placa: inspection.vehicle.placa, startedAt: inspection.startedAt, id: inspection.id }),
          );
          zip.add(entrada);
          entrada.push(new Uint8Array(buffer), true);
        }
        zip.end();
      } catch (error) {
        console.error("[pdf-lote] Falló la generación del ZIP", error);
        zip.terminate();
        if (!cancelado) controller.error(error);
      }
    },
    cancel() {
      cancelado = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombreArchivoZip(valoresFormulario, new Date())}"`,
    },
  });
}
