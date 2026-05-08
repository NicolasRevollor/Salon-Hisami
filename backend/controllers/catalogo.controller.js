// =============================================================================
// controllers/catalogo.controller.js — CATÁLOGO PÚBLICO
//
// Funciones que devuelven datos de lectura que usan TODOS los usuarios
// (clientes, personal y admin). No se modifica nada aquí, solo se LEE.
//
// Funciones exportadas:
//   getCategorias   → lista de categorías de servicios (para filtros y selects)
//   getEspecialidades → lista de especialidades (para asignar a empleados)
//   getServicios    → servicios activos + paquetes (para catálogo y modal de reserva)
//   getComisiones   → historial de comisiones de una esteticista (para su panel)
// =============================================================================

const pool = require('../config/db');

// =============================================================================
// GET /api/categorias
// Devuelve todas las categorías de servicios ordenadas alfabéticamente.
// Ejemplo de respuesta: { success: true, categorias: [{id_categoria:1, nombre:"Uñas"}, ...] }
// =============================================================================
async function getCategorias(req, res) {
    try {
        const result = await pool.query('SELECT * FROM categoria ORDER BY nombre ASC');
        res.json({ success: true, categorias: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// GET /api/especialidades
// Devuelve todas las especialidades disponibles (las que se asignan a esteticistas).
// Ejemplo: [{ id_especialidad: 1, nombre_especialidad: "Uñas acrílicas" }, ...]
// =============================================================================
async function getEspecialidades(req, res) {
    try {
        const result = await pool.query('SELECT * FROM especialidades ORDER BY nombre_especialidad ASC');
        res.json({ success: true, especialidades: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// GET /api/servicios
// Devuelve DOS cosas en una sola respuesta:
//   servicios → los servicios activos con su categoría (para el catálogo y modal de reserva)
//   paquetes  → los paquetes promocionales (también para el modal de reserva)
//
// Se hace en una sola llamada para que el frontend no tenga que hacer dos peticiones.
// =============================================================================
async function getServicios(req, res) {
    try {
        // Traer servicios activos con el nombre de su categoría (JOIN con tabla categoria)
        const resServ = await pool.query(`
            SELECT s.*, c.nombre AS nombre_categoria
            FROM servicios s
            LEFT JOIN categoria c ON s.id_categoria = c.id_categoria
            WHERE s.estado = 'Activo'
            ORDER BY s.id_servicio ASC
        `);

        // Traer paquetes con sus fechas de vigencia
        const resPaq = await pool.query(`
            SELECT id_paquete, nombre, descripcion, precio_promocional, fecha_inicio, fecha_final
            FROM paquetes
            ORDER BY id_paquete ASC
        `);

        res.json({
            success:   true,
            servicios: resServ.rows,
            paquetes:  resPaq.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// GET /api/comisiones/:ci
// Devuelve el historial de comisiones de la esteticista con ese CI (cédula).
// El cálculo de la comisión se hizo en la BD — aquí solo se muestra el resultado.
//
// Parámetro de ruta: :ci → número de cédula del personal
// Ejemplo: GET /api/comisiones/12345678
// =============================================================================
async function getComisiones(req, res) {
    try {
        const result = await pool.query(`
            SELECT c.fecha, c.monto_comision, c.estado_pago
            FROM comision c
            JOIN personal p ON c.id_esteticista = p.id_esteticista
            WHERE p.ci_usuario = $1
            ORDER BY c.fecha DESC
        `, [req.params.ci]);

        res.json({ success: true, comisiones: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// Exportar todas las funciones para que routes/catalogo.routes.js las pueda usar
module.exports = {
    getCategorias,
    getEspecialidades,
    getServicios,
    getComisiones
};
