export type NombreIcono =
  | "actualizar"
  | "buscar"
  | "descarga"
  | "alerta"
  | "flecha"
  | "rayo"
  | "rechazada"
  | "pendiente"
  | "usuarios"
  | "arriba"
  | "abajo"
  | "igual";

// Íconos de trazo simple (24x24, currentColor). Siempre decorativos
// (`aria-hidden`): junto a cada uno va el texto que dice lo mismo.
const TRAZOS: Record<NombreIcono, React.ReactNode> = {
  actualizar: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  descarga: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 11l4.5 4.5 4.5-4.5" />
      <path d="M5 20h14" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5h.01" />
    </>
  ),
  flecha: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  rayo: <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />,
  rechazada: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  pendiente: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  arriba: (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  abajo: (
    <>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  igual: <path d="M5 12h14" />,
};

export function Icono({ nombre, className = "size-4" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
