import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El worker de validación de Next 16 (aislado en un thread) se cae al
    // navegar tras un server action ("Jest worker encountered N child
    // process exceptions, exceeding retry limit"). Desactivado como
    // workaround: solo corre en dev, no afecta build/producción.
    devValidationWorker: false,
    // El alta/edición de usuario sube la foto del vehículo por Server Action.
    // El límite por defecto es 1 MB y una foto de celular pesa varios: se
    // sube a 10 MB (foto máx. 8 MB, MAX_FOTO_BYTES en
    // lib/admin/hoja-de-vida.ts, más campos y overhead multipart).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
