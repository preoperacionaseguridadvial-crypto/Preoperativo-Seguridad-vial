"use client";

import { useRef, useState, useTransition } from "react";

/**
 * Canvas táctil para capturar una firma manuscrita real (Fase D): el dueño
 * de producto pidió explícitamente el trazo dibujado, no un texto tipo
 * "firmado". Usa Pointer Events (no touch/mouse por separado) para
 * funcionar igual con el dedo en celular y con mouse en desktop.
 *
 * Vive en app/_components (no en app/(worker)/... ni app/(supervisor)/...)
 * porque lo usan ambos flujos: la pantalla de confirmar del trabajador
 * (firma del conductor) y la pantalla de aprobación del supervisor (firma
 * del supervisor). El componente no sabe nada de inspecciones ni de tipos
 * de firma — solo dibuja y exporta un PNG; quien lo usa le pasa ya la
 * server action atada (`.bind` o closure) al `inspectionId` y al tipo que
 * corresponda, así se comparte el 100% de la lógica de dibujo sin acoplar
 * el componente a `lib/inspections/firma-actions.ts`.
 */
export function FirmaCanvas({
  guardarAction,
  etiqueta,
}: {
  guardarAction: (formData: FormData) => Promise<void>;
  etiqueta: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dibujando = useRef(false);
  const [haDibujado, setHaDibujado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0B3B60";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!haDibujado) setHaDibujado(true);
  }

  function handlePointerUp() {
    dibujando.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHaDibujado(false);
    setError(null);
  }

  function confirmar() {
    const canvas = canvasRef.current;
    if (!canvas || !haDibujado) {
      setError("Dibujá la firma antes de continuar.");
      return;
    }
    setError(null);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("No se pudo generar la firma. Intentá de nuevo.");
        return;
      }
      const formData = new FormData();
      formData.append("firma", blob, "firma.png");
      startTransition(async () => {
        await guardarAction(formData);
      });
    }, "image/png");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">{etiqueta}</p>
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full touch-none rounded-md border border-gray-300 bg-white"
        style={{ aspectRatio: "600 / 160" }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={limpiar}
          className="rounded-md border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="flex-1 rounded-md bg-[#0B3B60] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3B60]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Confirmar firma"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
