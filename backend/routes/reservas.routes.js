// =============================================================================
// routes/reservas.routes.js — RUTAS DE RESERVAS Y DISPONIBILIDAD
//
// Todo lo relacionado con el flujo de reservar una cita:
//
//   GET    /api/esteticistas              → esteticistas disponibles (filtradas por servicio/paquete)
//   GET    /api/horas-disponibles         → horas libres de una esteticista en una fecha
//   GET    /api/verificar-disponibilidad  → verificar si un horario puntual está libre
//   POST   /api/reservas                  → crear la(s) reserva(s)
//   GET    /api/reservas/cliente/:ci      → reservas del cliente (panel "Mis Citas")
//   GET    /api/reservas/esteticista/:ci  → reservas de la esteticista (panel Personal)
//   DELETE /api/reservas/:id_cita         → cancelar una reserva y notificar por correo
//
// IMPORTANTE: Las rutas más específicas van PRIMERO.
//   /api/reservas/cliente/:ci debe estar ANTES de /api/reservas/:id_cita,
//   porque Express prueba las rutas en orden y "cliente" sería interpretado
//   como un :id_cita si la ruta genérica va primero.
// =============================================================================

const router = require('express').Router();
const ctrl   = require('../controllers/reservas.controller');

router.get('/api/esteticistas',             ctrl.getEsteticistas);
router.get('/api/horas-disponibles',        ctrl.getHorasDisponibles);
router.get('/api/verificar-disponibilidad', ctrl.verificarDisponibilidad);
router.get('/api/reservas/cliente/:ci',     ctrl.getReservasCliente);      // ← específica primero
router.get('/api/reservas/esteticista/:ci', ctrl.getReservasEsteticista);  // ← específica primero
router.post('/api/reservas',                ctrl.crearReserva);
router.put('/api/reservas/:id_cita/completar', ctrl.completarReserva);  // específica primero
router.put('/api/reservas/:id_cita',           ctrl.editarReserva);
router.delete('/api/reservas/:id_cita',        ctrl.cancelarReserva);

module.exports = router;
