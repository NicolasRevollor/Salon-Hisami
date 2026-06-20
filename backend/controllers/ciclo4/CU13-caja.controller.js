// CU13 — Gestionar Apertura / Cierre de Caja
const pool            = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');

async function initCU13() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS caja (
            id_caja        SERIAL PRIMARY KEY,
            fecha_apertura TIMESTAMP DEFAULT NOW(),
            monto_inicial  NUMERIC(10,2) DEFAULT 0,
            monto_final    NUMERIC(10,2),
            estado         VARCHAR(20) DEFAULT 'abierta',
            ci_admin       VARCHAR(20),
            nombre_admin   VARCHAR(150),
            fecha_cierre   TIMESTAMP,
            observaciones  TEXT
        )
    `);
}
initCU13().catch(err => console.error('❌ Error init CU13:', err.message));

// POST /api/ciclo4/caja/abrir
async function abrirCaja(req, res) {
    const { monto_inicial, ci_admin, nombre_admin, rol_admin } = req.body;
    try {
        const cajaAbierta = await pool.query(`SELECT id_caja FROM caja WHERE estado = 'abierta' LIMIT 1`);
        if (cajaAbierta.rows.length)
            return res.status(400).json({ success: false, message: 'Ya existe una caja abierta. Debe cerrarla antes de abrir una nueva.' });

        const r = await pool.query(`
            INSERT INTO caja (monto_inicial, ci_admin, nombre_admin) VALUES ($1, $2, $3) RETURNING *
        `, [parseFloat(monto_inicial) || 0, ci_admin, nombre_admin]);

        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU13_CAJA', `Caja #${r.rows[0].id_caja} abierta con $${monto_inicial || 0} USD`, 'Exitoso');
        res.json({ success: true, caja: r.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/ciclo4/caja/cerrar
async function cerrarCaja(req, res) {
    const { id_caja, monto_final, observaciones, ci_admin, nombre_admin, rol_admin } = req.body;
    if (!id_caja)
        return res.status(400).json({ success: false, message: 'id_caja es requerido.' });
    try {
        const r = await pool.query(`
            UPDATE caja SET estado = 'cerrada', monto_final = $1, observaciones = $2, fecha_cierre = NOW()
            WHERE id_caja = $3 AND estado = 'abierta' RETURNING *
        `, [parseFloat(monto_final) || 0, observaciones || '', id_caja]);

        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'No se encontró una caja abierta con ese ID.' });

        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU13_CAJA', `Caja #${id_caja} cerrada con monto final $${monto_final || 0} USD`, 'Exitoso');
        res.json({ success: true, caja: r.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/ciclo4/caja/actual
async function getCajaActual(req, res) {
    try {
        const cajaRes = await pool.query(`SELECT * FROM caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1`);
        if (!cajaRes.rows.length)
            return res.json({ success: true, caja: null, movimientos: [], totalIngresos: 0 });

        const caja = cajaRes.rows[0];
        const movRes = await pool.query(`
            SELECT p.id_pago, p.id_cita, p.monto, p.fecha, u.nombre AS nombre_cliente
            FROM pagos p
            JOIN reservas res ON p.id_cita    = res.id_cita
            JOIN clientes cl  ON res.id_cliente = cl.id_cliente
            JOIN usuarios u   ON cl.ci_usuario  = u.ci
            WHERE p.estado_stripe = 'succeeded' AND p.fecha >= $1
            ORDER BY p.fecha ASC
        `, [caja.fecha_apertura]);

        const totalIngresos = movRes.rows.reduce((sum, m) => sum + parseFloat(m.monto), 0);
        res.json({ success: true, caja, movimientos: movRes.rows, totalIngresos });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/ciclo4/caja/historial
async function getHistorialCajas(req, res) {
    try {
        const r = await pool.query(`
            SELECT id_caja, fecha_apertura, fecha_cierre, monto_inicial,
                   monto_final, estado, nombre_admin, observaciones
            FROM caja ORDER BY fecha_apertura DESC LIMIT 50
        `);
        res.json({ success: true, cajas: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { abrirCaja, cerrarCaja, getCajaActual, getHistorialCajas };
