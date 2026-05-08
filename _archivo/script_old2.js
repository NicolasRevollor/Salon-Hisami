// --- CONFIGURACIÓN GLOBAL ---
const API_BASE = 'http://localhost:3000';
let usuarioActual = null;
let menuUsuario = [];
let catalogoCompleto = [];

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    cargarServiciosDeBD();
    cargarDropdownsEstaticos();
    configurarRecuperacion();

    const hamburger = document.getElementById('hamburger');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            document.getElementById('nav-menu-movil').classList.toggle('active');
        });
    }
});

// --- NAVEGACIÓN ---
function mostrarSeccion(idSeccion) {
    window.scrollTo(0, 0);
    const mainLanding = document.getElementById('main-landing');
    const seccionesSistema = document.querySelectorAll('.sistema-section');

    if (idSeccion === 'landing') {
        mainLanding.classList.remove('seccion-oculta');
        seccionesSistema.forEach(sec => sec.classList.add('seccion-oculta'));
        document.getElementById('navbar').style.display = 'flex';
    } else {
        mainLanding.classList.add('seccion-oculta');
        seccionesSistema.forEach(sec => sec.classList.add('seccion-oculta'));
        const seccion = document.getElementById(idSeccion);
        if (seccion) seccion.classList.remove('seccion-oculta');
        if (idSeccion === 'login') document.getElementById('navbar').style.display = 'none';
        else document.getElementById('navbar').style.display = 'flex';
    }
}

function irAInicio() { mostrarSeccion('landing'); }
function irARegistro() { mostrarSeccion('login'); cambiarPestana('registro'); }

function cambiarPestana(pestana) {
    const formLogin = document.getElementById('login-form');
    const formRegistro = document.getElementById('registro-form');
    const btnLogin = document.getElementById('btn-tab-login');
    const btnRegistro = document.getElementById('btn-tab-registro');

    if (pestana === 'login') {
        formLogin.style.display = 'block'; formRegistro.style.display = 'none';
        btnLogin.classList.add('active'); btnRegistro.classList.remove('active');
    } else {
        formLogin.style.display = 'none'; formRegistro.style.display = 'block';
        btnLogin.classList.remove('active'); btnRegistro.classList.add('active');
    }
}

function togglePasswordVisibility(inputId, iconSpan) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconSpan.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06 5.06m-4.97-4.97A9.12 9.12 0 0 1 12 7a9 9 0 0 1 4.94 2.06m-5.94-5.94"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    } else {
        input.type = 'password';
        iconSpan.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="7" r="3"></circle></svg>';
    }
}

// --- ACTUALIZAR NAVBAR ---
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
        document.getElementById('nav-menu-packages').innerHTML = '';
        document.getElementById('nav-menu-movil').innerHTML = '';
        document.getElementById('nav-menu-movil').classList.remove('active');
    }
}

// --- CARGAR SERVICIOS ---
async function cargarServiciosDeBD() {
    const contenedor = document.getElementById('contenedor-servicios');
    if (contenedor) contenedor.innerHTML = '<p style="text-align:center; width:100%; color:#666;">Cargando catálogo...</p>';

    try {
        const res = await fetch(API_BASE + '/api/servicios');
        const data = await res.json();
        if (data.success) {
            catalogoCompleto = [
                ...(data.paquetes || []).map(p => ({ ...p, tipo_dato: 'paquete' })),
                ...(data.servicios || []).map(s => ({ ...s, tipo_dato: 'individual' }))
            ];
            filtrarServicios('todos', document.querySelector('.btn-filtro.activo'));
        }
    } catch (error) { console.error("Error al obtener servicios"); }
}

