// =============================================================================
// controllers/inventario.controller.js — INVENTARIO Y RECETAS
//
// Maneja los insumos del salón (champú, acetona, esmaltes, etc.) y las
// "recetas" de cada servicio (cuánto de cada insumo se usa en ese servicio).
//
// Funciones exportadas:
//   getInventario   → GET /api/inventario           lista todos los insumos con su stock
//   registrarCompra → POST /api/compras             suma cantidad al stock de varios insumos
//   getReceta       → GET /api/recetas/:id_servicio  qué insumos usa un servicio y en qué cantidad
//   guardarReceta   → POST /api/recetas              reemplaza la receta de un servicio
// =============================================================================

const pool = require('../config/db');

// =============================================================================
// GET /api/inventario
// Devuelve todos los productos del inventario ordenados por nombre.
// Cada fila incluye: id_producto, nombre, cantidad, unidad, etc.
// =============================================================================
async function getInventario(req, res) {
    try {
        const result = await pool.query('SELECT * FROM inventario ORDER BY nombre');
        res.json({ success: true, insumos: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// POST /api/compras
// Registra una compra: suma la cantidad comprada al stock actual de cada insumo.
// Si se compran varios insumos a la vez, se hace todo en una sola transacción.
//
// Recibe: { insumos: [{ id_producto, cantidad }, { id_producto, cantidad }, ...] }
//
// ¿Por qué usar transacción aquí?
//   Si a mitad de la compra falla uno de los insumos, queremos que NO se actualice
//   ninguno — mejor que quede todo como antes a que quede actualizado a medias.
// =============================================================================
async function registrarCompra(req, res) {
    const { insumos } = req.body;

    if (!insumos || !Array.isArray(insumos)) {
        return res.status(400).json({ success: false, message: 'Formato inválido. Se esperaba { insumos: [...] }' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const item of insumos) {
            // Sumar la cantidad comprada al stock existente (no reemplazar, SUMAR)
            await client.query(
                'UPDATE inventario SET cantidad = cantidad + $1 WHERE id_producto = $2',
                [item.cantidad, item.id_producto]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Stock actualizado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// =============================================================================
// GET /api/recetas/:id_servicio
// Devuelve la receta de un servicio: qué insumos usa y en qué cantidad.
// La tabla `utiliza` relaciona servicios con sus insumos del inventario.
//
// Ejemplo de respuesta:
//   [ { id_servicio: 3, id_producto: 1, cantidad: 2, nombre_insumo: "Acetona" }, ... ]
// =============================================================================
async function getReceta(req, res) {
    try {
        const result = await pool.query(`
            SELECT u.*, i.nombre AS nombre_insumo
            FROM utiliza u
            JOIN inventario i ON u.id_producto = i.id_producto
            WHERE u.id_servicio = $1
        `, [req.params.id_servicio]);

        res.json({ success: true, receta: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// POST /api/recetas
// Guarda o reemplaza la receta de un servicio.
// Primero borra todos los insumos actuales del servicio, luego inserta los nuevos.
// Esto simplifica la lógica: no hay que calcular qué cambió, se reemplaza todo.
//
// Recibe: { id_servicio, insumos: [{ id_producto, cantidad }, ...] }
// =============================================================================
async function guardarReceta(req, res) {
    const { id_servicio, insumos } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Borrar la receta anterior (limpio antes de escribir la nueva)
        await client.query('DELETE FROM utiliza WHERE id_servicio = $1', [id_servicio]);

        // Insertar cada insumo de la nueva receta
        for (const item of insumos) {
            await client.query(
                'INSERT INTO utiliza (id_servicio, id_producto, cantidad) VALUES ($1, $2, $3)',
                [id_servicio, item.id_producto, item.cantidad]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Receta guardada.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// Exportar todas las funciones para que routes/inventario.routes.js las use
module.exports = {
    getInventario,
    registrarCompra,
    getReceta,
    guardarReceta
};
