import type { ReporteHorarios } from "@/lib/horarios/reportes-horario";
import { ETIQUETA_ETAPA } from "@/lib/horarios/metricas-horario";
import { formatFechaHora } from "@/lib/fechas/formato";
import { Tarjeta } from "./Tarjeta";

const fmtMin = (m: number) => `${m.toLocaleString("es-CO", { maximumFractionDigits: 1 })} min`;

/**
 * "Cumplimiento de horarios": envíos fuera de horario, duración de las
 * inspecciones, tiempos de respuesta de los aprobadores, aprobaciones vencidas y
 * habilitaciones SST. Mismos filtros de fecha y sede que el resto del dashboard;
 * ver la cabecera de lib/horarios/reportes-horario.ts para la fecha que usa cada
 * métrica.
 */
export function SeccionHorarios({ datos }: { datos: ReporteHorarios }) {
  const p = datos.pendientesVencidas;
  return (
    <>
      <h2 className="mt-2 text-lg font-semibold text-ink">Cumplimiento de horarios</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Fuera de horario por recorredor" subtitulo="Envíos con habilitación SST e intentos bloqueados">
          <Tabla
            vacio="Sin envíos ni intentos fuera de horario en el período."
            columnas={["Recorredor", "Enviadas", "Bloqueados"]}
            filas={datos.fueraDeHorario.map((f) => [f.nombre, f.enviadasFueraDeHorario, f.intentosBloqueados])}
          />
        </Tarjeta>

        <Tarjeta titulo="Duración promedio de la inspección" subtitulo="Desde que inicia hasta que envía">
          <Tabla
            vacio="Sin inspecciones enviadas en el período."
            columnas={["Recorredor", "Inspecciones", "Promedio"]}
            filas={datos.duracionPorRecorredor.map((f) => [f.nombre, f.inspecciones, fmtMin(f.promedioMinutos)])}
          />
        </Tarjeta>

        <Tarjeta titulo="Tiempo de respuesta de aprobadores" subtitulo="Desde que le corresponde decidir hasta que decide">
          <Tabla
            vacio="Sin decisiones en el período."
            columnas={["Aprobador", "Etapa", "Decisiones", "Promedio"]}
            filas={datos.respuestaPorAprobador.map((f) => [
              f.nombre,
              ETIQUETA_ETAPA[f.etapa],
              f.decisiones,
              fmtMin(f.promedioMinutos),
            ])}
          />
          {datos.respuestaPorEtapa.length > 0 && (
            <p className="text-xs text-ink-muted">
              Por etapa:{" "}
              {datos.respuestaPorEtapa
                .map((e) => `${ETIQUETA_ETAPA[e.etapa]} ${fmtMin(e.promedioMinutos)} (${e.decisiones})`)
                .join(" · ")}
            </p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Aprobaciones vencidas" subtitulo="Fuera del horario de aprobación (5:45 a 8:00 a. m. y p. m.)">
          <p className="text-sm text-ink">
            Pendientes con plazo vencido ahora: <strong>{p.SUPERVISOR_OLEARIARI + p.SUPERVISOR}</strong>
            <span className="text-ink-muted">
              {" "}
              ({ETIQUETA_ETAPA.SUPERVISOR_OLEARIARI}: {p.SUPERVISOR_OLEARIARI} · {ETIQUETA_ETAPA.SUPERVISOR}: {p.SUPERVISOR})
            </span>
          </p>
          <Tabla
            vacio="Sin decisiones fuera de plazo ni intentos bloqueados en el período."
            columnas={["Aprobador", "Decididas fuera de plazo", "Intentos bloqueados"]}
            filas={datos.vencidasPorAprobador.map((f) => [f.nombre, f.decididasFueraDePlazo, f.intentosBloqueados])}
          />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Habilitaciones SST" subtitulo="Excepciones otorgadas en el período">
        <Tabla
          vacio="No se otorgaron habilitaciones en el período."
          columnas={["Tipo", "Beneficiario", "Desde", "Hasta", "Justificación", "Otorgada por", "Fecha"]}
          filas={datos.habilitaciones.map((h) => [
            h.tipo === "RECORREDOR" ? "Recorredor" : "Aprobación",
            h.beneficiario,
            formatFechaHora(h.desde),
            formatFechaHora(h.hasta),
            h.justificacion,
            h.otorgadaPor,
            formatFechaHora(h.createdAt),
          ])}
          ancho="min-w-[720px]"
        />
      </Tarjeta>
    </>
  );
}

function Tabla({
  columnas,
  filas,
  vacio,
  ancho = "min-w-[320px]",
}: {
  columnas: string[];
  filas: (string | number)[][];
  vacio: string;
  ancho?: string;
}) {
  if (filas.length === 0) return <p className="text-sm text-ink-muted">{vacio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${ancho} text-left text-sm`}>
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            {columnas.map((c, i) => (
              <th key={c} className={`py-2 pr-2 font-medium ${i === 0 || typeof filas[0][i] === "string" ? "" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, r) => (
            <tr key={r} className="border-b border-border/60 last:border-0">
              {fila.map((celda, i) => (
                <td key={i} className={`py-2 pr-2 ${i === 0 ? "font-medium text-ink" : ""} ${typeof celda === "number" ? "text-right" : ""}`}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
