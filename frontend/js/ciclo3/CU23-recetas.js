// =============================================================================
// CU23-recetas.js — Gestionar Consumo por Servicio (Receta/Fórmula)
// Ciclo 3
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// cargarRecetasAdmin
// Carga la lista de todos los servicios activos con el estado de su receta.
// ─────────────────────────────────────────────────────────────────────────────
async function cargarRecetasAdmin() {
    const tbody = document.getElementById('tabla-recetas-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;padding:20px;">Cargando...</td></tr>';

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo3/servicios-receta`);
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#e74c3c;padding:20px;">${data.message}</td></tr>`;
            return;
        }

        if (!data.servicios.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;padding:20px;">No hay servicios activos.</td></tr>';
            return;
        }

        tbody.innerHTML = data.servicios.map(s => {
            const tieneReceta = Number(s.total_insumos) > 0;
            // Cada fila de "Registrar Consumo" tiene una celda con id único para mostrar el resultado inline
            const tdId = `consumo-resultado-${s.id_servicio}`;

            return `
                <tr>
                    <td style="padding:10px;">${s.nombre}</td>

                    <td style="padding:10px;text-align:center;">
                        ${tieneReceta
                            ? `<span style="color:#27ae60;font-weight:600;">${s.total_insumos} insumo${s.total_insumos > 1 ? 's' : ''}</span>`
                            : '<span style="color:#aaa;font-size:13px;">Sin receta</span>'}
                    </td>

                    <td style="padding:10px;text-align:center;">
                        <button onclick="abrirModalReceta(${s.id_servicio}, '${s.nombre.replace(/'/g, "\\'")}')"
                            class="btn-accion editar"
                            style="padding:5px 12px;font-size:13px;">
                            ${tieneReceta ? 'Editar Receta' : 'Crear Receta'}
                        </button>
                    </td>

                    <!-- Celda con botón + área para mostrar el resultado inline después de ejecutar -->
                    <td style="padding:10px;text-align:center;" id="${tdId}">
                        ${tieneReceta
                            ? `<button onclick="descontarConsumoServicio(${s.id_servicio}, '${tdId}')"
                                style="background:#8e44ad22;color:#8e44ad;border:none;border-radius:6px;
                                       padding:5px 12px;cursor:pointer;font-size:13px;font-weight:600;">
                                Registrar Consumo
                               </button>`
                            : '—'}
                    </td>
                </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#e74c3c;padding:20px;">Error de conexión.</td></tr>';
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// descontarConsumoServicio
// Llama al backend para descontar los insumos de la receta del stock.
// Muestra el resultado directamente en la celda (tdId) sin confirm() ni reload.
// ─────────────────────────────────────────────────────────────────────────────
async function descontarConsumoServicio(id_servicio, tdId) {
    // Mostrar "Procesando..." en la celda mientras espera la respuesta
    const celda = document.getElementById(tdId);
    if (celda) celda.innerHTML = '<span style="color:#888;font-size:12px;">Procesando...</span>';

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo3/consumo/descontar`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                id_servicio,
                ci_admin:     usuarioActual?.ci,
                nombre_admin: usuarioActual?.nombre,
                rol_admin:    usuarioActual?.rol
            })
        });
        const data = await res.json();

        if (data.success) {
            // Armar el resumen de lo que se descontó: "Acetona: -2, Esmalte: -1"
            const resumen = data.insumos.map(i => `${i.nombre_insumo}: -${i.cantidad}`).join(', ');

            // Mostrar el resultado inline en la celda (reemplaza el botón)
            if (celda) {
                celda.innerHTML = `
                    <div style="font-size:12px;color:#27ae60;font-weight:600;margin-bottom:4px;">
                        ✓ Descontado
                    </div>
                    <div style="font-size:11px;color:#555;line-height:1.4;">${resumen}</div>`;
            }
            mostrarToast(`Consumo registrado correctamente.`, 'success');
        } else {
            // Mostrar el error inline y restaurar el botón
            if (celda) {
                celda.innerHTML = `
                    <div style="font-size:12px;color:#e74c3c;margin-bottom:6px;">${data.message}</div>
                    <button onclick="descontarConsumoServicio(${id_servicio}, '${tdId}')"
                        style="background:#8e44ad22;color:#8e44ad;border:none;border-radius:6px;
                               padding:5px 12px;cursor:pointer;font-size:13px;font-weight:600;">
                        Reintentar
                    </button>`;
            }
            mostrarToast(data.message, 'error');
        }
    } catch {
        if (celda) celda.innerHTML = '<span style="color:#e74c3c;font-size:12px;">Error de conexión</span>';
        mostrarToast('Error de conexión.', 'error');
    }
}
