// CU17 — Reporte Financiero (solo Administrador)
const pool = require('../../config/db');

// GET /api/reportes/financiero?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD&tipo_reporte=mensual|semanal|personalizado
async function getReporteFinanciero(req, res) {
    const { fecha_inicio, fecha_fin, tipo_reporte = 'personalizado' } = req.query;
    if (!fecha_inicio || !fecha_fin)
        return res.status(400).json({ success: false, message: 'fecha_inicio y fecha_fin son requeridos.' });

    try {
        // Ingresos: pagos Stripe completados en el período, desglosados por método
        const ingresosRes = await pool.query(`
            SELECT metodo_pago,
                   COUNT(*)::integer                AS cantidad,
                   COALESCE(SUM(monto), 0)::numeric AS total
            FROM pagos
            WHERE estado_stripe = 'succeeded'
              AND fecha >= $1
              AND fecha <  ($2::date + INTERVAL '1 day')
            GROUP BY metodo_pago
        `, [fecha_inicio, fecha_fin]);

        const totalIngresos = ingresosRes.rows.reduce((s, r) => s + parseFloat(r.total), 0);
        const totalPagos    = ingresosRes.rows.reduce((s, r) => s + r.cantidad, 0);

        // Comisiones: total y lista por esteticista en el período
        const comisionesRes = await pool.query(`
            SELECT u.nombre,
                   u.ci,
                   COUNT(c.id_comision)::integer               AS cantidad,
                   COALESCE(SUM(c.monto_comision), 0)::numeric AS total_comision
            FROM comision c
            JOIN personal p ON c.id_esteticista = p.id_esteticista
            JOIN usuarios u ON p.ci_usuario      = u.ci
            WHERE c.fecha >= $1
              AND c.fecha <  ($2::date + INTERVAL '1 day')
            GROUP BY u.nombre, u.ci
            ORDER BY total_comision DESC
        `, [fecha_inicio, fecha_fin]);

        const totalComisiones = comisionesRes.rows.reduce((s, r) => s + parseFloat(r.total_comision), 0);

        // Top 5 servicios más reservados (no cancelados) en el período
        const serviciosRes = await pool.query(`
            SELECT s.nombre_servicio,
                   COUNT(dr.id_servicio)::integer      AS total_reservas,
                   COALESCE(SUM(s.precio), 0)::numeric AS ingreso_estimado
            FROM detalle_reserva dr
            JOIN servicios s ON dr.id_servicio = s.id_servicio
            JOIN reservas  r ON dr.id_cita     = r.id_cita
            WHERE r.estado != 'Cancelada'
              AND r.fecha  >= $1
              AND r.fecha  <  ($2::date + INTERVAL '1 day')
            GROUP BY s.id_servicio, s.nombre_servicio
            ORDER BY total_reservas DESC
            LIMIT 5
        `, [fecha_inicio, fecha_fin]);

        res.json({
            success: true,
            periodo:      { fecha_inicio, fecha_fin, tipo_reporte },
            ingresos:     { total: totalIngresos, cantidad: totalPagos, desglose: ingresosRes.rows },
            comisiones:   { total: totalComisiones, lista: comisionesRes.rows },
            servicios_top: serviciosRes.rows,
            ganancia_neta: totalIngresos - totalComisiones
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getReporteFinanciero };
