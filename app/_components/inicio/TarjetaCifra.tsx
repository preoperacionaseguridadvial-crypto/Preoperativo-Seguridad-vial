/** Cifra grande con etiqueta (mismo estilo que el "Resumen" de aprobaciones). */
export function TarjetaCifra({
  valor,
  etiqueta,
  className,
}: {
  valor: number;
  etiqueta: string;
  className: string;
}) {
  return (
    <div className={`flex flex-col rounded-xl px-4 py-3 ${className}`}>
      <span className="text-2xl font-bold leading-none">{valor}</span>
      <span className="mt-1 text-xs font-medium">{etiqueta}</span>
    </div>
  );
}
