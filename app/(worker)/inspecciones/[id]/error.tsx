"use client";

import { useEffect } from "react";
import { PantallaBloqueoHorario } from "@/app/_components/PantallaBloqueoHorario";

// Red de seguridad: una acción del servidor que falla sin ser atrapada (p. ej.
// el bloqueo por horario) llega aquí. En producción Next oculta el mensaje real
// del error, por eso el texto es genérico y orienta a SST.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PantallaBloqueoHorario motivo="GENERICO" href="/inspecciones" etiquetaBoton="Volver al inicio">
      <button
        type="button"
        onClick={() => retry()}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-border bg-surface px-5 text-base font-semibold text-ink transition active:opacity-90"
      >
        Reintentar
      </button>
    </PantallaBloqueoHorario>
  );
}
