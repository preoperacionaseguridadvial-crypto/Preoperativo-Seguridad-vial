"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvisoDecision as Aviso } from "@/lib/inspections/aviso-decision";
import { IconoCerrar, IconoCheckCirculo, IconoEquisCirculo } from "./IconosAprobador";

/**
 * Aviso de confirmación que ve el aprobador en su Inicio al volver de firmar
 * una decisión (ver lib/inspections/aviso-decision.ts): verde si aprobó, rojo
 * si rechazó. Se puede cerrar; al cerrarlo se limpia la decisión de la URL
 * para que no reaparezca al recargar.
 */
export function AvisoDecision({ aviso }: { aviso: Aviso }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const esAprobacion = aviso.tono === "ok";
  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        esAprobacion
          ? "border-status-ok/40 bg-status-ok-soft text-status-ok-ink"
          : "border-status-crit/40 bg-status-crit-soft text-status-crit-ink"
      }`}
    >
      <span aria-hidden className="shrink-0">
        {esAprobacion ? <IconoCheckCirculo className="size-7" /> : <IconoEquisCirculo className="size-7" />}
      </span>
      <p className="min-w-0 flex-1 text-sm font-bold sm:text-base">{aviso.texto}</p>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => {
          setVisible(false);
          router.replace("/");
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 active:bg-black/10"
      >
        <IconoCerrar />
      </button>
    </div>
  );
}
