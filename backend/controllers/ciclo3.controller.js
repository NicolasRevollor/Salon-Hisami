// =============================================================================
// controllers/ciclo3.controller.js — CICLO 3
//
// ¿Qué hace este archivo?
//   Contiene TODAS las funciones del backend para los 6 casos de uso nuevos.
//   Cada función recibe una petición del frontend, hace algo con la base de datos
//   y devuelve una respuesta en formato JSON.
//
// Casos de uso que maneja:
//   CU6  → Guardar/leer las preferencias de estilo de un cliente (color, largo, etc.)
//   CU14 → Asignar insumos del inventario al kit personal de una esteticista
//   CU15 → Ver qué productos tienen poco stock (por debajo del mínimo configurado)
//   CU20 → Mandar correos de recordatorio de cita a los clientes por Gmail
//   CU21 → Generar un enlace de WhatsApp para escribirle a un cliente
//   CU23 → Descontar automáticamente los insumos del inventario cuando se hace un servicio
//
// Tablas nuevas que crea automáticamente al arrancar el servidor (si no existen):
//   preferencias_cliente → guarda el estilo personal de cada cliente
//   kit_personal         → guarda qué insumos tiene asignados cada esteticista
//   stock_minimo         → nueva columna en la tabla inventario (cuánto es "poco stock")
// =============================================================================

// ── Importaciones ─────────────────────────────────────────────────────────────
// pool       → el conector a PostgreSQL (para hacer consultas SQL)
// registrarEvento → función del CU19 que guarda eventos en la bitácora
// transporter     → el "cartero" de Gmail configurado en config/mailer.js
const pool            = require('../config/db');
const { registrarEvento } = require('./bitacora.controller');
const { transporter }     = require('../config/mailer');


