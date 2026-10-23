"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { otorgarHabilitacionDesdeFormulario } from "@/lib/horarios/habilitacion-actions";
import {
  duracionTexto,
  formatearFechaLarga,
  formatearRango,
  rangoValido,
} from "@/lib/horarios/selector-hora";
import { ResumenError } from "../../usuarios/_components/ui-formulario";
import { CampoHora } from "./CampoHora";
import {
  IconoCalendario,
  IconoCalendarioReloj,
  IconoCerrar,
  IconoCheckCirculo,
  IconoChevron,
  IconoPersona,
  IconoReloj,
} from "./iconos";

export type BeneficiarioOpcion = { id: string; etiqueta: string };

const TIPOS = [
  { value: "RECORREDOR", label: "Recorredor" },
  { value: "APROBACION", label: "Aprobador" },
] as const;

// Tope solo del cliente: la server action no limita el largo máximo.
const JUSTIFICACION_MAXIMA = 500;
const JUSTIFICACION_MINIMA = 10;

const ANILLO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565D8]/40";
const CONTROL =
  "min-h-12 w-full rounded-xl border border-border bg-white px-3 text-base text-[#0B2A4A] focus:border-[#1565D8] focus:outline-none focus:ring-2 focus:ring-[#1565D8]/30";

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
  const [fecha, setFecha] = useState<string>(valores.fecha || "");
  const [horaDesde, setHoraDesde] = useState<string>(valores.horaDesde || "");
  const [horaHasta, setHoraHasta] = useState<string>(valores.horaHasta || "");
  const [justificacion, setJustificacion] = useState<string>(valores.justificacion || "");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Tras guardar se refresca la lista (server component) y se muestra el aviso.
  useEffect(() => {
    if (exito) router.refresh();
  }, [exito, router]);

  const opciones = tipo === "APROBACION" ? aprobadores : recorredores;
  const hayExtremos = horaDesde !== "" && horaHasta !== "";
  const rangoInvertido = hayExtremos && !rangoValido(horaDesde, horaHasta);

  function cambiarHora(poner: (h: string) => void) {
    return (h: string) => {
      poner(h);
      setErrorLocal(null);
    };
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FC] text-[#1565D8]">
          <IconoCalendarioReloj className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[#0B2A4A]">Nueva habilitación</h2>
          <p className="text-sm text-ink-muted">
            Permite inspeccionar o aprobar fuera del horario normal, solo en el rango indicado (hora de Bogotá).
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {estado && !estado.ok && <ResumenError mensaje={estado.error} />}
          {errorLocal && <ResumenError mensaje={errorLocal} />}
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

          <form
            key={estado ? JSON.stringify(valores) + String(exito) : "nuevo"}
            action={formAction}
            onSubmit={(e) => {
              if (!rangoValido(horaDesde, horaHasta)) {
                e.preventDefault();
                setErrorLocal("Elige la hora Desde y la hora Hasta; Hasta debe ser posterior a Desde.");
              }
            }}
            className="flex flex-col gap-4"
          >
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-[#0B2A4A]">¿Para quién?</legend>
              <div className="grid grid-cols-2 gap-3">
                {TIPOS.map((t) => (
                  <label
                    key={t.value}
                    className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-base font-semibold text-ink-muted transition-colors has-[:checked]:border-[#1565D8] has-[:checked]:bg-[#EAF4FC] has-[:checked]:text-[#1565D8] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#1565D8]/40"
                  >
                    <input
                      type="radio"
                      name="tipo"
                      value={t.value}
                      required
                      checked={tipo === t.value}
                      onChange={() => setTipo(t.value)}
                      className="sr-only"
                    />
                    <IconoPersona className="size-6" />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="usuarioId" className="mb-1 block text-sm font-medium text-[#0B2A4A]">
                {tipo === "APROBACION" ? "Aprobador" : "Recorredor"}
              </label>
              <div className="relative">
                <select
                  id="usuarioId"
                  name="usuarioId"
                  required
                  // `key` por tipo: al cambiar de tipo se descarta la selección anterior.
                  key={tipo}
                  defaultValue={valores.tipo === tipo ? valores.usuarioId : ""}
                  className={`${CONTROL} appearance-none pr-10`}
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
                <IconoChevron className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="fecha" className="mb-1 block text-sm font-medium text-[#0B2A4A]">
                  Fecha
                </label>
                <div className="relative">
                  <IconoCalendario className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[#1565D8]" />
                  <input
                    id="fecha"
                    name="fecha"
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className={`${CONTROL} pl-10 ${fecha ? "pr-11" : ""}`}
                  />
                  {fecha && (
                    <button
                      type="button"
                      aria-label="Borrar fecha"
                      onClick={() => setFecha("")}
                      className={`absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-ink-muted hover:text-[#0B2A4A] ${ANILLO}`}
                    >
                      <IconoCerrar className="size-4" />
                    </button>
                  )}
                </div>
              </div>
              <CampoHora name="horaDesde" etiqueta="Desde" valor={horaDesde} onChange={cambiarHora(setHoraDesde)} />
              <CampoHora
                name="horaHasta"
                etiqueta="Hasta"
                valor={horaHasta}
                onChange={cambiarHora(setHoraHasta)}
                alinear="derecha"
              />
            </div>

            <div>
              <label htmlFor="justificacion" className="mb-1 block text-sm font-medium text-[#0B2A4A]">
                Justificación
              </label>
              <textarea
                id="justificacion"
                name="justificacion"
                required
                minLength={JUSTIFICACION_MINIMA}
                maxLength={JUSTIFICACION_MAXIMA}
                rows={4}
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Indica el motivo de la habilitación fuera del horario."
                className={`${CONTROL} py-2 placeholder:text-ink-muted/70`}
              />
              <div className="mt-1 flex items-start justify-between gap-3 text-xs text-ink-muted">
                <span>Mínimo 10 caracteres. Queda registrada en la auditoría.</span>
                <span className="shrink-0 tabular-nums" aria-live="off">
                  {justificacion.length} / {JUSTIFICACION_MAXIMA}
                </span>
              </div>
            </div>

            <BotonHabilitar pendiente={pendiente} />
          </form>
        </div>

        <VistaRapida fecha={fecha} desde={horaDesde} hasta={horaHasta} invertido={rangoInvertido} />
      </div>
    </section>
  );
}

function BotonHabilitar({ pendiente }: { pendiente: boolean }) {
  const { pending } = useFormStatus();
  const enCurso = pendiente || pending;
  return (
    <button
      type="submit"
      disabled={enCurso}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2A4A] px-4 text-base font-semibold text-white shadow-sm active:opacity-90 disabled:opacity-60 ${ANILLO}`}
    >
      <IconoCheckCirculo className="size-5" />
      {enCurso ? "Guardando…" : "Habilitar"}
    </button>
  );
}

function VistaRapida({
  fecha,
  desde,
  hasta,
  invertido,
}: {
  fecha: string;
  desde: string;
  hasta: string;
  invertido: boolean;
}) {
  return (
    <aside aria-label="Vista rápida" className="flex h-fit flex-col gap-4 rounded-2xl border border-[#d6e6f5] bg-[#EAF4FC]/50 p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-[#0B2A4A]">
        <IconoReloj className="size-5 text-[#1565D8]" />
        Vista rápida
      </h3>
      <Dato icono={<IconoCalendario className="size-5" />} titulo="Fecha" valor={formatearFechaLarga(fecha)} />
      <Dato icono={<IconoReloj className="size-5" />} titulo="Horario autorizado" valor={formatearRango(desde, hasta)} />
      <Dato icono={<IconoReloj className="size-5" />} titulo="Duración" valor={duracionTexto(desde, hasta)} />
      {invertido && (
        <p role="alert" className="rounded-lg bg-status-warn-soft px-3 py-2 text-sm font-medium text-status-warn-ink">
          La hora Hasta debe ser posterior a la hora Desde.
        </p>
      )}
      <p className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-[#1565D8]">
        <IconoReloj className="size-4 shrink-0" />
        Hora de Bogotá (UTC-5)
      </p>
    </aside>
  );
}

function Dato({ icono, titulo, valor }: { icono: ReactNode; titulo: string; valor: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#1565D8]">{icono}</span>
      <div>
        <p className="text-xs text-ink-muted">{titulo}</p>
        <p className="text-base font-semibold text-[#0B2A4A]">{valor}</p>
      </div>
    </div>
  );
}
