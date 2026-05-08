// =============================================================================
// controllers/reservas.controller.js — RESERVAS DE CITAS
//
// Maneja todo el flujo de reservar una cita:
//   1. Buscar esteticistas disponibles según el servicio o paquete elegido
//   2. Consultar horas ocupadas de una esteticista en una fecha
//   3. Verificar disponibilidad PUNTUAL (para el botón "Revisar Disponibilidad")
//   4. Crear la(s) reserva(s) en la BD con su detalle y pago
//   5. Ver reservas del cliente (panel "Mis Citas")
//   6. Ver reservas de la esteticista (panel Personal)
//   7. Cancelar una reserva y notificar por correo
//
// Funciones exportadas:
//   getEsteticistas         → GET /api/esteticistas
//   getHorasDisponibles     → GET /api/horas-disponibles
//   verificarDisponibilidad → GET /api/verificar-disponibilidad
//   crearReserva            → POST /api/reservas
//   getReservasCliente      → GET /api/reservas/cliente/:ci
//   getReservasEsteticista  → GET /api/reservas/esteticista/:ci
//   cancelarReserva         → DELETE /api/reservas/:id_cita
// =============================================================================

const pool        = require('../config/db');
const { transporter } = require('../config/mailer');
const { registrarEvento } = require('./bitacora.controller');

// Todas las horas posibles de atención del salón (usadas en varios lugares)
const TODAS_HORAS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

// Agrega la columna reprogramaciones a reservas si no existe (migración automática)
async function initReservas() {
    try {
        await pool.query(`ALTER TABLE reservas ADD COLUMN IF NOT EXISTS reprogramaciones INTEGER DEFAULT 0`);
        console.log('✅ Columna reprogramaciones lista');
    } catch (err) {
        console.error('❌ Error migrando reservas:', err.message);
    }
}
initReservas();

