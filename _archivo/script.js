// =============================================================================
// CONFIGURACIÓN GLOBAL
// =============================================================================
const API_BASE = 'http://localhost:3000';
let usuarioActual    = null;
let menuUsuario      = [];
let catalogoCompleto = [];
let serviciosCache   = {};
let empleadosCache   = {};
let paquetesCache    = {};
let espCrearSeleccionadas = [];
let timerBloqueo     = null; // countdown de bloqueo de login

// =============================================================================
// INICIALIZACIÓN
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    cargarServiciosDeBD();
    configurarFormularios();
});

function configurarFormularios() {
    document.getElementById('login-form').addEventListener('submit', manejarLogin);
    document.getElementById('registro-form').addEventListener('submit', manejarRegistro);
    document.getElementById('form-cambio-password').addEventListener('submit', manejarCambioPassword);
    document.getElementById('form-admin-servicio').addEventListener('submit', manejarGuardarServicio);
    document.getElementById('form-admin-empleado').addEventListener('submit', manejarGuardarEmpleado);
    document.getElementById('form-editar-empleado').addEventListener('submit', manejarEditarEmpleado);
    document.getElementById('form-categoria').addEventListener('submit', manejarGuardarCategoria);
    document.getElementById('form-paquete').addEventListener('submit', manejarGuardarPaquete);
    document.getElementById('form-reserva').addEventListener('submit', manejarConfirmarReserva);
}

// =============================================================================
// UTILIDADES
// =============================================================================
function togglePasswordVisibility(inputId, iconSpan) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        iconSpan.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06 5.06m-4.97-4.97A9.12 9.12 0 0 1 12 7a9 9 0 0 1 4.94 2.06"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    } else {
        input.type = 'password';
        iconSpan.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
}

