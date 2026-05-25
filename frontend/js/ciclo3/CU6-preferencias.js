// =============================================================================
// CU6-preferencias.js — Registro de Preferencias y Seguimiento de Estilo
// Ciclo 3
// =============================================================================


async function buscarPreferenciasCliente() {
    const ci = document.getElementById('pref-buscar-ci')?.value.trim();
    if (!ci) { mostrarToast('Ingresa el CI del cliente', 'error'); return; }

    const contenedor = document.getElementById('pref-resultado');
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Buscando...</p>';

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo3/preferencias/${ci}`);
        const data = await res.json();

        if (!data.success) {
            contenedor.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">${data.message}</p>`;
            return;
        }

        const d = data.data;

        contenedor.innerHTML = `
            <div style="padding:15px 0;">
                <p style="font-size:15px;font-weight:600;color:var(--texto-oscuro);margin-bottom:20px;">
                    ${d.nombre} &nbsp;·&nbsp;
                    <span style="font-weight:400;color:#888;">CI: ${d.ci}</span>
                    &nbsp;·&nbsp;
                    <span style="font-weight:400;color:#888;">${d.email || '—'}</span>
                </p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                    <div class="input-group">
                        <label>Color de Cabello</label>
                        <input type="text" id="pref-color"
                               value="${d.color_cabello || ''}"
                               placeholder="Ej: Castaño oscuro, Rubio...">
                    </div>
                    <div class="input-group">
                        <label>Largo</label>
                        <select id="pref-largo" style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
                            <option value="">-- Selecciona --</option>
                            <option value="Corto"   ${d.largo === 'Corto'   ? 'selected' : ''}>Corto</option>
                            <option value="Mediano" ${d.largo === 'Mediano' ? 'selected' : ''}>Mediano</option>
                            <option value="Largo"   ${d.largo === 'Largo'   ? 'selected' : ''}>Largo</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Estilo Preferido</label>
                        <input type="text" id="pref-estilo"
                               value="${d.estilo || ''}"
                               placeholder="Ej: Natural, Ondulado, Liso...">
                    </div>
                    <div class="input-group">
                        <label>Última actualización</label>
                        <input type="text" value="${d.updated_at ? formatearFecha(d.updated_at) : 'Sin registro previo'}"
                               disabled style="color:#999;">
                    </div>
                </div>

                <div class="input-group" style="margin-top:10px;">
                    <label>Notas especiales</label>
                    <textarea id="pref-notas" rows="3"
                        style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;
                               font-family:inherit;resize:vertical;"
                        placeholder="Ej: alergia a tinturas, prefiere corte específico...">${d.notas || ''}</textarea>
                </div>

                <input type="hidden" id="pref-ci-actual" value="${d.ci}">

                <button class="btn-registrarse" style="margin-top:15px;width:100%;"
                        onclick="guardarPreferencias()">
                    Guardar Preferencias
                </button>
            </div>`;

        // Cargar historial completo debajo del formulario
        await cargarHistorialPreferencias(d.ci);

    } catch {
        contenedor.innerHTML = '<p style="color:#e74c3c;text-align:center;padding:20px;">Error de conexión.</p>';
    }
}


async function guardarPreferencias() {
    const ci = document.getElementById('pref-ci-actual')?.value;
    if (!ci) return;

    const body = {
        color_cabello: document.getElementById('pref-color')?.value.trim()  || null,
        largo:         document.getElementById('pref-largo')?.value         || null,
        estilo:        document.getElementById('pref-estilo')?.value.trim() || null,
        notas:         document.getElementById('pref-notas')?.value.trim()  || null,
        ci_admin:      usuarioActual?.ci,
        nombre_admin:  usuarioActual?.nombre,
        rol_admin:     usuarioActual?.rol
    };

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo3/preferencias/${ci}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast('Preferencias guardadas exitosamente.', 'success');
            // Recargar historial para mostrar el nuevo registro
            await cargarHistorialPreferencias(ci);
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch {
        mostrarToast('Error de conexión.', 'error');
    }
}


// Carga y muestra TODOS los registros históricos del cliente debajo del formulario
async function cargarHistorialPreferencias(ci) {
    const contenedor = document.getElementById('pref-resultado');
    if (!contenedor) return;

    // Eliminar historial anterior si existía
    const anterior = contenedor.querySelector('#pref-historial');
    if (anterior) anterior.remove();

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo3/historial-preferencias/${ci}`);
        const data = await res.json();

        if (!data.success || !data.historial.length) return;

        const campo = (etiqueta, valor) => valor
            ? `<span style="font-size:12px;color:#555;"><strong>${etiqueta}:</strong> ${valor}</span>`
            : '';

        const tarjetas = data.historial.map((h, idx) => {
            const esPrimero = idx === 0;
            const fecha = new Date(h.guardado_at).toLocaleString('es-BO', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const campos = [
                campo('Color', h.color_cabello),
                campo('Largo', h.largo),
                campo('Estilo', h.estilo),
                campo('Notas', h.notas)
            ].filter(Boolean).join(' &nbsp;·&nbsp; ');

            return `
                <div style="
                    padding:10px 14px;
                    border-left: 3px solid ${esPrimero ? '#27ae60' : '#ddd'};
                    background: ${esPrimero ? '#f9fffe' : '#fafafa'};
                    border-radius:0 6px 6px 0;
                    margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-size:12px;font-weight:600;color:${esPrimero ? '#27ae60' : '#999'};">
                            ${esPrimero ? 'Ultimo guardado' : `Registro #${data.historial.length - idx}`}
                        </span>
                        <span style="font-size:11px;color:#aaa;">${fecha}</span>
                    </div>
                    <div style="line-height:1.8;">${campos || '<span style="font-size:12px;color:#bbb;font-style:italic;">Sin datos registrados</span>'}</div>
                </div>`;
        }).join('');

        const seccion = document.createElement('div');
        seccion.id = 'pref-historial';
        seccion.style.cssText = 'margin-top:20px;';
        seccion.innerHTML = `
            <div style="font-size:13px;font-weight:600;color:#555;margin-bottom:10px;
                        padding-bottom:6px;border-bottom:1px solid #eee;">
                Historial de preferencias (${data.historial.length} registro${data.historial.length !== 1 ? 's' : ''})
            </div>
            ${tarjetas}`;

        contenedor.appendChild(seccion);
        seccion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch { /* silencioso */ }
}
