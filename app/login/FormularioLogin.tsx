"use client";

import { useState } from "react";

const CLASE_INPUT =
  "w-full rounded-xl border border-[#d5dfea] bg-white py-3 pl-11 pr-3 text-[15px] text-[#0B2A4A] placeholder:text-[#8da0b5] focus:border-[#1565D8] focus:outline-none focus:ring-2 focus:ring-[#1565D8]/20";

const SVG_BASE = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function IconoSobre() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg {...SVG_BASE}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

function IconoOjo({ tachado }: { tachado: boolean }) {
  return (
    <svg {...SVG_BASE}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <path d="m4 4 16 16" />}
    </svg>
  );
}

function IconoEscudo() {
  return (
    <svg {...SVG_BASE} className="h-9 w-9 shrink-0 text-[#1565D8]">
      <path d="M12 3 5 6v5.5c0 4.4 2.9 7.9 7 9.5 4.1-1.6 7-5.1 7-9.5V6l-7-3Z" />
      <path d="M12 3 5 6v5.5c0 4.4 2.9 7.9 7 9.5V3Z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

export function FormularioLogin({
  accion,
  callbackUrl,
}: {
  accion: (formData: FormData) => void | Promise<void>;
  callbackUrl: string;
}) {
  const [verContrasena, setVerContrasena] = useState(false);
  const [avisoOlvido, setAvisoOlvido] = useState(false);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[#0B2A4A]">
          Correo electrónico
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5b7390]">
            <IconoSobre />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@empresa.com"
            className={CLASE_INPUT}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[#0B2A4A]">
          Contraseña
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5b7390]">
            <IconoCandado />
          </span>
          <input
            id="password"
            name="password"
            type={verContrasena ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Ingresa tu contraseña"
            className={`${CLASE_INPUT} pr-12`}
          />
          <button
            type="button"
            onClick={() => setVerContrasena((v) => !v)}
            aria-label={verContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={verContrasena}
            className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#5b7390] hover:text-[#1565D8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1565D8]/40"
          >
            <IconoOjo tachado={!verContrasena} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0B2A4A]">
          <input
            type="checkbox"
            name="recordar"
            defaultChecked
            className="h-5 w-5 rounded border-[#b8c6d6] accent-[#1565D8]"
          />
          Recordarme
        </label>
        <button
          type="button"
          onClick={() => setAvisoOlvido((v) => !v)}
          aria-expanded={avisoOlvido}
          aria-controls="aviso-olvido"
          className="text-sm font-medium text-[#1565D8] hover:underline focus:outline-none focus-visible:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      {avisoOlvido && (
        <p id="aviso-olvido" role="status" className="rounded-lg bg-[#eaf2fd] px-3 py-2 text-sm text-[#0B3B60]">
          Comuníquese con el Administrador del sistema para restablecer su contraseña.
        </p>
      )}

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F5FD7] px-4 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_-8px_rgba(21,101,216,0.7)] transition hover:bg-[#0B50BA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1565D8] focus-visible:ring-offset-2"
      >
        Iniciar sesión
        <svg {...SVG_BASE} strokeWidth={2}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-[#dfe7f0]" />
        <span className="h-2 w-2 rounded-full border border-[#9fb0c4]" />
        <span className="h-px flex-1 bg-[#dfe7f0]" />
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-[#eaf2fd] px-4 py-3.5">
        <IconoEscudo />
        <div>
          <p className="text-sm font-semibold text-[#0B2A4A]">Acceso seguro</p>
          <p className="text-[13px] leading-snug text-[#5b7390]">
            Tu información está protegida con cifrado de nivel empresarial.
          </p>
        </div>
      </div>
    </form>
  );
}
