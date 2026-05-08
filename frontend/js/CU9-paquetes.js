// =============================================================================
// admin-paquetes.js — GESTIÓN DE PAQUETES PROMOCIONALES (panel admin)
// Un paquete agrupa varios servicios con un precio especial y fechas de vigencia.
// BD: paquetes(id_paquete, nombre, descripcion, precio_promocional, fecha_inicio, fecha_final)
//     detalle_paquete(id_paquete FK, id_servicio FK)
// Depende de: main.js (API_BASE, paquetesCache, mostrarToast, formatearFechaCorta)
// =============================================================================

// Carga y muestra todos los paquetes con sus servicios en la tabla del panel admin
async function cargarPaquetesAdmin() {
    try {
        const res  = await fetch(API_BASE + '/api/admin/paquetes');
        const data = await res.json();
        const tbody = document.getElementById('tabla-admin-paquetes-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data.success || !data.paquetes?.length) {
            // Mostrar mensaje si no hay paquetes registrados aún
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Sin paquetes registrados</td></tr>';
            return;
        }

        paquetesCache = {}; // resetear caché antes de llenarlo
        data.paquetes.forEach(p => {
            paquetesCache[p.id_paquete] = p; // guardar para acceso rápido al editar

            // Extraer solo los primeros 10 caracteres (YYYY-MM-DD) antes de formatear,
            // porque PostgreSQL devuelve timestamps completos ("2025-01-15T00:00:00.000Z")
            const inicio   = formatearFecha(p.fecha_inicio);
            const fin      = formatearFecha(p.fecha_final);
            const vigencia = (p.fecha_inicio || p.fecha_final) ? `${inicio} → ${fin}` : '—';

            // Concatenar los nombres de los servicios incluidos separados por coma
            const servicios = (p.servicios || []).map(s => s.nombre_servicio).join(', ') || '—';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id_paquete}</td>
                <td>${p.nombre}</td>
                <td>Bs ${parseFloat(p.precio_promocional || 0).toFixed(2)}</td>
                <td style="font-size:12px;">${vigencia}</td>
                <td style="font-size:12px;">${servicios}</td>
                <td>
                    <button class="btn-table"
                        onclick="abrirModalPaquete(${p.id_paquete})">Editar</button>
                    <button class="btn-table-danger"
                        onclick="eliminarPaquete(${p.id_paquete},'${p.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('Error paquetes admin:', err); }
}

// Abre el modal en modo CREAR (sin id) o EDITAR (con id).
// En modo edición, rellena todos los campos y pre-marca los servicios incluidos.
async function abrirModalPaquete(idPaquete = null) {
    document.getElementById('form-paquete').reset();
    const checksDiv = document.getElementById('paq-servicios-checks');
    checksDiv.innerHTML = '<p style="color:#999;font-size:13px;">Cargando servicios...</p>';

    let seleccionados = []; // IDs de servicios ya incluidos en el paquete (modo edición)

    if (idPaquete !== null) {
        // MODO EDICIÓN: rellenar el formulario con los datos actuales del paquete
        const paq = paquetesCache[idPaquete];
        if (!paq) { mostrarToast('Paquete no encontrado', 'error'); return; }

        document.getElementById('titulo-modal-paquete').textContent  = 'Editar Paquete';
        document.getElementById('btn-submit-paquete').textContent     = 'Guardar Cambios';
        document.getElementById('paq-id').value           = paq.id_paquete;
        document.getElementById('paq-nombre').value       = paq.nombre;
        document.getElementById('paq-descripcion').value  = paq.descripcion || '';
        document.getElementById('paq-precio-promo').value = paq.precio_promocional || '';
        // Tomar solo los primeros 10 caracteres (YYYY-MM-DD) para que el <input type="date"> lo entienda
        document.getElementById('paq-fecha-inicio').value = paq.fecha_inicio ? paq.fecha_inicio.substring(0, 10) : '';
        document.getElementById('paq-fecha-final').value  = paq.fecha_final  ? paq.fecha_final.substring(0, 10)  : '';
        seleccionados = (paq.servicios || []).map(s => String(s.id_servicio));
    } else {
        // MODO CREAR: solo limpiar título y id oculto
        document.getElementById('titulo-modal-paquete').textContent = 'Nuevo Paquete Promocional';
        document.getElementById('btn-submit-paquete').textContent   = 'Crear Paquete';
        document.getElementById('paq-id').value = ''; // sin id = es nuevo
    }

    // Cargar todos los servicios como checkboxes (marcando los ya incluidos si es edición)
    try {
        const res  = await fetch(API_BASE + '/api/servicios');
        const data = await res.json();
        checksDiv.innerHTML = '';
        if (data.success && data.servicios.length > 0) {
            data.servicios.forEach(s => {
                const label = document.createElement('label');
                label.className = 'paq-check-item';
                const cb = document.createElement('input');
                cb.type  = 'checkbox';
                cb.value = s.id_servicio;
                cb.name  = 'paq-servicio';
                // Pre-marcar si el servicio ya está en el paquete (modo edición)
                if (seleccionados.includes(String(s.id_servicio))) cb.checked = true;
                label.appendChild(cb);
                label.appendChild(document.createTextNode(` ${s.nombre_servicio} — Bs ${parseFloat(s.precio).toFixed(2)}`));
                checksDiv.appendChild(label);
            });
        } else {
            checksDiv.innerHTML = '<p style="color:#999;font-size:12px;">No hay servicios disponibles</p>';
        }
    } catch {
        checksDiv.innerHTML = '<p style="color:red;font-size:12px;">Error al cargar servicios</p>';
    }

    document.getElementById('modal-paquete').classList.remove('seccion-oculta');
}

// Cierra el modal de paquetes
function cerrarModalPaquete() {
    document.getElementById('modal-paquete').classList.add('seccion-oculta');
}

// Maneja el submit: crea (POST) o edita (PUT) el paquete con sus servicios seleccionados
async function manejarGuardarPaquete(e) {
    e.preventDefault();

    const id                = document.getElementById('paq-id').value;
    const nombre            = document.getElementById('paq-nombre').value.trim();
    const descripcion       = document.getElementById('paq-descripcion').value.trim();
    const precio_promocional = parseFloat(document.getElementById('paq-precio-promo').value);
    const fecha_inicio      = document.getElementById('paq-fecha-inicio').value || null;
    const fecha_final       = document.getElementById('paq-fecha-final').value  || null;
    // Recoger los IDs de los checkboxes marcados → servicios incluidos en el paquete
    const servicios = Array.from(document.querySelectorAll('input[name="paq-servicio"]:checked'))
        .map(cb => cb.value);

    if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
    if (!precio_promocional || precio_promocional <= 0) {
        mostrarToast('Ingresa un precio promocional válido', 'error'); return;
    }
    // Verificar que la fecha de fin no sea anterior a la de inicio
    if (fecha_inicio && fecha_final && fecha_final < fecha_inicio) {
        mostrarToast('La fecha de fin no puede ser anterior a la de inicio', 'error'); return;
    }

    try {
        const url    = id ? `${API_BASE}/api/admin/paquetes/${id}` : `${API_BASE}/api/admin/paquetes`;
        const method = id ? 'PUT' : 'POST';
        const res    = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nombre, descripcion, precio_promocional, fecha_inicio, fecha_final, servicios })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast(id ? 'Paquete actualizado' : 'Paquete creado');
            cerrarModalPaquete();
            cargarPaquetesAdmin(); // refrescar tabla
        } else { mostrarToast(data.message || 'Error al guardar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}

// Pide confirmación y elimina el paquete (detalle_paquete se borra en cascada por FK)
async function eliminarPaquete(id, nombre) {
    if (!confirm(`¿Eliminar el paquete "${nombre}"?`)) return;
    try {
        const res  = await fetch(`${API_BASE}/api/admin/paquetes/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { mostrarToast('Paquete eliminado'); cargarPaquetesAdmin(); }
        else { mostrarToast(data.message || 'Error al eliminar', 'error'); }
    } catch { mostrarToast('Error de conexión', 'error'); }
}
