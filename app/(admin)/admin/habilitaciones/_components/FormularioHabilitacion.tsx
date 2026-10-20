"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { otorgarHabilitacionDesdeFormulario } from "@/lib/horarios/habilitacion-actions";
import { BarraEnvio, Campo, CLASE_INPUT, ResumenError, Segmentado } from "../../usuarios/_components/ui-formulario";

export type BeneficiarioOpcion = { id: string; etiqueta: string };

const TIPOS = [
  { value: "RECORREDOR", label: "Recorredor" },
  { value: "APROBACION", label: "Aprobador" },
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

        <div className="grid grid-cols-2 gap-3">
          <Campo id="horaDesde" etiqueta="Desde">
            <input
              id="horaDesde"
              name="horaDesde"
              type="time"
              required
              defaultValue={valores.horaDesde}
              className={CLASE_INPUT}
            />
          </Campo>
          <Campo id="horaHasta" etiqueta="Hasta">
            <input
              id="horaHasta"
              name="horaHasta"
              type="time"
              required
              defaultValue={valores.horaHasta}
              className={CLASE_INPUT}
            />
          </Campo>
        </div>

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
