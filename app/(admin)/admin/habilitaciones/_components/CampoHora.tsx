"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  HORAS_FRECUENTES,
  ajustarHoras,
  ajustarMinutos,
  horaActualRedondeada,
  partesDeHora,
} from "@/lib/horarios/selector-hora";
import { IconoCerrar, IconoChevron, IconoMas, IconoMenos, IconoReloj } from "./iconos";

type Props = {
  /** Nombre del campo que recibe la server action ("HH:MM", 24 h). */
  name: string;
  etiqueta: string;
  /** "HH:MM" en 24 h, o "" si aún no se eligió. */
  valor: string;
  onChange: (hhmm: string) => void;
  /** Hacia dónde se abre el panel en pantallas anchas. */
  alinear?: "izquierda" | "derecha";
};

const ANILLO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565D8]/40";
const dos = (n: number) => String(n).padStart(2, "0");

/** Campo de hora: botón desplegable + panel "Seleccionar hora". Envía un único valor "HH:MM". */
export function CampoHora({ name, etiqueta, valor, onChange, alinear = "izquierda" }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idBase = useId();

  function abrir() {
    setBorrador(valor || horaActualRedondeada(new Date()));
    setAbierto(true);
  }

  function cerrar(devolverFoco: boolean) {
    setAbierto(false);
    if (devolverFoco) disparador.current?.focus();
  }

  function aplicar() {
    onChange(borrador);
    cerrar(true);
  }

  // Foco al panel al abrir; un clic fuera lo cierra.
  useEffect(() => {
    if (!abierto) return;
    panel.current?.focus();
    function fuera(e: PointerEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  const { horas, minutos } = partesDeHora(borrador);

  return (
    <div ref={raiz} className="relative">
      <input type="hidden" name={name} value={valor} />
      <span id={`${idBase}-etiqueta`} className="mb-1 block text-sm font-medium text-[#0B2A4A]">
        {etiqueta}
      </span>
      <button
        ref={disparador}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-labelledby={`${idBase}-etiqueta ${idBase}-valor`}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        className={`flex min-h-12 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-base ${ANILLO} ${
          abierto ? "border-[#1565D8]" : "border-border"
        }`}
      >
        <IconoReloj className="size-5 shrink-0 text-[#1565D8]" />
        <span id={`${idBase}-valor`} className={`flex-1 truncate ${valor ? "font-semibold text-[#0B2A4A]" : "text-ink-muted"}`}>
          {valor || "Seleccionar hora"}
        </span>
        <IconoChevron className="size-4 shrink-0 text-ink-muted" />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" onClick={() => cerrar(true)} aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-labelledby={idTitulo}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                cerrar(true);
              }
            }}
            className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-white p-4 shadow-2xl focus:outline-none sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:w-80 sm:rounded-2xl ${
              alinear === "derecha" ? "sm:right-0" : "sm:left-0"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 id={idTitulo} className="text-base font-semibold text-[#0B2A4A]">
                Seleccionar hora
              </h3>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => cerrar(true)}
                className={`flex size-10 items-center justify-center rounded-lg text-ink-muted hover:bg-[#EAF4FC] ${ANILLO}`}
              >
                <IconoCerrar className="size-5" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink-muted">Horas frecuentes</p>
              <div className="grid grid-cols-4 gap-2">
                {HORAS_FRECUENTES.map((h) => {
                  const activa = borrador === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => setBorrador(h)}
                      className={`min-h-11 rounded-lg text-sm font-semibold ${ANILLO} ${
                        activa ? "bg-[#0B2A4A] text-white" : "bg-[#EAF4FC] text-[#0B2A4A] hover:bg-[#d8ebf9]"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink-muted">Hora personalizada</p>
              <div className="flex items-center justify-center gap-2" role="group" aria-label="Hora personalizada">
                <Paso
                  etiqueta="horas"
                  texto={dos(horas)}
                  onMenos={() => setBorrador(ajustarHoras(borrador, -1))}
                  onMas={() => setBorrador(ajustarHoras(borrador, 1))}
                />
                <span aria-hidden className="text-xl font-semibold text-[#0B2A4A]">
                  :
                </span>
                <Paso
                  etiqueta="minutos"
                  texto={dos(minutos)}
                  onMenos={() => setBorrador(ajustarMinutos(borrador, -1))}
                  onMas={() => setBorrador(ajustarMinutos(borrador, 1))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBorrador(horaActualRedondeada(new Date()))}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-semibold text-[#1565D8] ${ANILLO}`}
              >
                <IconoReloj className="size-4" />
                Ahora
              </button>
              <button
                type="button"
                onClick={aplicar}
                className={`min-h-12 rounded-xl bg-[#0B2A4A] text-sm font-semibold text-white ${ANILLO}`}
              >
                Aplicar hora
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Paso({ etiqueta, texto, onMenos, onMas }: { etiqueta: string; texto: string; onMenos: () => void; onMas: () => void }) {
  const boton = `flex size-10 items-center justify-center rounded-lg border border-border bg-white text-[#1565D8] hover:bg-[#EAF4FC] ${ANILLO}`;
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`Restar ${etiqueta}`} onClick={onMenos} className={boton}>
        <IconoMenos className="size-4" />
      </button>
      <output aria-label={etiqueta} className="w-9 text-center text-xl font-semibold tabular-nums text-[#0B2A4A]">
        {texto}
      </output>
      <button type="button" aria-label={`Sumar ${etiqueta}`} onClick={onMas} className={boton}>
        <IconoMas className="size-4" />
      </button>
    </div>
  );
}
