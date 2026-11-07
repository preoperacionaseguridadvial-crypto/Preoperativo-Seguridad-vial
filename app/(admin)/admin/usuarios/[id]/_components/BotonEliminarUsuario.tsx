"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

function BotonConfirmarEliminacion() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-status-crit px-3 text-sm font-semibold text-white active:opacity-90 disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Sí, eliminar definitivamente"}
    </button>
  );
}

/**
 * Eliminar un usuario en dos pasos (solo ADMINISTRADOR, lo decide la página):
 * el primer toque solo pide confirmación; recién el segundo ejecuta la server
 * action, que rechaza si el usuario tiene historial. `action` ya viene atada
 * al id en la página.
 */
export function BotonEliminarUsuario({ action, nombre }: { action: () => Promise<void>; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Eliminar usuario ${nombre}`}
        className="min-h-11 self-start rounded-md border border-status-crit/40 px-3 py-2 text-sm font-medium text-status-crit-ink hover:bg-status-crit-soft"
      >
        Eliminar usuario
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg bg-status-crit-soft p-3">
      <p className="text-sm font-medium text-status-crit-ink">
        Esta acción elimina de forma permanente al usuario y sus propios registros: sesiones y auditoría, habilitaciones y
        autorización de datos. No se puede deshacer. Nunca elimina inspecciones: si el usuario tiene inspecciones o firmas,
        no se eliminará; desactívalo en su lugar.
      </p>
      <div className="flex gap-2">
        <BotonConfirmarEliminacion />
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
