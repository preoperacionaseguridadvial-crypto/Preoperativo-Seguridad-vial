// Iconos en línea de la tarjeta de habilitaciones (sin librería de iconos).
import type { ReactNode } from "react";

type P = { className?: string };

function Base({ className = "size-5", children }: P & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconoReloj = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);

export const IconoCalendario = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
);

export const IconoCalendarioReloj = (p: P) => (
  <Base {...p}>
    <path d="M20 11V7.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20H11" />
    <path d="M4 10h16M8 3v4M16 3v4" />
    <circle cx="17" cy="17" r="4" />
    <path d="M17 15.2V17l1.2.8" />
  </Base>
);

export const IconoChevron = (p: P) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconoPersona = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </Base>
);

export const IconoCheckCirculo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.8 2.8L16 9.8" />
  </Base>
);

export const IconoCerrar = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconoMas = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconoMenos = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);
