"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Botón de envío del formulario de inicio de inspección: se deshabilita
// mientras el server action está pendiente, para que un doble tap no dispare
// dos inicios. Va como componente cliente aparte para que la página
// (app/(worker)/inspecciones/page.tsx) siga siendo un server component.
export function BotonIniciarInspeccion({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-14 w-full items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-white shadow-sm active:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Iniciando…" : children}
    </button>
  );
}
