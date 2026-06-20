// CU20 — Recordatorios de Cita por Gmail
const pool            = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');
const { transporter }     = require('../../config/mailer');

// GET /api/ciclo3/citas-proximas?fecha=YYYY-MM-DD
async function getCitasProximas(req, res) {
    const { fecha } = req.query;
    try {
        const fechaBusqueda = fecha || new Date().toISOString().split('T')[0];
        const r = await pool.query(`
            SELECT r.id_cita,
                   r.fecha::text AS fecha_cita,
                   r.hora::text  AS hora_inicio,
                   r.estado,
                   u.nombre AS nombre_cliente,
                   u.email  AS email_cliente,
                   u.ci     AS ci_cliente,
                   STRING_AGG(DISTINCT s.nombre_servicio, ', ') AS servicios
            FROM reservas r
            JOIN clientes cl  ON r.id_cliente = cl.id_cliente
            JOIN usuarios u   ON cl.ci_usuario = u.ci
            LEFT JOIN detalle_reserva dr ON dr.id_cita = r.id_cita
            LEFT JOIN servicios s        ON s.id_servicio = dr.id_servicio
            WHERE r.fecha = $1
              AND r.estado IN ('Pendiente', 'Confirmada')
            GROUP BY r.id_cita, r.fecha, r.hora, r.estado, u.nombre, u.email, u.ci
            ORDER BY r.hora
        `, [fechaBusqueda]);
        res.json({ success: true, citas: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/ciclo3/recordatorios
async function enviarRecordatorios(req, res) {
    const { citas, ci_admin, nombre_admin, rol_admin } = req.body;
    let enviados = 0;
    let errores  = 0;

    for (const cita of (citas || [])) {
        if (!cita.email_cliente) { errores++; continue; }
        try {
            await transporter.sendMail({
                from:    '"Salón HISAMI" <no-reply@hisami.com>',
                to:      cita.email_cliente,
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
            enviados++;
        } catch (err) {
            console.error('❌ Error recordatorio a', cita.email_cliente, err.message);
            errores++;
        }
    }

    await registrarEvento(ci_admin, nombre_admin, rol_admin,
        'CU20_RECORDATORIO',
        `Recordatorios enviados: ${enviados}, errores: ${errores}`,
        enviados > 0 ? 'Exitoso' : 'Fallido');

    res.json({ success: true, enviados, errores });
}

module.exports = { getCitasProximas, enviarRecordatorios };
