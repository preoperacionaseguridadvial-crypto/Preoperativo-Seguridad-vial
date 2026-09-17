// Un adjunto de novedad puede ser una foto o un documento (PDF) — ver
// `lib/inspections/actions.ts` (subirFotoNovedad). El modelo `Photo` no
// guarda el mimetype, así que el tipo se infiere de la extensión en la URL
// firmada (arrastra el nombre de archivo original, ver `s3Key`). Sin esto,
// un PDF renderizado con <img> deja el ícono de imagen rota.
export function AdjuntoNovedad({ url, alt }: { url: string; alt: string }) {
  const esPdf = new URL(url).pathname.toLowerCase().endsWith(".pdf");

  if (esPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-gray-300 bg-white text-xs font-medium text-[#0B3B60] hover:bg-gray-50"
      >
        <span aria-hidden className="text-lg">📄</span>
        Ver PDF
      </a>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto.
    <img src={url} alt={alt} className="h-24 w-24 rounded-md object-cover" />
  );
}
