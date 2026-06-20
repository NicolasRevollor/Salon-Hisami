const router = require('express').Router();
const cu5    = require('../controllers/ciclo4/CU5-factura.controller');
const cu13   = require('../controllers/ciclo4/CU13-caja.controller');

// CU5 — Facturas
router.get('/api/ciclo4/pagos-facturables',    cu5.getPagosParaFacturar);
router.post('/api/ciclo4/facturas',            cu5.emitirFactura);
router.get('/api/ciclo4/facturas/cliente/:ci', cu5.getFacturasCliente);

// CU13 — Caja
router.post('/api/ciclo4/caja/abrir',    cu13.abrirCaja);
router.post('/api/ciclo4/caja/cerrar',   cu13.cerrarCaja);
router.get('/api/ciclo4/caja/actual',    cu13.getCajaActual);
router.get('/api/ciclo4/caja/historial', cu13.getHistorialCajas);

module.exports = router;
