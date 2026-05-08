// =============================================================================
// admin-empleados.js — CRUD DE EMPLEADOS Y SUS ESPECIALIDADES (panel admin)
// Permite crear, editar, eliminar empleados y gestionar sus especialidades.
// Depende de: main.js (API_BASE, empleadosCache, espCrearSeleccionadas, mostrarToast, validarContrasena)
// =============================================================================

// =============================================================================
// Carga y muestra todos los empleados en la tabla del panel admin.
// También llena el objeto empleadosCache para el modal de edición.
// =============================================================================
async function cargarEmpleadosAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/empleados');
        const data = await res.json();
        if (!data.success) return;

        empleadosCache = {}; // resetear caché antes de llenarlo
        const tbody = document.getElementById('tabla-admin-empleados-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.empleados.forEach(emp => {
            empleadosCache[emp.ci] = emp; // guardar por CI para acceso rápido
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${emp.nombre}</td>
                <td>${emp.ci}</td>
                <td>${emp.telefono || 'N/A'}</td>
                <td>${emp.email}</td>
                <td>${emp.especialidades || '—'}</td>
                <td>
                    <button class="btn-table"
                        onclick="abrirModalEditarEmpleado('${emp.ci}')">Editar</button>
                    <button class="btn-table-danger"
                        onclick="eliminarEmpleado('${emp.ci}','${emp.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error empleados admin:', err); }
}

// =============================================================================
// CREAR EMPLEADO — modal con especialidades dinámicas
// =============================================================================

// Abre el modal de crear empleado y resetea la lista de especialidades seleccionadas
async function abrirModalAdminEmpleado() {
    document.getElementById('form-admin-empleado').reset();
    espCrearSeleccionadas = []; // limpiar lista temporal de especialidades
    renderizarChipsCrear();
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', []); // cargar todas las especialidades
    document.getElementById('modal-admin-empleado').classList.remove('seccion-oculta');
}

// Cierra el modal de crear empleado
function cerrarModalAdminEmpleado() {
    document.getElementById('modal-admin-empleado').classList.add('seccion-oculta');
}

// Carga las especialidades en un <select> con el id dado.
// excluirIds → array de IDs de especialidades que ya están seleccionadas (para no repetirlas)
async function cargarEspecialidadesEnSelect(selectId, excluirIds = []) {
    try {
        const res  = await fetch(API_BASE + '/api/especialidades');
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        sel.innerHTML = '<option value="">-- Especialidad --</option>';
        if (data.success) {
            // Filtrar para no mostrar las ya seleccionadas
            data.especialidades
                .filter(e => !excluirIds.map(String).includes(String(e.id_especialidad)))
                .forEach(esp => {
                    const opt = document.createElement('option');
                    opt.value = esp.id_especialidad;
                    opt.textContent = esp.nombre_especialidad;
                    sel.appendChild(opt);
                });
        }
    } catch (err) { console.error('Error cargando especialidades en select:', err); }
}

// Agrega la especialidad seleccionada en el <select> a la lista temporal espCrearSeleccionadas
// Límite: máximo 2 especialidades por empleado (regla de negocio del salón)
async function agregarEspEnCrear() {
    if (espCrearSeleccionadas.length >= 2) {
        mostrarToast('Máximo 2 especialidades por empleado', 'error'); return;
    }
    const sel   = document.getElementById('admin-emp-esp-add');
    const id    = sel.value;
    const texto = sel.options[sel.selectedIndex]?.text;
    if (!id) { mostrarToast('Selecciona una especialidad', 'error'); return; }
    if (espCrearSeleccionadas.find(e => String(e.id) === String(id))) {
        mostrarToast('Esa especialidad ya fue agregada', 'error'); return;
    }
    espCrearSeleccionadas.push({ id, nombre: texto }); // agregar al array temporal
    renderizarChipsCrear(); // actualizar los chips visuales
    // Recargar el select excluyendo las ya seleccionadas para evitar duplicados
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', espCrearSeleccionadas.map(e => e.id));
}

