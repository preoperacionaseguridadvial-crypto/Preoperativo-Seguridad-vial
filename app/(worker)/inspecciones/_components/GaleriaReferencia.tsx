import { ImagenReferencia } from "@/app/(worker)/inspecciones/_components/ImagenReferencia";

/**
 * Galería de fotos de referencia de un ChecklistItem (`imagenesUrl`, ver
 * prisma/schema.prisma). La mayoría de los ítems tiene 0 o 1 imagen; unos
 * pocos (ej. "Direccionales y Estacionarias") tienen 2 — se muestran lado a
 * lado en una fila horizontal con scroll si no entran, mobile-first. Sin
 * imágenes, cae al mismo placeholder que usa ImagenReferencia para una sola
 * foto (ítems de Documentación, que no tienen foto de referencia en el
 * formato oficial).
 */
export function GaleriaReferencia({ srcs, alt }: { srcs: string[]; alt: string }) {
  const imagenes = srcs.length > 0 ? srcs : ["/checklist/_placeholder.svg"];

  if (imagenes.length === 1) {
    // Proporción natural (sin caja fija): las tarjetas de carro son verticales y
    // con texto, en una caja horizontal de 320 px quedaban ilegibles.
    return <ImagenReferencia src={imagenes[0]} alt={alt} className="max-h-[28rem]" />;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {imagenes.map((src, index) => (
        <ImagenReferencia
          key={`${src}-${index}`}
          src={src}
          alt={`${alt} (${index + 1}/${imagenes.length})`}
          className="aspect-[4/3] max-h-64 w-64 flex-none"
        />
      ))}
    </div>
  );
}
