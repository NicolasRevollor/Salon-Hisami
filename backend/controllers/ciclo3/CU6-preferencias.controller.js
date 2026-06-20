// CU6 — Preferencias del Cliente
const pool            = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');

async function initCU6() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS preferencias_cliente (
            ci_usuario    VARCHAR(20) PRIMARY KEY REFERENCES usuarios(ci) ON DELETE CASCADE,
            color_cabello VARCHAR(100),
            largo         VARCHAR(50),
            estilo        VARCHAR(100),
            notas         TEXT,
            updated_at    TIMESTAMP DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS historial_preferencias_cliente (
            id            SERIAL PRIMARY KEY,
            ci_usuario    VARCHAR(20) REFERENCES usuarios(ci) ON DELETE CASCADE,
            color_cabello VARCHAR(100),
            largo         VARCHAR(50),
            estilo        VARCHAR(100),
            notas         TEXT,
            guardado_at   TIMESTAMP DEFAULT NOW()
        )
    `);
}
initCU6().catch(err => console.error('❌ Error init CU6:', err.message));

// GET /api/ciclo3/preferencias/:ci
async function getPreferencias(req, res) {
    const { ci } = req.params;
    try {
        const r = await pool.query(`
            SELECT u.nombre, u.ci, u.email,
                   pc.color_cabello, pc.largo, pc.estilo, pc.notas, pc.updated_at
            FROM usuarios u
            LEFT JOIN preferencias_cliente pc ON pc.ci_usuario = u.ci
            JOIN roles ro ON u.id_rol = ro.id_rol
            WHERE u.ci = $1 AND ro.nombre = 'Cliente'
        `, [ci]);
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
        res.json({ success: true, data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// PUT /api/ciclo3/preferencias/:ci
async function setPreferencias(req, res) {
    const { ci } = req.params;
    const { color_cabello, largo, estilo, notas, ci_admin, nombre_admin, rol_admin } = req.body;
    try {
        await pool.query(`
            INSERT INTO preferencias_cliente (ci_usuario, color_cabello, largo, estilo, notas, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (ci_usuario) DO UPDATE SET
                color_cabello = EXCLUDED.color_cabello,
                largo         = EXCLUDED.largo,
                estilo        = EXCLUDED.estilo,
                notas         = EXCLUDED.notas,
                updated_at    = NOW()
        `, [ci, color_cabello, largo, estilo, notas]);
        await pool.query(`
            INSERT INTO historial_preferencias_cliente (ci_usuario, color_cabello, largo, estilo, notas)
            VALUES ($1, $2, $3, $4, $5)
        `, [ci, color_cabello, largo, estilo, notas]);
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU6_PREFERENCIAS', `Preferencias actualizadas — cliente CI: ${ci}`, 'Exitoso');
        res.json({ success: true, message: 'Preferencias guardadas correctamente.' });
    } catch (err) {
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU6_PREFERENCIAS', `Error al guardar preferencias CI: ${ci}`, 'Fallido');
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/ciclo3/historial-preferencias/:ci
async function getHistorialPreferencias(req, res) {
    const { ci } = req.params;
    try {
        const r = await pool.query(`
            SELECT id, color_cabello, largo, estilo, notas, guardado_at
            FROM historial_preferencias_cliente
            WHERE ci_usuario = $1
            ORDER BY guardado_at DESC
        `, [ci]);
        res.json({ success: true, historial: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getPreferencias, setPreferencias, getHistorialPreferencias };
