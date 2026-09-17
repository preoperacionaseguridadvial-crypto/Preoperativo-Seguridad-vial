import { AppHeader } from "@/app/_components/AppHeader";

// Layout compartido del panel de Administrador (app/(admin)/admin/**).
// Mismo encabezado (logo + Inicio) que el flujo del trabajador, el del
// Supervisor y el de Gestión — ver app/_components/AppHeader.tsx.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