// Valida contraseña: mínimo 1 número, 1 mayúscula y 1 carácter especial
function validarContrasena(pass) {
    return /(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(pass);
}

// Formatea "YYYY-MM-DD" (o ISO) como "15 de enero de 2025" — sin problemas de zona horaria
function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    const s = String(fechaStr).substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(fechaStr);
    const [y, m, d] = s.split('-').map(Number);
    const meses = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${d} de ${meses[m - 1]} de ${y}`;
}

// Versión corta: "15 ene. 2025"
function formatearFechaCorta(fechaStr) {
    if (!fechaStr) return '—';
    const s = String(fechaStr).substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(fechaStr);
    const [y, m, d] = s.split('-').map(Number);
    const meses = ['ene.','feb.','mar.','abr.','may.','jun.',
                   'jul.','ago.','sep.','oct.','nov.','dic.'];
    return `${d} ${meses[m - 1]} ${y}`;
}

// =============================================================================
// MENÚ HAMBURGUESA
// =============================================================================
function toggleMobileMenu() {
    const nav = document.getElementById('nav-menu-movil');
    if (!nav) return;
    const active = nav.classList.toggle('active');
    if (active) cargarPaquetesEnMenuMovil();
}

function cargarPaquetesEnMenuMovil() {
    const nav = document.getElementById('nav-menu-movil');
    if (!nav) return;
    nav.innerHTML = '<p style="padding:20px; color:#666;">Cargando...</p>';
    fetch(API_BASE + '/api/admin/paquetes-sistema')
        .then(r => r.json())
        .then(data => {
            if (!data.paquetes || !data.paquetes.length) {
                nav.innerHTML = '<p style="padding:20px; color:#666;">Sin paquetes</p>'; return;
            }
            nav.innerHTML = '';
            data.paquetes.forEach(paq => {
                const div = document.createElement('div');
                div.style.cssText = 'padding:15px 20px; border-bottom:1px solid #eee;';
                const titulo = document.createElement('div');
                titulo.style.cssText = 'display:flex; justify-content:space-between; font-weight:600; cursor:pointer;';
                titulo.innerHTML = paq.nombre + ' <span>▼</span>';
                titulo.onclick = e => { e.stopPropagation(); toggleSubmenu(paq.id_paquete_sist); };
                const sub = document.createElement('div');
                sub.id = 'submenu-' + paq.id_paquete_sist;
                sub.style.cssText = 'display:none; padding:8px 0 8px 20px;';
                if (Array.isArray(paq.casos_uso)) {
                    paq.casos_uso.forEach(cu => {
                        if (!cu || !cu.nombre) return;
                        const a = document.createElement('a');
                        a.href = '#';
                        a.style.cssText = 'display:block; padding:7px 15px; color:#555; text-decoration:none; font-size:13px;';
                        a.textContent = cu.nombre === 'Iniciar Sesión' ? 'Registrarse' : cu.nombre;
                        a.onclick = e => { e.preventDefault(); !usuarioActual ? mostrarSeccion('login') : navegarCU(cu.nombre); };
                        sub.appendChild(a);
                    });
                }
                div.appendChild(titulo);
                div.appendChild(sub);
                nav.appendChild(div);
            });
        })
        .catch(() => { nav.innerHTML = '<p style="color:red;padding:20px;">Error al cargar</p>'; });
}

function toggleSubmenu(id) {
    const s = document.getElementById('submenu-' + id);
    if (!s) return;
    document.querySelectorAll('[id^="submenu-"]').forEach(x => { if (x !== s) x.style.display = 'none'; });
    s.style.display = s.style.display === 'block' ? 'none' : 'block';
}

// =============================================================================
// NAVEGACIÓN
// =============================================================================
function mostrarSeccion(id) {
    window.scrollTo(0, 0);
    document.getElementById('main-landing').classList.add('seccion-oculta');
    document.querySelectorAll('.sistema-section').forEach(s => s.classList.add('seccion-oculta'));
    if (id === 'landing') {
        document.getElementById('main-landing').classList.remove('seccion-oculta');
        document.getElementById('navbar').style.display = 'flex';
    } else {
        const sec = document.getElementById(id);
        if (sec) sec.classList.remove('seccion-oculta');
        document.getElementById('navbar').style.display = id === 'login' ? 'none' : 'flex';
    }
}

function irAInicio()   { mostrarSeccion('landing'); }
function irARegistro() { mostrarSeccion('login'); cambiarPestana('registro'); }

// Botón "Reservar Cita" en la landing: si está logueado abre CU3, si no va a login
function accionReservarCita() {
    if (usuarioActual) {
        mostrarSeccion('panel-cliente');
        abrirModalReserva();
    } else {
        mostrarSeccion('login');
    }
}

// Devuelve array de { ci, nombre } según el tipo de reserva seleccionado
function getEsteticistasSeleccionadas() {
    const tipo = document.querySelector('input[name="tipo-reserva"]:checked')?.value;
    if (tipo === 'paquete') {
        return Array.from(document.querySelectorAll('#reserva-esteticistas-checks input[type="checkbox"]:checked'))
            .map(cb => ({ ci: cb.value, nombre: cb.dataset.nombre }));
    }
    const sel = document.getElementById('reserva-esteticista');
    if (!sel || !sel.value) return [];
    return [{ ci: sel.value, nombre: sel.options[sel.selectedIndex]?.text || '' }];
}

function cambiarPestana(p) {
    const esLogin = p === 'login';
    document.getElementById('login-form').style.display       = esLogin ? 'block' : 'none';
    document.getElementById('registro-form').style.display    = esLogin ? 'none'  : 'block';
    document.getElementById('recuperacion-form').style.display = 'none';
    document.getElementById('btn-tab-login').classList.toggle('active', esLogin);
    document.getElementById('btn-tab-registro').classList.toggle('active', !esLogin);
}

function cargarPerfil() {
    if (!usuarioActual) return;
    mostrarToast('Bienvenido, ' + usuarioActual.nombre);
    if (usuarioActual.rol === 'Administrador') {
        mostrarSeccion('panel-admin'); cambiarTabAdmin('servicios');
    } else if (usuarioActual.rol === 'Personal') {
        mostrarSeccion('panel-personal');
        cambiarTabPersonal('agenda');
        cargarReservasEsteticista(); // Cargar automáticamente para notificaciones
    } else {
        mostrarSeccion('panel-cliente');
        cargarReservasCliente();
    }
}

function navegarCU(nombreCU) {
    const nav = document.getElementById('nav-menu-movil');
    if (nav) nav.classList.remove('active');
    if (nombreCU === 'Mi Perfil')     { cargarPerfil(); return; }
    if (nombreCU === 'Cerrar Sesión') { cerrarSesion(); return; }
    if (!usuarioActual) { mostrarToast('Debes iniciar sesión', 'error'); return; }

    if (usuarioActual.rol === 'Administrador') {
        mostrarSeccion('panel-admin');
        const tab = nombreCU.includes('Servicios')   ? 'servicios'
                  : nombreCU.includes('Personal')    ? 'empleados'
                  : nombreCU.includes('Accesos')     ? 'sesiones'
                  : nombreCU.includes('Privilegios') ? 'privilegios' : 'servicios';
        cambiarTabAdmin(tab); return;
    }
    if (usuarioActual.rol === 'Personal') {
        mostrarSeccion('panel-personal');
        cambiarTabPersonal(nombreCU.includes('Agenda') ? 'agenda' : 'comisiones'); return;
    }
    // Cliente
    if (nombreCU === 'Ver Catálogo' || nombreCU === 'Catálogo') mostrarSeccion('landing');
    else if (nombreCU.includes('Reserva') || nombreCU === 'Reservar Cita') {
        mostrarSeccion('panel-cliente'); abrirModalReserva();
    } else mostrarSeccion('panel-cliente');
}

// =============================================================================
// AUTENTICACIÓN
// =============================================================================
async function manejarLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email)    { mostrarToast('Ingresa tu correo electrónico', 'error'); return; }
    if (!password) { mostrarToast('Ingresa tu contraseña', 'error'); return; }

    try {
        const res  = await fetch(API_BASE + '/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, contrasena: password })
        });
        const data = await res.json();
        if (res.status === 429) {
            // Extraer segundos del mensaje del servidor
            const match = data.message.match(/(\d+)\s*segundo/);
            iniciarCuentaRegresiva(match ? parseInt(match[1]) : 30, data.message);
        } else if (data.success) {
            usuarioActual = data.user;
            mostrarSeccion('landing');
            actualizarNavbar();
            mostrarToast('Bienvenido, ' + data.user.nombre);
        } else { mostrarToast(data.message || 'Credenciales incorrectas', 'error'); }
    } catch { mostrarToast('Error de conexión con el servidor', 'error'); }
}

function iniciarCuentaRegresiva(segundos, mensajeInicial) {
    const btn = document.getElementById('btn-login-submit');
    if (timerBloqueo) clearInterval(timerBloqueo);
    let restantes = segundos;
    if (btn) btn.disabled = true;
    mostrarToast(mensajeInicial || `Cuenta bloqueada ${restantes}s`, 'error');
    timerBloqueo = setInterval(() => {
        restantes--;
        if (btn) btn.textContent = `Bloqueado (${restantes}s)`;
        if (restantes <= 0) {
            clearInterval(timerBloqueo);
            timerBloqueo = null;
            if (btn) { btn.disabled = false; btn.textContent = 'Ingresar al Sistema'; }
            mostrarToast('Ya puedes intentar nuevamente');
        }
    }, 1000);
}

async function manejarRegistro(e) {
    e.preventDefault();
    const ci       = document.getElementById('reg-ci').value.trim();
    const nombre   = document.getElementById('reg-nombre').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmar= document.getElementById('reg-confirmar').value;

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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ci, nombre, telefono, email, contrasena: password })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('¡Registro exitoso! Credenciales enviadas a ' + email);
            cambiarPestana('login');
            document.getElementById('registro-form').reset();
        } else { mostrarToast(data.message || 'Error en el registro', 'error'); }
    } catch { mostrarToast('Error de conexión con el servidor', 'error'); }
}

async function manejarCambioPassword(e) {
    e.preventDefault();
    if (!usuarioActual) return;
    const actual = document.getElementById('pass-actual').value;
    const nueva  = document.getElementById('pass-nueva').value;
    if (!actual) { mostrarToast('Ingresa tu contraseña actual', 'error'); return; }
    if (!nueva)  { mostrarToast('Ingresa la nueva contraseña', 'error'); return; }
    if (!validarContrasena(nueva)) {
        mostrarToast('La nueva contraseña debe tener: 1 número, 1 mayúscula y 1 símbolo', 'error'); return;
    }
    try {
        const res  = await fetch(API_BASE + '/cambiar-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: usuarioActual.email, passwordActual: actual, passwordNueva: nueva })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast(data.message || 'Contraseña actualizada');
            cerrarModalConfig();
            document.getElementById('form-cambio-password').reset();
        } else { mostrarToast(data.message || 'Contraseña actual incorrecta', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

function cerrarSesion() {
    usuarioActual = null; menuUsuario = [];
    actualizarNavbar(); irAInicio(); mostrarToast('Sesión cerrada');
}

// Recuperación de contraseña (2 pasos)
function mostrarRecuperacion() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('recuperacion-form').style.display = 'block';
    document.getElementById('paso-email-recup').style.display = 'block';
    document.getElementById('paso-token-recup').style.display  = 'none';
}
function enviarCodigoRecuperacion() {
    const email = document.getElementById('recup-email').value.trim();
    if (!email) { mostrarToast('Ingresa tu correo electrónico', 'error'); return; }
    fetch(API_BASE + '/api/recuperar-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
    }).then(r => r.json()).then(data => {
        if (data.success) {
            document.getElementById('paso-email-recup').style.display = 'none';
            document.getElementById('paso-token-recup').style.display  = 'block';
            mostrarToast('Código enviado a ' + email);
        } else { mostrarToast(data.message || 'Error', 'error'); }
    }).catch(() => mostrarToast('Error de conexión', 'error'));
}
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, nuevaPassword: nuevaPass })
    }).then(r => r.json()).then(data => {
        if (data.success) { mostrarToast('Contraseña actualizada.'); volverALogin(); }
        else { mostrarToast(data.message || 'Código inválido o expirado', 'error'); }
    }).catch(() => mostrarToast('Error de conexión', 'error'));
}
function volverALogin() {
    document.getElementById('recuperacion-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

// =============================================================================
// NAVBAR
// =============================================================================
function actualizarNavbar() {
    if (usuarioActual) {
        document.getElementById('nav-actions-public').style.display = 'none';
        document.getElementById('nav-actions-logged').style.display = 'flex';
        document.getElementById('nav-user-welcome').innerHTML =
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ' +
            usuarioActual.nombre.split(' ')[0] + ' (' + usuarioActual.rol + ')';
        cargarMenuUsuario(usuarioActual.ci);
    } else {
        document.getElementById('nav-actions-public').style.display = 'flex';
        document.getElementById('nav-actions-logged').style.display = 'none';
        const nav = document.getElementById('nav-menu-movil');
        if (nav) nav.innerHTML = '';
    }
}
async function cargarMenuUsuario(ci) {
    try {
        const res  = await fetch(API_BASE + '/api/menus-usuario/' + ci);
        const data = await res.json();
        if (data.success) menuUsuario = data.menu;
    } catch (err) { console.error('Error cargando menú:', err); }
}

// =============================================================================
// CATÁLOGO PÚBLICO (landing) — carga servicios y genera botones de filtro desde BD
// =============================================================================
async function cargarServiciosDeBD() {
    try {
        const [resServ, resCat] = await Promise.all([
            fetch(API_BASE + '/api/servicios'),
            fetch(API_BASE + '/api/categorias')
        ]);
        const [dataServ, dataCat] = await Promise.all([resServ.json(), resCat.json()]);
        if (dataServ.success) { catalogoCompleto = dataServ.servicios; mostrarServicios(dataServ.servicios); }
        if (dataCat.success)  generarBotonesFiltro(dataCat.categorias);
    } catch (err) { console.error('Error cargando catálogo:', err); }
}

function generarBotonesFiltro(categorias) {
    const cont = document.getElementById('contenedor-filtros');
    if (!cont) return;
    cont.innerHTML = '';
    const btnTodos = document.createElement('button');
    btnTodos.className = 'btn-filtro activo';
    btnTodos.textContent = 'Todos';
    btnTodos.onclick = function() { filtrarServicios('todos', this); };
    cont.appendChild(btnTodos);
    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'btn-filtro';
        btn.textContent = cat.nombre;
        btn.onclick = function() { filtrarServicios(cat.nombre, this); };
        cont.appendChild(btn);
    });
}

function mostrarServicios(servicios) {
    const cont = document.getElementById('contenedor-servicios');
    if (!cont) return;
    cont.innerHTML = '';
    servicios.forEach(s => {
        const card = document.createElement('div');
        card.className = 'card-servicio';
        card.innerHTML = `
            <span class="badge-categoria">${s.nombre_categoria || 'General'}</span>
            <h3>${s.nombre_servicio}</h3>
            <p>${s.descripcion || 'Servicio profesional'}</p>
            <div class="card-footer">
                <span class="card-precio">Bs ${parseFloat(s.precio).toFixed(2)}</span>
                <span style="color:#888;font-size:13px;">${s.duracion_minutos || ''} min</span>
            </div>`;
        cont.appendChild(card);
    });
}

function filtrarServicios(categoria, btn) {
    document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('activo'));
    if (btn) btn.classList.add('activo');
    const filtrados = categoria === 'todos'
        ? catalogoCompleto
        : catalogoCompleto.filter(s => s.nombre_categoria && s.nombre_categoria.toLowerCase() === categoria.toLowerCase());
    mostrarServicios(filtrados);
}

// =============================================================================
// PANEL ADMIN — TABS (servicios, empleados, categorias, paquetes, sesiones, privilegios)
// =============================================================================
const TABS_ADMIN = ['servicios','empleados','categorias','paquetes','sesiones','privilegios'];

function cambiarTabAdmin(tab) {
    TABS_ADMIN.forEach(t => {
        document.getElementById('vista-admin-' + t).classList.add('seccion-oculta');
        document.getElementById('tab-admin-' + t).classList.remove('active');
    });
    document.getElementById('vista-admin-' + tab).classList.remove('seccion-oculta');
    document.getElementById('tab-admin-' + tab).classList.add('active');
    if (tab === 'servicios')  cargarServiciosAdmin();
    if (tab === 'empleados')  cargarEmpleadosAdmin();
    if (tab === 'categorias') cargarCategoriasAdmin();
    if (tab === 'paquetes')   cargarPaquetesAdmin();
    if (tab === 'sesiones')   cargarSesionesAdmin();
}

// =============================================================================
// ADMIN — SERVICIOS (crear, editar, eliminar)
// =============================================================================
async function cargarServiciosAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/servicios');
        const data = await res.json();
        if (!data.success) return;
        serviciosCache = {};
        const tbody = document.getElementById('tabla-admin-servicios-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.servicios.forEach(s => {
            serviciosCache[s.id_servicio] = s;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${s.id_servicio}</td><td>${s.nombre_servicio}</td>
                <td>Bs ${parseFloat(s.precio).toFixed(2)}</td><td>${s.nombre_categoria || 'N/A'}</td>
                <td>
                    <button class="btn-table" onclick="abrirModalAdminServicio(${s.id_servicio})">Editar</button>
                    <button class="btn-table-danger" onclick="eliminarServicio(${s.id_servicio},'${s.nombre_servicio.replace(/'/g,"\\'")}')">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error servicios admin:', err); }
}

async function abrirModalAdminServicio(idServicio = null) {
    document.getElementById('form-admin-servicio').reset();
    if (idServicio !== null) {
        const s = serviciosCache[idServicio];
        if (!s) { mostrarToast('Servicio no encontrado', 'error'); return; }
        document.getElementById('titulo-modal-servicio').textContent = 'Editar Servicio';
        document.getElementById('admin-serv-id').value     = s.id_servicio;
        document.getElementById('admin-serv-nombre').value = s.nombre_servicio;
        document.getElementById('admin-serv-desc').value   = s.descripcion || '';
        document.getElementById('admin-serv-precio').value = s.precio;
        await cargarCategoriasEnSelect('admin-serv-cat', s.id_categoria);
    } else {
        document.getElementById('titulo-modal-servicio').textContent = 'Nuevo Servicio';
        document.getElementById('admin-serv-id').value = '';
        await cargarCategoriasEnSelect('admin-serv-cat', null);
    }
    document.getElementById('modal-admin-servicio').classList.remove('seccion-oculta');
}
function cerrarModalAdminServicio() {
    document.getElementById('modal-admin-servicio').classList.add('seccion-oculta');
}

async function cargarCategoriasEnSelect(selectId, valorSeleccionado) {
    try {
        const res  = await fetch(API_BASE + '/api/categorias');
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        sel.innerHTML = '<option value="">-- Selecciona categoría --</option>';
        if (data.success) data.categorias.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id_categoria; opt.textContent = cat.nombre;
            if (valorSeleccionado && String(cat.id_categoria) === String(valorSeleccionado)) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (err) { console.error('Error categorías en select:', err); }
}

async function manejarGuardarServicio(e) {
    e.preventDefault();
    const id             = document.getElementById('admin-serv-id').value;
    const nombre_servicio= document.getElementById('admin-serv-nombre').value.trim();
    const descripcion    = document.getElementById('admin-serv-desc').value.trim();
    const precio         = parseFloat(document.getElementById('admin-serv-precio').value);
    const id_categoria   = document.getElementById('admin-serv-cat').value;
    if (!nombre_servicio) { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!precio || precio <= 0) { mostrarToast('Ingresa un precio válido', 'error'); return; }
    if (!id_categoria)   { mostrarToast('Selecciona una categoría', 'error'); return; }
    try {
        const url    = id ? `${API_BASE}/api/admin/servicios/${id}` : `${API_BASE}/api/admin/servicios`;
        const method = id ? 'PUT' : 'POST';
        const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre_servicio, descripcion, precio, id_categoria }) });
        const data = await res.json();
        if (data.success) {
            mostrarToast(id ? 'Servicio actualizado' : 'Servicio creado');
            cerrarModalAdminServicio(); cargarServiciosAdmin(); cargarServiciosDeBD();
        } else { mostrarToast(data.message || 'Error al guardar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

async function eliminarServicio(id, nombre) {
    if (!confirm(`¿Eliminar el servicio "${nombre}"?`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/admin/servicios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { mostrarToast('Servicio eliminado'); cargarServiciosAdmin(); cargarServiciosDeBD(); }
        else { mostrarToast(data.message || 'Error al eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// ADMIN — PERSONAL (crear con especialidades, editar, eliminar)
// =============================================================================
async function cargarEmpleadosAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/empleados');
        const data = await res.json();
        if (!data.success) return;
        empleadosCache = {};
        const tbody = document.getElementById('tabla-admin-empleados-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.empleados.forEach(emp => {
            empleadosCache[emp.ci] = emp;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${emp.nombre}</td><td>${emp.ci}</td><td>${emp.telefono||'N/A'}</td>
                <td>${emp.email}</td><td>${emp.especialidades||'—'}</td>
                <td>
                    <button class="btn-table" onclick="abrirModalEditarEmpleado('${emp.ci}')">Editar</button>
                    <button class="btn-table-danger" onclick="eliminarEmpleado('${emp.ci}','${emp.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error empleados admin:', err); }
}

// Abre modal de CREAR empleado con selector dinámico de especialidades
async function abrirModalAdminEmpleado() {
    document.getElementById('form-admin-empleado').reset();
    espCrearSeleccionadas = [];
    renderizarChipsCrear();
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', []);
    document.getElementById('modal-admin-empleado').classList.remove('seccion-oculta');
}
function cerrarModalAdminEmpleado() {
    document.getElementById('modal-admin-empleado').classList.add('seccion-oculta');
}

// Carga especialidades en un select excluyendo las ya seleccionadas
async function cargarEspecialidadesEnSelect(selectId, excluirIds = []) {
    try {
        const res  = await fetch(API_BASE + '/api/especialidades');
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        sel.innerHTML = '<option value="">-- Especialidad --</option>';
        if (data.success) data.especialidades
            .filter(e => !excluirIds.map(String).includes(String(e.id_especialidad)))
            .forEach(esp => {
                const opt = document.createElement('option');
                opt.value = esp.id_especialidad; opt.textContent = esp.nombre_especialidad;
                sel.appendChild(opt);
            });
    } catch (err) { console.error('Error especialidades en select:', err); }
}

// Agrega una especialidad a la lista temporal del formulario crear empleado
async function agregarEspEnCrear() {
    if (espCrearSeleccionadas.length >= 2) {
        mostrarToast('Máximo 2 especialidades por empleado', 'error'); return;
    }
    const sel = document.getElementById('admin-emp-esp-add');
    const id  = sel.value;
    const texto = sel.options[sel.selectedIndex]?.text;
    if (!id) { mostrarToast('Selecciona una especialidad', 'error'); return; }
    if (espCrearSeleccionadas.find(e => String(e.id) === String(id))) {
        mostrarToast('Esa especialidad ya fue agregada', 'error'); return;
    }
    espCrearSeleccionadas.push({ id, nombre: texto });
    renderizarChipsCrear();
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', espCrearSeleccionadas.map(e => e.id));
}

// Elimina una especialidad de la lista temporal (antes de guardar)
async function quitarEspEnCrear(id) {
    espCrearSeleccionadas = espCrearSeleccionadas.filter(e => String(e.id) !== String(id));
    renderizarChipsCrear();
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', espCrearSeleccionadas.map(e => e.id));
}

// Pinta los chips de especialidades seleccionadas en el formulario crear
function renderizarChipsCrear() {
    const lista = document.getElementById('admin-emp-esp-lista');
    if (!lista) return;
    lista.innerHTML = '';
    espCrearSeleccionadas.forEach(e => {
        const chip = document.createElement('span');
        chip.className = 'esp-chip';
        chip.innerHTML = `${e.nombre} <button type="button" onclick="quitarEspEnCrear('${e.id}')">✕</button>`;
        lista.appendChild(chip);
    });
    // Actualizar el campo oculto con los IDs
    const hidden = document.getElementById('admin-emp-esp-ids');
    if (hidden) hidden.value = JSON.stringify(espCrearSeleccionadas.map(e => e.id));
}

async function manejarGuardarEmpleado(e) {
    e.preventDefault();
    const ci       = document.getElementById('admin-emp-ci').value.trim();
    const telefono = document.getElementById('admin-emp-tel').value.trim();
    const nombre   = document.getElementById('admin-emp-nombre').value.trim();
    const email    = document.getElementById('admin-emp-email').value.trim();
    const contrasena = document.getElementById('admin-emp-pass').value;

    if (!ci)      { mostrarToast('El CI es obligatorio', 'error'); return; }
    if (!nombre)  { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!email)   { mostrarToast('El correo es obligatorio', 'error'); return; }
    if (espCrearSeleccionadas.length === 0) { mostrarToast('Agrega al menos una especialidad', 'error'); return; }
    if (!contrasena) { mostrarToast('Ingresa una contraseña', 'error'); return; }
    if (!validarContrasena(contrasena)) {
        mostrarToast('La contraseña debe tener: 1 número, 1 mayúscula y 1 símbolo', 'error'); return;
    }
    try {
        const res  = await fetch(API_BASE + '/api/admin/empleados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ci, nombre, telefono, email, contrasena,
                especialidades: espCrearSeleccionadas.map(e => e.id) })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Empleado registrado. Se envió correo con credenciales.');
            cerrarModalAdminEmpleado(); cargarEmpleadosAdmin();
        } else { mostrarToast(data.message || 'Error al registrar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// --- EDITAR EMPLEADO ---
async function abrirModalEditarEmpleado(ci) {
    const emp = empleadosCache[ci];
    if (!emp) { mostrarToast('Empleado no encontrado', 'error'); return; }
    document.getElementById('edit-emp-ci').value         = emp.ci;
    document.getElementById('edit-emp-ci-display').value = emp.ci;
    document.getElementById('edit-emp-nombre').value     = emp.nombre;
    document.getElementById('edit-emp-tel').value        = emp.telefono || '';
    document.getElementById('edit-emp-email').value      = emp.email;
    document.getElementById('modal-editar-empleado').classList.remove('seccion-oculta');
    await cargarEspecialidadesEmpleado(ci);
}
function cerrarModalEditarEmpleado() {
    document.getElementById('modal-editar-empleado').classList.add('seccion-oculta');
}

async function manejarEditarEmpleado(e) {
    e.preventDefault();
    const ci    = document.getElementById('edit-emp-ci').value;
    const nombre= document.getElementById('edit-emp-nombre').value.trim();
    const tel   = document.getElementById('edit-emp-tel').value.trim();
    const email = document.getElementById('edit-emp-email').value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!email)  { mostrarToast('El correo es obligatorio', 'error'); return; }
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono: tel, email })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Empleado actualizado'); cerrarModalEditarEmpleado(); cargarEmpleadosAdmin();
        } else { mostrarToast(data.message || 'Error al actualizar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

async function eliminarEmpleado(ci, nombre) {
    if (!confirm(`¿Eliminar al empleado "${nombre}"? Se borrarán todos sus datos.`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { mostrarToast('Empleado eliminado'); cargarEmpleadosAdmin(); }
        else { mostrarToast(data.message || 'Error al eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// --- ESPECIALIDADES DEL EMPLEADO (en modal editar) ---
async function cargarEspecialidadesEmpleado(ci) {
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades`);
        const data = await res.json();
        const lista = document.getElementById('lista-especialidades-empleado');
        if (!lista) return;
        lista.innerHTML = '';
        const asignadasIds = [];
        if (data.success && data.especialidades.length > 0) {
            data.especialidades.forEach(esp => {
                asignadasIds.push(String(esp.id_especialidad));
                const chip = document.createElement('span');
                chip.className = 'esp-chip';
                chip.innerHTML = `${esp.nombre_especialidad}
                    <button title="Eliminar" onclick="eliminarEspecialidadEmpleado('${ci}',${esp.id_especialidad})">✕</button>`;
                lista.appendChild(chip);
            });
        } else {
            lista.innerHTML = '<span style="color:#999;font-size:13px;">Sin especialidades</span>';
        }
        await cargarEspecialidadesEnSelect('select-nueva-esp', asignadasIds);
    } catch (err) { console.error('Error especialidades empleado:', err); }
}

