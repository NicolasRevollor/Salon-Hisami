// --- NAVEGACIÓN Y VISTAS ---
const mainLanding = document.getElementById('main-landing');
const seccionesSistema = document.querySelectorAll('.sistema-section');
const navbar = document.getElementById('navbar');
let usuarioActual = null;
let catalogoCompleto = []; 
let menuUsuario = [];
const API_BASE = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    cargarServiciosDeBD();
    cargarDropdownsEstaticos();
    configurarRecuperacion();
    // NO cargar paquetes públicos - solo tras login

    const hamburger = document.getElementById('hamburger');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            document.getElementById('nav-menu-movil').classList.toggle('active');
        });
    }
});

function mostrarSeccion(idSeccion) {
    window.scrollTo(0, 0);
    if (idSeccion === 'landing') {
        mainLanding.classList.remove('seccion-oculta');
        seccionesSistema.forEach(sec => sec.classList.add('seccion-oculta'));
        navbar.style.display = 'flex';
    } else {
        mainLanding.classList.add('seccion-oculta');
        seccionesSistema.forEach(sec => sec.classList.add('seccion-oculta'));
        const seccion = document.getElementById(idSeccion);
        if (seccion) seccion.classList.remove('seccion-oculta');
        if(idSeccion === 'login') navbar.style.display = 'none';
        else navbar.style.display = 'flex';
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
        iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06 5.06m-4.97-4.97A9.12 9.12 0 0 1 12 7a9 9 0 0 1 4.94 2.06m-5.94-5.94"></path><line x1="1" y1="1" x2="23" у2="23"></line></svg>`;
    } else {
        input.type = 'password';
        iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
}

// --- CARGA DE DROPDOWNS DESDE BD ---
async function cargarDropdownsEstaticos() {
    try {
        const resCat = await fetch(`${API_BASE}/api/categorias`);
        const dataCat = await resCat.json();
        if(dataCat.success) {
            const selectCat = document.getElementById('admin-serv-cat');
            if(selectCat) {
                selectCat.innerHTML = '';
                dataCat.categorias.forEach(c => {
                    selectCat.innerHTML += `<option value="${c.id_categoria}">${c.nombre}</option>`;
                });
            }
        }
        const resEsp = await fetch(`${API_BASE}/api/especialidades`);
        const dataEsp = await resEsp.json();
        if(dataEsp.success) {
            const selectEsp = document.getElementById('admin-emp-esp');
            if(selectEsp) {
                selectEsp.innerHTML = '';
                dataEsp.especialidades.forEach(e => {
                    selectEsp.innerHTML += `<option value="${e.id_especialidad}">${e.nombre_especialidad}</option>`;
                });
            }
        }
    } catch(err) { console.error("Error al cargar dropdowns dinámicos", err); }
}

// --- LÓGICA DE CATÁLOGO ---
async function cargarServiciosDeBD() {
    const contenedor = document.getElementById('contenedor-servicios');
    if(contenedor) contenedor.innerHTML = '<p style="text-align:center; width:100%; color:#666;">Cargando catálogo...</p>';

    try {
        const res = await fetch(`${API_BASE}/api/servicios`);
        const data = await res.json();
        if (data.success) {
            catalogoCompleto = [
                ...(data.paquetes || []).map(p => ({ ...p, tipo_dato: 'paquete' })),
                ...(data.servicios || []).map(s => ({ ...s, tipo_dato: 'individual' }))
            ];
            filtrarServicios('todos', document.querySelector('.btn-filtro.activo'));
            
            if(usuarioActual && usuarioActual.rol === 'Administrador') {
                renderizarTablaAdminServicios(data.servicios || []);
            }
        }
    } catch (error) { console.error("Error al obtener servicios"); }
}

function filtrarServicios(filtro, btnPresionado) {
    const contenedor = document.getElementById('contenedor-servicios');
    if(!contenedor) return;
    contenedor.innerHTML = ''; 

    if(btnPresionado) {
        document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('activo'));
        btnPresionado.classList.add('activo');
    }

    let lista = catalogoCompleto;
    if (filtro === 'paquetes') lista = catalogoCompleto.filter(s => s.tipo_dato === 'paquete');
    else if (filtro === 'cabello') lista = catalogoCompleto.filter(s => s.nombre_categoria && (s.nombre_categoria.toLowerCase().includes('peluquería') || s.nombre_categoria.toLowerCase().includes('colorimetría') || s.nombre_categoria.toLowerCase().includes('barbería') || s.nombre_categoria.toLowerCase().includes('tratamientos')));
    else if (filtro === 'uñas') lista = catalogoCompleto.filter(s => s.nombre_categoria && (s.nombre_categoria.toLowerCase().includes('manicura') || s.nombre_categoria.toLowerCase().includes('pedicura')));
    else if (filtro === 'faciales') lista = catalogoCompleto.filter(s => s.nombre_categoria && (s.nombre_categoria.toLowerCase().includes('facial') || s.nombre_categoria.toLowerCase().includes('depilación')));
    else if (filtro === 'masajes') lista = catalogoCompleto.filter(s => s.nombre_categoria && s.nombre_categoria.toLowerCase().includes('masajes'));
    else if (filtro === 'maquillaje') lista = catalogoCompleto.filter(s => s.nombre_categoria && s.nombre_categoria.toLowerCase().includes('maquillaje'));

    if(lista.length === 0) {
        contenedor.innerHTML = '<p style="color:#666; width:100%; text-align:center; padding:40px;">No hay servicios para esta categoría.</p>';
        return;
    }

    lista.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-servicio';
        const nombreItem = item.nombre_servicio || item.nombre || 'Servicio';
        const precioLimpio = parseFloat(String(item.precio || item.precio_promocional || 0).replace(/[^0-9.-]+/g,"")) || 0;
        const categoriaBadge = item.tipo_dato === 'paquete' ? 'PAQUETE' : (item.nombre_categoria || 'Servicio');

        div.innerHTML = `
            <span class="badge-categoria">${categoriaBadge.toUpperCase()}</span>
            <h3>${nombreItem}</h3>
            <p>${item.descripcion || 'Tratamiento profesional ejecutado por nuestro equipo experto.'}</p>
            <div class="card-footer">
                <div class="card-precio">${precioLimpio.toFixed(2)} Bs</div>
                <button class="btn-registrarse" onclick="mostrarSeccion('login')">Reservar</button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

function actualizarNavbar() {
    if(usuarioActual) {
        document.getElementById('nav-actions-public').style.display = 'none';
        document.getElementById('nav-actions-logged').style.display = 'flex';
        document.getElementById('nav-user-welcome').innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            ${usuarioActual.nombre.split(' ')[0]} (${usuarioActual.rol})
        `;
        cargarMenuUsuario(usuarioActual.ci);
    } else {
        document.getElementById('nav-actions-public').style.display = 'flex';
        document.getElementById('nav-actions-logged').style.display = 'none';
        document.getElementById('nav-menu-packages').innerHTML = '';
    }
}

