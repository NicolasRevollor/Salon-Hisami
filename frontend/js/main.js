// =============================================================================
// main.js — CONFIGURACIÓN GLOBAL, UTILIDADES Y NAVEGACIÓN
// Este archivo se carga PRIMERO. Define las variables globales y las funciones
// que usan TODOS los demás archivos. Si algo falla aquí, todo lo demás falla.
// =============================================================================

// ─── VARIABLES GLOBALES ──────────────────────────────────────────────────────
// API_BASE → dirección del servidor. El frontend siempre pide datos aquí.
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

// usuarioActual → guarda los datos del usuario logueado ({ ci, nombre, rol, email })
// Si es null, el usuario NO está logueado.
let usuarioActual = null;

// menuUsuario → array con los módulos/CUs del menú hamburguesa del usuario logueado
let menuUsuario = [];

// catalogoCompleto → todos los servicios cargados desde la BD (para filtrar sin ir al servidor)
let catalogoCompleto = [];

// Caché de datos del panel admin (evita pedir a la BD cada vez que se abre un modal)
let serviciosCache  = {}; // { id_servicio: datosServicio }
let empleadosCache  = {}; // { ci: datosEmpleado }
let paquetesCache   = {}; // { id_paquete: datosPaquete }

// Lista temporal de especialidades seleccionadas al CREAR un empleado (antes de guardar)
let espCrearSeleccionadas = [];

// timerBloqueo → referencia al setInterval del countdown de bloqueo de login
// Se guarda aquí para poder cancelarlo si el usuario recarga antes de que termine
let timerBloqueo = null;

// =============================================================================
// INICIALIZACIÓN — se ejecuta cuando el HTML termina de cargarse completamente
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Carga los servicios y paquetes visibles en la página principal (landing)
    cargarServiciosDeBD();

    // Conecta cada formulario del HTML con su función manejadora
    configurarFormularios();
});

// Une cada <form> del HTML con la función que lo procesa.
// Usamos addEventListener('submit') para interceptar el envío y manejarlo con JS.
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
    document.getElementById('form-nuevo-cliente').addEventListener('submit', manejarCrearCliente);
}

// =============================================================================
// UTILIDADES GENERALES
// =============================================================================

// Muestra u oculta la contraseña en un campo tipo password.
// inputId   → id del <input type="password">
// iconSpan  → el <span> que contiene el ícono del ojo (se cambia el SVG)
function togglePasswordVisibility(inputId, iconSpan) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text'; // mostrar texto plano
        iconSpan.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06 5.06m-4.97-4.97A9.12 9.12 0 0 1 12 7a9 9 0 0 1 4.94 2.06"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    } else {
        input.type = 'password'; // volver a ocultar
        iconSpan.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
}

