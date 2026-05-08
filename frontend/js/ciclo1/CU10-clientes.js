// =============================================================================
// CU10-clientes.js — GESTIÓN DE CLIENTES (panel administrador)
// Ciclo 1 — Administración de clientes registrados
// Permite al administrador ver, editar y eliminar clientes.
// BD: usuarios(ci, nombre, telefono, email) + clientes(ci_usuario)
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

// Carga todos los clientes desde la BD y los muestra en la tabla del panel admin
async function cargarClientesAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/clientes');
        const data = await res.json();
        if (!data.success) { mostrarToast('Error al cargar clientes', 'error'); return; }

        const tbody = document.getElementById('tabla-admin-clientes-body');
        if (!data.clientes.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No hay clientes registrados.</td></tr>';
            return;
        }
        // Generar una fila por cada cliente con sus datos y botones de acción
        tbody.innerHTML = data.clientes.map(c => `
            <tr>
                <td>${c.ci}</td>
                <td>${c.nombre}</td>
                <td>${c.telefono || '—'}</td>
                <td>${c.email}</td>
                <td>
                    <button class="btn-accion editar"
                        onclick="abrirModalEditarCliente('${c.ci}','${c.nombre}','${c.telefono || ''}','${c.email}')">
                        Editar
                    </button>
                    <button class="btn-accion eliminar"
                        onclick="eliminarClienteAdmin('${c.ci}','${c.nombre}')">
                        Eliminar
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        mostrarToast('Error de conexión al cargar clientes', 'error');
    }
}

// Abre el modal de edición pre-cargando todos los campos con los datos actuales del cliente
function abrirModalEditarCliente(ci, nombre, telefono, email) {
    document.getElementById('editar-cliente-ci').value       = ci;
    document.getElementById('editar-cliente-nombre').value   = nombre;
    document.getElementById('editar-cliente-telefono').value = telefono;
    document.getElementById('editar-cliente-email').value    = email;
    document.getElementById('modal-editar-cliente').classList.remove('seccion-oculta');
}

// Cierra el modal de edición de cliente sin guardar cambios
function cerrarModalEditarCliente() {
    document.getElementById('modal-editar-cliente').classList.add('seccion-oculta');
}

// Maneja el submit del formulario de edición: envía PUT con los nuevos datos
async function manejarEditarCliente(e) {
    e.preventDefault();
    const ci       = document.getElementById('editar-cliente-ci').value;
    const nombre   = document.getElementById('editar-cliente-nombre').value.trim();
    const telefono = document.getElementById('editar-cliente-telefono').value.trim();
    const email    = document.getElementById('editar-cliente-email').value.trim();

    if (!nombre || !email) { mostrarToast('Nombre y correo son obligatorios', 'error'); return; }

    try {
        const res  = await fetch(API_BASE + '/api/admin/clientes/' + ci, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, email })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Cliente actualizado correctamente');
            cerrarModalEditarCliente();
            cargarClientesAdmin(); // refrescar la tabla
        } else {
            mostrarToast(data.message || 'Error al actualizar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}

// Elimina un cliente completo (usuario + fila en clientes) tras pedir confirmación
async function eliminarClienteAdmin(ci, nombre) {
    if (!confirm(`¿Eliminar al cliente "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
        const res  = await fetch(API_BASE + '/api/admin/clientes/' + ci, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Cliente eliminado');
            cargarClientesAdmin(); // refrescar la tabla
        } else {
            mostrarToast(data.message || 'Error al eliminar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}
