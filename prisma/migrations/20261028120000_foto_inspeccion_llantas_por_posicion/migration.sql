-- Fotos de llantas por posicion (feature fotos-llantas-por-posicion): MOTO delantera/trasera, CARRO las cuatro.
ALTER TYPE "TipoFotoInspeccion" ADD VALUE 'LLANTA_DELANTERA';
ALTER TYPE "TipoFotoInspeccion" ADD VALUE 'LLANTA_TRASERA';
ALTER TYPE "TipoFotoInspeccion" ADD VALUE 'LLANTA_DELANTERA_IZQUIERDA';
ALTER TYPE "TipoFotoInspeccion" ADD VALUE 'LLANTA_DELANTERA_DERECHA';
ALTER TYPE "TipoFotoInspeccion" ADD VALUE 'LLANTA_TRASERA_IZQUIERDA';
ALTER TYPE "TipoFotoInspeccion" ADD VALUE 'LLANTA_TRASERA_DERECHA';
