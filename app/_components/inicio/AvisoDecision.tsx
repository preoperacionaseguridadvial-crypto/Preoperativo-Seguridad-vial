import type { AvisoDecision as Aviso } from "@/lib/inspections/aviso-decision";

/**
 * Aviso de confirmación que ve el Supervisor en su Inicio al volver de firmar
 * una decisión (ver lib/inspections/aviso-decision.ts): verde si aprobó, rojo
 * si rechazó.
 */
export function AvisoDecision({ aviso }: { aviso: Aviso }) {
  const esAprobacion = aviso.tono === "ok";
  return (
    <p
      role="status"
      className={`rounded-xl px-4 py-3 text-sm font-medium ${
        esAprobacion ? "bg-status-ok-soft text-status-ok-ink" : "bg-status-crit-soft text-status-crit-ink"
      }`}
    >
      {esAprobacion ? "✓ " : "✕ "}
      {aviso.texto}
    </p>
  );
}
