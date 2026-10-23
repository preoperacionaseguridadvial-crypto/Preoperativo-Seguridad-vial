import { AppHeader } from "@/app/_components/AppHeader";

// Layout compartido del panel de Administrador (app/(admin)/admin/**).
// Encabezado destacado (sin logo, "Inicio" visible) como el flujo del trabajador, el del
// Supervisor y el de Gestión — ver app/_components/AppHeader.tsx.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader destacado />
      {children}
    </div>
  );
}
