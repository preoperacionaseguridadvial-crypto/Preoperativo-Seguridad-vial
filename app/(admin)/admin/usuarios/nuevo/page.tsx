import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { NuevoUsuarioForm } from "./_components/NuevoUsuarioForm";

// El formulario (y la pantalla de éxito con las credenciales) viven en un
// Client Component para usar `useActionState`: la contraseña se devuelve como
// estado de la server action y nunca pasa por la URL.
export default async function NuevoUsuarioPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <NuevoUsuarioForm />
    </main>
  );
}
