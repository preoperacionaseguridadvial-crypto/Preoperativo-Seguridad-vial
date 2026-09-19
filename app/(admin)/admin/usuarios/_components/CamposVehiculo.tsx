"use client";

import { useEffect, useState } from "react";
// `enums` y no `client`: este es un Client Component y `client` arrastraría
// el cliente de Prisma (pg) al bundle del navegador.
import { TipoVehiculo } from "@/generated/prisma/enums";
import { MAX_FOTO_BYTES, TIPOS_FOTO_ACEPTADOS } from "@/lib/admin/foto-vehiculo";

const TIPOS_VEHICULO: TipoVehiculo[] = [TipoVehiculo.MOTO, TipoVehiculo.CARRO];

const CLASE_INPUT =
  "w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none";
const CLASE_LABEL = "mb-1 block text-sm font-medium text-gray-700";

/**
 * Sección "Vehículo" del formulario de usuario (alta y edición): el
 * trabajador tiene UN vehículo (1:1) que se captura junto con él. Hay un solo
 * select de tipo de vehículo: alimenta `User.tipoVehiculo` y
 * `Vehicle.tipoVehiculo`. En el alta todo es obligatorio salvo las fechas;
 * en la edición nada lleva `required` en el navegador porque un legacy sin
 * vehículo puede quedar sin cargar (la validación real es la del servidor).
 */
export function CamposVehiculo({
  valores = {},
  modo,
  fotoActualUrl,
}: {
  /** Valores iniciales por nombre de campo (repoblado tras un error, o el vehículo actual). */
  valores?: Record<string, string>;
  modo: "alta" | "edicion";
  /** URL prefirmada de la foto actual (solo edición). */
  fotoActualUrl?: string | null;
}) {
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  // Libera la URL local de la miniatura al cambiarla o al desmontar.
  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    setErrorFoto(null);
    if (!archivo) {
      setVistaPrevia(null);
      return;
    }
    // Aviso temprano: evita subir varios MB para que el servidor la rechace.
    if (archivo.size > MAX_FOTO_BYTES) {
      e.target.value = "";
      setVistaPrevia(null);
      setErrorFoto(`La foto no puede superar ${MAX_FOTO_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setVistaPrevia(URL.createObjectURL(archivo));
  }

  const valor = (campo: string) => valores[campo] ?? "";
  const requerido = modo === "alta";

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-gray-200 p-4">
      <legend className="px-1 text-sm font-medium text-gray-700">Vehículo del trabajador</legend>

      <div>
        <label htmlFor="tipoVehiculo" className={CLASE_LABEL}>
          Tipo de vehículo
        </label>
        <select
          id="tipoVehiculo"
          name="tipoVehiculo"
          required={requerido}
          defaultValue={valor("tipoVehiculo")}
          className={CLASE_INPUT}
        >
          <option value="" disabled={requerido}>
            {requerido ? "Selecciona un tipo" : "Sin asignar"}
          </option>
          {TIPOS_VEHICULO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="placa" className={CLASE_LABEL}>
          Placa
        </label>
        <input
          id="placa"
          name="placa"
          type="text"
          required={requerido}
          autoCapitalize="characters"
          defaultValue={valor("placa")}
          className={`${CLASE_INPUT} uppercase`}
        />
      </div>

      <div>
        <label htmlFor="foto" className={CLASE_LABEL}>
          Foto del vehículo
        </label>
        {fotoActualUrl && (
          <div className="mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto. */}
            <img
              src={fotoActualUrl}
              alt="Foto actual del vehículo"
              className="h-40 w-full rounded-md border border-gray-200 bg-gray-50 object-contain"
            />
            <p className="mt-1 text-xs text-gray-500">Foto actual.</p>
          </div>
        )}
        <input
          id="foto"
          name="foto"
          type="file"
          accept={TIPOS_FOTO_ACEPTADOS.join(",")}
          required={requerido}
          onChange={alElegirFoto}
          className={CLASE_INPUT}
        />
        <p className="mt-1 text-xs text-gray-500">
          {requerido
            ? "Obligatoria. JPG, PNG o WEBP, máximo 8 MB. Si el alta falla, hay que volver a elegir la foto."
            : "Sube una nueva solo para reemplazar la actual. JPG, PNG o WEBP, máximo 8 MB."}
        </p>
        {errorFoto && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            {errorFoto}
          </p>
        )}
        {vistaPrevia && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- Miniatura local (blob:), no aplica next/image. */}
            <img
              src={vistaPrevia}
              alt="Vista previa de la foto elegida"
              className="h-40 w-full rounded-md border border-gray-200 bg-gray-50 object-contain"
            />
          </div>
        )}
      </div>

      {(
        [
          ["marca", "Marca"],
          ["modelo", "Modelo"],
          ["color", "Color"],
        ] as const
      ).map(([campo, etiqueta]) => (
        <div key={campo}>
          <label htmlFor={campo} className={CLASE_LABEL}>
            {etiqueta}
          </label>
          <input
            id={campo}
            name={campo}
            type="text"
            required={requerido}
            defaultValue={valor(campo)}
            className={CLASE_INPUT}
          />
        </div>
      ))}

      {(
        [
          ["fechaVencimientoSoat", "Vencimiento SOAT (opcional)"],
          ["fechaVencimientoTecnicomecanica", "Vencimiento tecnicomecánica (opcional)"],
        ] as const
      ).map(([campo, etiqueta]) => (
        <div key={campo}>
          <label htmlFor={campo} className={CLASE_LABEL}>
            {etiqueta}
          </label>
          <input
            id={campo}
            name={campo}
            type="date"
            defaultValue={valor(campo)}
            className={CLASE_INPUT}
          />
        </div>
      ))}
    </fieldset>
  );
}
