// =============================================================================
// CU11-personal.js — CRUD DE EMPLEADOS Y SUS ESPECIALIDADES (panel admin)
// Ciclo 2 — Gestión del personal del salón
// Permite crear, editar, eliminar empleados y gestionar sus especialidades.
// BD: personal(id_esteticista, ci_usuario, estado)
//     personal_especialidades(id_esteticista FK, id_especialidad FK)
// Depende de: main.js (API_BASE, empleadosCache, espCrearSeleccionadas, mostrarToast, validarContrasena)
// =============================================================================

// Carga y muestra todos los empleados en la tabla del panel admin.
// También llena empleadosCache para acceso rápido en el modal de edición.
async function cargarEmpleadosAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/empleados');
        const data = await res.json();
        if (!data.success) return;

        empleadosCache = {};
        const tbody = document.getElementById('tabla-admin-empleados-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.empleados.forEach(emp => {
            empleadosCache[emp.ci] = emp;
            const activo = emp.estado === 'Activo';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${emp.nombre}</td>
                <td>${emp.ci}</td>
                <td>${emp.telefono || 'N/A'}</td>
                <td>${emp.email}</td>
                <td>${emp.area || '—'}</td>
                <td>${emp.especialidades || '—'}</td>
                <td>
                    <button class="btn-table"
                        onclick="abrirModalEditarEmpleado('${emp.ci}')">Editar</button>
                    <button
                        style="padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;
                               background:${activo ? '#28a745' : '#dc3545'};color:#fff;"
                        onclick="toggleEstadoEmpleado('${emp.ci}')">
                        ${activo ? 'Activo' : 'No Activo'}
                    </button>
                    <button class="btn-table-danger"
                        onclick="eliminarEmpleado('${emp.ci}','${emp.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error empleados admin:', err); }
}

// =============================================================================
// CREAR EMPLEADO
// =============================================================================

// Abre el modal de creación y resetea la lista temporal de especialidades seleccionadas
async function abrirModalAdminEmpleado() {
    document.getElementById('form-admin-empleado').reset();
    espCrearSeleccionadas = [];
    renderizarChipsCrear();
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', []);
    document.getElementById('modal-admin-empleado').classList.remove('seccion-oculta');
}

// Cierra el modal de creación de empleado sin guardar
function cerrarModalAdminEmpleado() {
    document.getElementById('modal-admin-empleado').classList.add('seccion-oculta');
}

