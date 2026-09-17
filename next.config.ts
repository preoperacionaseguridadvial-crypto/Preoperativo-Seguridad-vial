import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El worker de validación de Next 16 (aislado en un thread) se cae al
    // navegar tras un server action ("Jest worker encountered N child
    // process exceptions, exceeding retry limit"). Desactivado como
    // workaround: solo corre en dev, no afecta build/producción.
    devValidationWorker: false,
  },
};

export default nextConfig;
