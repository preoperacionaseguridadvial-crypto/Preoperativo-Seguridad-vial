import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getUsuarioPorId } from "@/lib/admin/queries";
import { getSignedReadUrl } from "@/lib/storage/s3";
import { estadoVencimiento, type EstadoVencimiento } from "@/lib/admin/vencimientos";
import { Role } from "@/generated/prisma/client";

const ETIQUETA_ESTADO: Record<EstadoVencimiento, { texto: string; clase: string }> = {
  VIGENTE: { texto: "Vigente", clase: "bg-green-100 text-green-800" },
  POR_VENCER: { texto: "Por vencer", clase: "bg-amber-100 text-amber-800" },
  VENCIDO: { texto: "Vencido", clase: "bg-red-100 text-red-800" },
  SIN_FECHA: { texto: "Sin fecha", clase: "bg-gray-100 text-gray-600" },
};

// Las fechas de vencimiento se guardan a medianoche UTC (`<input type="date">`):
// se formatean en UTC para no mostrar el día anterior en zona horaria local.
function formatFecha(fecha: Date | null | undefined) {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(fecha);
}

// Hoja de vida de un usuario (solo lectura): datos del conductor, datos del
// vehículo (1:1) y estado de cada vencimiento. Se edita desde
// /admin/usuarios/[id]. El proxy ya limita /admin a ADMINISTRADOR y SST; acá
// se vuelve a validar porque la página muestra datos personales.
export default async function HojaDeVidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== Role.ADMINISTRADOR && session.user.role !== Role.SST) {
    redirect("/");
  }

  const usuario = await getUsuarioPorId(id);
  if (!usuario) {
    notFound();
  }

  const vehiculo = usuario.vehicle;
  // URL prefirmada de corta vida; si falla la firma la página sigue sin la foto.
  const fotoUrl = vehiculo?.fotoS3Key
    ? await getSignedReadUrl(vehiculo.fotoS3Key).catch(() => null)
    : null;
  const ahora = new Date();

  const vencimientos: Array<{ etiqueta: string; fecha: Date | null | undefined }> = [
    { etiqueta: "SOAT", fecha: vehiculo?.fechaVencimientoSoat },
    { etiqueta: "Tecnicomecánica", fecha: vehiculo?.fechaVencimientoTecnicomecanica },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/admin/usuarios" className="text-sm text-[#005B96] hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">Hoja de vida</h1>
        <p className="text-sm text-gray-600">
          {usuario.name} · <span className="font-mono text-xs">{usuario.role}</span>
        </p>
        <p className="text-sm text-gray-500">{usuario.email}</p>
        <Link
          href={`/admin/usuarios/${usuario.id}`}
          className="mt-3 inline-block rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
        >
          Editar
        </Link>
      </div>

      <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-500">Conductor</h2>
        <Dato etiqueta="Cédula" valor={usuario.cedula} />
        <Dato etiqueta="Teléfono" valor={usuario.telefono} />
        <Dato etiqueta="Cargo" valor={usuario.cargo} />
        <Dato etiqueta="Puesto asignado" valor={usuario.puestoAsignado} />
        <Dato etiqueta="Conductor activo" valor={usuario.conductorActivo ? "Sí" : "No"} />
        <Dato etiqueta="Usuario activo" valor={usuario.activo ? "Sí" : "No"} />
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-500">Vehículo</h2>
        {!vehiculo ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {usuario.role === Role.TRABAJADOR
              ? "Sin vehículo asignado (pendiente). Complétalo desde Editar."
              : "Este rol no lleva vehículo."}
          </p>
        ) : (
          <>
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto.
              <img
                src={fotoUrl}
                alt={`Foto del vehículo ${vehiculo.placa}`}
                className="h-48 w-full rounded-md border border-gray-200 bg-gray-50 object-contain"
              />
            ) : (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">Sin foto disponible.</p>
            )}
            <Dato etiqueta="Placa" valor={vehiculo.placa} mono />
            <Dato
              etiqueta="Tipo"
              valor={[vehiculo.tipo, vehiculo.tipoVehiculo].filter(Boolean).join(" · ")}
            />
            <Dato etiqueta="Marca" valor={vehiculo.marca} />
            <Dato etiqueta="Modelo" valor={vehiculo.modelo} />
            <Dato etiqueta="Color" valor={vehiculo.color} />
            <Dato etiqueta="Vehículo activo" valor={vehiculo.activo ? "Sí" : "No"} />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-500">Vencimientos</h2>
        {vencimientos.map(({ etiqueta, fecha }) => {
          const estado = ETIQUETA_ESTADO[estadoVencimiento(fecha, ahora)];
          return (
            <div key={etiqueta} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-gray-700">{etiqueta}</p>
                <p className="text-xs text-gray-500">{formatFecha(fecha)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estado.clase}`}>
                {estado.texto}
              </span>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function Dato({
  etiqueta,
  valor,
  mono = false,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-gray-500">{etiqueta}</span>
      <span className={`text-right font-medium text-[#0B3B60] ${mono ? "font-mono text-xs" : ""}`}>
        {valor || "—"}
      </span>
    </div>
  );
}
