// =============================================================================
// CU16-comisiones.js — GESTIÓN DE COMISIONES (panel administrador)
//
// Permite al administrador ver todas las comisiones del personal y
// marcar las pendientes como pagadas.
// =============================================================================

// Carga todas las comisiones del personal desde la BD
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

// Marca una comisión como pagada
async function pagarComisionAdmin(id) {
    if (!confirm('¿Marcar esta comisión como pagada?')) return;
    try {
        const res  = await fetch(API_BASE + '/api/admin/comisiones/' + id + '/pagar', { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Comisión marcada como pagada');
            cargarComisionesAdmin();
        } else {
            mostrarToast(data.message || 'Error al actualizar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}