async function agregarEspecialidadEmpleado() {
    const ci     = document.getElementById('edit-emp-ci').value;
    const id_esp = document.getElementById('select-nueva-esp').value;
    if (!id_esp) { mostrarToast('Selecciona una especialidad', 'error'); return; }
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_especialidad: id_esp })
        });
        const data = await res.json();
        if (data.success) { mostrarToast('Especialidad agregada'); await cargarEspecialidadesEmpleado(ci); cargarEmpleadosAdmin(); }
        else { mostrarToast(data.message || 'Error al agregar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

async function eliminarEspecialidadEmpleado(ci, id_esp) {
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades/${id_esp}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { mostrarToast('Especialidad eliminada'); await cargarEspecialidadesEmpleado(ci); cargarEmpleadosAdmin(); }
        else { mostrarToast(data.message || 'Error', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// ADMIN — CATEGORÍAS
// =============================================================================
async function cargarCategoriasAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/categorias');
        const data = await res.json();
        if (!data.success) return;
        const tbody = document.getElementById('tabla-admin-categorias-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.categorias.forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${cat.id_categoria}</td><td>${cat.nombre}</td>
                <td><button class="btn-table-danger" onclick="eliminarCategoria(${cat.id_categoria},'${cat.nombre.replace(/'/g,"\\'")}')">Eliminar</button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error categorías admin:', err); }
}
function abrirModalCategoria() {
    document.getElementById('form-categoria').reset();
    document.getElementById('modal-categoria').classList.remove('seccion-oculta');
}
function cerrarModalCategoria() { document.getElementById('modal-categoria').classList.add('seccion-oculta'); }

async function manejarGuardarCategoria(e) {
    e.preventDefault();
    const nombre = document.getElementById('cat-nombre').value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
    try {
        const res  = await fetch(API_BASE + '/api/categorias', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (data.success) { mostrarToast('Categoría creada'); cerrarModalCategoria(); cargarCategoriasAdmin(); cargarServiciosDeBD(); }
        else { mostrarToast(data.message || 'Error', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}
async function eliminarCategoria(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/categorias/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { mostrarToast('Categoría eliminada'); cargarCategoriasAdmin(); cargarServiciosDeBD(); }
        else { mostrarToast(data.message || 'No se pudo eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// ADMIN — PAQUETES (crear, editar, eliminar)
// Columnas BD: id_paquete, nombre, descripcion, precio_promocional, fecha_inicio, fecha_final
// =============================================================================
async function cargarPaquetesAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/paquetes');
        const data = await res.json();
        const tbody = document.getElementById('tabla-admin-paquetes-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!data.success || !data.paquetes || !data.paquetes.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Sin paquetes registrados</td></tr>'; return;
        }
        paquetesCache = {};
        data.paquetes.forEach(p => {
            paquetesCache[p.id_paquete] = p;
            const inicio    = p.fecha_inicio ? new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-BO') : '—';
            const fin       = p.fecha_final  ? new Date(p.fecha_final  + 'T00:00:00').toLocaleDateString('es-BO') : '—';
            const vigencia  = (p.fecha_inicio || p.fecha_final) ? `${inicio} → ${fin}` : '—';
            const servicios = (p.servicios || []).map(s => s.nombre_servicio).join(', ') || '—';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.id_paquete}</td><td>${p.nombre}</td>
                <td>Bs ${parseFloat(p.precio_promocional||0).toFixed(2)}</td>
                <td style="font-size:12px;">${vigencia}</td>
                <td style="font-size:12px;">${servicios}</td>
                <td>
                    <button class="btn-table" onclick="abrirModalPaquete(${p.id_paquete})">Editar</button>
                    <button class="btn-table-danger" onclick="eliminarPaquete(${p.id_paquete},'${p.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error paquetes admin:', err); }
}

// Abre modal en modo CREAR (sin id) o EDITAR (con id), carga checkboxes de servicios
async function abrirModalPaquete(idPaquete = null) {
    document.getElementById('form-paquete').reset();
    const checksDiv = document.getElementById('paq-servicios-checks');
    checksDiv.innerHTML = '<p style="color:#999;font-size:13px;">Cargando servicios...</p>';

    let seleccionados = [];
    if (idPaquete !== null) {
        const paq = paquetesCache[idPaquete];
        if (!paq) { mostrarToast('Paquete no encontrado', 'error'); return; }
        document.getElementById('titulo-modal-paquete').textContent = 'Editar Paquete';
        document.getElementById('btn-submit-paquete').textContent   = 'Guardar Cambios';
        document.getElementById('paq-id').value          = paq.id_paquete;
        document.getElementById('paq-nombre').value      = paq.nombre;
        document.getElementById('paq-descripcion').value = paq.descripcion || '';
        document.getElementById('paq-precio-promo').value= paq.precio_promocional || '';
        document.getElementById('paq-fecha-inicio').value= paq.fecha_inicio ? paq.fecha_inicio.substring(0,10) : '';
        document.getElementById('paq-fecha-final').value = paq.fecha_final  ? paq.fecha_final.substring(0,10)  : '';
        seleccionados = (paq.servicios || []).map(s => String(s.id_servicio));
    } else {
        document.getElementById('titulo-modal-paquete').textContent = 'Nuevo Paquete Promocional';
        document.getElementById('btn-submit-paquete').textContent   = 'Crear Paquete';
        document.getElementById('paq-id').value = '';
    }

    try {
        const res  = await fetch(API_BASE + '/api/servicios');
        const data = await res.json();
        checksDiv.innerHTML = '';
        if (data.success && data.servicios.length > 0) {
            data.servicios.forEach(s => {
                const label = document.createElement('label');
                label.className = 'paq-check-item';
                const cb = document.createElement('input');
                cb.type    = 'checkbox';
                cb.value   = s.id_servicio;
                cb.name    = 'paq-servicio';
                if (seleccionados.includes(String(s.id_servicio))) cb.checked = true;
                label.appendChild(cb);
                label.appendChild(document.createTextNode(` ${s.nombre_servicio} — Bs ${parseFloat(s.precio).toFixed(2)}`));
                checksDiv.appendChild(label);
            });
        } else {
            checksDiv.innerHTML = '<p style="color:#999;font-size:12px;">No hay servicios disponibles</p>';
        }
    } catch {
        checksDiv.innerHTML = '<p style="color:red;font-size:12px;">Error al cargar servicios</p>';
    }
    document.getElementById('modal-paquete').classList.remove('seccion-oculta');
}
function cerrarModalPaquete() { document.getElementById('modal-paquete').classList.add('seccion-oculta'); }

async function manejarGuardarPaquete(e) {
    e.preventDefault();
    const id               = document.getElementById('paq-id').value;
    const nombre           = document.getElementById('paq-nombre').value.trim();
    const descripcion      = document.getElementById('paq-descripcion').value.trim();
    const precio_promocional = parseFloat(document.getElementById('paq-precio-promo').value);
    const fecha_inicio     = document.getElementById('paq-fecha-inicio').value || null;
    const fecha_final      = document.getElementById('paq-fecha-final').value  || null;
    const servicios        = Array.from(document.querySelectorAll('input[name="paq-servicio"]:checked')).map(cb => cb.value);

    if (!nombre)                              { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!precio_promocional || precio_promocional <= 0) { mostrarToast('Ingresa un precio promocional válido', 'error'); return; }
    if (fecha_inicio && fecha_final && fecha_final < fecha_inicio) {
        mostrarToast('La fecha de fin no puede ser anterior a la de inicio', 'error'); return;
    }

    try {
        const url    = id ? `${API_BASE}/api/admin/paquetes/${id}` : `${API_BASE}/api/admin/paquetes`;
        const method = id ? 'PUT' : 'POST';
        const res  = await fetch(url, {
            method, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, descripcion, precio_promocional, fecha_inicio, fecha_final, servicios })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast(id ? 'Paquete actualizado' : 'Paquete creado');
            cerrarModalPaquete(); cargarPaquetesAdmin();
        } else { mostrarToast(data.message || 'Error al guardar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

async function eliminarPaquete(id, nombre) {
    if (!confirm(`¿Eliminar el paquete "${nombre}"?`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/admin/paquetes/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { mostrarToast('Paquete eliminado'); cargarPaquetesAdmin(); }
        else { mostrarToast(data.message || 'Error al eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// ADMIN — SESIONES
// =============================================================================
async function cargarSesionesAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/sesiones');
        const data = await res.json();
        if (!data.success) return;
        const tbody = document.getElementById('tabla-admin-sesiones-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.sesiones.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${s.nombre}</td><td>${s.email}</td><td>${s.rol}</td><td>${s.fecha}</td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error sesiones:', err); }
}

// =============================================================================
// ADMIN — PRIVILEGIOS (agrupados por paquetes del sistema)
// =============================================================================
async function cargarPrivilegiosAdmin() {
    const ci = document.getElementById('admin-buscar-ci').value.trim();
    if (!ci) { mostrarToast('Ingresa un CI', 'error'); return; }
    try {
        const [resPriv, resPaq] = await Promise.all([
            fetch(`${API_BASE}/api/admin/privilegios/${ci}`),
            fetch(`${API_BASE}/api/admin/paquetes-sistema`)
        ]);
        const [dataPriv, dataPaq] = await Promise.all([resPriv.json(), resPaq.json()]);
        if (!dataPriv.success) { mostrarToast('Usuario no encontrado', 'error'); return; }

        // Mapa: id_paquete_sist → nombre
        const mapaPaq = {};
        if (dataPaq.success) dataPaq.paquetes.forEach(p => { mapaPaq[p.id_paquete_sist] = p.nombre; });

        // Agrupar privilegios por paquete
        const grupos = {};
        dataPriv.privilegios.forEach(p => {
            if (!grupos[p.id_paquete_sist]) grupos[p.id_paquete_sist] = [];
            grupos[p.id_paquete_sist].push(p);
        });

        const cont = document.getElementById('admin-privilegios-lista');
        cont.innerHTML = `<h4 style="margin-bottom:15px;">Privilegios para CI: <strong>${ci}</strong></h4>`;

        Object.entries(grupos).forEach(([idPaq, cus]) => {
            const sec = document.createElement('div');
            sec.style.cssText = 'margin-bottom:18px;';
            const titulo = document.createElement('p');
            titulo.style.cssText = 'font-weight:600; font-size:12px; text-transform:uppercase; color:var(--color-primario); margin-bottom:6px; letter-spacing:0.5px;';
            titulo.textContent = mapaPaq[idPaq] || 'Paquete ' + idPaq;
            sec.appendChild(titulo);
            cus.forEach(p => {
                const div = document.createElement('div');
                div.style.cssText = 'padding:7px 10px; border-bottom:1px solid #f0f0f0;';
                div.innerHTML = `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;">
                    <input type="checkbox" data-id-cu="${p.id_cu}" ${p.tiene ? 'checked' : ''}> ${p.nombre_cu}
                </label>`;
                sec.appendChild(div);
            });
            cont.appendChild(sec);
        });

        const btn = document.createElement('button');
        btn.className = 'btn-registrarse mt-15';
        btn.textContent = 'Guardar Cambios';
        btn.onclick = () => guardarPrivilegiosAdmin(ci);
        cont.appendChild(btn);
    } catch (err) { console.error('Error privilegios:', err); mostrarToast('Error de conexión', 'error'); }
}

async function guardarPrivilegiosAdmin(ci) {
    const checkboxes = document.querySelectorAll('#admin-privilegios-lista input[type="checkbox"]');
    let errores = 0;
    for (const cb of checkboxes) {
        try {
            await fetch(API_BASE + '/api/admin/privilegios', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ci_usuario: ci, id_cu: cb.dataset.idCu, habilitado: cb.checked })
            });
        } catch { errores++; }
    }
    mostrarToast(errores === 0 ? 'Privilegios actualizados' : 'Algunos no se pudieron actualizar', errores > 0 ? 'error' : 'success');
}

// =============================================================================
// CU3 — RESERVAR CITA
// Flujo: tipo → item → fecha/esteticista → hora → pago → revisar → confirmar
// =============================================================================
const SELECT_EST_BASE = `<select id="reserva-esteticista" onchange="cargarHorasDisponibles()" style="width:100%; padding:10px; border:none; border-bottom:1px solid #aaa; outline:none; background:transparent; font-family:inherit;"><option value="">-- Selecciona un servicio primero --</option></select>`;

async function abrirModalReserva() {
    if (!usuarioActual) { mostrarSeccion('login'); return; }
    document.getElementById('form-reserva').reset();
    document.getElementById('reserva-esteticista-container').innerHTML = SELECT_EST_BASE;
    document.getElementById('resumen-reserva').style.display = 'none';
    document.getElementById('btn-confirmar-reserva').style.display = 'none';
    await cargarItemsReserva();
    document.getElementById('modal-reserva').classList.remove('seccion-oculta');
}
function cerrarModalReserva() { document.getElementById('modal-reserva').classList.add('seccion-oculta'); }

async function cambiarTipoReserva() {
    await cargarItemsReserva();
    document.getElementById('reserva-esteticista-container').innerHTML = SELECT_EST_BASE;
    document.getElementById('label-esteticista-res').textContent = 'Esteticista';
    document.getElementById('reserva-hora').innerHTML = '<option value="">-- Elige fecha y esteticista --</option>';
    document.getElementById('resumen-reserva').style.display = 'none';
}

async function cargarItemsReserva() {
    const tipo  = document.querySelector('input[name="tipo-reserva"]:checked')?.value || 'servicio';
    const label = document.getElementById('label-item-reserva');
    const sel   = document.getElementById('reserva-item');
    sel.innerHTML = '<option value="">-- Selecciona --</option>';
    if (tipo === 'servicio') {
        label.textContent = 'Servicio';
        try {
            const res  = await fetch(API_BASE + '/api/servicios');
            const data = await res.json();
            if (data.success) data.servicios.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id_servicio; opt.textContent = `${s.nombre_servicio} — Bs ${parseFloat(s.precio).toFixed(2)}`;
                opt.dataset.tipo = 'servicio';
                sel.appendChild(opt);
            });
        } catch { mostrarToast('Error cargando servicios', 'error'); }
    } else {
        label.textContent = 'Paquete Promocional';
        try {
            const res  = await fetch(API_BASE + '/api/servicios');
            const data = await res.json();
            if (data.success && data.paquetes) data.paquetes.forEach(p => {
                const opt = document.createElement('option');
                // Mostrar vigencia si tiene fechas
                let vigencia = '';
                if (p.fecha_inicio || p.fecha_final) {
                    const ini = p.fecha_inicio ? formatearFechaCorta(p.fecha_inicio) : '?';
                    const fin = p.fecha_final  ? formatearFechaCorta(p.fecha_final)  : '?';
                    vigencia = ` | Vigencia: ${ini} → ${fin}`;
                }
                opt.value = p.id_paquete;
                opt.textContent = `${p.nombre} — Bs ${parseFloat(p.precio_promocional||0).toFixed(2)}${vigencia}`;
                opt.dataset.tipo = 'paquete';
                sel.appendChild(opt);
            });
        } catch { mostrarToast('Error cargando paquetes', 'error'); }
    }
}

// Cuando se elige servicio/paquete → cargar esteticistas
// Para servicio: select único. Para paquete: checkboxes (multi-esteticista)
async function cargarEsteticistasParaItem() {
    const tipo   = document.querySelector('input[name="tipo-reserva"]:checked')?.value || 'servicio';
    const id     = document.getElementById('reserva-item').value;
    const cont   = document.getElementById('reserva-esteticista-container');
    const label  = document.getElementById('label-esteticista-res');
    document.getElementById('reserva-hora').innerHTML = '<option value="">-- Elige esteticista primero --</option>';
    document.getElementById('resumen-reserva').style.display = 'none';

    if (!id) {
        cont.innerHTML = SELECT_EST_BASE; return;
    }

    cont.innerHTML = '<p style="color:#999;font-size:13px;padding:8px 0;">Cargando esteticistas...</p>';
    try {
        const url  = tipo === 'servicio' ? `${API_BASE}/api/esteticistas?id_servicio=${id}` : `${API_BASE}/api/esteticistas?id_paquete=${id}`;
        const res  = await fetch(url);
        const data = await res.json();
        const ests = data.esteticistas || [];

        if (tipo === 'servicio') {
            label.textContent = 'Esteticista';
            cont.innerHTML = `<select id="reserva-esteticista" onchange="cargarHorasDisponibles()" style="width:100%; padding:10px; border:none; border-bottom:1px solid #aaa; outline:none; background:transparent; font-family:inherit;"><option value="">-- Selecciona esteticista --</option></select>`;
            const sel = document.getElementById('reserva-esteticista');
            ests.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.ci;
                opt.textContent = `${est.nombre}${est.especialidades ? ' (' + est.especialidades + ')' : ''}`;
                sel.appendChild(opt);
            });
            if (!ests.length) sel.innerHTML = '<option value="">Sin esteticistas disponibles</option>';
            if (window._preselFavCi) {
                sel.value = window._preselFavCi;
                if (sel.value) cargarHorasDisponibles();
                else mostrarToast('La esteticista favorita no atiende este servicio', 'error');
                window._preselFavCi = null;
            }
        } else {
            // Paquete → checkboxes para seleccionar 1 o más esteticistas
            label.textContent = 'Esteticistas (puede seleccionar varias)';
            cont.innerHTML = `<div id="reserva-esteticistas-checks" style="max-height:150px; overflow-y:auto; border:1px solid #eee; border-radius:6px; padding:6px;"></div>`;
            const checksDiv = document.getElementById('reserva-esteticistas-checks');
            if (ests.length > 0) {
                ests.forEach(est => {
                    const lbl = document.createElement('label');
                    lbl.className = 'est-check-item';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox'; cb.value = est.ci; cb.dataset.nombre = est.nombre;
                    cb.addEventListener('change', cargarHorasDisponibles);
                    lbl.appendChild(cb);
                    lbl.appendChild(document.createTextNode(` ${est.nombre}${est.especialidades ? ' (' + est.especialidades + ')' : ''}`));
                    checksDiv.appendChild(lbl);
                });
            } else {
                checksDiv.innerHTML = '<p style="color:#888;font-size:13px;padding:8px;">Sin esteticistas disponibles</p>';
            }
        }
    } catch { cont.innerHTML = '<p style="color:red;font-size:13px;">Error al cargar esteticistas</p>'; }
}

// Siempre muestra todas las horas (09:00–18:00); conflictos se detectan solo en "Revisar Disponibilidad"
function cargarHorasDisponibles() {
    const selHora = document.getElementById('reserva-hora');
    const ests    = getEsteticistasSeleccionadas();
    const fecha   = document.getElementById('reserva-fecha').value;
    if (!fecha || !ests.length) return;

    const todasHoras = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
    selHora.innerHTML = '<option value="">-- Selecciona hora --</option>';
    todasHoras.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h; opt.textContent = h;
        selHora.appendChild(opt);
    });
}

// "Revisar Disponibilidad" → muestra resumen y verifica cada esteticista seleccionado
async function revisarReserva() {
    const tipo     = document.querySelector('input[name="tipo-reserva"]:checked')?.value;
    const selItem  = document.getElementById('reserva-item');
    const itemId   = selItem.value;
    const itemText = selItem.options[selItem.selectedIndex]?.text || '';
    const fecha    = document.getElementById('reserva-fecha').value;
    const hora     = document.getElementById('reserva-hora').value;
    const pago     = document.getElementById('reserva-pago').value;
    const ests     = getEsteticistasSeleccionadas();

    if (!itemId)      { mostrarToast('Selecciona un servicio o paquete', 'error'); return; }
    if (!fecha)       { mostrarToast('Selecciona la fecha', 'error'); return; }
    if (!ests.length) { mostrarToast('Selecciona al menos una esteticista', 'error'); return; }
    if (!hora)        { mostrarToast('Selecciona la hora', 'error'); return; }
    if (!pago)        { mostrarToast('Selecciona el método de pago', 'error'); return; }

    // Validar que no sea fecha pasada (comparación sin zona horaria)
    const [y, m, d] = fecha.split('-').map(Number);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    if (new Date(y, m - 1, d) < hoy) { mostrarToast('La fecha no puede ser en el pasado', 'error'); return; }

    const divResumen  = document.getElementById('resumen-reserva');
    const contResumen = document.getElementById('resumen-contenido');
    const divDisp     = document.getElementById('disponibilidad-estado');
    const btnConfirm  = document.getElementById('btn-confirmar-reserva');

    contResumen.innerHTML = `
        <p><strong>${tipo === 'servicio' ? 'Servicio' : 'Paquete'}:</strong> ${itemText}</p>
        <p><strong>Fecha:</strong> ${formatearFecha(fecha)}</p>
        <p><strong>Esteticista(s):</strong> ${ests.map(e => e.nombre).join(', ')}</p>
        <p><strong>Hora:</strong> ${hora}</p>
        <p><strong>Pago:</strong> ${pago === 'efectivo' ? 'Efectivo' : 'Código QR'}</p>
    `;
    divResumen.style.display = 'block';
    divDisp.innerHTML = '<span style="color:#888;">Verificando disponibilidad...</span>';
    btnConfirm.style.display = 'none';

    try {
        const resultados = await Promise.all(ests.map(est =>
            fetch(`${API_BASE}/api/verificar-disponibilidad?ci_esteticista=${est.ci}&fecha=${fecha}&hora=${hora}`)
                .then(r => r.json())
                .then(d => ({ nombre: est.nombre, disponible: d.disponible }))
                .catch(() => ({ nombre: est.nombre, disponible: true }))
        ));
        const noDisp = resultados.filter(r => !r.disponible);
        if (noDisp.length === 0) {
            divDisp.innerHTML = `<span class="disp-ok">✓ ${ests.length > 1 ? 'Todas las esteticistas están disponibles' : 'La esteticista está disponible'} en ese horario</span>`;
            btnConfirm.style.display = 'block';
        } else {
            const nombres = noDisp.map(r => r.nombre).join(', ');
            divDisp.innerHTML = `<span class="disp-error">✕ ${nombres} ya tiene(n) una reserva en ese horario. Por favor elige otra hora.</span>`;
            btnConfirm.style.display = 'none';
        }
    } catch {
        divDisp.innerHTML = '<span style="color:#888;">No se pudo verificar disponibilidad.</span>';
        btnConfirm.style.display = 'block';
    }
}

// Confirmar y guardar la(s) reserva(s) en la BD
async function manejarConfirmarReserva(e) {
    e.preventDefault();
    const tipo = document.querySelector('input[name="tipo-reserva"]:checked')?.value;
    const itemId = document.getElementById('reserva-item').value;
    const fecha  = document.getElementById('reserva-fecha').value;
    const hora   = document.getElementById('reserva-hora').value;
    const pago   = document.getElementById('reserva-pago').value;
    const ests   = getEsteticistasSeleccionadas();

    try {
        const res  = await fetch(API_BASE + '/api/reservas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ci_cliente:      usuarioActual.ci,
                ci_esteticistas: ests.map(e => e.ci),
                fecha, hora,
                metodo_pago:     pago,
                id_servicio:     tipo === 'servicio' ? itemId : null,
                id_paquete:      tipo === 'paquete'  ? itemId : null
            })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast(data.message || '¡Reserva confirmada!');
            cerrarModalReserva();
            cargarReservasCliente();
        } else { mostrarToast(data.message || 'Error al confirmar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// PANEL CLIENTE — reservas y acción de nueva reserva
// =============================================================================

// Carga las reservas del cliente como tarjetas desplegables
async function cargarReservasCliente() {
    if (!usuarioActual) return;
    const cont = document.getElementById('contenedor-mis-reservas');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Cargando...</p>';
    try {
        const res  = await fetch(`${API_BASE}/api/reservas/cliente/${usuarioActual.ci}`);
        const data = await res.json();
        cont.innerHTML = '';
        if (data.success && data.reservas.length > 0) {
            data.reservas.forEach(r => {
                const fecha    = formatearFecha(r.fecha);
                const hora     = r.hora ? String(r.hora).substring(0, 5) : '—';
                const esCfm    = r.estado === 'Confirmada';
                const cancelable = r.estado !== 'Cancelada';
                const nomEst   = (r.nombre_esteticista || '').replace(/'/g, "\\'");
                const ciEst    = r.ci_esteticista || '';
                const div      = document.createElement('div');
                div.className  = 'reserva-acordeon';
                div.innerHTML  = `
                    <button type="button" class="reserva-acordeon-btn" onclick="toggleReservaDetalle(this)">
                        <div class="reserva-acordeon-info">
                            <span class="reserva-acordeon-titulo">${r.nombre_item || 'Sin especificar'}</span>
                            <span class="reserva-acordeon-fecha">${fecha} — ${hora}</span>
                        </div>
                        <span class="badge ${esCfm ? 'confirmada' : 'pendiente'}">${r.estado}</span>
                        <span class="acordeon-arrow">▼</span>
                    </button>
                    <div class="reserva-acordeon-detalle">
                        <p><strong>Servicio/Paquete:</strong> ${r.nombre_item || '—'}</p>
                        <p><strong>Esteticista:</strong> ${r.nombre_esteticista || '—'}</p>
                        <p><strong>Fecha:</strong> ${fecha}</p>
                        <p><strong>Hora:</strong> ${hora}</p>
                        <p><strong>Método de pago:</strong> ${r.metodo_pago || '—'}</p>
                        <p><strong>Monto:</strong> Bs ${r.monto ? parseFloat(r.monto).toFixed(2) : '—'}</p>
                        <p><strong>Estado:</strong> <span class="badge ${esCfm ? 'confirmada' : 'pendiente'}">${r.estado}</span></p>
                        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
                            ${cancelable ? `<button class="btn-cancelar-reserva" onclick="cancelarReserva(${r.id_cita})">Cancelar Reserva</button>` : ''}
                            ${ciEst ? `<button class="btn-outline-dark" onclick="guardarFavorito({ci:'${ciEst}',nombre:'${nomEst}',especialidades:'${(r.especialidades||'').replace(/'/g,"\\'")}'})" style="font-size:13px;">★ Guardar esteticista</button>` : ''}
                        </div>
                    </div>`;
                cont.appendChild(div);
            });
        } else {
            cont.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">No tienes reservas aún. ¡Haz tu primera cita!</p>';
        }
    } catch {
        cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Error al cargar reservas.</p>';
    }
}

function toggleReservaDetalle(btn) {
    const detalle = btn.nextElementSibling;
    const arrow   = btn.querySelector('.acordeon-arrow');
    const abierto = detalle.classList.toggle('abierto');
    if (arrow) arrow.classList.toggle('rotado', abierto);
}

function nuevaReserva() { abrirModalReserva(); }

// =============================================================================
// PANEL CLIENTE — tabs, cancelar reserva y favoritos
// =============================================================================

function cambiarTabCliente(tab) {
    ['citas', 'favoritos'].forEach(t => {
        const v = document.getElementById('vista-cli-' + t);
        const b = document.getElementById('tab-cli-' + t);
        if (v) v.classList.toggle('seccion-oculta', t !== tab);
        if (b) b.classList.toggle('active', t === tab);
    });
    if (tab === 'favoritos') renderizarFavoritos();
}

async function cancelarReserva(id_cita) {
    if (!confirm('¿Estás segura de que deseas cancelar esta reserva? Esta acción no se puede deshacer y se enviará un correo de notificación.')) return;
    try {
        const res  = await fetch(`${API_BASE}/api/reservas/${id_cita}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Reserva cancelada. Recibirás un correo de confirmación.');
            cargarReservasCliente();
        } else { mostrarToast(data.message || 'Error al cancelar', 'error'); }
    } catch { mostrarToast('Error de conexión al cancelar', 'error'); }
}

function getFavoritos() {
    return JSON.parse(localStorage.getItem('hisami_favoritos') || '[]');
}

function guardarFavorito(est) {
    const favs = getFavoritos();
    if (favs.find(f => f.ci === est.ci)) {
        mostrarToast(`${est.nombre} ya está en tus favoritas`); return;
    }
    favs.push(est);
    localStorage.setItem('hisami_favoritos', JSON.stringify(favs));
    mostrarToast(`★ ${est.nombre} agregada a favoritas`);
}

function eliminarFavorito(ci) {
    const favs = getFavoritos().filter(f => f.ci !== ci);
    localStorage.setItem('hisami_favoritos', JSON.stringify(favs));
    renderizarFavoritos();
    mostrarToast('Esteticista eliminada de favoritas');
}

function renderizarFavoritos() {
    const cont = document.getElementById('contenedor-favoritos');
    if (!cont) return;
    const favs = getFavoritos();
    if (!favs.length) {
        cont.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">Aún no tienes esteticistas favoritas.<br>Guárdalas desde el detalle de tus reservas.</p>';
        return;
    }
    cont.innerHTML = '';
    favs.forEach(est => {
        const nombreSafe = (est.nombre || '').replace(/'/g, "\\'");
        const card = document.createElement('div');
        card.className = 'reserva-acordeon';
        card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:18px 25px;flex-wrap:wrap;gap:10px;';
        card.innerHTML = `
            <div>
                <strong style="font-size:15px;">${est.nombre || '—'}</strong>
                ${est.especialidades ? `<p style="color:#888;font-size:13px;margin:4px 0 0;">${est.especialidades}</p>` : ''}
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn-reservar" onclick="reservarConFavorita('${est.ci}','${nombreSafe}')">Reservar</button>
                <button class="btn-outline-dark" onclick="eliminarFavorito('${est.ci}')" style="font-size:13px;">✕ Quitar</button>
            </div>`;
        cont.appendChild(card);
    });
}

function reservarConFavorita(ci, nombre) {
    cambiarTabCliente('citas');
    window._preselFavCi = ci;
    abrirModalReserva();
    mostrarToast(`Selecciona el servicio para continuar con ${nombre}`);
}

// =============================================================================
// PANEL PERSONAL — tabs y reservas/notificaciones
// =============================================================================
const TABS_PERSONAL = ['agenda','reservas','comisiones'];
function cambiarTabPersonal(tab) {
    TABS_PERSONAL.forEach(t => {
        const v = document.getElementById('vista-pers-' + t);
        const b = document.getElementById('tab-pers-' + t);
        if (v) v.classList.add('seccion-oculta');
        if (b) b.classList.remove('active');
    });
    const vistaActiva = document.getElementById('vista-pers-' + tab);
    const tabActivo   = document.getElementById('tab-pers-' + tab);
    if (vistaActiva) vistaActiva.classList.remove('seccion-oculta');
    if (tabActivo)   tabActivo.classList.add('active');
    if (tab === 'reservas') cargarReservasEsteticista();
}

// Carga las reservas asignadas al esteticista logueado
async function cargarReservasEsteticista() {
    if (!usuarioActual) return;
    const cont = document.getElementById('contenedor-reservas-esteticista');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Cargando...</p>';
    try {
        const res  = await fetch(`${API_BASE}/api/reservas/esteticista/${usuarioActual.ci}`);
        const data = await res.json();
        cont.innerHTML = '';
        const badge = document.getElementById('badge-reservas');

        if (data.success && data.reservas.length > 0) {
            if (badge) { badge.textContent = data.reservas.length; badge.style.display = 'inline'; }
            data.reservas.forEach(r => {
                const fecha = formatearFechaCorta(r.fecha);
                const hora  = r.hora ? String(r.hora).substring(0, 5) : '—';
                const card  = document.createElement('div');
                card.className = 'reserva-card';
                card.innerHTML = `
                    <div class="reserva-info">
                        <h4>${r.nombre_item || 'Sin especificar'}</h4>
                        <p>${fecha} a las ${hora}</p>
                        <p style="font-size:12px;color:#888;">Cliente: ${r.nombre_cliente || '—'} | Pago: ${r.metodo_pago || '—'} | Monto: Bs ${r.monto ? parseFloat(r.monto).toFixed(2) : '—'}</p>
                    </div>
                    <div class="reserva-estado">
                        <span class="badge ${r.estado === 'Confirmada' ? 'confirmada' : 'pendiente'}">${r.estado}</span>
                    </div>`;
                cont.appendChild(card);
            });
        } else {
            if (badge) badge.style.display = 'none';
            cont.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">No tienes reservas asignadas.</p>';
        }
    } catch {
        cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Error al cargar reservas.</p>';
    }
}

// Comisiones del empleado
async function consultarComisiones() {
    if (!usuarioActual) return;
    const cont = document.getElementById('resultado-comisiones');
    if (!cont) return;
    cont.innerHTML = 'Cargando...';
    try {
        const res  = await fetch(API_BASE + '/api/comisiones/' + usuarioActual.ci);
        const data = await res.json();
        if (data.success && data.comisiones.length > 0) {
            cont.innerHTML = '';
            data.comisiones.forEach(c => {
                const div = document.createElement('div');
                div.className = 'comision-item';
                div.innerHTML = `<span>${c.fecha}</span><span>Bs ${parseFloat(c.monto_comision).toFixed(2)}</span>
                    <span class="badge ${c.estado_pago === 'Pagado' ? 'confirmada' : 'pendiente'}">${c.estado_pago}</span>`;
                cont.appendChild(div);
            });
        } else { cont.innerHTML = '<p style="color:#888;">Sin registros de comisiones.</p>'; }
    } catch { cont.innerHTML = '<p style="color:red;">Error al cargar.</p>'; }
}

// =============================================================================
// MODALES CONFIGURACIÓN
// =============================================================================
function abrirModalConfig() {
    document.getElementById('modal-configuracion').classList.remove('seccion-oculta');
    cambiarTabModal('seguridad');
}
function cerrarModalConfig() { document.getElementById('modal-configuracion').classList.add('seccion-oculta'); }
function cambiarTabModal(tab) {
    ['form-cambio-password','form-editar-perfil','form-preferencias'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    ['tab-mod-seguridad','tab-mod-perfil','tab-mod-notif'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    if (tab === 'seguridad') {
        document.getElementById('form-cambio-password').style.display = 'block';
        document.getElementById('tab-mod-seguridad').classList.add('active');
    } else if (tab === 'perfil') {
        document.getElementById('form-editar-perfil').style.display = 'block';
        document.getElementById('tab-mod-perfil').classList.add('active');
    } else if (tab === 'notificaciones') {
        document.getElementById('form-preferencias').style.display = 'block';
        document.getElementById('tab-mod-notif').classList.add('active');
    }
}

// =============================================================================
// TOASTS — notificaciones emergentes (verde: success, rojo: error)
// =============================================================================
function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast' + (tipo === 'error' ? ' error' : '');
    toast.innerHTML = `
        <div class="toast-icon">${tipo === 'error' ? '✕' : '✓'}</div>
        <div class="toast-text">${mensaje}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('mostrar'), 10);
    setTimeout(() => { toast.classList.remove('mostrar'); setTimeout(() => toast.remove(), 400); }, 4000);
}

// Compatibilidad con el toast estático del HTML (ya reemplazado por toasts dinámicos)
function cerrarToast() {
    const t = document.getElementById('notificacion-toast');
    if (t) t.classList.remove('mostrar');
}

console.log('✅ Script HISAMI cargado correctamente');
