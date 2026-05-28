// =============================================================================
// controllers/reportes.controller.js — CU17: REPORTES DEL SISTEMA
//
// Endpoints:
//   GET /api/reportes/servicios-requeridos  → top 10 servicios más reservados
//   GET /api/reportes/servicios-insumos     → top 5 servicios que más insumos usan
//   GET /api/reportes/empleados             → lista de empleados (para filtro)
//   GET /api/reportes/comisiones?ci=        → comisiones por empleado y mes
//   GET /api/reportes/reservas-mes          → reservas agrupadas por mes (últimos 12)
//   GET /api/reportes/bitacora-logins       → usuarios que más ingresaron (por mes y rol)
// =============================================================================

const pool = require('../config/db');

// GET /api/reportes/servicios-requeridos
// Los 10 servicios que más veces fueron reservados (excluyendo reservas canceladas).
async function getServiciosMasRequeridos(req, res) {
    try {
        const result = await pool.query(`
            SELECT s.nombre_servicio,
                   COUNT(dr.id_servicio) AS total_reservas
            FROM detalle_reserva dr
            JOIN servicios s ON dr.id_servicio = s.id_servicio
            JOIN reservas r  ON dr.id_cita      = r.id_cita
            WHERE r.estado != 'Cancelada'
            GROUP BY s.id_servicio, s.nombre_servicio
            ORDER BY total_reservas DESC
            LIMIT 10
        `);
        res.json({ success: true, datos: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/reportes/servicios-insumos
// Top 5 servicios según la cantidad total de insumos definida en su receta (tabla utiliza).
async function getServiciosMasInsumos(req, res) {
    try {
        const result = await pool.query(`
            SELECT s.nombre_servicio,
                   COUNT(DISTINCT u.id_producto)        AS tipos_insumos,
                   COALESCE(SUM(u.cantidad), 0)::numeric AS total_cantidad
            FROM utiliza u
            JOIN servicios s ON u.id_servicio = s.id_servicio
            GROUP BY s.id_servicio, s.nombre_servicio
            ORDER BY total_cantidad DESC, tipos_insumos DESC
            LIMIT 5
        `);
        res.json({ success: true, datos: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/reportes/empleados
// Lista empleados activos para el selector de filtro de comisiones.
async function getEmpleadosReporte(req, res) {
    try {
        const result = await pool.query(`
            SELECT u.ci, u.nombre
            FROM personal p
            JOIN usuarios u ON p.ci_usuario = u.ci
            WHERE p.estado = 'Activo'
            ORDER BY u.nombre
        `);
        res.json({ success: true, empleados: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/reportes/comisiones?ci=
// Comisiones agrupadas por mes. Si se pasa ?ci= filtra por ese empleado.
// Personal solo debe pasar su propio CI; Admin puede omitirlo para ver todos.
async function getReporteComisiones(req, res) {
    const { ci } = req.query;
    try {
        const params = ci ? [ci] : [];
        const filtro = ci ? 'WHERE p.ci_usuario = $1' : '';

        const result = await pool.query(`
            SELECT u.nombre            AS nombre_empleado,
                   u.ci,
                   TO_CHAR(DATE_TRUNC('month', c.fecha), 'YYYY-MM') AS mes_clave,
                   SUM(c.monto_comision)::numeric                    AS total_bs,
                   COUNT(*)::integer                                 AS cantidad
            FROM comision c
            JOIN personal p  ON c.id_esteticista = p.id_esteticista
            JOIN usuarios u  ON p.ci_usuario      = u.ci
            ${filtro}
            GROUP BY u.nombre, u.ci, DATE_TRUNC('month', c.fecha)
            ORDER BY DATE_TRUNC('month', c.fecha) DESC, u.nombre
        `, params);

        res.json({ success: true, datos: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/reportes/reservas-mes
// Reservas agrupadas por mes, últimos 12 meses.
async function getReservasPorMes(req, res) {
    try {
        const result = await pool.query(`
            SELECT TO_CHAR(DATE_TRUNC('month', fecha), 'YYYY-MM') AS mes_clave,
                   COUNT(*)::integer                               AS total_reservas,
                   SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END)::integer AS finalizadas,
                   SUM(CASE WHEN estado = 'Cancelada'  THEN 1 ELSE 0 END)::integer AS canceladas,
                   SUM(CASE WHEN estado = 'Pendiente'  THEN 1 ELSE 0 END)::integer AS pendientes
            FROM reservas
            GROUP BY DATE_TRUNC('month', fecha)
            ORDER BY DATE_TRUNC('month', fecha) DESC
            LIMIT 12
        `);
        res.json({ success: true, datos: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/reportes/bitacora-logins?mes=YYYY-MM&rol=Cliente
// Top 10 usuarios con más inicios de sesión exitosos en el mes y rol indicados.
async function getReporteBitacora(req, res) {
    const { mes, rol } = req.query;
    if (!mes || !rol) {
        return res.status(400).json({ success: false, message: 'Parámetros mes y rol son requeridos.' });
    }
    try {
        const result = await pool.query(`
            SELECT nombre_usuario,
                   ci_usuario,
                   rol,
                   COUNT(*)::integer AS total_logins
            FROM bitacora
            WHERE accion = 'LOGIN'
              AND estado  = 'Exitoso'
              AND TO_CHAR(fecha_hora AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz', 'YYYY-MM') = $1
              AND LOWER(rol) = LOWER($2)
            GROUP BY nombre_usuario, ci_usuario, rol
            ORDER BY total_logins DESC
            LIMIT 10
        `, [mes, rol]);
        res.json({ success: true, datos: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getServiciosMasRequeridos,
    getServiciosMasInsumos,
    getEmpleadosReporte,
    getReporteComisiones,
    getReservasPorMes,
    getReporteBitacora
};
