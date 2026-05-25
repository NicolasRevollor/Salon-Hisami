// =============================================================================
// CU14-kit-personal.js — Gestionar Kit Personal de Esteticista
// Ciclo 3
// =============================================================================

// Lista temporal de insumos del kit mientras el admin los edita (antes de guardar).
let kitItems = [];

// Guarda los datos del inventario (id → {nombre, cantidad, unidad, disponible}).
// "disponible" se reduce visualmente cada vez que el admin agrega un ítem al kit,
// así el select siempre muestra el stock restante en tiempo real.
let inventarioKitData = {};


// ─────────────────────────────────────────────────────────────────────────────
// buscarKitEmpleado
// Busca el kit actual de la esteticista y dibuja el formulario de edición.
// ─────────────────────────────────────────────────────────────────────────────
async function buscarKitEmpleado() {
    const ci = document.getElementById('kit-buscar-ci')?.value.trim();
    if (!ci) { mostrarToast('Ingresa el CI del empleado', 'error'); return; }

    const contenedor = document.getElementById('kit-resultado');
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Buscando...</p>';
    kitItems          = [];
    inventarioKitData = {};

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo3/kit/${ci}`);
        const data = await res.json();

        if (!data.success) {
            contenedor.innerHTML = `<p style="color:#e74c3c;text-align:center;padding:20px;">${data.message}</p>`;
            return;
        }

        // Cargar el kit actual en kitItems
        kitItems = data.kit.map(k => ({
            id_producto:   Number(k.id_producto),
            cantidad:      Number(k.cantidad),
            nombre_insumo: k.nombre_insumo,
            unidad:        k.unidad || '',
            stock_actual:  Number(k.stock_actual)
        }));

        // Dibujar la estructura del formulario
        contenedor.innerHTML = `
            <p style="font-size:15px;font-weight:600;color:var(--texto-oscuro);margin-bottom:15px;">
                ${data.nombre_empleado} &nbsp;·&nbsp;
                <span style="font-weight:400;color:#888;">CI: ${ci}</span>
            </p>
            <input type="hidden" id="kit-ci-actual" value="${ci}">

            <!-- Selector de insumo + cantidad + botón agregar -->
            <div style="display:flex;gap:10px;margin-bottom:6px;flex-wrap:wrap;align-items:flex-end;">
                <div style="flex:1;min-width:160px;">
                    <select id="kit-insumo-select" onchange="mostrarStockKitInsumo()"
                        style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;font-family:inherit;">
                        <option value="">-- Selecciona insumo --</option>
                    </select>
                </div>
                <input type="number" id="kit-cantidad" placeholder="Cantidad" min="0.1" step="0.1"
                    style="width:90px;padding:10px;border:1px solid #ccc;border-radius:6px;">
                <button class="btn-nueva-reserva" onclick="agregarItemKit()">+ Agregar</button>
            </div>

            <!-- Indicador de stock del insumo seleccionado (se llena con onchange del select) -->
            <div id="kit-stock-info" style="min-height:22px;margin-bottom:12px;font-size:13px;"></div>

            <!-- Tabla del kit: se actualiza en tiempo real con renderizarKitLista() -->
            <div id="kit-lista" style="min-height:80px;margin-bottom:15px;"></div>

            <button class="btn-registrarse" style="width:100%;" onclick="guardarKit()">
                Guardar Kit
            </button>`;

        // Mostrar la lista de insumos actuales del kit
        renderizarKitLista();

        // Llenar el select con los productos del inventario y guardar sus datos en inventarioKitData
        await cargarInsumosEnSelectKit();
    } catch {
        contenedor.innerHTML = '<p style="color:#e74c3c;text-align:center;padding:20px;">Error de conexión.</p>';
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// cargarInsumosEnSelectKit
// Pide todos los insumos del inventario y los carga en el select.
// También guarda los datos en inventarioKitData para validar cantidades.
// ─────────────────────────────────────────────────────────────────────────────
async function cargarInsumosEnSelectKit() {
    const select = document.getElementById('kit-insumo-select');
    if (!select) return;
    try {
        const res  = await fetch(`${API_BASE}/api/inventario`);
        const data = await res.json();
        if (!data.success) return;

        // Guardar datos de cada insumo en el mapa global
        // "disponible" parte desde el stock actual y se reduce al agregar ítems al kit
        inventarioKitData = {};
        data.insumos.forEach(i => {
            // Calcular cuánto ya fue asignado en el kit actual para descontarlo del disponible
            const yaEnKit = kitItems.find(k => k.id_producto === Number(i.id_producto));
            const usado   = yaEnKit ? yaEnKit.cantidad : 0;
            inventarioKitData[i.id_producto] = {
                nombre:     i.nombre,
                unidad:     i.unidad || '',
                stock:      Number(i.cantidad),        // stock total en inventario
                disponible: Number(i.cantidad) - usado // stock restante después del kit actual
            };

            const opt = document.createElement('option');
            opt.value       = i.id_producto;
            opt.textContent = `${i.nombre} — Stock: ${i.cantidad} ${i.unidad || ''}`;
            select.appendChild(opt);
        });
    } catch { /* silencioso */ }
}


// ─────────────────────────────────────────────────────────────────────────────
// mostrarStockKitInsumo
// Se llama cuando el admin cambia la selección del select.
// Muestra cuánto stock hay disponible del insumo seleccionado.
// ─────────────────────────────────────────────────────────────────────────────
function mostrarStockKitInsumo() {
    const select    = document.getElementById('kit-insumo-select');
    const infoDiv   = document.getElementById('kit-stock-info');
    if (!select || !infoDiv) return;

    const id   = Number(select.value);
    const info = inventarioKitData[id];

    if (!id || !info) {
        infoDiv.innerHTML = '';
        return;
    }

    // Colores: rojo si sin stock, naranja si poco (≤5), verde si hay suficiente
    const color = info.disponible <= 0  ? '#e74c3c'
                : info.disponible <= 5  ? '#f39c12'
                : '#27ae60';

    infoDiv.innerHTML = `
        <span style="color:${color};font-weight:600;">
            Stock disponible: ${info.disponible} ${info.unidad}
        </span>
        ${info.disponible <= 0
            ? ' &nbsp;<span style="color:#e74c3c;font-size:12px;">(Sin stock — no se puede agregar)</span>'
            : ''}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// agregarItemKit
// Agrega un insumo al kit temporal validando que no exceda el stock disponible.
// ─────────────────────────────────────────────────────────────────────────────
function agregarItemKit() {
    const select    = document.getElementById('kit-insumo-select');
    const cantInput = document.getElementById('kit-cantidad');
    const id        = Number(select?.value);
    const cant      = Number(cantInput?.value);

    if (!id)              { mostrarToast('Selecciona un insumo', 'error'); return; }
    if (!cant || cant <= 0) { mostrarToast('Ingresa una cantidad válida', 'error'); return; }

    const info = inventarioKitData[id];
    if (!info) { mostrarToast('Insumo no encontrado', 'error'); return; }

    // No permitir agregar más de lo que hay en stock
    if (cant > info.stock) {
        mostrarToast(`Stock insuficiente. Disponible: ${info.disponible} ${info.unidad}`, 'error');
        return;
    }

    // Si el insumo ya está en el kit, actualizar su cantidad
    const existente = kitItems.find(k => k.id_producto === id);
    if (existente) {
        // Devolver la cantidad anterior al disponible antes de reemplazarla
        info.disponible += existente.cantidad;
        existente.cantidad = cant;
    } else {
        kitItems.push({
            id_producto:   id,
            cantidad:      cant,
            nombre_insumo: info.nombre,
            unidad:        info.unidad,
            stock_actual:  info.stock
        });
    }

    // Reducir el stock disponible en el mapa para reflejar lo que se acaba de asignar
    info.disponible -= cant;
    if (info.disponible < 0) info.disponible = 0;

    // Limpiar los inputs
    cantInput.value = '';
    select.value    = '';
    document.getElementById('kit-stock-info').innerHTML = ''; // limpiar indicador

    // Actualizar el texto del option en el select para mostrar el stock restante
    const opt = select.querySelector(`option[value="${id}"]`);
    if (opt) opt.textContent = `${info.nombre} — Stock disponible: ${info.disponible} ${info.unidad}`;

    renderizarKitLista();
}


// ─────────────────────────────────────────────────────────────────────────────
// eliminarItemKit
// Quita un insumo del kit y devuelve su cantidad al stock disponible del select.
// ─────────────────────────────────────────────────────────────────────────────
function eliminarItemKit(id_producto) {
    const item = kitItems.find(k => k.id_producto === id_producto);
    if (item && inventarioKitData[id_producto]) {
        // Devolver la cantidad al stock disponible al quitar el ítem
        inventarioKitData[id_producto].disponible += item.cantidad;
        // Actualizar el texto del option en el select
        const select = document.getElementById('kit-insumo-select');
        const opt    = select?.querySelector(`option[value="${id_producto}"]`);
        const info   = inventarioKitData[id_producto];
        if (opt) opt.textContent = `${info.nombre} — Stock disponible: ${info.disponible} ${info.unidad}`;
    }
    kitItems = kitItems.filter(k => k.id_producto !== id_producto);
    renderizarKitLista();
}


// ─────────────────────────────────────────────────────────────────────────────
// renderizarKitLista
// Dibuja la tabla completa de insumos del kit con stock actual visible.
// ─────────────────────────────────────────────────────────────────────────────
function renderizarKitLista() {
    const lista = document.getElementById('kit-lista');
    if (!lista) return;

    if (!kitItems.length) {
        lista.innerHTML = '<p style="text-align:center;color:#aaa;padding:15px;">El kit está vacío. Agrega insumos usando el selector de arriba.</p>';
        return;
    }

    lista.innerHTML = `
        <div style="font-size:13px;color:#555;margin-bottom:6px;font-weight:600;">
            Insumos en el kit (${kitItems.length}):
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
                <tr style="background:#f5f0eb;">
                    <th style="padding:9px 10px;text-align:left;border-bottom:2px solid #e0d5c8;">Insumo</th>
                    <th style="padding:9px 10px;text-align:center;border-bottom:2px solid #e0d5c8;">Cantidad Kit</th>
                    <th style="padding:9px 10px;text-align:center;border-bottom:2px solid #e0d5c8;">Stock Total</th>
                    <th style="padding:9px 10px;text-align:center;border-bottom:2px solid #e0d5c8;"></th>
                </tr>
            </thead>
            <tbody>
                ${kitItems.map(k => {
                    // Mostrar el stock actual si lo tenemos; si no, mostrar "—"
                    const stockTexto = (k.stock_actual !== undefined && k.stock_actual !== null)
                        ? `${k.stock_actual} ${k.unidad}`
                        : '—';
                    // Color de alerta si la cantidad del kit supera el stock
                    const alerta = k.stock_actual < k.cantidad
                        ? 'color:#e74c3c;font-weight:600;' : 'color:#27ae60;';

                    return `<tr style="border-bottom:1px solid #f0eae0;">
                        <td style="padding:9px 10px;">${k.nombre_insumo}</td>
                        <td style="padding:9px 10px;text-align:center;font-weight:600;">
                            ${k.cantidad} ${k.unidad}
                        </td>
                        <td style="padding:9px 10px;text-align:center;${alerta}">
                            ${stockTexto}
                        </td>
                        <td style="padding:9px 10px;text-align:center;">
                            <button onclick="eliminarItemKit(${k.id_producto})"
                                style="background:#e74c3c22;color:#e74c3c;border:none;border-radius:4px;
                                       padding:4px 10px;cursor:pointer;font-size:12px;">
                                Quitar
                            </button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// guardarKit
// Manda el kit completo al backend para guardarlo en la BD.
// ─────────────────────────────────────────────────────────────────────────────
async function guardarKit() {
    const ci = document.getElementById('kit-ci-actual')?.value;
    if (!ci) return;

    const body = {
        ci_empleado:  ci,
        items:        kitItems.map(k => ({ id_producto: k.id_producto, cantidad: k.cantidad })),
        ci_admin:     usuarioActual?.ci,
        nombre_admin: usuarioActual?.nombre,
        rol_admin:    usuarioActual?.rol
    };

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo3/kit`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });
        const data = await res.json();
        mostrarToast(data.message || (data.success ? 'Kit guardado.' : 'Error.'), data.success ? 'success' : 'error');
    } catch {
        mostrarToast('Error de conexión.', 'error');
    }
}
