// =============================================================================
// CU-inventario.js — Modales de Compras y Recetas de Insumos
//
// ¿Qué hace este archivo?
//   Maneja los dos modales del inventario que aparecen en el Centro de Gestión:
//   1. modal-compra  → Registrar una compra de insumos (suma stock al inventario)
//   2. modal-receta  → Editar la receta de un servicio (qué insumos usa)
//
// ¿Cómo se usan?
//   - El botón "Registrar Compra" en el panel admin llama a abrirModalCompra()
//   - El botón "Editar Receta" en la pestaña Recetas llama a abrirModalReceta(id, nombre)
//
// Depende de:
//   main.js → API_BASE, mostrarToast
// =============================================================================


// =============================================================================
// MODAL COMPRA — Registrar una compra de insumos
// Suma la cantidad comprada al stock actual de cada insumo seleccionado.
// =============================================================================

// Abre el modal de compra y carga los insumos en el select
async function abrirModalCompra() {
    document.getElementById('modal-compra').classList.remove('seccion-oculta');
    // Limpiar la lista de items antes de abrir
    const lista = document.getElementById('compra-lista');
    if (lista) lista.innerHTML = '';
    await cargarInsumosCompra(); // llenar el select con todos los productos del inventario
}

// Cierra el modal de compra
function cerrarModalCompra() {
    document.getElementById('modal-compra').classList.add('seccion-oculta');
}

