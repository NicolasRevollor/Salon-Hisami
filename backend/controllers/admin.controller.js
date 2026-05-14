// =============================================================================
// controllers/admin.controller.js — PANEL DE ADMINISTRACIÓN
//
// Contiene todo el CRUD (Crear, Leer, Actualizar, Eliminar) del administrador:
//   EMPLEADOS  → listar, crear, editar, eliminar + gestionar especialidades
//   CLIENTES   → listar, editar, eliminar (CU10)
//   SERVICIOS  → crear, editar, eliminar (soft delete = marcar Inactivo)
//   CATEGORÍAS → crear, eliminar
//   PAQUETES   → listar, crear, editar, eliminar (con sus servicios incluidos)
//   PRIVILEGIOS → ver y cambiar qué CUs puede usar cada usuario
//   COMISIONES → ver todas las comisiones y marcar como pagadas (CU16)
//
// Funciones exportadas:
//   Empleados:    getEmpleados, crearEmpleado, editarEmpleado, eliminarEmpleado
//   Especialidades de empleado: getEspEmpleado, agregarEspEmpleado, eliminarEspEmpleado
//   Clientes:     getClientes, editarCliente, eliminarCliente
//   Servicios:    crearServicio, editarServicio, eliminarServicio
//   Categorías:   crearCategoria, eliminarCategoria
//   Paquetes:     getPaquetes, crearPaquete, editarPaquete, eliminarPaquete
//   Privilegios:  getPaquetesSistema, getPrivilegios, setPrivilegio
//   Comisiones:   getComisionesAdmin, pagarComision
// =============================================================================

const pool                     = require('../config/db');
const bcrypt                   = require('bcryptjs');
const { enviarCorreoCredenciales } = require('../config/mailer');

const SALT_ROUNDS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// EMPLEADOS
// ─────────────────────────────────────────────────────────────────────────────

