// =============================================================================
// CU8-categorias.js — GESTIÓN DE CATEGORÍAS DE SERVICIOS (panel admin)
// Ciclo 2 — Gestión del catálogo de servicios
// Un paquete agrupa los servicios del salón (ej: Manicura, Pedicura, Facial...).
// BD: categoria(id_categoria, nombre)
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

// Carga y muestra todas las categorías en la tabla del panel admin.
// Incluye botones "Editar" y "Eliminar" en cada fila.
async function cargarCategoriasAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/categorias');
        const data = await res.json();
        if (!data.success) return;

        const tbody = document.getElementById('tabla-admin-categorias-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.categorias.forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cat.id_categoria}</td>
                <td>${cat.nombre}</td>
                <td>
                    <button class="btn-table"
                        onclick="abrirModalEditarCategoria(${cat.id_categoria},'${cat.nombre.replace(/'/g,"\\'")}')">
                        Editar
                    </button>
                    <button class="btn-table-danger"
                        onclick="eliminarCategoria(${cat.id_categoria},'${cat.nombre.replace(/'/g,"\\'")}')">
                        Eliminar
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error cargando categorías admin:', err); }
}

// Abre el modal para crear una nueva categoría (formulario vacío)
function abrirModalCategoria() {
    document.getElementById('form-categoria').reset();
    document.getElementById('modal-categoria').classList.remove('seccion-oculta');
}

// Cierra el modal de creación de categoría
function cerrarModalCategoria() {
    document.getElementById('modal-categoria').classList.add('seccion-oculta');
}

// Maneja el submit del formulario de creación: envía POST con el nombre ingresado
async function manejarGuardarCategoria(e) {
    e.preventDefault();
    const nombre = document.getElementById('cat-nombre').value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }

    try {
        const res  = await fetch(API_BASE + '/api/categorias', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Categoría creada');
            cerrarModalCategoria();
            cargarCategoriasAdmin();
            cargarServiciosDeBD(); // refrescar botones de filtro del catálogo landing
        } else { mostrarToast(data.message || 'Error al crear', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Abre el modal de edición pre-cargando el id (oculto) y nombre actuales de la categoría
function abrirModalEditarCategoria(id, nombre) {
    document.getElementById('edit-cat-id').value    = id;
    document.getElementById('edit-cat-nombre').value = nombre;
    document.getElementById('modal-editar-categoria').classList.remove('seccion-oculta');
}

// Cierra el modal de edición de categoría sin guardar cambios
function cerrarModalEditarCategoria() {
    document.getElementById('modal-editar-categoria').classList.add('seccion-oculta');
}

// Maneja el submit del formulario de edición: envía PUT con el nuevo nombre
async function manejarEditarCategoria(e) {
    e.preventDefault();
    const id     = document.getElementById('edit-cat-id').value;
    const nombre = document.getElementById('edit-cat-nombre').value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }

    try {
        const res  = await fetch(`${API_BASE}/api/categorias/${id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Categoría actualizada');
            cerrarModalEditarCategoria();
            cargarCategoriasAdmin();
            cargarServiciosDeBD(); // refrescar botones de filtro del catálogo
        } else { mostrarToast(data.message || 'Error al actualizar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Pide confirmación y elimina la categoría.
// Si la categoría tiene servicios asociados, la BD rechaza el borrado (FK constraint).
async function eliminarCategoria(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/categorias/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Categoría eliminada');
            cargarCategoriasAdmin();
            cargarServiciosDeBD();
        } else { mostrarToast(data.message || 'No se pudo eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}