// Llena el select de insumos con todos los productos del inventario
async function cargarInsumosCompra() {
    const select = document.getElementById('compra-insumo-select');
    if (!select) return;
    try {
        const res  = await fetch(`${API_BASE}/api/inventario`);
        const data = await res.json();
        if (!data.success) return;

        select.innerHTML = '<option value="">-- Seleccionar insumo --</option>';
        // Un option por cada insumo: muestra nombre y stock actual entre paréntesis
        data.insumos.forEach(i => {
            const opt = document.createElement('option');
            opt.value       = i.id_producto;
            opt.textContent = `${i.nombre} (Stock: ${i.cantidad})`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Error cargando insumos para compra:', err);
    }
}

// Agrega un insumo a la lista temporal de la compra (aún no guarda en BD)
function agregarItemCompra() {
    const select   = document.getElementById('compra-insumo-select');
    const cantidad = document.getElementById('compra-cantidad')?.value;

    // Validar que se haya seleccionado insumo y cantidad
    if (!select?.value || !cantidad || Number(cantidad) <= 0) {
        mostrarToast('Selecciona un insumo y una cantidad válida', 'error');
        return;
    }

    const nombre = select.options[select.selectedIndex].text; // texto del option para mostrar
    const lista  = document.getElementById('compra-lista');

    // Crear una fila en la lista visual del modal
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid #eee;';
    div.innerHTML = `
        <span style="flex:1;">${nombre}</span>
        <span>Cant: ${cantidad}</span>
        <button type="button" onclick="this.parentElement.remove()"
            style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px;">✕</button>
        <!-- Campo oculto que guarda id_producto,cantidad para leerlo al guardar -->
        <input type="hidden" value="${select.value},${cantidad}">`;
    lista.appendChild(div);

    // Limpiar el select y cantidad para facilitar agregar el siguiente
    select.value = '';
    document.getElementById('compra-cantidad').value = '';
}

// Envía todos los items de la lista al backend para actualizar el stock
async function guardarCompra() {
    const lista = document.getElementById('compra-lista');
    const items = [];

    // Leer cada campo oculto de la lista (formato: "id_producto,cantidad")
    lista.querySelectorAll('input[type="hidden"]').forEach(h => {
        const [id, cant] = h.value.split(',');
        items.push({ id_producto: parseInt(id), cantidad: parseFloat(cant) });
    });

    if (!items.length) {
        mostrarToast('Agrega al menos un insumo', 'error');
        return;
    }

    try {
        const res  = await fetch(`${API_BASE}/api/compras`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ insumos: items })
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast('Stock actualizado correctamente.', 'success');
            cerrarModalCompra();
            // Si hay tabla de alertas abierta, recargarla para reflejar los cambios
            if (typeof cargarAlertasStock === 'function') cargarAlertasStock();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch {
        mostrarToast('Error de conexión.', 'error');
    }
}


// =============================================================================
// MODAL RECETA — Editar la receta de insumos de un servicio
// Una receta define qué insumos y en qué cantidad se usan al hacer ese servicio.
// =============================================================================

// Abre el modal de receta y carga los datos del servicio seleccionado
// idServicio  → id del servicio cuya receta se va a editar
// nombreServicio → nombre para mostrarlo en el título del modal
async function abrirModalReceta(idServicio, nombreServicio) {
    // Poner el id en el campo oculto para usarlo al guardar
    document.getElementById('receta-id-servicio').value    = idServicio;
    // Mostrar el nombre del servicio en el título del modal
    document.getElementById('receta-nombre-servicio').textContent = nombreServicio || 'Servicio';
    // Mostrar el modal (quitar la clase que lo ocultaba)
    document.getElementById('modal-receta').classList.remove('seccion-oculta');

    // Cargar los insumos disponibles en el select
    await cargarInsumosReceta();
    // Cargar los insumos que ya están en la receta actual
    await cargarRecetaActual(idServicio);
}

// Cierra el modal de receta
function cerrarModalReceta() {
    document.getElementById('modal-receta').classList.add('seccion-oculta');
}

// Llena el select del modal-receta con todos los productos del inventario
async function cargarInsumosReceta() {
    const select = document.getElementById('receta-insumo-select');
    if (!select) return;
    try {
        const res  = await fetch(`${API_BASE}/api/inventario`);
        const data = await res.json();
        if (!data.success) return;

        select.innerHTML = '<option value="">-- Seleccionar insumo --</option>';
        data.insumos.forEach(i => {
            const opt = document.createElement('option');
            opt.value       = i.id_producto;
            opt.textContent = i.nombre;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Error cargando insumos para receta:', err);
    }
}

// Carga los insumos que ya tiene la receta actual de ese servicio
async function cargarRecetaActual(idServicio) {
    const lista = document.getElementById('receta-lista');
    if (!lista) return;
    lista.innerHTML = '<p style="color:#999;font-size:13px;">Cargando...</p>';

    try {
        const res  = await fetch(`${API_BASE}/api/recetas/${idServicio}`);
        const data = await res.json();

        if (data.success && data.receta.length > 0) {
            lista.innerHTML = '';
            data.receta.forEach(r => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid #eee;';
                div.innerHTML = `
                    <span style="flex:1;">${r.nombre_insumo}</span>
                    <span>Cant: ${r.cantidad}</span>
                    <button type="button" onclick="this.parentElement.remove()"
                        style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px;">✕</button>
                    <input type="hidden" value="${r.id_producto},${r.cantidad}">`;
                lista.appendChild(div);
            });
        } else {
            lista.innerHTML = '<p style="color:#999;font-size:13px;">Sin receta configurada. Agrega insumos arriba.</p>';
        }
    } catch {
        lista.innerHTML = '<p style="color:#e74c3c;font-size:13px;">Error al cargar receta.</p>';
    }
}

// Agrega un insumo a la lista visual de la receta (aún no guarda en BD)
function agregarItemReceta() {
    const select   = document.getElementById('receta-insumo-select');
    const cantidad = document.getElementById('receta-cantidad')?.value;

    if (!select?.value || !cantidad || Number(cantidad) <= 0) {
        mostrarToast('Selecciona un insumo y una cantidad válida', 'error');
        return;
    }

    const nombre = select.options[select.selectedIndex].text;
    const lista  = document.getElementById('receta-lista');

    // Si la lista tenía solo el mensaje "Sin receta", limpiarlo
    if (lista.querySelector('p')) lista.innerHTML = '';

    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid #eee;';
    div.innerHTML = `
        <span style="flex:1;">${nombre}</span>
        <span>Cant: ${cantidad}</span>
        <button type="button" onclick="this.parentElement.remove()"
            style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px;">✕</button>
        <input type="hidden" value="${select.value},${cantidad}">`;
    lista.appendChild(div);

    // Limpiar el select y cantidad para el siguiente item
    select.value = '';
    document.getElementById('receta-cantidad').value = '';
}

// Guarda la receta completa en la BD (reemplaza la receta anterior)
async function guardarReceta() {
    const idServicio = document.getElementById('receta-id-servicio')?.value;
    const lista      = document.getElementById('receta-lista');
    const insumos    = [];

    // Leer todos los items de la lista visual
    lista.querySelectorAll('input[type="hidden"]').forEach(h => {
        const [id, cant] = h.value.split(',');
        insumos.push({ id_producto: parseInt(id), cantidad: parseFloat(cant) });
    });

    try {
        const res  = await fetch(`${API_BASE}/api/recetas`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_servicio: idServicio, insumos })
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast('Receta guardada correctamente.', 'success');
            cerrarModalReceta();
            // Si la tabla de recetas está visible, recargarla
            if (typeof cargarRecetasAdmin === 'function') cargarRecetasAdmin();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch {
        mostrarToast('Error de conexión.', 'error');
    }
}
