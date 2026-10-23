"use client";

import { aHHMM, aPartes, type Periodo } from "@/lib/horarios/selector-hora";

const CLASE_SELECT =
  "min-h-12 w-full rounded-lg border border-border bg-surface px-2 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

const HORAS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5);

type Props = {
  /** Nombre del campo que recibe la server action ("HH:MM", 24 h). */
  name: string;
  /** Texto para lectores de pantalla y etiquetas, p. ej. "Desde". */
  etiqueta: string;
  /** "HH:MM" en 24 h. */
  valor: string;
  onChange: (hhmm: string) => void;
};

/** Hora en 12 h con tres selects grandes; envía un único valor "HH:MM". */
export function SelectorHora({ name, etiqueta, valor, onChange }: Props) {
  const partes = aPartes(valor);
  return (
    <div role="group" aria-label={etiqueta} className="grid grid-cols-3 gap-2">
      <input type="hidden" name={name} value={valor} />
      <select
        aria-label={`${etiqueta}: hora`}
        value={partes.hora12}
        onChange={(e) => onChange(aHHMM({ ...partes, hora12: Number(e.target.value) }))}
        className={CLASE_SELECT}
      >
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        aria-label={`${etiqueta}: minutos`}
        value={partes.minuto}
        onChange={(e) => onChange(aHHMM({ ...partes, minuto: Number(e.target.value) }))}
        className={CLASE_SELECT}
      >
        {MINUTOS.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        aria-label={`${etiqueta}: a. m. o p. m.`}
        value={partes.periodo}
        onChange={(e) => onChange(aHHMM({ ...partes, periodo: e.target.value as Periodo }))}
        className={CLASE_SELECT}
      >
        <option value="AM">a. m.</option>
        <option value="PM">p. m.</option>
      </select>
    </div>
  );
}
