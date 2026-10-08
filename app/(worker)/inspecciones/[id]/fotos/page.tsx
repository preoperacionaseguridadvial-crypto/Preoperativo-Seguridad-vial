import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getPreviousStepPath,
  getFotosInspeccion,
} from "@/lib/inspections/queries";
import { getSignedReadUrl } from "@/lib/storage/s3";
import { BotonAtras } from "@/app/(worker)/inspecciones/_components/BotonAtras";
import { SubirFotoInspeccion } from "@/app/(worker)/inspecciones/_components/SubirFotoInspeccion";

// Fotos diarias obligatorias (Fase soporte-moto-carro, Slice 3, A7):
// lateral y placa del vehículo, independiente del resultado del checklist —
// por eso este paso vive aparte, no dentro de ningún ChecklistItem. La captura
// y la subida las hace `SubirFotoInspeccion` (cámara trasera, compresión en el
// navegador, barra de progreso real) contra el route handler
// `/inspecciones/[id]/fotos/[tipo]/subir`, que delega en `subirFotoInspeccion`
// (lib/inspections/foto-actions.ts): esa es la validación real de backend —
// `enviarInspeccion` vuelve a exigir ambas fotos antes de enviar. Una foto ya
// subida se puede reemplazar ("Cambiar foto") mientras la inspección siga
// EN_PROCESO.
export default async function FotosInspeccionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  const { lateral, placa } = await getFotosInspeccion(id);
  const hrefAtras =
    (await getPreviousStepPath(id, "fotos")) ?? `/inspecciones/${id}/estado-conductor?paso=3`;

  // URL firmada de cada foto guardada para la miniatura. Si la firma falla la
  // página igual carga, solo que sin miniatura.
  const [urlLateral, urlPlaca] = await Promise.all(
    [lateral, placa].map((foto) => (foto ? getSignedReadUrl(foto.s3Key).catch(() => null) : null)),
  );

  const ambasCompletas = Boolean(lateral && placa);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <BotonAtras href={hrefAtras} />
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Fotos del vehículo</h1>
        <p className="mt-1 text-sm text-gray-500">Dos fotos obligatorias antes de continuar.</p>
      </div>

      <SubirFotoInspeccion
        inspectionId={id}
        tipo="lateral"
        titulo="Foto lateral del vehículo"
        existe={Boolean(lateral)}
        urlMiniatura={urlLateral}
      />

      <SubirFotoInspeccion
        inspectionId={id}
        tipo="placa"
        titulo="Foto de la placa"
        existe={Boolean(placa)}
        urlMiniatura={urlPlaca}
      />

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
