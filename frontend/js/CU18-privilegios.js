// =============================================================================
// CU18-privilegios.js — GESTIÓN DE PRIVILEGIOS DE USUARIO (panel admin)
// Permite al admin activar o desactivar CUs para cualquier usuario.
// Cada toggle se guarda automáticamente al cambiar (sin botón "Guardar Cambios").
// =============================================================================

// Inyectar CSS de toggle switches una sola vez en el documento
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
        .priv-fila { display:flex;align-items:center;gap:14px;padding:9px 12px;
                     border-bottom:1px solid #f0f0f0;font-size:14px;transition:background .15s; }
        .priv-fila:hover { background:#fafafa; }
        .priv-saving { font-size:11px;color:#aaa;margin-left:auto;opacity:0;transition:opacity .3s; }
        .priv-saving.visible { opacity:1; }
    `;
    document.head.appendChild(style);
})();

// Busca los privilegios del usuario por CI y los renderiza con toggle switches.
async function cargarPrivilegiosAdmin() {
    const ci = document.getElementById('admin-buscar-ci').value.trim();
    if (!ci) { mostrarToast('Ingresa un CI para buscar', 'error'); return; }

    try {
        const [resPriv, resPaq] = await Promise.all([
            fetch(`${API_BASE}/api/admin/privilegios/${ci}`),
            fetch(`${API_BASE}/api/admin/paquetes-sistema`)
        ]);
        const [dataPriv, dataPaq] = await Promise.all([resPriv.json(), resPaq.json()]);

        if (!dataPriv.success) { mostrarToast('Usuario no encontrado', 'error'); return; }

        const mapaPaq = {};
        if (dataPaq.success) dataPaq.paquetes.forEach(p => { mapaPaq[p.id_paquete_sist] = p.nombre; });

        const grupos = {};
        dataPriv.privilegios.forEach(p => {
            if (!grupos[p.id_paquete_sist]) grupos[p.id_paquete_sist] = [];
            grupos[p.id_paquete_sist].push(p);
        });

        const cont = document.getElementById('admin-privilegios-lista');
        cont.innerHTML = `<h4 style="margin-bottom:15px;">Privilegios para CI: <strong>${ci}</strong></h4>`;

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
                fila.innerHTML = `
                    <label class="tog-switch">
                        <input type="checkbox" data-id-cu="${p.id_cu}" data-ci="${ci}"
                               ${p.tiene ? 'checked' : ''}>
                        <span class="tog-slider"></span>
                    </label>
                    <span>${p.nombre_cu}</span>
                    <span class="priv-saving" id="saving-${p.id_cu}">Guardando...</span>`;

                // Auto-guardar al cambiar el toggle
                fila.querySelector('input[type="checkbox"]').addEventListener('change', function () {
                    togglePrivilegio(this.dataset.ci, this.dataset.idCu, this.checked, `saving-${p.id_cu}`);
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

// Guarda un privilegio individual inmediatamente al cambiar el toggle.
// savingId → id del <span> que muestra "Guardando..." / "✓ Guardado"
async function togglePrivilegio(ci, id_cu, habilitado, savingId) {
    const span = savingId ? document.getElementById(savingId) : null;
    if (span) { span.textContent = 'Guardando...'; span.style.color = '#aaa'; span.classList.add('visible'); }

    try {
        const res  = await fetch(API_BASE + '/api/admin/privilegios', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ci_usuario: ci, id_cu, habilitado })
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
