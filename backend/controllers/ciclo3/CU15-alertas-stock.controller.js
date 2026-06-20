// CU15 — Alertas de Stock
const pool = require('../../config/db');

async function initCU15() {
    await pool.query(`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 5`);
    await pool.query(`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS unidad VARCHAR(50) DEFAULT ''`);
}
initCU15().catch(err => console.error('❌ Error init CU15:', err.message));

// GET /api/ciclo3/alertas-stock
async function getAlertasStock(req, res) {
    try {
        const r = await pool.query(`
            SELECT id_producto, nombre, cantidad, unidad,
                   COALESCE(stock_minimo, 5) AS stock_minimo
            FROM inventario
            WHERE cantidad < COALESCE(stock_minimo, 5) * 2
            ORDER BY cantidad ASC
        `);
        res.json({ success: true, alertas: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// PUT /api/ciclo3/stock-minimo
async function updateStockMinimo(req, res) {
    const { id_producto, stock_minimo } = req.body;
    try {
        await pool.query(
            'UPDATE inventario SET stock_minimo = $1 WHERE id_producto = $2',
            [stock_minimo, id_producto]);
        res.json({ success: true, message: 'Mínimo actualizado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getAlertasStock, updateStockMinimo };
