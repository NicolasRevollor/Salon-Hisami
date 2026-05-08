// =============================================================================
// routes/inventario.routes.js — RUTAS DE INVENTARIO Y RECETAS
//
//   GET  /api/inventario            → listar todos los insumos con su stock actual
//   POST /api/compras               → registrar una compra (suma stock a varios insumos)
//   GET  /api/recetas/:id_servicio  → ver la receta de insumos de un servicio
//   POST /api/recetas               → guardar/reemplazar la receta de un servicio
// =============================================================================

const router = require('express').Router();
const ctrl   = require('../controllers/inventario.controller');

router.get('/api/inventario',             ctrl.getInventario);
router.post('/api/compras',               ctrl.registrarCompra);
router.get('/api/recetas/:id_servicio',   ctrl.getReceta);
router.post('/api/recetas',               ctrl.guardarReceta);

module.exports = router;
