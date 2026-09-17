"use client";

/**
 * Botón único de captura de foto: reemplaza el control nativo feo de
 * `<input type="file">` ("Seleccionar un archivo") por un botón propio.
 * El input real queda oculto (`sr-only`) pero sigue siendo el que el
 * formulario envía — el `<label>` lo dispara con el comportamiento nativo
 * del navegador, sin JS para eso. El único JS necesario es el auto-submit
 * al elegir/capturar la foto (`requestSubmit`), para que sacar la foto sea
 * un solo paso en vez de "elegir" + "confirmar" con dos botones distintos.
 */
export function CapturaFotoInput() {
  return (
    <label className="block w-full cursor-pointer rounded-md bg-[#2E9BD6] px-4 py-4 text-center text-base font-semibold text-white hover:bg-[#2E9BD6]/90">
      Tomar foto
      <input
        type="file"
        name="file"
        accept="image/*"
        capture="environment"
        required
        className="sr-only"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      />
    </label>
  );
}