function filtrarServicios(filtro, btnPresionado) {
    const contenedor = document.getElementById('contenedor-servicios');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (btnPresionado) {
        document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('activo'));
        btnPresionado.classList.add('activo');
    }

    let lista = catalogoCompleto;
    if (filtro === 'paquetes') lista = catalogoCompleto.filter(s => s.tipo_dato === 'paquete');
    else if (filtro === 'cabello') lista = catalogoCompleto.filter(s => s.nombre_categoria && (s.nombre_categoria.toLowerCase().includes('peluquería') || s.nombre_categoria.toLowerCase().includes('colorimetría') || s.nombre_categoria.toLowerCase().includes('barbería')));
    else if (filtro === 'uñas') lista = catalogoCompleto.filter(s => s.nombre_categoria && (s.nombre_categoria.toLowerCase().includes('manicura') || s.nombre_categoria.toLowerCase().includes('pedicura')));
    else if (filtro === 'faciales') lista = catalogoCompleto.filter(s => s.nombre_categoria && (s.nombre_categoria.toLowerCase().includes('facial') || s.nombre_categoria.toLowerCase().includes('depilación')));
    else if (filtro === 'masajes') lista = catalogoCompleto.filter(s => s.nombre_categoria && s.nombre_categoria.toLowerCase().includes('masajes'));
    else if (filtro === 'maquillaje') lista = catalogoCompleto.filter(s => s.nombre_categoria && s.nombre_categoria.toLowerCase().includes('maquillaje'));

    if (lista.length === 0) {
        contenedor.innerHTML = '<p style="color:#666; width:100%; text-align:center; padding:40px;">No hay servicios para esta categoría.</p>';
        return;
    }

    lista.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-servicio';
        const nombreItem = item.nombre_servicio || item.nombre || 'Servicio';
        const precioLimpio = parseFloat(String(item.precio || item.precio_promocional || 0).replace(/[^0-9.-]+/g, "")) || 0;
        const categoriaBadge = item.tipo_dato === 'paquete' ? 'PAQUETE' : (item.nombre_categoria || 'Servicio');

        div.innerHTML =
            '<span class="badge-categoria">' + categoriaBadge.toUpperCase() + '</span>' +
            '<h3>' + nombreItem + '</h3>' +
            '<p>' + (item.descripcion || 'Tratamiento profesional ejecutado por nuestro equipo experto.') + '</p>' +
            '<div class="card-footer">' +
            '<div class="card-precio">' + precioLimpio.toFixed(2) + ' Bs</div>' +
            '<button class="btn-registrarse" onclick="mostrarSeccion(\'login\')">Reservar</button>' +
            '</div>';
        contenedor.appendChild(div);
    });
}

// --- LOGIN ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const contrasena = document.getElementById('password').value;

        try {
            const res = await fetch(API_BASE + '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, contrasena })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                usuarioActual = data.user;
                loginForm.reset();
                actualizarNavbar();
                irAInicio();
            } else {
                alert("❌ " + data.message);
            }
        } catch (err) { alert("Error de conexión al servidor."); }
    });
}

// --- REGISTRO ---
const registroForm = document.getElementById('registro-form');
if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ci = document.getElementById('reg-ci').value;
        const nombre = document.getElementById('reg-nombre').value;
        const telefono = document.getElementById('reg-telefono').value;
        const email = document.getElementById('reg-email').value;
        const contrasena = document.getElementById('reg-password').value;

        if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(contrasena)) {
            alert("⚠️ La contraseña debe contener al menos un NÚMERO, una MAYÚSCULA y un CARÁCTER ESPECIAL.");
            return;
        }

        try {
            const res = await fetch(API_BASE + '/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ci, nombre, telefono, email, contrasena })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(data.message);
                registroForm.reset();
                cambiarPestana('login');
            } else { alert(data.message); }
        } catch (err) { alert("Error al conectar con servidor."); }
    });
}

// --- RECUPERACIÓN DE CONTRASEÑA ---
let emailRecuperacion = null;

function mostrarRecuperacion() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('registro-form').style.display = 'none';
    document.getElementById('recuperacion-form').style.display = 'block';
    document.querySelectorAll('.tabs-login')[0].style.display = 'none';
}

function volverALogin() {
    document.getElementById('recuperacion-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.querySelectorAll('.tabs-login')[0].style.display = 'flex';
}

function configurarRecuperacion() {
    const recupForm = document.getElementById('recuperacion-form');
    if (!recupForm) return;

    recupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recup-email').value.trim();
        if (!email) { alert('Ingresa un correo.'); return; }

        try {
            const res = await fetch(API_BASE + '/api/recuperar-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("✅ Código enviado a tu correo.");
                document.getElementById('paso-email-recup').style.display = 'none';
                document.getElementById('paso-token-recup').style.display = 'block';
                emailRecuperacion = email;
            } else { alert("❌ " + data.message); }
        } catch (err) { alert("Error de conexión al servidor."); }
    });
}

