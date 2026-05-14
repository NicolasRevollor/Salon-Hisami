// =============================================================================
// CU18-privilegios.js — GESTIÓN DE PRIVILEGIOS DE USUARIO (panel admin)
// Ciclo 1 — Control de acceso y permisos por caso de uso
// Permite al admin activar/desactivar CUs y editar el detalle de cada privilegio.
// Cada toggle y cada input de detalle se guarda automáticamente al cambiar.
// BD: privilegios_usuario(ci_usuario, id_cu, habilitado, detalle)
//     casos_uso(id_cu, nombre, modulo, id_paquete_sist)
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

// Inyectar CSS de toggle switches y campos de detalle una sola vez al cargar
(function inyectarEstilosToggle() {
    if (document.getElementById('toggle-css')) return;
    const style = document.createElement('style');
    style.id = 'toggle-css';
    style.textContent = `
        .tog-switch { position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0; }
        .tog-switch input { opacity:0;width:0;height:0;position:absolute; }
        .tog-slider { position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
                      background:#ccc;border-radius:26px;transition:.3s; }
        .tog-slider:before { position:absolute;content:"";height:20px;width:20px;
                             left:3px;bottom:3px;background:white;border-radius:50%;transition:.3s; }
        .tog-switch input:checked + .tog-slider { background:#27ae60; }
        .tog-switch input:checked + .tog-slider:before { transform:translateX(20px); }
        .priv-fila { display:flex;align-items:center;gap:10px;padding:8px 12px;
                     border-bottom:1px solid #f0f0f0;font-size:14px;transition:background .15s;flex-wrap:wrap; }
        .priv-fila:hover { background:#fafafa; }
        .priv-nombre { flex:0 0 auto;min-width:160px; }
        .priv-detalle-input {
            flex:1;min-width:120px;max-width:300px;font-size:12px;
            border:none;border-bottom:1px solid #ddd;outline:none;
            background:transparent;color:#555;padding:2px 4px;font-family:inherit;
            transition:border-color .2s;
        }
        .priv-detalle-input:focus { border-bottom-color:var(--color-primario,#c4a882); }
        .priv-detalle-input::placeholder { color:#bbb; }
        .priv-saving { font-size:11px;color:#aaa;flex-shrink:0;opacity:0;transition:opacity .3s;min-width:70px; }
        .priv-saving.visible { opacity:1; }
    `;
    document.head.appendChild(style);
})();

