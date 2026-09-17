import { AppHeader } from "@/app/_components/AppHeader";

// Layout compartido de las pantallas del flujo guiado del trabajador
// (app/(worker)/inspecciones/**). `flex flex-1 flex-col` para que el
// `<main className="flex-1 ...">` de cada pantalla siga creciendo
// correctamente dentro del `<body className="flex flex-col">` del layout
// raíz (app/layout.tsx). El encabezado (logo + Inicio) vive en
// app/_components/AppHeader.tsx, compartido con los layouts de Supervisor
// y Gestión — mismo componente, mismo aspecto en los tres roles.
export default function InspeccionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
