"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { otorgarHabilitacionDesdeFormulario } from "@/lib/horarios/habilitacion-actions";
import {
  formatearHora12,
  horaActualRedondeada,
  sumarMinutos,
} from "@/lib/horarios/selector-hora";
import { SelectorHora } from "./SelectorHora";
import { BarraEnvio, Campo, CLASE_INPUT, ResumenError, Segmentado } from "../../usuarios/_components/ui-formulario";

export type BeneficiarioOpcion = { id: string; etiqueta: string };

const TIPOS = [
  { value: "RECORREDOR", label: "Recorredor" },
  { value: "APROBACION", label: "Aprobador" },
] as const;

const DURACIONES = [
  { etiqueta: "30 min", minutos: 30 },
  { etiqueta: "1 h", minutos: 60 },
  { etiqueta: "2 h", minutos: 120 },
  { etiqueta: "3 h", minutos: 180 },
] as const;

type Props = {
  recorredores: BeneficiarioOpcion[];
  aprobadores: BeneficiarioOpcion[];
};

// `key` distinto = formulario limpio tras un éxito.
export function FormularioHabilitacion(props: Props) {
  const [instancia, setInstancia] = useState(0);
  return <Formulario key={instancia} {...props} onListo={() => setInstancia((n) => n + 1)} />;
}

function Formulario({ recorredores, aprobadores, onListo }: Props & { onListo: () => void }) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(otorgarHabilitacionDesdeFormulario, null);
  const valores = estado && !estado.ok ? estado.valores : {};
  const [tipo, setTipo] = useState<string>(valores.tipo || "RECORREDOR");
  const exito = estado?.ok === true;
  const [horaDesde, setHoraDesde] = useState<string>(valores.horaDesde || "");
  const [horaHasta, setHoraHasta] = useState<string>(valores.horaHasta || "");

  // La hora actual se calcula en el cliente (tras hidratar) para no desajustar el HTML del servidor.
  useEffect(() => {
    if (!horaDesde) {
      const ahora = horaActualRedondeada(new Date());
      // eslint-disable-next-line react-hooks/set-state-in-effect -- valor inicial dependiente del reloj del cliente
      setHoraDesde(ahora);
      if (!horaHasta) setHoraHasta(sumarMinutos(ahora, 60));
    }
    // Solo al montar: valores iniciales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarDesde(nueva: string) {
    setHoraDesde(nueva);
  }

  // Tras guardar se refresca la lista (server component) y se muestra el aviso.
  useEffect(() => {
    if (exito) router.refresh();
  }, [exito, router]);

  const opciones = tipo === "APROBACION" ? aprobadores : recorredores;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <header>
        <h2 className="text-base font-semibold text-ink">Nueva habilitación</h2>
        <p className="text-sm text-ink-muted">
          Permite inspeccionar o aprobar fuera del horario normal, solo en el rango indicado (hora de Bogotá).
        </p>
      </header>

      {estado && !estado.ok && <ResumenError mensaje={estado.error} />}
      {exito && (
        <div
          role="status"
          className="rounded-xl border border-status-ok/40 bg-status-ok-soft p-3 text-sm font-semibold text-status-ok-ink"
        >
          Habilitación guardada.{" "}
          <button type="button" onClick={onListo} className="min-h-11 font-semibold underline">
            Crear otra
          </button>
        </div>
      )}

      <form key={estado ? JSON.stringify(valores) + String(exito) : "nuevo"} action={formAction} className="flex flex-col gap-4">
        <Segmentado
          nombre="tipo"
          legenda="¿Para quién?"
          opciones={TIPOS}
          valor={tipo}
          onChange={setTipo}
          requerido
        />

        <Campo id="usuarioId" etiqueta={tipo === "APROBACION" ? "Aprobador" : "Recorredor"}>
          <select
            id="usuarioId"
            name="usuarioId"
            required
            // `key` por tipo: al cambiar de tipo se descarta la selección anterior.
            key={tipo}
            defaultValue={valores.tipo === tipo ? valores.usuarioId : ""}
            className={CLASE_INPUT}
          >
            <option value="" disabled>
              Selecciona una persona
            </option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="fecha" etiqueta="Fecha">
          <input id="fecha" name="fecha" type="date" required defaultValue={valores.fecha} className={CLASE_INPUT} />
        </Campo>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Desde</legend>
          <SelectorHora name="horaDesde" etiqueta="Desde" valor={horaDesde} onChange={cambiarDesde} />
          <button
            type="button"
            onClick={() => cambiarDesde(horaActualRedondeada(new Date()))}
            className="min-h-11 self-start rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            Ahora
          </button>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Hasta</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Duración rápida">
            {DURACIONES.map((d) => {
              const activa = horaHasta !== "" && sumarMinutos(horaDesde, d.minutos) === horaHasta;
              return (
                <button
                  key={d.minutos}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setHoraHasta(sumarMinutos(horaDesde, d.minutos))}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    activa ? "border-brand bg-status-info-soft text-brand" : "border-border bg-surface text-ink"
                  }`}
                >
                  {d.etiqueta}
                </button>
              );
            })}
          </div>
          <SelectorHora name="horaHasta" etiqueta="Hasta" valor={horaHasta} onChange={setHoraHasta} />
        </fieldset>

        {horaDesde && horaHasta && (
          <p className="text-sm font-medium text-ink" aria-live="polite">
            De {formatearHora12(horaDesde)} a {formatearHora12(horaHasta)}
          </p>
        )}

        <Campo id="justificacion" etiqueta="Justificación" ayuda="Mínimo 10 caracteres. Queda registrada en la auditoría.">
          <textarea
            id="justificacion"
            name="justificacion"
            required
            minLength={10}
            rows={3}
            defaultValue={valores.justificacion}
            className={`${CLASE_INPUT} py-2`}
          />
        </Campo>

        <BarraEnvio pendiente={pendiente} texto="Habilitar" textoPendiente="Guardando…" />
      </form>
    </section>
  );
}