// Verifica si la contraseña cumple las reglas del negocio:
// - Al menos 1 número        → (?=.*\d)
// - Al menos 1 mayúscula     → (?=.*[A-Z])
// - Al menos 1 símbolo       → (?=.*[^a-zA-Z0-9])
// Devuelve true si es válida, false si no cumple.
function validarContrasena(pass) {
    return /(?=.*\d)(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(pass);
}

// Convierte "2025-01-15" (formato ISO de PostgreSQL) en "15 de enero de 2025"
// NO usa new Date() porque ese objeto cambia la fecha dependiendo de la zona horaria,
// lo que causaba el bug "Invalid Date" / fecha un día antes.
function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    const s = String(fechaStr).substring(0, 10); // tomar solo "YYYY-MM-DD"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(fechaStr); // si no es el formato, devolver tal cual
    const [y, m, d] = s.split('-').map(Number);
    const meses = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${d} de ${meses[m - 1]} de ${y}`;
}

// Versión corta de formatearFecha: devuelve "15 ene. 2025"
// Útil para mostrar en espacios pequeños (tarjetas, tablas)
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
// MENÚ HAMBURGUESA (menú desplegable en móvil)
// Muestra opciones según el estado de sesión:
//   - Sin sesión → "Iniciar Sesión" y "Registrarse"
//   - Con sesión → CUs habilitados del usuario (CU2 Cerrar Sesión aparece en el
//                  sub-menú del paquete "Gestión de Seguridad" como cualquier otro CU)
// =============================================================================

// Abre/cierra el menú hamburguesa y reconstruye su contenido al abrirse.
function toggleMobileMenu() {
    const nav = document.getElementById('nav-menu-movil');
    const btn = document.getElementById('hamburger');
    if (!nav) return;
    const abierto = nav.classList.toggle('active');
    if (btn) btn.classList.toggle('active', abierto);
    if (abierto) renderizarMenuHamburguesa();
}

// Construye el menú hamburguesa según si hay usuario logueado o no.
async function renderizarMenuHamburguesa() {
    const nav = document.getElementById('nav-menu-movil');
    if (!nav) return;
    nav.innerHTML = '';

    if (!usuarioActual) {
        // ── Usuario no logueado: mostrar CU1 (Iniciar Sesión) y enlace a registro ──
        nav.innerHTML = `
            <div style="padding:20px;">
                <button onclick="mostrarSeccion('login'); toggleMobileMenu();"
                    style="width:100%;padding:13px;background:#d4a373;color:white;border:none;border-radius:8px;
                           cursor:pointer;font-size:15px;font-weight:700;margin-bottom:10px;">
                    Iniciar Sesión
                </button>
                <button onclick="irARegistro(); toggleMobileMenu();"
                    style="width:100%;padding:13px;background:transparent;color:#d4a373;
                           border:2px solid #d4a373;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700;">
                    Registrarse
                </button>
            </div>`;
        return;
    }

    // ── Usuario logueado: recargar el menú cada vez que se abre el hamburguesa
    //    para reflejar cambios de privilegios hechos por el admin en tiempo real ──
    nav.innerHTML = '<p style="padding:20px;color:#666;">Cargando menú...</p>';
    await cargarMenuUsuario(usuarioActual.ci);

    nav.innerHTML = '';

    // Saludo del usuario
    const saludo = document.createElement('div');
    saludo.style.cssText = 'padding:15px 20px;background:#f9f3ec;border-bottom:2px solid #e8d5c0;font-size:14px;color:#333;';
    saludo.innerHTML = `<strong>${usuarioActual.nombre.split(' ')[0]}</strong> — ${usuarioActual.rol}`;
    nav.appendChild(saludo);

    if (menuUsuario.length) {
        menuUsuario.forEach(paq => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:12px 20px;border-bottom:1px solid #eee;';

            const titulo = document.createElement('div');
            titulo.style.cssText = 'display:flex;justify-content:space-between;font-weight:600;cursor:pointer;color:#333;font-size:14px;';
            titulo.innerHTML = paq.nombre + ' <span style="font-size:11px;color:#aaa;">▼</span>';
            titulo.onclick = e => { e.stopPropagation(); toggleSubmenu(paq.id); };

            const sub = document.createElement('div');
            sub.id = 'submenu-' + paq.id;
            sub.style.cssText = 'display:none;padding:6px 0 4px 16px;';

            if (Array.isArray(paq.cus)) {
                paq.cus.forEach(cu => {
                    const a = document.createElement('a');
                    a.href = '#';
                    a.style.cssText = 'display:block;padding:6px 12px;color:#555;text-decoration:none;font-size:13px;border-radius:4px;';
                    a.textContent = cu.nombre;
                    a.onmouseenter = () => a.style.background = '#f5e6d3';
                    a.onmouseleave = () => a.style.background = '';
                    a.onclick = e => { e.preventDefault(); toggleMobileMenu(); navegarCU(cu.nombre); };
                    sub.appendChild(a);
                });
            }

            div.appendChild(titulo);
            div.appendChild(sub);
            nav.appendChild(div);
        });
    } else {
        // Fallback: sin privilegios configurados → menú básico según rol
        const links = [];
        if (usuarioActual.rol === 'Administrador') {
            links.push({ label: '⚙ Centro de Gestión', fn: () => mostrarCentroGestion('servicios') });
        } else if (usuarioActual.rol === 'Personal') {
            links.push({ label: '📅 Mi Agenda',  fn: () => { mostrarSeccion('panel-personal'); cambiarTabPersonal('agenda'); } });
            links.push({ label: '💰 Comisiones', fn: () => { mostrarSeccion('panel-personal'); cambiarTabPersonal('comisiones'); } });
        } else {
            links.push({ label: '📋 Mis Citas',  fn: () => { mostrarSeccion('panel-cliente'); cambiarTabCliente('citas'); } });
            links.push({ label: '🗓 Nueva Reserva', fn: () => { mostrarSeccion('panel-cliente'); abrirModalReserva(); } });
            links.push({ label: '⭐ Favoritas',  fn: () => { mostrarSeccion('panel-cliente'); cambiarTabCliente('favoritos'); } });
        }
        links.push({ label: '🏠 Inicio',         fn: () => mostrarSeccion('landing') });
        links.push({ label: '🔒 Cerrar Sesión',  fn: cerrarSesion });

        links.forEach(({ label, fn }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = 'display:block;width:calc(100% - 40px);margin:6px 20px;padding:11px 14px;' +
                'background:transparent;border:1px solid #eee;border-radius:8px;cursor:pointer;' +
                'font-size:14px;text-align:left;color:#444;font-family:inherit;';
            btn.onmouseenter = () => btn.style.background = '#f9f3ec';
            btn.onmouseleave = () => btn.style.background = 'transparent';
            btn.onclick = () => { toggleMobileMenu(); fn(); };
            nav.appendChild(btn);
        });
    }

    // CU2 (Cerrar Sesión) ya aparece en el sub-menú del paquete "Gestión de Seguridad"
    // No se duplica el botón aquí cuando menuUsuario tiene datos.
}

// Abre/cierra el submenú de un paquete. Cierra los demás para que solo uno esté abierto.
function toggleSubmenu(id) {
    const s = document.getElementById('submenu-' + id);
    if (!s) return;
    // Cerrar todos los submenús excepto el que se está toggling
    document.querySelectorAll('[id^="submenu-"]').forEach(x => { if (x !== s) x.style.display = 'none'; });
    s.style.display = s.style.display === 'block' ? 'none' : 'block';
}

// =============================================================================
// NAVEGACIÓN ENTRE SECCIONES
// El sistema es una SPA (Single Page Application): solo hay un HTML y se muestra
// u oculta secciones con la clase CSS "seccion-oculta".
// =============================================================================

// Muestra la sección con el id dado y oculta todas las demás.
// id puede ser: 'landing', 'login', 'panel-cliente', 'panel-personal', 'centro-gestion'
function mostrarSeccion(id) {
    window.scrollTo(0, 0); // volver arriba al cambiar de sección
    document.getElementById('main-landing').classList.add('seccion-oculta');
    document.querySelectorAll('.sistema-section').forEach(s => s.classList.add('seccion-oculta'));

    if (id === 'landing') {
        document.getElementById('main-landing').classList.remove('seccion-oculta');
        document.getElementById('navbar').style.display = 'flex';
    } else {
        const sec = document.getElementById(id);
        if (sec) sec.classList.remove('seccion-oculta');
        // El navbar se oculta en la pantalla de login para dar más espacio al formulario
        document.getElementById('navbar').style.display = id === 'login' ? 'none' : 'flex';
    }
}

function irAInicio()   { mostrarSeccion('landing'); }
function irARegistro() { mostrarSeccion('login'); cambiarPestana('registro'); }

// Botón "Reservar Cita" del landing: si está logueado va al panel, si no va al login
function accionReservarCita() {
    if (usuarioActual) {
        mostrarSeccion('panel-cliente');
        abrirModalReserva(); // CU3: abrir directamente el modal de reserva
    } else {
        mostrarSeccion('login');
    }
}

// Devuelve un array de { ci, nombre } con las esteticistas seleccionadas en el modal de reserva.
// Para servicio → viene del <select id="reserva-esteticista">
// Para paquete  → viene de los <input type="checkbox"> en #reserva-esteticistas-checks
function getEsteticistasSeleccionadas() {
    const tipo = document.querySelector('input[name="tipo-reserva"]:checked')?.value;
    if (tipo === 'paquete') {
        // Paquete: pueden seleccionarse múltiples esteticistas con checkboxes
        return Array.from(document.querySelectorAll('#reserva-esteticistas-checks input[type="checkbox"]:checked'))
            .map(cb => ({ ci: cb.value, nombre: cb.dataset.nombre }));
    }
    // Servicio: solo hay un <select> con una esteticista
    const sel = document.getElementById('reserva-esteticista');
    if (!sel || !sel.value) return [];
    return [{ ci: sel.value, nombre: sel.options[sel.selectedIndex]?.text || '' }];
}

// Alterna entre las pestañas "Iniciar Sesión" y "Registrarse" en la pantalla de login
function cambiarPestana(p) {
    const esLogin = p === 'login';
    document.getElementById('login-form').style.display        = esLogin ? 'block' : 'none';
    document.getElementById('registro-form').style.display     = esLogin ? 'none'  : 'block';
    document.getElementById('recuperacion-form').style.display = 'none';
    document.getElementById('btn-tab-login').classList.toggle('active', esLogin);
    document.getElementById('btn-tab-registro').classList.toggle('active', !esLogin);
}

// Redirige al usuario a su panel correspondiente según su rol
function cargarPerfil() {
    if (!usuarioActual) return;
    mostrarToast('Bienvenido, ' + usuarioActual.nombre);
    if (usuarioActual.rol === 'Administrador') {
        mostrarCentroGestion('servicios');
    } else if (usuarioActual.rol === 'Personal') {
        mostrarSeccion('panel-personal');
        cambiarTabPersonal('agenda');
        cargarReservasEsteticista(); // Cargar para mostrar el badge de notificaciones
    } else {
        // Rol 'Cliente'
        mostrarSeccion('panel-cliente');
        cargarReservasCliente();
    }
}

// Maneja los clics en el menú hamburguesa: navega al CU correspondiente según el nombre.
// Cualquier rol con acceso a CUs de gestión va al Centro de Gestión (no al panel admin exclusivo).
function navegarCU(nombreCU) {
    const nav = document.getElementById('nav-menu-movil');
    if (nav) nav.classList.remove('active');

    const n = nombreCU.toLowerCase();

    // CUs de sesión
    if (n.includes('perfil'))      { cargarPerfil(); return; }
    if (n.includes('cerrar ses'))  { cerrarSesion(); return; }
    if (n.includes('iniciar ses')) {
        // CU1: si ya está logueado va a su panel; si no, al login
        if (usuarioActual) cargarPerfil(); else mostrarSeccion('login');
        return;
    }
    if (!usuarioActual) { mostrarToast('Debes iniciar sesión', 'error'); return; }

    // ── CU17: Reporte Financiero → cuarta pestaña ────────────────────────────
    if (n.includes('reporte') && (n.includes('financiero') || n.includes('financi')))
        { mostrarSeccion('centro-gestion'); cambiarGrupoAdmin('ciclo4b'); cambiarTabCiclo4b('reporte'); return; }

    // ── CUs del Ciclo 4: navegan a la tercera pestaña del Centro de Gestión ──
    const irCiclo4 = (subtab) => {
        mostrarSeccion('centro-gestion');
        cambiarGrupoAdmin('ciclo4');
        cambiarTabCiclo4(subtab);
    };
    if (n.includes('factura') || n.includes('recibo'))
        { irCiclo4('facturas'); return; }
    if (n.includes('caja') || n.includes('apertura') || n.includes('cierre'))
        { irCiclo4('caja'); return; }
    if (n.includes('pago') && n.includes('reserva'))
        { mostrarCentroGestion('citas'); return; }

    // ── CUs del Ciclo 3: navegan a la segunda pestaña del Centro de Gestión ──
    const irCiclo3 = (subtab) => {
        mostrarSeccion('centro-gestion');
        cambiarGrupoAdmin('ciclo3');
        cambiarTabCiclo3(subtab);
    };
    if (n.includes('preferencia') || (n.includes('seguimiento') && n.includes('estilo')))
        { irCiclo3('preferencias'); return; }
    if (n.includes('kit') && (n.includes('personal') || n.includes('esteticista')))
        { irCiclo3('kit'); return; }
    if ((n.includes('alerta') && n.includes('stock')) || n.includes('monitorear'))
        { irCiclo3('alertas'); return; }
    if (n.includes('recordatorio'))
        { irCiclo3('recordatorios'); return; }
    if (n.includes('whatsapp'))
        { irCiclo3('whatsapp'); return; }
    if ((n.includes('receta') || n.includes('consumo')) && !n.includes('servicio'))
        { irCiclo3('recetas'); return; }

    // ── CUs del Centro de Gestión: se resuelve el tab y se respetan privilegios ──
    // privilegios solo si es admin (guard adicional en mostrarCentroGestion)
    const tabGestion = n.includes('servicio')     ? 'servicios'
                     : n.includes('categor')      ? 'categorias'
                     : n.includes('paquete')      ? 'paquetes'
                     : n.includes('especialidad') ? 'especialidades'
                     : n.includes('bit')          ? 'bitacora'
                     : n.includes('privilegio')   ? 'privilegios'
                     : (n.includes('empleado') || n.includes('personal')) ? 'empleados'
                     : n.includes('cliente')      ? 'clientes'
                     : n.includes('comisi')       ? 'comisiones'
                     : null;

    if (tabGestion) { mostrarCentroGestion(tabGestion); return; }

    // CU3 "Gestionar Cita/Reserva": admin → tab Reservas del Centro de Gestión; otros → modal
    if (n.includes('cita') || n.includes('reserva')) {
        if (usuarioActual.rol === 'Administrador') { mostrarCentroGestion('citas'); return; }
        mostrarSeccion('panel-cliente'); abrirModalReserva(); return;
    }

    // Administrador sin match específico → Centro de Gestión > Servicios
    if (usuarioActual.rol === 'Administrador') { mostrarCentroGestion('servicios'); return; }

    // ── CUs del Personal ──
    if (n.includes('agenda'))                          { mostrarSeccion('panel-personal'); cambiarTabPersonal('agenda'); return; }
    if (n.includes('comisi') && usuarioActual.rol === 'Personal') { mostrarSeccion('panel-personal'); cambiarTabPersonal('comisiones'); return; }

    // ── CUs del Cliente ──
    if (n.includes('catálogo') || n.includes('catalogo')) { mostrarSeccion('landing'); return; }
    if (n.includes('favorit'))                         { mostrarSeccion('panel-cliente'); cambiarTabCliente('favoritos'); return; }

    // Fallback según rol
    if (usuarioActual.rol === 'Personal') { mostrarSeccion('panel-personal'); cambiarTabPersonal('agenda'); }
    else                                  { mostrarSeccion('panel-cliente'); }
}

// =============================================================================
// NAVBAR — actualiza los botones según si hay usuario logueado o no
// =============================================================================

// Si hay usuario logueado: muestra nombre + rol, oculta botones de "Ingresar/Registrarse".
// Si no hay usuario: muestra los botones públicos.
function actualizarNavbar() {
    if (usuarioActual) {
        document.getElementById('nav-actions-public').style.display = 'none';
        document.getElementById('nav-actions-logged').style.display = 'flex';
        document.getElementById('nav-user-welcome').innerHTML =
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ' +
            usuarioActual.nombre.split(' ')[0] + ' (' + usuarioActual.rol + ')';
        // Mostrar botón Reportes solo a Admin y Personal
        const btnRep = document.getElementById('btn-reportes-nav');
        if (btnRep) {
            btnRep.style.display = (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Personal')
                ? 'inline-flex' : 'none';
        }
        cargarMenuUsuario(usuarioActual.ci); // Cargar el menú personalizado
    } else {
        document.getElementById('nav-actions-public').style.display = 'flex';
        document.getElementById('nav-actions-logged').style.display = 'none';
        const btnRep2 = document.getElementById('btn-reportes-nav');
        if (btnRep2) btnRep2.style.display = 'none';
        const nav = document.getElementById('nav-menu-movil');
        // Cerrar el menú si estaba abierto (el contenido se reconstruye al abrirse)
        if (nav) nav.classList.remove('active');
    }
}

// Pide al servidor el menú de CUs habilitados para el CI del usuario logueado
async function cargarMenuUsuario(ci) {
    try {
        const res  = await fetch(API_BASE + '/api/menus-usuario/' + ci);
        const data = await res.json();
        if (data.success) menuUsuario = data.menu;
    } catch (err) { console.error('Error cargando menú de usuario:', err); }
}

// =============================================================================
// PANEL ADMIN / CENTRO DE GESTIÓN — TABS
// =============================================================================
const TABS_ADMIN = [
    'servicios','empleados','clientes','categorias',
    'paquetes','especialidades','citas','bitacora','privilegios','comisiones'
];

// Tabs del grupo Ciclo 3 (segunda pestaña del Centro de Gestión).
// Cada string aquí corresponde a un id="tab-ciclo3-{nombre}" en el HTML
// y a una vista id="vista-ciclo3-{nombre}" también en el HTML.
const TABS_CICLO3 = ['preferencias','kit','alertas','recordatorios','whatsapp','recetas'];

// Tabs del grupo Ciclo 4 (tercera pestaña del Centro de Gestión).
const TABS_CICLO4 = ['facturas','caja','ordenes'];

// Tabs del grupo Ciclo 4B (cuarta pestaña — CU17 Reporte Financiero).
const TABS_CICLO4B = ['reporte'];

// Mapeo: palabra clave en el nombre del CU → id de la tab del Centro de Gestión.
// 'privilegios' no está: es solo para Administrador y se maneja aparte.
const CU_NOMBRE_A_TAB = [
    { clave: 'servicio',     tab: 'servicios'      },
    { clave: 'categor',      tab: 'categorias'     },
    { clave: 'paquete',      tab: 'paquetes'       },
    { clave: 'cliente',      tab: 'clientes'       },
    { clave: 'empleado',     tab: 'empleados'      },
    { clave: 'personal',     tab: 'empleados'      },
    { clave: 'especialidad', tab: 'especialidades' },
    { clave: 'comisi',       tab: 'comisiones'     },
    { clave: 'bit',          tab: 'bitacora'       },
];

// ─────────────────────────────────────────────────────────────────────────────
// cambiarGrupoAdmin
// Alterna entre el grupo "Gestión" (Ciclos 1 y 2) y el grupo "Ciclo 3".
// Se llama cuando el admin hace clic en los botones [Gestión] o [Ciclo 3]
// que están encima de las pestañas del Centro de Gestión.
//
// grupo → 'gestion' o 'ciclo3'
// ─────────────────────────────────────────────────────────────────────────────
function cambiarGrupoAdmin(grupo) {
    ['gestion', 'ciclo3', 'ciclo4', 'ciclo4b'].forEach(g => {
        document.getElementById('tabs-grupo-' + g)?.classList.toggle('seccion-oculta', g !== grupo);
        document.getElementById('tab-grupo-'  + g)?.classList.toggle('active', g === grupo);
    });

    // Ocultar TODAS las vistas de TODOS los grupos
    TABS_ADMIN.forEach(t   => document.getElementById('vista-admin-'   + t)?.classList.add('seccion-oculta'));
    TABS_CICLO3.forEach(t  => document.getElementById('vista-ciclo3-'  + t)?.classList.add('seccion-oculta'));
    TABS_CICLO4.forEach(t  => document.getElementById('vista-ciclo4-'  + t)?.classList.add('seccion-oculta'));
    TABS_CICLO4B.forEach(t => document.getElementById('vista-ciclo4b-' + t)?.classList.add('seccion-oculta'));

    if (grupo === 'gestion')       cambiarTabAdmin('servicios');
    else if (grupo === 'ciclo3')   cambiarTabCiclo3('preferencias');
    else if (grupo === 'ciclo4')   cambiarTabCiclo4('facturas');
    else if (grupo === 'ciclo4b')  cambiarTabCiclo4b('reporte');
}

// ─────────────────────────────────────────────────────────────────────────────
// cambiarTabCiclo3
// Cambia la pestaña activa DENTRO del grupo Ciclo 3.
// Funciona igual que cambiarTabAdmin pero con los ids "ciclo3-" en vez de "admin-".
//
// tab → nombre del tab, ej: 'preferencias', 'alertas', 'recetas', etc.
// ─────────────────────────────────────────────────────────────────────────────
function cambiarTabCiclo3(tab) {
    // Ocultar todas las vistas del grupo Ciclo 3 y desmarcar todos los tabs
    TABS_CICLO3.forEach(t => {
        document.getElementById('vista-ciclo3-' + t)?.classList.add('seccion-oculta');
        document.getElementById('tab-ciclo3-' + t)?.classList.remove('active');
    });

    // Mostrar la vista del tab seleccionado y marcar su botón como activo
    document.getElementById('vista-ciclo3-' + tab)?.classList.remove('seccion-oculta');
    document.getElementById('tab-ciclo3-' + tab)?.classList.add('active');

    // Cargar datos automáticamente solo para los tabs que tienen datos que mostrar de inmediato.
    // Los otros tres ('preferencias', 'kit', 'recordatorios') necesitan que el admin
    // escriba algo primero (un CI o una fecha), así que no se cargan automáticamente.
    if (tab === 'alertas')  cargarAlertasStock();
    if (tab === 'recetas')  cargarRecetasAdmin();
    if (tab === 'whatsapp') inicializarWhatsApp();
}

// ─────────────────────────────────────────────────────────────────────────────
// cambiarTabCiclo4
// Cambia la pestaña activa DENTRO del grupo Ciclo 4 (CU5 Facturas, CU13 Caja).
// ─────────────────────────────────────────────────────────────────────────────
function cambiarTabCiclo4(tab) {
    TABS_CICLO4.forEach(t => {
        document.getElementById('vista-ciclo4-' + t)?.classList.add('seccion-oculta');
        document.getElementById('tab-ciclo4-'   + t)?.classList.remove('active');
    });
    document.getElementById('vista-ciclo4-' + tab)?.classList.remove('seccion-oculta');
    document.getElementById('tab-ciclo4-'   + tab)?.classList.add('active');

    if (tab === 'facturas') cargarPagosFacturables();
    if (tab === 'caja')     cargarEstadoCaja();
    if (tab === 'ordenes')  cargarOrdenesCompra();
}

// Cambia la pestaña activa del grupo Ciclo 4B (CU17 Reporte Financiero).
function cambiarTabCiclo4b(tab) {
    TABS_CICLO4B.forEach(t => {
        document.getElementById('vista-ciclo4b-' + t)?.classList.add('seccion-oculta');
        document.getElementById('tab-ciclo4b-'   + t)?.classList.remove('active');
    });
    document.getElementById('vista-ciclo4b-' + tab)?.classList.remove('seccion-oculta');
    document.getElementById('tab-ciclo4b-'   + tab)?.classList.add('active');
    if (tab === 'reporte' && typeof rfInicializar === 'function') rfInicializar();
}

// Abre el Centro de Gestión mostrando solo los tabs a los que el usuario tiene acceso.
// Admin ve todo; otros roles solo ven los tabs de sus CUs habilitados.
async function mostrarCentroGestion(tabInicial) {
    mostrarSeccion('centro-gestion');

    if (usuarioActual?.rol === 'Administrador') {
        TABS_ADMIN.forEach(t => {
            const btn = document.getElementById('tab-admin-' + t);
            if (btn) btn.style.display = '';
        });
        // Si el tab inicial es de ciclo4b (CU17), ir al grupo 4
        if (tabInicial && TABS_CICLO4B.includes(tabInicial)) {
            cambiarGrupoAdmin('ciclo4b');
            cambiarTabCiclo4b(tabInicial);
        } else if (tabInicial && TABS_CICLO4.includes(tabInicial)) {
            cambiarGrupoAdmin('ciclo4');
            cambiarTabCiclo4(tabInicial);
        } else if (tabInicial && TABS_CICLO3.includes(tabInicial)) {
            cambiarGrupoAdmin('ciclo3');
            cambiarTabCiclo3(tabInicial);
        } else {
            cambiarGrupoAdmin('gestion');
            if (tabInicial) cambiarTabAdmin(tabInicial);
        }
        return;
    }

    // No-admin: asegurar que el menú esté cargado
    if (!menuUsuario.length) await cargarMenuUsuario(usuarioActual.ci);

    // Construir el conjunto de tabs permitidas a partir del menú del usuario
    const tabsPermitidas = new Set();
    menuUsuario.forEach(paq => {
        (paq.cus || []).forEach(cu => {
            const n = (cu.nombre || '').toLowerCase();
            for (const { clave, tab } of CU_NOMBRE_A_TAB) {
                if (n.includes(clave)) { tabsPermitidas.add(tab); break; }
            }
        });
    });

    // Mostrar solo los tabs autorizados; 'privilegios' siempre oculto para no-admin
    TABS_ADMIN.forEach(t => {
        const btn = document.getElementById('tab-admin-' + t);
        if (!btn) return;
        btn.style.display = (t !== 'privilegios' && t !== 'citas' && tabsPermitidas.has(t)) ? '' : 'none';
    });

    // Navegar al tab solicitado si está permitido, o al primero disponible
    const tabFinal = tabsPermitidas.has(tabInicial) && tabInicial !== 'privilegios'
        ? tabInicial
        : [...tabsPermitidas].find(t => t !== 'privilegios');

    if (tabFinal) cambiarTabAdmin(tabFinal);
    else mostrarToast('No tienes acceso al Centro de Gestión', 'error');
}

// Cambia la pestaña activa del Centro de Gestión y carga sus datos automáticamente
function cambiarTabAdmin(tab) {
    // Capa de seguridad: privilegios y citas son exclusivos para Administrador
    if ((tab === 'privilegios' || tab === 'citas') && usuarioActual?.rol !== 'Administrador') {
        mostrarToast('No tienes permiso para acceder a esta sección', 'error'); return;
    }

    TABS_ADMIN.forEach(t => {
        document.getElementById('vista-admin-' + t)?.classList.add('seccion-oculta');
        document.getElementById('tab-admin-' + t)?.classList.remove('active');
    });
    document.getElementById('vista-admin-' + tab)?.classList.remove('seccion-oculta');
    document.getElementById('tab-admin-' + tab)?.classList.add('active');

    if (tab === 'servicios')      cargarServiciosAdmin();
    if (tab === 'empleados')      cargarEmpleadosAdmin();
    if (tab === 'clientes')       cargarClientesAdmin();
    if (tab === 'categorias')     cargarCategoriasAdmin();
    if (tab === 'paquetes')       cargarPaquetesAdmin();
    if (tab === 'especialidades') cargarEspecialidadesAdmin();
    if (tab === 'citas')          cargarCitasAdmin();
    if (tab === 'bitacora')       cargarBitacoraAdmin();
    if (tab === 'comisiones')     cargarComisionesAdmin();
    // 'privilegios' no tiene carga automática — el admin busca por CI manualmente
}

// =============================================================================
// MODALES DE CONFIGURACIÓN (cambiar contraseña, editar perfil, preferencias)
// =============================================================================

// Abre el modal de configuración y muestra la pestaña de seguridad por defecto
function abrirModalConfig() {
    document.getElementById('modal-configuracion').classList.remove('seccion-oculta');
    cambiarTabModal('seguridad');
}

// Cierra el modal de configuración
function cerrarModalConfig() {
    document.getElementById('modal-configuracion').classList.add('seccion-oculta');
}

// Muestra uno de los tres formularios dentro del modal de configuración:
// 'seguridad' → cambiar contraseña
// 'perfil'    → editar nombre/teléfono
// 'notificaciones' → preferencias de avisos
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
// TOASTS — notificaciones emergentes tipo "snackbar"
// Aparecen abajo a la derecha por 4 segundos y luego desaparecen solos.
// tipo = 'success' (verde, predeterminado) o 'error' (rojo)
// =============================================================================
function mostrarToast(mensaje, tipo = 'success') {
    // Obtener o crear el contenedor único que apila los toasts verticalmente
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast' + (tipo === 'error' ? ' error' : '');
    toast.innerHTML = `
        <div class="toast-icon">${tipo === 'error' ? '✕' : '✓'}</div>
        <div class="toast-text">${mensaje}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('mostrar'), 10);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Compatibilidad con el toast estático del HTML (si existe uno con id fijo)
function cerrarToast() {
    const t = document.getElementById('notificacion-toast');
    if (t) t.classList.remove('mostrar');
}
