"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import { comprimirFotoEnNavegador } from "@/lib/imagenes/adaptador-navegador";

/**
 * Botón único de captura de foto: reemplaza el control nativo feo de
 * `<input type="file">` ("Seleccionar un archivo") por un botón propio.
 * El input real queda oculto (`sr-only`) pero sigue siendo el que el
 * formulario envía — el `<label>` lo dispara con el comportamiento nativo
 * del navegador (cámara trasera, permiso incluido). El JS necesario es el
 * auto-submit al elegir/capturar la foto (`requestSubmit`), para que sacar la
 * foto sea un solo paso en vez de "elegir" + "confirmar" con dos botones.
 *
 * Antes de enviar, la foto se comprime en el navegador (lado largo 1920 px,
 * JPEG 0.8; ver lib/imagenes/compresion-cliente.ts): una foto de teléfono pesa
 * 3–12 MB y el servidor topa en 8 MB y no acepta HEIC. Si algo falla al
 * comprimir, se envía la foto original y el servidor responde con su propio
 * error en español — nunca se bloquea el envío.
 *
 * Debe renderizarse DENTRO del `<form>` (usa `useFormStatus` para saber cuándo
 * termina el envío y no dejar el botón bloqueado si la acción devuelve error).
 */
export function CapturaFotoInput() {
  const [procesando, setProcesando] = useState(false);
  // Guarda contra re-entrada síncrona: `procesando` (estado) se actualiza en el
  // siguiente render, la ref es inmediata ante un doble toque.
  const enCurso = useRef(false);
  const { pending: enviando } = useFormStatus();
  const ocupado = procesando || enviando;

  async function alCambiar(event: ChangeEvent<HTMLInputElement>) {
    // `currentTarget` deja de existir tras el primer `await`: se captura antes.
    const input = event.currentTarget;
    const formulario = input.form;
    const original = input.files?.[0];
    if (!original || enCurso.current) return;

    enCurso.current = true;
    setProcesando(true);
    try {
      const listo = await comprimirFotoEnNavegador(original);
      if (listo !== original) {
        try {
          // Asignar `files` no dispara `change` de nuevo. El input NO se
          // deshabilita: un input deshabilitado no se envía con el formulario.
          const transferencia = new DataTransfer();
          transferencia.items.add(listo);
          input.files = transferencia.files;
        } catch {
          // Sin DataTransfer (navegador viejo): se envía la foto original.
        }
      }
      formulario?.requestSubmit();
    } finally {
      // La página no siempre navega (si la acción devuelve error se queda en la
      // misma ruta): se libera el botón; mientras el envío está en curso lo
      // mantiene bloqueado `useFormStatus`.
      enCurso.current = false;
      setProcesando(false);
    }
  }

  return (
    <label
      aria-busy={ocupado}
      className={`block w-full cursor-pointer rounded-md bg-[#2E9BD6] px-4 py-4 text-center text-base font-semibold text-white hover:bg-[#2E9BD6]/90${
        ocupado ? " pointer-events-none opacity-70" : ""
      }`}
    >
      {procesando ? "Procesando foto…" : enviando ? "Subiendo foto…" : "Tomar foto"}
      <input
        type="file"
        name="file"
        accept="image/*"
        capture="environment"
        required
        className="sr-only"
        onChange={alCambiar}
      />
    </label>
  );
}
