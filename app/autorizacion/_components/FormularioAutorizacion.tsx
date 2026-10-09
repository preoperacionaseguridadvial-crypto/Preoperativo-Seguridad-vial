"use client";

import { useState } from "react";
import { FirmaCanvas } from "@/app/_components/FirmaCanvas";

/**
 * Aceptación expresa + firma manuscrita de la autorización de tratamiento de
 * datos. La firma solo se habilita después de marcar la casilla, y la
 * aceptación viaja junto con la firma (campo "acepto") para que el servidor la
 * exija de nuevo (lib/legal/autorizacion-datos-actions.ts).
 */
export function FormularioAutorizacion({
  autorizarAction,
}: {
  autorizarAction: (formData: FormData) => Promise<void>;
}) {
  const [acepto, setAcepto] = useState(false);

  async function guardar(formData: FormData) {
    formData.set("acepto", "si");
    await autorizarAction(formData);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 rounded-md border border-border bg-surface p-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={acepto}
          onChange={(e) => setAcepto(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[#0B3B60]"
        />
        <span>
          He leído y autorizo el tratamiento de mis datos personales, incluidos los datos sensibles,
          en los términos descritos.
        </span>
      </label>

      {acepto ? (
        <FirmaCanvas guardarAction={guardar} etiqueta="Firme con el dedo para autorizar" />
      ) : (
        <p className="text-center text-xs text-ink-muted">Marque la casilla para poder firmar.</p>
      )}
    </div>
  );
}
