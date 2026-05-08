// =============================================================================
// controllers/bitacora.controller.js — CU19: BITÁCORA DEL SISTEMA
//
// Registra cada acción importante en la tabla `bitacora` de la BD.
// Es llamado internamente por otros controladores Y por el frontend.
//
// Acciones registradas:
//   LOGIN             → inicio de sesión exitoso
//   LOGOUT            → cierre de sesión
//   CREAR_RESERVA     → cliente reservó una cita
//   CANCELAR_RESERVA  → cita cancelada
//   EDITAR_RESERVA    → cita reprogramada
//
// IMPORTANTE: registrarEvento falla silenciosamente (catch vacío) para no
// interrumpir el flujo principal si la tabla bitacora no existe o hay un error de BD.
// =============================================================================

const pool = require('../config/db');

// Crea la tabla bitácora automáticamente si no existe al iniciar el servidor
async function initBitacora() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bitacora (
                id_bitacora    SERIAL PRIMARY KEY,
                ci_usuario     VARCHAR(20),
                nombre_usuario VARCHAR(100),
                rol            VARCHAR(50),
                accion         VARCHAR(100) NOT NULL,
                descripcion    TEXT,
                fecha_hora     TIMESTAMP DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora (fecha_hora DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_bitacora_ci ON bitacora (ci_usuario)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_bitacora_accion ON bitacora (accion)`);
        console.log('✅ Tabla bitácora lista');
    } catch (err) {
        console.error('❌ Error init bitácora:', err.message);
    }
}
initBitacora();

// -----------------------------------------------------------------------------
// Función interna — llamada por otros controladores (no expuesta como ruta HTTP).
// ci_usuario, nombre_usuario, rol → quién hizo la acción
// accion                          → código de la acción (ej: 'LOGIN')
// descripcion                     → detalle legible (ej: 'Inicio de sesión exitoso')
// -----------------------------------------------------------------------------
async function registrarEvento(ci_usuario, nombre_usuario, rol, accion, descripcion) {
    try {
        await pool.query(
            `INSERT INTO bitacora (ci_usuario, nombre_usuario, rol, accion, descripcion)
             VALUES ($1, $2, $3, $4, $5)`,
            [ci_usuario || '—', nombre_usuario || '—', rol || '—', accion, descripcion || '']
        );
    } catch {
        // Silencioso: nunca crashear el flujo principal por un error de bitácora
    }
}

// =============================================================================
// POST /api/bitacora
// El frontend llama este endpoint para registrar acciones que ocurren en el
// cliente (ej: LOGOUT, que es completamente front-end y no pasa por el servidor).
// Recibe: { ci_usuario, nombre_usuario, rol, accion, descripcion }
// =============================================================================
async function registrarEventoAPI(req, res) {
    const { ci_usuario, nombre_usuario, rol, accion, descripcion } = req.body;
    if (!accion) {
        return res.status(400).json({ success: false, message: 'El campo accion es obligatorio.' });
    }
    await registrarEvento(ci_usuario, nombre_usuario, rol, accion, descripcion);
    res.json({ success: true });
}

// =============================================================================
// GET /api/admin/bitacora
// Devuelve los últimos 500 eventos de la bitácora ordenados de más reciente a
// más antiguo. Solo el administrador debería acceder a esta ruta.
// =============================================================================
async function getBitacora(req, res) {
    try {
        const result = await pool.query(
            `SELECT id_bitacora, ci_usuario, nombre_usuario, rol, accion, descripcion,
                    TO_CHAR(fecha_hora, 'DD/MM/YYYY HH24:MI:SS') AS fecha_hora
             FROM bitacora
             ORDER BY fecha_hora DESC
             LIMIT 500`
        );
        res.json({ success: true, eventos: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { registrarEvento, registrarEventoAPI, getBitacora };
