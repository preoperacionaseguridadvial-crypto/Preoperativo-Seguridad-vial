import { NextResponse } from "next/server";
import { subirFotoInspeccion } from "@/lib/inspections/foto-actions";
import { errorFotoAHttp, parseTipoFoto } from "@/lib/inspections/foto-upload-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Subida de una foto diaria (lateral/placa) para el cliente con barra de
 * progreso (`XMLHttpRequest`, que a diferencia de una server action expone
 * `upload.onprogress`). Toda la regla de negocio (sesión, rol TRABAJADOR,
 * pertenencia, EN_PROCESO, validación del archivo, reemplazo e invalidación
 * de firma) vive en `subirFotoInspeccion`; este handler solo traduce a JSON.
 *
 * La ruta cuelga de `/inspecciones`, así que proxy.ts ya la restringe a
 * TRABAJADOR (lib/auth/route-roles.ts); `subirFotoInspeccion` lo vuelve a
 * exigir porque el proxy nunca es la única defensa.
 *
 * Respuesta: `{ ok: true }` o `{ ok: false, error }` con el estado HTTP que
 * corresponda (ver `errorFotoAHttp`).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; tipo: string }> },
) {
  const { id, tipo: tipoRaw } = await params;

  const tipo = parseTipoFoto(tipoRaw);
  if (!tipo) {
    return NextResponse.json({ ok: false, error: "Tipo de foto no válido." }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    await subirFotoInspeccion(id, tipo, formData);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, message } = errorFotoAHttp(err);
    if (status >= 500) {
      console.error("Fallo al subir la foto de la inspección.", { inspectionId: id, tipo, err });
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
