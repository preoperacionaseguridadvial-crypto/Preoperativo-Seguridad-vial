"use client";

import { useRef } from "react";

/**
 * Formulario de aprobación del Supervisor. Sin `motivos` se comporta como un
 * formulario común. Con `motivos` (calculados en el servidor, ver
 * lib/inspections/motivos-confirmacion-aprobacion.ts) el botón "Aprobar" abre
 * un diálogo nativo (`<dialog>.showModal()`, que ya resuelve Escape, foco
 * atrapado y fondo inerte) que lista lo reportado y pide confirmar. Al
 * confirmar se envía este mismo formulario con `confirmado=true`; la server
 * action igual recalcula los motivos, este flag es solo un acuse de recibo.
 *
 * La server action llega por prop (mismo patrón que FirmaCanvas) porque las
 * funciones "use server" inline solo pueden vivir en el Server Component.
 */
export function AprobarInspeccionForm({
  action,
  motivos,
}: {
  action: (formData: FormData) => Promise<void>;
  motivos: string[];
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const confirmadoRef = useRef<HTMLInputElement | null>(null);

  const requiereConfirmacion = motivos.length > 0;

  function handleAprobarClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!requiereConfirmacion) return;
    e.preventDefault();
    dialogRef.current?.showModal();
  }

  function handleConfirmar() {
    if (confirmadoRef.current) confirmadoRef.current.value = "true";
    dialogRef.current?.close();
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <input ref={confirmadoRef} type="hidden" name="confirmado" defaultValue="" />
        <div>
          <label htmlFor="observacion-aprobar" className="mb-1 block text-sm font-medium text-gray-700">
            Observaciones (opcional)
          </label>
          <textarea
            id="observacion-aprobar"
            name="observacion"
            rows={3}
            placeholder="Comentarios adicionales para el trabajador."
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          onClick={handleAprobarClick}
          className="w-full rounded-md bg-green-600 px-4 py-4 text-base font-semibold text-white hover:bg-green-700"
        >
          ✓ Aprobar
        </button>
      </form>

      {requiereConfirmacion && (
        // Visual de ALERTA (rojo + ⚠), no de éxito: aprobar con novedades es
        // una decisión con riesgo y el Supervisor tiene que notarlo de un
        // vistazo. El botón de confirmar también es rojo; "Cancelar" conserva
        // el foco inicial para que un toque accidental no apruebe.
        <dialog
          ref={dialogRef}
          aria-labelledby="confirmar-aprobacion-titulo"
          className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-md overflow-hidden overflow-y-auto rounded-xl p-0 backdrop:bg-black/60"
        >
          <div className="flex items-center gap-3 bg-status-crit px-5 py-4 text-white">
            <svg viewBox="0 0 24 24" className="size-9 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M12 3.5 2.5 20h19L12 3.5Z" strokeLinejoin="round" />
              <path d="M12 10v4.5" strokeLinecap="round" />
              <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
            </svg>
            <h2 id="confirmar-aprobacion-titulo" className="text-lg font-bold leading-tight">
              Atención: esta inspección tiene novedades reportadas
            </h2>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <ul className="flex flex-col gap-2">
              {motivos.map((motivo, indice) => (
                <li
                  key={indice}
                  className="flex gap-2 rounded-md border-l-4 border-status-crit bg-status-crit-soft px-3 py-2 text-sm font-medium text-status-crit-ink"
                >
                  <span aria-hidden>⚠</span>
                  <span>{motivo}</span>
                </li>
              ))}
            </ul>

            <p className="text-base font-semibold text-ink">
              ¿Está seguro de que desea aprobarla con estas novedades?
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => dialogRef.current?.close()}
                className="rounded-md border border-gray-300 px-4 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                className="rounded-md bg-status-crit px-4 py-3 text-base font-semibold text-white hover:bg-status-crit/90"
              >
                ⚠ Sí, aprobar con novedades
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
