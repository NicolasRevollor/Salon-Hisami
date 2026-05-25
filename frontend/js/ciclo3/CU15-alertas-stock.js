// =============================================================================
// CU15-alertas-stock.js — Monitorear Alertas de Stock
// Ciclo 3
//
// ¿Qué hace este archivo?
//   Muestra una tabla con todos los productos del inventario que tienen
//   stock igual o menor al mínimo configurado (están por agotarse o ya se agotaron).
//   También permite al admin ajustar el stock mínimo de cada producto
//   directamente desde la tabla.
//
// ¿Cómo funciona?
//   1. Al entrar a la pestaña "Alertas Stock", se llama cargarAlertasStock()
//   2. Pide al backend los productos con poco stock
//   3. Muestra cada producto con: cantidad actual, unidad, mínimo, nivel de alerta
//   4. Para cada producto hay un input para cambiar el mínimo y un botón "Guardar"
//   5. Si el admin cambia el mínimo y presiona "Guardar" → actualizarStockMinimo()
//
// Niveles de alerta visuales:
//   Rojo intenso → sin stock (cantidad = 0)
//   Naranja       → stock bajo (cantidad > 0 pero <= mínimo)
//
// Depende de:
//   main.js → API_BASE, mostrarToast
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// cargarAlertasStock
// Pide al backend los productos con poco stock y los muestra en la tabla.
// Se llama automáticamente al entrar a la pestaña "Alertas Stock".
// ─────────────────────────────────────────────────────────────────────────────
async function cargarAlertasStock() {
    const tbody = document.getElementById('tabla-alertas-body');
    if (!tbody) return;

    // Mostrar mensaje de carga mientras esperamos la respuesta
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Cargando alertas...</td></tr>';

    try {
        // GET al backend para traer los productos en alerta
        const res  = await fetch(`${API_BASE}/api/ciclo3/alertas-stock`);
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#e74c3c;padding:20px;">${data.message}</td></tr>`;
            return;
        }

        // Actualizar el resumen que aparece arriba de la tabla
        const resumen = document.getElementById('alertas-resumen');
        if (resumen) {
            // Contar cuántos tienen stock = 0 (crítico) vs stock bajo
            const criticos = data.alertas.filter(a => Number(a.cantidad) === 0).length;
            const total    = data.alertas.length;

            resumen.innerHTML = total === 0
                // Todo bien: ningún producto está en alerta
                ? '<span style="color:#27ae60;font-weight:600;">✓ Todos los productos tienen stock suficiente.</span>'
                // Hay productos en alerta: mostrar cuántos y cuántos son críticos
                : `<span style="color:#e74c3c;font-weight:600;">⚠ ${total} producto${total > 1 ? 's' : ''} con stock bajo</span>
                   ${criticos ? `&nbsp;·&nbsp;<span style="color:#c0392b;font-weight:600;">${criticos} sin stock</span>` : ''}`;
        }

        // Si no hay alertas, mostrar mensaje positivo
        if (!data.alertas.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#27ae60;padding:20px;">Sin alertas. Todo el inventario está bien abastecido.</td></tr>';
            return;
        }

        // Dibujar una fila por cada producto en alerta
        tbody.innerHTML = data.alertas.map(a => {
            // Calcular el porcentaje de stock respecto al mínimo (para la barra visual)
            const pct = a.stock_minimo > 0 ? Math.round((a.cantidad / a.stock_minimo) * 100) : 0;

            // Determinar si es crítico (sin stock) o solo bajo
            const critico = Number(a.cantidad) === 0;
            const color   = critico ? '#e74c3c' : '#f39c12'; // rojo o naranja
            const nivel   = critico ? 'Sin stock' : 'Stock bajo';

            return `
                <tr>
                    <!-- Nombre del producto -->
                    <td style="padding:10px;">${a.nombre}</td>

                    <!-- Cantidad actual en rojo/naranja para que llame la atención -->
                    <td style="padding:10px;text-align:center;">
                        <span style="font-weight:700;color:${color};">${a.cantidad}</span>
                    </td>

                    <!-- Unidad de medida (ml, gr, unidades...) -->
                    <td style="padding:10px;text-align:center;">${a.unidad || '—'}</td>

                    <!-- Mínimo configurado actualmente -->
                    <td style="padding:10px;text-align:center;">${a.stock_minimo}</td>

                    <!-- Badge de estado + barra visual de progreso -->
                    <td style="padding:10px;text-align:center;">
                        <span style="display:inline-block;padding:3px 10px;border-radius:12px;
                                     background:${color}22;color:${color};font-size:12px;font-weight:600;">
                            ${nivel}
                        </span>
                        <!-- Barra que muestra visualmente cuánto stock hay vs el mínimo -->
                        <div style="background:#eee;border-radius:4px;height:6px;margin-top:5px;width:80px;display:inline-block;vertical-align:middle;">
                            <div style="background:${color};height:6px;border-radius:4px;width:${Math.min(pct,100)}%;"></div>
                        </div>
                    </td>

                    <!-- Input para que el admin cambie el mínimo + botón guardar -->
                    <td style="padding:10px;text-align:center;">
                        <!-- id="minimo-{id}" para leer el valor en actualizarStockMinimo -->
                        <input type="number" id="minimo-${a.id_producto}" value="${a.stock_minimo}" min="0"
                               style="width:60px;padding:4px;border:1px solid #ccc;border-radius:4px;text-align:center;">
                        <button onclick="actualizarStockMinimo(${a.id_producto})"
                            style="margin-left:6px;background:#2980b922;color:#2980b9;border:none;
                                   border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;">
                            Guardar
                        </button>
                    </td>
                </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#e74c3c;padding:20px;">Error de conexión.</td></tr>';
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// actualizarStockMinimo
// Guarda el nuevo valor mínimo de un producto específico en la BD.
// Se llama al presionar "Guardar" en la columna "Ajustar Mínimo" de la tabla.
// id_producto → el ID del producto cuyo mínimo se quiere cambiar
// ─────────────────────────────────────────────────────────────────────────────
async function actualizarStockMinimo(id_producto) {
    // Leer el valor del input de ese producto (el id del input es "minimo-{id_producto}")
    const val = Number(document.getElementById(`minimo-${id_producto}`)?.value);

    // Validar que el valor sea un número válido y no negativo
    if (isNaN(val) || val < 0) { mostrarToast('Valor inválido', 'error'); return; }

    try {
        // PUT al backend para actualizar el mínimo de ese producto
        const res  = await fetch(`${API_BASE}/api/ciclo3/stock-minimo`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_producto, stock_minimo: val })
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast('Mínimo actualizado.', 'success');
            // Recargar la tabla para que el cambio se refleje inmediatamente
            cargarAlertasStock();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch {
        mostrarToast('Error de conexión.', 'error');
    }
}
