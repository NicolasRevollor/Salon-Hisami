// =============================================================================
// frontend/js/ciclo4/CU22-orden-compra.js — ÓRDENES DE COMPRA (Admin)
//
// Flujo (CU22):
//   1. Admin abre la pestaña → lista de órdenes existentes
//   2. "Nueva Orden" → modal con selector de proveedor, productos y cantidades
//   3. Al guardar → orden queda "pendiente"
//   4. "Recibir" → stock del inventario se actualiza, orden pasa a "recibida"
//   5. "Cancelar" → orden pasa a "cancelada" sin tocar stock
// =============================================================================

let _oc_items      = [];   // ítems temporales de la orden en construcción
let _oc_insumos    = [];   // caché del inventario (para el select de productos)
let _oc_proveedores= [];   // caché de proveedores


// =============================================================================
// CARGA INICIAL — lista de órdenes
// =============================================================================

async function cargarOrdenesCompra() {
    const cont = document.getElementById('oc-lista-contenedor');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#aaa;text-align:center;padding:30px;">Cargando…</p>';

    try {
        const resp = await fetch('/api/cu22/ordenes');
        const data = await resp.json();
        if (!data.success) {
            cont.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">${data.message}</p>`;
            return;
        }
        _renderizarTablaOrdenes(data.ordenes, cont);
    } catch (err) {
        cont.innerHTML = '<p style="color:#dc3545;text-align:center;padding:20px;">Error de conexión.</p>';
        console.error('cargarOrdenesCompra:', err);
    }
}