// =============================================================================
// CARGAR PRIVILEGIOS
// Busca por CI, agrupa los CUs por paquete y renderiza cada uno con toggle + detalle.
// =============================================================================
async function cargarPrivilegiosAdmin() {
    const ci = document.getElementById('admin-buscar-ci').value.trim();
    if (!ci) { mostrarToast('Ingresa un CI para buscar', 'error'); return; }

    try {
        // Traer privilegios del usuario y catálogo de paquetes en paralelo
        const [resPriv, resPaq] = await Promise.all([
            fetch(`${API_BASE}/api/admin/privilegios/${ci}`),
            fetch(`${API_BASE}/api/admin/paquetes-sistema`)
        ]);
        const [dataPriv, dataPaq] = await Promise.all([resPriv.json(), resPaq.json()]);

        if (!dataPriv.success) { mostrarToast('Usuario no encontrado', 'error'); return; }

        // Mapa id_paquete_sist → nombre del paquete para los títulos de sección
        const mapaPaq = {};
        if (dataPaq.success) dataPaq.paquetes.forEach(p => { mapaPaq[p.id_paquete_sist] = p.nombre; });

        // Agrupar CUs por paquete del sistema
        const grupos = {};
        dataPriv.privilegios.forEach(p => {
            if (!grupos[p.id_paquete_sist]) grupos[p.id_paquete_sist] = [];
            grupos[p.id_paquete_sist].push(p);
        });

        const cont = document.getElementById('admin-privilegios-lista');
        cont.innerHTML = `<h4 style="margin-bottom:15px;">Privilegios para CI: <strong>${ci}</strong></h4>`;

        // Renderizar cada paquete como sección con sus CUs
        Object.entries(grupos).forEach(([idPaq, cus]) => {
            const sec = document.createElement('div');
            sec.style.cssText = 'margin-bottom:18px;';

            const titulo = document.createElement('p');
            titulo.style.cssText = 'font-weight:600;font-size:12px;text-transform:uppercase;color:var(--color-primario);margin-bottom:6px;letter-spacing:0.5px;';
            titulo.textContent = mapaPaq[idPaq] || 'Módulo ' + idPaq;
            sec.appendChild(titulo);

            cus.forEach(p => {
                const fila = document.createElement('div');
                fila.className = 'priv-fila';

                // Tag [modulo] pequeño junto al nombre del CU si existe
                const moduloTag = p.modulo
                    ? `<span style="font-size:11px;color:#aaa;margin-left:4px;">[${p.modulo}]</span>`
                    : '';

                fila.innerHTML = `
                    <label class="tog-switch">
                        <input type="checkbox" data-id-cu="${p.id_cu}" data-ci="${ci}"
                               ${p.tiene ? 'checked' : ''}>
                        <span class="tog-slider"></span>
                    </label>
                    <span class="priv-nombre">${p.nombre}${moduloTag}</span>
                    <input  class="priv-detalle-input"
                            id="detalle-${p.id_cu}"
                            type="text"
                            value="${(p.detalle || '').replace(/"/g, '&quot;')}"
                            placeholder="Agregar detalle...">
                    <span class="priv-saving" id="saving-${p.id_cu}">Guardando...</span>`;

                // Al cambiar el toggle: guarda habilitado + detalle actual juntos
                fila.querySelector('input[type="checkbox"]').addEventListener('change', function () {
                    const detalle = document.getElementById(`detalle-${p.id_cu}`)?.value || '';
                    guardarPrivilegio(ci, p.id_cu, this.checked, detalle, `saving-${p.id_cu}`);
                });

                // Al salir del campo detalle (blur) o presionar Enter: guarda el detalle
                const inputDetalle = fila.querySelector('.priv-detalle-input');
                inputDetalle.addEventListener('blur', function () {
                    const checked = fila.querySelector('input[type="checkbox"]').checked;
                    guardarPrivilegio(ci, p.id_cu, checked, this.value, `saving-${p.id_cu}`);
                });
                inputDetalle.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') { this.blur(); } // blur dispara el guardado
                });

                sec.appendChild(fila);
            });

            cont.appendChild(sec);
        });

    } catch (err) {
        console.error('Error cargando privilegios:', err);
        mostrarToast('Error de conexión', 'error');
    }
}

// =============================================================================
// GUARDAR PRIVILEGIO
// Guarda habilitado + detalle en el mismo POST. Muestra feedback visual en savingId.
// ci        → CI del usuario
// id_cu     → ID del caso de uso
// habilitado → true/false
// detalle   → texto libre de descripción del privilegio (puede ser vacío)
// savingId  → id del <span> donde mostrar "Guardando..." / "✓ Guardado"
// =============================================================================
async function guardarPrivilegio(ci, id_cu, habilitado, detalle, savingId) {
    const span = savingId ? document.getElementById(savingId) : null;
    if (span) { span.textContent = 'Guardando...'; span.style.color = '#aaa'; span.classList.add('visible'); }

    try {
        const res  = await fetch(API_BASE + '/api/admin/privilegios', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ci_usuario: ci, id_cu, habilitado, detalle: detalle || null })
        });
        const data = await res.json();

        if (data.success) {
            if (span) {
                span.textContent = '✓ Guardado';
                span.style.color = '#27ae60';
                setTimeout(() => span.classList.remove('visible'), 1500);
            }
        } else {
            mostrarToast('Error al actualizar privilegio', 'error');
            if (span) span.classList.remove('visible');
        }
    } catch {
        mostrarToast('Error de conexión', 'error');
        if (span) span.classList.remove('visible');
    }
}

// Alias para compatibilidad con código existente que llame a togglePrivilegio
function togglePrivilegio(ci, id_cu, habilitado, savingId) {
    const detalle = document.getElementById(`detalle-${id_cu}`)?.value || '';
    guardarPrivilegio(ci, id_cu, habilitado, detalle, savingId);
}
