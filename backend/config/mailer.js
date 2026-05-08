// =============================================================================
// config/mailer.js — CONFIGURACIÓN DEL SERVICIO DE CORREO (Nodemailer)
//
// ¿Qué es Nodemailer?
//   Es una librería que permite enviar correos electrónicos desde Node.js.
//   Actúa como si fuera Outlook o Gmail pero controlado por código.
//
// ¿Qué necesita para funcionar con Gmail?
//   Una "contraseña de aplicación" (NO la contraseña normal de Gmail).
//   Se genera en: Cuenta Google → Seguridad → Verificación en 2 pasos → Contraseñas de app
//   Son 16 caracteres separados en grupos de 4 (ej: "abcd efgh ijkl mnop")
//
// ¿Qué se exporta desde este archivo?
//   transporter           → el objeto que sabe cómo conectarse a Gmail y enviar correos
//   enviarCorreoCredenciales → función lista para enviar bienvenida con usuario y contraseña
// =============================================================================

const nodemailer = require('nodemailer');

// =============================================================================
// TRANSPORTER — El "cartero" configurado para usar Gmail
// service: 'gmail' le dice a nodemailer que use los servidores de Google
// auth: las credenciales con las que se autentica ante Gmail
// =============================================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bmateo637@gmail.com', // correo de la cuenta que ENVÍA los mensajes
        pass: 'qzil wfif oulk tsax'  // contraseña de aplicación (16 chars, no es la contraseña normal)
    }
});

// =============================================================================
// enviarCorreoCredenciales
// Envía un correo de bienvenida con el email y contraseña al nuevo usuario.
// Se llama al registrar un cliente nuevo o al crear un empleado desde el admin.
//
// Parámetros:
//   emailDestino → dirección de correo del destinatario
//   nombre       → nombre de la persona (se usa en el saludo)
//   password     → contraseña inicial asignada (para que el usuario sepa cómo entrar)
//
// Nota: es async/await porque enviar un correo es una operación que tarda
//       y no queremos bloquear el servidor mientras espera.
// =============================================================================
async function enviarCorreoCredenciales(emailDestino, nombre, password) {
    try {
        await transporter.sendMail({
            from:    '"Salón HISAMI" <no-reply@hisami.com>', // remitente que ve el destinatario
            to:      emailDestino,                           // destinatario
            subject: '¡Bienvenido a HISAMI! - Tus credenciales de acceso',
            html: `
                <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
                    <h2 style="color:#d4a373;">¡Hola, ${nombre}!</h2>
                    <p>Tu cuenta ha sido registrada en <strong>Salón de Belleza HISAMI</strong>.</p>
                    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border:1px solid #ddd;margin:20px 0;">
                        <p><strong>Correo:</strong> ${emailDestino}</p>
                        <p><strong>Contraseña temporal:</strong> ${password}</p>
                    </div>
                    <p style="color:#666;font-size:12px;">Cambia tu contraseña al ingresar desde el panel de Configuración.</p>
                    <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
                    <p style="font-size:12px;color:#999;">Correo automático — no respondas este mensaje.</p>
                </div>`
        });
        console.log(`✉️  Correo de credenciales enviado a ${emailDestino}`);
    } catch (error) {
        // Si el correo falla, solo se anota en consola.
        // El registro del usuario YA fue exitoso — el correo es solo una notificación extra.
        console.error('❌ Error al enviar correo de credenciales:', error.message);
    }
}

// Exportar ambas cosas para que otros archivos las puedan usar con require()
module.exports = { transporter, enviarCorreoCredenciales };
