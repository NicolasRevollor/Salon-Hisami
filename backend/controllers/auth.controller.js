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

// =============================================================================
// MIGRACIÓN AUTOMÁTICA — restaura paquetes_sistema, casos_uso y privilegios
// si están vacíos (ej: el usuario los borró accidentalmente por CASCADE).
// Se llama al iniciar el servidor. Usa ON CONFLICT DO NOTHING para no duplicar.
// =============================================================================
async function initSistema() {
    try {
        // ── 1. paquetes_sistema ───────────────────────────────────────────────
        await pool.query(`
            INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
              (1, 'Gestion de Seguridad',          'Control de acceso, login, roles y auditoria'),
              (2, 'Gestion de Reservas y Clientes','Centraliza la agenda, clientes y comunicacion'),
              (3, 'Gestion de Catalogo y Personal','Organiza la oferta comercial y el talento humano'),
              (4, 'Gestion de Caja y Finanzas',    'Controla el flujo monetario, pagos y comisiones'),
              (5, 'Gestion de Inventario',         'Supervisa insumos, consumos y stock')
            ON CONFLICT (id_paquete_sist) DO NOTHING
        `);

        // ── 2. casos_uso ──────────────────────────────────────────────────────
        await pool.query(`
            INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre, descripcion, ruta) VALUES
              (1,  1, 'CU1 - Iniciar Sesion',              'Login y registro de acceso',                  '/login'),
              (2,  1, 'CU2 - Cerrar Sesion',               'Salida del sistema',                          '/logout'),
              (18, 1, 'CU18 - Gestionar Roles/Privilegios','Define niveles de autoridad',                 '/admin-privilegios'),
              (19, 1, 'CU19 - Administrar Bitacora',       'Registro auditable de acciones',              '/bitacora'),
              (3,  2, 'CU3 - Gestionar Cita/Reserva',      'Bloqueo de espacios en agenda',               '/hacer-reserva'),
              (10, 2, 'CU10 - Gestionar Cliente',          'Datos de contacto de personas',               '/gestion-clientes'),
              (6,  2, 'CU6 - Registro Preferencias',       'Historial clinico-estetico',                  '/preferencias'),
              (20, 2, 'CU20 - Recordatorios Automaticos',  'Alertas a clientes antes de cita',            '/recordatorios'),
              (21, 2, 'CU21 - Integrar WhatsApp',          'Comunicacion externa con clientes',           '/whatsapp'),
              (8,  3, 'CU8 - Gestionar Categoria',         'Jerarquia del menu del salon',                '/gestion-categorias'),
              (7,  3, 'CU7 - Gestionar Servicio',          'Administra servicios individuales',           '/gestion-servicios'),
              (9,  3, 'CU9 - Gestionar Paquetes',          'Combina servicios en promociones',            '/gestion-paquetes'),
              (11, 3, 'CU11 - Gestionar Personal',         'Perfiles de trabajadores activos',            '/gestion-personal'),
              (12, 3, 'CU12 - Gestionar Especialidades',   'Puente entre personal y catalogo',            '/gestion-especialidades'),
              (13, 4, 'CU13 - Gestionar Apertura/Cierre',  'Inicia y finaliza ciclo financiero',          '/caja'),
              (4,  4, 'CU4 - Realizar Pago de Reserva',    'Procesa ingreso por servicio',                '/pagar'),
              (5,  4, 'CU5 - Emitir Factura',              'Genera comprobante de pago',                  '/factura'),
              (16, 4, 'CU16 - Gestionar Comisiones',       'Calcula remuneracion variable',               '/comisiones'),
              (17, 4, 'CU17 - Generar Reporte Financiero', 'Vision gerencial de ganancias',               '/reportes'),
              (23, 5, 'CU23 - Gestionar Compras/Pedidos',  'Registra entrada de mercaderia al local',     '/compras'),
              (14, 5, 'CU14 - Gestionar Kit de Personal',  'Salida de insumos al carrito de trabajo',     '/kits'),
              (24, 5, 'CU24 - Gestionar Consumo/Receta',   'Define formula estandar por servicio',        '/recetas'),
              (15, 5, 'CU15 - Monitorear Alertas Stock',   'Vigilante de niveles criticos',               '/alertas-stock')
            ON CONFLICT (id_cu) DO NOTHING
        `);

        // ── 3. Privilegios por defecto para usuarios que no tienen ninguno ────
        // CUs básicos: 1 (login), 2 (logout), 3 (reservar), 16 (comisiones), 19 (bitacora)
        const CUS_CLIENTE   = [1, 2, 3];
        const CUS_PERSONAL  = [1, 2, 3, 16];
        const CUS_ADMIN     = [1, 2, 3, 7, 8, 9, 10, 11, 12, 16, 18, 19];

        const usuarios = await pool.query(
            `SELECT ci, rol FROM usuarios u
             WHERE NOT EXISTS (
                 SELECT 1 FROM privilegios_usuario pu WHERE pu.ci_usuario = u.ci
             )`
        );

        for (const u of usuarios.rows) {
            const cus = u.rol === 'Administrador' ? CUS_ADMIN
                      : u.rol === 'Personal'      ? CUS_PERSONAL
                      :                             CUS_CLIENTE;
            for (const id_cu of cus) {
                await pool.query(
                    `INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                     VALUES ($1, $2, true)
                     ON CONFLICT (ci_usuario, id_cu) DO NOTHING`,
                    [u.ci, id_cu]
                );
            }
        }

        console.log('✅ paquetes_Cargados');
    } catch (err) {
        console.error('❌ Error en initSistema:', err.message);
    }
}
initSistema();
const historialSesiones = [];       // últimos 50 logins exitosos

