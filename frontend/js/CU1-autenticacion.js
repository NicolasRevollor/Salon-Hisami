// =============================================================================
// CU1-autenticacion.js — INICIO DE SESIÓN, REGISTRO Y RECUPERACIÓN DE CONTRASEÑA
// Depende de: main.js (API_BASE, usuarioActual, mostrarToast, mostrarSeccion,
//             cambiarPestana, actualizarNavbar, cargarPerfil, timerBloqueo,
//             validarContrasena, cerrarModalConfig)
// =============================================================================

// =============================================================================
// CU1 — INICIAR SESIÓN
// Envía email y contraseña al servidor y maneja la respuesta:
//   - Éxito     → guarda usuario y redirige a su panel
//   - 429       → cuenta bloqueada → inicia countdown visual
//   - 401       → credenciales incorrectas → muestra cuántos intentos restan
// =============================================================================
async function manejarLogin(e) {
    e.preventDefault(); // Evitar que el formulario recargue la página

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validación básica en el cliente antes de ir al servidor
    if (!email)    { mostrarToast('Ingresa tu correo electrónico', 'error'); return; }
    if (!password) { mostrarToast('Ingresa tu contraseña', 'error'); return; }

    try {
        const res  = await fetch(API_BASE + '/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, contrasena: password })
        });
        const data = await res.json();

        if (res.status === 429) {
            // Cuenta bloqueada → extraer los segundos del mensaje y mostrar cuenta regresiva
            const match = data.message.match(/(\d+)\s*segundo/);
            iniciarCuentaRegresiva(match ? parseInt(match[1]) : 30, data.message);
        } else if (data.success) {
            // Login exitoso → guardar datos del usuario y navegar a su panel
            usuarioActual = data.user;
            actualizarNavbar();
            cargarPerfil(); // redirige al panel correspondiente según el rol
        } else {
            // Credenciales incorrectas
            mostrarToast(data.message || 'Credenciales incorrectas', 'error');
        }
    } catch {
        mostrarToast('Error de conexión con el servidor', 'error');
    }
}

// Muestra un contador regresivo en el botón de login mientras la cuenta está bloqueada.
// segundos       → cuántos segundos dura el bloqueo
// mensajeInicial → mensaje que viene del servidor para mostrar en el toast
function iniciarCuentaRegresiva(segundos, mensajeInicial) {
    const btn = document.getElementById('btn-login-submit');
    if (timerBloqueo) clearInterval(timerBloqueo); // cancelar cualquier countdown previo
    let restantes = segundos;

    // Deshabilitar el botón para que el usuario no pueda intentar de nuevo
    if (btn) btn.disabled = true;
    mostrarToast(mensajeInicial || `Bloqueado por ${restantes}s`, 'error');

    // Cada segundo decrementa el contador y actualiza el texto del botón
    timerBloqueo = setInterval(() => {
        restantes--;
        if (btn) btn.textContent = `Bloqueado (${restantes}s)`;
        if (restantes <= 0) {
            clearInterval(timerBloqueo);
            timerBloqueo = null;
            // Re-habilitar el botón cuando termine el bloqueo
            if (btn) {
                btn.disabled  = false;
                btn.textContent = 'Ingresar al Sistema';
            }
            mostrarToast('Ya puedes intentar nuevamente');
        }
    }, 1000);
}

// =============================================================================
// CU1 — REGISTRO DE NUEVO CLIENTE
// Valida los campos en el cliente, luego envía al servidor para crear la cuenta.
// Si el servidor acepta, muestra el formulario de login listo para usar.
// =============================================================================
async function manejarRegistro(e) {
    e.preventDefault();

    const ci       = document.getElementById('reg-ci').value.trim();
    const nombre   = document.getElementById('reg-nombre').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmar = document.getElementById('reg-confirmar').value;

    // Validaciones en orden — mostrar error y detener si algo falta
    if (!ci)      { mostrarToast('El CI es obligatorio', 'error'); return; }
    if (!nombre)  { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!email)   { mostrarToast('El correo es obligatorio', 'error'); return; }
    if (!password){ mostrarToast('Ingresa una contraseña', 'error'); return; }
    if (password !== confirmar) { mostrarToast('Las contraseñas no coinciden', 'error'); return; }
    if (!validarContrasena(password)) {
        mostrarToast('La contraseña debe tener al menos: 1 número, 1 mayúscula y 1 símbolo', 'error'); return;
    }

    try {
        const res  = await fetch(API_BASE + '/registro', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ci, nombre, telefono, email, contrasena: password })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('¡Registro exitoso! Credenciales enviadas a ' + email);
            cambiarPestana('login');
            document.getElementById('registro-form').reset(); // limpiar el formulario
        } else {
            mostrarToast(data.message || 'Error en el registro', 'error');
        }
    } catch {
        mostrarToast('Error de conexión con el servidor', 'error');
    }
}

