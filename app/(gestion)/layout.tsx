import { AppHeader } from "@/app/_components/AppHeader";

// Layout compartido de las pantallas de Gestión/Dirección (app/(gestion)/**:
// dashboard, consulta-inspecciones). Encabezado en variante destacada: sin
// logo y con "Inicio" bien visible — ver app/_components/AppHeader.tsx.
export default function GestionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader destacado />
      {children}
    </div>
  );
}
