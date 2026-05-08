// =============================================================================
// routes/bitacora.routes.js — RUTAS DE BITÁCORA (CU19)
//
//   POST /api/bitacora          → registrar un evento desde el frontend
//   GET  /api/admin/bitacora    → ver todos los eventos (solo admin)
// =============================================================================

const router = require('express').Router();
const ctrl   = require('../controllers/bitacora.controller');

router.post('/api/bitacora',        ctrl.registrarEventoAPI);
router.get('/api/admin/bitacora',   ctrl.getBitacora);

module.exports = router;
