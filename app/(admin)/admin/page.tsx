import { redirect } from "next/navigation";

// Punto de entrada de /admin: no tiene contenido propio, va directo a la
// sección principal (usuarios).
export default function AdminPage() {
  redirect("/admin/usuarios");
}
