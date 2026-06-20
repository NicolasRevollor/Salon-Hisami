// =============================================================================
// controllers/pago_reserva.controller.js — CICLO 4
//
// Casos de uso que maneja:
//   CU4  → Realizar Pago de Reserva usando Stripe (Payment Intents API)
//   CU5  → Ver resumen/recibo de pago de una cita (pendiente implementar)
//   CU13 → Gestionar Apertura/Cierre de Caja      (pendiente implementar)
//
// Flujo de pago Stripe:
//   1. Frontend llama POST /api/ciclo4/crear-pago-intent → backend crea PaymentIntent
//   2. Backend devuelve { client_secret } al frontend
//   3. Frontend usa Stripe.js para capturar la tarjeta y confirmar el pago
//   4. Stripe redirige/notifica → frontend llama POST /api/ciclo4/confirmar-pago
//   5. Backend verifica con Stripe que el pago fue exitoso y lo registra en BD
//
// Variables de entorno requeridas en .env:
//   STRIPE_SECRET_KEY → clave secreta (sk_test_... o sk_live_...)
// =============================================================================

const pool   = require('../config/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { registrarEvento } = require('./bitacora.controller');

// =============================================================================
// INICIALIZACIÓN — agrega columnas de Stripe a la tabla pagos si no existen
// =============================================================================
async function initCiclo4() {
    // Columna para guardar el ID del PaymentIntent de Stripe (para verificación)
    await pool.query(`
        ALTER TABLE pagos
        ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255)
    `);
    // Columna para el estado que devuelve Stripe (succeeded, requires_payment_method, etc.)
    await pool.query(`
        ALTER TABLE pagos
        ADD COLUMN IF NOT EXISTS estado_stripe VARCHAR(50)
    `);
    console.log('✅ Tabla pagos lista para Stripe (Ciclo 4)');
}

initCiclo4().catch(err => console.error('❌ Error init Ciclo 4:', err.message));


// =============================================================================
// CU4 — REALIZAR PAGO DE RESERVA
// =============================================================================

// ── crearPagoIntent ───────────────────────────────────────────────────────────
// Crea un PaymentIntent en Stripe para una reserva específica.
// El frontend usa el client_secret que devuelve para mostrar el formulario de tarjeta.
// Ruta: POST /api/ciclo4/crear-pago-intent
async function crearPagoIntent(req, res) {
    const { id_cita } = req.body;

    if (!id_cita) {
        return res.status(400).json({ success: false, message: 'id_cita es requerido.' });
    }

    try {
        // Obtener datos de la reserva: monto total, servicios y cliente
        const r = await pool.query(`
            SELECT r.id_cita,
                   COALESCE(SUM(s.precio), 0)                          AS monto_total,
                   STRING_AGG(DISTINCT s.nombre_servicio, ', ')        AS servicios,
                   u.nombre                                             AS nombre_cliente,
                   u.email                                              AS email_cliente
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

        // Stripe trabaja en centavos (entero) — multiplicar por 100
        const montoCentavos = Math.round(monto * 100);

        // Crear el PaymentIntent en Stripe
        // currency: 'usd' porque Stripe no acepta 'bob' (bolivianos)
        const paymentIntent = await stripe.paymentIntents.create({
            amount:      montoCentavos,
            currency:    'usd',
            description: `Reserva #${id_cita} — Salón HISAMI — ${reserva.servicios || 'Servicio'}`,
            metadata: {
                id_cita:         String(id_cita),
                nombre_cliente:  reserva.nombre_cliente,
                email_cliente:   reserva.email_cliente
            },
            receipt_email: reserva.email_cliente || undefined
        });

        res.json({
            success:       true,
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
            monto,
            servicios:     reserva.servicios,
            nombre_cliente: reserva.nombre_cliente
        });

    } catch (err) {
        console.error('Error crearPagoIntent:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}


// ── confirmarPago ─────────────────────────────────────────────────────────────
// El frontend llama este endpoint DESPUÉS de que Stripe confirmó el pago.
// Verifica con Stripe que el PaymentIntent tiene status "succeeded"
// y luego registra el pago en la tabla pagos de la BD.
// Ruta: POST /api/ciclo4/confirmar-pago
async function confirmarPago(req, res) {
    const { id_cita, payment_intent_id, ci_admin, nombre_admin, rol_admin } = req.body;

    if (!id_cita || !payment_intent_id)
        return res.status(400).json({ success: false, message: 'id_cita y payment_intent_id son requeridos.' });

    try {
        // Verificar con Stripe que el pago realmente fue exitoso
        const intent = await stripe.paymentIntents.retrieve(payment_intent_id);

        if (intent.status !== 'succeeded') {
            return res.status(400).json({
                success: false,
                message: `Pago no confirmado. Estado Stripe: ${intent.status}`
            });
        }

        const monto = intent.amount / 100; // convertir de centavos a dólares

        // Registrar el pago en la base de datos
        await pool.query(`
            INSERT INTO pagos (id_cita, monto, metodo, estado, stripe_payment_intent_id, estado_stripe)
            VALUES ($1, $2, 'stripe', 'completado', $3, 'succeeded')
        `, [id_cita, monto, payment_intent_id]);

        // Registrar en bitácora
        await registrarEvento(
            ci_admin, nombre_admin, rol_admin,
            'CU4_PAGO',
            `Pago Stripe confirmado — reserva #${id_cita} — $${monto} USD`,
            'Exitoso'
        );

        res.json({ success: true, message: `Pago de $${monto} USD registrado correctamente.` });

    } catch (err) {
        await registrarEvento(
            ci_admin, nombre_admin, rol_admin,
            'CU4_PAGO',
            `Error al confirmar pago reserva #${id_cita}: ${err.message}`,
            'Fallido'
        );
        res.status(500).json({ success: false, message: err.message });
    }
}


// ── getPagosCita ──────────────────────────────────────────────────────────────
// Devuelve todos los pagos registrados para una cita específica.
// Ruta: GET /api/ciclo4/pagos/:id_cita
async function getPagosCita(req, res) {
    const { id_cita } = req.params;
    try {
        const r = await pool.query(`
            SELECT id_pago, monto, metodo, estado, stripe_payment_intent_id, estado_stripe, fecha_pago
            FROM pagos
            WHERE id_cita = $1
            ORDER BY fecha_pago DESC
        `, [id_cita]);
        res.json({ success: true, pagos: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}


// ── getPagosResumen ───────────────────────────────────────────────────────────
// Lista todos los pagos con datos del cliente y la reserva (vista admin).
// Ruta: GET /api/ciclo4/pagos-resumen
async function getPagosResumen(req, res) {
    try {
        const r = await pool.query(`
            SELECT p.id_pago,
                   p.id_cita,
                   p.monto,
                   p.metodo,
                   p.estado,
                   p.fecha_pago,
                   p.stripe_payment_intent_id,
                   u.nombre AS nombre_cliente,
                   res.fecha AS fecha_cita,
                   res.hora  AS hora_cita
            FROM pagos p
            JOIN reservas res ON p.id_cita   = res.id_cita
            JOIN clientes cl  ON res.id_cliente = cl.id_cliente
            JOIN usuarios u   ON cl.ci_usuario  = u.ci
            ORDER BY p.fecha_pago DESC
            LIMIT 200
        `);
        res.json({ success: true, pagos: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}


// =============================================================================
// EXPORTAR
// =============================================================================
module.exports = {
    crearPagoIntent,   // CU4: crear PaymentIntent en Stripe
    confirmarPago,     // CU4: confirmar y registrar pago exitoso
    getPagosCita,      // CU4: pagos de una cita específica
    getPagosResumen    // CU4: todos los pagos (vista admin)
};
