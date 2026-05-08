// =============================================================================
// CU8-categorias.js — GESTIÓN DE CATEGORÍAS DE SERVICIOS (panel admin)
// Las categorías agrupan los servicios (ej: Manicura, Pedicura, Facial...).
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
        tbody.innerHTML = ''; // limpiar filas anteriores

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

// Maneja el submit del formulario para crear una nueva categoría (POST)
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
            cargarCategoriasAdmin(); // refrescar tabla de categorías
            cargarServiciosDeBD();   // refrescar los botones de filtro del catálogo landing
        } else { mostrarToast(data.message || 'Error al crear', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Abre el modal de edición con el id y nombre actuales de la categoría pre-cargados
function abrirModalEditarCategoria(id, nombre) {
    document.getElementById('edit-cat-id').value    = id;
    document.getElementById('edit-cat-nombre').value = nombre;
    document.getElementById('modal-editar-categoria').classList.remove('seccion-oculta');
}

// Cierra el modal de edición de categoría
function cerrarModalEditarCategoria() {
    document.getElementById('modal-editar-categoria').classList.add('seccion-oculta');
}

// Maneja el submit del formulario de edición: actualiza el nombre vía PUT
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
            cargarCategoriasAdmin(); // refrescar tabla
            cargarServiciosDeBD();   // refrescar botones de filtro del catálogo
        } else { mostrarToast(data.message || 'Error al actualizar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Pide confirmación y elimina la categoría.
// IMPORTANTE: Si la categoría tiene servicios asociados, la BD rechazará la eliminación
// (clave foránea FK) → el servidor devuelve un error descriptivo.
async function eliminarCategoria(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/categorias/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Categoría eliminada');
            cargarCategoriasAdmin();
            cargarServiciosDeBD(); // actualizar botones de filtro
        } else { mostrarToast(data.message || 'No se pudo eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}
