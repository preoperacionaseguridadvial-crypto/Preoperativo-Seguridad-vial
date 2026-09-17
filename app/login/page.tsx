import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/config";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email o contraseña incorrectos.",
};

async function loginAction(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: typeof callbackUrl === "string" && callbackUrl ? callbackUrl : "/",
    });
  } catch (error) {
    // `signIn` usa `redirect()` internamente en caso de éxito, lo cual
    // funciona lanzando una excepción especial de Next.js que NO es un
    // AuthError y debe volver a lanzarse tal cual.
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[#0B3B60] px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-1 text-xl font-semibold text-[#0B3B60]">
          Preoperacional Seguridad Vial
        </h1>
        <p className="mb-6 text-sm text-gray-500">ESS LTDA</p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERROR_MESSAGES[error] ?? "No se pudo iniciar sesión."}
          </p>
        )}

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-[#0B3B60] px-3 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
