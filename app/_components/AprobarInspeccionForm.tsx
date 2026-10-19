/**
 * Formulario de aprobación del aprobador. Solo se muestra cuando la
 * inspección está totalmente conforme: desde 2026-10-19 (regla de producto)
 * una inspección con novedades no se puede aprobar, solo rechazar — ver
 * `aprobarInspeccion` en lib/inspections/supervisor-actions.ts, que lo
 * vuelve a validar en el servidor.
 *
 * La server action llega por prop (mismo patrón que FirmaCanvas) porque las
 * funciones "use server" inline solo pueden vivir en el Server Component.
 */
export function AprobarInspeccionForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="observacion-aprobar" className="mb-1 block text-sm font-medium text-gray-700">
          Observaciones (opcional)
        </label>
        <textarea
          id="observacion-aprobar"
          name="observacion"
          rows={3}
          placeholder="Comentarios adicionales para el recorredor."
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-md bg-green-600 px-4 py-4 text-base font-semibold text-white hover:bg-green-700"
      >
        ✓ Aprobar
      </button>
    </form>
  );
}
