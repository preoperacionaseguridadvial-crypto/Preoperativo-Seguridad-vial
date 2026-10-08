import { guiaDeFoto, type TipoFotoGuia, type TipoVehiculoGuia } from "@/lib/inspections/guia-foto";

/**
 * Guía visual de una foto diaria (lateral o placa): ilustración de cómo debe
 * salir la foto, según el tipo de vehículo, más una instrucción corta. Las
 * ilustraciones viven en public/fotos-guia/ (ver README ahí).
 *
 * Caja con aspect-ratio (sin salto de layout al cargar la imagen) en una fila
 * compacta junto a la instrucción, para que las dos guías y sus botones
 * "Tomar foto" entren en una sola pantalla de celular. Con `compacta` (la foto
 * ya está subida) la fila se achica más, para que la miniatura de la foto sea
 * la protagonista pero la guía siga a mano si quiere cambiarla.
 */
export function GuiaFoto({
  tipo,
  tipoVehiculo,
  compacta = false,
}: {
  tipo: TipoFotoGuia;
  tipoVehiculo: TipoVehiculoGuia | null | undefined;
  compacta?: boolean;
}) {
  const { src, instruccion } = guiaDeFoto(tipo, tipoVehiculo);

  const imagen = (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeño; next/image no optimiza SVG.
    <img
      src={src}
      alt=""
      width={320}
      height={180}
      className="h-full w-full rounded-md object-contain"
    />
  );

  if (compacta) {
    return (
      <div className="flex items-center gap-3 rounded-md bg-page px-2 py-2">
        <div className="aspect-[16/9] h-14 shrink-0">{imagen}</div>
        <p className="text-xs text-ink-muted">{instruccion}</p>
      </div>
    );
  }

  // Fila compacta (imagen a la izquierda, instrucción a la derecha): en un
  // celular real (≈360×650 visibles con la barra del navegador) las dos guías
  // apiladas en vertical empujaban el segundo "Tomar foto" fuera de pantalla.
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="aspect-[16/9] w-36 shrink-0 rounded-md bg-page">{imagen}</div>
      <p className="text-sm leading-snug text-ink">{instruccion}</p>
    </div>
  );
}
