// =============================================================================
// frontend/js/ciclo4/CU5-factura.js — EMITIR FACTURA (Admin) + MIS FACTURAS (Cliente)
//
// Funciones del administrador:
//   cargarPagosFacturables()     → carga la tabla de pagos con estado de factura
//   abrirModalFactura(datos)     → abre el modal pre-llenado con datos del pago
//   confirmarEmitirFactura()     → envía la factura al backend y refresca la tabla
//
// Funciones del cliente:
//   cargarMisFacturas()          → carga las facturas emitidas del cliente en su panel
//   descargarFacturaPDF(factura) → genera y descarga la factura como PDF con jsPDF
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — TABLA DE PAGOS PARA FACTURAR
// ─────────────────────────────────────────────────────────────────────────────

// Carga todos los pagos con Stripe y muestra si tienen factura emitida o no
async function cargarPagosFacturables() {
    const tbody = document.getElementById('tabla-facturas-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">Cargando...</td></tr>`;

    try {
        const resp = await fetch('/api/ciclo4/pagos-facturables');
        const data = await resp.json();

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#dc3545;padding:20px;">
                Error del servidor: ${data.message || 'error desconocido'}</td></tr>`;
            return;
        }
        if (!data.pagos || !data.pagos.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">
                No hay pagos completados con Stripe aún.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.pagos.map(p => {
            const fecha     = p.fecha ? String(p.fecha).substring(0, 10) : '—';
            const monto     = `$${parseFloat(p.monto).toFixed(2)} USD`;
            const emitida   = !!p.id_factura;
            const estadoBadge = emitida
                ? `<span style="background:#d4edda;color:#155724;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">✔ Emitida</span>`
                : `<span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">Pendiente</span>`;
            const accion = emitida
                ? `<button onclick="descargarFacturaPDF(${JSON.stringify(p).replace(/"/g,'&quot;')})"
                        style="padding:5px 12px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
                        Ver PDF
                   </button>`
                : `<button onclick='abrirModalFactura(${JSON.stringify(p)})'
                        style="padding:5px 14px;background:#d4a373;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                        Emitir Factura
                   </button>`;

            return `
                <tr>
                    <td>${p.nombre_cliente}</td>
                    <td>${monto}</td>
                    <td style="max-width:180px;font-size:13px;">${p.servicios || '—'}</td>
                    <td>${fecha}</td>
                    <td>${estadoBadge}</td>
                    <td>${accion}</td>
                </tr>`;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#dc3545;padding:20px;">Error al cargar pagos.</td></tr>`;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// MODAL EMITIR FACTURA
// ─────────────────────────────────────────────────────────────────────────────

let _datosPagoFactura = null; // guarda el pago que se está facturando

function abrirModalFactura(pago) {
    _datosPagoFactura = pago;

    let modal = document.getElementById('modal-emitir-factura');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'modal-emitir-factura';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="caja-translucida modal-content" style="max-width:500px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="font-size:20px;color:var(--texto-oscuro);">Emitir Factura</h3>
                <button onclick="cerrarModalFactura()" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
            </div>

            <p style="font-size:13px;color:#888;margin-bottom:16px;">
                Todos los campos son editables. El NIT debe ingresarse antes de emitir.
            </p>

            <div class="input-group">
                <label>Nombre del cliente</label>
                <input type="text" id="fact-nombre" value="${pago.nombre_cliente || ''}"
                    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
            </div>
            <div class="input-group">
                <label>NIT <span style="color:#dc3545;">*</span></label>
                <input type="text" id="fact-nit" value="" placeholder="Ingresa el NIT del cliente"
                    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
            </div>
            <div class="input-group">
                <label>Servicios</label>
                <input type="text" id="fact-servicios" value="${pago.servicios || ''}"
                    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
            </div>
            <div class="input-group">
                <label>Monto (USD)</label>
                <input type="number" id="fact-monto" value="${parseFloat(pago.monto).toFixed(2)}" step="0.01" min="0"
                    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
            </div>

            <div style="display:flex;gap:10px;margin-top:24px;">
                <button onclick="confirmarEmitirFactura()"
                    class="btn-registrarse" style="flex:1;padding:12px;">
                    Confirmar y Emitir
                </button>
                <button onclick="cerrarModalFactura()"
                    class="btn-outline-dark" style="flex:1;padding:12px;">
                    Cancelar
                </button>
            </div>
        </div>`;

    modal.style.display = 'flex';
}

function cerrarModalFactura() {
    const modal = document.getElementById('modal-emitir-factura');
    if (modal) modal.style.display = 'none';
    _datosPagoFactura = null;
}

async function confirmarEmitirFactura() {
    if (!_datosPagoFactura) return;

    const nombre_cliente = document.getElementById('fact-nombre')?.value.trim();
    const nit            = document.getElementById('fact-nit')?.value.trim();
    const servicios      = document.getElementById('fact-servicios')?.value.trim();
    const monto          = parseFloat(document.getElementById('fact-monto')?.value);

    if (!nombre_cliente) return mostrarToast('El nombre del cliente es requerido.', 'error');
    if (!nit)            return mostrarToast('El NIT es requerido para emitir la factura.', 'error');
    if (!monto || monto <= 0) return mostrarToast('El monto debe ser mayor a 0.', 'error');

    const usuario = window.usuarioActual || {};

    try {
        const resp = await fetch('/api/ciclo4/facturas', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_pago:        _datosPagoFactura.id_pago,
                id_cita:        _datosPagoFactura.id_cita,
                ci_cliente:     _datosPagoFactura.ci_cliente,
                nombre_cliente,
                nit,
                servicios,
                monto,
                ci_admin:       usuario.ci,
                nombre_admin:   usuario.nombre,
                rol_admin:      usuario.rol
            })
        });
        const data = await resp.json();

        if (data.success) {
            mostrarToast(`Factura ${data.factura.numero_factura} emitida correctamente.`);
            cerrarModalFactura();
            cargarPagosFacturables(); // refrescar tabla
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión al emitir la factura.', 'error');
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// PDF — Generación de factura como PDF con jsPDF (cargado desde CDN)
// Se usa tanto en el admin (botón "Ver PDF") como en el cliente (botón "Descargar")
// ─────────────────────────────────────────────────────────────────────────────

function descargarFacturaPDF(factura) {
    if (typeof window.jsPDF === 'undefined' && typeof window.jspdf === 'undefined') {
        // Cargar jsPDF desde CDN si no está disponible
        const script  = document.createElement('script');
        script.src    = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => generarPDF(factura);
        document.head.appendChild(script);
    } else {
        generarPDF(factura);
    }
}

function generarPDF(factura) {
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const margen  = 20;
    const ancho   = 210 - margen * 2;
    let y         = 20;

    // ── Encabezado ──────────────────────────────────────────────────────────
    doc.setFillColor(212, 163, 115); // color primario del salón
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SALÓN DE BELLEZA HISAMI', 105, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('hisamisalon.com  |  Santa Cruz, Bolivia', 105, 25, { align: 'center' });

    y = 50;

    // ── Título factura ───────────────────────────────────────────────────────
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA', 105, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`N° ${factura.numero_factura}`, 105, y, { align: 'center' });
    y += 12;

    // ── Línea separadora ─────────────────────────────────────────────────────
    doc.setDrawColor(212, 163, 115);
    doc.setLineWidth(0.5);
    doc.line(margen, y, 210 - margen, y);
    y += 8;

    // ── Datos del cliente ────────────────────────────────────────────────────
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', margen, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre:  ${factura.nombre_cliente}`, margen, y);  y += 6;
    doc.text(`NIT:     ${factura.nit || '—'}`,     margen, y);  y += 12;

    // ── Detalle del servicio ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE', margen, y);
    y += 7;

    // Cabecera de tabla
    doc.setFillColor(245, 235, 220);
    doc.rect(margen, y - 4, ancho, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Descripción', margen + 2, y + 1);
    doc.text('Monto', 210 - margen - 2, y + 1, { align: 'right' });
    y += 10;

    // Fila del servicio
    doc.setFont('helvetica', 'normal');
    const serviciosTexto = factura.servicios || 'Servicio de belleza';
    const lineas = doc.splitTextToSize(serviciosTexto, ancho - 30);
    doc.text(lineas, margen + 2, y);
    doc.text(`$${parseFloat(factura.monto).toFixed(2)} USD`, 210 - margen - 2, y, { align: 'right' });
    y += lineas.length * 6 + 6;

    // Línea
    doc.setDrawColor(212, 163, 115);
    doc.line(margen, y, 210 - margen, y);
    y += 6;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', 130, y);
    doc.text(`$${parseFloat(factura.monto).toFixed(2)} USD`, 210 - margen - 2, y, { align: 'right' });
    y += 14;

    // ── Fecha de emisión ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    const fechaEmision = factura.fecha_emision
        ? new Date(factura.fecha_emision).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' })
        : new Date().toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' });
    doc.text(`Fecha de emisión: ${fechaEmision}`, margen, y);
    y += 14;

    // ── Pie de página ────────────────────────────────────────────────────────
    doc.setDrawColor(212, 163, 115);
    doc.line(margen, y, 210 - margen, y);
    y += 6;
    doc.setFontSize(9);
    doc.text('Gracias por su preferencia. Este documento es válido como comprobante de pago.', 105, y, { align: 'center' });

    // Descargar el PDF
    doc.save(`Factura-${factura.numero_factura}.pdf`);
}


// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE — MIS FACTURAS
// ─────────────────────────────────────────────────────────────────────────────

async function cargarMisFacturas() {
    if (!window.usuarioActual) return;
    const cont = document.getElementById('contenedor-mis-facturas');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Cargando facturas...</p>';

    try {
        const resp = await fetch(`/api/ciclo4/facturas/cliente/${usuarioActual.ci}`);
        const data = await resp.json();

        if (!data.success || !data.facturas.length) {
            cont.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">No tienes facturas emitidas aún.</p>';
            return;
        }

        cont.innerHTML = data.facturas.map(f => {
            const fecha = f.fecha_emision
                ? new Date(f.fecha_emision).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' })
                : '—';
            return `
                <div class="reserva-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <div class="reserva-info">
                        <h4 style="margin:0 0 4px;">${f.numero_factura}</h4>
                        <p style="margin:0;color:#666;font-size:13px;">${f.servicios || '—'}</p>
                        <p style="margin:4px 0 0;font-size:13px;">
                            <strong>$${parseFloat(f.monto).toFixed(2)} USD</strong>
                            &nbsp;·&nbsp; ${fecha}
                        </p>
                    </div>
                    <button onclick='descargarFacturaPDF(${JSON.stringify(f)})'
                        style="padding:8px 18px;background:#d4a373;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;">
                        Descargar PDF
                    </button>
                </div>`;
        }).join('');

    } catch (err) {
        cont.innerHTML = '<p style="color:#dc3545;text-align:center;padding:20px;">Error al cargar facturas.</p>';
    }
}
