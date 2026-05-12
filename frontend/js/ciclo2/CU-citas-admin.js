// =============================================================================
// CU-citas-admin.js — GESTIÓN DE RESERVAS (panel administrador)
// Muestra todas las reservas del sistema con detalle de cliente, esteticista,
// servicios, estado y pago. Solo accesible para el rol Administrador.
// BD: reservas + clientes + personal + usuarios + detalle_reserva + servicios + pagos
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

let _todasReservas      = [];
let _reservaSeleccionada = null; // id_cita de la fila actualmente seleccionada
let _filtroActivo        = false;

// Convierte "2025-12-15" o "2025-12-15T..." → "15/12/2025"
function _formatFechaRes(raw) {
    if (!raw) return '—';
    const s = String(raw).substring(0, 10);
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}

// Convierte "09:00:00" → "09:00"
function _formatHoraRes(raw) {
    if (!raw) return '—';
    return String(raw).substring(0, 5);
}

// Carga todas las reservas y las muestra
async function cargarCitasAdmin() {
    _deseleccionarFila();
    try {
        const res  = await fetch(API_BASE + '/api/admin/citas');
        const data = await res.json();
        if (!data.success) { mostrarToast('Error al cargar reservas', 'error'); return; }
        _todasReservas = data.citas;
        _renderReservas(_todasReservas);
    } catch (err) {
        mostrarToast('Error de conexión al cargar reservas', 'error');
    }
}

// Renderiza las filas en la tabla
function _renderReservas(citas) {
    _deseleccionarFila();
    const tbody = document.getElementById('tabla-admin-citas-body');
    if (!citas.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:20px;">No hay reservas que coincidan con el filtro.</td></tr>';
        return;
    }

    const ESTADO_CLASE = {
        'Pendiente':  'badge-pendiente',
        'Confirmada': 'badge-confirmada',
        'Completada': 'badge-completada',
        'Cancelada':  'badge-cancelada',
    };

    tbody.innerHTML = citas.map(c => {
        const claseEstado = ESTADO_CLASE[c.estado] || 'badge-pendiente';
        const monto = c.monto ? `Bs ${parseFloat(c.monto).toFixed(2)}` : '—';
        const pago  = c.metodo_pago ? `${c.metodo_pago} · ${monto}` : monto;
        return `
            <tr data-id="${c.id_cita}" onclick="_seleccionarFila(${c.id_cita}, this)">
                <td>${c.id_cita}</td>
                <td>${_formatFechaRes(c.fecha)}</td>
                <td>${_formatHoraRes(c.hora)}</td>
                <td>${c.nombre_cliente || '—'}</td>
                <td>${c.nombre_esteticista || '—'}</td>
                <td>${c.servicios || '—'}</td>
                <td><span class="badge ${claseEstado}">${c.estado}</span></td>
                <td>${pago}</td>
            </tr>
        `;
    }).join('');
}

// Selecciona una fila (o la deselecciona si ya estaba seleccionada)
function _seleccionarFila(idCita, tr) {
    const yaSeleccionada = _reservaSeleccionada === idCita;

    // Quitar selección de todas las filas
    document.querySelectorAll('#tabla-admin-citas-body tr').forEach(r => r.classList.remove('fila-seleccionada'));

    if (yaSeleccionada) {
        _reservaSeleccionada = null;
    } else {
        tr.classList.add('fila-seleccionada');
        _reservaSeleccionada = idCita;
    }

    const btnCancelar = document.getElementById('btn-cancelar-reserva-admin');
    if (btnCancelar) btnCancelar.style.display = _reservaSeleccionada ? '' : 'none';
}

function _deseleccionarFila() {
    _reservaSeleccionada = null;
    const btnCancelar = document.getElementById('btn-cancelar-reserva-admin');
    if (btnCancelar) btnCancelar.style.display = 'none';
}

// Cancela la reserva seleccionada
async function cancelarReservaAdmin() {
    if (!_reservaSeleccionada) return;
    if (!confirm(`¿Cancelar la reserva #${_reservaSeleccionada}? Esta acción no se puede deshacer.`)) return;

    try {
        const res  = await fetch(API_BASE + '/api/reservas/' + _reservaSeleccionada, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Reserva cancelada correctamente');
            cargarCitasAdmin();
        } else {
            mostrarToast(data.message || 'Error al cancelar la reserva', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión al cancelar', 'error');
    }
}

// ── Modal de filtro ───────────────────────────────────────────────────────────

function abrirFiltroReservas() {
    document.getElementById('modal-filtro-reservas').classList.remove('seccion-oculta');
}

function cerrarFiltroReservas() {
    document.getElementById('modal-filtro-reservas').classList.add('seccion-oculta');
}

function aplicarFiltroReservas() {
    const fechaDesde  = document.getElementById('filtro-fecha-desde').value;
    const fechaHasta  = document.getElementById('filtro-fecha-hasta').value;
    const hora        = document.getElementById('filtro-hora').value;
    const estado      = document.getElementById('filtro-estado').value;
    const servicio    = document.getElementById('filtro-servicio').value.trim().toLowerCase();
    const esteticista = document.getElementById('filtro-esteticista').value.trim().toLowerCase();
    const cliente     = document.getElementById('filtro-cliente').value.trim().toLowerCase();

    const hayFiltro = fechaDesde || fechaHasta || hora || estado || servicio || esteticista || cliente;

    const resultado = _todasReservas.filter(c => {
        const fechaStr = String(c.fecha).substring(0, 10);
        if (fechaDesde  && fechaStr < fechaDesde) return false;
        if (fechaHasta  && fechaStr > fechaHasta) return false;
        if (hora        && !String(c.hora).startsWith(hora)) return false;
        if (estado      && c.estado !== estado) return false;
        if (servicio    && !(c.servicios          || '').toLowerCase().includes(servicio))    return false;
        if (esteticista && !(c.nombre_esteticista || '').toLowerCase().includes(esteticista)) return false;
        if (cliente     && !(c.nombre_cliente     || '').toLowerCase().includes(cliente))     return false;
        return true;
    });

    _filtroActivo = !!hayFiltro;
    const btnLimpiar = document.getElementById('btn-limpiar-filtro-reservas');
    if (btnLimpiar) btnLimpiar.style.display = _filtroActivo ? '' : 'none';

    _renderReservas(resultado);
    cerrarFiltroReservas();
}

function limpiarFiltroReservas() {
    ['filtro-fecha-desde','filtro-fecha-hasta','filtro-hora',
     'filtro-estado','filtro-servicio','filtro-esteticista','filtro-cliente']
        .forEach(id => { document.getElementById(id).value = ''; });

    _filtroActivo = false;
    const btnLimpiar = document.getElementById('btn-limpiar-filtro-reservas');
    if (btnLimpiar) btnLimpiar.style.display = 'none';

    _renderReservas(_todasReservas);
}
