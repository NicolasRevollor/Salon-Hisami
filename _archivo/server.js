const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer'); // <-- NUEVA LIBRERÍA PARA CORREOS

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// CONFIGURACIÓN DE CONEXIÓN A POSTGRESQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'proyectosi1',     
    password: 'lalito007', 
    port: 5432,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error de conexión con PostgreSQL:', err.stack);
    } else {
        console.log('✅ Conexión exitosa con Postgresql base de datos: proyectosi1');
    }
});

// =============================================================================
// CONFIGURACIÓN DE CORREOS (NODEMAILER)
// =============================================================================
// IMPORTANTE: Para que funcione, debes usar un correo real y una contraseña de aplicación.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bmateo637@gmail.com', // <-- PON TU CORREO AQUÍ
        pass: 'qzil wfif oulk tsax' // <-- PON TU CLAVE DE APLICACIÓN AQUÍ
    }
});

// Función auxiliar para enviar el correo
async function enviarCorreoCredenciales(emailDestino, nombre, password) {
    try {
        const mailOptions = {
            from: '"Salón HISAMI" <no-reply@hisami.com>',
            to: emailDestino,
            subject: '¡Bienvenido a HISAMI! - Tus credenciales de acceso',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #d4a373;">¡Hola, ${nombre}!</h2>
                    <p>Tu cuenta ha sido registrada exitosamente en el sistema de <strong>Salón de Belleza HISAMI</strong>.</p>
                    <p>A continuación, te enviamos tus credenciales para iniciar sesión:</p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin: 20px 0;">
                        <p><strong>Usuario / Correo:</strong> ${emailDestino}</p>
                        <p><strong>Contraseña:</strong> ${password}</p>
                    </div>
                    <p style="color: #666; font-size: 12px;">Por razones de seguridad, te recomendamos cambiar tu contraseña al iniciar sesión desde el panel de Configuración.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`✉️ Correo enviado exitosamente a ${emailDestino}`);
    } catch (error) {
        console.error("❌ Error al enviar el correo (Verifica tus credenciales en server.js):", error.message);
    }
}


// =============================================================================
// SISTEMA DE BLOQUEO PROGRESIVO DE SEGURIDAD Y SESIONES
// =============================================================================
const intentosLogin = new Map();
const historialSesiones = []; 