async function restablecerConContrasena() {
    const token = document.getElementById('recup-token').value.trim();
    const nuevaPassword = document.getElementById('recup-password').value;

    if (!token || !nuevaPassword) { alert('Completa todos los campos.'); return; }
    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(nuevaPassword)) {
        alert('⚠️ La contraseña debe contener NÚMERO, MAYÚSCULA y SÍMBOLO.');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/api/restablecer-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailRecuperacion, token, nuevaPassword })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert("✅ " + data.message);
            volverALogin();
            cambiarPestana('login');
        } else { alert("❌ " + data.message); }
    } catch (err) { alert("Error de conexión al servidor."); }
}

// --- CERRAR SESIÓN ---
function cerrarSesion() {
    usuarioActual = null;
    menuUsuario = [];
    actualizarNavbar();
    irAInicio();
}

// --- CARGAR DROPDOWNS ---
async function cargarDropdownsEstaticos() {
    try {
        const resCat = await fetch(API_BASE + '/api/categorias');
        const dataCat = await resCat.json();
        if (dataCat.success) {
            const selectCat = document.getElementById('admin-serv-cat');
            if (selectCat) {
                selectCat.innerHTML = '';
                dataCat.categorias.forEach(c => {
                    selectCat.innerHTML += '<option value="' + c.id_categoria + '">' + c.nombre + '</option>';
                });
            }
        }
        const resEsp = await fetch(API_BASE + '/api/especialidades');
        const dataEsp = await resEsp.json();
        if (dataEsp.success) {
            const selectEsp = document.getElementById('admin-emp-esp');
            if (selectEsp) {
                selectEsp.innerHTML = '';
                dataEsp.especialidades.forEach(e => {
                    selectEsp.innerHTML += '<option value="' + e.id_especialidad + '">' + e.nombre_especialidad + '</option>';
                });
            }
        }
    } catch (err) { console.error("Error al cargar dropdowns", err); }
}

// --- MENÚ DINÁMICO POR PRIVILEGIOS ---
async function cargarMenuUsuario(ci) {
    try {
        const res = await fetch(API_BASE + '/api/menus-usuario/' + ci);
        const data = await res.json();
        if (data.success) {
            menuUsuario = data.menu;
            renderizarMenuPaquetes();
            renderizarMenuMovil();
        }
    } catch (err) { console.error('Error cargando menú:', err); }
}

function renderizarMenuPaquetes() {
    const navPackages = document.getElementById('nav-menu-packages');
    const navMovil = document.getElementById('nav-menu-movil');
    if (!navPackages) return;

    navPackages.innerHTML = '';
    if (navMovil) navMovil.innerHTML = '';

    // SIEMPRE mostrar paquetes (visitantes y logueados)
    fetch(`${API_BASE}/api/admin/paquetes-sistema`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                data.paquetes.forEach(paquete => {
                    agregarPaqueteAlMenu(paquete, navPackages, navMovil);
                });
                // También actualizar menú móvil
                if (navMovil) {
                    navMovil.innerHTML = navPackages.innerHTML;
                }
            }
        });
}

