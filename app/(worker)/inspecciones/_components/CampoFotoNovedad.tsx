"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import { comprimirFotoEnNavegador } from "@/lib/imagenes/adaptador-navegador";

/**
 * Campo de foto opcional dentro del formulario de la novedad (una sola
 * pantalla). A diferencia de `CapturaFotoInput`, NO envía el formulario al
 * elegir la foto: la comprime en el navegador (lado largo 1600 px, JPEG 0.75),
 * deja la versión comprimida en el `<input>` (vía DataTransfer), muestra una
 * vista previa local y el trabajador confirma con el botón "Continuar".
 *
 * Mientras comprime, el input queda con `setCustomValidity`: el navegador
 * bloquea el envío del formulario y así nunca viaja una foto sin comprimir.
 * Si la compresión falla se conserva la foto original y el servidor responde
 * con su propio error en español.
 *
 * Debe renderizarse DENTRO del `<form>`.
 */
export function CampoFotoNovedad() {
  const [procesando, setProcesando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const { pending: enviando } = useFormStatus();
  const ocupado = procesando || enviando;

  // Libera el object URL al cambiar de foto o desmontar.
  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  async function alCambiar(event: ChangeEvent<HTMLInputElement>) {
    // `currentTarget` deja de existir tras el primer `await`: se captura antes.
    const input = event.currentTarget;
    const original = input.files?.[0];
    if (!original) {
      // Cámara cancelada: algunos navegadores vacían el input. Sin esto la
      // vista previa seguiría mostrando una foto que ya no se va a enviar.
      setVistaPrevia(null);
      return;
    }

    setProcesando(true);
    input.setCustomValidity("Esperá a que termine de procesarse la foto.");
    try {
      const listo = await comprimirFotoEnNavegador(original);
      if (listo !== original) {
        try {
          // Asignar `files` no dispara `change` de nuevo.
          const transferencia = new DataTransfer();
          transferencia.items.add(listo);
          input.files = transferencia.files;
        } catch {
          // Sin DataTransfer (navegador viejo): se envía la foto original.
        }
      }
      setVistaPrevia(URL.createObjectURL(input.files?.[0] ?? original));
    } finally {
      input.setCustomValidity("");
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="block text-sm font-medium text-gray-700">Foto (opcional)</p>
      {vistaPrevia && (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no aplica next/image
        <img
          src={vistaPrevia}
          alt="Vista previa de la foto de la novedad"
          className="max-h-64 w-full rounded-md border border-gray-200 object-contain"
        />
      )}
      <label
        aria-busy={ocupado}
        className={`block w-full cursor-pointer rounded-md px-4 py-3 text-center text-base font-semibold ${
          vistaPrevia
            ? "border border-brand bg-surface text-brand hover:bg-brand/5"
            : "bg-[#2E9BD6] text-white hover:bg-[#2E9BD6]/90"
        }${ocupado ? " pointer-events-none opacity-70" : ""}`}
      >
        {procesando ? "Procesando foto…" : vistaPrevia ? "Cambiar foto" : "Tomar foto"}
        <input
          type="file"
          name="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={alCambiar}
        />
      </label>
    </div>
  );
}

/** Botón "Continuar" del formulario de novedad: se bloquea mientras se guarda. */
export function BotonGuardarNovedad() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90 disabled:opacity-70"
    >
      {pending ? "Guardando…" : "Continuar"}
    </button>
  );
}
