"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { IconoFlechaDerecha, IconoPlay } from "@/app/_components/inicio/Iconos";
import { CLASES_BOTON_PRINCIPAL } from "./clasesBotonPrincipal";

// Botón de envío del formulario de inicio de inspección: se deshabilita
// mientras el server action está pendiente, para que un doble tap no dispare
// dos inicios. Va como componente cliente aparte para que la página
// (app/(worker)/inspecciones/page.tsx) siga siendo un server component.
export function BotonIniciarInspeccion({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={CLASES_BOTON_PRINCIPAL}>
      <IconoPlay />
      <span className="flex-1 text-center">{pending ? "Iniciando…" : children}</span>
      <IconoFlechaDerecha />
    </button>
  );
}
