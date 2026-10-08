"use client";

import { useEffect, useState } from "react";
// `enums` y no `client`: este es un Client Component y `client` arrastraría
// el cliente de Prisma (pg) al bundle del navegador.
import { TipoVehiculo } from "@/generated/prisma/enums";
import { MAX_FOTO_BYTES, TIPOS_FOTO_ACEPTADOS } from "@/lib/admin/foto-vehiculo";
import { comprimirFotoEnNavegador } from "@/lib/imagenes/adaptador-navegador";
import { CLASE_INPUT, Campo, Interruptor, Segmentado } from "./ui-formulario";

const OPCIONES_TIPO_ALTA = [
  { value: TipoVehiculo.MOTO, label: "Moto" },
  { value: TipoVehiculo.CARRO, label: "Carro" },
];
// En edición un legacy puede quedar sin tipo: se conserva la opción "Sin asignar".
const OPCIONES_TIPO_EDICION = [{ value: "", label: "Sin asignar" }, ...OPCIONES_TIPO_ALTA];

/**
 * Contenido de la sección "Vehículo del recorredor" (alta y edición): el
 * recorredor tiene UN vehículo (1:1) que se captura junto con él. Hay un solo
 * campo de tipo de vehículo: alimenta `User.tipoVehiculo` y
 * `Vehicle.tipoVehiculo`. En el alta todo es obligatorio salvo las fechas;
 * en la edición nada lleva `required` en el navegador porque un legacy sin
 * vehículo puede quedar sin cargar (la validación real es la del servidor).
 */
export function CamposVehiculo({
  valores = {},
  modo,
  fotoActualUrl,
  activo,
}: {
  /** Valores iniciales por nombre de campo (repoblado tras un error, o el vehículo actual). */
  valores?: Record<string, string>;
  modo: "alta" | "edicion";
  /** URL prefirmada de la foto actual (solo edición). */
  fotoActualUrl?: string | null;
  /** Estado actual del vehículo (solo edición de un usuario que ya tiene vehículo). */
  activo?: boolean;
}) {
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Libera la URL local de la miniatura al cambiarla o al desmontar.
  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  // Misma compresión en el navegador que las fotos de la inspección
  // (lib/imagenes/compresion-cliente.ts): la foto de la hoja de vida se usa
  // como miniatura en listas que se abren desde el celular, y sin comprimir
  // llegaba a pesar varios MB. Si algo falla se conserva el original y el
  // servidor sigue validando tipo y peso.
  async function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    // `currentTarget` deja de existir tras el primer `await`: se captura antes.
    const input = e.currentTarget;
    const original = input.files?.[0];
    setErrorFoto(null);
    if (!original) {
      setVistaPrevia(null);
      return;
    }

    setProcesando(true);
    let archivo = original;
    try {
      const comprimido = await comprimirFotoEnNavegador(original);
      if (comprimido !== original) {
        try {
          const transferencia = new DataTransfer();
          transferencia.items.add(comprimido);
          input.files = transferencia.files;
          archivo = comprimido;
        } catch {
          // Sin DataTransfer (navegador viejo): se envía la foto original.
        }
      }
    } finally {
      setProcesando(false);
    }

    // Aviso temprano: evita subir varios MB para que el servidor la rechace.
    if (archivo.size > MAX_FOTO_BYTES) {
      input.value = "";
      setVistaPrevia(null);
      setErrorFoto(`La foto no puede superar ${MAX_FOTO_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setVistaPrevia(URL.createObjectURL(archivo));
  }

  const valor = (campo: string) => valores[campo] ?? "";
  const requerido = modo === "alta";
  const imagen = vistaPrevia ?? fotoActualUrl ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Segmentado
        nombre="tipoVehiculo"
        legenda="Tipo de vehículo"
        requerido={requerido}
        valorInicial={valor("tipoVehiculo")}
        opciones={requerido ? OPCIONES_TIPO_ALTA : OPCIONES_TIPO_EDICION}
      />

      <Campo id="placa" etiqueta="Placa">
        <input
          id="placa"
          name="placa"
          type="text"
          required={requerido}
          autoCapitalize="characters"
          autoComplete="off"
          defaultValue={valor("placa")}
          className={`${CLASE_INPUT} font-mono uppercase tracking-wider`}
        />
      </Campo>

      <div>
        <span className="mb-1 block text-sm font-medium text-ink">Foto del vehículo</span>
        <label
          htmlFor="foto"
          className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-page p-3 text-center text-ink-muted transition-colors hover:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40"
        >
          {imagen ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal o miniatura local (blob:), no candidatas a next/image.
            <img
              src={imagen}
              alt={vistaPrevia ? "Vista previa de la foto elegida" : "Foto actual del vehículo"}
              className="h-40 w-full rounded-lg bg-surface object-contain"
            />
          ) : (
            <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
          <span className="text-sm font-semibold text-brand">
            {imagen ? "Cambiar foto" : "Tomar o elegir foto"}
          </span>
          <input
            id="foto"
            name="foto"
            type="file"
            accept={TIPOS_FOTO_ACEPTADOS.join(",")}
            required={requerido}
            onChange={alElegirFoto}
            className="sr-only"
          />
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          {requerido
            ? "Obligatoria. JPG, PNG o WEBP, máximo 8 MB. Si el alta falla, hay que volver a elegir la foto."
            : "Sube una nueva solo para reemplazar la actual. JPG, PNG o WEBP, máximo 8 MB."}
        </p>
        {procesando && (
          <p role="status" className="mt-1 text-xs font-medium text-brand">
            Optimizando foto…
          </p>
        )}
        {errorFoto && (
          <p role="alert" className="mt-1 text-xs font-medium text-status-crit-ink">
            {errorFoto}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["marca", "Marca"],
            ["modelo", "Modelo"],
            ["color", "Color"],
          ] as const
        ).map(([campo, etiqueta]) => (
          <Campo key={campo} id={campo} etiqueta={etiqueta}>
            <input
              id={campo}
              name={campo}
              type="text"
              required={requerido}
              defaultValue={valor(campo)}
              className={CLASE_INPUT}
            />
          </Campo>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["fechaVencimientoSoat", "Vencimiento SOAT"],
            ["fechaVencimientoTecnicomecanica", "Vencimiento tecnicomecánica"],
          ] as const
        ).map(([campo, etiqueta]) => (
          <Campo key={campo} id={campo} etiqueta={etiqueta} opcional>
            <input id={campo} name={campo} type="date" defaultValue={valor(campo)} className={CLASE_INPUT} />
          </Campo>
        ))}
      </div>

      {modo === "edicion" && activo !== undefined && (
        <div>
          {/* Un checkbox desmarcado no viaja en el formulario: este campo avisa
              que la casilla estaba presente (ver leerVehiculoDeFormulario). */}
          <input type="hidden" name="vehiculoActivoEnForm" value="1" />
          <Interruptor
            nombre="vehiculoActivo"
            titulo="Vehículo activo"
            ayuda="Con el vehículo inactivo el recorredor no puede iniciar inspecciones."
            defaultChecked={activo}
          />
        </div>
      )}
    </div>
  );
}