function _renderizarTablaOrdenes(ordenes, cont) {
    if (!ordenes.length) {
        cont.innerHTML = `
            <div class="dash-card" style="padding:50px 20px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">📦</div>
                <h4 style="color:#555;margin-bottom:8px;">Sin órdenes de compra</h4>
                <p style="color:#999;">Haz clic en <strong>+ Nueva Orden</strong> para registrar el primer reabastecimiento.</p>
            </div>`;
        return;
    }

    const filas = ordenes.map(o => {
        const estadoColor = o.estado === 'recibida' ? '#27ae60'
                          : o.estado === 'cancelada' ? '#95a5a6'
                          : '#e67e22';
        const estadoBadge = `<span style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${estadoColor}20;color:${estadoColor};">${o.estado}</span>`;

        const accionesBtns = o.estado === 'pendiente' ? `
            <button onclick="ocRecibirOrden(${o.id_orden})"
                style="padding:5px 12px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;margin-right:4px;">
                Recibir
            </button>
            <button onclick="ocCancelarOrden(${o.id_orden})"
                style="padding:5px 12px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;margin-right:4px;">
                Cancelar
            </button>` : '';

        return `
            <tr>
                <td style="font-weight:600;">#${o.id_orden}</td>
                <td>${o.nombre_proveedor || '<span style="color:#aaa;">Sin proveedor</span>'}</td>
                <td>${o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString('es-BO') : '—'}</td>
                <td>${o.fecha_entrega_esperada ? new Date(o.fecha_entrega_esperada + 'T12:00:00').toLocaleDateString('es-BO') : '—'}</td>
                <td style="font-weight:600;">$${parseFloat(o.monto_total).toFixed(2)}</td>
                <td>${estadoBadge}</td>
                <td>
                    ${accionesBtns}
                    <button onclick="ocVerDetalle(${o.id_orden})"
                        style="padding:5px 12px;background:#3498db;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
                        Ver
                    </button>
                </td>
            </tr>`;
    }).join('');

    cont.innerHTML = `
        <div class="admin-table-container dash-card" style="margin:0;">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Proveedor</th>
                        <th>Fecha Orden</th>
                        <th>Entrega Esperada</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}


// =============================================================================
// MODAL NUEVA ORDEN
// =============================================================================

async function ocAbrirModalNuevaOrden() {
    _oc_items = [];

    // Cargar inventario y proveedores en paralelo
    const [respInsumos, respProv] = await Promise.all([
        fetch('/api/inventario'),
        fetch('/api/cu22/proveedores')
    ]).catch(() => [null, null]);

    if (!respInsumos || !respProv) {
        mostrarToast('Error de conexión al cargar datos.', 'error');
        return;
    }

    const dataInsumos = await respInsumos.json();
    const dataProv    = await respProv.json();

    _oc_insumos     = dataInsumos.success ? dataInsumos.insumos     : [];
    _oc_proveedores = dataProv.success    ? dataProv.proveedores : [];

    const optsInsumos = _oc_insumos.map(i =>
        `<option value="${i.id_producto}" data-nombre="${i.nombre}" data-unidad="${i.unidad||''}">${i.nombre} (Stock: ${i.cantidad} ${i.unidad||''})</option>`
    ).join('');

    const optsProv = [
        '<option value="">— Sin proveedor asignado —</option>',
        ..._oc_proveedores.map(p =>
            `<option value="${p.id_proveedor}">${p.nombre}${p.telefono ? ' · ' + p.telefono : ''}</option>`
        )
    ].join('');

    const modal = document.getElementById('modal-oc-nueva');
    if (!modal) return;

    modal.querySelector('#oc-select-proveedor').innerHTML      = optsProv;
    modal.querySelector('#oc-select-producto').innerHTML       = `<option value="">— Seleccionar producto —</option>${optsInsumos}`;
    modal.querySelector('#oc-input-cantidad').value            = '';
    modal.querySelector('#oc-input-precio').value              = '';
    modal.querySelector('#oc-input-fecha-entrega').value       = '';
    modal.querySelector('#oc-input-notas').value               = '';
    _renderizarItemsOrden();

    modal.classList.remove('seccion-oculta');
}

function ocCerrarModalNuevaOrden() {
    document.getElementById('modal-oc-nueva')?.classList.add('seccion-oculta');
    _oc_items = [];
}

function ocAgregarItemOrden() {
    const select   = document.getElementById('oc-select-producto');
    const cantidad = parseFloat(document.getElementById('oc-input-cantidad')?.value);
    const precio   = parseFloat(document.getElementById('oc-input-precio')?.value || '0');

    if (!select?.value) {
        mostrarToast('Selecciona un producto.', 'error');
        return;
    }
    if (!cantidad || cantidad <= 0) {
        mostrarToast('Ingresa una cantidad válida.', 'error');
        return;
    }

    const opt    = select.options[select.selectedIndex];
    const nombre = opt.dataset.nombre || opt.text;

    // Evitar duplicado: si ya existe el producto, sumar cantidad
    const existente = _oc_items.find(i => i.id_producto === parseInt(select.value));
    if (existente) {
        existente.cantidad += cantidad;
        existente.precio_unitario = precio;
    } else {
        _oc_items.push({
            id_producto:     parseInt(select.value),
            nombre_producto: nombre,
            cantidad,
            precio_unitario: precio
        });
    }

    // Limpiar inputs
    select.value = '';
    document.getElementById('oc-input-cantidad').value = '';
    document.getElementById('oc-input-precio').value   = '';
    _renderizarItemsOrden();
}

function ocEliminarItemOrden(idx) {
    _oc_items.splice(idx, 1);
    _renderizarItemsOrden();
}

function _renderizarItemsOrden() {
    const cont = document.getElementById('oc-items-lista');
    if (!cont) return;

    if (!_oc_items.length) {
        cont.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:16px 0;">Agrega al menos un producto a la orden.</p>';
        document.getElementById('oc-total-display').textContent = '$0.00';
        return;
    }

    let total = 0;
    const filas = _oc_items.map((item, i) => {
        const subtotal = item.cantidad * item.precio_unitario;
        total += subtotal;
        return `
            <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #f0e8df;">
                <div style="flex:1;font-size:13px;font-weight:600;">${item.nombre_producto}</div>
                <div style="font-size:13px;color:#555;">Cant: ${item.cantidad}</div>
                <div style="font-size:13px;color:#555;min-width:80px;text-align:right;">$${subtotal.toFixed(2)}</div>
                <button onclick="ocEliminarItemOrden(${i})"
                    style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px;padding:0 4px;">✕</button>
            </div>`;
    }).join('');

    cont.innerHTML = filas;
    document.getElementById('oc-total-display').textContent = `$${total.toFixed(2)}`;
}

async function ocGuardarOrden() {
    if (!_oc_items.length) {
        mostrarToast('Agrega al menos un producto a la orden.', 'error');
        return;
    }

    const idProveedor    = document.getElementById('oc-select-proveedor')?.value || null;
    const fechaEntrega   = document.getElementById('oc-input-fecha-entrega')?.value || null;
    const notas          = document.getElementById('oc-input-notas')?.value || '';
    const ci_admin       = usuarioActual?.ci       || '';
    const nombre_admin   = usuarioActual?.nombre   || '';

    try {
        const resp = await fetch('/api/cu22/ordenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_proveedor: idProveedor || null,
                fecha_entrega_esperada: fechaEntrega || null,
                notas,
                ci_admin,
                nombre_admin,
                items: _oc_items
            })
        });
        const data = await resp.json();
        if (data.success) {
            mostrarToast(data.message, 'success');
            ocCerrarModalNuevaOrden();
            cargarOrdenesCompra();
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión.', 'error');
        console.error('ocGuardarOrden:', err);
    }
}


// =============================================================================
// ACCIONES SOBRE ÓRDENES
// =============================================================================

async function ocRecibirOrden(id) {
    if (!confirm(`¿Confirmar recepción de la orden #${id}? Se actualizará el stock del inventario.`))
        return;

    try {
        const resp = await fetch(`/api/cu22/ordenes/${id}/recibir`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ci_admin:     usuarioActual?.ci     || '',
                nombre_admin: usuarioActual?.nombre || ''
            })
        });
        const data = await resp.json();
        if (data.success) {
            mostrarToast(data.message, 'success');
            cargarOrdenesCompra();
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión.', 'error');
    }
}

