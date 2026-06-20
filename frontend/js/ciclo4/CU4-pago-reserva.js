// =============================================================================
// frontend/js/ciclo4/CU4-pago-reserva.js — PAGO DE RESERVA CON STRIPE
//
// ¿Qué hace este archivo?
//   Maneja el formulario de pago con tarjeta usando Stripe.js.
//   Flujo:
//     1. abrirModalPago(id_cita)  → llama al backend para crear un PaymentIntent
//     2. Backend devuelve client_secret
//     3. Stripe.js muestra el formulario de tarjeta (CardElement)
//     4. El usuario ingresa su tarjeta y presiona "Pagar"
//     5. Stripe confirma el pago → llamamos al backend para registrarlo en BD
//
// IMPORTANTE: reemplaza STRIPE_PUBLISHABLE_KEY con tu clave pública de Stripe.
//   Las claves de prueba (test) empiezan con pk_test_...
//   Las claves de producción empiezan con pk_live_...
// =============================================================================

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TeKymRA3GUDlNAhM0EETlr7TCaWARifoOkkFTCZSQzjTlEBdiXxA9U81XuvDBSZeqmFZDhVLMFg2k5d93WjG3zw00jFfVZfq9';

// Instancia de Stripe y del elemento de tarjeta (se inicializan al abrir el modal)
let stripeInstance       = null;
let cardElement          = null;
let currentClientSecret  = null;
let currentMontoPago     = 0;
let currentIdCita        = null;


// ── abrirModalPago ────────────────────────────────────────────────────────────
// Punto de entrada: llama al backend para crear el PaymentIntent
// y luego muestra el modal con el formulario de tarjeta.
// id_cita → número de la reserva que se va a pagar
async function abrirModalPago(id_cita) {
    currentIdCita = id_cita;

    try {
        mostrarToast('Preparando formulario de pago...');

        // Paso 1: pedir el PaymentIntent al backend
        const resp = await fetch('/api/ciclo4/crear-pago-intent', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_cita })
        });
        const data = await resp.json();

        if (!data.success) {
            return mostrarToast('Error: ' + data.message, 'error');
        }

        currentClientSecret = data.client_secret;
        currentMontoPago    = data.monto;

        // Paso 2: mostrar el modal con los datos de la reserva
        mostrarModalPago(data);

    } catch (err) {
        mostrarToast('Error de conexión al preparar el pago.', 'error');
        console.error('abrirModalPago:', err);
    }
}


