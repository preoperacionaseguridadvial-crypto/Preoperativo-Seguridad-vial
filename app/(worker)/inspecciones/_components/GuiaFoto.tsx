import { guiaDeFoto, type TipoFotoGuia, type TipoVehiculoGuia } from "@/lib/inspections/guia-foto";

/**
 * Guía visual de una foto diaria (lateral o placa): ilustración de cómo debe
 * salir la foto, según el tipo de vehículo, más una instrucción corta. Las
 * ilustraciones viven en public/fotos-guia/ (ver README ahí).
 *
 * Alto fijo (caja con aspect-ratio) para que no haya salto de layout al cargar
 * la imagen y para que no empuje el botón "Tomar foto" fuera de una pantalla de
 * 360×740. Con `compacta` (la foto ya está subida) se reduce a una fila:
 * imagen pequeña + instrucción, para que la miniatura de la foto sea la
 * protagonista pero el trabajador pueda consultar la guía si quiere cambiarla.
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

  return (
    <div className="flex flex-col gap-2 rounded-md bg-page px-2 py-2">
      <div className="mx-auto aspect-[16/9] h-36 max-w-full">{imagen}</div>
      <p className="text-center text-sm text-ink">{instruccion}</p>
    </div>
  );
}
