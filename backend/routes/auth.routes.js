// =============================================================================
// routes/auth.routes.js — RUTAS DE AUTENTICACIÓN
//
// ¿Qué es un archivo de rutas?
//   Define QUÉ URL responde a QUÉ función. No contiene lógica — solo conecta
//   la URL con su controlador correspondiente.
//
//   Ejemplo: cuando llega POST /login → se ejecuta ctrl.login
//
// Este archivo maneja:
//   POST /login                     → iniciar sesión
//   POST /registro                  → crear cuenta de cliente
//   POST /api/recuperar-password    → solicitar código de recuperación por correo
//   POST /api/restablecer-password  → verificar código y cambiar contraseña
//   POST /cambiar-password          → cambiar contraseña desde el panel (logueado)
//   GET  /api/menus-usuario/:ci     → menú personalizado según privilegios del usuario
//   GET  /api/admin/sesiones        → historial de accesos (solo admin)
// =============================================================================

const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');

router.post('/login',                    ctrl.login);
router.post('/registro',                 ctrl.registro);
router.post('/api/recuperar-password',   ctrl.recuperarPassword);
router.post('/api/restablecer-password', ctrl.restablecerPassword);
router.post('/cambiar-password',         ctrl.cambiarPassword);
router.get('/api/menus-usuario/:ci',     ctrl.menusUsuario);
router.get('/api/admin/sesiones',        ctrl.getSesiones);

module.exports = router;
