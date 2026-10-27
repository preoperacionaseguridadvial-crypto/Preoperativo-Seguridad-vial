import { tienePermisosSst } from "@/lib/auth/permisos";

export type AccionRapida = {
  etiqueta: string;
  href: string;
  icono: "buscar" | "rechazada" | "pendiente" | "descarga" | "usuarios";
  /** `true` -> `<a>` normal (respuesta de archivo); `false` -> `<Link>` de Next. */
  descarga: boolean;
};

/**
 * Espejo de la validación de app/api/reportes/excel/route.ts: DIRECTOR y
 * quienes tienen permisos de SST (SST y ADMINISTRADOR).
 */
export function puedeExportarExcel(role: string): boolean {
  return role === "DIRECTOR" || tienePermisosSst(role);
}

/** Espejo de `/admin` en proxy.ts: ADMINISTRADOR y SST (DIRECTOR sería redirigido). */
function puedeGestionarUsuarios(role: string): boolean {
  return role === "ADMINISTRADOR" || role === "SST";
}

/**
 * Enlaces del panel "Acciones rápidas". Solo rutas que existen y que el rol
 * del visor puede abrir — `/consulta-inspecciones` lo permiten todos los
 * roles que llegan al dashboard.
 */
export function accionesRapidasPara(role: string, urlExcel: string): AccionRapida[] {
  const acciones: AccionRapida[] = [
    { etiqueta: "Buscar inspecciones", href: "/consulta-inspecciones", icono: "buscar", descarga: false },
    { etiqueta: "Ver rechazadas", href: "/consulta-inspecciones?estado=RECHAZADA", icono: "rechazada", descarga: false },
    {
      etiqueta: "Ver pendientes de aprobación",
      href: "/consulta-inspecciones?estado=PENDIENTE_APROBACION",
      icono: "pendiente",
      descarga: false,
    },
  ];
  if (puedeExportarExcel(role)) {
    acciones.push({ etiqueta: "Exportar Excel", href: urlExcel, icono: "descarga", descarga: true });
  }
  if (puedeGestionarUsuarios(role)) {
    acciones.push({ etiqueta: "Gestionar usuarios", href: "/admin/usuarios", icono: "usuarios", descarga: false });
  }
  return acciones;
}
