// =============================================================================
// controllers/auth.controller.js — CU1: INICIAR SESIÓN / CU2: CERRAR SESIÓN
//
// CU1 — Iniciar Sesión:
//   Verifica email + contraseña (hasheada con bcrypt) y retorna datos del usuario.
//   Sistema de bloqueo progresivo: 3 fallos=30s, 4=1min, 5+=2min.
//
// CU2 — Cerrar Sesión:
//   El servidor es stateless (no guarda sesión). El logout lo maneja solo el
//   frontend limpiando la variable usuarioActual.
//
// También maneja: registro de cliente, recuperar/cambiar contraseña, menú de CUs.
//
// Seguridad: contraseñas hasheadas con bcrypt (factor 10).
//   - NUNCA se guarda la contraseña en texto plano.
//   - bcrypt.hash() → genera el hash al registrar/cambiar.
//   - bcrypt.compare() → verifica al hacer login sin exponer la contraseña.
//
// Compatibilidad con contraseñas antiguas (texto plano en BD):
//   Si el hash almacenado NO empieza con '$2b$' (no es bcrypt), se compara
//   directo y si coincide, se hashea y actualiza automáticamente en la BD.
// =============================================================================

const pool   = require('../config/db');
const bcrypt = require('bcryptjs');
const { transporter, enviarCorreoCredenciales } = require('../config/mailer');
const { registrarEvento } = require('./bitacora.controller');

const SALT_ROUNDS = 10; // factor de costo de bcrypt (más alto = más seguro pero más lento)

// Estado en memoria (se pierde al reiniciar el servidor)
const intentosLogin    = new Map(); // email → { intentos, bloqueadoHasta }
const historialSesiones = [];       // últimos 50 logins exitosos

