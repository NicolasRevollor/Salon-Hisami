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

const router = require('express').Router(); // Router de Express: maneja las URL
const ctrl   = require('../controllers/ciclo3.controller'); // importar todas las funciones del ciclo 3

// ── CU6 — Preferencias del Cliente ───────────────────────────────────────────
// GET  → el frontend pide las preferencias de un cliente por su CI
// PUT  → el frontend manda los cambios para guardar/actualizar las preferencias
router.get('/api/ciclo3/preferencias/:ci',          ctrl.getPreferencias);
router.put('/api/ciclo3/preferencias/:ci',          ctrl.setPreferencias);
router.get('/api/ciclo3/historial-preferencias/:ci', ctrl.getHistorialPreferencias);

// ── CU14 — Kit Personal del Esteticista ──────────────────────────────────────
// GET  → pedir el kit asignado a una esteticista (por su CI)
// POST → guardar (reemplazar) el kit completo de una esteticista
router.get('/api/ciclo3/kit/:ci',  ctrl.getKit);
router.post('/api/ciclo3/kit',     ctrl.setKit);

// ── CU15 — Alertas de Stock ───────────────────────────────────────────────────
// GET → traer todos los productos con stock <= al mínimo configurado
// PUT → cambiar el número mínimo de un producto específico
router.get('/api/ciclo3/alertas-stock', ctrl.getAlertasStock);
router.put('/api/ciclo3/stock-minimo',  ctrl.updateStockMinimo);

// ── CU20 — Recordatorios de Cita por Gmail ───────────────────────────────────
// GET  → buscar las citas Pendientes/Confirmadas de una fecha (para mostrarlas antes de enviar)
// POST → mandar los correos de recordatorio a los clientes seleccionados
router.get('/api/ciclo3/citas-proximas',  ctrl.getCitasProximas);
router.post('/api/ciclo3/recordatorios',  ctrl.enviarRecordatorios);

// ── CU21 — WhatsApp Empresarial ───────────────────────────────────────────────
// GET  → lista de clientes que tienen número de teléfono registrado
// POST → generar el enlace wa.me con el número y el mensaje
router.get('/api/ciclo3/clientes-telefono', ctrl.getClientesConTelefono);
router.post('/api/ciclo3/whatsapp',         ctrl.prepararWhatsApp);

// ── CU23 — Gestionar Consumo por Servicio ────────────────────────────────────
// GET  → lista de servicios activos con cuántos insumos tiene su receta
// POST → descontar los insumos de la receta del stock del inventario
router.get('/api/ciclo3/servicios-receta',   ctrl.getServiciosConReceta);
router.post('/api/ciclo3/consumo/descontar', ctrl.descontarConsumo);

// Exportar el router para que server.js lo pueda registrar con app.use(ciclo3Routes)
module.exports = router;
