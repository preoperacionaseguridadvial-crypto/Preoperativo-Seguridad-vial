import { AppHeader } from "@/app/_components/AppHeader";

// Layout compartido de las pantallas de Gestión/Dirección (app/(gestion)/**:
// dashboard, consulta-inspecciones). Mismo encabezado (logo + Inicio) que el
// flujo del trabajador y el del Supervisor — ver app/_components/AppHeader.tsx.
export default function GestionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
