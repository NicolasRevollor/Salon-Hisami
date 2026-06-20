// =============================================================================
// frontend/js/ciclo4/CU13-caja.js — GESTIÓN DE APERTURA / CIERRE DE CAJA
//
// Funciones:
//   cargarEstadoCaja()    → consulta si hay caja abierta y actualiza la vista
//   abrirCaja()           → abre el modal para ingresar monto inicial
//   confirmarAbrirCaja()  → envía la solicitud de apertura al backend
//   cerrarCaja()          → muestra modal de confirmación de cierre
//   confirmarCerrarCaja() → envía la solicitud de cierre al backend
//   cargarHistorialCajas()→ carga el historial de cajas cerradas
// =============================================================================

let _cajaActual = null; // datos de la caja abierta actualmente

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO ACTUAL DE CAJA
// ─────────────────────────────────────────────────────────────────────────────

async function cargarEstadoCaja() {
    const contenedor = document.getElementById('caja-estado-contenedor');
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Cargando estado de caja...</p>';

    try {
        const resp = await fetch('/api/ciclo4/caja/actual');
        const data = await resp.json();

        if (!data.success) {
            contenedor.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">Error al cargar caja.</p>`;
            return;
        }

        _cajaActual = data.caja;

        if (!data.caja) {
            // No hay caja abierta
            contenedor.innerHTML = `
                <div style="text-align:center;padding:40px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">🔒</div>
                    <h4 style="color:#555;margin-bottom:8px;">Caja Cerrada</h4>
                    <p style="color:#999;margin-bottom:24px;">No hay ninguna caja abierta en este momento.</p>
                    <button onclick="abrirModalAbrirCaja()"
                        class="btn-registrarse" style="padding:12px 32px;font-size:15px;">
                        Abrir Caja
                    </button>
                </div>`;
        } else {
            // Hay caja abierta
            const fechaApertura = new Date(data.caja.fecha_apertura).toLocaleString('es-BO');
            const totalIngresos = parseFloat(data.totalIngresos).toFixed(2);
            const montoInicial  = parseFloat(data.caja.monto_inicial).toFixed(2);
            const totalEsperado = (parseFloat(data.caja.monto_inicial) + parseFloat(data.totalIngresos)).toFixed(2);

            const filasMovimientos = data.movimientos.length
                ? data.movimientos.map(m => {
                    const hora = new Date(m.fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
                    return `
                        <tr>
                            <td>${hora}</td>
                            <td>${m.nombre_cliente}</td>
                            <td>Reserva #${m.id_cita}</td>
                            <td style="font-weight:600;color:#27ae60;">+$${parseFloat(m.monto).toFixed(2)}</td>
                        </tr>`;
                }).join('')
                : `<tr><td colspan="4" style="text-align:center;color:#999;padding:16px;">Sin movimientos aún.</td></tr>`;

            contenedor.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px;">
                    <div class="dash-card" style="text-align:center;padding:16px;">
                        <p style="font-size:12px;color:#888;margin:0 0 6px;">Apertura</p>
                        <p style="font-size:13px;font-weight:600;color:#555;margin:0;">${fechaApertura}</p>
                    </div>
                    <div class="dash-card" style="text-align:center;padding:16px;">
                        <p style="font-size:12px;color:#888;margin:0 0 6px;">Monto Inicial</p>
                        <p style="font-size:22px;font-weight:700;color:var(--color-primario);margin:0;">$${montoInicial}</p>
                    </div>
                    <div class="dash-card" style="text-align:center;padding:16px;">
                        <p style="font-size:12px;color:#888;margin:0 0 6px;">Ingresos del Día</p>
                        <p style="font-size:22px;font-weight:700;color:#27ae60;margin:0;">+$${totalIngresos}</p>
                    </div>
                    <div class="dash-card" style="text-align:center;padding:16px;">
                        <p style="font-size:12px;color:#888;margin:0 0 6px;">Total Esperado</p>
                        <p style="font-size:22px;font-weight:700;color:#333;margin:0;">$${totalEsperado}</p>
                    </div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h4 style="margin:0;font-size:15px;color:#444;">Movimientos (pagos Stripe)</h4>
                    <div style="display:flex;gap:10px;">
                        <button onclick="cargarEstadoCaja()"
                            class="btn-outline-dark" style="font-size:13px;padding:6px 16px;">
                            Refrescar
                        </button>
                        <button onclick="abrirModalCerrarCaja()"
                            style="padding:8px 20px;background:#dc3545;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">
                            Cerrar Caja
                        </button>
                    </div>
                </div>

                <div class="admin-table-container dash-card" style="margin-bottom:0;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Cliente</th>
                                <th>Referencia</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>${filasMovimientos}</tbody>
                    </table>
                </div>`;
        }

        // Cargar historial debajo
        await cargarHistorialCajas();

    } catch (err) {
        contenedor.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">Error de conexión.</p>`;
        console.error('cargarEstadoCaja:', err);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// MODAL ABRIR CAJA
// ─────────────────────────────────────────────────────────────────────────────

function abrirModalAbrirCaja() {
    let modal = document.getElementById('modal-abrir-caja');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'modal-abrir-caja';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="caja-translucida modal-content" style="max-width:400px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="font-size:20px;color:var(--texto-oscuro);">Abrir Caja</h3>
                <button onclick="cerrarModalAbrirCaja()" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
            </div>
            <p style="font-size:13px;color:#888;margin-bottom:18px;">
                Ingresa el monto inicial (dinero en efectivo con el que se abre la caja).
            </p>
            <div class="input-group">
                <label>Monto Inicial (USD)</label>
                <input type="number" id="caja-monto-inicial" value="0" min="0" step="0.01"
                    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;font-size:16px;">
            </div>
            <div style="display:flex;gap:10px;margin-top:24px;">
                <button onclick="confirmarAbrirCaja()"
                    class="btn-registrarse" style="flex:1;padding:12px;">
                    Confirmar Apertura
                </button>
                <button onclick="cerrarModalAbrirCaja()"
                    class="btn-outline-dark" style="flex:1;padding:12px;">
                    Cancelar
                </button>
            </div>
        </div>`;

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('caja-monto-inicial')?.focus(), 100);
}

function cerrarModalAbrirCaja() {
    const m = document.getElementById('modal-abrir-caja');
    if (m) m.style.display = 'none';
}

async function confirmarAbrirCaja() {
    const monto_inicial = parseFloat(document.getElementById('caja-monto-inicial')?.value) || 0;
    const usuario = window.usuarioActual || {};

    try {
        const resp = await fetch('/api/ciclo4/caja/abrir', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                monto_inicial,
                ci_admin:     usuario.ci,
                nombre_admin: usuario.nombre,
                rol_admin:    usuario.rol
            })
        });
        const data = await resp.json();

        if (data.success) {
            cerrarModalAbrirCaja();
            mostrarToast('Caja abierta correctamente.', 'success');
            cargarEstadoCaja();
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión al abrir la caja.', 'error');
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// MODAL CERRAR CAJA
// ─────────────────────────────────────────────────────────────────────────────

function abrirModalCerrarCaja() {
    if (!_cajaActual) return mostrarToast('No hay caja abierta.', 'error');

    let modal = document.getElementById('modal-cerrar-caja');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'modal-cerrar-caja';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    const montoSugerido = (parseFloat(_cajaActual.monto_inicial) + 0).toFixed(2);

    modal.innerHTML = `
        <div class="caja-translucida modal-content" style="max-width:440px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="font-size:20px;color:var(--texto-oscuro);">Cerrar Caja #${_cajaActual.id_caja}</h3>
                <button onclick="cerrarModalCerrarCaja()" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
            </div>
            <p style="font-size:13px;color:#888;margin-bottom:18px;">
                Cuenta el dinero en la caja e ingresa el monto final real.
                El sistema lo comparará con el total esperado.
            </p>
            <div class="input-group">
                <label>Monto Final Contado (USD)</label>
                <input type="number" id="caja-monto-final" value="${montoSugerido}" min="0" step="0.01"
                    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;font-size:16px;">
            </div>
            <div class="input-group">
                <label>Observaciones (opcional)</label>
                <input type="text" id="caja-observaciones" placeholder="Ej: Todo cuadra, sin diferencias"
                    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
            </div>
            <div style="display:flex;gap:10px;margin-top:24px;">
                <button onclick="confirmarCerrarCaja()"
                    style="flex:1;padding:12px;background:#dc3545;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-family:inherit;font-size:14px;">
                    Confirmar Cierre
                </button>
                <button onclick="cerrarModalCerrarCaja()"
                    class="btn-outline-dark" style="flex:1;padding:12px;">
                    Cancelar
                </button>
            </div>
        </div>`;

    modal.style.display = 'flex';
}

function cerrarModalCerrarCaja() {
    const m = document.getElementById('modal-cerrar-caja');
    if (m) m.style.display = 'none';
}

async function confirmarCerrarCaja() {
    if (!_cajaActual) return;
    const monto_final    = parseFloat(document.getElementById('caja-monto-final')?.value) || 0;
    const observaciones  = document.getElementById('caja-observaciones')?.value.trim() || '';
    const usuario = window.usuarioActual || {};

    try {
        const resp = await fetch('/api/ciclo4/caja/cerrar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_caja: _cajaActual.id_caja,
                monto_final,
                observaciones,
                ci_admin:     usuario.ci,
                nombre_admin: usuario.nombre,
                rol_admin:    usuario.rol
            })
        });
        const data = await resp.json();

        if (data.success) {
            cerrarModalCerrarCaja();
            mostrarToast('Caja cerrada correctamente.', 'success');
            _cajaActual = null;
            cargarEstadoCaja();
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión al cerrar la caja.', 'error');
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE CAJAS
// ─────────────────────────────────────────────────────────────────────────────

async function cargarHistorialCajas() {
    const cont = document.getElementById('caja-historial-contenedor');
    if (!cont) return;

    try {
        const resp = await fetch('/api/ciclo4/caja/historial');
        const data = await resp.json();

        const cerradas = (data.cajas || []).filter(c => c.estado === 'cerrada');
        if (!cerradas.length) {
            cont.innerHTML = '<p style="color:#999;font-size:13px;text-align:center;padding:16px;">Sin historial de cajas cerradas.</p>';
            return;
        }

        cont.innerHTML = `
            <h4 style="font-size:15px;color:#444;margin:0 0 12px;">Historial de Cajas</h4>
            <div class="admin-table-container dash-card" style="margin-bottom:0;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Apertura</th>
                            <th>Cierre</th>
                            <th>Monto Inicial</th>
                            <th>Monto Final</th>
                            <th>Admin</th>
                            <th>Observaciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cerradas.map(c => `
                            <tr>
                                <td>${c.id_caja}</td>
                                <td style="font-size:12px;">${new Date(c.fecha_apertura).toLocaleString('es-BO')}</td>
                                <td style="font-size:12px;">${c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString('es-BO') : '—'}</td>
                                <td>$${parseFloat(c.monto_inicial).toFixed(2)}</td>
                                <td style="font-weight:600;">$${c.monto_final !== null ? parseFloat(c.monto_final).toFixed(2) : '—'}</td>
                                <td>${c.nombre_admin || '—'}</td>
                                <td style="font-size:12px;color:#666;">${c.observaciones || '—'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) {
        cont.innerHTML = '<p style="color:#dc3545;font-size:13px;text-align:center;padding:12px;">Error al cargar historial.</p>';
    }
}
