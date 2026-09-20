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
      className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-left text-sm font-medium text-white hover:bg-[#0B3B60]/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