// =============================================================================
// CU1 — LOGIN
// POST /login → { email, contrasena }
// Soporta contraseñas hasheadas (bcrypt) Y contraseñas antiguas (texto plano).
// Si detecta una contraseña en texto plano y el login es correcto, la hashea
// automáticamente para migrarla sin que el usuario note nada.
// =============================================================================
async function login(req, res) {
    const { email, contrasena } = req.body;
    const ahora = Date.now();

    const estado = intentosLogin.get(email) || { intentos: 0, bloqueadoHasta: 0 };

    // Verificar si la cuenta sigue bloqueada
    if (ahora < estado.bloqueadoHasta) {
        const seg = Math.ceil((estado.bloqueadoHasta - ahora) / 1000);
        return res.status(429).json({
            success: false,
            message: `Cuenta bloqueada por seguridad. Espera ${seg} segundos.`
        });
    }

    try {
        // Buscar el usuario por email (solo email, verificamos la contraseña después)
        const result = await pool.query(
            'SELECT ci, nombre, rol, email, contrasena FROM usuarios WHERE email = $1',
            [email]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            const hashGuardado = user.contrasena;
            let passwordCorrecta = false;

            if (hashGuardado.startsWith('$2b$') || hashGuardado.startsWith('$2a$')) {
                // Contraseña ya hasheada con bcrypt → usar compare
                passwordCorrecta = await bcrypt.compare(contrasena, hashGuardado);
            } else {
                // Contraseña antigua en texto plano → comparar directo
                passwordCorrecta = (contrasena === hashGuardado);
                if (passwordCorrecta) {
                    // Migración automática: hashear y guardar en BD
                    const nuevoHash = await bcrypt.hash(contrasena, SALT_ROUNDS);
                    await pool.query('UPDATE usuarios SET contrasena = $1 WHERE email = $2', [nuevoHash, email]);
                    console.log(`🔐 Contraseña de ${email} migrada a bcrypt automáticamente`);
                }
            }

            if (passwordCorrecta) {
                intentosLogin.delete(email);
                historialSesiones.unshift({
                    nombre: user.nombre, email: user.email,
                    rol: user.rol, fecha: new Date().toLocaleString('es-BO')
                });
                if (historialSesiones.length > 50) historialSesiones.pop();
                // Registrar en bitácora (falla silenciosamente si la tabla no existe aún)
                registrarEvento(user.ci, user.nombre, user.rol, 'LOGIN', 'Inicio de sesión exitoso');
                // No enviar el hash de contraseña al frontend
                return res.json({ success: true, user: { ci: user.ci, nombre: user.nombre, rol: user.rol, email: user.email } });
            }
        }

        // Credenciales incorrectas → incrementar contador de intentos
        estado.intentos += 1;
        if (estado.intentos === 3) {
            estado.bloqueadoHasta = ahora + 30_000;
            intentosLogin.set(email, estado);
            return res.status(429).json({ success: false, message: 'Has fallado 3 veces. Cuenta bloqueada por 30 segundos.' });
        } else if (estado.intentos === 4) {
            estado.bloqueadoHasta = ahora + 60_000;
            intentosLogin.set(email, estado);
            return res.status(429).json({ success: false, message: 'Intento fallido. Cuenta bloqueada por 1 minuto.' });
        } else if (estado.intentos >= 5) {
            estado.bloqueadoHasta = ahora + 120_000;
            intentosLogin.set(email, estado);
            return res.status(429).json({ success: false, message: 'Intento fallido. Cuenta bloqueada por 2 minutos.' });
        } else {
            intentosLogin.set(email, estado);
            const restantes = 3 - estado.intentos;
            return res.status(401).json({ success: false, message: `Credenciales incorrectas. Te quedan ${restantes} intentos.` });
        }
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
}

// =============================================================================
// REGISTRO DE NUEVO CLIENTE — CU3 (iniciar proceso de reserva requiere cuenta)
// La contraseña se hashea con bcrypt ANTES de guardar en BD.
// CUs por defecto para Cliente: 1, 2, 3, 4, 5, 20, 21
// =============================================================================
async function registro(req, res) {
    const { ci, nombre, telefono, email, contrasena } = req.body;

    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(contrasena)) {
        return res.status(400).json({
            success: false,
            message: 'La contraseña debe tener al menos un NÚMERO, una MAYÚSCULA y un CARÁCTER ESPECIAL.'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Hashear la contraseña ANTES de guardar (nunca guardar texto plano)
        const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);

        await client.query(
            `INSERT INTO usuarios (ci, nombre, telefono, email, contrasena, rol)
             VALUES ($1, $2, $3, $4, $5, 'Cliente')`,
            [ci, nombre, telefono, email, hash]
        );
        await client.query(`INSERT INTO clientes (ci_usuario) VALUES ($1)`, [ci]);

        for (const id_cu of [1, 2, 3, 4, 5, 20, 21]) {
            await client.query(
                `INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                 VALUES ($1, $2, true)
                 ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true`,
                [ci, id_cu]
            );
        }

        await client.query('COMMIT');
        // Enviar correo con la contraseña ORIGINAL (antes del hash) para que el usuario la conozca
        enviarCorreoCredenciales(email, nombre, contrasena);
        res.json({ success: true, message: 'Cuenta creada exitosamente. Se envió un correo con tus credenciales.' });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'El CI o el Correo ya están registrados.' });
        }
        res.status(500).json({ success: false, message: 'Error interno: ' + err.message });
    } finally {
        client.release();
    }
}