// =============================================================================
// INICIALIZACIÓN — Se ejecuta UNA SOLA VEZ cuando arranca el servidor
//
// ¿Por qué hacemos esto aquí y no en pgAdmin?
//   Para que el proyecto funcione en cualquier computadora sin tener que
//   crear las tablas manualmente. Si ya existen, no hace nada.
// =============================================================================
async function initCiclo3() {
    // ── Tabla: preferencias_cliente ───────────────────────────────────────────
    // Guarda las preferencias de estilo de cada cliente.
    // ci_usuario es la clave principal (un cliente = una fila).
    // ON DELETE CASCADE significa: si se borra el usuario, también se borran sus preferencias.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS preferencias_cliente (
            ci_usuario    VARCHAR(20) PRIMARY KEY REFERENCES usuarios(ci) ON DELETE CASCADE,
            color_cabello VARCHAR(100),   -- color del cabello del cliente
            largo         VARCHAR(50),    -- corto, mediano o largo
            estilo        VARCHAR(100),   -- natural, ondulado, etc.
            notas         TEXT,           -- observaciones especiales (alergias, etc.)
            updated_at    TIMESTAMP DEFAULT NOW()  -- cuándo se guardó por última vez
        )
    `);

    // ── Tabla: kit_personal ───────────────────────────────────────────────────
    // Guarda qué productos del inventario tiene asignada cada esteticista.
    // La clave principal es la combinación de ci_empleado + id_producto
    // (una empleada puede tener varios productos, pero cada producto solo aparece una vez).
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kit_personal (
            ci_empleado  VARCHAR(20) REFERENCES usuarios(ci) ON DELETE CASCADE,
            id_producto  INTEGER REFERENCES inventario(id_producto) ON DELETE CASCADE,
            cantidad     NUMERIC(10,2) DEFAULT 1,   -- cuántas unidades tiene asignadas
            PRIMARY KEY (ci_empleado, id_producto)  -- clave primaria compuesta
        )
    `);

    // ── Columna nueva en inventario: stock_minimo ─────────────────────────────
    // ADD COLUMN IF NOT EXISTS → si ya existe la columna, no hace nada (no da error).
    // DEFAULT 5 → si no se configura, el mínimo será 5 unidades.
    await pool.query(`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 5`);

    // ── Columna nueva en inventario: unidad ───────────────────────────────────
    // Guarda la unidad de medida del insumo (ml, gr, unidades, etc.).
    await pool.query(`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS unidad VARCHAR(50) DEFAULT ''`);

    // ── Tabla: historial_preferencias_cliente ────────────────────────────────
    // Guarda CADA VEZ que se guardan las preferencias de un cliente (historial).
    // A diferencia de preferencias_cliente (que solo tiene la última),
    // esta tabla acumula todos los registros históricos.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS historial_preferencias_cliente (
            id            SERIAL PRIMARY KEY,
            ci_usuario    VARCHAR(20) REFERENCES usuarios(ci) ON DELETE CASCADE,
            color_cabello VARCHAR(100),
            largo         VARCHAR(50),
            estilo        VARCHAR(100),
            notas         TEXT,
            guardado_at   TIMESTAMP DEFAULT NOW()
        )
    `);
}

// Llamar a initCiclo3() al arrancar. Si algo falla, solo muestra el error en consola
// pero NO detiene el servidor (es un error de inicialización, no fatal).
initCiclo3().catch(err => console.error('❌ Error init Ciclo 3:', err.message));


// =============================================================================
// CU6 — PREFERENCIAS DEL CLIENTE
// Permite ver y guardar el estilo personal de un cliente (color, largo, notas).
// =============================================================================

// ── getPreferencias ───────────────────────────────────────────────────────────
// Busca las preferencias de un cliente por su CI.
// Si el cliente existe pero no tiene preferencias guardadas todavía, igual devuelve
// sus datos básicos (nombre, email) con los campos de preferencias en null.
// Ruta: GET /api/ciclo3/preferencias/:ci
async function getPreferencias(req, res) {
    const { ci } = req.params; // el CI viene en la URL, ej: /api/ciclo3/preferencias/12345678
    try {
        // LEFT JOIN → trae los datos del usuario Y, si existen, sus preferencias.
        // Si no tiene preferencias, igual devuelve la fila con null en esos campos.
        // Solo busca usuarios con rol 'Cliente' para no mezclar con empleados.
        const r = await pool.query(`
            SELECT u.nombre, u.ci, u.email,
                   pc.color_cabello, pc.largo, pc.estilo, pc.notas, pc.updated_at
            FROM usuarios u
            LEFT JOIN preferencias_cliente pc ON pc.ci_usuario = u.ci
            JOIN roles ro ON u.id_rol = ro.id_rol
            WHERE u.ci = $1 AND ro.nombre = 'Cliente'
        `, [ci]);

        // Si no encontró ningún resultado, el CI no corresponde a ningún cliente
        if (!r.rows.length)
            return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });

        // Devolver los datos al frontend
        res.json({ success: true, data: r.rows[0] });
    } catch (err) {
        // Si hay un error de base de datos, devolver código 500 con el mensaje de error
        res.status(500).json({ success: false, message: err.message });
    }
}

// ── setPreferencias ───────────────────────────────────────────────────────────
// Guarda o actualiza las preferencias de un cliente.
// Usa INSERT ... ON CONFLICT → si ya tiene preferencias, las actualiza;
// si no tiene, las crea. No hay que revisar si existe antes.
// Ruta: PUT /api/ciclo3/preferencias/:ci
// guardarPreferencias(ci, datos_preferencias)
// Diagrama: Ciclo3Controller recibe el PUT /api/ciclo3/preferencias/:ci
async function setPreferencias(req, res) {
    const { ci } = req.params; // CI del cliente que se está editando

    // Extraer todos los datos que mandó el frontend en el body de la petición
    const { color_cabello, largo, estilo, notas, ci_admin, nombre_admin, rol_admin } = req.body;
    // ci_admin, nombre_admin, rol_admin → datos del administrador que está haciendo el cambio
    // (para registrar en la bitácora quién hizo qué)

    try {
        // guardarOActualizarPreferencias(ci, datos_preferencias)
        // Diagrama: modelo PreferenciasCliente — INSERT ON CONFLICT (usa ci_usuario como clave)
        // Si ya existe una fila con ese ci_usuario → actualiza; si no → inserta nueva
        await pool.query(`
            INSERT INTO preferencias_cliente (ci_usuario, color_cabello, largo, estilo, notas, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (ci_usuario) DO UPDATE SET
                color_cabello = EXCLUDED.color_cabello,
                largo         = EXCLUDED.largo,
                estilo        = EXCLUDED.estilo,
                notas         = EXCLUDED.notas,
                updated_at    = NOW()
        `, [ci, color_cabello, largo, estilo, notas]);
        // operacion_realizada → el INSERT/UPDATE completó sin error (alt [sin error de BD])

        // ── B. Registrar en Historial de Preferencias ────────────────────────
        // registrarEnHistorial(ci, datos_preferencias)
        // datos_preferencias contiene: color_cabello, largo, estilo, notas
        // (son los mismos campos que en preferencias_cliente)
        //
        // insertarHistorial(ci, datos_preferencias)
        // INSERT INTO historial_preferencias_cliente
        //   (ci_usuario, color_cabello, largo, estilo, notas)
        //   VALUES ($1, $2, $3, $4, $5)
        // -- NO se usa RETURNING id — El historial_id generado se descarta
        await pool.query(`
            INSERT INTO historial_preferencias_cliente (ci_usuario, color_cabello, largo, estilo, notas)
            VALUES ($1, $2, $3, $4, $5)
        `, [ci, color_cabello, largo, estilo, notas]);
        // operacion_realizada → respuestaOK_parcial (historial registrado)

        // ── C. Registrar Evento en Bitácora ──────────────────────────────────
        // registrarEvento(ci_admin, nombre_admin, rol_admin, accion, descripcion, estado)
        // INSERT INTO bitacora
        //   (ci_usuario, nombre_usuario, rol, accion, descripcion, estado, fecha_hora)
        //   VALUES ($1, $2, $3, $4, $5, $6, NOW())
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU6_PREFERENCIAS', `Preferencias actualizadas — cliente CI: ${ci}`, 'Exitoso');
        // evento_registrado

        // respuestaOK_final ("Preferencias guardadas correctamente.")
        res.json({ success: true, message: 'Preferencias guardadas correctamente.' });
    } catch (err) {
        // ── D. Error de Base de Datos ─────────────────────────────────────────
        //
        // 1) Error al guardar/actualizar preferencias
        //    guardarOActualizarPreferencias(ci, datos_preferencias) → ERROR de BD
        //    (INSERT / UPDATE falla — la excepción llega aquí desde el try)
        //
        // 2) Captura del error (catch) — Se ejecuta el bloque catch del controlador
        //    registrarEvento(ci_admin, nombre_admin, rol_admin,
        //      accion='CU6_PREFERENCIAS',
        //      descripcion='Preferencias actualizadas - cliente CI: {ci}',
        //      estado='Fallido')
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU6_PREFERENCIAS', `Error al guardar preferencias CI: ${ci}`, 'Fallido');
        // evento_registrado (estado = 'Fallido')

        // 3) Respuesta de error al frontend
        //    respuestaError (500 - error interno del servidor)
        //    El frontend muestra el mensaje de error al usuario.
        //    No se guardó ni preferencias, ni historial.
        //    Nota: En caso de error, no se registra en historial_preferencias_cliente
        //    ni se actualiza preferencias_cliente.
        res.status(500).json({ success: false, message: err.message });
    }
}


// ── getHistorialPreferencias ──────────────────────────────────────────────────
// Devuelve todos los registros históricos de preferencias de un cliente.
// Más reciente primero.
// Ruta: GET /api/ciclo3/historial-preferencias/:ci
async function getHistorialPreferencias(req, res) {
    const { ci } = req.params;
    try {
        const r = await pool.query(`
            SELECT id, color_cabello, largo, estilo, notas, guardado_at
            FROM historial_preferencias_cliente
            WHERE ci_usuario = $1
            ORDER BY guardado_at DESC
        `, [ci]);
        res.json({ success: true, historial: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}


// =============================================================================
// CU14 — KIT PERSONAL DEL ESTETICISTA
// Permite ver y actualizar los insumos asignados a una esteticista.
// =============================================================================

// ── getKit ────────────────────────────────────────────────────────────────────
// Devuelve el kit personal de una esteticista: lista de insumos asignados.
// Ruta: GET /api/ciclo3/kit/:ci
async function getKit(req, res) {
    const { ci } = req.params; // CI de la esteticista
    try {
        // Primero verificar que el CI corresponde a un empleado (rol 'Personal')
        const emp = await pool.query(
            `SELECT u.nombre FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
             WHERE u.ci = $1 AND r.nombre = 'Personal'`, [ci]);

        if (!emp.rows.length)
            return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });

        // Buscar todos los insumos asignados a esta esteticista
        // JOIN con inventario → para traer el nombre, unidad y stock actual de cada insumo
        const kit = await pool.query(`
            SELECT kp.id_producto, kp.cantidad,
                   i.nombre AS nombre_insumo,   -- nombre del producto del inventario
                   i.unidad,                     -- unidad de medida (ml, gr, unidades...)
                   i.cantidad AS stock_actual    -- cuánto hay actualmente en el inventario
            FROM kit_personal kp
            JOIN inventario i ON kp.id_producto = i.id_producto
            WHERE kp.ci_empleado = $1
            ORDER BY i.nombre  -- ordenar alfabéticamente por nombre del producto
        `, [ci]);

        // Devolver el nombre de la empleada y su lista de insumos
        res.json({ success: true, nombre_empleado: emp.rows[0].nombre, kit: kit.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ── setKit ────────────────────────────────────────────────────────────────────
// A. Asignar / Actualizar Kit Personal de Esteticista
// Ruta: POST /api/ciclo3/kit
//
// asignarActualizarKit(ci_empleado, items[]) — clic en "Guardar Kit"
// Ciclo3Controller: setKit(ci_empleado, items[])
// [Todo el proceso ocurre en una sola función]
async function setKit(req, res) {
    // Parámetros enviados (Body JSON):
    //   ci_empleado (cédula), items[] (array de objetos: id_producto (int), cantidad (int > 0))
    //   ci_admin, nombre_admin, rol_admin
    const { ci_empleado, items, ci_admin, nombre_admin, rol_admin } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Paso 1: Leer kit actual del empleado
        // leerKitActual(ci_empleado) — SELECT kit_personal WHERE ci_empleado
        // SELECT id_producto, cantidad FROM kit_personal WHERE ci_empleado = $1
        // Resultado: kit_actual[] [{id_producto, cantidad}, ...]
        const kitActual = await client.query(
            'SELECT id_producto, cantidad FROM kit_personal WHERE ci_empleado = $1',
            [ci_empleado]
        );
        const oldMap = {};
        for (const row of kitActual.rows) oldMap[row.id_producto] = Number(row.cantidad);

        // Paso 2: Calcular diferencias (nuevo vs actual)
        // Para cada producto: diff = (nueva_cantidad) - (cantidad_actual)
        //   diff > 0 → se necesita más stock
        //   diff < 0 → se debe devolver stock
        //   diff = 0 → sin cambio (se omite del mapa)
        const newMap = {};
        for (const item of (items || [])) newMap[item.id_producto] = Number(item.cantidad);

        const allIds = new Set([...Object.keys(oldMap).map(String), ...Object.keys(newMap).map(String)]);
        const diffs = {};
        for (const id of allIds) {
            const diff = (newMap[id] || 0) - (oldMap[id] || 0);
            if (diff !== 0) diffs[id] = diff;
        }
        // continuar Validacion(diferencias_calculadas) — listo para validar stock por producto

        // validarDisponibilidadInventario(lista_productos_id) [POST /api/ciclo3/kit]
        // obtenerInventarioActual(lista_productos_id)
        // SELECT id_producto, nombre, cantidad FROM inventario WHERE id_producto IN (lista_productos_id)
        // Resultado: inventario_actual_detalles (stock por producto)
        for (const [id_producto, diff] of Object.entries(diffs)) {
            if (diff > 0) {
                const inv = await client.query(
                    'SELECT nombre, cantidad FROM inventario WHERE id_producto = $1', [id_producto]
                );
                if (!inv.rows.length || Number(inv.rows[0].cantidad) < diff) {
                    // [else - stock_insuficiente] Paso 7 — Respuesta de error al frontend
                    await client.query('ROLLBACK');
                    const nombre = inv.rows[0]?.nombre || `producto ID ${id_producto}`;
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuficiente para: ${nombre}`
                    });
                }
            }
        }

        // Paso 3: Registrar asignación del kit (REEMPLAZO TOTAL en transacción)
        // Transacción (BEGIN / COMMIT) — iniciarTransaccion() ya se ejecutó al inicio

        // reemplazarKit(ci_esteticista, items[]) -- DELETE kit anterior --
        // DELETE FROM kit_personal WHERE ci_empleado = $1
        await client.query('DELETE FROM kit_personal WHERE ci_empleado = $1', [ci_empleado]);
        // delete_ok

        // loop [por cada item del kit (id_producto, cantidad)]
        // insertarItemsKit(ci_esteticista, items[]) -- INSERT nuevos items --
        // INSERT INTO kit_personal (ci_empleado, id_producto, cantidad) VALUES ($1, $2, $3) (por cada item)
        for (const item of (items || [])) {
            await client.query(
                'INSERT INTO kit_personal (ci_empleado, id_producto, cantidad) VALUES ($1, $2, $3)',
                [ci_empleado, item.id_producto, item.cantidad]
            );
        }
        // insert_ok

        // Paso 4: Actualizar stock del inventario (según diferencias calculadas)
        // actualizarStock(id_producto, diff)
        // si diff > 0 descuenta / si diff < 0 devuelve
        // UPDATE inventario SET cantidad = cantidad - $1 WHERE id_producto = $2
        for (const [id_producto, diff] of Object.entries(diffs)) {
            await client.query(
                'UPDATE inventario SET cantidad = cantidad - $1 WHERE id_producto = $2',
                [diff, id_producto]
            );
        }
        // stock_actualizado

        // confirmarTransaccion()
        await client.query('COMMIT');

        // Paso 5 — Registrar evento en bitácora
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU14_KIT', `Kit actualizado — empleado CI: ${ci_empleado}`, 'Exitoso');

        // Paso 6 — Respuesta exitosa al frontend
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


