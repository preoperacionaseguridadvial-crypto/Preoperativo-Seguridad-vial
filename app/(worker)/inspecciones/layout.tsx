import { AppHeader } from "@/app/_components/AppHeader";

// Layout compartido de las pantallas del flujo guiado del trabajador
// (app/(worker)/inspecciones/**). `flex flex-1 flex-col` para que el
// `<main className="flex-1 ...">` de cada pantalla siga creciendo
// correctamente dentro del `<body className="flex flex-col">` del layout
// raíz (app/layout.tsx). Encabezado en variante destacada (sin logo, "Inicio"
// como botón visible), igual que Gestión — ver app/_components/AppHeader.tsx.
export default function InspeccionesLayout({ children }: { children: React.ReactNode }) {
  return (
    // `relative`: ancla del "← Atrás" que cada paso dibuja en la barra del
    // encabezado (ver _components/BotonAtras.tsx).
    <div className="relative flex flex-1 flex-col">
      <AppHeader destacado />
      {children}
    </div>
  );
}