// --- LOGIN ---
const loginForm = document.getElementById('login-form');
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const contrasena = document.getElementById('password').value;

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, contrasena })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                usuarioActual = data.user; 
                loginForm.reset();
                actualizarNavbar();
                
                // Volver a la página principal con sesión activa
                irAInicio();
            } else {
                alert("❌ " + data.message);
            }
        } catch (err) { alert("Error de conexión al servidor."); }
    });
}

// --- REGISTRO DE CLIENTE ---
const registroForm = document.getElementById('registro-form');
if(registroForm) {
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
            const res = await fetch(`${API_BASE}/registro`, {
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
let pasoActualRecup = 'email';

function mostrarRecuperacion() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('registro-form').style.display = 'none';
    document.getElementById('recuperacion-form').style.display = 'block';
    document.getElementById('paso-email-recup').style.display = 'block';
    document.getElementById('paso-token-recup').style.display = 'none';
    document.querySelectorAll('.tabs-login')[0].style.display = 'none';
    pasoActualRecup = 'email';
    emailRecuperacion = null;
}

function volverALogin() {
    document.getElementById('recuperacion-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('registro-form').style.display = 'none';
    document.querySelectorAll('.tabs-login')[0].style.display = 'flex';
    document.getElementById('recup-email').value = '';
    document.getElementById('recup-token').value = '';
    document.getElementById('recup-password').value = '';
    pasoActualRecup = 'email';
    emailRecuperacion = null;
}

function configurarRecuperacion() {
    const recupForm = document.getElementById('recuperacion-form');
    if (!recupForm) return;

    recupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (pasoActualRecup === 'email') {
            const email = document.getElementById('recup-email').value.trim();
            if (!email) { alert('Ingresa un correo.'); return; }

            try {
                const res = await fetch(`${API_BASE}/api/recuperar-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert("✅ Código enviado a tu correo. Revisa tu bandeja de entrada.");
                    emailRecuperacion = email;
                    document.getElementById('paso-email-recup').style.display = 'none';
                    document.getElementById('paso-token-recup').style.display = 'block';
                    pasoActualRecup = 'token';
                } else { alert("❌ " + data.message); }
            } catch (err) { alert("Error de conexión al servidor."); }
        }
    });
}

async function restablecerConContrasena() {
    const token = document.getElementById('recup-token').value.trim();
    const nuevaPassword = document.getElementById('recup-password').value;

    if (!token) { alert('Ingresa el código recibido.'); return; }
    if (!nuevaPassword) { alert('Ingresa la nueva contraseña.'); return; }
    if (!/(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(nuevaPassword)) {
        alert('⚠️ La contraseña debe contener NÚMERO, MAYÚSCULA y SÍMBOLO.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/restablecer-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailRecuperacion, token, nuevaPassword })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert("✅ " + data.message);
            volverALogin();
            cambiarPestana('login');
            if (emailRecuperacion) {
                document.getElementById('email').value = emailRecuperacion;
            }
        } else { alert("❌ " + data.message); }
    } catch (err) { alert("Error de conexión al servidor."); }
}

// --- PESTAÑAS: PANEL DE PERSONAL ---
function cambiarTabPersonal(tab) {
    document.getElementById('tab-pers-agenda').classList.remove('active');
    document.getElementById('tab-pers-comisiones').classList.remove('active');
    document.getElementById('vista-pers-agenda').classList.add('seccion-oculta');
    document.getElementById('vista-pers-comisiones').classList.add('seccion-oculta');

    if(tab === 'agenda') {
        document.getElementById('tab-pers-agenda').classList.add('active');
        document.getElementById('vista-pers-agenda').classList.remove('seccion-oculta');
    } else {
        document.getElementById('tab-pers-comisiones').classList.add('active');
        document.getElementById('vista-pers-comisiones').classList.remove('seccion-oculta');
    }
}

async function consultarComisiones() {
    if (!usuarioActual || !usuarioActual.ci) return;
    const divResultado = document.getElementById('resultado-comisiones');
    divResultado.innerHTML = 'Cargando registros...';

    try {
        const res = await fetch(`${API_BASE}/api/comisiones/${usuarioActual.ci}`);
        const data = await res.json();

        if (data.success) {
            if (data.comisiones.length === 0) {
                divResultado.innerHTML = '<p>No tienes comisiones registradas aún.</p>';
                return;
            }
            let html = ''; let totalCobrar = 0;
            data.comisiones.forEach(c => {
                const fecha = new Date(c.fecha).toLocaleDateString('es-BO');
                const monto = parseFloat(c.monto_comision).toFixed(2);
                const colorEstado = c.estado_pago === 'Pendiente' ? '#c2956e' : '#28a745'; 
                html += `
                    <div class="comision-item">
                        <span><strong>${fecha}</strong> - Bs. ${monto}</span>
                        <span style="color: ${colorEstado}; font-weight: bold;">${c.estado_pago}</span>
                    </div>
                `;
                if(c.estado_pago === 'Pendiente') totalCobrar += parseFloat(monto);
            });
            html += `<div style="margin-top: 15px; font-size: 16px;">
                        <strong>Total Pendiente: <span style="color: #c2956e;">Bs. ${totalCobrar.toFixed(2)}</span></strong>
                     </div>`;
            divResultado.innerHTML = html;
        } else { divResultado.innerHTML = '<span style="color: red;">Error en BD.</span>'; }
    } catch (e) { divResultado.innerHTML = '<span style="color: red;">Error de servidor.</span>'; }
}

// --- PESTAÑAS Y LÓGICA: PANEL DE ADMINISTRADOR ---
function cambiarTabAdmin(tab) {
    document.getElementById('tab-admin-servicios').classList.remove('active');
    document.getElementById('tab-admin-empleados').classList.remove('active');
    document.getElementById('tab-admin-sesiones').classList.remove('active');
    document.getElementById('tab-admin-privilegios').classList.remove('active');
    
    document.getElementById('vista-admin-servicios').classList.add('seccion-oculta');
    document.getElementById('vista-admin-empleados').classList.add('seccion-oculta');
    document.getElementById('vista-admin-sesiones').classList.add('seccion-oculta');
    document.getElementById('vista-admin-privilegios').classList.add('seccion-oculta');

    if(tab === 'servicios') {
        document.getElementById('tab-admin-servicios').classList.add('active');
        document.getElementById('vista-admin-servicios').classList.remove('seccion-oculta');
    } else if(tab === 'empleados') {
        document.getElementById('tab-admin-empleados').classList.add('active');
        document.getElementById('vista-admin-empleados').classList.remove('seccion-oculta');
        cargarEmpleadosAdmin();
    } else if(tab === 'sesiones') {
        document.getElementById('tab-admin-sesiones').classList.add('active');
        document.getElementById('vista-admin-sesiones').classList.remove('seccion-oculta');
        cargarSesionesAdmin();
    } else if(tab === 'privilegios') {
        document.getElementById('tab-admin-privilegios').classList.add('active');
        document.getElementById('vista-admin-privilegios').classList.remove('seccion-oculta');
    }
}

async function cargarSesionesAdmin() {
    const tbody = document.getElementById('tabla-admin-sesiones-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/api/admin/sesiones`);
        const data = await res.json();
        if (data.success && data.sesiones.length > 0) {
            tbody.innerHTML = '';
            data.sesiones.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${s.nombre}</strong></td>
                    <td>${s.email}</td>
                    <td><span class="badge ${s.rol === 'Administrador' ? 'confirmada' : 'pendiente'}">${s.rol}</span></td>
                    <td>${s.fecha}</td>
                `;
                tbody.appendChild(tr);
            });
        } else { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay sesiones recientes.</td></tr>'; }
    } catch(e) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error.</td></tr>'; }
}

async function cargarEmpleadosAdmin() {
    const tbody = document.getElementById('tabla-admin-empleados-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando empleados...</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/api/admin/empleados`);
        const data = await res.json();
        if (data.success && data.empleados.length > 0) {
            tbody.innerHTML = '';
            data.empleados.forEach(emp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${emp.nombre}</strong></td>
                    <td>${emp.ci}</td>
                    <td>${emp.telefono || '-'}</td>
                    <td>${emp.email}</td>
                    <td><span class="badge pendiente">${emp.especialidades || 'Sin Especialidad'}</span></td>
                `;
                tbody.appendChild(tr);
            });
        } else { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay empleados registrados.</td></tr>'; }
    } catch(e) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar.</td></tr>'; }
}

function abrirModalAdminEmpleado() {
    document.getElementById('form-admin-empleado').reset();
    document.getElementById('modal-admin-empleado').classList.remove('seccion-oculta');
}
function cerrarModalAdminEmpleado() {
    document.getElementById('modal-admin-empleado').classList.add('seccion-oculta');
}

const formAdminEmpleado = document.getElementById('form-admin-empleado');
if(formAdminEmpleado) {
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
            const res = await fetch(`${API_BASE}/api/admin/empleados`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            if(data.success) {
                alert("✅ " + data.message);
                cerrarModalAdminEmpleado();
                cargarEmpleadosAdmin(); 
            } else { alert("❌ " + data.message); }
        } catch(err) { alert("Error al registrar empleado."); }
    });
}

function renderizarTablaAdminServicios(serviciosIndividuales) {
    const tbody = document.getElementById('tabla-admin-servicios-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    serviciosIndividuales.forEach(s => {
        const tr = document.createElement('tr');
        const precio = parseFloat(s.precio).toFixed(2);
        const cat = s.nombre_categoria || 'General';
        const btnEdit = `<button class="btn-table" onclick="prepararEdicionServicio(${s.id_servicio}, '${s.nombre_servicio.replace(/'/g, "\\'")}', '${(s.descripcion||'').replace(/'/g, "\\'")}', ${precio}, ${s.id_categoria || 1})">Editar</button>`;
        tr.innerHTML = `
            <td>${s.id_servicio}</td>
            <td><strong>${s.nombre_servicio}</strong></td>
            <td>${precio} Bs.</td>
            <td>${cat}</td>
            <td>${btnEdit}</td>
        `;
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
if(formAdminServicio) {
    formAdminServicio.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-serv-id').value;
        const bodyData = {
            nombre_servicio: document.getElementById('admin-serv-nombre').value,
            descripcion: document.getElementById('admin-serv-desc').value,
            precio: parseFloat(document.getElementById('admin-serv-precio').value),
            id_categoria: parseInt(document.getElementById('admin-serv-cat').value)
        };
        const url = id ? `${API_BASE}/api/admin/servicios/${id}` : `${API_BASE}/api/admin/servicios`;
        const method = id ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            if(data.success) {
                alert("✅ " + data.message);
                cerrarModalAdminServicio();
                cargarServiciosDeBD(); 
            } else { alert("❌ " + data.message); }
        } catch(err) { alert("Error al guardar el servicio."); }
    });
}

// --- MODAL DE CONFIGURACIÓN ---
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

    if(tab === 'seguridad') {
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
if(formCambioPassword) {
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
            const res = await fetch(`${API_BASE}/cambiar-password`, {
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

function cerrarSesion() {
    usuarioActual = null;
    menuUsuario = [];
    actualizarNavbar();
    irAInicio();
}

// --- MENÚ DINÁMICO POR PRIVILEGIOS ---

async function cargarMenuUsuario(ci) {
    try {
        const res = await fetch(`${API_BASE}/api/menus-usuario/${ci}`);
        const data = await res.json();
        if (data.success) {
            menuUsuario = data.menu;
            renderizarMenuPaquetes();
        }
    } catch (err) { console.error('Error cargando menú:', err); }
}

function renderizarMenuPaquetes() {
    const navPackages = document.getElementById('nav-menu-packages');
    const navMovil = document.getElementById('nav-menu-movil');
    if (!navPackages) return;
    
    navPackages.innerHTML = '';
    if (navMovil) navMovil.innerHTML = '';
    
    // Si es admin, mostrar TODO automáticamente
    if (usuarioActual && usuarioActual.rol === 'Administrador') {
        // Cargar todos los paquetes y CUs para admin
        fetch(`${API_BASE}/api/admin/paquetes-sistema`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    data.paquetes.forEach(paquete => {
                        agregarPaqueteAlMenu(paquete, navPackages, navMovil, true);
                    });
                }
            });
        return;
    }
    
    // Para otros usuarios, mostrar según privilegios
    menuUsuario.forEach(paquete => {
        agregarPaqueteAlMenu(paquete, navPackages, navMovil, false);
    });
}

function agregarPaqueteAlMenu(paquete, navPackages, navMovil, esAdmin) {
    const li = document.createElement('li');
    li.className = 'nav-package';
    
    const casosUsoHTML = paquete.casos_uso && paquete.casos_uso.filter(cu => cu && cu.nombre).map(cu => {
        const onclick = esAdmin ? 
            `navegarCU('${cu.nombre}')` : 
            `verificarSesionParaCU('${cu.nombre.replace(/'/g, "\\'")}')`;
        return `<li><a href="#" class="submenu-link" onclick="${onclick}">${cu.nombre}</a></li>`;
    }).join('');
    
    li.innerHTML = `
        <a href="#paquete-${paquete.id_paquete_sist || paquete.id}" class="nav-link" onclick="toggleSubmenu(event, 'submenu-${paquete.id_paquete_sist || paquete.id}'); return false;">
            ${paquete.nombre}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </a>
        <ul class="submenu" id="submenu-${paquete.id_paquete_sist || paquete.id}">
            ${casosUsoHTML}
        </ul>
    `;
    navPackages.appendChild(li);
    
    if (navMovil) {
        const liMovil = li.cloneNode(true);
        navMovil.appendChild(liMovil);
    }
}

function toggleSubmenu(event, submenuId) {
    event.preventDefault();
    const submenu = document.getElementById(submenuId);
    if (submenu) {
        // Cerrar otros submenus
        document.querySelectorAll('.submenu.active').forEach(s => {
            if (s.id !== submenuId) s.classList.remove('active');
        });
        submenu.classList.toggle('active');
    }
}

function verificarSesionParaCU(nombreCU) {
    if (!usuarioActual) {
        alert('Debes iniciar sesión para acceder a esta función');
        mostrarSeccion('login');
        return;
    }
    navegarCU(nombreCU);
}

function navegarCU(nombreCU) {
    if (!usuarioActual) {
        mostrarSeccion('login');
        return;
    }
    
    // Mapear nombres de CU a acciones
    const mapeoCU = {
        'Iniciar Sesión': () => mostrarSeccion('login'),
        'Registrarse': () => irARegistro(),
        'Gestión de Usuarios': () => mostrarSeccion('panel-admin'),
        'Agendar Reserva': () => mostrarSeccion('panel-cliente'),
        'Ver Catálogo': () => irAInicio(),
        'Mi Perfil': () => cargarPerfil(),
        'Cerrar Sesión': () => cerrarSesion()
    };
    
    if (mapeoCU[nombreCU]) {
        mapeoCU[nombreCU]();
    } else if (usuarioActual.rol === 'Administrador') {
        // Admin puede ir a cualquier parte
        mostrarSeccion('panel-admin');
    } else {
        mostrarSeccion('panel-cliente');
    }
}
    } catch (err) { console.error('Error cargando paquetes públicos:', err); }
}

function renderizarPaquetesPublicos(paquetes) {
    const navPackages = document.getElementById('nav-menu-packages');
    const navMovil = document.getElementById('nav-menu-movil');
    if (!navPackages) return;
    
    navPackages.innerHTML = '';
    if (navMovil) navMovil.innerHTML = '';
    
    paquetes.forEach(paquete => {
        if (!paquete.casos_uso) return; // Skip if no casos_uso
        
        const li = document.createElement('li');
        li.className = 'nav-package';
        
        const casosUsoHTML = paquete.casos_uso
            .filter(cu => cu && cu.nombre)
            .map(cu => `<li><a href="#" class="submenu-link" onclick="verificarSesionParaCU('${cu.nombre.replace(/'/g, "\\'")}')">${cu.nombre}</a></li>`)
            .join('');
        
        li.innerHTML = `
            <a href="#paquete-${paquete.id_paquete_sist}" class="nav-link" onclick="toggleSubmenu(event, 'submenu-${paquete.id_paquete_sist}'); return false;">
                ${paquete.nombre}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </a>
            <ul class="submenu" id="submenu-${paquete.id_paquete_sist}">
                ${casosUsoHTML}
            </ul>
        `;
        navPackages.appendChild(li);
        
        if (navMovil) {
            const liMovil = li.cloneNode(true);
            navMovil.appendChild(liMovil);
        }
    });
}

function verificarSesionParaCU(nombreCU) {
    if (!usuarioActual) {
        alert('Debes iniciar sesión para acceder a ' + nombreCU);
        mostrarSeccion('login');
        return;
    }
    // Si está logueado, navegar al CU correspondiente
    navegarCUPorNombre(nombreCU);
}

function navegarCUPorNombre(nombreCU) {
    // Mapear nombre de CU a sección
    const mapeoCU = {
        'Gestión de Usuarios': 'panel-admin',
        'Gestión de Personal': 'panel-admin',
        'Caja Registradora': 'panel-admin',
        'Consultar Ventas': 'panel-admin',
        'Agendar Reserva': 'panel-cliente',
        'Ver Catálogo': 'landing',
        'Mi Perfil': 'panel-cliente'
    };
    const seccion = mapeoCU[nombreCU] || 'panel-cliente';
    mostrarSeccion(seccion);
}

async function cargarMenuUsuario(ci) {
    try {
        const res = await fetch(`${API_BASE}/api/menus-usuario/${ci}`);
        const data = await res.json();
        if (data.success) {
            menuUsuario = data.menu;
            renderizarMenuPaquetes();
        }
    } catch (err) { console.error('Error cargando menú:', err); }
}

function renderizarMenuPaquetes() {
    const navPackages = document.getElementById('nav-menu-packages');
    if (!navPackages) return;
    
    navPackages.innerHTML = '';
    
    // Renderizar paquetes como menú principal
    menuUsuario.forEach(paquete => {
        const li = document.createElement('li');
        li.className = 'nav-package';
        
        const nombrePaquete = paquete.nombre;
        const idPaquete = paquete.id;
        
        li.innerHTML = `
            <a href="#paquete-${idPaquete}" class="nav-link" onclick="toggleSubmenu(event, 'submenu-${idPaquete}')">
                ${nombrePaquete}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </a>
            <ul class="submenu" id="submenu-${idPaquete}">
                ${paquete.cus.map(cu => `
                    <li><a href="#${cu.ruta || '#'}" class="submenu-link" onclick="navegarCU('${cu.ruta || '#'}')">${cu.nombre}</a></li>
                `).join('')}
            </ul>
        `;
        navPackages.appendChild(li);
    });
    
    // Actualizar menú móvil también
    const navMovil = document.getElementById('nav-menu-movil');
    if (navMovil) {
        navMovil.innerHTML = navPackages.innerHTML;
    }
}

function toggleSubmenu(event, submenuId) {
    event.preventDefault();
    const submenu = document.getElementById(submenuId);
    if (submenu) {
        submenu.classList.toggle('active');
    }
}

function navegarCU(ruta) {
    if (ruta && ruta !== '#') {
        mostrarSeccion(ruta);
    }
}

// --- GESTIÓN DE PRIVILEGIOS CON BOTÓN GUARDAR ---
let privilegiosTemporales = [];
let ciActualPrivilegios = null;

async function cargarPrivilegiosAdmin() {
    const ci = document.getElementById('admin-buscar-ci').value.trim();
    if (!ci) { alert('Ingresa un CI'); return; }
    
    ciActualPrivilegios = ci;
    const lista = document.getElementById('admin-privilegios-lista');
    lista.innerHTML = 'Cargando...';

    try {
        const res = await fetch(`${API_BASE}/api/admin/privilegios/${ci}`);
        const data = await res.json();
        if (!data.success) { lista.innerHTML = '<p style="color:red;">Error</p>'; return; }

        // Inicializar privilegios temporales
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
            html += `
                <div style="border:1px solid #eaeaea; border-radius:8px; padding:15px;">
                    <h4 style="margin:0 0 10px 0; color: var(--color-primario);">${nombrePaquete}</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
            `;
        }
        html += `
            <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 4px; ${p.habilitado ? 'background: #f0fff4;' : ''}">
                <input type="checkbox" ${p.habilitado ? 'checked' : ''} onchange="cambiarPrivilegioTemporal(${p.id_cu}, this.checked)">
                <span>${p.nombre_cu} (CU${p.id_cu})</span>
            </label>
        `;
    });
    html += '</div></div>';
    html += `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eaeaea;">
            <button class="btn-registrarse" onclick="guardarPrivilegios()" style="width: 100%;">
                💾 Guardar Cambios
            </button>
        </div>
    `;
    html += '</div>';
    lista.innerHTML = html;
}

function cambiarPrivilegioTemporal(id_cu, habilitado) {
    const priv = privilegiosTemporales.find(p => p.id_cu === id_cu);
    if (priv) {
        priv.habilitado = habilitado;
        renderizarPrivilegios(); // Re-render to update colors
    }
}

async function guardarPrivilegios() {
    if (!ciActualPrivilegios) return;
    
    try {
        // Guardar todos los privilegios modificados
        for (const priv of privilegiosTemporales) {
            await fetch(`${API_BASE}/api/admin/privilegios`, {
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
        cargarPrivilegiosAdmin(); // Recargar
    } catch (err) {
        alert('❌ Error al guardar privilegios.');
    }
}
