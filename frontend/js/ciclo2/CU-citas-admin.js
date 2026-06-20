// =============================================================================
// CU-citas-admin.js — GESTIÓN DE RESERVAS (panel administrador)
// Muestra todas las reservas del sistema con detalle de cliente, esteticista,
// servicios, estado y pago. Solo accesible para el rol Administrador.
//
// Funciones principales (búsqueda rápida):
//   cargarCitasAdmin()         → cargar/refrescar la tabla de reservas
//   cancelarReservaAdmin()     → cancelar la reserva seleccionada
//   aplicarFiltroReservas()    → filtrar por fecha, hora, estado, servicio, etc.
//   limpiarFiltroReservas()    → quitar todos los filtros y volver a mostrar todo
//   abrirFiltroReservas()      → abrir el modal de filtros
//
// BD: reservas + clientes + personal + usuarios + detalle_reserva + servicios + pagos
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

// _todasReservas       → copia completa de las reservas traídas del servidor
//                        (se usa para filtrar sin ir al servidor cada vez)
// _reservaSeleccionada → id_cita de la fila que el admin tiene seleccionada actualmente
// _filtroActivo        → true si hay algún filtro aplicado (controla el botón "Limpiar")
let _todasReservas      = [];
let _reservaSeleccionada = null;
let _filtroActivo        = false;

// Convierte "2025-12-15" o "2025-12-15T00:00:00Z" → "15/12/2025"
// Usa substring en vez de new Date() para evitar desfases de zona horaria
function _formatFechaRes(raw) {
    if (!raw) return '—';
    const s = String(raw).substring(0, 10);  // tomar solo "YYYY-MM-DD"
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}

// Convierte "09:00:00" (formato PostgreSQL con segundos) → "09:00"
function _formatHoraRes(raw) {
    if (!raw) return '—';
    return String(raw).substring(0, 5); // tomar solo "HH:MM"
}

// =============================================================================
// CARGAR RESERVAS — trae todas las reservas desde el servidor y las muestra
// Llama a _renderReservas() para pintar las filas en la tabla HTML
// =============================================================================
async function cargarCitasAdmin() {
    _deseleccionarFila(); // resetear selección antes de recargar
    try {
        const res  = await fetch(API_BASE + '/api/admin/citas');
        const data = await res.json();
        if (!data.success) { mostrarToast('Error al cargar reservas', 'error'); return; }
        _todasReservas = data.citas; // guardar copia completa para filtrar sin ir al servidor
        _renderReservas(_todasReservas);
    } catch (err) {
        mostrarToast('Error de conexión al cargar reservas', 'error');
    }
}

// =============================================================================
// RENDERIZAR TABLA — pinta las filas de reservas en la tabla HTML
// Cada fila tiene un onclick que llama a _seleccionarFila para resaltarla
// El badge de estado usa colores distintos: verde=Completada, rojo=Cancelada, etc.
// =============================================================================
function _renderReservas(citas) {
    _deseleccionarFila();
    const tbody = document.getElementById('tabla-admin-citas-body');
    if (!citas.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:20px;">No hay reservas que coincidan con el filtro.</td></tr>';
        return;
    }

    // Mapa de estado → clase CSS para el badge de color
    const ESTADO_CLASE = {
        'Pendiente':  'badge-pendiente',
        'Confirmada': 'badge-confirmada',
        'Completada': 'badge-completada',
        'Cancelada':  'badge-cancelada',
    };

    tbody.innerHTML = citas.map(c => {
        const claseEstado = ESTADO_CLASE[c.estado] || 'badge-pendiente';
        const monto = c.monto ? `Bs ${parseFloat(c.monto).toFixed(2)}` : '—';
        const yaPagado = c.metodo_pago === 'stripe';
        const celdaPago = yaPagado
            ? `<span style="color:#27ae60;font-weight:600;">✔ Pagado</span><br><small style="color:#888;">${monto}</small>`
            : (c.estado !== 'Cancelada'
                ? `<button onclick="event.stopPropagation(); abrirModalPago(${c.id_cita})"
                       style="padding:5px 12px;background:#635bff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                       Pagar con Stripe
                   </button>`
                : monto);
        return `
            <tr data-id="${c.id_cita}" onclick="_seleccionarFila(${c.id_cita}, this)">
                <td>${c.id_cita}</td>
                <td>${_formatFechaRes(c.fecha)}</td>
                <td>${_formatHoraRes(c.hora)}</td>
                <td>${c.nombre_cliente || '—'}</td>
                <td>${c.nombre_esteticista || '—'}</td>
                <td>${c.servicios || '—'}</td>
                <td><span class="badge ${claseEstado}">${c.estado}</span></td>
                <td>${celdaPago}</td>
            </tr>
        `;
    }).join('');
}

// =============================================================================
// SELECCIONAR FILA — al hacer clic en una fila la resalta en azul
// Si se hace clic de nuevo en la misma fila, la deselecciona
// Cuando hay una fila seleccionada → aparece el botón "Cancelar Reserva"
// =============================================================================
function _seleccionarFila(idCita, tr) {
    const yaSeleccionada = _reservaSeleccionada === idCita;

    // Quitar clase de resaltado de todas las filas antes de marcar la nueva
    document.querySelectorAll('#tabla-admin-citas-body tr').forEach(r => r.classList.remove('fila-seleccionada'));

    if (yaSeleccionada) {
        _reservaSeleccionada = null; // clic en la misma fila = deseleccionar
    } else {
        tr.classList.add('fila-seleccionada');
        _reservaSeleccionada = idCita;
    }

    // Mostrar u ocultar el botón de cancelar según si hay selección
    const btnCancelar = document.getElementById('btn-cancelar-reserva-admin');
    if (btnCancelar) btnCancelar.style.display = _reservaSeleccionada ? '' : 'none';
}

