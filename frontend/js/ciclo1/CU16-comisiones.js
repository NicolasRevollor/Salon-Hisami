// =============================================================================
// CU16-comisiones.js — GESTIÓN DE COMISIONES (panel administrador)
// Ciclo 1 — Control de pagos al personal
// Permite al administrador ver todas las comisiones del personal y
// marcar las pendientes como pagadas.
// BD: comision(id_comision, id_esteticista, fecha, monto_comision, estado_pago)
// Depende de: main.js (API_BASE, mostrarToast, formatearFecha)
// =============================================================================

// Carga todas las comisiones de todo el personal desde la BD y las muestra en tabla.
// Cada fila muestra: empleado, fecha, monto, estado y botón "Marcar Pagado" si corresponde.
async function cargarComisionesAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/comisiones');
        const data = await res.json();
        if (!data.success) { mostrarToast('Error al cargar comisiones', 'error'); return; }

        const tbody = document.getElementById('tabla-admin-comisiones-body');
        if (!data.comisiones.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No hay comisiones registradas.</td></tr>';
            return;
        }
        tbody.innerHTML = data.comisiones.map(c => `
            <tr>
                <td>${c.nombre_empleado}</td>
                <td>${formatearFecha(c.fecha)}</td>
                <td>Bs ${parseFloat(c.monto_comision).toFixed(2)}</td>
                <td>
                    <span class="estado-badge ${c.estado_pago === 'Pagado' ? 'badge-completada' : 'badge-pendiente'}">
                        ${c.estado_pago}
                    </span>
                </td>
                <td>
                    ${c.estado_pago !== 'Pagado'
                        ? `<button class="btn-accion editar" onclick="pagarComisionAdmin(${c.id_comision})">Marcar Pagado</button>`
                        : '<span style="color:#aaa;font-size:13px;">—</span>'
                    }
                </td>
            </tr>
        `).join('');
    } catch (err) {
        mostrarToast('Error de conexión al cargar comisiones', 'error');
    }
}

// Marca una comisión específica como pagada vía PUT, tras pedir confirmación al admin
async function pagarComisionAdmin(id) {
    if (!confirm('¿Marcar esta comisión como pagada?')) return;
    try {
        const res  = await fetch(API_BASE + '/api/admin/comisiones/' + id + '/pagar', { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Comisión marcada como pagada');
            cargarComisionesAdmin(); // refrescar la tabla para reflejar el nuevo estado
        } else {
            mostrarToast(data.message || 'Error al actualizar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}