function agregarPaqueteAlMenu(paquete, container, containerMovil) {
    const li = document.createElement('li');
    li.className = 'nav-package';

    const casosUso = paquete.casos_uso || [];
    let casosUsoHTML = '';
    
    casosUso.filter(cu => cu && cu.nombre).forEach(cu => {
        const nombreSafe = cu.nombre.replace(/'/g, "\\'");
        
        // Determinar si el usuario puede usar este CU
        let puedeUsar = false;
        let onclick = `mostrarSeccion('login')`; // Por defecto, redirigir a login
        
        if (usuarioActual) {
            if (usuarioActual.rol === 'Administrador') {
                puedeUsar = true;
            } else if (usuarioActual.rol === 'Personal') {
                // Personal puede usar CUs asignados en privilegios
                puedeUsar = menuUsuario.some(m => 
                    m.cus && m.cus.some(c => c.nombre === cu.nombre)
                );
            } else if (usuarioActual.rol === 'Cliente') {
                // Clientes solo pueden: Agendar Reserva, Ver Catálogo, Mi Perfil
                puedeUsar = ['Agendar Reserva', 'Ver Catálogo', 'Mi Perfil'].includes(cu.nombre);
            }
            
            if (puedeUsar) {
                onclick = `navegarCU('${nombreSafe}')`;
            }
        } else {
            // Visitante: Reemplazar "Iniciar Sesión" con "Registrarse"
            if (cu.nombre === 'Iniciar Sesión') {
                onclick = `irARegistro()`;
            }
        }
        
        casosUsoHTML += `<li><a href="#" class="submenu-link" onclick="${onclick}">${cu.nombre}</a></li>`;
    });

    const idPaquete = paquete.id_paquete_sist || paquete.id;

    li.innerHTML = 
        `<a href="#paquete-${idPaquete}" class="nav-link" onclick="toggleSubmenu(event, 'submenu-${idPaquete}'); return false;">
            ${paquete.nombre}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </a>
        <ul class="submenu" id="submenu-${idPaquete}">
            ${casosUsoHTML}
        </ul>`;
    
    container.appendChild(li);
}
            });
        return;
    }

    // Usuarios normales según privilegios
    menuUsuario.forEach(paquete => {
        agregarPaqueteAlMenu(paquete, navPackages, false);
    });
}

function renderizarMenuMovil() {
    const navMovil = document.getElementById('nav-menu-movil');
    if (!navMovil) return;
    navMovil.innerHTML = '';
    navMovil.classList.remove('active');

    if (!usuarioActual) return;

    // Clonar el menú de escritorio
    const navPackages = document.getElementById('nav-menu-packages');
    if (navPackages) {
        navMovil.innerHTML = navPackages.innerHTML;
    }
}

