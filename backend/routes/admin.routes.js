// =============================================================================
// routes/admin.routes.js — RUTAS DEL PANEL DE ADMINISTRACIÓN
//
//  EMPLEADOS:
//   GET    /api/admin/empleados                            → listar todos los empleados
//   POST   /api/admin/empleados                            → crear empleado nuevo
//   PUT    /api/admin/empleados/:ci                        → editar datos del empleado
//   DELETE /api/admin/empleados/:ci                        → eliminar empleado completamente
//   GET    /api/admin/empleados/:ci/especialidades         → especialidades del empleado
//   POST   /api/admin/empleados/:ci/especialidades         → agregar especialidad
//   DELETE /api/admin/empleados/:ci/especialidades/:id_esp → quitar especialidad
//
//  CLIENTES (CU10):
//   GET    /api/admin/clientes                             → listar todos los clientes
//   PUT    /api/admin/clientes/:ci                         → editar datos del cliente
//   DELETE /api/admin/clientes/:ci                         → eliminar cliente
//
//  SERVICIOS (CU7):
//   POST   /api/admin/servicios                            → crear servicio
//   PUT    /api/admin/servicios/:id                        → editar servicio
//   DELETE /api/admin/servicios/:id                        → marcar como inactivo
//
//  CATEGORÍAS:
//   POST   /api/categorias                                 → crear categoría
//   DELETE /api/categorias/:id                             → eliminar categoría
//
//  PAQUETES:
//   GET    /api/admin/paquetes                             → listar paquetes con servicios
//   POST   /api/admin/paquetes                             → crear paquete
//   PUT    /api/admin/paquetes/:id                         → editar paquete
//   DELETE /api/admin/paquetes/:id                         → eliminar paquete
//
//  PRIVILEGIOS (CU18):
//   GET    /api/admin/paquetes-sistema                     → paquetes del sistema con sus CUs
//   GET    /api/admin/privilegios/:ci                      → CUs del usuario con ese CI
//   POST   /api/admin/privilegios                          → activar/desactivar un CU
//
//  COMISIONES (CU16):
//   GET    /api/admin/comisiones                           → todas las comisiones del personal
//   PUT    /api/admin/comisiones/:id/pagar                 → marcar comisión como pagada
// =============================================================================

const router = require('express').Router();
const ctrl   = require('../controllers/admin.controller');

// ── Empleados ──────────────────────────────────────────────────────────────
router.get('/api/admin/empleados',                              ctrl.getEmpleados);
router.post('/api/admin/empleados',                             ctrl.crearEmpleado);
router.put('/api/admin/empleados/:ci',                          ctrl.editarEmpleado);
router.delete('/api/admin/empleados/:ci',                       ctrl.eliminarEmpleado);
router.get('/api/admin/empleados/:ci/especialidades',           ctrl.getEspEmpleado);
router.post('/api/admin/empleados/:ci/especialidades',          ctrl.agregarEspEmpleado);
router.delete('/api/admin/empleados/:ci/especialidades/:id_esp',ctrl.eliminarEspEmpleado);

// ── Servicios ──────────────────────────────────────────────────────────────
router.post('/api/admin/servicios',     ctrl.crearServicio);
router.put('/api/admin/servicios/:id',  ctrl.editarServicio);
router.delete('/api/admin/servicios/:id', ctrl.eliminarServicio);

// ── Categorías ─────────────────────────────────────────────────────────────
router.post('/api/categorias',        ctrl.crearCategoria);
router.put('/api/categorias/:id',     ctrl.editarCategoria);
router.delete('/api/categorias/:id',  ctrl.eliminarCategoria);

// ── Paquetes Promocionales ─────────────────────────────────────────────────
router.get('/api/admin/paquetes',        ctrl.getPaquetes);
router.post('/api/admin/paquetes',       ctrl.crearPaquete);
router.put('/api/admin/paquetes/:id',    ctrl.editarPaquete);
router.delete('/api/admin/paquetes/:id', ctrl.eliminarPaquete);

// ── Especialidades catálogo (CU12) ─────────────────────────────────────────
router.get('/api/admin/especialidades',           ctrl.getEspecialidadesAdmin);
router.post('/api/admin/especialidades',          ctrl.crearEspecialidad);
router.delete('/api/admin/especialidades/:id',    ctrl.eliminarEspecialidad);

// ── Clientes (CU10) ────────────────────────────────────────────────────────
router.get('/api/admin/clientes',          ctrl.getClientes);
router.put('/api/admin/clientes/:ci',      ctrl.editarCliente);
router.delete('/api/admin/clientes/:ci',   ctrl.eliminarCliente);

// ── Privilegios (CU18) ─────────────────────────────────────────────────────
router.get('/api/admin/paquetes-sistema',   ctrl.getPaquetesSistema);
router.get('/api/admin/privilegios/:ci',    ctrl.getPrivilegios);
router.post('/api/admin/privilegios',       ctrl.setPrivilegio);

// ── Comisiones (CU16) ──────────────────────────────────────────────────────
router.get('/api/admin/comisiones',             ctrl.getComisionesAdmin);
router.put('/api/admin/comisiones/:id/pagar',   ctrl.pagarComision);

module.exports = router;
