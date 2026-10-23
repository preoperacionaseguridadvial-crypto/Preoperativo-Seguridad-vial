import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { Role, TipoHabilitacion } from "@/generated/prisma/client";
import { etiquetaUsuario } from "@/lib/auth/etiquetas-rol";
import { formatFecha, formatFechaHoraMedia, formatHora } from "@/lib/fechas/formato";
import { estadoHabilitacion, type EstadoHabilitacion } from "@/lib/horarios/habilitacion-fechas";
import { FormularioHabilitacion } from "./_components/FormularioHabilitacion";

const LIMITE_LISTA = 100;

const ETIQUETA_TIPO: Record<TipoHabilitacion, string> = {
  RECORREDOR: "Inspección (recorredor)",
  APROBACION: "Aprobación",
};

const ESTADO_UI: Record<EstadoHabilitacion, { texto: string; clase: string }> = {
  VIGENTE: { texto: "Vigente", clase: "bg-status-ok-soft text-status-ok-ink" },
  PROGRAMADA: { texto: "Programada", clase: "bg-status-info-soft text-status-info-ink" },
  FINALIZADA: { texto: "Finalizada", clase: "bg-status-neutral-soft text-status-neutral-ink" },
};

// Módulo SST "Inspecciones fuera de horario": otorgar habilitaciones y ver las
// otorgadas. La barrera real es `requireRole([SST])` en la server action; acá
// solo se evita mostrar el formulario a quien no podría usarlo.
export default async function HabilitacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ahora = new Date();
  const [usuarios, habilitaciones] = await Promise.all([
    prisma.user.findMany({
      where: { activo: true, role: { in: [Role.TRABAJADOR, Role.SUPERVISOR, Role.SUPERVISOR_OLEARIARI] } },
      select: { id: true, name: true, role: true, sede: true },
      orderBy: { name: "asc" },
    }),
    prisma.habilitacionHorario.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMITE_LISTA,
      include: {
        usuario: { select: { name: true, role: true } },
        otorgadaPor: { select: { name: true } },
      },
    }),
  ]);

  const opcion = (u: (typeof usuarios)[number]) => ({ id: u.id, etiqueta: `${u.name} · ${etiquetaUsuario(u.role, u.sede)}` });
  const puedeOtorgar = session.user.role === Role.SST;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Inspecciones fuera de horario</h1>
        <p className="text-sm text-ink-muted">Habilita a un recorredor o aprobador a actuar fuera del horario.</p>
      </div>

      {puedeOtorgar ? (
        <FormularioHabilitacion
          recorredores={usuarios.filter((u) => u.role === Role.TRABAJADOR).map(opcion)}
          aprobadores={usuarios.filter((u) => u.role !== Role.TRABAJADOR).map(opcion)}
        />
      ) : (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
          Solo la Administradora SST puede otorgar habilitaciones.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Habilitaciones otorgadas</h2>
        {habilitaciones.length === 0 ? (
          <p className="text-sm text-ink-muted">Aún no hay habilitaciones.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {habilitaciones.map((h) => {
              const estado = ESTADO_UI[estadoHabilitacion(h, ahora)];
              return (
                <li key={h.id} className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{ETIQUETA_TIPO[h.tipo]}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.clase}`}>
                      {estado.texto}
                    </span>
                  </div>
                  <p className="text-base font-medium text-ink">{h.usuario.name}</p>
                  <p className="text-sm text-ink">
                    {formatFecha(h.desde)}, {formatHora(h.desde)} a {formatHora(h.hasta)}
                  </p>
                  <p className="text-sm text-ink-muted">{h.justificacion}</p>
                  <p className="text-xs text-ink-muted">
                    Otorgada por {h.otorgadaPor.name} · {formatFechaHoraMedia(h.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {habilitaciones.length === LIMITE_LISTA && (
          <p className="text-xs text-ink-muted">Se muestran las últimas {LIMITE_LISTA} habilitaciones.</p>
        )}
      </section>
    </main>
  );
}
