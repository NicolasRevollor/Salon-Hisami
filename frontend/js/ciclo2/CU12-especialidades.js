// =============================================================================
// CU12-especialidades.js — GESTIÓN DE ESPECIALIDADES (panel administrador)
// Ciclo 2 — Catálogo global de habilidades del personal
// Permite al admin ver, crear y eliminar especialidades del catálogo.
// Las especialidades se asignan al personal (ej: "Uñas", "Masajes", "Corte").
// BD: especialidades(id_especialidad, nombre_especialidad)
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

// Carga y muestra todas las especialidades registradas en la tabla del panel admin
async function cargarEspecialidadesAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/especialidades');
        const data = await res.json();
        if (!data.success) { mostrarToast('Error al cargar especialidades', 'error'); return; }

        const tbody = document.getElementById('tabla-admin-especialidades-body');
        if (!data.especialidades.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;padding:20px;">No hay especialidades registradas.</td></tr>';
            return;
        }
        tbody.innerHTML = data.especialidades.map(e => `
            <tr>
                <td>${e.id_especialidad}</td>
                <td>${e.nombre_especialidad}</td>
                <td style="font-size:13px;color:#555;">${e.descripcion || '—'}</td>
                <td>
                    <button class="btn-accion editar"
                        onclick="abrirModalEditarEspecialidad(${e.id_especialidad}, '${e.nombre_especialidad.replace(/'/g,"\\'")}', '${(e.descripcion||'').replace(/'/g,"\\'")}')">
                        Editar
                    </button>
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

// Abre el modal de nueva especialidad y limpia ambos campos (nombre y descripción)
function abrirModalEspecialidad() {
    document.getElementById('input-nueva-especialidad').value = '';
    document.getElementById('input-nueva-especialidad-descripcion').value = '';
    document.getElementById('modal-especialidad').classList.remove('seccion-oculta');
    document.getElementById('input-nueva-especialidad').focus();
}

// Cierra el modal de nueva especialidad sin guardar cambios
function cerrarModalEspecialidad() {
    document.getElementById('modal-especialidad').classList.add('seccion-oculta');
}

// Maneja el submit del formulario: envía POST para crear la especialidad con descripción opcional
async function manejarGuardarEspecialidad(e) {
    e.preventDefault();
    const nombre      = document.getElementById('input-nueva-especialidad').value.trim();
    const descripcion = document.getElementById('input-nueva-especialidad-descripcion').value.trim();
    if (!nombre) { mostrarToast('El nombre no puede estar vacío', 'error'); return; }

    try {
        const res  = await fetch(API_BASE + '/api/admin/especialidades', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre_especialidad: nombre, descripcion: descripcion || null })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad creada correctamente');
            cerrarModalEspecialidad();
            cargarEspecialidadesAdmin(); // refrescar la tabla
        } else {
            mostrarToast(data.message || 'Error al crear', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}

// Abre el modal de edición pre-cargando el id, nombre y descripción actuales
function abrirModalEditarEspecialidad(id, nombre, descripcion) {
    document.getElementById('editar-especialidad-id').value          = id;
    document.getElementById('editar-especialidad-nombre').value      = nombre;
    document.getElementById('editar-especialidad-descripcion').value = descripcion || '';
    document.getElementById('modal-editar-especialidad').classList.remove('seccion-oculta');
    document.getElementById('editar-especialidad-nombre').focus();
}

// Cierra el modal de edición sin guardar cambios
function cerrarModalEditarEspecialidad() {
    document.getElementById('modal-editar-especialidad').classList.add('seccion-oculta');
}

// Maneja el submit del formulario de edición: envía PUT con el nuevo nombre y descripción
async function manejarEditarEspecialidad(e) {
    e.preventDefault();
    const id          = document.getElementById('editar-especialidad-id').value;
    const nombre      = document.getElementById('editar-especialidad-nombre').value.trim();
    const descripcion = document.getElementById('editar-especialidad-descripcion').value.trim();
    if (!nombre) { mostrarToast('El nombre no puede estar vacío', 'error'); return; }

    try {
        const res  = await fetch(API_BASE + '/api/admin/especialidades/' + id, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre_especialidad: nombre, descripcion: descripcion || null })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad actualizada correctamente');
            cerrarModalEditarEspecialidad();
            cargarEspecialidadesAdmin();
        } else {
            mostrarToast(data.message || 'Error al actualizar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}

// Elimina una especialidad tras pedir confirmación.
// La BD rechaza el borrado si algún empleado tiene esta especialidad asignada (FK).
async function eliminarEspecialidadAdmin(id, nombre) {
    if (!confirm(`¿Eliminar la especialidad "${nombre}"?\nNo se puede eliminar si hay empleados con esta especialidad asignada.`)) return;
    try {
        const res  = await fetch(API_BASE + '/api/admin/especialidades/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad eliminada');
            cargarEspecialidadesAdmin(); // refrescar la tabla
        } else {
            mostrarToast(data.message || 'Error al eliminar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    }
}