// =============================================================================
// CU1 — CAMBIAR CONTRASEÑA (desde el panel de Configuración)
// El usuario debe escribir su contraseña actual para confirmar la identidad.
// =============================================================================
async function manejarCambioPassword(e) {
    e.preventDefault();
    if (!usuarioActual) return; // nunca debería pasar, pero por seguridad

    const actual = document.getElementById('pass-actual').value;
    const nueva  = document.getElementById('pass-nueva').value;

    if (!actual) { mostrarToast('Ingresa tu contraseña actual', 'error'); return; }
    if (!nueva)  { mostrarToast('Ingresa la nueva contraseña', 'error'); return; }
    if (!validarContrasena(nueva)) {
        mostrarToast('La nueva contraseña debe tener: 1 número, 1 mayúscula y 1 símbolo', 'error'); return;
    }

    try {
        const res  = await fetch(API_BASE + '/cambiar-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email: usuarioActual.email, passwordActual: actual, passwordNueva: nueva })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast(data.message || 'Contraseña actualizada');
            cerrarModalConfig();
            document.getElementById('form-cambio-password').reset();
        } else {
            mostrarToast(data.message || 'Contraseña actual incorrecta', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// CU2 — CERRAR SESIÓN
// Registra el logout en la bitácora y limpia los datos del usuario en memoria.
// =============================================================================
function cerrarSesion() {
    if (usuarioActual) {
        // Registrar en bitácora ANTES de borrar los datos del usuario
        fetch(API_BASE + '/api/bitacora', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                ci_usuario:     usuarioActual.ci,
                nombre_usuario: usuarioActual.nombre,
                rol:            usuarioActual.rol,
                accion:         'LOGOUT',
                descripcion:    'Cierre de sesión'
            })
        }).catch(() => {}); // silencioso — no bloquear el logout por un error de red
    }

    usuarioActual = null;
    menuUsuario   = [];
    actualizarNavbar();
    irAInicio();
    mostrarToast('Sesión cerrada');
}


// =============================================================================
// CU1 — RECUPERACIÓN DE CONTRASEÑA (2 pasos)
// Paso 1: El usuario escribe su email → el servidor genera un código y lo envía
// Paso 2: El usuario escribe el código + nueva contraseña → se actualiza en BD
// =============================================================================

// Muestra el formulario de recuperación (primer paso: pedir el email)
function mostrarRecuperacion() {
    document.getElementById('login-form').style.display          = 'none';
    document.getElementById('recuperacion-form').style.display   = 'block';
    document.getElementById('paso-email-recup').style.display    = 'block';
    document.getElementById('paso-token-recup').style.display    = 'none';
}

// Paso 1: Envía el email al servidor para solicitar el código temporal
function enviarCodigoRecuperacion() {
    const email = document.getElementById('recup-email').value.trim();
    if (!email) { mostrarToast('Ingresa tu correo electrónico', 'error'); return; }

    fetch(API_BASE + '/api/recuperar-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            // Avanzar al paso 2: mostrar el formulario para ingresar el código
            document.getElementById('paso-email-recup').style.display = 'none';
            document.getElementById('paso-token-recup').style.display  = 'block';
            mostrarToast('Código enviado a ' + email);
        } else {
            mostrarToast(data.message || 'Error', 'error');
        }
    })
    .catch(() => mostrarToast('Error de conexión', 'error'));
}

// Paso 2: Envía el código y la nueva contraseña al servidor para restablecerla
function restablecerConContrasena() {
    const email     = document.getElementById('recup-email').value.trim();
    const token     = document.getElementById('recup-token').value.trim();
    const nuevaPass = document.getElementById('recup-password').value;

    if (!token)    { mostrarToast('Ingresa el código temporal', 'error'); return; }
    if (!nuevaPass){ mostrarToast('Ingresa la nueva contraseña', 'error'); return; }
    if (!validarContrasena(nuevaPass)) {
        mostrarToast('La contraseña debe tener: 1 número, 1 mayúscula y 1 símbolo', 'error'); return;
    }

    fetch(API_BASE + '/api/restablecer-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, token, nuevaPassword: nuevaPass })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            mostrarToast('Contraseña actualizada exitosamente.');
            volverALogin(); // Volver al formulario de login para que ingrese con la nueva clave
        } else {
            mostrarToast(data.message || 'Código inválido o expirado', 'error');
        }
    })
    .catch(() => mostrarToast('Error de conexión', 'error'));
}

// Regresa al formulario de login desde la pantalla de recuperación
function volverALogin() {
    document.getElementById('recuperacion-form').style.display = 'none';
    document.getElementById('login-form').style.display        = 'block';
}