function agregarPaqueteAlMenu(paquete, container, esAdmin) {
    const li = document.createElement('li');
    li.className = 'nav-package';

    const casosUso = paquete.casos_uso || paquete.cus || [];
    let casosUsoHTML = '';
    casosUso.filter(cu => cu && cu.nombre).forEach(cu => {
        const onclick = 'navegarCU(\'' + cu.nombre.replace(/'/g, "\\'") + '\')';
        casosUsoHTML += '<li><a href="#" class="submenu-link" onclick="' + onclick + '">' + cu.nombre + '</a></li>';
    });

    const idPaquete = paquete.id_paquete_sist || paquete.id;

    li.innerHTML =
        '<a href="#paquete-' + idPaquete + '" class="nav-link" onclick="toggleSubmenu(event, \'submenu-' + idPaquete + '\'); return false;">' +
        paquete.nombre +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</a>' +
        '<ul class="submenu" id="submenu-' + idPaquete + '">' +
        casosUsoHTML +
        '</ul>';
    container.appendChild(li);
}

function toggleSubmenu(evento, submenuId) {
    evento.preventDefault();
    const submenu = document.getElementById(submenuId);
    if (submenu) {
        document.querySelectorAll('.submenu.active').forEach(s => {
            if (s.id !== submenuId) s.classList.remove('active');
        });
        submenu.classList.toggle('active');
    }
}

function navegarCU(nombreCU) {
    if (!usuarioActual) {
        mostrarSeccion('login');
        return;
    }

    const mapeoCU = {
        'Iniciar Sesión': () => mostrarSeccion('login'),
        'Registrarse': () => irARegistro(),
        'Gestión de Usuarios': () => mostrarSeccion('panel-admin'),
        'Gestión de Personal': () => mostrarSeccion('panel-admin'),
        'Caja Registradora': () => mostrarSeccion('panel-admin'),
        'Consultar Ventas': () => mostrarSeccion('panel-admin'),
        'Agendar Reserva': () => mostrarSeccion('panel-cliente'),
        'Ver Catálogo': () => irAInicio(),
        'Mi Perfil': () => cargarPerfil(),
        'Cerrar Sesión': () => cerrarSesion()
    };

    if (mapeoCU[nombreCU]) {
        mapeoCU[nombreCU]();
    } else if (usuarioActual.rol === 'Administrador') {
        mostrarSeccion('panel-admin');
    } else {
        mostrarSeccion('panel-cliente');
    }
}

// --- PERFIL ---
function cargarPerfil() {
    if (!usuarioActual) return;
    if (usuarioActual.rol === 'Administrador') {
        mostrarSeccion('panel-admin');
    } else if (usuarioActual.rol === 'Personal') {
        mostrarSeccion('panel-personal');
    } else {
        mostrarSeccion('panel-cliente');
    }
}

// --- GESTIÓN DE PRIVILEGIOS ---
let privilegiosTemporales = [];
let ciActualPrivilegios = null;

async function cargarPrivilegiosAdmin() {
    const ci = document.getElementById('admin-buscar-ci').value.trim();
    if (!ci) { alert('Ingresa un CI'); return; }

    ciActualPrivilegios = ci;
    const lista = document.getElementById('admin-privilegios-lista');
    lista.innerHTML = 'Cargando...';

    try {
        const res = await fetch(API_BASE + '/api/admin/privilegios/' + ci);
        const data = await res.json();
        if (!data.success) { lista.innerHTML = '<p style="color:red;">Error</p>'; return; }

        privilegiosTemporales = data.privilegios.map(p => ({
            id_cu: p.id_cu,
            nombre_cu: p.nombre_cu,
            id_paquete_sist: p.id_paquete_sist,
            habilitado: p.tiene
        }));

        renderizarPrivilegios();
    } catch (err) {
        lista.innerHTML = '<p style="color:red;">Error de conexión</p>';
    }
}

function renderizarPrivilegios() {
    const lista = document.getElementById('admin-privilegios-lista');
    if (!lista) return;

    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
    let paqueteActual = null;

    privilegiosTemporales.forEach(p => {
        if (!paqueteActual || paqueteActual !== p.id_paquete_sist) {
            if (paqueteActual !== null) html += '</div></div>';
            paqueteActual = p.id_paquete_sist;
            const nombrePaquete =
                paqueteActual === 1 ? 'Seguridad' :
                    paqueteActual === 2 ? 'Reservas y Clientes' :
                        paqueteActual === 3 ? 'Catálogo y Personal' :
                            paqueteActual === 4 ? 'Caja y Finanzas' :
                                paqueteActual === 5 ? 'Inventario' : 'Otro';
            html += '<div style="border:1px solid #eaeaea; border-radius:8px; padding:15px;">' +
                '<h4 style="margin:0 0 10px 0; color: var(--color-primario);">' + nombrePaquete + '</h4>' +
                '<div style="display: flex; flex-direction: column; gap: 8px;">';
        }
        html += '<label style="display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 4px; ' + (p.habilitado ? 'background: #f0fff4;' : '') + '">' +
            '<input type="checkbox" ' + (p.habilitado ? 'checked' : '') + ' onchange="cambiarPrivilegioTemporal(' + p.id_cu + ', this.checked)">' +
            '<span>' + p.nombre_cu + ' (CU' + p.id_cu + ')</span>' +
            '</label>';
    });
    html += '</div></div>';
    html += '<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eaeaea;">' +
        '<button class="btn-registrarse" onclick="guardarPrivilegios()" style="width: 100%;">💾 Guardar Cambios</button>' +
        '</div>';
    html += '</div>';
    lista.innerHTML = html;
}

function cambiarPrivilegioTemporal(id_cu, habilitado) {
    const priv = privilegiosTemporales.find(p => p.id_cu === id_cu);
    if (priv) {
        priv.habilitado = habilitado;
        renderizarPrivilegios();
    }
}

async function guardarPrivilegios() {
    if (!ciActualPrivilegios) return;

    try {
        for (const priv of privilegiosTemporales) {
            await fetch(API_BASE + '/api/admin/privilegios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ci_usuario: ciActualPrivilegios,
                    id_cu: priv.id_cu,
                    habilitado: priv.habilitado
                })
            });
        }
        alert('✅ Privilegios guardados exitosamente.');
        cargarPrivilegiosAdmin();
    } catch (err) {
        alert('❌ Error al guardar privilegios.');
    }
}

