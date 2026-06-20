// =============================================================================
// controllers/ciclo4c.controller.js — CU22 ÓRDENES DE COMPRA
//
// Casos de uso que maneja:
//   CU22 → Registrar y controlar órdenes de reabastecimiento de productos
//
// Flujo del CU22:
//   1. Admin abre la pestaña Órdenes de Compra → lista de órdenes existentes
//   2. Crea una nueva orden: selecciona proveedor, productos y cantidades
//   3. Al guardar, la orden queda en estado "pendiente"
//   4. Al marcar como "recibida", el stock del inventario se actualiza
// =============================================================================

const pool = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');

// =============================================================================
// INICIALIZACIÓN — crea las tablas necesarias si no existen
// =============================================================================
async function initCU22() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS proveedores (
            id_proveedor   SERIAL PRIMARY KEY,
            nombre         VARCHAR(150) NOT NULL,
            contacto       VARCHAR(100) DEFAULT '',
            telefono       VARCHAR(30)  DEFAULT '',
            email          VARCHAR(100) DEFAULT '',
            direccion      TEXT         DEFAULT '',
            fecha_registro TIMESTAMP    DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ordenes_compra (
            id_orden              SERIAL PRIMARY KEY,
            id_proveedor          INTEGER REFERENCES proveedores(id_proveedor) ON DELETE SET NULL,
            fecha_orden           TIMESTAMP   DEFAULT NOW(),
            fecha_entrega_esperada DATE,
            estado                VARCHAR(30) DEFAULT 'pendiente',
            monto_total           NUMERIC(10,2) DEFAULT 0,
            ci_admin              VARCHAR(20),
            nombre_admin          VARCHAR(150),
            notas                 TEXT DEFAULT ''
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS detalle_orden_compra (
            id_detalle     SERIAL PRIMARY KEY,
            id_orden       INTEGER REFERENCES ordenes_compra(id_orden) ON DELETE CASCADE,
            id_producto    INTEGER REFERENCES inventario(id_producto) ON DELETE SET NULL,
            nombre_producto VARCHAR(150),
            cantidad        NUMERIC(10,2) NOT NULL,
            precio_unitario NUMERIC(10,2) DEFAULT 0,
            subtotal        NUMERIC(10,2) DEFAULT 0
        )
    `);
    console.log('✅ Tablas proveedores, ordenes_compra y detalle_orden_compra listas (CU22)');
}

initCU22().catch(err => console.error('❌ Error init CU22:', err.message));


// =============================================================================
// PROVEEDORES
// =============================================================================

// GET /api/cu22/proveedores
async function getProveedores(req, res) {
    try {
        const result = await pool.query(
            'SELECT * FROM proveedores ORDER BY nombre'
        );
        res.json({ success: true, proveedores: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/cu22/proveedores
async function crearProveedor(req, res) {
    const { nombre, contacto = '', telefono = '', email = '', direccion = '' } = req.body;
    if (!nombre?.trim())
        return res.status(400).json({ success: false, message: 'El nombre del proveedor es obligatorio.' });

    try {
        const result = await pool.query(
            `INSERT INTO proveedores (nombre, contacto, telefono, email, direccion)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [nombre.trim(), contacto, telefono, email, direccion]
        );
        res.json({ success: true, message: 'Proveedor registrado.', proveedor: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// PUT /api/cu22/proveedores/:id
async function editarProveedor(req, res) {
    const { id } = req.params;
    const { nombre, contacto = '', telefono = '', email = '', direccion = '' } = req.body;
    if (!nombre?.trim())
        return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });

    try {
        const result = await pool.query(
            `UPDATE proveedores SET nombre=$1, contacto=$2, telefono=$3, email=$4, direccion=$5
             WHERE id_proveedor=$6 RETURNING *`,
            [nombre.trim(), contacto, telefono, email, direccion, id]
        );
        if (!result.rows.length)
            return res.status(404).json({ success: false, message: 'Proveedor no encontrado.' });
        res.json({ success: true, message: 'Proveedor actualizado.', proveedor: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// DELETE /api/cu22/proveedores/:id
async function eliminarProveedor(req, res) {
    const { id } = req.params;
    try {
        await pool.query(
            'UPDATE ordenes_compra SET id_proveedor = NULL WHERE id_proveedor = $1', [id]
        );
        await pool.query('DELETE FROM proveedores WHERE id_proveedor = $1', [id]);
        res.json({ success: true, message: 'Proveedor eliminado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}


// =============================================================================
// ÓRDENES DE COMPRA
// =============================================================================

// GET /api/cu22/ordenes
// Devuelve todas las órdenes con nombre del proveedor.
async function getOrdenes(req, res) {
    try {
        const result = await pool.query(`
            SELECT o.*, p.nombre AS nombre_proveedor
            FROM   ordenes_compra o
            LEFT JOIN proveedores p ON o.id_proveedor = p.id_proveedor
            ORDER BY o.fecha_orden DESC
        `);
        res.json({ success: true, ordenes: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/cu22/ordenes/:id/detalle
// Devuelve los ítems de una orden específica.
async function getDetalleOrden(req, res) {
    const { id } = req.params;
    try {
        const orden = await pool.query(
            `SELECT o.*, p.nombre AS nombre_proveedor
             FROM ordenes_compra o
             LEFT JOIN proveedores p ON o.id_proveedor = p.id_proveedor
             WHERE o.id_orden = $1`, [id]
        );
        if (!orden.rows.length)
            return res.status(404).json({ success: false, message: 'Orden no encontrada.' });

        const detalle = await pool.query(
            `SELECT * FROM detalle_orden_compra WHERE id_orden = $1 ORDER BY id_detalle`, [id]
        );
        res.json({ success: true, orden: orden.rows[0], detalle: detalle.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/cu22/ordenes
// Registra una nueva orden de compra con sus ítems.
// Recibe: { id_proveedor, fecha_entrega_esperada, notas, ci_admin, nombre_admin,
//           items: [{ id_producto, nombre_producto, cantidad, precio_unitario }] }
async function crearOrden(req, res) {
    const {
        id_proveedor,
        fecha_entrega_esperada,
        notas = '',
        ci_admin,
        nombre_admin,
        items = []
    } = req.body;

    if (!items.length)
        return res.status(400).json({ success: false, message: 'La orden debe tener al menos un producto.' });

    // Calcular monto total
    const montoTotal = items.reduce((sum, i) => {
        return sum + (parseFloat(i.cantidad) * parseFloat(i.precio_unitario || 0));
    }, 0);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insertar la orden
        const ordenResult = await client.query(
            `INSERT INTO ordenes_compra
             (id_proveedor, fecha_entrega_esperada, estado, monto_total, ci_admin, nombre_admin, notas)
             VALUES ($1, $2, 'pendiente', $3, $4, $5, $6)
             RETURNING *`,
            [id_proveedor || null, fecha_entrega_esperada || null, montoTotal.toFixed(2), ci_admin, nombre_admin, notas]
        );
        const orden = ordenResult.rows[0];

        // Insertar ítems
        for (const item of items) {
            const subtotal = parseFloat(item.cantidad) * parseFloat(item.precio_unitario || 0);
            await client.query(
                `INSERT INTO detalle_orden_compra
                 (id_orden, id_producto, nombre_producto, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [orden.id_orden, item.id_producto || null, item.nombre_producto, item.cantidad, item.precio_unitario || 0, subtotal.toFixed(2)]
            );
        }

        await client.query('COMMIT');

        await registrarEvento(ci_admin, nombre_admin, 'Administrador',
            'CU22_ORDEN', `Orden #${orden.id_orden} registrada con ${items.length} producto(s). Total: $${montoTotal.toFixed(2)}`, 'Exitoso'
        ).catch(() => {});

        res.json({ success: true, message: `Orden #${orden.id_orden} registrada exitosamente.`, orden });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// PUT /api/cu22/ordenes/:id/recibir
// Marca la orden como recibida y suma las cantidades al inventario.
async function recibirOrden(req, res) {
    const { id } = req.params;
    const { ci_admin, nombre_admin } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar que la orden existe y está pendiente
        const ordenResult = await client.query(
            'SELECT * FROM ordenes_compra WHERE id_orden = $1 FOR UPDATE', [id]
        );
        if (!ordenResult.rows.length)
            return res.status(404).json({ success: false, message: 'Orden no encontrada.' });

        const orden = ordenResult.rows[0];
        if (orden.estado !== 'pendiente')
            return res.status(400).json({ success: false, message: `La orden ya está en estado "${orden.estado}".` });

        // Obtener ítems de la orden
        const items = await client.query(
            'SELECT * FROM detalle_orden_compra WHERE id_orden = $1', [id]
        );

        // Actualizar stock en inventario para cada ítem que tenga producto vinculado
        for (const item of items.rows) {
            if (item.id_producto) {
                await client.query(
                    'UPDATE inventario SET cantidad = cantidad + $1 WHERE id_producto = $2',
                    [item.cantidad, item.id_producto]
                );
            }
        }

        // Marcar orden como recibida
        await client.query(
            `UPDATE ordenes_compra SET estado = 'recibida' WHERE id_orden = $1`, [id]
        );

        await client.query('COMMIT');

        await registrarEvento(ci_admin, nombre_admin, 'Administrador',
            'CU22_ORDEN', `Orden #${id} marcada como recibida. Stock actualizado para ${items.rows.filter(i => i.id_producto).length} producto(s).`, 'Exitoso'
        ).catch(() => {});

        res.json({ success: true, message: `Orden #${id} recibida. Inventario actualizado.` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// PUT /api/cu22/ordenes/:id/cancelar
async function cancelarOrden(req, res) {
    const { id } = req.params;
    const { ci_admin, nombre_admin } = req.body;
    try {
        const result = await pool.query(
            `UPDATE ordenes_compra SET estado = 'cancelada'
             WHERE id_orden = $1 AND estado = 'pendiente' RETURNING *`,
            [id]
        );
        if (!result.rows.length)
            return res.status(400).json({ success: false, message: 'Solo se pueden cancelar órdenes pendientes.' });

        await registrarEvento(ci_admin, nombre_admin, 'Administrador',
            'CU22_ORDEN', `Orden #${id} cancelada.`, 'Exitoso'
        ).catch(() => {});

        res.json({ success: true, message: `Orden #${id} cancelada.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getProveedores,
    crearProveedor,
    editarProveedor,
    eliminarProveedor,
    getOrdenes,
    getDetalleOrden,
    crearOrden,
    recibirOrden,
    cancelarOrden
};
