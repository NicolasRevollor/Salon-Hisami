// =============================================================================
// routes/ciclo4.routes.js — RUTAS DEL CICLO 4
//
// Casos de uso:
//   CU4  → Pago de reserva con Stripe
//   CU5  → Recibo/factura de pago       (pendiente)
//   CU13 → Apertura/cierre de caja      (pendiente)
// =============================================================================

const router = require('express').Router();
const ctrl   = require('../controllers/pago_reserva.controller');

// ── CU4 — Pago de Reserva con Stripe ─────────────────────────────────────────
// POST → crea un PaymentIntent en Stripe y devuelve el client_secret al frontend
// POST → confirma el pago después de que Stripe lo procesó
// GET  → pagos registrados para una cita (para mostrar historial)
// GET  → resumen de todos los pagos (vista admin)
router.post('/api/ciclo4/crear-pago-intent', ctrl.crearPagoIntent);
router.post('/api/ciclo4/confirmar-pago',    ctrl.confirmarPago);
router.get('/api/ciclo4/pagos/:id_cita',     ctrl.getPagosCita);
router.get('/api/ciclo4/pagos-resumen',      ctrl.getPagosResumen);

module.exports = router;