// Elimina una especialidad de la lista temporal al hacer clic en el ✕ de su chip
async function quitarEspEnCrear(id) {
    espCrearSeleccionadas = espCrearSeleccionadas.filter(e => String(e.id) !== String(id));
    renderizarChipsCrear();
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', espCrearSeleccionadas.map(e => e.id));
}

// Renderiza los "chips" (etiquetas con ✕) de las especialidades seleccionadas.
// También actualiza el campo oculto con los IDs para que el formulario los envíe.
function renderizarChipsCrear() {
    const lista = document.getElementById('admin-emp-esp-lista');
    if (!lista) return;
    lista.innerHTML = '';
    espCrearSeleccionadas.forEach(e => {
        const chip = document.createElement('span');
        chip.className = 'esp-chip';
        chip.innerHTML = `${e.nombre} <button type="button" onclick="quitarEspEnCrear('${e.id}')">✕</button>`;
        lista.appendChild(chip);
    });
    // Guardar los IDs en el campo oculto para que viaje en el submit del formulario
    const hidden = document.getElementById('admin-emp-esp-ids');
    if (hidden) hidden.value = JSON.stringify(espCrearSeleccionadas.map(e => e.id));
}

// Maneja el submit del formulario de crear empleado
async function manejarGuardarEmpleado(e) {
    e.preventDefault();

    const ci        = document.getElementById('admin-emp-ci').value.trim();
    const telefono  = document.getElementById('admin-emp-tel').value.trim();
    const nombre    = document.getElementById('admin-emp-nombre').value.trim();
    const email     = document.getElementById('admin-emp-email').value.trim();
    const contrasena = document.getElementById('admin-emp-pass').value;

    if (!ci)       { mostrarToast('El CI es obligatorio', 'error'); return; }
    if (!nombre)   { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!email)    { mostrarToast('El correo es obligatorio', 'error'); return; }
    if (espCrearSeleccionadas.length === 0) { mostrarToast('Agrega al menos una especialidad', 'error'); return; }
    if (!contrasena) { mostrarToast('Ingresa una contraseña', 'error'); return; }
    if (!validarContrasena(contrasena)) {
        mostrarToast('La contraseña debe tener: 1 número, 1 mayúscula y 1 símbolo', 'error'); return;
    }

    try {
        const res  = await fetch(API_BASE + '/api/admin/empleados', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                ci, nombre, telefono, email, contrasena,
                especialidades: espCrearSeleccionadas.map(e => e.id)
            })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Empleado registrado. Se envió correo con credenciales.');
            cerrarModalAdminEmpleado();
            cargarEmpleadosAdmin();
        } else { mostrarToast(data.message || 'Error al registrar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// EDITAR EMPLEADO
// =============================================================================

// Abre el modal de edición rellenando los campos con los datos actuales del empleado
async function abrirModalEditarEmpleado(ci) {
    const emp = empleadosCache[ci];
    if (!emp) { mostrarToast('Empleado no encontrado', 'error'); return; }

    document.getElementById('edit-emp-ci').value          = emp.ci;
    document.getElementById('edit-emp-ci-display').value  = emp.ci; // campo solo lectura para mostrar el CI
    document.getElementById('edit-emp-nombre').value      = emp.nombre;
    document.getElementById('edit-emp-tel').value         = emp.telefono || '';
    document.getElementById('edit-emp-email').value       = emp.email;

    document.getElementById('modal-editar-empleado').classList.remove('seccion-oculta');
    await cargarEspecialidadesEmpleado(ci); // cargar especialidades actuales del empleado
}

// Cierra el modal de edición de empleado
function cerrarModalEditarEmpleado() {
    document.getElementById('modal-editar-empleado').classList.add('seccion-oculta');
}

// Maneja el submit del formulario de edición (solo actualiza nombre, teléfono y email)
async function manejarEditarEmpleado(e) {
    e.preventDefault();

    const ci    = document.getElementById('edit-emp-ci').value;
    const nombre = document.getElementById('edit-emp-nombre').value.trim();
    const tel    = document.getElementById('edit-emp-tel').value.trim();
    const email  = document.getElementById('edit-emp-email').value.trim();

    if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!email)  { mostrarToast('El correo es obligatorio', 'error'); return; }

    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre, telefono: tel, email })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Empleado actualizado');
            cerrarModalEditarEmpleado();
            cargarEmpleadosAdmin();
        } else { mostrarToast(data.message || 'Error al actualizar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Pide confirmación y luego elimina al empleado y todas sus relaciones en la BD
async function eliminarEmpleado(ci, nombre) {
    if (!confirm(`¿Eliminar al empleado "${nombre}"? Se borrarán todos sus datos.`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { mostrarToast('Empleado eliminado'); cargarEmpleadosAdmin(); }
        else { mostrarToast(data.message || 'Error al eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// ESPECIALIDADES DEL EMPLEADO (dentro del modal de edición)
// =============================================================================

// Carga las especialidades actuales del empleado y el select para agregar nuevas
async function cargarEspecialidadesEmpleado(ci) {
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades`);
        const data = await res.json();
        const lista = document.getElementById('lista-especialidades-empleado');
        if (!lista) return;
        lista.innerHTML = '';

        const asignadasIds = []; // para excluirlas del select de "agregar nueva"
        if (data.success && data.especialidades.length > 0) {
            data.especialidades.forEach(esp => {
                asignadasIds.push(String(esp.id_especialidad));
                const chip = document.createElement('span');
                chip.className = 'esp-chip';
                // Botón ✕ para eliminar la especialidad de este empleado
                chip.innerHTML = `${esp.nombre_especialidad}
                    <button title="Eliminar" onclick="eliminarEspecialidadEmpleado('${ci}',${esp.id_especialidad})">✕</button>`;
                lista.appendChild(chip);
            });
        } else {
            lista.innerHTML = '<span style="color:#999;font-size:13px;">Sin especialidades asignadas</span>';
        }
        // Recargar el select excluyendo las especialidades ya asignadas
        await cargarEspecialidadesEnSelect('select-nueva-esp', asignadasIds);
    } catch (err) { console.error('Error cargando especialidades del empleado:', err); }
}

// Agrega una nueva especialidad al empleado desde el select del modal de edición
async function agregarEspecialidadEmpleado() {
    const ci     = document.getElementById('edit-emp-ci').value;
    const id_esp = document.getElementById('select-nueva-esp').value;
    if (!id_esp) { mostrarToast('Selecciona una especialidad', 'error'); return; }

    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_especialidad: id_esp })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad agregada');
            await cargarEspecialidadesEmpleado(ci); // refrescar la lista en el modal
            cargarEmpleadosAdmin();                 // refrescar la tabla general
        } else { mostrarToast(data.message || 'Error al agregar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Elimina una especialidad específica de un empleado
async function eliminarEspecialidadEmpleado(ci, id_esp) {
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades/${id_esp}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad eliminada');
            await cargarEspecialidadesEmpleado(ci); // refrescar lista
            cargarEmpleadosAdmin();
        } else { mostrarToast(data.message || 'Error', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// FUNCIÓN COMPARTIDA: cargarCategoriasEnSelect
// También la usa admin-servicios.js → está aquí porque admin-empleados.js
// se carga antes que admin-servicios.js en el HTML.
// =============================================================================

// Carga las categorías de servicios en el <select> con el id dado.
// valorSeleccionado → id de la categoría que debe quedar preseleccionada (al editar)
async function cargarCategoriasEnSelect(selectId, valorSeleccionado) {
    try {
        const res  = await fetch(API_BASE + '/api/categorias');
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        sel.innerHTML = '<option value="">-- Selecciona categoría --</option>';
        if (data.success) {
            data.categorias.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id_categoria;
                opt.textContent = cat.nombre;
                // Si es edición, preseleccionar la categoría actual del servicio
                if (valorSeleccionado && String(cat.id_categoria) === String(valorSeleccionado)) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });
        }
    } catch (err) { console.error('Error cargando categorías en select:', err); }
}