// Quita la selección actual y oculta el botón de cancelar
function _deseleccionarFila() {
    _reservaSeleccionada = null;
    const btnCancelar = document.getElementById('btn-cancelar-reserva-admin');
    if (btnCancelar) btnCancelar.style.display = 'none';
}

// =============================================================================
// CANCELAR RESERVA — elimina la reserva seleccionada tras pedir confirmación
// Llama al mismo endpoint DELETE que usa el cliente (envía correos automáticos)
// =============================================================================
async function cancelarReservaAdmin() {
    if (!_reservaSeleccionada) return;
    if (!confirm(`¿Cancelar la reserva #${_reservaSeleccionada}? Esta acción no se puede deshacer.`)) return;

    try {
        const res  = await fetch(API_BASE + '/api/reservas/' + _reservaSeleccionada, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Reserva cancelada correctamente');
            cargarCitasAdmin(); // refrescar la tabla
        } else {
            mostrarToast(data.message || 'Error al cancelar la reserva', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión al cancelar', 'error');
    }
}

// =============================================================================
// MODAL DE FILTRO — abrir y cerrar el panel de filtros
// El filtro se aplica sobre _todasReservas (en memoria, sin ir al servidor)
// =============================================================================

// Abre el modal donde el admin puede escribir los criterios de filtro
function abrirFiltroReservas() {
    document.getElementById('modal-filtro-reservas').classList.remove('seccion-oculta');
}

// Cierra el modal de filtros sin aplicar cambios
function cerrarFiltroReservas() {
    document.getElementById('modal-filtro-reservas').classList.add('seccion-oculta');
}

// =============================================================================
// APLICAR FILTRO — filtra la lista en memoria según los campos del modal
// Lee los valores de los inputs del modal, filtra _todasReservas y re-renderiza.
// Si se aplicó algún filtro → muestra el botón "Limpiar filtro" en la cabecera.
// =============================================================================
function aplicarFiltroReservas() {
    // Leer todos los criterios del modal de filtro
    const fechaDesde  = document.getElementById('filtro-fecha-desde').value;   // "YYYY-MM-DD"
    const fechaHasta  = document.getElementById('filtro-fecha-hasta').value;   // "YYYY-MM-DD"
    const hora        = document.getElementById('filtro-hora').value;           // "HH:MM"
    const estado      = document.getElementById('filtro-estado').value;         // "Pendiente" | "Confirmada" | etc.
    const servicio    = document.getElementById('filtro-servicio').value.trim().toLowerCase();
    const esteticista = document.getElementById('filtro-esteticista').value.trim().toLowerCase();
    const cliente     = document.getElementById('filtro-cliente').value.trim().toLowerCase();

    // ¿Hay al menos un campo con valor? → el filtro está activo
    const hayFiltro = fechaDesde || fechaHasta || hora || estado || servicio || esteticista || cliente;

    // Filtrar la copia local (no va al servidor)
    const resultado = _todasReservas.filter(c => {
        const fechaStr = String(c.fecha).substring(0, 10); // normalizar a "YYYY-MM-DD"
        if (fechaDesde  && fechaStr < fechaDesde) return false;          // antes del rango
        if (fechaHasta  && fechaStr > fechaHasta) return false;          // después del rango
        if (hora        && !String(c.hora).startsWith(hora)) return false; // hora no coincide
        if (estado      && c.estado !== estado) return false;            // estado distinto
        if (servicio    && !(c.servicios          || '').toLowerCase().includes(servicio))    return false;
        if (esteticista && !(c.nombre_esteticista || '').toLowerCase().includes(esteticista)) return false;
        if (cliente     && !(c.nombre_cliente     || '').toLowerCase().includes(cliente))     return false;
        return true; // pasa todos los filtros
    });

    _filtroActivo = !!hayFiltro;
    // Mostrar "Limpiar filtro" solo cuando hay algún filtro activo
    const btnLimpiar = document.getElementById('btn-limpiar-filtro-reservas');
    if (btnLimpiar) btnLimpiar.style.display = _filtroActivo ? '' : 'none';

    _renderReservas(resultado); // pintar solo las reservas que pasan el filtro
    cerrarFiltroReservas();     // cerrar el modal automáticamente al aplicar
}

// =============================================================================
// LIMPIAR FILTRO — vacía todos los campos del modal y muestra todas las reservas
// =============================================================================
function limpiarFiltroReservas() {
    // Vaciar todos los inputs del modal de filtro
    ['filtro-fecha-desde','filtro-fecha-hasta','filtro-hora',
     'filtro-estado','filtro-servicio','filtro-esteticista','filtro-cliente']
        .forEach(id => { document.getElementById(id).value = ''; });

    _filtroActivo = false;
    const btnLimpiar = document.getElementById('btn-limpiar-filtro-reservas');
    if (btnLimpiar) btnLimpiar.style.display = 'none'; // ocultar el botón "Limpiar"

    _renderReservas(_todasReservas); // mostrar de nuevo todas las reservas sin filtro
}
