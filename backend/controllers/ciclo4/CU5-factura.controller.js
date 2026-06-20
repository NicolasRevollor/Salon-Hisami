// CU5 — Emitir Factura
const pool            = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');

async function initCU5() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS facturas (
            id_factura     SERIAL PRIMARY KEY,
            id_pago        INTEGER REFERENCES pagos(id_pago) ON DELETE SET NULL,
            id_cita        INTEGER,
            ci_cliente     VARCHAR(20),
            nombre_cliente VARCHAR(150),
            nit            VARCHAR(50) DEFAULT '',
            servicios      TEXT,
            monto          NUMERIC(10,2),
            numero_factura VARCHAR(50) UNIQUE,
            fecha_emision  TIMESTAMP DEFAULT NOW()
        )
    `);
}
initCU5().catch(err => console.error('❌ Error init CU5:', err.message));

// GET /api/ciclo4/pagos-facturables
async function getPagosParaFacturar(req, res) {
    try {
        const r = await pool.query(`
            SELECT p.id_pago, p.id_cita, p.monto, p.fecha,
                   u.nombre AS nombre_cliente, u.ci AS ci_cliente, u.email AS email_cliente,
                   STRING_AGG(DISTINCT s.nombre_servicio, ', ') AS servicios,
                   f.id_factura, f.numero_factura, f.fecha_emision
            FROM pagos p
            JOIN reservas res   ON p.id_cita      = res.id_cita
            JOIN clientes cl    ON res.id_cliente  = cl.id_cliente
            JOIN usuarios u     ON cl.ci_usuario   = u.ci
            LEFT JOIN detalle_reserva dr ON dr.id_cita    = p.id_cita
            LEFT JOIN servicios s        ON s.id_servicio = dr.id_servicio
            LEFT JOIN facturas f         ON f.id_pago     = p.id_pago
            WHERE p.estado_stripe = 'succeeded'
            GROUP BY p.id_pago, p.id_cita, p.monto, p.fecha,
                     u.nombre, u.ci, u.email,
                     f.id_factura, f.numero_factura, f.fecha_emision
            ORDER BY p.fecha DESC
        `);
        res.json({ success: true, pagos: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/ciclo4/facturas
async function emitirFactura(req, res) {
    const { id_pago, id_cita, ci_cliente, nombre_cliente, nit, servicios, monto,
            ci_admin, nombre_admin, rol_admin } = req.body;
    try {
        const hoy   = new Date();
        const fecha = `${hoy.getFullYear()}${String(hoy.getMonth()+1).padStart(2,'0')}${String(hoy.getDate()).padStart(2,'0')}`;
        const numero_factura = `FAC-${fecha}-${String(id_pago).padStart(5,'0')}`;

        const r = await pool.query(`
            INSERT INTO facturas (id_pago, id_cita, ci_cliente, nombre_cliente, nit, servicios, monto, numero_factura)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [id_pago, id_cita, ci_cliente, nombre_cliente, nit || '', servicios, monto, numero_factura]);

        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU5_FACTURA', `Factura ${numero_factura} emitida — cliente: ${nombre_cliente}`, 'Exitoso');
        res.json({ success: true, factura: r.rows[0] });
    } catch (err) {
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU5_FACTURA', `Error al emitir factura pago #${id_pago}: ${err.message}`, 'Fallido');
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/ciclo4/facturas/cliente/:ci
async function getFacturasCliente(req, res) {
    const { ci } = req.params;
    try {
        const r = await pool.query(`
            SELECT id_factura, numero_factura, nombre_cliente, nit, servicios, monto, fecha_emision
            FROM facturas WHERE ci_cliente = $1 ORDER BY fecha_emision DESC
        `, [ci]);
        res.json({ success: true, facturas: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getPagosParaFacturar, emitirFactura, getFacturasCliente };
