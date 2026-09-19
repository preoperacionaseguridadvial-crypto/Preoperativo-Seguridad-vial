/**
 * Contenedor de tarjeta compartido por todo el dashboard (mismo radio, borde y
 * sombra en cada sección). Con `titulo` arma el encabezado estándar; sin él,
 * la tarjeta trae su propio contenido de cabecera (p. ej. las tarjetas de
 * anillo).
 */
export function Tarjeta({
  titulo,
  subtitulo,
  acciones,
  fila = false,
  className = "",
  children,
}: {
  titulo?: string;
  subtitulo?: string;
  /** Controles alineados a la derecha del título (p. ej. el toggle de vista del gráfico). */
  acciones?: React.ReactNode;
  /** Contenido en fila (anillo + texto) en vez de columna. */
  fila?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm ${
        fila ? "flex-row items-center gap-4" : "flex-col gap-3"
      } ${className}`}
    >
      {titulo && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
            {subtitulo && <p className="text-xs text-ink-muted">{subtitulo}</p>}
          </div>
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}