// =============================================================================
// GET /api/esteticistas
// Devuelve las esteticistas activas filtradas por su especialidad:
//   ?id_servicio=X → filtra por la categoría del servicio elegido
//   ?id_paquete=X  → filtra por las categorías de todos los servicios del paquete
//   (sin parámetros) → devuelve todas las activas
//
// Si el filtro no encuentra coincidencias, devuelve TODAS como fallback.
// =============================================================================
async function getEsteticistas(req, res) {
    const { id_servicio, id_paquete } = req.query;

    // Query de fallback: todas las esteticistas activas sin importar especialidad
    const queryTodas = `
        SELECT u.ci, u.nombre, STRING_AGG(e.nombre_especialidad, ', ') AS especialidades
        FROM personal p
        JOIN usuarios u ON p.ci_usuario = u.ci
        LEFT JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
        LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
        WHERE p.estado = 'Activo'
        GROUP BY u.ci, u.nombre
        ORDER BY u.nombre`;

    try {
        let result;

        if (id_paquete) {
            // Filtra esteticistas cuya especialidad COINCIDE con la categoría de algún
            // servicio incluido en el paquete. Usa EXISTS para buscar en detalle_paquete.
            result = await pool.query(`
                SELECT DISTINCT u.ci, u.nombre,
                       STRING_AGG(DISTINCT e.nombre_especialidad, ', ') AS especialidades
                FROM personal p
                JOIN usuarios u ON p.ci_usuario = u.ci
                JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
                JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
                WHERE p.estado = 'Activo'
                  AND EXISTS (
                    SELECT 1
                    FROM detalle_paquete dp
                    JOIN servicios s ON dp.id_servicio = s.id_servicio
                    JOIN categoria c ON s.id_categoria = c.id_categoria
                    WHERE dp.id_paquete = $1
                      AND LOWER(e.nombre_especialidad) ILIKE '%' || LOWER(c.nombre) || '%'
                  )
                GROUP BY u.ci, u.nombre
                ORDER BY u.nombre
            `, [id_paquete]);
            // Si nadie tiene la especialidad exacta, devolver todas (mejor experiencia)
            if (!result.rows.length) result = await pool.query(queryTodas);

        } else if (id_servicio) {
            // Filtra por la categoría del servicio específico elegido
            result = await pool.query(`
                SELECT DISTINCT u.ci, u.nombre,
                       STRING_AGG(DISTINCT e.nombre_especialidad, ', ') AS especialidades
                FROM personal p
                JOIN usuarios u ON p.ci_usuario = u.ci
                JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
                JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
                JOIN servicios s ON s.id_servicio = $1
                JOIN categoria c ON s.id_categoria = c.id_categoria
                WHERE p.estado = 'Activo'
                  AND LOWER(e.nombre_especialidad) ILIKE '%' || LOWER(c.nombre) || '%'
                GROUP BY u.ci, u.nombre
                ORDER BY u.nombre
            `, [id_servicio]);
            if (!result.rows.length) result = await pool.query(queryTodas);

        } else {
            result = await pool.query(queryTodas);
        }

        res.json({ success: true, esteticistas: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// GET /api/horas-disponibles?ci_esteticista=&fecha=
// Devuelve las horas LIBRES de una esteticista en una fecha dada.
// Se usa de forma informativa (el frontend no bloquea horas, solo informa).
// =============================================================================
async function getHorasDisponibles(req, res) {
    const { ci_esteticista, fecha } = req.query;
    try {
        // Buscar el id_esteticista a partir del CI (número de cédula)
        const pers = await pool.query(
            'SELECT id_esteticista FROM personal WHERE ci_usuario = $1',
            [ci_esteticista]
        );
        if (!pers.rows.length) {
            return res.json({ success: true, horas: TODAS_HORAS }); // si no existe, devolver todas
        }
        const id_est = pers.rows[0].id_esteticista;

        // Buscar las horas YA reservadas (excluir las canceladas — esas vuelven a estar libres)
        const ocupadas = await pool.query(
            `SELECT hora FROM reservas WHERE id_esteticista = $1 AND fecha = $2 AND estado != 'Cancelada'`,
            [id_est, fecha]
        );
        const horasOcupadas = ocupadas.rows.map(r => (r.hora || '').substring(0, 5));
        const horasLibres   = TODAS_HORAS.filter(h => !horasOcupadas.includes(h));

        res.json({ success: true, horas: horasLibres });
    } catch {
        // En caso de error de BD, devolver todas las horas para no bloquear al usuario
        res.json({ success: true, horas: TODAS_HORAS });
    }
}

// =============================================================================
// GET /api/verificar-disponibilidad?ci_esteticista=&fecha=&hora=
// Verifica si una esteticista está LIBRE en un horario PUNTUAL.
// El frontend lo llama al presionar "Revisar Disponibilidad".
// Responde: { disponible: true } o { disponible: false }
// =============================================================================
async function verificarDisponibilidad(req, res) {
    const { ci_esteticista, fecha, hora } = req.query;
    try {
        const pers = await pool.query(
            'SELECT id_esteticista FROM personal WHERE ci_usuario = $1',
            [ci_esteticista]
        );
        if (!pers.rows.length) {
            return res.json({ success: true, disponible: true }); // no existe → asumir libre
        }
        const id_est = pers.rows[0].id_esteticista;

        // Buscar si hay alguna reserva activa en exactamente ese día y esa hora
        const result = await pool.query(
            `SELECT id_cita FROM reservas
             WHERE id_esteticista = $1 AND fecha = $2 AND hora = $3 AND estado != 'Cancelada'`,
            [id_est, fecha, hora]
        );
        // disponible=true si NO encontró ninguna reserva (array vacío)
        res.json({ success: true, disponible: result.rows.length === 0 });
    } catch {
        res.json({ success: true, disponible: true }); // en caso de error, asumir libre
    }
}

// =============================================================================
// POST /api/reservas
// Crea una o varias reservas.
// Soporta 1 esteticista (servicio individual) o varias (paquete con múltiples esteticistas).
//
// Por cada esteticista seleccionada crea:
//   - 1 fila en `reservas`
//   - N filas en `detalle_reserva` (uno por servicio)
//   - 1 fila en `pagos`
//
// Si cualquier esteticista ya tiene choque de horario → ROLLBACK de todo.
// =============================================================================
async function crearReserva(req, res) {
    const { ci_cliente, ci_esteticista, ci_esteticistas, id_servicio, id_paquete, fecha, hora, metodo_pago } = req.body;

    // Normalizar siempre a un array de CIs, sin importar cómo llegó el dato
    const ciEstArr = ci_esteticistas
        ? (Array.isArray(ci_esteticistas) ? ci_esteticistas : [ci_esteticistas])
        : (ci_esteticista ? [ci_esteticista] : []);

    if (!ci_cliente || !ciEstArr.length || !fecha || !hora || !metodo_pago) {
        return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Resolver el id_cliente a partir del CI del usuario logueado
        const clRes = await client.query(
            'SELECT id_cliente FROM clientes WHERE ci_usuario = $1',
            [ci_cliente]
        );
        if (!clRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
        }
        const id_cliente = clRes.rows[0].id_cliente;

        // Calcular el monto una sola vez (es el mismo para todas las reservas del paquete)
        let monto = 0;
        if (id_servicio) {
            const pr = await client.query('SELECT precio FROM servicios WHERE id_servicio = $1', [id_servicio]);
            monto = parseFloat(pr.rows[0]?.precio || 0);
        } else if (id_paquete) {
            const pr = await client.query('SELECT precio_promocional FROM paquetes WHERE id_paquete = $1', [id_paquete]);
            monto = parseFloat(pr.rows[0]?.precio_promocional || 0);
        }

        // Crear una reserva por cada esteticista seleccionada
        for (const ci_est of ciEstArr) {
            const perRes = await client.query(
                'SELECT id_esteticista FROM personal WHERE ci_usuario = $1',
                [ci_est]
            );
            if (!perRes.rows.length) continue; // saltar si el CI no corresponde a personal

            const id_esteticista = perRes.rows[0].id_esteticista;

            // Verificar que no haya choque de horario ANTES de insertar
            const check = await client.query(
                `SELECT id_cita FROM reservas
                 WHERE id_esteticista = $1 AND fecha = $2 AND hora = $3 AND estado != 'Cancelada'`,
                [id_esteticista, fecha, hora]
            );
            if (check.rows.length > 0) {
                await client.query('ROLLBACK');
                const nomRes = await pool.query('SELECT nombre FROM usuarios WHERE ci = $1', [ci_est]);
                const nom = nomRes.rows[0]?.nombre || ci_est;
                return res.status(409).json({
                    success: false,
                    message: `${nom} ya tiene una reserva en ese horario. Elige otra hora.`
                });
            }

            // Insertar la reserva con estado inicial 'Pendiente'
            const resR = await client.query(
                `INSERT INTO reservas (id_cliente, id_esteticista, fecha, hora, estado)
                 VALUES ($1, $2, $3, $4, 'Pendiente')
                 RETURNING id_cita`,
                [id_cliente, id_esteticista, fecha, hora]
            );
            const id_cita = resR.rows[0].id_cita;

            // Insertar el detalle (qué servicios incluye esta reserva)
            if (id_servicio) {
                await client.query(
                    'INSERT INTO detalle_reserva (id_cita, id_servicio) VALUES ($1, $2)',
                    [id_cita, id_servicio]
                );
            } else if (id_paquete) {
                // Para paquetes: insertar TODOS los servicios que forman el paquete
                const srvs = await client.query(
                    'SELECT id_servicio FROM detalle_paquete WHERE id_paquete = $1',
                    [id_paquete]
                );
                for (const s of srvs.rows) {
                    await client.query(
                        'INSERT INTO detalle_reserva (id_cita, id_servicio) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [id_cita, s.id_servicio]
                    );
                }
            }

            // Registrar el pago asociado a esta reserva
            await client.query(
                'INSERT INTO pagos (id_cita, monto, metodo_pago) VALUES ($1, $2, $3)',
                [id_cita, monto, metodo_pago]
            );
        }

        await client.query('COMMIT');
        const n = ciEstArr.length;

        // Registrar en bitácora
        const clInfoRes = await pool.query('SELECT nombre, rol FROM usuarios WHERE ci = $1', [ci_cliente]);
        const clInfo = clInfoRes.rows[0];
        registrarEvento(
            ci_cliente, clInfo?.nombre, clInfo?.rol,
            'CREAR_RESERVA',
            `Reserva para ${fecha} a las ${hora} — ${n > 1 ? n + ' esteticistas' : 'esteticista CI: ' + ciEstArr[0]}`
        );

        res.json({
            success: true,
            message: `¡${n > 1 ? n + ' reservas creadas' : 'Reserva creada'} exitosamente!`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: 'Error al guardar: ' + err.message });
    } finally {
        client.release();
    }
}

// =============================================================================
// PUT /api/reservas/:id_cita
// Reprograma una reserva cambiando su fecha y hora.
// Verifica que la esteticista esté libre en el nuevo horario antes de actualizar.
// Recibe: { fecha, hora, ci_usuario, nombre_usuario, rol }
// =============================================================================
async function editarReserva(req, res) {
    const { id_cita } = req.params;
    const { fecha, hora, ci_usuario, nombre_usuario, rol } = req.body;

    if (!fecha || !hora) {
        return res.status(400).json({ success: false, message: 'Fecha y hora son obligatorias.' });
    }

    try {
        const r = await pool.query(
            'SELECT id_esteticista, reprogramaciones FROM reservas WHERE id_cita = $1',
            [id_cita]
        );
        if (!r.rows.length) {
            return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });
        }
        const { id_esteticista, reprogramaciones } = r.rows[0];

        // Solo se permite reprogramar una vez
        if (reprogramaciones >= 1) {
            return res.status(403).json({
                success: false,
                message: 'Esta reserva ya fue reprogramada una vez. No se puede volver a reprogramar.'
            });
        }

        // Verificar conflicto de horario (excluyendo esta misma reserva)
        const check = await pool.query(
            `SELECT id_cita FROM reservas
             WHERE id_esteticista = $1 AND fecha = $2 AND hora = $3
               AND estado != 'Cancelada' AND id_cita != $4`,
            [id_esteticista, fecha, hora, id_cita]
        );
        if (check.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'La esteticista ya tiene una reserva en ese nuevo horario. Elige otra hora.'
            });
        }

        await pool.query(
            'UPDATE reservas SET fecha = $1, hora = $2, reprogramaciones = reprogramaciones + 1 WHERE id_cita = $3',
            [fecha, hora, id_cita]
        );

        registrarEvento(
            ci_usuario, nombre_usuario, rol,
            'EDITAR_RESERVA',
            `Reserva #${id_cita} reprogramada a ${fecha} a las ${hora}`
        );

        res.json({ success: true, message: 'Reserva reprogramada exitosamente.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// GET /api/reservas/cliente/:ci
// Devuelve todas las reservas de un cliente para el panel "Mis Citas".
// Hace JOIN de 5 tablas para reunir toda la información en una sola consulta.
// Ordenadas de más reciente a más antigua.
// =============================================================================
async function getReservasCliente(req, res) {
    try {
        const result = await pool.query(`
            SELECT r.id_cita, r.fecha, r.hora, r.estado, r.reprogramaciones,
                   STRING_AGG(s.nombre_servicio, ', ') AS nombre_item,
                   ue.nombre AS nombre_esteticista,
                   pe.ci_usuario AS ci_esteticista,
                   STRING_AGG(DISTINCT e.nombre_especialidad, ', ') AS especialidades,
                   pg.metodo_pago, pg.monto
            FROM reservas r
            JOIN clientes cl ON r.id_cliente = cl.id_cliente
            JOIN personal pe ON r.id_esteticista = pe.id_esteticista
            JOIN usuarios ue ON pe.ci_usuario = ue.ci
            LEFT JOIN personal_especialidades pse ON pe.id_esteticista = pse.id_esteticista
            LEFT JOIN especialidades e ON pse.id_especialidad = e.id_especialidad
            LEFT JOIN detalle_reserva dr ON r.id_cita = dr.id_cita
            LEFT JOIN servicios s ON dr.id_servicio = s.id_servicio
            LEFT JOIN pagos pg ON r.id_cita = pg.id_cita
            WHERE cl.ci_usuario = $1
            GROUP BY r.id_cita, r.fecha, r.hora, r.estado, r.reprogramaciones,
                     ue.nombre, pe.ci_usuario, pg.metodo_pago, pg.monto
            ORDER BY r.fecha DESC, r.hora DESC
        `, [req.params.ci]);

        res.json({ success: true, reservas: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// GET /api/reservas/esteticista/:ci
// Devuelve las reservas asignadas a la esteticista con ese CI.
// Se usa en el panel Personal, pestaña "Mis Reservas".
// Ordenadas de más próxima a más lejana (ascendente).
// =============================================================================
async function getReservasEsteticista(req, res) {
    try {
        const result = await pool.query(`
            SELECT r.id_cita, r.fecha, r.hora, r.estado,
                   STRING_AGG(s.nombre_servicio, ', ') AS nombre_item,
                   uc.nombre AS nombre_cliente,
                   pg.metodo_pago, pg.monto
            FROM reservas r
            JOIN personal pe ON r.id_esteticista = pe.id_esteticista
            JOIN clientes cl ON r.id_cliente = cl.id_cliente
            JOIN usuarios uc ON cl.ci_usuario = uc.ci
            LEFT JOIN detalle_reserva dr ON r.id_cita = dr.id_cita
            LEFT JOIN servicios s ON dr.id_servicio = s.id_servicio
            LEFT JOIN pagos pg ON r.id_cita = pg.id_cita
            WHERE pe.ci_usuario = $1
            GROUP BY r.id_cita, r.fecha, r.hora, r.estado, uc.nombre, pg.metodo_pago, pg.monto
            ORDER BY r.fecha ASC, r.hora ASC
        `, [req.params.ci]);

        res.json({ success: true, reservas: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// DELETE /api/reservas/:id_cita
// Cancela (elimina) una reserva:
//   1. Obtiene todos los datos para los correos ANTES de borrar
//   2. Borra la reserva de la BD (cascada elimina detalle_reserva y pagos)
//   3. Envía correos al cliente y a la esteticista (en segundo plano)
// =============================================================================
async function cancelarReserva(req, res) {
    const { id_cita } = req.params;
    try {
        // Paso 1: recopilar datos de la reserva ANTES de borrarla (ya no existirá después)
        const infoRes = await pool.query(`
            SELECT uc.email AS email_cliente, uc.nombre AS nombre_cliente,
                   ue.email AS email_esteticista, ue.nombre AS nombre_esteticista,
                   r.fecha, r.hora,
                   STRING_AGG(s.nombre_servicio, ', ') AS servicios
            FROM reservas r
            JOIN clientes cl ON r.id_cliente = cl.id_cliente
            JOIN usuarios uc ON cl.ci_usuario = uc.ci
            JOIN personal pe ON r.id_esteticista = pe.id_esteticista
            JOIN usuarios ue ON pe.ci_usuario = ue.ci
            LEFT JOIN detalle_reserva dr ON r.id_cita = dr.id_cita
            LEFT JOIN servicios s ON dr.id_servicio = s.id_servicio
            WHERE r.id_cita = $1
            GROUP BY uc.email, uc.nombre, ue.email, ue.nombre, r.fecha, r.hora
        `, [id_cita]);

        if (!infoRes.rows.length) {
            return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });
        }

        const info = infoRes.rows[0];

        // Formatear la fecha manualmente para evitar desfase de zona horaria
        // La BD devuelve algo como "2024-05-15T00:00:00.000Z" — tomamos solo los primeros 10 chars
        const fStr = String(info.fecha).substring(0, 10); // "2024-05-15"
        const [fy, fm, fd] = fStr.split('-');
        const meses = ['enero','febrero','marzo','abril','mayo','junio',
                       'julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const fechaLegible = `${parseInt(fd)} de ${meses[parseInt(fm) - 1]} de ${fy}`;
        const horaStr = (info.hora || '').substring(0, 5); // "14:30"

        // Paso 2: borrar la reserva (la cascada en FK elimina detalle_reserva y pagos automáticamente)
        await pool.query('DELETE FROM reservas WHERE id_cita = $1', [id_cita]);

        // Helper para construir el HTML del correo sin repetir código
        const htmlBase = (titulo, destinatario, cuerpo) => `
            <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
                <h2 style="color:#d4a373;">${titulo}</h2>
                <p>Hola <strong>${destinatario}</strong>,</p>
                ${cuerpo}
                <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
                <p style="font-size:12px;color:#999;">Correo automático — Salón de Belleza HISAMI</p>
            </div>`;

        // Paso 3a: notificar al CLIENTE (confirmación de cancelación)
        transporter.sendMail({
            from:    '"Salón HISAMI" <no-reply@hisami.com>',
            to:      info.email_cliente,
            subject: 'Tu reserva en HISAMI ha sido cancelada',
            html: htmlBase('Reserva Cancelada', info.nombre_cliente, `
                <p>Tu reserva ha sido cancelada exitosamente.</p>
                <div style="background:#f9f9f9;padding:15px;border-radius:8px;border:1px solid #ddd;margin:16px 0;">
                    <p><strong>Servicio(s):</strong> ${info.servicios || '—'}</p>
                    <p><strong>Fecha:</strong> ${fechaLegible}</p>
                    <p><strong>Hora:</strong> ${horaStr}</p>
                    <p><strong>Esteticista:</strong> ${info.nombre_esteticista}</p>
                </div>
                <p>¡Esperamos verte pronto en HISAMI!</p>`)
        }).catch(e => console.error('Error email cliente:', e.message));

        // Paso 3b: notificar a la ESTETICISTA (aviso de que su cita fue cancelada)
        transporter.sendMail({
            from:    '"Salón HISAMI" <no-reply@hisami.com>',
            to:      info.email_esteticista,
            subject: 'Aviso HISAMI: una reserva fue cancelada',
            html: htmlBase('Reserva Cancelada', info.nombre_esteticista, `
                <p>Una reserva asignada a ti ha sido cancelada por el cliente.</p>
                <div style="background:#f9f9f9;padding:15px;border-radius:8px;border:1px solid #ddd;margin:16px 0;">
                    <p><strong>Cliente:</strong> ${info.nombre_cliente}</p>
                    <p><strong>Servicio(s):</strong> ${info.servicios || '—'}</p>
                    <p><strong>Fecha:</strong> ${fechaLegible}</p>
                    <p><strong>Hora:</strong> ${horaStr}</p>
                </div>`)
        }).catch(e => console.error('Error email esteticista:', e.message));

        // Registrar en bitácora (con los datos que recopilamos ANTES de borrar)
        registrarEvento(
            null, info.nombre_cliente, 'Cliente',
            'CANCELAR_RESERVA',
            `Reserva #${id_cita} cancelada — ${info.servicios || '—'} el ${fechaLegible} a las ${horaStr} con ${info.nombre_esteticista}`
        );

        res.json({ success: true, message: 'Reserva cancelada. Se enviaron correos de notificación.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// PUT /api/reservas/:id_cita/completar
// El personal marca una cita como 'Finalizada'. Solo aplica a citas Pendiente/Confirmada.
// Recibe: { ci_usuario, nombre_usuario, rol }
// =============================================================================
async function completarReserva(req, res) {
    const { id_cita } = req.params;
    const { ci_usuario, nombre_usuario, rol } = req.body;
    try {
        const result = await pool.query(
            `UPDATE reservas SET estado = 'Finalizada'
             WHERE id_cita = $1 AND estado IN ('Pendiente', 'Confirmada')
             RETURNING id_cita`,
            [id_cita]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Reserva no encontrada o ya no puede completarse.' });
        }
        registrarEvento(
            ci_usuario, nombre_usuario, rol,
            'COMPLETAR_RESERVA',
            `Reserva #${id_cita} marcada como completada`
        );
        res.json({ success: true, message: 'Reserva marcada como completada.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// Exportar todas las funciones para que routes/reservas.routes.js las use
module.exports = {
    getEsteticistas,
    getHorasDisponibles,
    verificarDisponibilidad,
    crearReserva,
    editarReserva,
    completarReserva,
    getReservasCliente,
    getReservasEsteticista,
    cancelarReserva
};