// ── mostrarModalPago ──────────────────────────────────────────────────────────
// Construye y muestra el modal con el resumen de la reserva y el formulario de Stripe.
function mostrarModalPago(data) {
    // Crear el contenedor del modal si no existe
    let modal = document.getElementById('modal-pago-stripe');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'modal-pago-stripe';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="caja-translucida modal-content" style="max-width:460px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="font-size:20px;color:var(--texto-oscuro);">Pagar Reserva #${currentIdCita}</h3>
                <button onclick="cerrarModalPago()" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
            </div>

            <!-- Resumen -->
            <div style="background:#f9f3ec;padding:14px;border-radius:8px;margin-bottom:20px;font-size:14px;">
                <p><strong>Cliente:</strong> ${data.nombre_cliente}</p>
                <p><strong>Servicios:</strong> ${data.servicios || '—'}</p>
                <p style="font-size:18px;font-weight:700;color:var(--color-primario);margin-top:8px;">
                    Total: $${parseFloat(data.monto).toFixed(2)} USD
                </p>
            </div>

            <!-- Formulario de tarjeta Stripe -->
            <div class="input-group">
                <label style="font-size:13px;font-weight:600;color:#555;">Datos de la tarjeta</label>
                <div id="stripe-card-element" style="
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    background: white;
                    margin-top: 6px;
                "></div>
                <div id="stripe-card-errors" style="color:#dc3545;font-size:13px;margin-top:6px;"></div>
            </div>

            <button id="btn-pagar-stripe"
                onclick="procesarPagoStripe()"
                class="btn-registrarse"
                style="width:100%;margin-top:20px;font-size:16px;padding:14px;">
                Pagar $${parseFloat(data.monto).toFixed(2)} USD
            </button>

            <p style="font-size:11px;color:#999;text-align:center;margin-top:12px;">
                Pago seguro procesado por Stripe. No guardamos datos de tu tarjeta.
            </p>
        </div>
    `;

    modal.style.display = 'flex';

    // Paso 3: inicializar Stripe.js y montar el CardElement
    inicializarStripeElement();
}


// ── inicializarStripeElement ──────────────────────────────────────────────────
// Carga Stripe.js dinámicamente si no está cargado y monta el CardElement.
function inicializarStripeElement() {
    if (typeof Stripe === 'undefined') {
        // Cargar Stripe.js desde CDN si no está disponible aún
        const script  = document.createElement('script');
        script.src    = 'https://js.stripe.com/v3/';
        script.onload = montarCardElement;
        document.head.appendChild(script);
    } else {
        montarCardElement();
    }
}

function montarCardElement() {
    stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
    const elements = stripeInstance.elements();

    cardElement = elements.create('card', {
        style: {
            base: {
                fontSize:    '16px',
                color:       '#333',
                fontFamily:  'Arial, sans-serif',
                '::placeholder': { color: '#aaa' }
            },
            invalid: { color: '#dc3545' }
        }
    });

    cardElement.mount('#stripe-card-element');

    // Mostrar errores en tiempo real mientras el usuario escribe
    cardElement.on('change', (event) => {
        const errDiv = document.getElementById('stripe-card-errors');
        if (errDiv) errDiv.textContent = event.error ? event.error.message : '';
    });
}


// ── procesarPagoStripe ────────────────────────────────────────────────────────
// Se llama al presionar "Pagar". Confirma el PaymentIntent con Stripe.js
// usando los datos de la tarjeta ingresados en el CardElement.
async function procesarPagoStripe() {
    if (!stripeInstance || !cardElement) {
        return mostrarToast('El formulario de tarjeta no está listo.', 'error');
    }

    const btn = document.getElementById('btn-pagar-stripe');
    btn.disabled     = true;
    btn.textContent  = 'Procesando...';

    try {
        // Confirmar el pago con Stripe.js usando el client_secret guardado al abrir el modal
        const { error, paymentIntent } = await stripeInstance.confirmCardPayment(
            currentClientSecret,
            { payment_method: { card: cardElement } }
        );

        if (error) {
            // Error al procesar la tarjeta (fondos insuficientes, tarjeta inválida, etc.)
            const errDiv = document.getElementById('stripe-card-errors');
            if (errDiv) errDiv.textContent = error.message;
            btn.disabled    = false;
            btn.textContent = `Pagar $${parseFloat(currentMontoPago).toFixed(2)} USD`;
            return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
            await registrarPagoEnBackend(paymentIntent.id);
        }

    } catch (err) {
        mostrarToast('Error inesperado al procesar el pago.', 'error');
        console.error('procesarPagoStripe:', err);
        btn.disabled    = false;
        btn.textContent = `Pagar $${parseFloat(currentMontoPago).toFixed(2)} USD`;
    }
}


// ── registrarPagoEnBackend ────────────────────────────────────────────────────
// Después de que Stripe confirma el pago, notifica al backend para registrarlo en BD.
async function registrarPagoEnBackend(paymentIntentId) {
    const usuario = window.usuarioActual || {};

    try {
        const resp = await fetch('/api/ciclo4/confirmar-pago', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_cita:          currentIdCita,
                payment_intent_id: paymentIntentId,
                ci_admin:         usuario.ci,
                nombre_admin:     usuario.nombre,
                rol_admin:        usuario.rol
            })
        });
        const data = await resp.json();

        if (data.success) {
            cerrarModalPago();
            mostrarToast('Pago realizado correctamente.', 'success');
            // Recargar la lista de reservas o pagos si existe esa función
            if (typeof cargarCitasAdmin === 'function')   cargarCitasAdmin();
            if (typeof cargarMisReservas === 'function')  cargarMisReservas();
        } else {
            mostrarToast('Error al registrar el pago: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión al registrar el pago.', 'error');
        console.error('registrarPagoEnBackend:', err);
    }
}


// ── cerrarModalPago ───────────────────────────────────────────────────────────
function cerrarModalPago() {
    const modal = document.getElementById('modal-pago-stripe');
    if (modal) modal.style.display = 'none';
    cardElement         = null;
    currentClientSecret = null;
    currentIdCita       = null;
}
