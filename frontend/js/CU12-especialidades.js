// =============================================================================
// CU12-especialidades.js — GESTIÓN DE ESPECIALIDADES (panel administrador)
//
// Permite al administrador ver, crear y eliminar especialidades del catálogo.
// Las especialidades son las habilidades que se asignan al personal
// (ej: "Uñas", "Masajes", "Corte de cabello").
// =============================================================================

// Carga y muestra todas las especialidades del sistema
async function cargarEspecialidadesAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/especialidades');
        const data = await res.json();
        if (!data.success) { mostrarToast('Error al cargar especialidades', 'error'); return; }

        const tbody = document.getElementById('tabla-admin-especialidades-body');
        if (!data.especialidades.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888;padding:20px;">No hay especialidades registradas.</td></tr>';
            return;
        }
        tbody.innerHTML = data.especialidades.map(e => `
            <tr>
                <td>${e.id_especialidad}</td>
                <td>${e.nombre_especialidad}</td>
                <td>
                    <button class="btn-accion eliminar"
                        onclick="eliminarEspecialidadAdmin(${e.id_especialidad}, '${e.nombre_especialidad.replace(/'/g,"\\'")}')">
                        Eliminar
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        mostrarToast('Error de conexión al cargar especialidades', 'error');
    }
}

// Abre el modal de nueva especialidad
function abrirModalEspecialidad() {
    document.getElementById('input-nueva-especialidad').value = '';
    document.getElementById('modal-especialidad').classList.remove('seccion-oculta');
    document.getElementById('input-nueva-especialidad').focus();
}

function cerrarModalEspecialidad() {
    document.getElementById('modal-especialidad').classList.add('seccion-oculta');
}

// Crea una nueva especialidad
async function manejarGuardarEspecialidad(e) {
    e.preventDefault();
    const nombre = document.getElementById('input-nueva-especialidad').value.trim();
    if (!nombre) { mostrarToast('El nombre no puede estar vacío', 'error'); return; }

    try {
        const res  = await fetch(API_BASE + '/api/admin/especialidades', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre_especialidad: nombre })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad creada correctamente');
            cerrarModalEspecialidad();
            cargarEspecialidadesAdmin();
        } else {
            mostrarToast(data.message || 'Error al crear', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}

// Elimina una especialidad tras confirmación
async function eliminarEspecialidadAdmin(id, nombre) {
    if (!confirm(`¿Eliminar la especialidad "${nombre}"?\nNo se puede eliminar si hay empleados con esta especialidad asignada.`)) return;
    try {
        const res  = await fetch(API_BASE + '/api/admin/especialidades/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad eliminada');
            cargarEspecialidadesAdmin();
        } else {
            mostrarToast(data.message || 'Error al eliminar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}
