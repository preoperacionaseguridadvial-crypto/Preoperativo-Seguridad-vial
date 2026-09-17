import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath, getNovedadForWorker } from "@/lib/inspections/queries";
import { subirFotoNovedad } from "@/lib/inspections/actions";
import { CapturaFotoInput } from "@/app/(worker)/inspecciones/_components/CapturaFotoInput";

// Pantalla de foto (sección 11 del brief): se usa desde el celular en el
// lugar de la inspección, así que el input pide la cámara directo
// (`capture="environment"`, cámara trasera) en vez de abrir un selector
// genérico — por eso el `accept` queda acotado a imágenes (mezclar con PDF
// hace que el navegador ignore `capture` y vuelva a mostrar el selector
// genérico). Una sola foto por novedad (pedido del dueño de producto): una
// vez subida, el formulario deja de mostrarse — el límite también se valida
// en el servidor (`subirFotoNovedad`, lib/inspections/actions.ts). "Continuar"
// sigue sin ser obligatorio pasar por acá con una foto.
export default async function FotoNovedadPage({
  params,
}: {
  params: Promise<{ id: string; novedadId: string }>;
}) {
  const { id, novedadId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await getOwnInspectionOrNotFound(id, session.user.id);
  const novedad = await getNovedadForWorker(novedadId);
  if (!novedad || novedad.inspectionId !== id) {
    notFound();
  }

  async function subirFotoAction(formData: FormData) {
    "use server";
    await subirFotoNovedad(novedadId, formData);
  }

  const itemNombre = novedad.inspectionItemResponse?.checklistItem.nombre ?? "Novedad";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{itemNombre}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Agregar foto</h1>
        <p className="mt-1 text-sm text-gray-500">Opcional — se admite una sola foto por novedad.</p>
      </div>

      {novedad.photos.length > 0 ? (
        <p className="text-sm text-gray-600">✓ Foto adjuntada.</p>
      ) : (
        <form action={subirFotoAction} className="flex flex-col gap-4">
          <CapturaFotoInput />
        </form>
      )}

      <ContinuarLink inspectionId={id} />
    </main>
  );
}

async function ContinuarLink({ inspectionId }: { inspectionId: string }) {
  const next = await getNextStepPath(inspectionId);
  return (
    <Link
      href={next}
      className="block w-full rounded-md border border-[#0B3B60] px-4 py-4 text-center text-base font-semibold text-[#0B3B60] hover:bg-[#0B3B60]/5"
    >
      Continuar
    </Link>
  );
}