// =============================================================================
// RECUPERAR CONTRASEÑA — Paso 1: Solicitar código por correo
// Genera token de 6 chars y lo guarda en BD con expiración de 15 min.
// =============================================================================
async function recuperarPassword(req, res) {
    const { email } = req.body;
    try {
        const result = await pool.query('SELECT nombre FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No existe una cuenta con ese correo.' });
        }

        const token      = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiracion = new Date(Date.now() + 15 * 60 * 1000);

        await pool.query(
            'UPDATE usuarios SET reset_token = $1, reset_token_expira = $2 WHERE email = $3',
            [token, expiracion, email]
        );

        const nombre = result.rows[0].nombre;
        transporter.sendMail({
            from: '"Salón HISAMI" <bmateo637@gmail.com>',
            to: email,
            subject: 'Recuperación de Contraseña - HISAMI',
            html: `
                <div style="font-family:Arial,sans-serif;padding:20px;color:#333;max-width:500px;">
                    <h2 style="color:#d4a373;">Hola, ${nombre}</h2>
                    <p>Tu código temporal de recuperación es:</p>
                    <div style="background:#f9f9f9;padding:20px;border-radius:8px;border:2px solid #d4a373;margin:20px 0;text-align:center;">
                        <span style="font-size:32px;font-weight:bold;letter-spacing:5px;color:#d4a373;">${token}</span>
                    </div>
                    <p>Este código expira en <strong>15 minutos</strong>.</p>
                    <p style="color:#666;font-size:12px;">Si no solicitaste esto, ignora este mensaje.</p>
                </div>`
        }).then(() => console.log(`✉️  Código de recuperación enviado a ${email}`))
          .catch(err => console.error('❌ Error al enviar código:', err.message));

        res.json({ success: true, message: 'Código enviado a tu correo.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

// =============================================================================
// RECUPERAR CONTRASEÑA — Paso 2: Verificar código y actualizar contraseña
// La nueva contraseña también se hashea antes de guardar.
// =============================================================================
async function restablecerPassword(req, res) {
    const { email, token, nuevaPassword } = req.body;

    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(nuevaPassword)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener número, mayúscula y carácter especial.' });
    }

    try {
        const result = await pool.query(
            'SELECT reset_token, reset_token_expira FROM usuarios WHERE email = $1',
            [email]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Correo no encontrado.' });

        const { reset_token, reset_token_expira } = result.rows[0];

        if (!reset_token || reset_token !== token.toUpperCase()) {
            return res.status(400).json({ success: false, message: 'Código inválido.' });
        }
        if (new Date() > new Date(reset_token_expira)) {
            return res.status(400).json({ success: false, message: 'El código ha expirado. Solicita uno nuevo.' });
        }

        // Hashear la nueva contraseña antes de guardarla
        const hash = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);
        await pool.query(
            'UPDATE usuarios SET contrasena = $1, reset_token = NULL, reset_token_expira = NULL WHERE email = $2',
            [hash, email]
        );
        res.json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

// =============================================================================
// CAMBIAR CONTRASEÑA (desde el panel de configuración, usuario logueado)
// Verifica la contraseña actual con bcrypt.compare antes de permitir el cambio.
// =============================================================================
async function cambiarPassword(req, res) {
    const { email, passwordActual, passwordNueva } = req.body;

    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(passwordNueva)) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener número, mayúscula y carácter especial.' });
    }

    try {
        const result = await pool.query('SELECT contrasena FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        const hashGuardado = result.rows[0].contrasena;
        let actualCorrecta = false;

        // Soportar contraseñas antiguas (texto plano) y nuevas (bcrypt)
        if (hashGuardado.startsWith('$2b$') || hashGuardado.startsWith('$2a$')) {
            actualCorrecta = await bcrypt.compare(passwordActual, hashGuardado);
        } else {
            actualCorrecta = (passwordActual === hashGuardado);
        }

        if (!actualCorrecta) {
            return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta.' });
        }

        const nuevoHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
        await pool.query('UPDATE usuarios SET contrasena = $1 WHERE email = $2', [nuevoHash, email]);
        res.json({ success: true, message: '¡Contraseña actualizada con éxito!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

// =============================================================================
// MENÚ DE USUARIO — CUs habilitados para el usuario (arma el menú de navegación)
// =============================================================================
async function menusUsuario(req, res) {
    try {
        const result = await pool.query(`
            SELECT ps.id_paquete_sist, ps.nombre AS paquete,
                   cu.id_cu, cu.nombre_cu, cu.descripcion AS cu_desc, cu.ruta
            FROM privilegios_usuario pu
            JOIN casos_uso cu ON pu.id_cu = cu.id_cu
            JOIN paquetes_sistema ps ON cu.id_paquete_sist = ps.id_paquete_sist
            WHERE pu.ci_usuario = $1 AND pu.habilitado = true
            ORDER BY ps.id_paquete_sist, cu.id_cu
        `, [req.params.ci]);

        const menu = [];
        let paqActual = null;
        result.rows.forEach(row => {
            if (!paqActual || paqActual.id !== row.id_paquete_sist) {
                paqActual = { id: row.id_paquete_sist, nombre: row.paquete, cus: [] };
                menu.push(paqActual);
            }
            paqActual.cus.push({ id_cu: row.id_cu, nombre: row.nombre_cu, descripcion: row.cu_desc, ruta: row.ruta });
        });
        res.json({ success: true, menu });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

// CU19 — Historial de sesiones (en RAM, para el admin)
function getSesiones(req, res) {
    res.json({ success: true, sesiones: historialSesiones });
}

module.exports = {
    login, registro,
    recuperarPassword, restablecerPassword, cambiarPassword,
    menusUsuario, getSesiones
};
