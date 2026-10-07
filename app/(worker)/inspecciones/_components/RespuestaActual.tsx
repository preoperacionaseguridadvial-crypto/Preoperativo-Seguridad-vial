import type { RespuestaChecklist } from "@/generated/prisma/client";

// Sin "use client": lo usan tanto RespuestaChecklistItem (cliente) como
// RespuestaTriestadoItem (servidor).

// Resalta el botón de la respuesta ya guardada al volver a un ítem.
export const ANILLO_ACTUAL = " ring-4 ring-brand/40 ring-offset-2";

/** Aviso "Respuesta actual" al revisar un ítem ya respondido (nada si está pendiente). */
export function RespuestaActual({ valorActual }: { valorActual?: RespuestaChecklist }) {
  if (!valorActual) return null;
  const etiqueta: Record<RespuestaChecklist, string> = {
    OK: "✓ OK",
    FALLA: "✕ Falla / daño / faltante",
    BUENO: "✓ Bueno",
    BAJO: "⚠ Bajo",
    MALO: "✕ Malo",
  };
  return (
    <p className="rounded-md bg-status-info-soft px-3 py-2 text-sm text-status-info-ink">
      Respuesta actual: <span className="font-semibold">{etiqueta[valorActual]}</span>. Tocá otra opción para
      cambiarla.
    </p>
  );
}
