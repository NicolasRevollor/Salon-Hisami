// CU21 — WhatsApp Empresarial
const pool            = require('../../config/db');
const { registrarEvento } = require('../bitacora.controller');

// GET /api/ciclo3/clientes-telefono
async function getClientesConTelefono(req, res) {
    try {
        const r = await pool.query(`
            SELECT u.ci, u.nombre, u.telefono, u.email
            FROM usuarios u
            JOIN roles ro ON u.id_rol = ro.id_rol
            WHERE ro.nombre = 'Cliente'
              AND u.telefono IS NOT NULL
              AND u.telefono <> ''
            ORDER BY u.nombre
        `);
        res.json({ success: true, clientes: r.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/ciclo3/whatsapp
async function prepararWhatsApp(req, res) {
    const { numero, mensaje, ci_admin, nombre_admin, rol_admin } = req.body;
    try {
        if (!numero || !mensaje)
            return res.status(400).json({ success: false, message: 'Número y mensaje son requeridos.' });

        const tel = String(numero).replace(/\D/g, '');
        const url = `https://wa.me/591${tel}?text=${encodeURIComponent(mensaje)}`;

        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU21_WHATSAPP', `Mensaje WhatsApp preparado para +591${tel}`, 'Exitoso');
        res.json({ success: true, url });
    } catch (err) {
        await registrarEvento(ci_admin, nombre_admin, rol_admin,
            'CU21_WHATSAPP', `Error WhatsApp para: ${numero}`, 'Fallido');
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getClientesConTelefono, prepararWhatsApp };
