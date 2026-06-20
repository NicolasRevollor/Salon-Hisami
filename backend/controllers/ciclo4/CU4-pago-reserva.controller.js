// CU4 — Realizar Pago de Reserva con Stripe
const pool   = require('../../config/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { registrarEvento } = require('../bitacora.controller');

async function initCU4() {
    await pool.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255)`);
    await pool.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado_stripe VARCHAR(50)`);
}
initCU4().catch(err => console.error('❌ Error init CU4:', err.message));

// POST /api/ciclo4/crear-pago-intent
async function crearPagoIntent(req, res) {
    const { id_cita } = req.body;
    if (!id_cita)
        return res.status(400).json({ success: false, message: 'id_cita es requerido.' });
    try {
        const r = await pool.query(`
            SELECT r.id_cita,
                   COALESCE(SUM(s.precio), 0)                   AS monto_total,
                   STRING_AGG(DISTINCT s.nombre_servicio, ', ') AS servicios,
                   u.nombre                                      AS nombre_cliente,
                   u.email                                       AS email_cliente
            FROM reservas r
            JOIN clientes cl ON r.id_cliente = cl.id_cliente
            JOIN usuarios u  ON cl.ci_usuario = u.ci
            LEFT JOIN detalle_reserva dr ON dr.id_cita   = r.id_cita
            LEFT JOIN servicios s        ON s.id_servicio = dr.id_servicio
            WHERE r.id_cita = $1
            GROUP BY r.id_cita, u.nombre, u.email
        `, [id_cita]);

        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });

        const reserva = r.rows[0];
        const monto   = parseFloat(reserva.monto_total);
        if (monto <= 0)
            return res.status(400).json({ success: false, message: 'La reserva no tiene monto a cobrar.' });

        const paymentIntent = await stripe.paymentIntents.create({
            amount:      Math.round(monto * 100),
            currency:    'usd',
            description: `Reserva #${id_cita} — Salón HISAMI — ${reserva.servicios || 'Servicio'}`,
            metadata:    { id_cita: String(id_cita), nombre_cliente: reserva.nombre_cliente, email_cliente: reserva.email_cliente },
            receipt_email: reserva.email_cliente || undefined
        });

        res.json({
            success: true,
            client_secret:     paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
            monto,
            servicios:         reserva.servicios,
            nombre_cliente:    reserva.nombre_cliente
        });
    } catch (err) {
        console.error('Error crearPagoIntent:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/ciclo4/confirmar-pago
async function confirmarPago(req, res) {
    const { id_cita, payment_intent_id, ci_admin, nombre_admin, rol_admin } = req.body;
    if (!id_cita || !payment_intent_id)
        return res.status(400).json({ success: false, message: 'id_cita y payment_intent_id son requeridos.' });
    try {
        const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
        if (intent.status !== 'succeeded')
            return res.status(400).json({ success: false, message: `Pago no confirmado. Estado Stripe: ${intent.status}` });

        const monto = intent.amount / 100;
        await pool.query(`
            INSERT INTO pagos (id_cita, monto, metodo_pago, stripe_payment_intent_id, estado_stripe)
            VALUES ($1, $2, 'stripe', $3, 'succeeded')
            ON CONFLICT (id_cita) DO UPDATE SET
                stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
                estado_stripe            = EXCLUDED.estado_stripe
        `, [id_cita, monto, payment_intent_id]);

        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU4_PAGO', `Pago Stripe confirmado — reserva #${id_cita} — $${monto} USD`, 'Exitoso');
        res.json({ success: true, message: `Pago de $${monto} USD registrado correctamente.` });
    } catch (err) {
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU4_PAGO', `Error al confirmar pago reserva #${id_cita}: ${err.message}`, 'Fallido');
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/ciclo4/pagos/:id_cita
async function getPagosCita(req, res) {
    const { id_cita } = req.params;
    try {
        const r = await pool.query(`
            SELECT id_pago, monto, metodo_pago, estado_stripe, stripe_payment_intent_id, fecha
            FROM pagos WHERE id_cita = $1 ORDER BY fecha DESC
        `, [id_cita]);
        res.json({ success: true, pagos: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/ciclo4/pagos-resumen
async function getPagosResumen(req, res) {
    try {
        const r = await pool.query(`
            SELECT p.id_pago, p.id_cita, p.monto, p.metodo_pago, p.estado_stripe,
                   p.fecha, p.stripe_payment_intent_id,
                   u.nombre AS nombre_cliente,
                   res.fecha AS fecha_cita, res.hora AS hora_cita
            FROM pagos p
            JOIN reservas res ON p.id_cita     = res.id_cita
            JOIN clientes cl  ON res.id_cliente = cl.id_cliente
            JOIN usuarios u   ON cl.ci_usuario  = u.ci
            ORDER BY p.fecha DESC LIMIT 200
        `);
        res.json({ success: true, pagos: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { crearPagoIntent, confirmarPago, getPagosCita, getPagosResumen };