async function ocCancelarOrden(id) {
    if (!confirm(`¿Cancelar la orden #${id}? Esta acción no afecta el inventario.`))
        return;

    try {
        const resp = await fetch(`/api/cu22/ordenes/${id}/cancelar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ci_admin:     usuarioActual?.ci     || '',
                nombre_admin: usuarioActual?.nombre || ''
            })
        });
        const data = await resp.json();
        if (data.success) {
            mostrarToast(data.message, 'success');
            cargarOrdenesCompra();
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión.', 'error');
    }
}

async function ocVerDetalle(id) {
    try {
        const resp = await fetch(`/api/cu22/ordenes/${id}/detalle`);
        const data = await resp.json();
        if (!data.success) {
            mostrarToast('Error al cargar detalle: ' + data.message, 'error');
            return;
        }

        const { orden, detalle } = data;
        const estadoColor = orden.estado === 'recibida' ? '#27ae60'
                          : orden.estado === 'cancelada' ? '#95a5a6'
                          : '#e67e22';

        const filasDetalle = detalle.map(d => `
            <tr>
                <td>${d.nombre_producto}</td>
                <td style="text-align:center;">${d.cantidad}</td>
                <td style="text-align:right;">$${parseFloat(d.precio_unitario).toFixed(2)}</td>
                <td style="text-align:right;font-weight:600;">$${parseFloat(d.subtotal).toFixed(2)}</td>
            </tr>`).join('');

        const modalDet = document.getElementById('modal-oc-detalle');
        if (!modalDet) return;

        modalDet.querySelector('#oc-det-titulo').textContent     = `Orden de Compra #${orden.id_orden}`;
        modalDet.querySelector('#oc-det-proveedor').textContent  = orden.nombre_proveedor || 'Sin proveedor';
        modalDet.querySelector('#oc-det-fecha').textContent      = new Date(orden.fecha_orden).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' });
        modalDet.querySelector('#oc-det-entrega').textContent    = orden.fecha_entrega_esperada
            ? new Date(orden.fecha_entrega_esperada + 'T12:00:00').toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' })
            : '—';
        modalDet.querySelector('#oc-det-estado').textContent     = orden.estado;
        modalDet.querySelector('#oc-det-estado').style.color     = estadoColor;
        modalDet.querySelector('#oc-det-admin').textContent      = orden.nombre_admin || '—';
        modalDet.querySelector('#oc-det-notas').textContent      = orden.notas || '—';
        modalDet.querySelector('#oc-det-tabla-body').innerHTML   = filasDetalle;
        modalDet.querySelector('#oc-det-total').textContent      = `$${parseFloat(orden.monto_total).toFixed(2)}`;

        modalDet.classList.remove('seccion-oculta');
    } catch (err) {
        mostrarToast('Error de conexión.', 'error');
        console.error('ocVerDetalle:', err);
    }
}

function ocCerrarModalDetalle() {
    document.getElementById('modal-oc-detalle')?.classList.add('seccion-oculta');
}


// =============================================================================
// GESTIÓN DE PROVEEDORES (modal simple)
// =============================================================================

async function ocAbrirModalProveedores() {
    const resp = await fetch('/api/cu22/proveedores').catch(() => null);
    if (!resp) { mostrarToast('Error de conexión.', 'error'); return; }
    const data = await resp.json();
    _oc_proveedores = data.success ? data.proveedores : [];

    const modal = document.getElementById('modal-oc-proveedores');
    if (!modal) return;

    _renderizarTablaProveedores(modal);
    modal.classList.remove('seccion-oculta');
}

function ocCerrarModalProveedores() {
    document.getElementById('modal-oc-proveedores')?.classList.add('seccion-oculta');
}

function _renderizarTablaProveedores(modal) {
    const cont = modal.querySelector('#oc-prov-lista');
    if (!cont) return;

    if (!_oc_proveedores.length) {
        cont.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;">Sin proveedores registrados.</p>';
        return;
    }

    const filas = _oc_proveedores.map(p => `
        <tr>
            <td style="font-weight:600;">${p.nombre}</td>
            <td>${p.contacto || '—'}</td>
            <td>${p.telefono || '—'}</td>
            <td>${p.email   || '—'}</td>
            <td>
                <button onclick="ocEliminarProveedor(${p.id_proveedor})"
                    style="padding:4px 10px;background:#e74c3c;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;">
                    Eliminar
                </button>
            </td>
        </tr>`).join('');

    cont.innerHTML = `
        <table class="admin-table" style="margin-top:12px;">
            <thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th></th></tr></thead>
            <tbody>${filas}</tbody>
        </table>`;
}

async function ocGuardarProveedor() {
    const nombre   = document.getElementById('oc-prov-nombre')?.value?.trim();
    const contacto = document.getElementById('oc-prov-contacto')?.value?.trim() || '';
    const telefono = document.getElementById('oc-prov-telefono')?.value?.trim() || '';
    const email    = document.getElementById('oc-prov-email')?.value?.trim()    || '';

    if (!nombre) { mostrarToast('El nombre del proveedor es obligatorio.', 'error'); return; }

    try {
        const resp = await fetch('/api/cu22/proveedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, contacto, telefono, email })
        });
        const data = await resp.json();
        if (data.success) {
            mostrarToast(data.message, 'success');
            _oc_proveedores.push(data.proveedor);
            document.getElementById('oc-prov-nombre').value    = '';
            document.getElementById('oc-prov-contacto').value  = '';
            document.getElementById('oc-prov-telefono').value  = '';
            document.getElementById('oc-prov-email').value     = '';
            _renderizarTablaProveedores(document.getElementById('modal-oc-proveedores'));
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión.', 'error');
    }
}

async function ocEliminarProveedor(id) {
    if (!confirm('¿Eliminar este proveedor? Las órdenes asociadas quedarán sin proveedor asignado.')) return;
    try {
        const resp = await fetch(`/api/cu22/proveedores/${id}`, { method: 'DELETE' });
        const data = await resp.json();
        if (data.success) {
            mostrarToast(data.message, 'success');
            _oc_proveedores = _oc_proveedores.filter(p => p.id_proveedor !== id);
            _renderizarTablaProveedores(document.getElementById('modal-oc-proveedores'));
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión.', 'error');
    }
}
