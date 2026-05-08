// =============================================================================
// routes/catalogo.routes.js — RUTAS DEL CATÁLOGO PÚBLICO
//
// Endpoints de solo lectura accesibles por todos los usuarios.
//
//   GET /api/categorias        → lista de categorías de servicios
//   GET /api/especialidades    → lista de especialidades de esteticistas
//   GET /api/servicios         → servicios activos + paquetes promocionales
//   GET /api/comisiones/:ci    → comisiones de la esteticista con ese CI
// =============================================================================

const router = require('express').Router();
const ctrl   = require('../controllers/catalogo.controller');

router.get('/api/categorias',       ctrl.getCategorias);
router.get('/api/especialidades',   ctrl.getEspecialidades);
router.get('/api/servicios',        ctrl.getServicios);
router.get('/api/comisiones/:ci',   ctrl.getComisiones);

module.exports = router;
