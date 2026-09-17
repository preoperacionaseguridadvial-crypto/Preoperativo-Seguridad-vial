import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath, getFotosInspeccion } from "@/lib/inspections/queries";
import { subirFotoInspeccion } from "@/lib/inspections/foto-actions";
import { CapturaFotoInput } from "@/app/(worker)/inspecciones/_components/CapturaFotoInput";
import { TipoFotoInspeccion } from "@/generated/prisma/client";

// Fotos diarias obligatorias (Fase soporte-moto-carro, Slice 3, A7):
// lateral y placa del vehículo, independiente del resultado del checklist —
// por eso este paso vive aparte, no dentro de ningún ChecklistItem. Mismo
// patrón de captura que la foto de novedad
// (app/(worker)/inspecciones/[id]/novedades/[novedadId]/foto/page.tsx):
// cámara trasera directo (`CapturaFotoInput`), auto-submit al elegir la
// foto. `subirFotoInspeccion` (lib/inspections/foto-actions.ts) es la
// validación real de backend — `enviarInspeccion` vuelve a exigir ambas
// fotos antes de enviar.
export default async function FotosInspeccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  const { lateral, placa } = await getFotosInspeccion(id);

  async function subirLateralAction(formData: FormData) {
    "use server";
    try {
      await subirFotoInspeccion(id, TipoFotoInspeccion.LATERAL, formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir la foto.";
      redirect(`/inspecciones/${id}/fotos?error=${encodeURIComponent(message)}`);
    }
    redirect(`/inspecciones/${id}/fotos`);
  }

  async function subirPlacaAction(formData: FormData) {
    "use server";
    try {
      await subirFotoInspeccion(id, TipoFotoInspeccion.PLACA, formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir la foto.";
      redirect(`/inspecciones/${id}/fotos?error=${encodeURIComponent(message)}`);
    }
    redirect(`/inspecciones/${id}/fotos`);
  }

  const ambasCompletas = Boolean(lateral && placa);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Fotos del vehículo</h1>
        <p className="mt-1 text-sm text-gray-500">Dos fotos obligatorias antes de continuar.</p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-700">Foto lateral del vehículo</h2>
        {lateral ? (
          <p className="text-sm text-green-700">✓ Foto adjuntada.</p>
        ) : (
          <form action={subirLateralAction}>
            <CapturaFotoInput />
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-700">Foto de la placa</h2>
        {placa ? (
          <p className="text-sm text-green-700">✓ Foto adjuntada.</p>
        ) : (
          <form action={subirPlacaAction}>
            <CapturaFotoInput />
          </form>
        )}
      </section>

      {ambasCompletas && <ContinuarLink inspectionId={id} />}
    </main>
  );
}

async function ContinuarLink({ inspectionId }: { inspectionId: string }) {
  const next = await getNextStepPath(inspectionId);
  return (
    <Link
      href={next}
      className="block w-full rounded-md bg-[#0B3B60] px-4 py-4 text-center text-base font-semibold text-white hover:bg-[#0B3B60]/90"
    >
      Continuar
    </Link>
  );
}
