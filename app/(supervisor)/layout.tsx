import { AppHeader } from "@/app/_components/AppHeader";

// Layout compartido de las pantallas del Supervisor (app/(supervisor)/**:
// aprobaciones, detalle, firma). Mismo encabezado (logo + Inicio) que el
// flujo del trabajador y el de Gestión — ver app/_components/AppHeader.tsx.
export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
