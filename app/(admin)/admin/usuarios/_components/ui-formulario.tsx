"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Piezas visuales compartidas por el formulario de alta, el de edición y la
// lista de usuarios. Solo presentación: los `name` de los campos los define
// quien las usa y no cambian respecto al contrato FormData de las server actions.

export const CLASE_INPUT =
  "min-h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

const ANILLO_FOCO = "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40";

/** Tarjeta numerada con título y una línea de ayuda. */
export function Seccion({
  numero,
  titulo,
  ayuda,
  children,
}: {
  numero: number;
  titulo: string;
  ayuda: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
        >
          {numero}
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">{titulo}</h2>
          <p className="text-sm text-ink-muted">{ayuda}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

/** Etiqueta + control + ayuda opcional. `opcional` agrega "(opcional)" sutil. */
export function Campo({
  id,
  etiqueta,
  opcional = false,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {etiqueta}
        {opcional && <span className="ml-1 text-xs font-normal text-ink-muted">(opcional)</span>}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-ink-muted">{ayuda}</p>}
    </div>
  );
}

export type OpcionSegmentada = { value: string; label: string };

/** Radios presentados como botones segmentados (un radio real por opción). */
export function Segmentado({
  nombre,
  legenda,
  opciones,
  valor,
  onChange,
  valorInicial,
  requerido = false,
}: {
  nombre: string;
  legenda: string;
  opciones: readonly OpcionSegmentada[];
  /** Modo controlado (si se pasa `valor`) o no controlado con `valorInicial`. */
  valor?: string;
  onChange?: (v: string) => void;
  valorInicial?: string;
  requerido?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink">{legenda}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
        {opciones.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-center text-sm font-semibold text-ink transition-colors has-[:checked]:border-brand has-[:checked]:bg-status-info-soft has-[:checked]:text-brand ${ANILLO_FOCO}`}
          >
            <input
              type="radio"
              name={nombre}
              value={o.value}
              required={requerido}
              className="sr-only"
              {...(valor !== undefined
                ? { checked: valor === o.value, onChange: () => onChange?.(o.value) }
                : { defaultChecked: valorInicial === o.value, onChange: () => onChange?.(o.value) })}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Interruptor accesible: un checkbox real con apariencia de switch. */
export function Interruptor({
  nombre,
  titulo,
  ayuda,
  defaultChecked,
}: {
  nombre: string;
  titulo: string;
  ayuda: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3 ${ANILLO_FOCO}`}
    >
      <span>
        <span className="block text-sm font-medium text-ink">{titulo}</span>
        <span className="block text-xs text-ink-muted">{ayuda}</span>
      </span>
      <input type="checkbox" name={nombre} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-status-neutral-soft ring-1 ring-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-status-ok peer-checked:after:translate-x-5"
      />
    </label>
  );
}

/** Contraseña con botón mostrar/ocultar. */
export function CampoPassword({
  id,
  nombre,
  placeholder,
}: {
  id: string;
  nombre: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={nombre}
        type={visible ? "text" : "password"}
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={placeholder}
        className={`${CLASE_INPUT} pr-24`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 min-h-11 -translate-y-1/2 rounded-md px-3 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

/** Resumen de error al inicio del formulario. */
export function ResumenError({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-status-crit/40 bg-status-crit-soft p-3 text-status-crit-ink"
    >
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5M12 16h.01" strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-sm font-semibold">No se pudo guardar</p>
        <p className="text-sm">{mensaje}</p>
      </div>
    </div>
  );
}

/** Barra inferior con el botón principal, fija mientras se recorre el formulario. */
export function BarraEnvio({
  pendiente = false,
  texto,
  textoPendiente,
}: {
  pendiente?: boolean;
  texto: string;
  textoPendiente: string;
}) {
  const { pending } = useFormStatus();
  const enCurso = pendiente || pending;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
      <button
        type="submit"
        disabled={enCurso}
        className="min-h-12 w-full rounded-xl bg-brand px-4 text-base font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 active:opacity-90 disabled:opacity-60"
      >
        {enCurso ? textoPendiente : texto}
      </button>
    </div>
  );
}