app.post('/login', async (req, res) => {
    const { email, contrasena } = req.body;
    const ahora = Date.now();

    const estadoUsuario = intentosLogin.get(email) || { intentos: 0, bloqueadoHasta: 0 };

    if (ahora < estadoUsuario.bloqueadoHasta) {
        const segundosRestantes = Math.ceil((estadoUsuario.bloqueadoHasta - ahora) / 1000);
        return res.status(429).json({ 
            success: false, 
            message: `Cuenta bloqueada por seguridad. Espera ${segundosRestantes} segundos.` 
        });
    }

    try {
        const result = await pool.query(
            'SELECT nombre, rol, ci, email FROM usuarios WHERE email = $1 AND contrasena = $2',
            [email, contrasena]
        );

        if (result.rows.length > 0) {
            intentosLogin.delete(email);
            const user = result.rows[0];
            
            historialSesiones.unshift({
                nombre: user.nombre,
                email: user.email,
                rol: user.rol,
                fecha: new Date().toLocaleString('es-BO')
            });
            if(historialSesiones.length > 50) historialSesiones.pop();

            res.json({ success: true, user: user });
        } else {
            estadoUsuario.intentos += 1;
            
            if (estadoUsuario.intentos === 3) {
                estadoUsuario.bloqueadoHasta = ahora + 30000; 
                intentosLogin.set(email, estadoUsuario);
                return res.status(429).json({ success: false, message: 'Has fallado 3 veces. Cuenta bloqueada por 30 segundos.' });
            } else if (estadoUsuario.intentos === 4) {
                estadoUsuario.bloqueadoHasta = ahora + 60000; 
                intentosLogin.set(email, estadoUsuario);
                return res.status(429).json({ success: false, message: 'Intento fallido. Cuenta bloqueada por 1 minuto.' });
            } else if (estadoUsuario.intentos >= 5) {
                estadoUsuario.bloqueadoHasta = ahora + 120000; 
                intentosLogin.set(email, estadoUsuario);
                return res.status(429).json({ success: false, message: 'Intento fallido. Cuenta bloqueada por 2 minutos.' });
            } else {
                intentosLogin.set(email, estadoUsuario);
                const intentosRestantes = 3 - estadoUsuario.intentos;
                res.status(401).json({ success: false, message: `Credenciales incorrectas. Te quedan ${intentosRestantes} intentos antes del bloqueo.` });
            }
        }
    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// =============================================================================
// ENDPOINT: REGISTRO DE NUEVO CLIENTE (AhorA ENVÍA CORREO)
// =============================================================================
app.post('/registro', async (req, res) => {
    const { ci, nombre, telefono, email, contrasena } = req.body;
    
    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(contrasena)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe contener al menos un NÚMERO, una MAYÚSCULA y un CARÁCTER ESPECIAL.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertUsuarioQuery = `INSERT INTO usuarios (ci, nombre, telefono, email, contrasena, rol) VALUES ($1, $2, $3, $4, $5, 'Cliente');`;
        await client.query(insertUsuarioQuery, [ci, nombre, telefono, email, contrasena]);
        const insertClienteQuery = `INSERT INTO clientes (ci_usuario) VALUES ($1);`;
        await client.query(insertClienteQuery, [ci]);

        // Asignar CUs específicos para Clientes: CU1, CU2, CU3, CU4, CU5, CU20, CU21
        for (const id_cu of [1, 2, 3, 4, 5, 20, 21]) {
            await client.query(`
                INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                VALUES ($1, $2, true)
                ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true
            `, [ci, id_cu]);
        }

        await client.query('COMMIT');

        // ENVÍO DE CORREO (No bloquea la respuesta si falla)
        enviarCorreoCredenciales(email, nombre, contrasena);

        res.json({ success: true, message: 'Cuenta creada exitosamente. Se ha enviado un correo con tus credenciales.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en registro:", err);
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'El CI o el Correo ya están registrados en el sistema.' });
        }
        res.status(500).json({ success: false, message: 'Error interno de BD: ' + err.message });
    } finally {
        client.release();
    }
});

// =============================================================================
// ENDPOINT: RECUPERAR CONTRASEÑA (SOLICITAR TOKEN)
// =============================================================================
app.post('/api/recuperar-password', async (req, res) => {
    console.log('>>> SERVER: Recibida solicitud recuperar-password');
    const { email } = req.body;
    console.log('>>> SERVER: Email recibido:', email);
    try {
        const result = await pool.query('SELECT nombre FROM usuarios WHERE email = $1', [email]);
        console.log('>>> SERVER: Usuario encontrado:', result.rows.length > 0);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No existe una cuenta con ese correo.' });
        }

        const token = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiracion = new Date(Date.now() + 15 * 60 * 1000);
        console.log('>>> SERVER: Token generado:', token);

        await pool.query(
            'UPDATE usuarios SET reset_token = $1, reset_token_expira = $2 WHERE email = $3',
            [token, expiracion, email]
        );
        console.log('>>> SERVER: Token guardado en BD');

        const nombre = result.rows[0].nombre;
        const mailOptions = {
            from: '"Salón HISAMI" <bmateo637@gmail.com>',
            to: email,
            subject: 'Recuperación de Contraseña - HISAMI',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px;">
                    <h2 style="color: #d4a373;">Hola, ${nombre}</h2>
                    <p>Has solicitado recuperar tu contraseña en <strong>Salón de Belleza HISAMI</strong>.</p>
                    <p>Tu codigo temporal de recuperacion es:</p>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 2px solid #d4a373; margin: 20px 0; text-align: center;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #d4a373;">${token}</span>
                    </div>
                    <p>Este codigo expira en <strong>15 minutos</strong>.</p>
                    <p style="color: #666; font-size: 12px;">Si no solicitaste este codigo, ignora este mensaje.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999;">Este es un correo automatico, por favor no respondas a este mensaje.</p>
                </div>
            `
        };

        // ENVÍO DE CORREO NO BLOQUEANTE - responde siempre si la BD funciona
        transporter.sendMail(mailOptions)
            .then(() => console.log('✉️ Código enviado a', email))
            .catch(err => console.error('❌ Error al enviar email:', err.message));

        res.json({ success: true, message: 'Codigo enviado a tu correo. Revisa tu bandeja de entrada.' });
    } catch (err) {
        console.error("Error en recuperar-password:", err);
        res.status(500).json({ success: false, message: 'Error interno del servidor: ' + err.message });
    }
});

// =============================================================================
// ENDPOINT: RESTABLECER CONTRASEÑA CON TOKEN
// =============================================================================
app.post('/api/restablecer-password', async (req, res) => {
    const { email, token, nuevaPassword } = req.body;

    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(nuevaPassword)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe contener al menos un NÚMERO, una MAYÚSCULA y un CARÁCTER ESPECIAL.' });
    }

    try {
        const result = await pool.query(
            'SELECT reset_token, reset_token_expira FROM usuarios WHERE email = $1',
            [email]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Correo no encontrado.' });
        }

        const { reset_token, reset_token_expira } = result.rows[0];
        if (!reset_token || reset_token !== token.toUpperCase()) {
            return res.status(400).json({ success: false, message: 'Código inválido.' });
        }
        if (new Date() > new Date(reset_token_expira)) {
            return res.status(400).json({ success: false, message: 'El código ha expirado. Solicita uno nuevo.' });
        }

        await pool.query(
            'UPDATE usuarios SET contrasena = $1, reset_token = NULL, reset_token_expira = NULL WHERE email = $2',
            [nuevaPassword, email]
        );
        res.json({ success: true, message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
    } catch (err) {
        console.error("Error en restablecer-password:", err);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// =============================================================================
// ENDPOINT: CONSULTAR MENÚ DE USUARIO (PAQUETES Y CUS)
// =============================================================================
app.get('/api/menus-usuario/:ci', async (req, res) => {
    const { ci } = req.params;
    try {
        const result = await pool.query(`
            SELECT ps.id_paquete_sist, ps.nombre as paquete, 
                   cu.id_cu, cu.nombre_cu, cu.descripcion as cu_desc, cu.ruta
            FROM privilegios_usuario pu
            JOIN casos_uso cu ON pu.id_cu = cu.id_cu
            JOIN paquetes_sistema ps ON cu.id_paquete_sist = ps.id_paquete_sist
            WHERE pu.ci_usuario = $1 AND pu.habilitado = true
            ORDER BY ps.id_paquete_sist, cu.id_cu
        `, [ci]);
        
        const menu = [];
        let paqueteActual = null;
        
        result.rows.forEach(row => {
            if (!paqueteActual || paqueteActual.id !== row.id_paquete_sist) {
                paqueteActual = {
                    id: row.id_paquete_sist,
                    nombre: row.paquete,
                    cus: []
                };
                menu.push(paqueteActual);
            }
            paqueteActual.cus.push({
                id_cu: row.id_cu,
                nombre: row.nombre_cu,
                descripcion: row.cu_desc,
                ruta: row.ruta
            });
        });
        
        res.json({ success: true, menu });
    } 
    catch (err) {
    console.error("Error en menu-usuario:", err);

    res.status(500).json({
        success: false,
        error: err.message
    });
}
    
});

// =============================================================================
// ENDPOINTS: GESTIÓN DE INVENTARIO (CU23, CU24)
// =============================================================================

// Obtener todos los insumos
app.get('/api/inventario', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventario ORDER BY nombre');
        res.json({ success: true, insumos: result.rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Registrar compra/pedido (CU23)
app.post('/api/compras', async (req, res) => {
    const { insumos } = req.body; // Array de {id_producto, cantidad}
    if (!insumos || !Array.isArray(insumos)) {
        return res.status(400).json({ success: false, message: 'Formato inválido' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of insumos) {
            await client.query(
                'UPDATE inventario SET cantidad = cantidad + $1 WHERE id_producto = $2',
                [item.cantidad, item.id_producto]
            );
        }
        await client.query('COMMIT');
        res.json({ success: true, message: 'Stock actualizado correctamente' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// Obtener receta de un servicio (CU24)
app.get('/api/recetas/:id_servicio', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT u.*, i.nombre as nombre_insumo FROM utiliza u JOIN inventario i ON u.id_producto = i.id_producto WHERE u.id_servicio = $1',
            [req.params.id_servicio]
        );
        res.json({ success: true, receta: result.rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Guardar/Actualizar receta (CU24)
app.post('/api/recetas', async (req, res) => {
    const { id_servicio, insumos } = req.body; // insumos: [{id_producto, cantidad}]
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Eliminar receta anterior
        await client.query('DELETE FROM utiliza WHERE id_servicio = $1', [id_servicio]);
        // Insertar nueva receta
        for (const item of insumos) {
            await client.query(
                'INSERT INTO utiliza (id_servicio, id_producto, cantidad) VALUES ($1, $2, $3)',
                [id_servicio, item.id_producto, item.cantidad]
            );
        }
        await client.query('COMMIT');
        res.json({ success: true, message: 'Receta guardada' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// =============================================================================
// ENDPOINTS ADMIN: GESTIÓN DE PRIVILEGIOS
// =============================================================================
app.get('/api/admin/paquetes-sistema', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ps.*, json_agg(json_build_object('id_cu', cu.id_cu, 'nombre', cu.nombre_cu)) as casos_uso
            FROM paquetes_sistema ps
            LEFT JOIN casos_uso cu ON ps.id_paquete_sist = cu.id_paquete_sist
            GROUP BY ps.id_paquete_sist
            ORDER BY ps.id_paquete_sist
        `);
        res.json({ success: true, paquetes: result.rows });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/admin/privilegios/:ci', async (req, res) => {
    const { ci } = req.params;
    try {
        const result = await pool.query(`
            SELECT cu.id_cu, cu.nombre_cu, cu.id_paquete_sist,
                   EXISTS(SELECT 1 FROM privilegios_usuario pu 
                          WHERE pu.ci_usuario = $1 AND pu.id_cu = cu.id_cu) as tiene
            FROM casos_uso cu
            ORDER BY cu.id_paquete_sist, cu.id_cu
        `, [ci]);
        res.json({ success: true, privilegios: result.rows });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/privilegios', async (req, res) => {
    const { ci_usuario, id_cu, habilitado } = req.body;
    try {
        if (habilitado) {
            await pool.query(`
                INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                VALUES ($1, $2, true)
                ON CONFLICT (ci_usuario, id_cu) 
                DO UPDATE SET habilitado = true
            `, [ci_usuario, id_cu]);
        } else {
            await pool.query(`
                UPDATE privilegios_usuario 
                SET habilitado = false 
                WHERE ci_usuario = $1 AND id_cu = $2
            `, [ci_usuario, id_cu]);
        }
        res.json({ success: true, message: 'Privilegio actualizado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// ENDPOINT: CAMBIAR CONTRASEÑA 
// =============================================================================
app.post('/cambiar-password', async (req, res) => {
    const { email, passwordActual, passwordNueva } = req.body;

    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(passwordNueva)) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe contener al menos un NÚMERO, una MAYÚSCULA y un CARÁCTER ESPECIAL.' });
    }

    try {
        const checkUser = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND contrasena = $2', [email, passwordActual]);
        if (checkUser.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'La contraseña actual ingresada es incorrecta.' });
        }
        await pool.query('UPDATE usuarios SET contrasena = $1 WHERE email = $2', [passwordNueva, email]);
        res.json({ success: true, message: '¡Tu contraseña ha sido actualizada con éxito!' });
    } catch (err) {
        console.error("Error cambiando contraseña:", err);
        res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar contraseña.' });
    }
});

// =============================================================================
// ENDPOINTS DE DATOS DINÁMICOS
// =============================================================================
app.get('/api/categorias', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categoria ORDER BY nombre ASC');
        res.json({ success: true, categorias: result.rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/especialidades', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM especialidades ORDER BY nombre_especialidad ASC');
        res.json({ success: true, especialidades: result.rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/servicios', async (req, res) => {
    try {
        const resultServicios = await pool.query(`
            SELECT s.*, c.nombre as nombre_categoria 
            FROM servicios s 
            LEFT JOIN categoria c ON s.id_categoria = c.id_categoria
            WHERE s.estado = 'Activo'
            ORDER BY s.id_servicio ASC
        `);
        const resultPaquetes = await pool.query('SELECT id_paquete, nombre, descripcion, precio_promocional, fecha_inicio, fecha_final FROM paquetes ORDER BY id_paquete ASC');
        res.json({ success: true, servicios: resultServicios.rows, paquetes: resultPaquetes.rows });
    } catch (err) { res.status(500).json({ success: false, message: 'Error al consultar la BD' }); }
});

app.get('/api/comisiones/:ci', async (req, res) => {
    try {
        const ci_empleado = req.params.ci;
        const result = await pool.query(`
            SELECT c.fecha, c.monto_comision, c.estado_pago 
            FROM comision c
            JOIN personal p ON c.id_esteticista = p.id_esteticista
            WHERE p.ci_usuario = $1
            ORDER BY c.fecha DESC
        `, [ci_empleado]);
        res.json({ success: true, comisiones: result.rows });
    } catch (err) { res.status(500).json({ success: false, message: 'Error al consultar la BD' }); }
});

// =============================================================================
// ENDPOINTS DE ADMINISTRADOR 
// =============================================================================
app.get('/api/admin/sesiones', (req, res) => {
    res.json({ success: true, sesiones: historialSesiones });
});

app.post('/api/admin/servicios', async (req, res) => {
    const { nombre_servicio, descripcion, precio, id_categoria } = req.body;
    try {
        await pool.query(
            'INSERT INTO servicios (nombre_servicio, descripcion, precio, id_categoria, estado) VALUES ($1, $2, $3, $4, $5)', 
            [nombre_servicio, descripcion, precio, id_categoria, 'Activo']
        );
        res.json({ success: true, message: 'Servicio agregado correctamente.' });
    } catch (err) {
        console.error("Error agregando servicio:", err);
        res.status(500).json({ success: false, message: 'Error al guardar en la base de datos.' });
    }
});

app.put('/api/admin/servicios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_servicio, descripcion, precio, id_categoria } = req.body;
    try {
        await pool.query(
            'UPDATE servicios SET nombre_servicio = $1, descripcion = $2, precio = $3, id_categoria = $4 WHERE id_servicio = $5',
            [nombre_servicio, descripcion, precio, id_categoria, id]
        );
        res.json({ success: true, message: 'Servicio actualizado correctamente.' });
    } catch (err) {
        console.error("Error actualizando servicio:", err);
        res.status(500).json({ success: false, message: 'Error al actualizar en la base de datos.' });
    }
});

app.get('/api/admin/empleados', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id_esteticista, u.ci, u.nombre, u.email, u.telefono, 
                   STRING_AGG(e.nombre_especialidad, ', ') AS especialidades
            FROM personal p
            JOIN usuarios u ON p.ci_usuario = u.ci
            LEFT JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            GROUP BY p.id_esteticista, u.ci, u.nombre, u.email, u.telefono
            ORDER BY u.nombre ASC
        `);
        res.json({ success: true, empleados: result.rows });
    } catch(err) {
        res.status(500).json({ success: false, message: 'Error al cargar empleados.' });
    }
});

// Agregar nuevo Empleado — acepta array de especialidades y asigna CUs específicos
app.post('/api/admin/empleados', async (req, res) => {
    // especialidades: array de id_especialidad (1 o 2 valores)
    const { ci, nombre, telefono, email, contrasena, especialidades } = req.body;

    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(contrasena)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe contener número, mayúscula y carácter especial.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            "INSERT INTO usuarios (ci, nombre, telefono, email, contrasena, rol) VALUES ($1, $2, $3, $4, $5, 'Personal')",
            [ci, nombre, telefono, email, contrasena]
        );

        const resultPers = await client.query(
            "INSERT INTO personal (ci_usuario, estado) VALUES ($1, 'Activo') RETURNING id_esteticista",
            [ci]
        );
        const id_esteticista = resultPers.rows[0].id_esteticista;

        // Insertar cada especialidad del array (máximo 2, normalizado)
        const espsArray = Array.isArray(especialidades)
            ? especialidades : (especialidades ? [especialidades] : []);
        for (const id_esp of espsArray.filter(Boolean).slice(0, 2)) {
            await client.query(
                "INSERT INTO personal_especialidades (id_esteticista, id_especialidad) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [id_esteticista, id_esp]
            );
        }

        // Asignar CUs base para Personal: CU1, CU2, CU3, CU6, CU10, CU18, CU20, CU21
        for (const id_cu of [1, 2, 3, 6, 10, 18, 20, 21]) {
            await client.query(`
                INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                VALUES ($1, $2, true)
                ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true
            `, [ci, id_cu]);
        }

        // Agregar todos los CUs de los paquetes "Caja y Finanzas" e "Inventario"
        const cusPaquetes = await client.query(`
            SELECT cu.id_cu FROM casos_uso cu
            JOIN paquetes_sistema ps ON cu.id_paquete_sist = ps.id_paquete_sist
            WHERE LOWER(ps.nombre) IN ('caja y finanzas', 'inventario')
        `);
        for (const cu of cusPaquetes.rows) {
            await client.query(`
                INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
                VALUES ($1, $2, true)
                ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true
            `, [ci, cu.id_cu]);
        }

        await client.query('COMMIT');

        // ENVÍO DE CORREO (No bloquea si falla)
        enviarCorreoCredenciales(email, nombre, contrasena);

        res.json({ success: true, message: 'Empleado agregado exitosamente. Se le ha enviado un correo.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error agregando empleado:", err);
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'El CI o el Correo ya están registrados.' });
        }
        res.status(500).json({ success: false, message: 'Error interno de BD: ' + err.message });
    } finally {
        client.release();
    }
});

// =============================================================================
// ENDPOINT: ELIMINAR SERVICIO (marca como Inactivo para conservar historial)
// =============================================================================
app.delete('/api/admin/servicios/:id', async (req, res) => {
    try {
        await pool.query("UPDATE servicios SET estado = 'Inactivo' WHERE id_servicio = $1", [req.params.id]);
        res.json({ success: true, message: 'Servicio eliminado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// ENDPOINTS: EDITAR Y ELIMINAR EMPLEADO
// =============================================================================

// Actualiza nombre, teléfono y correo del empleado
app.put('/api/admin/empleados/:ci', async (req, res) => {
    const { ci } = req.params;
    const { nombre, telefono, email } = req.body;
    try {
        await pool.query(
            'UPDATE usuarios SET nombre = $1, telefono = $2, email = $3 WHERE ci = $4',
            [nombre, telefono, email, ci]
        );
        res.json({ success: true, message: 'Empleado actualizado.' });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, message: 'Ese correo ya está registrado.' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// Elimina el empleado y todas sus relaciones en cascada
app.delete('/api/admin/empleados/:ci', async (req, res) => {
    const { ci } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Obtener id_esteticista antes de borrar
        const pers = await client.query('SELECT id_esteticista FROM personal WHERE ci_usuario = $1', [ci]);
        if (pers.rows.length > 0) {
            const id_est = pers.rows[0].id_esteticista;
            await client.query('DELETE FROM personal_especialidades WHERE id_esteticista = $1', [id_est]);
            await client.query('DELETE FROM personal WHERE id_esteticista = $1', [id_est]);
        }
        await client.query('DELETE FROM privilegios_usuario WHERE ci_usuario = $1', [ci]);
        await client.query('DELETE FROM usuarios WHERE ci = $1', [ci]);
        await client.query('COMMIT');
        res.json({ success: true, message: 'Empleado eliminado.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// =============================================================================
// ENDPOINTS: ESPECIALIDADES DE UN EMPLEADO (ver, agregar, eliminar)
// Límite: máximo 2 especialidades por empleado
// =============================================================================

// Retorna las especialidades asignadas a un empleado específico
app.get('/api/admin/empleados/:ci/especialidades', async (req, res) => {
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
});

// Agrega una especialidad al empleado (máximo 2)
app.post('/api/admin/empleados/:ci/especialidades', async (req, res) => {
    const { ci } = req.params;
    const { id_especialidad } = req.body;
    try {
        const pers = await pool.query('SELECT id_esteticista FROM personal WHERE ci_usuario = $1', [ci]);
        if (pers.rows.length === 0) return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
        const id_est = pers.rows[0].id_esteticista;

        // Verificar que no supere el límite de 2
        const count = await pool.query('SELECT COUNT(*) FROM personal_especialidades WHERE id_esteticista = $1', [id_est]);
        if (parseInt(count.rows[0].count) >= 2) {
            return res.status(400).json({ success: false, message: 'Máximo 2 especialidades por empleado.' });
        }

        await pool.query(
            'INSERT INTO personal_especialidades (id_esteticista, id_especialidad) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id_est, id_especialidad]
        );
        res.json({ success: true, message: 'Especialidad agregada.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Elimina una especialidad de un empleado
app.delete('/api/admin/empleados/:ci/especialidades/:id_esp', async (req, res) => {
    const { ci, id_esp } = req.params;
    try {
        const pers = await pool.query('SELECT id_esteticista FROM personal WHERE ci_usuario = $1', [ci]);
        if (pers.rows.length === 0) return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
        const id_est = pers.rows[0].id_esteticista;

        await pool.query(
            'DELETE FROM personal_especialidades WHERE id_esteticista = $1 AND id_especialidad = $2',
            [id_est, id_esp]
        );
        res.json({ success: true, message: 'Especialidad eliminada.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// ENDPOINTS: GESTIÓN DE CATEGORÍAS (crear y eliminar)
// =============================================================================

// Crea una nueva categoría de servicio
app.post('/api/categorias', async (req, res) => {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ success: false, message: 'El nombre es requerido.' });
    try {
        const result = await pool.query('INSERT INTO categoria (nombre) VALUES ($1) RETURNING *', [nombre.trim()]);
        res.json({ success: true, message: 'Categoría creada.', categoria: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, message: 'Esa categoría ya existe.' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// Elimina una categoría (fallará si tiene servicios asociados — la BD lo protege)
app.delete('/api/categorias/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM categoria WHERE id_categoria = $1', [req.params.id]);
        res.json({ success: true, message: 'Categoría eliminada.' });
    } catch (err) {
        if (err.code === '23503') return res.status(400).json({ success: false, message: 'No se puede eliminar: hay servicios con esta categoría.' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// ENDPOINTS: GESTIÓN DE PAQUETES (crear y eliminar)
// =============================================================================

// Retorna paquetes con sus servicios incluidos (via detalle_paquete)
app.get('/api/admin/paquetes', async (req, res) => {
    try {
        const resPaq = await pool.query('SELECT * FROM paquetes ORDER BY id_paquete ASC');
        const paquetesConServicios = await Promise.all(resPaq.rows.map(async paq => {
            const resServ = await pool.query(`
                SELECT s.id_servicio, s.nombre_servicio, s.precio
                FROM detalle_paquete dp
                JOIN servicios s ON dp.id_servicio = s.id_servicio
                WHERE dp.id_paquete = $1
            `, [paq.id_paquete]);
            return { ...paq, servicios: resServ.rows };
        }));
        res.json({ success: true, paquetes: paquetesConServicios });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Crea un nuevo paquete con sus servicios en detalle_paquete
app.post('/api/admin/paquetes', async (req, res) => {
    const { nombre, descripcion, precio_promocional, fecha_inicio, fecha_final, servicios } = req.body;
    if (!nombre || !nombre.trim() || !precio_promocional) {
        return res.status(400).json({ success: false, message: 'Nombre y precio promocional son obligatorios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            'INSERT INTO paquetes (nombre, descripcion, precio_promocional, fecha_inicio, fecha_final) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre.trim(), descripcion || '', precio_promocional, fecha_inicio || null, fecha_final || null]
        );
        const id_paquete = result.rows[0].id_paquete;
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
    } finally { client.release(); }
});

// Edita un paquete y reemplaza sus servicios en detalle_paquete
app.put('/api/admin/paquetes/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio_promocional, fecha_inicio, fecha_final, servicios } = req.body;
    if (!nombre || !precio_promocional) {
        return res.status(400).json({ success: false, message: 'Nombre y precio promocional son obligatorios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            'UPDATE paquetes SET nombre=$1, descripcion=$2, precio_promocional=$3, fecha_inicio=$4, fecha_final=$5 WHERE id_paquete=$6',
            [nombre, descripcion || '', precio_promocional, fecha_inicio || null, fecha_final || null, id]
        );
        if (Array.isArray(servicios)) {
            await client.query('DELETE FROM detalle_paquete WHERE id_paquete = $1', [id]);
            for (const id_serv of servicios.filter(Boolean)) {
                await client.query(
                    'INSERT INTO detalle_paquete (id_paquete, id_servicio) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, id_serv]
                );
            }
        }
        await client.query('COMMIT');
        res.json({ success: true, message: 'Paquete actualizado.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// Elimina un paquete (detalle_paquete se borra en cascada)
app.delete('/api/admin/paquetes/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM paquetes WHERE id_paquete = $1', [req.params.id]);
        res.json({ success: true, message: 'Paquete eliminado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// RESERVAS — CU3
// Tablas: reservas(id_cita, id_cliente, id_esteticista, fecha, hora, estado)
//         detalle_reserva(id_cita, id_servicio)
//         pagos(id_pago, id_cita, fecha, monto, metodo_pago)
// =============================================================================

// Esteticistas activos, filtrados por especialidad relacionada al servicio
app.get('/api/esteticistas', async (req, res) => {
    const { id_servicio, id_paquete } = req.query;
    const todosQuery = `
        SELECT u.ci, u.nombre, STRING_AGG(e.nombre_especialidad, ', ') AS especialidades
        FROM personal p JOIN usuarios u ON p.ci_usuario = u.ci
        LEFT JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
        LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
        WHERE p.estado = 'Activo'
        GROUP BY u.ci, u.nombre ORDER BY u.nombre`;
    try {
        let result;
        if (id_paquete) {
            result = await pool.query(`
                SELECT DISTINCT u.ci, u.nombre,
                       STRING_AGG(DISTINCT e.nombre_especialidad, ', ') AS especialidades
                FROM personal p
                JOIN usuarios u ON p.ci_usuario = u.ci
                JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
                JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
                WHERE p.estado = 'Activo'
                  AND EXISTS (
                    SELECT 1 FROM detalle_paquete dp
                    JOIN servicios s ON dp.id_servicio = s.id_servicio
                    JOIN categoria c ON s.id_categoria = c.id_categoria
                    WHERE dp.id_paquete = $1
                      AND LOWER(e.nombre_especialidad) ILIKE '%' || LOWER(c.nombre) || '%'
                  )
                GROUP BY u.ci, u.nombre ORDER BY u.nombre
            `, [id_paquete]);
            if (result.rows.length === 0) result = await pool.query(todosQuery);
        } else if (id_servicio) {
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
                GROUP BY u.ci, u.nombre ORDER BY u.nombre
            `, [id_servicio]);
            if (result.rows.length === 0) result = await pool.query(todosQuery);
        } else {
            result = await pool.query(todosQuery);
        }
        res.json({ success: true, esteticistas: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Horas disponibles de un esteticista en una fecha (busca por CI → id_esteticista)
app.get('/api/horas-disponibles', async (req, res) => {
    const { ci_esteticista, fecha } = req.query;
    const horasTodas = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
    try {
        const pers = await pool.query('SELECT id_esteticista FROM personal WHERE ci_usuario = $1', [ci_esteticista]);
        if (pers.rows.length === 0) return res.json({ success: true, horas: horasTodas });
        const id_est = pers.rows[0].id_esteticista;

        const result = await pool.query(
            "SELECT hora FROM reservas WHERE id_esteticista = $1 AND fecha = $2 AND estado != 'Cancelada'",
            [id_est, fecha]
        );
        const ocupadas = result.rows.map(r => (r.hora || '').substring(0, 5));
        const libres   = horasTodas.filter(h => !ocupadas.includes(h));
        res.json({ success: true, horas: libres });
    } catch (err) {
        res.json({ success: true, horas: horasTodas });
    }
});

// Verifica disponibilidad sin crear la reserva (botón "Revisar")
app.get('/api/verificar-disponibilidad', async (req, res) => {
    const { ci_esteticista, fecha, hora } = req.query;
    try {
        const pers = await pool.query('SELECT id_esteticista FROM personal WHERE ci_usuario = $1', [ci_esteticista]);
        if (pers.rows.length === 0) return res.json({ success: true, disponible: true });
        const id_est = pers.rows[0].id_esteticista;

        const result = await pool.query(
            "SELECT id_cita FROM reservas WHERE id_esteticista = $1 AND fecha = $2 AND hora = $3 AND estado != 'Cancelada'",
            [id_est, fecha, hora]
        );
        res.json({ success: true, disponible: result.rows.length === 0 });
    } catch {
        res.json({ success: true, disponible: true });
    }
});

// Crea reserva(s): soporta 1 o varios esteticistas (ci_esteticistas: string | array)
// Por cada esteticista se inserta en reservas + detalle_reserva + pagos
app.post('/api/reservas', async (req, res) => {
    const { ci_cliente, ci_esteticista, ci_esteticistas, id_servicio, id_paquete, fecha, hora, metodo_pago } = req.body;

    // Normalizar a array
    const ciEstArr = ci_esteticistas
        ? (Array.isArray(ci_esteticistas) ? ci_esteticistas : [ci_esteticistas])
        : (ci_esteticista ? [ci_esteticista] : []);

    if (!ci_cliente || !ciEstArr.length || !fecha || !hora || !metodo_pago) {
        return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const clRes = await client.query('SELECT id_cliente FROM clientes WHERE ci_usuario = $1', [ci_cliente]);
        if (!clRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
        }
        const id_cliente = clRes.rows[0].id_cliente;

        // Calcular monto una sola vez
        let monto = 0;
        if (id_servicio) {
            const pr = await client.query('SELECT precio FROM servicios WHERE id_servicio=$1', [id_servicio]);
            monto = parseFloat(pr.rows[0]?.precio || 0);
        } else if (id_paquete) {
            const pr = await client.query('SELECT precio_promocional FROM paquetes WHERE id_paquete=$1', [id_paquete]);
            monto = parseFloat(pr.rows[0]?.precio_promocional || 0);
        }

        for (const ci_est of ciEstArr) {
            const perRes = await client.query('SELECT id_esteticista FROM personal WHERE ci_usuario=$1', [ci_est]);
            if (!perRes.rows.length) continue;
            const id_esteticista = perRes.rows[0].id_esteticista;

            // Verificar conflicto individual
            const check = await client.query(
                "SELECT id_cita FROM reservas WHERE id_esteticista=$1 AND fecha=$2 AND hora=$3 AND estado!='Cancelada'",
                [id_esteticista, fecha, hora]
            );
            if (check.rows.length > 0) {
                await client.query('ROLLBACK');
                const nomRes = await pool.query('SELECT nombre FROM usuarios WHERE ci=$1', [ci_est]);
                const nom = nomRes.rows[0]?.nombre || ci_est;
                return res.status(409).json({ success: false, message: `${nom} ya tiene una reserva en ese horario. Elige otra hora.` });
            }

            // Insertar reserva
            const resR = await client.query(
                "INSERT INTO reservas (id_cliente, id_esteticista, fecha, hora, estado) VALUES ($1,$2,$3,$4,'Pendiente') RETURNING id_cita",
                [id_cliente, id_esteticista, fecha, hora]
            );
            const id_cita = resR.rows[0].id_cita;

            // Insertar detalle_reserva
            if (id_servicio) {
                await client.query('INSERT INTO detalle_reserva (id_cita, id_servicio) VALUES ($1,$2)', [id_cita, id_servicio]);
            } else if (id_paquete) {
                const srvs = await client.query('SELECT id_servicio FROM detalle_paquete WHERE id_paquete=$1', [id_paquete]);
                for (const s of srvs.rows) {
                    await client.query(
                        'INSERT INTO detalle_reserva (id_cita, id_servicio) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                        [id_cita, s.id_servicio]
                    );
                }
            }

            // Insertar pago
            await client.query('INSERT INTO pagos (id_cita, monto, metodo_pago) VALUES ($1,$2,$3)', [id_cita, monto, metodo_pago]);
        }

        await client.query('COMMIT');
        const n = ciEstArr.length;
        res.json({ success: true, message: `¡${n > 1 ? n + ' reservas creadas' : 'Reserva creada'} exitosamente!` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: 'Error al guardar la reserva: ' + err.message });
    } finally { client.release(); }
});

// Reservas de un cliente (panel cliente)
app.get('/api/reservas/cliente/:ci', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.id_cita, r.fecha, r.hora, r.estado,
                   STRING_AGG(s.nombre_servicio, ', ') AS nombre_item,
                   ue.nombre AS nombre_esteticista,
                   pe.ci_usuario AS ci_esteticista,
                   pg.metodo_pago, pg.monto
            FROM reservas r
            JOIN clientes cl   ON r.id_cliente    = cl.id_cliente
            JOIN personal pe   ON r.id_esteticista= pe.id_esteticista
            JOIN usuarios ue   ON pe.ci_usuario   = ue.ci
            LEFT JOIN detalle_reserva dr ON r.id_cita = dr.id_cita
            LEFT JOIN servicios s        ON dr.id_servicio = s.id_servicio
            LEFT JOIN pagos pg           ON r.id_cita = pg.id_cita
            WHERE cl.ci_usuario = $1
            GROUP BY r.id_cita, r.fecha, r.hora, r.estado, ue.nombre, pe.ci_usuario, pg.metodo_pago, pg.monto
            ORDER BY r.fecha DESC, r.hora DESC
        `, [req.params.ci]);
        res.json({ success: true, reservas: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Cancela una reserva: envía correos y elimina de la BD
app.delete('/api/reservas/:id_cita', async (req, res) => {
    const { id_cita } = req.params;
    try {
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

        if (!infoRes.rows.length) return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });

        const info = infoRes.rows[0];
        const fStr = String(info.fecha).substring(0, 10);
        const [fy, fm, fd] = fStr.split('-');
        const mesesS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const fechaLegible = `${parseInt(fd)} de ${mesesS[parseInt(fm) - 1]} de ${fy}`;
        const horaStr = (info.hora || '').substring(0, 5);

        await pool.query('DELETE FROM reservas WHERE id_cita = $1', [id_cita]);

        const htmlBase = (titulo, destinatario, cuerpo) => `
            <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
                <h2 style="color:#d4a373;">${titulo}</h2>
                <p>Hola <strong>${destinatario}</strong>,</p>
                ${cuerpo}
                <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
                <p style="font-size:12px;color:#999;">Correo automático — Salón de Belleza HISAMI</p>
            </div>`;

        transporter.sendMail({
            from: '"Salón HISAMI" <no-reply@hisami.com>',
            to: info.email_cliente,
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
        }).catch(e => console.error('Email cliente cancelación:', e.message));

        transporter.sendMail({
            from: '"Salón HISAMI" <no-reply@hisami.com>',
            to: info.email_esteticista,
            subject: 'Aviso HISAMI: una reserva fue cancelada',
            html: htmlBase('Reserva Cancelada', info.nombre_esteticista, `
                <p>Una reserva asignada a ti ha sido cancelada por el cliente.</p>
                <div style="background:#f9f9f9;padding:15px;border-radius:8px;border:1px solid #ddd;margin:16px 0;">
                    <p><strong>Cliente:</strong> ${info.nombre_cliente}</p>
                    <p><strong>Servicio(s):</strong> ${info.servicios || '—'}</p>
                    <p><strong>Fecha:</strong> ${fechaLegible}</p>
                    <p><strong>Hora:</strong> ${horaStr}</p>
                </div>`)
        }).catch(e => console.error('Email esteticista cancelación:', e.message));

        res.json({ success: true, message: 'Reserva cancelada. Se enviaron correos de notificación.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Reservas asignadas a un esteticista (panel personal + badge)
app.get('/api/reservas/esteticista/:ci', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.id_cita, r.fecha, r.hora, r.estado,
                   STRING_AGG(s.nombre_servicio, ', ') AS nombre_item,
                   uc.nombre AS nombre_cliente,
                   pg.metodo_pago, pg.monto
            FROM reservas r
            JOIN personal pe  ON r.id_esteticista = pe.id_esteticista
            JOIN clientes cl  ON r.id_cliente      = cl.id_cliente
            JOIN usuarios uc  ON cl.ci_usuario     = uc.ci
            LEFT JOIN detalle_reserva dr ON r.id_cita = dr.id_cita
            LEFT JOIN servicios s        ON dr.id_servicio = s.id_servicio
            LEFT JOIN pagos pg           ON r.id_cita = pg.id_cita
            WHERE pe.ci_usuario = $1
            GROUP BY r.id_cita, r.fecha, r.hora, r.estado, uc.nombre, pg.metodo_pago, pg.monto
            ORDER BY r.fecha ASC, r.hora ASC
        `, [req.params.ci]);
        res.json({ success: true, reservas: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor HISAMI funcionando en http://localhost:${PORT}`);
});