// =============================================================================
// routes/ciclo3.routes.js — RUTAS DEL CICLO 3
//
// ¿Qué hace este archivo?
//   Define las URLs (rutas) a las que el frontend puede hacer peticiones
//   para los 6 casos de uso del Ciclo 3.
//   Cada línea conecta una URL con la función del controlador que la maneja.
//
// Formato de cada ruta:
//   router.METODO('/api/ruta', ctrl.nombreFuncion)
//   METODO → GET (pedir datos), POST (crear/enviar), PUT (actualizar)
//
// ¿Por qué separar rutas y controlador?
//   Las rutas solo dicen "esta URL llama a esta función".
//   El controlador contiene la lógica real (consultas SQL, etc.).
//   Así es más fácil encontrar cada parte.
// =============================================================================

const router = require('express').Router();

const cu6  = require('../controllers/ciclo3/CU6-preferencias.controller');
const cu14 = require('../controllers/ciclo3/CU14-kit-personal.controller');
const cu15 = require('../controllers/ciclo3/CU15-alertas-stock.controller');
const cu20 = require('../controllers/ciclo3/CU20-recordatorios.controller');
const cu21 = require('../controllers/ciclo3/CU21-whatsapp.controller');
const cu23 = require('../controllers/ciclo3/CU23-consumo.controller');

// CU6 — Preferencias del Cliente
router.get('/api/ciclo3/preferencias/:ci',           cu6.getPreferencias);
router.put('/api/ciclo3/preferencias/:ci',           cu6.setPreferencias);
router.get('/api/ciclo3/historial-preferencias/:ci', cu6.getHistorialPreferencias);

// CU14 — Kit Personal del Esteticista
router.get('/api/ciclo3/kit/:ci', cu14.getKit);
router.post('/api/ciclo3/kit',    cu14.setKit);

// CU15 — Alertas de Stock
router.get('/api/ciclo3/alertas-stock', cu15.getAlertasStock);
router.put('/api/ciclo3/stock-minimo',  cu15.updateStockMinimo);

// CU20 — Recordatorios de Cita por Gmail
router.get('/api/ciclo3/citas-proximas', cu20.getCitasProximas);
router.post('/api/ciclo3/recordatorios', cu20.enviarRecordatorios);

// CU21 — WhatsApp Empresarial
router.get('/api/ciclo3/clientes-telefono', cu21.getClientesConTelefono);
router.post('/api/ciclo3/whatsapp',         cu21.prepararWhatsApp);

// CU23 — Gestionar Consumo por Servicio
router.get('/api/ciclo3/servicios-receta',   cu23.getServiciosConReceta);
router.post('/api/ciclo3/consumo/descontar', cu23.descontarConsumo);

module.exports = router;
