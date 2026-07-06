// =============================================================================
// routes/ciclo5.routes.js — RUTAS DEL CICLO 5
//
// Ciclo 5 — Gestión avanzada del catálogo de servicios
//
//   GET /api/ciclo5/servicios/buscar   → buscar servicios por categoría (CU24)
//     Query params: ?id_categoria=X   (X = número, o "todas" para sin filtro)
// =============================================================================

const router = require('express').Router();
const cu24   = require('../controllers/ciclo5/CU24-buscar-servicios.controller');
const cu25   = require('../controllers/ciclo5/CU25-ficha-esteticista.controller');
const cu26   = require('../controllers/ciclo5/CU26-historial-preferencias.controller');

router.get('/api/ciclo5/servicios/buscar',              cu24.getServiciosPorCategoria);
router.get('/api/ciclo5/esteticistas/:ci/ficha',        cu25.getFichaEsteticista);
router.get('/api/ciclo5/clientes/:ci/preferencias',     cu26.getPreferenciasCliente);
router.post('/api/ciclo5/clientes/:ci/preferencias',    cu26.registrarPreferencia);

module.exports = router;
