// CU23 — Gestionar Consumo por Servicio
const pool            = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');

// GET /api/ciclo3/servicios-receta
async function getServiciosConReceta(req, res) {
    try {
        const r = await pool.query(`
            SELECT s.id_servicio,
                   s.nombre_servicio AS nombre,
                   COUNT(u.id_producto) AS total_insumos
            FROM servicios s
            LEFT JOIN utiliza u ON u.id_servicio = s.id_servicio
            WHERE s.estado = 'Activo'
            GROUP BY s.id_servicio, s.nombre_servicio
            ORDER BY s.nombre_servicio
        `);
        res.json({ success: true, servicios: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/ciclo3/consumo/descontar
async function descontarConsumo(req, res) {
    const { id_servicio, ci_admin, nombre_admin, rol_admin } = req.body;
    const client = await pool.connect();
    try {
        const receta = await client.query(`
            SELECT u.id_producto,
                   u.cantidad,
                   i.nombre AS nombre_insumo,
                   i.cantidad AS stock_actual
            FROM utiliza u
            JOIN inventario i ON i.id_producto = u.id_producto
            WHERE u.id_servicio = $1
        `, [id_servicio]);

        if (!receta.rows.length)
            return res.status(400).json({ success: false, message: 'Este servicio no tiene receta de insumos configurada.' });

        const sinStock = receta.rows.filter(r => Number(r.stock_actual) < Number(r.cantidad));
        if (sinStock.length) {
            const nombres = sinStock.map(r => r.nombre_insumo).join(', ');
            return res.status(400).json({ success: false, message: `Stock insuficiente para: ${nombres}` });
        }

        await client.query('BEGIN');
        for (const item of receta.rows) {
            await client.query(
                'UPDATE inventario SET cantidad = cantidad - $1 WHERE id_producto = $2',
                [item.cantidad, item.id_producto]);
        }
        await client.query('COMMIT');

        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU23_CONSUMO', `Insumos descontados — servicio ID: ${id_servicio}`, 'Exitoso');
        res.json({ success: true, message: 'Insumos descontados correctamente.', insumos: receta.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU23_CONSUMO', `Error al descontar consumo servicio: ${id_servicio}`, 'Fallido');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

module.exports = { getServiciosConReceta, descontarConsumo };
