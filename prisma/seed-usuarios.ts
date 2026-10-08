import { Role, Sede, TipoVehiculo } from "../generated/prisma/client";

// Usuarios y vehículos demo, compartidos por el seed (prisma/seed.ts) y por el
// script de alineación de la base de desarrollo (scripts/alinear-usuarios-ess.ts):
// un solo lugar donde figuran los correos alineados con los cargos reales de ESS.

export type SeedUser = {
  email: string;
  name: string;
  role: Role;
  cedula: string;
  // Solo los Recorredores demo necesitan un tipo de vehículo asignado para
  // poder probar el flujo de inspección de punta a punta; cada uno queda
  // además vinculado a SU vehículo (1:1, ver SEED_VEHICULOS).
  tipoVehiculo?: TipoVehiculo;
  // Sede (roles-oleariari): la exige el panel para los Recorredores. En Oleariari
  // la inspección pasa primero por el Supervisor Oleariari.
  sede?: Sede;
};

export const SEED_USERS: SeedUser[] = [
  {
    email: "recorredor.bogota@ess.local",
    name: "Recorredor Bogotá Demo",
    role: Role.TRABAJADOR,
    cedula: "1001234567",
    tipoVehiculo: TipoVehiculo.MOTO,
    sede: Sede.BOGOTA,
  },
  {
    email: "trabajador.carro@ess.local",
    name: "Recorredor Carro Demo",
    role: Role.TRABAJADOR,
    cedula: "1001234568",
    tipoVehiculo: TipoVehiculo.CARRO,
    sede: Sede.BOGOTA,
  },
  {
    email: "recorredor.oleariari@ess.local",
    name: "Recorredor Oleariari Demo",
    role: Role.TRABAJADOR,
    cedula: "1001234569",
    tipoVehiculo: TipoVehiculo.MOTO,
    sede: Sede.OLEARIARI,
  },
  {
    email: "supervisor.oleariari@ess.local",
    name: "Supervisor Oleariari Demo",
    role: Role.SUPERVISOR_OLEARIARI,
    cedula: "1002345679",
  },
  {
    email: "director.operaciones@ess.local",
    name: "Director de Operaciones Demo",
    role: Role.SUPERVISOR,
    cedula: "1002345678",
  },
  { email: "director@ess.local", name: "Director Demo", role: Role.DIRECTOR, cedula: "1003456789" },
  { email: "admin.sst@ess.local", name: "Administrador SST Demo", role: Role.SST, cedula: "1004567890" },
  // Usuario de PRUEBA para entrar al panel de administración — la cuenta
  // real que va a operar el dueño de producto se crea desde adentro del
  // panel (o se reemplaza esta con credenciales propias).
  { email: "admin@ess.local", name: "Administrador Demo", role: Role.ADMINISTRADOR, cedula: "1005678901" },
];

// Vencimiento de tecnicomecánica de los vehículos demo, también futuro.
export const SEED_FECHA_VENCIMIENTO_TECNICOMECANICA = new Date("2027-03-15T00:00:00.000Z");

// Hoja de vida demo de los vehículos (sin foto: la foto real se sube desde el
// panel de administración al crear/editar el usuario).
const SEED_HOJA_DE_VIDA_MOTO = {
  marca: "Yamaha",
  modelo: "FZ 150",
  color: "Negro",
  fechaVencimientoSoat: new Date("2027-04-30T00:00:00.000Z"),
};
const SEED_HOJA_DE_VIDA_CARRO = {
  marca: "Chevrolet",
  modelo: "Spark GT",
  color: "Blanco",
  fechaVencimientoSoat: new Date("2027-05-31T00:00:00.000Z"),
};

/** Un vehículo por Recorredor demo (relación 1:1 `User.vehicleId`). */
export const SEED_VEHICULOS = [
  {
    placa: "ABC123",
    tipo: "Motocicleta",
    tipoVehiculo: TipoVehiculo.MOTO,
    hojaDeVida: SEED_HOJA_DE_VIDA_MOTO,
    usuarioEmail: "recorredor.bogota@ess.local",
  },
  {
    placa: "XYZ789",
    tipo: "Automóvil",
    tipoVehiculo: TipoVehiculo.CARRO,
    hojaDeVida: SEED_HOJA_DE_VIDA_CARRO,
    usuarioEmail: "trabajador.carro@ess.local",
  },
  {
    placa: "OLA123",
    tipo: "Motocicleta",
    tipoVehiculo: TipoVehiculo.MOTO,
    hojaDeVida: SEED_HOJA_DE_VIDA_MOTO,
    usuarioEmail: "recorredor.oleariari@ess.local",
  },
] as const;

/**
 * Correos anteriores de los usuarios demo que cambiaron de nombre al alinear
 * los roles con los cargos de ESS. El script de alineación los renombra en
 * sitio (conserva id, inspecciones y firmas).
 */
export const RENOMBRES_USUARIOS_DEMO = [
  { anterior: "trabajador@ess.local", nuevo: "recorredor.bogota@ess.local" },
  { anterior: "supervisor@ess.local", nuevo: "director.operaciones@ess.local" },
  { anterior: "sst@ess.local", nuevo: "admin.sst@ess.local" },
  // Corrección ortográfica de la sede (OLARIARI → OLEARIARI).
  { anterior: "recorredor.olariari@ess.local", nuevo: "recorredor.oleariari@ess.local" },
  { anterior: "supervisor.olariari@ess.local", nuevo: "supervisor.oleariari@ess.local" },
] as const;
