import Image from "next/image";
import type { Role } from "@/generated/prisma/client";
import { rolConAreaHero } from "@/lib/inicio/atajos";

/** SST: banner de bienvenida con nombre completo, cargo, foto del equipo y logo. */
export function HeroInicioSst({ nombre, rol }: { nombre: string | null | undefined; rol: Role }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#EAF4FC]">

      <Image
        src="/login/equipo-seguridad.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[65%_30%]"
      />

      {/* Velo claro a la izquierda para que el texto se lea sobre la foto */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/75 to-white/10 sm:via-white/60 sm:to-transparent lg:from-white/90 lg:via-white/45"
      />
      {/* Franjas diagonales translúcidas */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        className="absolute inset-0 -z-10 h-full w-full"
      >
        <polygon points="0,0 260,0 120,300 0,300" fill="#ffffff" fillOpacity="0.35" />
        <polygon points="300,0 380,0 240,300 160,300" fill="#ffffff" fillOpacity="0.18" />
      </svg>

      {/* Panel diagonal con el logo */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-10 hidden w-[26%] bg-white/85 [clip-path:polygon(28%_0,100%_0,100%_100%,0_100%)] sm:block"
      />
      <div className="absolute inset-y-0 right-0 hidden w-[26%] items-center justify-center pl-[8%] sm:flex">
        <Image
          src="/logo/ess-ltda.png"
          alt="Escort Security Services"
          width={140}
          height={158}
          className="h-24 w-auto mix-blend-multiply lg:h-32"
        />
      </div>

      <div className="relative mx-auto flex min-h-60 w-full max-w-6xl flex-col justify-center gap-3 px-4 py-8 sm:px-6 lg:min-h-80 lg:py-10">
        <p className="text-lg text-[#0B2A4A] sm:text-xl">Bienvenido(a),</p>
        <h1 className="text-3xl font-bold leading-tight text-[#0B2A4A] sm:text-4xl lg:text-5xl">
          {nombre?.trim() || "Usuario"}
        </h1>
        <p>
          <span className="inline-block rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-[#0B3B60] shadow-sm">
            {rolConAreaHero(rol)}
          </span>
        </p>
        <p className="max-w-sm text-base text-[#17324d] sm:max-w-md">
          Gestiona inspecciones, vehículos, usuarios y configuraciones desde un solo lugar.
        </p>
      </div>
    </section>
  );
}
