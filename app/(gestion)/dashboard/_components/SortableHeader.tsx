import Link from "next/link";
import { buildDashboardUrl } from "./dashboard-url";

/**
 * Encabezado de columna que ordena una tabla vía query params (sin JS de
 * cliente): clic cambia `sortParam`/`dirParam` en la URL y el server
 * re-renderiza ya ordenado. Reusado por TablaTrabajadores y TablaVehiculos.
 */
export function SortableHeader({
  label,
  columnKey,
  currentSort,
  currentDir,
  sortParam,
  dirParam,
  searchParams,
}: {
  label: string;
  columnKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  sortParam: string;
  dirParam: string;
  searchParams: Record<string, string | undefined>;
}) {
  const activo = currentSort === columnKey;
  const nuevaDir = activo && currentDir === "asc" ? "desc" : "asc";
  const href = buildDashboardUrl("/dashboard", searchParams, { [sortParam]: columnKey, [dirParam]: nuevaDir });

  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:underline">
      {label}
      {activo && <span aria-hidden="true">{currentDir === "asc" ? "▲" : "▼"}</span>}
    </Link>
  );
}
