// CU14 — Kit Personal del Esteticista
const pool            = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');

async function initCU14() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kit_personal (
            ci_empleado  VARCHAR(20) REFERENCES usuarios(ci) ON DELETE CASCADE,
            id_producto  INTEGER REFERENCES inventario(id_producto) ON DELETE CASCADE,
            cantidad     NUMERIC(10,2) DEFAULT 1,
            PRIMARY KEY (ci_empleado, id_producto)
        )
    `);
}
initCU14().catch(err => console.error('❌ Error init CU14:', err.message));

// GET /api/ciclo3/kit/:ci
async function getKit(req, res) {
    const { ci } = req.params;
    try {
        const emp = await pool.query(
            `SELECT u.nombre FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
             WHERE u.ci = $1 AND r.nombre = 'Personal'`, [ci]);
        if (!emp.rows.length)
            return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });

        const kit = await pool.query(`
            SELECT kp.id_producto, kp.cantidad,
                   i.nombre AS nombre_insumo,
                   i.unidad,
                   i.cantidad AS stock_actual
            FROM kit_personal kp
            JOIN inventario i ON kp.id_producto = i.id_producto
            WHERE kp.ci_empleado = $1
            ORDER BY i.nombre
        `, [ci]);
        res.json({ success: true, nombre_empleado: emp.rows[0].nombre, kit: kit.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/ciclo3/kit
async function setKit(req, res) {
    const { ci_empleado, items, ci_admin, nombre_admin, rol_admin } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const kitActual = await client.query(
            'SELECT id_producto, cantidad FROM kit_personal WHERE ci_empleado = $1', [ci_empleado]);
        const oldMap = {};
        for (const row of kitActual.rows) oldMap[row.id_producto] = Number(row.cantidad);

        const newMap = {};
        for (const item of (items || [])) newMap[item.id_producto] = Number(item.cantidad);

        const allIds = new Set([...Object.keys(oldMap).map(String), ...Object.keys(newMap).map(String)]);
        const diffs = {};
        for (const id of allIds) {
            const diff = (newMap[id] || 0) - (oldMap[id] || 0);
            if (diff !== 0) diffs[id] = diff;
        }

        for (const [id_producto, diff] of Object.entries(diffs)) {
            if (diff > 0) {
                const inv = await client.query(
                    'SELECT nombre, cantidad FROM inventario WHERE id_producto = $1', [id_producto]);
                if (!inv.rows.length || Number(inv.rows[0].cantidad) < diff) {
                    await client.query('ROLLBACK');
                    const nombre = inv.rows[0]?.nombre || `producto ID ${id_producto}`;
                    return res.status(400).json({ success: false, message: `Stock insuficiente para: ${nombre}` });
                }
            }
        }

        await client.query('DELETE FROM kit_personal WHERE ci_empleado = $1', [ci_empleado]);
        for (const item of (items || [])) {
            await client.query(
                'INSERT INTO kit_personal (ci_empleado, id_producto, cantidad) VALUES ($1, $2, $3)',
                [ci_empleado, item.id_producto, item.cantidad]);
        }
        for (const [id_producto, diff] of Object.entries(diffs)) {
            await client.query(
                'UPDATE inventario SET cantidad = cantidad - $1 WHERE id_producto = $2', [diff, id_producto]);
        }

        await client.query('COMMIT');
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU14_KIT', `Kit actualizado — empleado CI: ${ci_empleado}`, 'Exitoso');
        res.json({ success: true, message: 'Kit guardado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU14_KIT', `Error al guardar kit CI: ${ci_empleado}`, 'Fallido');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

module.exports = { getKit, setKit };
