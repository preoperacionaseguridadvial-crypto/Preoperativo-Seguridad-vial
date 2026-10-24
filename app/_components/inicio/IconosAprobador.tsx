// Íconos SVG en línea del inicio de los aprobadores (mismo estilo que Iconos.tsx).

type Props = { className?: string };

function Trazo({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      {children}
    </svg>
  );
}

export function IconoPersonas({ className = "size-4" }: Props) {
  return (
    <Trazo className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3 3 0 010 5.6M18 14.8c1.8.7 3 2.4 3 5.2" strokeLinecap="round" />
    </Trazo>
  );
}

export function IconoCalendario({ className = "size-4" }: Props) {
  return (
    <Trazo className={className}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" strokeLinecap="round" />
    </Trazo>
  );
}

export function IconoDocumento({ className = "size-5" }: Props) {
  return (
    <Trazo className={className}>
      <path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z" strokeLinejoin="round" />
      <path d="M14 3.5V8h4M9 12.5h6M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
    </Trazo>
  );
}

export function IconoAlerta({ className = "size-4" }: Props) {
  return (
    <Trazo className={className}>
      <path d="M12 4l9 15.5H3L12 4z" strokeLinejoin="round" />
      <path d="M12 10v4M12 17v.01" strokeLinecap="round" />
    </Trazo>
  );
}

export function IconoEnviado({ className = "size-4" }: Props) {
  return (
    <Trazo className={className}>
      <path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3z" strokeLinecap="round" strokeLinejoin="round" />
    </Trazo>
  );
}

export function IconoBandera({ className = "size-4" }: Props) {
  return (
    <Trazo className={className}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" strokeLinecap="round" strokeLinejoin="round" />
    </Trazo>
  );
}

export function IconoCheckCirculo({ className = "size-6" }: Props) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16.2 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </Trazo>
  );
}

export function IconoEquisCirculo({ className = "size-6" }: Props) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
    </Trazo>
  );
}

export function IconoCerrar({ className = "size-5" }: Props) {
  return (
    <Trazo className={className}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </Trazo>
  );
}

export function IconoCuadricula({ className = "size-5" }: Props) {
  return (
    <Trazo className={className}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </Trazo>
  );
}