// =============================================================================
// CU1 — LOGIN
// POST /login → { email, contrasena }
// Soporta contraseñas hasheadas (bcrypt) Y contraseñas antiguas (texto plano).
// Si detecta una contraseña en texto plano y el login es correcto, la hashea
// automáticamente para migrarla sin que el usuario note nada.
// =============================================================================
async function login(req, res) {
    const { identificador, contrasena } = req.body;
    const ahora = Date.now();

    const estado = intentosLogin.get(identificador) || { intentos: 0, bloqueadoHasta: 0 };

    // Verificar si la cuenta sigue bloqueada
    if (ahora < estado.bloqueadoHasta) {
        const seg = Math.ceil((estado.bloqueadoHasta - ahora) / 1000);
        return res.status(429).json({
            success: false,
            message: `Cuenta bloqueada por seguridad. Espera ${seg} segundos.`
        });
    }

    try {
        // Buscar por correo o por CI según lo que ingresó el usuario
        const result = await pool.query(
            'SELECT ci, nombre, rol, email, contrasena FROM usuarios WHERE email = $1 OR ci::text = $1',
            [identificador]
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
                    await pool.query('UPDATE usuarios SET contrasena = $1 WHERE ci = $2', [nuevoHash, user.ci]);
                    console.log(`🔐 Contraseña de ${user.email} migrada a bcrypt automáticamente`);
                }
            }

            if (passwordCorrecta) {
                intentosLogin.delete(identificador);
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
            intentosLogin.set(identificador, estado);
            return res.status(429).json({ success: false, message: 'Has fallado 3 veces. Cuenta bloqueada por 30 segundos.' });
        } else if (estado.intentos === 4) {
            estado.bloqueadoHasta = ahora + 60_000;
            intentosLogin.set(identificador, estado);
            return res.status(429).json({ success: false, message: 'Intento fallido. Cuenta bloqueada por 1 minuto.' });
        } else if (estado.intentos >= 5) {
            estado.bloqueadoHasta = ahora + 120_000;
            intentosLogin.set(identificador, estado);
            return res.status(429).json({ success: false, message: 'Intento fallido. Cuenta bloqueada por 2 minutos.' });
        } else {
            intentosLogin.set(identificador, estado);
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
                   cu.id_cu, cu.nombre, cu.descripcion AS cu_desc, cu.ruta
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
            paqActual.cus.push({ id_cu: row.id_cu, nombre: row.nombre, descripcion: row.cu_desc, ruta: row.ruta });
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
