const router  = require('express').Router();
const ctrl    = require('../controllers/reportes.controller');
const cu17    = require('../controllers/ciclo4/CU17-reporte-financiero.controller');

router.get('/api/reportes/servicios-requeridos', ctrl.getServiciosMasRequeridos);
router.get('/api/reportes/servicios-insumos',    ctrl.getServiciosMasInsumos);
router.get('/api/reportes/empleados',            ctrl.getEmpleadosReporte);
router.get('/api/reportes/comisiones',           ctrl.getReporteComisiones);
router.get('/api/reportes/reservas-mes',         ctrl.getReservasPorMes);
router.get('/api/reportes/bitacora-logins',      ctrl.getReporteBitacora);

// CU17 — Reporte Financiero
router.get('/api/reportes/financiero',           cu17.getReporteFinanciero);

module.exports = router;