// =============================================================================
// GET /api/admin/empleados
// Devuelve todos los empleados con sus especialidades concatenadas en un string.
// Ejemplo: { nombre: "Ana", especialidades: "Uñas, Masajes" }
// =============================================================================
async function getEmpleados(req, res) {
    try {
        const result = await pool.query(`
            SELECT p.id_esteticista, u.ci, u.nombre, u.email, u.telefono, p.estado,
                   STRING_AGG(e.nombre_especialidad, ', ') AS especialidades
            FROM personal p
            JOIN usuarios u ON p.ci_usuario = u.ci
            LEFT JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            GROUP BY p.id_esteticista, u.ci, u.nombre, u.email, u.telefono, p.estado
            ORDER BY u.nombre ASC
        `);
        res.json({ success: true, empleados: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// POST /api/admin/empleados
// Crea un empleado nuevo con todo lo que necesita para funcionar:
//   1. Inserta en usuarios (rol = 'Personal')
//   2. Inserta en personal (vincula como esteticista)
//   3. Asigna sus especialidades (máximo 2)
//   4. Asigna los CUs base para Personal
//   5. Asigna CUs de Caja/Finanzas e Inventario
//   6. Envía correo con credenciales
//
// Recibe: { ci, nombre, telefono, email, contrasena, especialidades[] }
// =============================================================================
async function crearEmpleado(req, res) {
    const { ci, nombre, telefono, email, contrasena, especialidades } = req.body;

    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(contrasena)) {
        return res.status(400).json({
            success: false,
            message: 'La contraseña debe tener número, mayúscula y carácter especial.'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Crear el usuario con rol Personal (contraseña hasheada con bcrypt)
        const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);
        await client.query(
            `INSERT INTO usuarios (ci, nombre, telefono, email, contrasena, rol)
             VALUES ($1, $2, $3, $4, $5, 'Personal')`,
            [ci, nombre, telefono, email, hash]
        );

        // 2. Vincularlo como esteticista en la tabla personal
        const perRes = await client.query(
            `INSERT INTO personal (ci_usuario, estado) VALUES ($1, 'Activo') RETURNING id_esteticista`,
            [ci]
        );
        const id_esteticista = perRes.rows[0].id_esteticista;

        // 3. Asignar especialidades (normalizar a array, máximo 2)
        const espsArr = Array.isArray(especialidades)
            ? especialidades
            : (especialidades ? [especialidades] : []);
        for (const id_esp of espsArr.filter(Boolean).slice(0, 2)) {
            await client.query(
                `INSERT INTO personal_especialidades (id_esteticista, id_especialidad)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [id_esteticista, id_esp]
            );
        }

        // 4. CUs base para Personal: agenda, reservas, comisiones, etc.
        for (const id_cu of [1, 2, 3, 6, 10, 18, 20, 21]) {
            await client.query(
                `INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                 VALUES ($1, $2, true)
                 ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true`,
                [ci, id_cu]
            );
        }

        // 5. CUs adicionales de los paquetes Caja/Finanzas e Inventario
        const cusPaq = await client.query(`
            SELECT cu.id_cu FROM casos_uso cu
            JOIN paquetes_sistema ps ON cu.id_paquete_sist = ps.id_paquete_sist
            WHERE LOWER(ps.nombre) IN ('caja y finanzas', 'inventario')
        `);
        for (const cu of cusPaq.rows) {
            await client.query(
                `INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                 VALUES ($1, $2, true)
                 ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true`,
                [ci, cu.id_cu]
            );
        }

        await client.query('COMMIT');

        // 6. Enviar correo con credenciales en segundo plano
        enviarCorreoCredenciales(email, nombre, contrasena);

        res.json({ success: true, message: 'Empleado registrado. Se envió correo con credenciales.' });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'El CI o Correo ya están registrados.' });
        }
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// =============================================================================
// PUT /api/admin/empleados/:ci
// Actualiza nombre, teléfono y correo de un empleado. No cambia la contraseña.
// PUT /api/admin/empleados/:ci/estado — alterna entre Activo e Inactivo
async function toggleEstadoEmpleado(req, res) {
    try {
        const r = await pool.query('SELECT estado FROM personal WHERE ci_usuario = $1', [req.params.ci]);
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
        const nuevoEstado = r.rows[0].estado === 'Activo' ? 'Inactivo' : 'Activo';
        await pool.query('UPDATE personal SET estado = $1 WHERE ci_usuario = $2', [nuevoEstado, req.params.ci]);
        res.json({ success: true, estado: nuevoEstado });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
async function editarEmpleado(req, res) {
    const { nombre, telefono, email } = req.body;
    try {
        await pool.query(
            'UPDATE usuarios SET nombre = $1, telefono = $2, email = $3 WHERE ci = $4',
            [nombre, telefono, email, req.params.ci]
        );
        res.json({ success: true, message: 'Empleado actualizado.' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Ese correo ya está registrado.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// DELETE /api/admin/empleados/:ci
// Elimina COMPLETAMENTE al empleado: sus especialidades, su fila en personal,
// sus privilegios y su usuario. Todo en una transacción para no dejar basura.
// =============================================================================
async function eliminarEmpleado(req, res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Buscar el id_esteticista para poder borrar las tablas relacionadas
        const pers = await client.query(
            'SELECT id_esteticista FROM personal WHERE ci_usuario = $1',
            [req.params.ci]
        );
        if (pers.rows.length > 0) {
            const id_est = pers.rows[0].id_esteticista;
            await client.query('DELETE FROM personal_especialidades WHERE id_esteticista = $1', [id_est]);
            await client.query('DELETE FROM personal WHERE id_esteticista = $1', [id_est]);
        }

        await client.query('DELETE FROM privilegios_usuario WHERE ci_usuario = $1', [req.params.ci]);
        await client.query('DELETE FROM usuarios WHERE ci = $1', [req.params.ci]);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Empleado eliminado.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESPECIALIDADES DE UN EMPLEADO
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/empleados/:ci/especialidades
// Devuelve las especialidades asignadas al empleado (para el modal de edición)
async function getEspEmpleado(req, res) {
    try {
        const result = await pool.query(`
            SELECT pe.id_especialidad, e.nombre_especialidad
            FROM personal p
            JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
            JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE p.ci_usuario = $1
        `, [req.params.ci]);
        res.json({ success: true, especialidades: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/admin/empleados/:ci/especialidades
// Agrega una especialidad al empleado. Máximo 2 por regla del negocio.
async function agregarEspEmpleado(req, res) {
    const { id_especialidad } = req.body;
    try {
        const pers = await pool.query(
            'SELECT id_esteticista FROM personal WHERE ci_usuario = $1',
            [req.params.ci]
        );
        if (!pers.rows.length) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
        }
        const id_est = pers.rows[0].id_esteticista;

        // Verificar límite de 2 especialidades
        const count = await pool.query(
            'SELECT COUNT(*) FROM personal_especialidades WHERE id_esteticista = $1',
            [id_est]
        );
        if (parseInt(count.rows[0].count) >= 2) {
            return res.status(400).json({ success: false, message: 'Máximo 2 especialidades por empleado.' });
        }

        await pool.query(
            `INSERT INTO personal_especialidades (id_esteticista, id_especialidad)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id_est, id_especialidad]
        );
        res.json({ success: true, message: 'Especialidad agregada.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// DELETE /api/admin/empleados/:ci/especialidades/:id_esp
// Elimina una especialidad puntual de un empleado por su id_especialidad
async function eliminarEspEmpleado(req, res) {
    const { ci, id_esp } = req.params;
    try {
        const pers = await pool.query(
            'SELECT id_esteticista FROM personal WHERE ci_usuario = $1',
            [ci]
        );
        if (!pers.rows.length) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
        }
        await pool.query(
            'DELETE FROM personal_especialidades WHERE id_esteticista = $1 AND id_especialidad = $2',
            [pers.rows[0].id_esteticista, id_esp]
        );
        res.json({ success: true, message: 'Especialidad eliminada.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICIOS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/servicios — crea un servicio nuevo con estado 'Activo'
async function crearServicio(req, res) {
    const { nombre_servicio, descripcion, precio, id_categoria } = req.body;
    try {
        await pool.query(
            `INSERT INTO servicios (nombre_servicio, descripcion, precio, id_categoria, estado)
             VALUES ($1, $2, $3, $4, 'Activo')`,
            [nombre_servicio, descripcion, precio, id_categoria]
        );
        res.json({ success: true, message: 'Servicio creado correctamente.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// PUT /api/admin/servicios/:id — edita los datos de un servicio existente
async function editarServicio(req, res) {
    const { nombre_servicio, descripcion, precio, id_categoria } = req.body;
    try {
        await pool.query(
            `UPDATE servicios
             SET nombre_servicio = $1, descripcion = $2, precio = $3, id_categoria = $4
             WHERE id_servicio = $5`,
            [nombre_servicio, descripcion, precio, id_categoria, req.params.id]
        );
        res.json({ success: true, message: 'Servicio actualizado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// DELETE /api/admin/servicios/:id
// Soft delete: marca como 'Inactivo' en vez de borrar físicamente.
// Así no se rompe el historial de reservas que ya usaron este servicio.
async function eliminarServicio(req, res) {
    try {
        await pool.query(
            `UPDATE servicios SET estado = 'Inactivo' WHERE id_servicio = $1`,
            [req.params.id]
        );
        res.json({ success: true, message: 'Servicio eliminado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/categorias — crea una categoría nueva
async function crearCategoria(req, res) {
    const { nombre } = req.body;
    if (!nombre?.trim()) {
        return res.status(400).json({ success: false, message: 'El nombre es requerido.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO categoria (nombre) VALUES ($1) RETURNING *',
            [nombre.trim()]
        );
        res.json({ success: true, message: 'Categoría creada.', categoria: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Esa categoría ya existe.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// PUT /api/categorias/:id — edita el nombre de una categoría existente
async function editarCategoria(req, res) {
    const { nombre } = req.body;
    if (!nombre?.trim()) {
        return res.status(400).json({ success: false, message: 'El nombre es requerido.' });
    }
    try {
        const result = await pool.query(
            'UPDATE categoria SET nombre = $1 WHERE id_categoria = $2 RETURNING *',
            [nombre.trim(), req.params.id]
        );
        if (!result.rowCount) {
            return res.status(404).json({ success: false, message: 'Categoría no encontrada.' });
        }
        res.json({ success: true, message: 'Categoría actualizada.', categoria: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Esa categoría ya existe.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// DELETE /api/categorias/:id
// La BD rechaza el borrado automáticamente si hay servicios que usan esta categoría (FK constraint).
async function eliminarCategoria(req, res) {
    try {
        await pool.query('DELETE FROM categoria WHERE id_categoria = $1', [req.params.id]);
        res.json({ success: true, message: 'Categoría eliminada.' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar: hay servicios con esta categoría.'
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAQUETES PROMOCIONALES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/paquetes — devuelve todos los paquetes con sus servicios incluidos
async function getPaquetes(req, res) {
    try {
        const resPaq = await pool.query('SELECT * FROM paquetes ORDER BY id_paquete ASC');

        // Para cada paquete, hacer una subconsulta para traer sus servicios
        const paquetesConServicios = await Promise.all(resPaq.rows.map(async paq => {
            const resServ = await pool.query(`
                SELECT s.id_servicio, s.nombre_servicio, s.precio
                FROM detalle_paquete dp
                JOIN servicios s ON dp.id_servicio = s.id_servicio
                WHERE dp.id_paquete = $1
            `, [paq.id_paquete]);
            return { ...paq, servicios: resServ.rows }; // agregar el array de servicios al objeto del paquete
        }));

        res.json({ success: true, paquetes: paquetesConServicios });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/admin/paquetes — crea un paquete nuevo con sus servicios en detalle_paquete
async function crearPaquete(req, res) {
    const { nombre, descripcion, precio_promocional, fecha_inicio, fecha_final, servicios } = req.body;
    if (!nombre?.trim() || !precio_promocional) {
        return res.status(400).json({ success: false, message: 'Nombre y precio promocional son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO paquetes (nombre, descripcion, precio_promocional, fecha_inicio, fecha_final)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [nombre.trim(), descripcion || '', precio_promocional,
             fecha_inicio || null, fecha_final || null]
        );
        const id_paquete = result.rows[0].id_paquete;

        // Insertar los servicios seleccionados en detalle_paquete
        if (Array.isArray(servicios)) {
            for (const id_serv of servicios.filter(Boolean)) {
                await client.query(
                    'INSERT INTO detalle_paquete (id_paquete, id_servicio) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id_paquete, id_serv]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Paquete creado.', paquete: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// PUT /api/admin/paquetes/:id — edita un paquete y reemplaza completamente sus servicios
async function editarPaquete(req, res) {
    const { nombre, descripcion, precio_promocional, fecha_inicio, fecha_final, servicios } = req.body;
    if (!nombre || !precio_promocional) {
        return res.status(400).json({ success: false, message: 'Nombre y precio son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE paquetes
             SET nombre = $1, descripcion = $2, precio_promocional = $3,
                 fecha_inicio = $4, fecha_final = $5
             WHERE id_paquete = $6`,
            [nombre, descripcion || '', precio_promocional,
             fecha_inicio || null, fecha_final || null, req.params.id]
        );

        if (Array.isArray(servicios)) {
            // Borrar los servicios actuales del paquete y reemplazarlos con los nuevos
            await client.query('DELETE FROM detalle_paquete WHERE id_paquete = $1', [req.params.id]);
            for (const id_serv of servicios.filter(Boolean)) {
                await client.query(
                    'INSERT INTO detalle_paquete (id_paquete, id_servicio) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [req.params.id, id_serv]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Paquete actualizado.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// DELETE /api/admin/paquetes/:id
// Los registros de detalle_paquete se borran automáticamente por CASCADE en la FK
async function eliminarPaquete(req, res) {
    try {
        await pool.query('DELETE FROM paquetes WHERE id_paquete = $1', [req.params.id]);
        res.json({ success: true, message: 'Paquete eliminado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CU12 — ESPECIALIDADES (catálogo global de especialidades)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/especialidades — lista todas las especialidades del sistema
async function getEspecialidadesAdmin(req, res) {
    try {
        const result = await pool.query(
            'SELECT id_especialidad, nombre_especialidad FROM especialidades ORDER BY nombre_especialidad ASC'
        );
        res.json({ success: true, especialidades: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/admin/especialidades — crea una nueva especialidad
async function crearEspecialidad(req, res) {
    const { nombre_especialidad } = req.body;
    if (!nombre_especialidad?.trim()) {
        return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO especialidades (nombre_especialidad) VALUES ($1) RETURNING *',
            [nombre_especialidad.trim()]
        );
        res.json({ success: true, message: 'Especialidad creada.', especialidad: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Esa especialidad ya existe.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// PUT /api/admin/especialidades/:id — edita el nombre de una especialidad
async function editarEspecialidad(req, res) {
    const { nombre_especialidad } = req.body;
    if (!nombre_especialidad?.trim()) {
        return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
    }
    try {
        const result = await pool.query(
            'UPDATE especialidades SET nombre_especialidad = $1 WHERE id_especialidad = $2 RETURNING *',
            [nombre_especialidad.trim(), req.params.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Especialidad no encontrada.' });
        }
        res.json({ success: true, message: 'Especialidad actualizada.', especialidad: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Esa especialidad ya existe.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// DELETE /api/admin/especialidades/:id — elimina una especialidad
// La BD rechaza automáticamente si hay empleados con esa especialidad asignada (FK).
async function eliminarEspecialidad(req, res) {
    try {
        await pool.query('DELETE FROM especialidades WHERE id_especialidad = $1', [req.params.id]);
        res.json({ success: true, message: 'Especialidad eliminada.' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar: hay empleados con esta especialidad asignada.'
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CU10 — CLIENTES (gestión de clientes desde el panel admin)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/clientes — lista todos los clientes registrados
async function getClientes(req, res) {
    try {
        const result = await pool.query(`
            SELECT u.ci, u.nombre, u.email, u.telefono,
                   (SELECT COUNT(*) FROM reservas r WHERE r.id_cliente = cl.id_cliente) AS total_reservas
            FROM usuarios u
            JOIN clientes cl ON u.ci = cl.ci_usuario
            ORDER BY u.nombre ASC
        `);
        res.json({ success: true, clientes: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/admin/clientes — crea un nuevo cliente desde el panel admin
async function crearCliente(req, res) {
    const { ci, nombre, email, telefono, contrasena } = req.body;
    if (!ci || !nombre || !email || !contrasena) {
        return res.status(400).json({ success: false, message: 'CI, nombre, correo y contraseña son obligatorios.' });
    }
    const bcrypt = require('bcryptjs');
    const { enviarCorreoCredenciales } = require('../config/mailer');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const hash = await bcrypt.hash(contrasena, 10);
        await client.query(
            `INSERT INTO usuarios (ci, nombre, telefono, email, contrasena, rol)
             VALUES ($1, $2, $3, $4, $5, 'Cliente')`,
            [ci, nombre.trim(), telefono || null, email.trim(), hash]
        );
        await client.query(`INSERT INTO clientes (ci_usuario) VALUES ($1)`, [ci]);
        for (const id_cu of [1, 2, 3]) {
            await client.query(
                `INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                 VALUES ($1, $2, true) ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true`,
                [ci, id_cu]
            );
        }
        await client.query('COMMIT');
        enviarCorreoCredenciales(email.trim(), nombre.trim(), contrasena);
        res.json({ success: true, message: 'Cliente registrado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'El CI o correo ya están registrados.' });
        }
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// PUT /api/admin/clientes/:ci — edita nombre, teléfono y correo de un cliente
async function editarCliente(req, res) {
    const { nombre, telefono, email } = req.body;
    try {
        await pool.query(
            'UPDATE usuarios SET nombre = $1, telefono = $2, email = $3 WHERE ci = $4',
            [nombre, telefono, email, req.params.ci]
        );
        res.json({ success: true, message: 'Cliente actualizado.' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Ese correo ya está registrado.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
}

// DELETE /api/admin/clientes/:ci — elimina un cliente y todos sus datos relacionados
// Orden: detalle_comision → reservas (cascade: comision/detalle_reserva/pagos) → clientes → privilegios_usuario → usuarios
async function eliminarCliente(req, res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Obtener id_cliente para poder borrar sus reservas
        const clRes = await client.query('SELECT id_cliente FROM clientes WHERE ci_usuario = $1', [req.params.ci]);
        if (clRes.rows.length) {
            const id_cliente = clRes.rows[0].id_cliente;

            // detalle_comision no tiene ON DELETE CASCADE → hay que borrarlo antes que reservas
            await client.query(`
                DELETE FROM detalle_comision
                WHERE id_comision IN (
                    SELECT c.id_comision FROM comision c
                    JOIN reservas r ON c.id_cita = r.id_cita
                    WHERE r.id_cliente = $1
                )
            `, [id_cliente]);

            // Borrar reservas (cascade elimina comision, detalle_reserva y pagos)
            await client.query('DELETE FROM reservas WHERE id_cliente = $1', [id_cliente]);
        }

        await client.query('DELETE FROM clientes WHERE ci_usuario = $1', [req.params.ci]);
        await client.query('DELETE FROM privilegios_usuario WHERE ci_usuario = $1', [req.params.ci]);
        await client.query('DELETE FROM usuarios WHERE ci = $1', [req.params.ci]);
        await client.query('COMMIT');
        res.json({ success: true, message: 'Cliente eliminado.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CU16 — COMISIONES (gestión de comisiones desde el panel admin)
// ─────────────────────────────────────────────────────────────────────────────
// CITAS — vista global para el administrador
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/citas — lista todas las reservas del sistema con detalle completo
async function getCitasAdmin(req, res) {
    try {
        const result = await pool.query(`
            SELECT r.id_cita, r.fecha, r.hora, r.estado, r.reprogramaciones,
                   uc.nombre  AS nombre_cliente,
                   ue.nombre  AS nombre_esteticista,
                   STRING_AGG(DISTINCT s.nombre_servicio, ', ') AS servicios,
                   pg.metodo_pago, pg.monto
            FROM reservas r
            JOIN clientes cl  ON r.id_cliente      = cl.id_cliente
            JOIN usuarios uc  ON cl.ci_usuario      = uc.ci
            JOIN personal pe  ON r.id_esteticista   = pe.id_esteticista
            JOIN usuarios ue  ON pe.ci_usuario       = ue.ci
            LEFT JOIN detalle_reserva dr ON r.id_cita      = dr.id_cita
            LEFT JOIN servicios s        ON dr.id_servicio  = s.id_servicio
            LEFT JOIN pagos pg           ON r.id_cita       = pg.id_cita
            GROUP BY r.id_cita, r.fecha, r.hora, r.estado, r.reprogramaciones,
                     uc.nombre, ue.nombre, pg.metodo_pago, pg.monto
            ORDER BY r.fecha DESC, r.hora DESC
        `);
        res.json({ success: true, citas: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/comisiones — lista todas las comisiones de todo el personal
async function getComisionesAdmin(req, res) {
    try {
        const result = await pool.query(`
            SELECT c.id_comision, u.nombre AS nombre_empleado, u.ci,
                   c.fecha, c.monto_comision, c.estado_pago
            FROM comision c
            JOIN personal p ON c.id_esteticista = p.id_esteticista
            JOIN usuarios u ON p.ci_usuario = u.ci
            ORDER BY c.fecha DESC
        `);
        res.json({ success: true, comisiones: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// PUT /api/admin/comisiones/:id/pagar — marca una comisión como pagada
async function pagarComision(req, res) {
    try {
        const result = await pool.query(
            `UPDATE comision SET estado_pago = 'Pagado' WHERE id_comision = $1 RETURNING *`,
            [req.params.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Comisión no encontrada.' });
        }
        res.json({ success: true, message: 'Comisión marcada como pagada.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVILEGIOS DE USUARIO (qué CUs puede usar cada uno)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/paquetes-sistema — devuelve todos los paquetes del sistema con sus CUs
async function getPaquetesSistema(req, res) {
    try {
        const result = await pool.query(`
            SELECT ps.*,
                   json_agg(json_build_object('id_cu', cu.id_cu, 'nombre', cu.nombre_cu)) AS casos_uso
            FROM paquetes_sistema ps
            LEFT JOIN casos_uso cu ON ps.id_paquete_sist = cu.id_paquete_sist
            GROUP BY ps.id_paquete_sist
            ORDER BY ps.id_paquete_sist
        `);
        res.json({ success: true, paquetes: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/admin/privilegios/:ci
// Devuelve todos los CUs marcando cuáles tiene habilitados el usuario con ese CI
async function getPrivilegios(req, res) {
    try {
        const result = await pool.query(`
            SELECT cu.id_cu, cu.nombre_cu AS nombre, cu.id_paquete_sist,
                   EXISTS(
                     SELECT 1 FROM privilegios_usuario pu
                     WHERE pu.ci_usuario = $1 AND pu.id_cu = cu.id_cu AND pu.habilitado = true
                   ) AS tiene
            FROM casos_uso cu
            ORDER BY cu.id_paquete_sist, cu.id_cu
        `, [req.params.ci]);
        res.json({ success: true, privilegios: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/admin/privilegios
// Activa o desactiva un CU para un usuario específico.
// Recibe: { ci_usuario, id_cu, habilitado: true|false }
async function setPrivilegio(req, res) {
    const { ci_usuario, id_cu, habilitado } = req.body;
    try {
        // INSERT si no existe, UPDATE si ya existe — funciona para activar Y desactivar
        await pool.query(
            `INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
             VALUES ($1, $2, $3)
             ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = $3`,
            [ci_usuario, id_cu, habilitado === true || habilitado === 'true']
        );
        res.json({ success: true, message: 'Privilegio actualizado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// Exportar todas las funciones para que routes/admin.routes.js las use
module.exports = {
    // Empleados (CU11)
    getEmpleados, crearEmpleado, editarEmpleado, eliminarEmpleado, toggleEstadoEmpleado,
    // Especialidades de empleado
    getEspEmpleado, agregarEspEmpleado, eliminarEspEmpleado,
    // Especialidades catálogo global (CU12)
    getEspecialidadesAdmin, crearEspecialidad, editarEspecialidad, eliminarEspecialidad,
    // Clientes (CU10)
    getClientes, crearCliente, editarCliente, eliminarCliente,
    // Servicios (CU7)
    crearServicio, editarServicio, eliminarServicio,
    // Categorías (CU8)
    crearCategoria, editarCategoria, eliminarCategoria,
    // Paquetes (CU9)
    getPaquetes, crearPaquete, editarPaquete, eliminarPaquete,
    // Privilegios (CU18)
    getPaquetesSistema, getPrivilegios, setPrivilegio,
    // Citas (admin)
    getCitasAdmin,
    // Comisiones (CU16)
    getComisionesAdmin, pagarComision
};
