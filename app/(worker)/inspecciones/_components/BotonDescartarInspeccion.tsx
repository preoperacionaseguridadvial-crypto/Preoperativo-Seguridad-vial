"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

function BotonConfirmarDescarte() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-status-crit px-3 text-sm font-semibold text-white active:opacity-90 disabled:opacity-60"
    >
      {pending ? "Descartando…" : "Sí, descartar"}
    </button>
  );
}

/**
 * Descartar una inspección en proceso en dos pasos: un primer toque solo
 * pide confirmación ("¿Descartar? Sí / No"); recién el segundo ejecuta la
 * server action. Antes un solo toque en la ✕ la cancelaba sin preguntar y
 * se perdía todo lo respondido. `action` es el server action ya atado al id
 * (`cancelarAction.bind(null, id)` en la página).
 */
export function BotonDescartarInspeccion({ action, placa }: { action: () => Promise<void>; placa: string }) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Descartar inspección ${placa}`}
        className="flex min-h-11 items-center justify-center rounded-lg border border-status-crit/40 px-4 text-sm font-medium text-status-crit-ink active:bg-status-crit-soft"
      >
        Descartar
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg bg-status-crit-soft p-3">
      <p className="text-sm font-medium text-status-crit-ink">
        ¿Descartar esta inspección? Se pierde lo que ya respondiste.
      </p>
      <div className="flex gap-2">
        <BotonConfirmarDescarte />
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink active:bg-page"
        >
          No, volver
        </button>
      </div>
    </form>
  );
}
