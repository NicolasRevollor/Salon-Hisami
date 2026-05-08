// =============================================================================
// panel-personal.js — PANEL DEL PERSONAL: AGENDA, RESERVAS Y COMISIONES
// Maneja las pestañas del panel de la esteticista logueada.
// Depende de: main.js (API_BASE, usuarioActual, mostrarToast, formatearFecha,
//             formatearFechaCorta), panel-cliente.js (toggleReservaDetalle)
// =============================================================================

const TABS_PERSONAL = ['agenda', 'reservas', 'comisiones'];

function cambiarTabPersonal(tab) {
    TABS_PERSONAL.forEach(t => {
        document.getElementById('vista-pers-' + t)?.classList.add('seccion-oculta');
        document.getElementById('tab-pers-' + t)?.classList.remove('active');
    });
    document.getElementById('vista-pers-' + tab)?.classList.remove('seccion-oculta');
    document.getElementById('tab-pers-' + tab)?.classList.add('active');

    if (tab === 'reservas') cargarReservasEsteticista();
}

// =============================================================================
// RESERVAS DE LA ESTETICISTA — acordeón con detalle completo
// =============================================================================
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
                const fecha   = formatearFecha(r.fecha);
                const hora    = r.hora ? String(r.hora).substring(0, 5) : '—';
                const esCfm   = r.estado === 'Confirmada';
                const esFin   = r.estado === 'Finalizada';
                const activa  = r.estado === 'Pendiente' || r.estado === 'Confirmada';

                const badgeClass = esFin ? 'confirmada' : esCfm ? 'confirmada' : 'pendiente';

                const div = document.createElement('div');
                div.className = 'reserva-acordeon';
                div.innerHTML = `
                    <button type="button" class="reserva-acordeon-btn" onclick="toggleReservaDetalle(this)">
                        <div class="reserva-acordeon-info">
                            <span class="reserva-acordeon-titulo">${r.nombre_item || 'Sin especificar'}</span>
                            <span class="reserva-acordeon-fecha">${fecha} — ${hora}</span>
                        </div>
                        <span class="badge ${badgeClass}">${r.estado}</span>
                        <span class="acordeon-arrow">▼</span>
                    </button>
                    <div class="reserva-acordeon-detalle">
                        <p><strong>Servicio/Paquete:</strong> ${r.nombre_item || '—'}</p>
                        <p><strong>Cliente:</strong> ${r.nombre_cliente || '—'}</p>
                        <p><strong>Fecha:</strong> ${fecha}</p>
                        <p><strong>Hora:</strong> ${hora}</p>
                        <p><strong>Método de pago:</strong> ${r.metodo_pago || '—'}</p>
                        <p><strong>Monto:</strong> Bs ${r.monto ? parseFloat(r.monto).toFixed(2) : '—'}</p>
                        <p><strong>Estado:</strong> <span class="badge ${badgeClass}">${r.estado}</span></p>
                        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
                            ${activa
                                ? `<button class="btn-reservar" style="background:#27ae60;"
                                    onclick="marcarCompletada(${r.id_cita})">✓ Marcar Completada</button>`
                                : ''}
                        </div>
                    </div>`;
                cont.appendChild(div);
            });
        } else {
            if (badge) badge.style.display = 'none';
            cont.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">No tienes reservas asignadas actualmente.</p>';
        }
    } catch {
        cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Error al cargar reservas.</p>';
    }
}

// =============================================================================
// MARCAR RESERVA COMO COMPLETADA (solo personal)
// =============================================================================
async function marcarCompletada(id_cita) {
    if (!confirm('¿Marcar esta reserva como completada?')) return;
    try {
        const res  = await fetch(`${API_BASE}/api/reservas/${id_cita}/completar`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                ci_usuario:     usuarioActual.ci,
                nombre_usuario: usuarioActual.nombre,
                rol:            usuarioActual.rol
            })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Reserva marcada como completada');
            cargarReservasEsteticista();
        } else {
            mostrarToast(data.message || 'Error al completar', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// COMISIONES DE LA ESTETICISTA
// =============================================================================
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
                div.innerHTML = `
                    <span>${c.fecha}</span>
                    <span>Bs ${parseFloat(c.monto_comision).toFixed(2)}</span>
                    <span class="badge ${c.estado_pago === 'Pagado' ? 'confirmada' : 'pendiente'}">${c.estado_pago}</span>`;
                cont.appendChild(div);
            });
        } else {
            cont.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">Sin registros de comisiones aún.</p>';
        }
    } catch {
        cont.innerHTML = '<p style="color:red;text-align:center;">Error al cargar las comisiones.</p>';
    }
}
