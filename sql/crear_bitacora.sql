-- =============================================================================
-- TABLA BITÁCORA (CU19)
-- Ejecutar este script UNA SOLA VEZ en la BD proyectosi1 antes de usar el sistema.
-- Registra cada acción importante: login, logout, reservar, editar, cancelar cita.
-- =============================================================================

CREATE TABLE IF NOT EXISTS bitacora (
    id_bitacora    SERIAL PRIMARY KEY,
    ci_usuario     VARCHAR(20),
    nombre_usuario VARCHAR(100),
    rol            VARCHAR(50),
    accion         VARCHAR(100) NOT NULL,
    descripcion    TEXT,
    fecha_hora     TIMESTAMP DEFAULT NOW()
);

-- Índice para búsquedas rápidas por usuario o por fecha
CREATE INDEX IF NOT EXISTS idx_bitacora_ci       ON bitacora (ci_usuario);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha    ON bitacora (fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_accion   ON bitacora (accion);