// --- ADMIN: CAMBIAR PESTAÑAS ---
function cambiarTabAdmin(tab) {
    document.getElementById('tab-admin-servicios').classList.remove('active');
    document.getElementById('tab-admin-empleados').classList.remove('active');
    document.getElementById('tab-admin-sesiones').classList.remove('active');
    document.getElementById('tab-admin-privilegios').classList.remove('active');

    document.getElementById('vista-admin-servicios').classList.add('seccion-oculta');
    document.getElementById('vista-admin-empleados').classList.add('seccion-oculta');
    document.getElementById('vista-admin-sesiones').classList.add('seccion-oculta');
    document.getElementById('vista-admin-privilegios').classList.add('seccion-oculta');

    if (tab === 'servicios') {
        document.getElementById('tab-admin-servicios').classList.add('active');
        document.getElementById('vista-admin-servicios').classList.remove('seccion-oculta');
    } else if (tab === 'empleados') {
        document.getElementById('tab-admin-empleados').classList.add('active');
        document.getElementById('vista-admin-empleados').classList.remove('seccion-oculta');
        cargarEmpleadosAdmin();
    } else if (tab === 'sesiones') {
        document.getElementById('tab-admin-sesiones').classList.add('active');
        document.getElementById('vista-admin-sesiones').classList.remove('seccion-oculta');
        cargarSesionesAdmin();
    } else if (tab === 'privilegios') {
        document.getElementById('tab-admin-privilegios').classList.add('active');
        document.getElementById('vista-admin-privilegios').classList.remove('seccion-oculta');
    }
}

// --- ADMIN: CARGAR EMPLEADOS ---
async function cargarEmpleadosAdmin() {
    const tbody = document.getElementById('tabla-admin-empleados-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando empleados...</td></tr>';
    try {
        const res = await fetch(API_BASE + '/api/admin/empleados');
        const data = await res.json();
        if (data.success && data.empleados.length > 0) {
            tbody.innerHTML = '';
            data.empleados.forEach(emp => {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td><strong>' + emp.nombre + '</strong></td>' +
                    '<td>' + emp.ci + '</td>' +
                    '<td>' + (emp.telefono || '-') + '</td>' +
                    '<td>' + emp.email + '</td>' +
                    '<td><span class="badge pendiente">' + (emp.especialidades || 'Sin Especialidad') + '</span></td>';
                tbody.appendChild(tr);
            });
        } else { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay empleados.</td></tr>'; }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error.</td></tr>'; }
}

// --- ADMIN: CARGAR SESIONES ---
async function cargarSesionesAdmin() {
    const tbody = document.getElementById('tabla-admin-sesiones-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res = await fetch(API_BASE + '/api/admin/sesiones');
        const data = await res.json();
        if (data.success && data.sesiones.length > 0) {
            tbody.innerHTML = '';
            data.sesiones.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td><strong>' + s.nombre + '</strong></td>' +
                    '<td>' + s.email + '</td>' +
                    '<td><span class="badge ' + (s.rol === 'Administrador' ? 'confirmada' : 'pendiente') + '">' + s.rol + '</span></td>' +
                    '<td>' + s.fecha + '</td>';
                tbody.appendChild(tr);
            });
        } else { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay sesiones.</td></tr>'; }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error.</td></tr>'; }
}

// --- ADMIN: GESTIÓN DE SERVICIOS ---
function renderizarTablaAdminServicios(servicios) {
    const tbody = document.getElementById('tabla-admin-servicios-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    servicios.forEach(s => {
        const tr = document.createElement('tr');
        const precio = parseFloat(s.precio).toFixed(2);
        const cat = s.nombre_categoria || 'General';
        const btnEdit = '<button class="btn-table" onclick="prepararEdicionServicio(' + s.id_servicio + ', \'' + s.nombre_servicio.replace(/'/g, "\\'") + '\', \'' + (s.descripcion || '').replace(/'/g, "\\'") + '\', ' + precio + ', ' + (s.id_categoria || 1) + ')">Editar</button>';
        tr.innerHTML = '<td>' + s.id_servicio + '</td>' +
            '<td><strong>' + s.nombre_servicio + '</strong></td>' +
            '<td>' + precio + ' Bs.</td>' +
            '<td>' + cat + '</td>' +
            '<td>' + btnEdit + '</td>';
        tbody.appendChild(tr);
    });
}

function abrirModalAdminServicio() {
    document.getElementById('form-admin-servicio').reset();
    document.getElementById('admin-serv-id').value = '';
    document.getElementById('titulo-modal-servicio').innerText = 'Nuevo Servicio';
    document.getElementById('modal-admin-servicio').classList.remove('seccion-oculta');
}

function cerrarModalAdminServicio() {
    document.getElementById('modal-admin-servicio').classList.add('seccion-oculta');
}

function prepararEdicionServicio(id, nombre, desc, precio, id_cat) {
    document.getElementById('admin-serv-id').value = id;
    document.getElementById('admin-serv-nombre').value = nombre;
    document.getElementById('admin-serv-desc').value = desc;
    document.getElementById('admin-serv-precio').value = precio;
    document.getElementById('admin-serv-cat').value = id_cat;
    document.getElementById('titulo-modal-servicio').innerText = 'Editar Servicio ID: ' + id;
    document.getElementById('modal-admin-servicio').classList.remove('seccion-oculta');
}

const formAdminServicio = document.getElementById('form-admin-servicio');
if (formAdminServicio) {
    formAdminServicio.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-serv-id').value;
        const bodyData = {
            nombre_servicio: document.getElementById('admin-serv-nombre').value,
            descripcion: document.getElementById('admin-serv-desc').value,
            precio: parseFloat(document.getElementById('admin-serv-precio').value),
            id_categoria: parseInt(document.getElementById('admin-serv-cat').value)
        };
        const url = id ? API_BASE + '/api/admin/servicios/' + id : API_BASE + '/api/admin/servicios';
        const method = id ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            if (data.success) {
                alert("✅ " + data.message);
                cerrarModalAdminServicio();
                cargarServiciosDeBD();
            } else { alert("❌ " + data.message); }
        } catch (err) { alert("Error al guardar."); }
    });
}

