const router = require('express').Router();
const ctrl   = require('../controllers/ciclo4/CU22-orden-compra.controller');

// CU22 — Proveedores
router.get   ('/api/cu22/proveedores',         ctrl.getProveedores);
router.post  ('/api/cu22/proveedores',         ctrl.crearProveedor);
router.put   ('/api/cu22/proveedores/:id',     ctrl.editarProveedor);
router.delete('/api/cu22/proveedores/:id',     ctrl.eliminarProveedor);

// CU22 — Órdenes de compra
router.get   ('/api/cu22/ordenes',              ctrl.getOrdenes);
router.get   ('/api/cu22/ordenes/:id/detalle',  ctrl.getDetalleOrden);
router.post  ('/api/cu22/ordenes',              ctrl.crearOrden);
router.put   ('/api/cu22/ordenes/:id/recibir',  ctrl.recibirOrden);
router.put   ('/api/cu22/ordenes/:id/cancelar', ctrl.cancelarOrden);

module.exports = router;
