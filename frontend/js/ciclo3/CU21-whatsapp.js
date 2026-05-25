// =============================================================================
// CU21-whatsapp.js — Integrar WhatsApp Empresarial
// Ciclo 3
//
// ¿Qué hace este archivo?
//   Permite al administrador preparar y enviar mensajes de WhatsApp a clientes.
//   NO envía el mensaje automáticamente — genera un enlace wa.me que abre
//   WhatsApp (web o app) con el número y mensaje ya listos para confirmar y enviar.
//
// ¿Cómo funciona?
//   1. Al entrar a la pestaña "WhatsApp", se llama inicializarWhatsApp()
//      → carga los botones de plantillas
//      → carga la lista de clientes con teléfono
//      → pre-rellena el número con el del admin (77689983) para pruebas
//   2. El admin elige un cliente del select (se rellena el número automáticamente)
//      O escribe manualmente un número
//   3. Puede usar una plantilla de mensaje predefinida o escribir uno propio
//   4. Al presionar "Abrir en WhatsApp" → abrirWhatsApp():
//      → manda número y mensaje al backend
//      → el backend genera el enlace wa.me
//      → se abre en una nueva pestaña del navegador
//
// ¿Qué es wa.me?
//   Es el servicio oficial de WhatsApp para abrir conversaciones por enlace.
//   Formato: https://wa.me/591NUMERO?text=MENSAJE
//   591 es el código de país de Bolivia.
//
// Número de prueba del admin: 77689983
//
// Depende de:
//   main.js → API_BASE, usuarioActual, mostrarToast
// =============================================================================

// Número de WhatsApp del administrador para pruebas (pre-rellenado al iniciar)
const WA_NUMERO_ADMIN = '77689983';

// Plantillas de mensajes predefinidos para usar con un clic
// id    → identificador interno de la plantilla
// label → texto que aparece en el botón
// texto → el mensaje completo
const WA_PLANTILLAS = [
    {
        id:    'recordatorio',
        label: 'Recordatorio de cita',
        texto: '¡Hola! Te recordamos que tienes una cita en Salón HISAMI mañana. ¡Te esperamos puntual!'
    },
    {
        id:    'promocion',
        label: 'Promoción especial',
        texto: '¡Hola! En Salón HISAMI tenemos una promoción especial esta semana. Escríbenos para más información.'
    },
    {
        id:    'bienvenida',
        label: 'Bienvenida a nuevo cliente',
        texto: '¡Bienvenido/a a Salón HISAMI! Estamos felices de tenerte como cliente. ¿En qué podemos ayudarte?'
    },
    {
        id:    'confirmacion',
        label: 'Confirmación de reserva',
        texto: '¡Hola! Tu cita en Salón HISAMI ha sido confirmada. Si necesitas reprogramar, contáctanos.'
    }
];


// ─────────────────────────────────────────────────────────────────────────────
// inicializarWhatsApp
// Se llama al entrar a la pestaña WhatsApp.
// Dibuja los botones de plantillas y carga la lista de clientes con teléfono.
// ─────────────────────────────────────────────────────────────────────────────
async function inicializarWhatsApp() {
    // Dibujar un botón por cada plantilla en el contenedor de plantillas
    const contenedorPlant = document.getElementById('wa-plantillas');
    if (contenedorPlant) {
        contenedorPlant.innerHTML = WA_PLANTILLAS.map(p => `
            <!-- Cada botón llama a usarPlantillaWA con el id de la plantilla -->
            <button type="button"
                onclick="usarPlantillaWA('${p.id}')"
                style="padding:6px 14px;margin:4px;border:1px solid #ccc;border-radius:20px;
                       background:white;cursor:pointer;font-size:13px;font-family:inherit;">
                ${p.label}
            </button>`).join('');
    }

    // Cargar la lista de clientes con teléfono en el select
    await cargarClientesWhatsApp();

    // Pre-rellenar el campo de número con el del admin para facilitar las pruebas
    const inputNum = document.getElementById('wa-numero');
    if (inputNum && !inputNum.value) inputNum.value = WA_NUMERO_ADMIN;
}


