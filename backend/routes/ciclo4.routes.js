// =============================================================================
// routes/ciclo4.routes.js — RUTAS CU4 (Pago de Reserva con Stripe)
// Las rutas de CU5 y CU13 están en ciclo4b.routes.js
// =============================================================================

const router = require('express').Router();
const cu4    = require('../controllers/ciclo4/CU4-pago-reserva.controller');

// CU4 — Pago de Reserva con Stripe
router.post('/api/ciclo4/crear-pago-intent', cu4.crearPagoIntent);
router.post('/api/ciclo4/confirmar-pago',    cu4.confirmarPago);
router.get('/api/ciclo4/pagos/:id_cita',     cu4.getPagosCita);
router.get('/api/ciclo4/pagos-resumen',      cu4.getPagosResumen);

module.exports = router;
