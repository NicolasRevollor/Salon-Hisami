// =============================================================================
// admin-servicios.js — CRUD DE SERVICIOS (panel administrador)
// Permite al admin ver, crear, editar y eliminar servicios del salón.
// Depende de: main.js (API_BASE, serviciosCache, mostrarToast)
//             admin-empleados.js (cargarCategoriasEnSelect — función compartida)
// =============================================================================

// =============================================================================
// Carga y muestra todos los servicios activos en la tabla del panel admin.
// También llena el objeto serviciosCache para usarlo en el modal de edición.
// =============================================================================
async function cargarServiciosAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/servicios');
        const data = await res.json();
        if (!data.success) return;

        serviciosCache = {}; // resetear caché antes de llenarlo de nuevo
        const tbody = document.getElementById('tabla-admin-servicios-body');
        if (!tbody) return;
        tbody.innerHTML = ''; // limpiar filas anteriores

        data.servicios.forEach(s => {
            serviciosCache[s.id_servicio] = s; // guardar para acceso rápido al editar

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.id_servicio}</td>
                <td>${s.nombre_servicio}</td>
                <td>Bs ${parseFloat(s.precio).toFixed(2)}</td>
                <td>${s.nombre_categoria || 'N/A'}</td>
                <td>
                    <button class="btn-table"
                        onclick="abrirModalAdminServicio(${s.id_servicio})">Editar</button>
                    <button class="btn-table-danger"
                        onclick="eliminarServicio(${s.id_servicio},'${s.nombre_servicio.replace(/'/g,"\\'")}')">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error cargando servicios admin:', err); }
}

// Abre el modal de servicio en modo CREAR (idServicio=null) o EDITAR (con id)
// Si es edición, rellena el formulario con los datos actuales del servicio
async function abrirModalAdminServicio(idServicio = null) {
    document.getElementById('form-admin-servicio').reset(); // limpiar formulario

    if (idServicio !== null) {
        // MODO EDICIÓN: buscar los datos del servicio en el caché
        const s = serviciosCache[idServicio];
        if (!s) { mostrarToast('Servicio no encontrado', 'error'); return; }

        document.getElementById('titulo-modal-servicio').textContent = 'Editar Servicio';
        document.getElementById('admin-serv-id').value     = s.id_servicio;
        document.getElementById('admin-serv-nombre').value = s.nombre_servicio;
        document.getElementById('admin-serv-desc').value   = s.descripcion || '';
        document.getElementById('admin-serv-precio').value = s.precio;
        await cargarCategoriasEnSelect('admin-serv-cat', s.id_categoria); // preseleccionar categoría
    } else {
        // MODO CREAR: solo limpiar y cargar categorías sin preselección
        document.getElementById('titulo-modal-servicio').textContent = 'Nuevo Servicio';
        document.getElementById('admin-serv-id').value = ''; // sin id = es nuevo
        await cargarCategoriasEnSelect('admin-serv-cat', null);
    }
    document.getElementById('modal-admin-servicio').classList.remove('seccion-oculta');
}

// Cierra el modal de creación/edición de servicios
function cerrarModalAdminServicio() {
    document.getElementById('modal-admin-servicio').classList.add('seccion-oculta');
}

// Maneja el submit del formulario: decide si crear (POST) o editar (PUT) según si hay id
async function manejarGuardarServicio(e) {
    e.preventDefault();

    const id              = document.getElementById('admin-serv-id').value;
    const nombre_servicio = document.getElementById('admin-serv-nombre').value.trim();
    const descripcion     = document.getElementById('admin-serv-desc').value.trim();
    const precio          = parseFloat(document.getElementById('admin-serv-precio').value);
    const id_categoria    = document.getElementById('admin-serv-cat').value;

    // Validaciones antes de enviar
    if (!nombre_servicio) { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!precio || precio <= 0) { mostrarToast('Ingresa un precio válido mayor a 0', 'error'); return; }
    if (!id_categoria)    { mostrarToast('Selecciona una categoría', 'error'); return; }

    try {
        // Si hay id → editar (PUT /api/admin/servicios/:id)
        // Si no hay id → crear (POST /api/admin/servicios)
        const url    = id ? `${API_BASE}/api/admin/servicios/${id}` : `${API_BASE}/api/admin/servicios`;
        const method = id ? 'PUT' : 'POST';
        const res    = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre_servicio, descripcion, precio, id_categoria })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast(id ? 'Servicio actualizado' : 'Servicio creado');
            cerrarModalAdminServicio();
            cargarServiciosAdmin(); // Refrescar la tabla
            cargarServiciosDeBD(); // Refrescar el catálogo del landing también
        } else {
            mostrarToast(data.message || 'Error al guardar', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Pide confirmación y luego marca el servicio como Inactivo (no se borra físicamente)
async function eliminarServicio(id, nombre) {
    if (!confirm(`¿Eliminar el servicio "${nombre}"?`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/admin/servicios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Servicio eliminado');
            cargarServiciosAdmin();
            cargarServiciosDeBD(); // Actualizar el catálogo del landing
        } else {
            mostrarToast(data.message || 'Error al eliminar', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
}