// =============================================================================
// CU15 — ALERTAS DE STOCK
// Devuelve los productos cuya cantidad actual es <= al mínimo configurado.
// =============================================================================

// ── getAlertasStock ───────────────────────────────────────────────────────────
// Busca en el inventario todos los productos "en alerta" (poco stock).
// COALESCE(stock_minimo, 5) → si stock_minimo es NULL, usa 5 como valor por defecto.
// Ruta: GET /api/ciclo3/alertas-stock
// getAlertasStock() [GET /api/ciclo3/alertas-stock]
async function getAlertasStock(req, res) {
    try {
        // obtenerProductosStockCritico()
        const r = await pool.query(`
            SELECT id_producto, nombre, cantidad, unidad,
                   COALESCE(stock_minimo, 5) AS stock_minimo
            FROM inventario
            WHERE cantidad < COALESCE(stock_minimo, 5) * 2  -- alerta cuando el stock está por debajo del doble del mínimo
            ORDER BY cantidad ASC                            -- primero los más críticos (menor stock)
        `);
        // productos_alerta[] [lista de productos en stock crítico]
        res.json({ success: true, alertas: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ── updateStockMinimo ─────────────────────────────────────────────────────────
// Actualiza el stock mínimo de un producto específico del inventario.
// Permite que el admin configure a partir de qué cantidad un producto "entra en alerta".
// Ruta: PUT /api/ciclo3/stock-minimo
// actualizarStockMinimo(id_producto, stock_minimo) [PUT /api/ciclo3/stock-minimo]
async function updateStockMinimo(req, res) {
    const { id_producto, stock_minimo } = req.body; // qué producto y cuál es el nuevo mínimo
    try {
        // updateStockMinimo(id_producto, stock_minimo)
        await pool.query(
            'UPDATE inventario SET stock_minimo = $1 WHERE id_producto = $2',
            [stock_minimo, id_producto]
        );
        // respuestaOK(message) { success: true, message: "Stock mínimo actualizado correctamente." }
        res.json({ success: true, message: 'Mínimo actualizado.' });
    } catch (err) {
        // [alt error de BD] respuestaError(error_servidor) { success: false, message: "Error interno del servidor." }
        res.status(500).json({ success: false, message: err.message });
    }
}


// =============================================================================
// CU20 — RECORDATORIOS DE CITA POR GMAIL
// Busca citas pendientes/confirmadas de un día y manda emails de recordatorio.
// =============================================================================

// ── getCitasProximas ──────────────────────────────────────────────────────────
// Devuelve las citas de una fecha específica que estén Pendientes o Confirmadas.
// El frontend manda la fecha como parámetro ?fecha=2026-05-25
// Ruta: GET /api/ciclo3/citas-proximas?fecha=YYYY-MM-DD
// getCitasProximas(fecha) [GET /api/ciclo3/citas-proximas?fecha=YYYY-MM-DD]
async function getCitasProximas(req, res) {
    const { fecha } = req.query; // la fecha viene como parámetro en la URL
    try {
        // Si no mandaron fecha, usar el día de hoy
        const fechaBusqueda = fecha || new Date().toISOString().split('T')[0];

        // obtenerCitasProximas(fecha)
        const r = await pool.query(`
            SELECT r.id_cita,
                   r.fecha::text AS fecha_cita,           -- convertir a texto para que JSON lo lea bien
                   r.hora::text  AS hora_inicio,
                   r.estado,
                   u.nombre AS nombre_cliente,
                   u.email  AS email_cliente,             -- necesario para mandar el correo
                   u.ci     AS ci_cliente,
                   STRING_AGG(DISTINCT s.nombre_servicio, ', ') AS servicios
            FROM reservas r
            JOIN clientes cl  ON r.id_cliente = cl.id_cliente   -- reservas usa id_cliente, no ci_usuario
            JOIN usuarios u   ON cl.ci_usuario = u.ci
            LEFT JOIN detalle_reserva dr ON dr.id_cita = r.id_cita
            LEFT JOIN servicios s        ON s.id_servicio = dr.id_servicio
            WHERE r.fecha = $1
              AND r.estado IN ('Pendiente', 'Confirmada')
            GROUP BY r.id_cita, r.fecha, r.hora, r.estado, u.nombre, u.email, u.ci
            ORDER BY r.hora
        `, [fechaBusqueda]);

        // citas_proximas[] (lista de citas con datos del cliente)
        // respuestaOK(citas[]) [200 OK]
        res.json({ success: true, citas: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ── enviarRecordatorios ───────────────────────────────────────────────────────
// Envía un correo de recordatorio a cada cliente de la lista recibida.
// El frontend manda el array de citas ya filtrado (solo las que el admin seleccionó).
// Ruta: POST /api/ciclo3/recordatorios
// enviarRecordatorios(citas[], ci_admin, nombre_admin, rol_admin) [POST /api/ciclo3/enviar-recordatorios]
async function enviarRecordatorios(req, res) {
    // citas → lista de citas con email del cliente, nombre, fecha y hora
    const { citas, ci_admin, nombre_admin, rol_admin } = req.body;

    let enviados = 0; // contador de correos exitosos
    let errores  = 0; // contador de correos fallidos

    // loop [Por cada cita en citas[]]
    for (const cita of (citas || [])) {
        // if (cita.email_cliente vacío) → omitirCita() (incrementar errores)
        if (!cita.email_cliente) { errores++; continue; }

        try {
            // enviarEmail(cita.email_cliente, cita.fecha_cita, cita.hora_inicio, cita.servicios, ci_admin, nombre_admin, rol_admin)
            // sendMail(to, subject, html)
            await transporter.sendMail({
                from:    '"Salón HISAMI" <no-reply@hisami.com>', // quién envía (nombre visible)
                to:      cita.email_cliente,                      // destinatario
                subject: 'Recordatorio de tu cita en HISAMI',
                html: `
                    <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
                        <h2 style="color:#d4a373;">¡Hola, ${cita.nombre_cliente}!</h2>
                        <p>Te recordamos que tienes una cita programada en <strong>Salón de Belleza HISAMI</strong>:</p>
                        <div style="background:#f9f9f9;padding:15px;border-radius:8px;border:1px solid #ddd;margin:20px 0;">
                            <p><strong>Fecha:</strong> ${cita.fecha_cita}</p>
                            <p><strong>Hora:</strong> ${cita.hora_inicio}</p>
                            <p><strong>Servicios:</strong> ${cita.servicios || 'Por confirmar'}</p>
                        </div>
                        <p>¡Te esperamos puntual!</p>
                        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                        <p style="font-size:12px;color:#999;">Correo automático — no respondas este mensaje.</p>
                    </div>`
            });
            // envioExitoso() → incrementarEnviados() (enviados = enviados + 1)
            enviados++;
        } catch (err) {
            // Si el correo de UNA cita falla, seguir con las demás (no detener todo)
            console.error('❌ Error recordatorio a', cita.email_cliente, err.message);
            errores++;
        }
    }

    // Registrar en bitácora cuántos se enviaron y cuántos fallaron
    await registrarEvento(ci_admin, nombre_admin, rol_admin,
        'CU20_RECORDATORIO',
        `Recordatorios enviados: ${enviados}, errores: ${errores}`,
        enviados > 0 ? 'Exitoso' : 'Fallido');

    // respuestaOK(enviados, errores) [200 OK]
    // [alt Error al procesar la solicitud] → errores individuales se acumulan en errores++ dentro del loop; no hay catch externo
    res.json({ success: true, enviados, errores });
}


// =============================================================================
// CU21 — WHATSAPP EMPRESARIAL
// Genera un enlace wa.me para abrir WhatsApp con un mensaje pre-escrito.
// No envía el mensaje automáticamente — abre la app/web de WhatsApp para que
// el admin lo confirme y lo mande manualmente.
// =============================================================================

// ── getClientesConTelefono ────────────────────────────────────────────────────
// Devuelve la lista de clientes que tienen número de teléfono registrado.
// Solo clientes con teléfono porque sin número no se puede mandar WhatsApp.
// Ruta: GET /api/ciclo3/clientes-telefono
// getClientesConTelefono() [GET /api/ciclo3/clientes-telefono]
async function getClientesConTelefono(req, res) {
    try {
        // obtenerClientesConTelefono()
        const r = await pool.query(`
            SELECT u.ci, u.nombre, u.telefono, u.email
            FROM usuarios u
            JOIN roles ro ON u.id_rol = ro.id_rol
            WHERE ro.nombre = 'Cliente'
              AND u.telefono IS NOT NULL   -- descartar los que no tienen teléfono
              AND u.telefono <> ''         -- descartar los que tienen teléfono vacío
            ORDER BY u.nombre
        `);
        // clientes[] (lista de clientes con teléfono)
        // respuestaOK(clientes[]) [200 OK]
        res.json({ success: true, clientes: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ── prepararWhatsApp ──────────────────────────────────────────────────────────
// Arma el enlace wa.me con el número y el mensaje codificado.
// wa.me es el servicio oficial de WhatsApp para abrir conversaciones por enlace.
// Formato: https://wa.me/591NUMERO?text=MENSAJE_CODIFICADO
// Ruta: POST /api/ciclo3/whatsapp
// prepararMensaje(numero, mensaje, ci_admin, nombre_admin, rol_admin) [POST /api/ciclo3/whatsapp]
async function prepararWhatsApp(req, res) {
    const { numero, mensaje, ci_admin, nombre_admin, rol_admin } = req.body;
    try {
        // [alt Número o mensaje faltante] respuestaError("Número y mensaje son requeridos.") [400 Bad Request]
        if (!numero || !mensaje)
            return res.status(400).json({ success: false, message: 'Número y mensaje son requeridos.' });

        // Limpiar el número: eliminar todo lo que no sea dígito (espacios, guiones, paréntesis)
        const tel = String(numero).replace(/\D/g, '');

        // generarEnlaceWA(numero, mensaje)
        // url = "https://wa.me/591" + numero + "?text=" + encodeURIComponent(mensaje)
        const url = `https://wa.me/591${tel}?text=${encodeURIComponent(mensaje)}`;

        // Registrar en bitácora que se preparó un mensaje
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU21_WHATSAPP', `Mensaje WhatsApp preparado para +591${tel}`, 'Exitoso');

        // url_generada (enlace wa.me)
        // respuestaOK(url) [200 OK]
        res.json({ success: true, url });
    } catch (err) {
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU21_WHATSAPP', `Error WhatsApp para: ${numero}`, 'Fallido');
        // [Error interno del servidor] respuestaError("Error al generar enlace.") [500 Internal Server Error]
        res.status(500).json({ success: false, message: err.message });
    }
}


// =============================================================================
// CU23 — GESTIONAR CONSUMO POR SERVICIO (RECETA/FÓRMULA)
// Permite ver qué servicios tienen receta configurada y descontar los insumos
// del inventario cuando se realiza un servicio.
// =============================================================================

// ── getServiciosConReceta ─────────────────────────────────────────────────────
// Lista todos los servicios activos junto con cuántos insumos tiene su receta.
// Si total_insumos = 0, el servicio no tiene receta configurada todavía.
// Ruta: GET /api/ciclo3/servicios-receta
// 2. GET /api/ciclo3/servicios-receta
async function getServiciosConReceta(req, res) {
    try {
        // 3. SELECT s.id, s.nombre, COUNT(u.id_producto) AS cantidad_insumos FROM servicios s LEFT JOIN utiliza u ON s.id = u.id_servicio WHERE s.activo = true GROUP BY s.id, s.nombre ORDER BY s.nombre ASC
        const r = await pool.query(`
            SELECT s.id_servicio,
                   s.nombre_servicio AS nombre,            -- la columna real se llama nombre_servicio
                   COUNT(u.id_producto) AS total_insumos  -- contar cuántos insumos tiene la receta
            FROM servicios s
            LEFT JOIN utiliza u ON u.id_servicio = s.id_servicio
            WHERE s.estado = 'Activo'  -- servicios usa estado texto, no columna booleana activo
            GROUP BY s.id_servicio, s.nombre_servicio
            ORDER BY s.nombre_servicio
        `);
        // 4. lista_servicios_con_receta [{id_servicio, nombre, cantidad_insumos}, ...]
        // 5. 200 OK { success: true, servicios: [...] }
        res.json({ success: true, servicios: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ── descontarConsumo ──────────────────────────────────────────────────────────
// Descuenta los insumos de la receta del servicio del stock del inventario.
// Pasos:
//   1. Leer la receta del servicio (tabla utiliza)
//   2. Verificar que haya suficiente stock de cada insumo
//   3. Si alcanza para todo, descontar → si no, rechazar con mensaje de error
// Usa transacción para que si falla algún descuento, no se descuente ninguno.
// Ruta: POST /api/ciclo3/consumo/descontar
// 2. POST /api/ciclo3/consumo/descontar { id_servicio }
async function descontarConsumo(req, res) {
    const { id_servicio, ci_admin, nombre_admin, rol_admin } = req.body;

    const client = await pool.connect(); // conexión dedicada para la transacción
    try {
        // 3. SELECT id_producto, cantidad FROM utiliza WHERE id_servicio = ?
        const receta = await client.query(`
            SELECT u.id_producto,
                   u.cantidad,                          -- cuánto se necesita según la receta
                   i.nombre AS nombre_insumo,
                   i.cantidad AS stock_actual           -- cuánto hay actualmente en el inventario
            FROM utiliza u
            JOIN inventario i ON i.id_producto = u.id_producto
            WHERE u.id_servicio = $1
        `, [id_servicio]);
        // 4. lista_insumos [{id_producto, cantidad}, ...]

        // Si la receta está vacía, no se puede descontar nada
        if (!receta.rows.length)
            return res.status(400).json({
                success: false,
                message: 'Este servicio no tiene receta de insumos configurada.'
            });

        // Paso 2: Verificar stock suficiente para TODOS los insumos
        // Filtrar los insumos donde stock_actual < cantidad_necesaria
        const sinStock = receta.rows.filter(r => Number(r.stock_actual) < Number(r.cantidad));
        if (sinStock.length) {
            const nombres = sinStock.map(r => r.nombre_insumo).join(', ');
            // [alt Stock insuficiente en algún insumo] 7c. 400 Bad Request { success: false, message: "Stock insuficiente para: [producto]" }
            return res.status(400).json({
                success: false,
                message: `Stock insuficiente para: ${nombres}`
            });
        }

        // [alt Stock suficiente en todos los insumos]
        await client.query('BEGIN');
        // 5. loop [Por cada insumo en lista_insumos] UPDATE inventario SET cantidad = cantidad - ? WHERE id_producto = ?
        for (const item of receta.rows) {
            await client.query(
                'UPDATE inventario SET cantidad = cantidad - $1 WHERE id_producto = $2',
                [item.cantidad, item.id_producto]
            );
        }
        // 6. filas_actualizadas
        await client.query('COMMIT');

        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU23_CONSUMO', `Insumos descontados — servicio ID: ${id_servicio}`, 'Exitoso');

        // 7a. 200 OK { success: true, mensaje: "Consumo descontado", descontados: N }
        res.json({ success: true, message: 'Insumos descontados correctamente.', insumos: receta.rows });
    } catch (err) {
        await client.query('ROLLBACK'); // si algo falla, revertir todo
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU23_CONSUMO', `Error al descontar consumo servicio: ${id_servicio}`, 'Fallido');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release(); // siempre liberar la conexión
    }
}


// =============================================================================
// EXPORTAR — hacer que todas las funciones estén disponibles para el router
// Cada nombre aquí debe coincidir exactamente con lo que usa ciclo3.routes.js
// =============================================================================
module.exports = {
    getPreferencias,          // CU6: leer preferencias
    setPreferencias,          // CU6: guardar preferencias
    getHistorialPreferencias, // CU6: historial completo de cambios
    getKit,              // CU14: leer kit del esteticista
    setKit,              // CU14: guardar kit
    getAlertasStock,     // CU15: productos con poco stock
    updateStockMinimo,   // CU15: cambiar el mínimo de un producto
    getCitasProximas,    // CU20: citas del día para recordatorios
    enviarRecordatorios, // CU20: mandar los correos
    getClientesConTelefono, // CU21: lista de clientes con teléfono
    prepararWhatsApp,    // CU21: generar enlace wa.me
    getServiciosConReceta,  // CU23: servicios con/sin receta
    descontarConsumo     // CU23: descontar insumos del stock
};