// Carga las especialidades disponibles en el <select> dado, excluyendo las ya seleccionadas
async function cargarEspecialidadesEnSelect(selectId, excluirIds = []) {
    try {
        const res  = await fetch(API_BASE + '/api/especialidades');
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        sel.innerHTML = '<option value="">-- Especialidad --</option>';
        if (data.success) {
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

// Agrega la especialidad del <select> a la lista temporal espCrearSeleccionadas.
// Máximo 2 especialidades por empleado (regla de negocio del salón).
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
    espCrearSeleccionadas.push({ id, nombre: texto });
    renderizarChipsCrear();
    // Recargar el select excluyendo las ya seleccionadas para evitar duplicados
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', espCrearSeleccionadas.map(e => e.id));
}

// Elimina una especialidad de la lista temporal al hacer clic en su ✕
async function quitarEspEnCrear(id) {
    espCrearSeleccionadas = espCrearSeleccionadas.filter(e => String(e.id) !== String(id));
    renderizarChipsCrear();
    await cargarEspecialidadesEnSelect('admin-emp-esp-add', espCrearSeleccionadas.map(e => e.id));
}

// Renderiza los "chips" (etiquetas con ✕) de las especialidades seleccionadas.
// También actualiza el campo oculto con los IDs para que el formulario los envíe al submit.
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
    const hidden = document.getElementById('admin-emp-esp-ids');
    if (hidden) hidden.value = JSON.stringify(espCrearSeleccionadas.map(e => e.id));
}

// Valida el formulario y envía POST para crear el empleado con sus especialidades
async function manejarGuardarEmpleado(e) {
    e.preventDefault();

    const ci        = document.getElementById('admin-emp-ci').value.trim();
    const telefono  = document.getElementById('admin-emp-tel').value.trim();
    const nombre    = document.getElementById('admin-emp-nombre').value.trim();
    const email     = document.getElementById('admin-emp-email').value.trim();
    const area      = document.getElementById('admin-emp-area').value.trim();
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
                ci, nombre, telefono, email, area, contrasena,
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

// Abre el modal de edición pre-cargando los datos actuales del empleado
async function abrirModalEditarEmpleado(ci) {
    const emp = empleadosCache[ci];
    if (!emp) { mostrarToast('Empleado no encontrado', 'error'); return; }

    document.getElementById('edit-emp-ci').value          = emp.ci;
    document.getElementById('edit-emp-ci-display').value  = emp.ci;
    document.getElementById('edit-emp-nombre').value      = emp.nombre;
    document.getElementById('edit-emp-tel').value         = emp.telefono || '';
    document.getElementById('edit-emp-email').value       = emp.email;
    // Pre-cargar el área de trabajo actual del empleado
    document.getElementById('edit-emp-area').value        = emp.area || '';

    document.getElementById('modal-editar-empleado').classList.remove('seccion-oculta');
    await cargarEspecialidadesEmpleado(ci); // cargar especialidades actuales del empleado
}

// Cierra el modal de edición de empleado
function cerrarModalEditarEmpleado() {
    document.getElementById('modal-editar-empleado').classList.add('seccion-oculta');
}

// Maneja el submit del formulario de edición: actualiza nombre, teléfono y email (no la contraseña)
async function manejarEditarEmpleado(e) {
    e.preventDefault();

    const ci    = document.getElementById('edit-emp-ci').value;
    const nombre = document.getElementById('edit-emp-nombre').value.trim();
    const tel    = document.getElementById('edit-emp-tel').value.trim();
    const email  = document.getElementById('edit-emp-email').value.trim();
    const area   = document.getElementById('edit-emp-area').value.trim();

    if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!email)  { mostrarToast('El correo es obligatorio', 'error'); return; }

    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre, telefono: tel, email, area })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Empleado actualizado');
            cerrarModalEditarEmpleado();
            cargarEmpleadosAdmin();
        } else { mostrarToast(data.message || 'Error al actualizar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Alterna el estado Activo / No Activo del empleado y refresca la tabla
async function toggleEstadoEmpleado(ci) {
    try {
        const res  = await fetch(API_BASE + '/api/admin/empleados/' + ci + '/estado', { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Empleado marcado como ' + data.estado);
            cargarEmpleadosAdmin();
        } else {
            mostrarToast(data.message || 'Error al cambiar estado', 'error');
        }
    } catch {
        mostrarToast('Error de conexión', 'error');
    }
}

// Pide confirmación y elimina al empleado junto con todas sus relaciones en la BD
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

// Carga las especialidades actuales del empleado y prepara el select para agregar nuevas
async function cargarEspecialidadesEmpleado(ci) {
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades`);
        const data = await res.json();
        const lista = document.getElementById('lista-especialidades-empleado');
        if (!lista) return;
        lista.innerHTML = '';

        const asignadasIds = [];
        if (data.success && data.especialidades.length > 0) {
            data.especialidades.forEach(esp => {
                asignadasIds.push(String(esp.id_especialidad));
                const chip = document.createElement('span');
                chip.className = 'esp-chip';
                chip.innerHTML = `${esp.nombre_especialidad}
                    <button title="Eliminar" onclick="eliminarEspecialidadEmpleado('${ci}',${esp.id_especialidad})">✕</button>`;
                lista.appendChild(chip);
            });
        } else {
            lista.innerHTML = '<span style="color:#999;font-size:13px;">Sin especialidades asignadas</span>';
        }
        // Recargar el select excluyendo las ya asignadas
        await cargarEspecialidadesEnSelect('select-nueva-esp', asignadasIds);
    } catch (err) { console.error('Error cargando especialidades del empleado:', err); }
}

// Agrega una especialidad al empleado desde el select del modal de edición
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

// Elimina una especialidad específica de un empleado (botón ✕ en cada chip)
async function eliminarEspecialidadEmpleado(ci, id_esp) {
    try {
        const res  = await fetch(`${API_BASE}/api/admin/empleados/${ci}/especialidades/${id_esp}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Especialidad eliminada');
            await cargarEspecialidadesEmpleado(ci);
            cargarEmpleadosAdmin();
        } else { mostrarToast(data.message || 'Error', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// =============================================================================
// FUNCIÓN COMPARTIDA: cargarCategoriasEnSelect
// También la usa CU7-servicios.js → está aquí porque CU11 se carga antes que CU7.
// Carga las categorías de servicios en el <select> indicado.
// valorSeleccionado → id de la categoría a preseleccionar (al editar un servicio)
// =============================================================================
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
                if (valorSeleccionado && String(cat.id_categoria) === String(valorSeleccionado)) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });
        }
    } catch (err) { console.error('Error cargando categorías en select:', err); }
}