// ─────────────────────────────────────────────────────────────────────────────
// cargarClientesWhatsApp
// Pide al backend la lista de clientes con teléfono y los carga en el select.
// ─────────────────────────────────────────────────────────────────────────────
async function cargarClientesWhatsApp() {
    const select = document.getElementById('wa-cliente-select');
    if (!select) return;
    try {
        // GET al backend para traer los clientes con teléfono registrado
        const res  = await fetch(`${API_BASE}/api/ciclo3/clientes-telefono`);
        const data = await res.json();
        if (!data.success) return;

        // Limpiar el select y agregar la opción por defecto
        select.innerHTML = '<option value="">-- Seleccionar cliente --</option>';

        // Agregar un <option> por cada cliente
        data.clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value          = c.telefono;          // el valor es el número de teléfono
            opt.dataset.nombre = c.nombre;             // guardamos el nombre en data para usarlo después
            opt.textContent    = `${c.nombre} — ${c.telefono}`;
            select.appendChild(opt);
        });
    } catch { /* silencioso — si falla, el select queda vacío pero no rompe nada */ }
}


// ─────────────────────────────────────────────────────────────────────────────
// seleccionarClienteWA
// Cuando el admin elige un cliente del select, rellena automáticamente
// el campo de número con el teléfono de ese cliente.
// Se llama con onchange en el select del HTML.
// ─────────────────────────────────────────────────────────────────────────────
function seleccionarClienteWA() {
    const select = document.getElementById('wa-cliente-select');
    const tel    = select?.value; // el value del select es el teléfono del cliente
    if (!tel) return;

    // Copiar el teléfono del cliente al input de número
    const inputNum = document.getElementById('wa-numero');
    if (inputNum) inputNum.value = tel;
}


// ─────────────────────────────────────────────────────────────────────────────
// usarPlantillaWA
// Copia el texto de la plantilla seleccionada al textarea del mensaje.
// id → el identificador de la plantilla (ej: 'recordatorio', 'promocion')
// ─────────────────────────────────────────────────────────────────────────────
function usarPlantillaWA(id) {
    // Buscar la plantilla con ese id en el array WA_PLANTILLAS
    const plantilla = WA_PLANTILLAS.find(p => p.id === id);
    if (!plantilla) return;

    // Copiar el texto al textarea
    const textarea = document.getElementById('wa-mensaje');
    if (textarea) textarea.value = plantilla.texto;
}


// ─────────────────────────────────────────────────────────────────────────────
// abrirWhatsApp
// Manda el número y el mensaje al backend para generar el enlace wa.me,
// luego abre ese enlace en una nueva pestaña del navegador.
// ─────────────────────────────────────────────────────────────────────────────
async function abrirWhatsApp() {
    // Leer el número y el mensaje del formulario
    const numero  = document.getElementById('wa-numero')?.value.trim();
    const mensaje = document.getElementById('wa-mensaje')?.value.trim();

    // Validar que no estén vacíos
    if (!numero)  { mostrarToast('Ingresa un número de teléfono', 'error'); return; }
    if (!mensaje) { mostrarToast('Escribe un mensaje', 'error'); return; }

    try {
        // POST al backend con número y mensaje
        // El backend limpia el número, arma el enlace y lo devuelve
        const res  = await fetch(`${API_BASE}/api/ciclo3/whatsapp`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                numero,
                mensaje,
                ci_admin:     usuarioActual?.ci,
                nombre_admin: usuarioActual?.nombre,
                rol_admin:    usuarioActual?.rol
            })
        });
        const data = await res.json();

        if (data.success) {
            // Abrir el enlace wa.me en una nueva pestaña
            // Esto abre WhatsApp Web o la app con el número y mensaje listos
            window.open(data.url, '_blank');
            mostrarToast('Abriendo WhatsApp...', 'success');

            // Mostrar el enlace generado debajo del formulario (para referencia)
            const linkContenedor = document.getElementById('wa-link-resultado');
            if (linkContenedor) {
                linkContenedor.innerHTML = `
                    <p style="font-size:13px;color:#555;margin-top:10px;">
                        Enlace generado:
                        <a href="${data.url}" target="_blank" style="color:var(--color-primario);word-break:break-all;">
                            ${data.url}
                        </a>
                    </p>`;
            }
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch {
        mostrarToast('Error de conexión.', 'error');
    }
}
