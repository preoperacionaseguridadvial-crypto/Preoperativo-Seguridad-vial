// Íconos SVG en línea del inicio por rol (mismo estilo que la lista de
// aprobaciones: trazo 1.8–2, currentColor, decorativos).
import type { IconoAtajo } from "@/lib/inicio/atajos";

type Props = { className?: string };

export function IconoMoto({ className = "size-10" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <circle cx="5.5" cy="16.5" r="3" />
      <circle cx="18.5" cy="16.5" r="3" />
      <path d="M5.5 16.5l4-6h5l4 6M14.5 10.5l-1.5-4h2.5M9.5 10.5l-1-2H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoCarro({ className = "size-10" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M3 16.5v-4l2-5h14l2 5v4H3z" strokeLinejoin="round" />
      <path d="M3 12.5h18" />
      <circle cx="7" cy="16.5" r="1.8" />
      <circle cx="17" cy="16.5" r="1.8" />
    </svg>
  );
}

export function IconoFlecha({ className = "size-5 shrink-0 text-ink-muted" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TRAZOS_ATAJO: Record<IconoAtajo, React.ReactNode> = {
  inspeccion: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5h6M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  aprobaciones: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  consulta: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" strokeLinecap="round" />
    </>
  ),
  dashboard: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" strokeLinejoin="round" />,
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3 3 0 010 5.6M18 14.8c1.8.7 3 2.4 3 5.2" strokeLinecap="round" />
    </>
  ),
  configuracion: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
};

export function IconoDeAtajo({ icono, className = "size-6" }: { icono: IconoAtajo; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      {TRAZOS_ATAJO[icono]}
    </svg>
  );
}