// --- ADMIN: GESTIÓN DE EMPLEADOS ---
function abrirModalAdminEmpleado() {
    document.getElementById('form-admin-empleado').reset();
    document.getElementById('modal-admin-empleado').classList.remove('seccion-oculta');
}

function cerrarModalAdminEmpleado() {
    document.getElementById('modal-admin-empleado').classList.add('seccion-oculta');
}

const formAdminEmpleado = document.getElementById('form-admin-empleado');
if (formAdminEmpleado) {
    formAdminEmpleado.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bodyData = {
            ci: document.getElementById('admin-emp-ci').value,
            nombre: document.getElementById('admin-emp-nombre').value,
            telefono: document.getElementById('admin-emp-tel').value,
            email: document.getElementById('admin-emp-email').value,
            contrasena: document.getElementById('admin-emp-pass').value,
            id_especialidad: document.getElementById('admin-emp-esp').value
        };

        if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(bodyData.contrasena)) {
            alert("⚠️ La contraseña debe contener NÚMERO, MAYÚSCULA y SÍMBOLO.");
            return;
        }

        try {
            const res = await fetch(API_BASE + '/api/admin/empleados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            if (data.success) {
                alert("✅ " + data.message);
                cerrarModalAdminEmpleado();
                cargarEmpleadosAdmin();
            } else { alert("❌ " + data.message); }
        } catch (err) { alert("Error al registrar empleado."); }
    });
}

// --- PERSONAL: PESTAÑAS ---
function cambiarTabPersonal(tab) {
    document.getElementById('tab-pers-agenda').classList.remove('active');
    document.getElementById('tab-pers-comisiones').classList.remove('active');
    document.getElementById('vista-pers-agenda').classList.add('seccion-oculta');
    document.getElementById('vista-pers-comisiones').classList.add('seccion-oculta');

    if (tab === 'agenda') {
        document.getElementById('tab-pers-agenda').classList.add('active');
        document.getElementById('vista-pers-agenda').classList.remove('seccion-oculta');
    } else {
        document.getElementById('tab-pers-comisiones').classList.add('active');
        document.getElementById('vista-pers-comisiones').classList.remove('seccion-oculta');
    }
}

