import Image from "next/image";
import { loginAction } from "./actions";
import { FormularioLogin } from "./FormularioLogin";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email o contraseña incorrectos.",
};

const BENEFICIOS = [
  { titulo: "Inspecciones", detalle: "Registre y valide preoperacionales.", icono: "inspecciones" },
  { titulo: "Control operativo", detalle: "Mantenga sus vehículos en operación.", icono: "camion" },
  { titulo: "Seguimiento", detalle: "Informes y trazabilidad en tiempo real.", icono: "grafico" },
] as const;

function IconoBeneficio({ tipo }: { tipo: (typeof BENEFICIOS)[number]["icono"] }) {
  const comunes = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    className: "h-6 w-6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  if (tipo === "inspecciones") {
    return (
      <svg {...comunes}>
        <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
        <path d="M9 4.5V3.5h6v1M8.5 12.5l2 2 4-4M8.5 17.5h7" />
      </svg>
    );
  }
  if (tipo === "camion") {
    return (
      <svg {...comunes}>
        <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </svg>
    );
  }
  return (
    <svg {...comunes}>
      <path d="M4 20.5h16M7 20.5v-6M12 20.5V9.5M17 20.5v-9M6 7l4-3 4 2 4-3" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#06233f] lg:flex-row">
      {/* Fondo: foto del equipo de seguridad con velo azul (más fuerte a la izquierda). */}
      <Image
        src="/login/equipo-seguridad.png"
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-30 object-cover object-[35%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-gradient-to-b from-[#06233f]/90 via-[#0a3463]/75 to-[#06233f]/90 lg:bg-gradient-to-r lg:from-[#061f3a]/95 lg:via-[#0a3463]/70 lg:to-[#0a3463]/25"
      />
      {/* Formas geométricas translúcidas, solo decoración. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 -z-10 h-full w-full"
      >
        <polygon points="620,0 1000,0 1000,420" fill="#2E9BD6" fillOpacity="0.14" />
        <polygon points="700,1000 1000,1000 1000,560" fill="#1565D8" fillOpacity="0.22" />
        <polygon points="540,0 680,0 380,520" fill="#ffffff" fillOpacity="0.05" />
      </svg>

      {/* Hero */}
      <section className="flex flex-col justify-between px-4 pb-4 pt-8 text-white sm:px-8 lg:w-[60%] lg:px-14 lg:py-12">
        <div>
          <Image
            src="/logo/ess-ltda.png"
            alt="Escort Security Services"
            width={140}
            height={158}
            className="h-20 w-auto brightness-0 invert lg:h-28"
          />
          <div className="mt-4 h-1 w-14 rounded-full bg-[#2E9BD6]" aria-hidden="true" />
        </div>

        <div className="mt-6 lg:mt-0">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-6xl">
            Preoperacional de
            <br />
            <span className="text-[#2BA8F5]">Seguridad Vial</span>
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/90 lg:mt-5 lg:text-xl">
            Gestione inspecciones, recorridos y aprobaciones desde una sola plataforma.
          </p>
          <ul className="mt-6 hidden space-y-4 lg:block">
            {BENEFICIOS.map((b) => (
              <li key={b.titulo} className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#2E9BD6]/60 bg-[#0B3B60]/70 text-white">
                  <IconoBeneficio tipo={b.icono} />
                </span>
                <span>
                  <span className="block text-base font-semibold">{b.titulo}</span>
                  <span className="block text-sm text-white/80">{b.detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 hidden items-center gap-4 lg:flex">
          <span className="h-1 w-14 shrink-0 rounded-full bg-[#2E9BD6]" aria-hidden="true" />
          <p className="text-sm tracking-[0.25em] text-[#9fd3f2]">CONDUCIMOS OPERACIONES MÁS SEGURAS</p>
        </div>
      </section>

      {/* Tarjeta de acceso */}
      <section className="flex flex-1 items-center justify-center px-4 pb-8 pt-4 lg:w-[40%] lg:flex-none lg:px-10 lg:py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_60px_-12px_rgba(3,20,45,0.55)] sm:p-8">
          <div className="mb-5 text-center">
            <Image
              src="/logo/ess-ltda.png"
              alt=""
              width={140}
              height={158}
              className="mx-auto mb-3 hidden h-20 w-auto lg:block"
            />
            <h2 className="text-2xl font-bold text-[#0B2A4A] sm:text-3xl">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-[#5b7390] sm:text-base">Accede a la plataforma de Seguridad Vial</p>
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {ERROR_MESSAGES[error] ?? "No se pudo iniciar sesión."}
            </p>
          )}

          <FormularioLogin accion={loginAction} callbackUrl={callbackUrl ?? ""} />
        </div>
      </section>
    </main>
  );
}