// --- PERSONAL: COMISIONES ---
async function consultarComisiones() {
    if (!usuarioActual || !usuarioActual.ci) return;
    const divResultado = document.getElementById('resultado-comisiones');
    divResultado.innerHTML = 'Cargando...';

    try {
        const res = await fetch(API_BASE + '/api/comisiones/' + usuarioActual.ci);
        const data = await res.json();

        if (data.success) {
            if (data.comisiones.length === 0) {
                divResultado.innerHTML = '<p>No tienes comisiones registradas.</p>';
                return;
            }
            let html = ''; let totalCobrar = 0;
            data.comisiones.forEach(c => {
                const fecha = new Date(c.fecha).toLocaleDateString('es-BO');
                const monto = parseFloat(c.monto_comision).toFixed(2);
                const colorEstado = c.estado_pago === 'Pendiente' ? '#c2956e' : '#28a745';
                html += '<div class="comision-item">' +
                    '<span><strong>' + fecha + '</strong> - Bs. ' + monto + '</span>' +
                    '<span style="color: ' + colorEstado + '; font-weight: bold;">' + c.estado_pago + '</span>' +
                    '</div>';
                if (c.estado_pago === 'Pendiente') totalCobrar += parseFloat(monto);
            });
            html += '<div style="margin-top: 15px; font-size: 16px;"><strong>Total Pendiente: <span style="color: #c2956e;">Bs. ' + totalCobrar.toFixed(2) + '</span></strong></div>';
            divResultado.innerHTML = html;
        } else { divResultado.innerHTML = '<span style="color: red;">Error.</span>'; }
    } catch (e) { divResultado.innerHTML = '<span style="color: red;">Error.</span>'; }
}

// --- CONFIGURACIÓN ---
function abrirModalConfig() {
    document.getElementById('modal-configuracion').classList.remove('seccion-oculta');
    cambiarTabModal('seguridad');
}

function cerrarModalConfig() {
    document.getElementById('modal-configuracion').classList.add('seccion-oculta');
    document.getElementById('form-cambio-password').reset();
}

function cambiarTabModal(tab) {
    document.getElementById('tab-mod-seguridad').classList.remove('active');
    document.getElementById('tab-mod-perfil').classList.remove('active');
    document.getElementById('tab-mod-notif').classList.remove('active');

    document.getElementById('form-cambio-password').style.display = 'none';
    document.getElementById('form-editar-perfil').style.display = 'none';
    document.getElementById('form-preferencias').style.display = 'none';

    if (tab === 'seguridad') {
        document.getElementById('tab-mod-seguridad').classList.add('active');
        document.getElementById('form-cambio-password').style.display = 'block';
    } else if (tab === 'perfil') {
        document.getElementById('tab-mod-perfil').classList.add('active');
        document.getElementById('form-editar-perfil').style.display = 'block';
    } else if (tab === 'notificaciones') {
        document.getElementById('tab-mod-notif').classList.add('active');
        document.getElementById('form-preferencias').style.display = 'block';
    }
}

const formCambioPassword = document.getElementById('form-cambio-password');
if (formCambioPassword) {
    formCambioPassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!usuarioActual) return;

        const passwordActual = document.getElementById('pass-actual').value;
        const passwordNueva = document.getElementById('pass-nueva').value;

        if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(passwordNueva)) {
            alert("⚠️ La nueva contraseña debe contener NÚMERO, MAYÚSCULA y SÍMBOLO.");
            return;
        }

        try {
            const res = await fetch(API_BASE + '/cambiar-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: usuarioActual.email, passwordActual, passwordNueva })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("✅ " + data.message);
                cerrarModalConfig();
            } else { alert("❌ " + data.message); }
        } catch (err) { alert("Error de conexión."); }
    });
}
