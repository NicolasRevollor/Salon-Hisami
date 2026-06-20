// =============================================================================
// frontend/js/ciclo4/CU17-reporte-financiero.js — REPORTE FINANCIERO (Admin)
//
// Flujo (según diagrama de secuencia CU17):
//   1. Admin selecciona tipo_reporte + fecha_inicio + fecha_fin
//   2. generarReporteFinanciero() → GET /api/reportes/financiero
//   3. Backend calcula: ingresos (Pagos), comisiones (Comision+GestionPersonal), servicios top
//   4. Se muestran tarjetas + gráficos (Chart.js CDN)
//   5. exportarReportePDF() → genera y descarga PDF con jsPDF CDN
// =============================================================================

let _rfDatos       = null; // último reporte generado
let _rfFechaInicio = '';   // fecha inicio calculada (mensual/semanal)
let _rfFechaFin    = '';   // fecha fin calculada


// ─────────────────────────────────────────────────────────────────────────────
// TIPO DE REPORTE — lógica del selector
// ─────────────────────────────────────────────────────────────────────────────

// Inicializa el selector al abrir la pestaña (mes actual por defecto)
// Pre-carga jsPDF para que el botón Exportar PDF funcione de forma síncrona
// (los navegadores bloquean doc.save() si se llama desde un callback asíncrono)
function rfInicializar() {
    const input = document.getElementById('rf-mes');
    if (input && !input.value) {
        const hoy = new Date();
        input.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    }
    rfCambiarTipo();
}

// Muestra/oculta los bloques de input según el tipo seleccionado
function rfCambiarTipo() {
    const tipo = document.getElementById('rf-tipo')?.value || 'mensual';

    document.getElementById('rf-bloque-mes').style.display    = tipo === 'mensual'       ? '' : 'none';
    document.getElementById('rf-bloque-semana').style.display = tipo === 'semanal'       ? '' : 'none';
    document.getElementById('rf-bloque-inicio').style.display = tipo === 'personalizado' ? '' : 'none';
    document.getElementById('rf-bloque-fin').style.display    = tipo === 'personalizado' ? '' : 'none';

    // Limpiar resultado anterior y recalcular el período
    limpiarReporteFinanciero();
    _rfFechaInicio = '';
    _rfFechaFin    = '';

    if (tipo === 'mensual')
        rfAplicarMes();
    else if (tipo === 'semanal')
        rfAplicarSemana();
    else
        _rfOcultarPeriodoTexto();
}

// Calcula primer y último día del mes seleccionado
function rfAplicarMes() {
    const val = document.getElementById('rf-mes')?.value;
    if (!val) return;
    const [y, m]   = val.split('-').map(Number);
    _rfFechaInicio = `${y}-${String(m).padStart(2, '0')}-01`;
    const diasMes  = new Date(y, m, 0).getDate();
    _rfFechaFin    = `${y}-${String(m).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
    const meses    = ['enero','febrero','marzo','abril','mayo','junio',
                      'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    _rfMostrarPeriodoTexto(`${meses[m - 1]} de ${y}  (${_rfFechaInicio} — ${_rfFechaFin})`);
}

// Calcula lunes y domingo de la semana que contiene la fecha elegida
function rfAplicarSemana() {
    const val = document.getElementById('rf-semana')?.value;
    if (!val) return;
    const d        = new Date(val + 'T12:00:00');
    const dia      = d.getDay();                          // 0=dom, 1=lun, …
    const lunes    = new Date(d);
    lunes.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
    const domingo  = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    _rfFechaInicio = lunes.toISOString().split('T')[0];
    _rfFechaFin    = domingo.toISOString().split('T')[0];
    _rfMostrarPeriodoTexto(`Semana del ${formatearFechaCorta(_rfFechaInicio)} al ${formatearFechaCorta(_rfFechaFin)}`);
}

function _rfMostrarPeriodoTexto(texto) {
    const p = document.getElementById('rf-periodo-texto');
    if (!p) return;
    p.style.display = '';
    p.textContent   = `Período seleccionado: ${texto}`;
}

function _rfOcultarPeriodoTexto() {
    const p = document.getElementById('rf-periodo-texto');
    if (p) p.style.display = 'none';
}


// ─────────────────────────────────────────────────────────────────────────────
// GENERAR REPORTE — punto de entrada del frontend
// ─────────────────────────────────────────────────────────────────────────────

async function generarReporteFinanciero() {
    const tipo = document.getElementById('rf-tipo')?.value || 'mensual';
    let fechaInicio, fechaFin;

    if (tipo === 'mensual' || tipo === 'semanal') {
        fechaInicio = _rfFechaInicio;
        fechaFin    = _rfFechaFin;
        if (!fechaInicio || !fechaFin)
            return mostrarToast('Selecciona un período válido.', 'error');
    } else {
        fechaInicio = document.getElementById('rf-fecha-inicio')?.value;
        fechaFin    = document.getElementById('rf-fecha-fin')?.value;
        if (!fechaInicio || !fechaFin)
            return mostrarToast('Selecciona las fechas de inicio y fin.', 'error');
        if (fechaInicio > fechaFin)
            return mostrarToast('La fecha inicio no puede ser mayor que la fecha fin.', 'error');
        _rfMostrarPeriodoTexto(`${formatearFechaCorta(fechaInicio)} al ${formatearFechaCorta(fechaFin)}`);
    }

    const cont = document.getElementById('rf-contenido');
    if (!cont) return;
    cont.innerHTML = `<p style="color:#999;text-align:center;padding:40px;">Generando reporte...</p>`;
    const rfAccCarga = document.getElementById('rf-acciones');
    if (rfAccCarga) rfAccCarga.style.display = 'none';

    // Destruir gráficos previos antes de redibujar
    if (window._rfChartServicios) { window._rfChartServicios.destroy(); window._rfChartServicios = null; }
    if (window._rfChartPagos)    { window._rfChartPagos.destroy();    window._rfChartPagos    = null; }

    try {
        const resp = await fetch(`/api/reportes/financiero?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&tipo_reporte=${tipo}`);
        const data = await resp.json();

        if (!data.success) {
            cont.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">${data.message}</p>`;
            return;
        }

        // Caso: sin datos en el período
        if (data.ingresos.cantidad === 0 && !data.comisiones.lista.length && !data.servicios_top.length) {
            cont.innerHTML = `
                <div class="dash-card" style="padding:50px 20px;text-align:center;">
                    <div style="font-size:52px;margin-bottom:14px;">📋</div>
                    <h4 style="color:#555;margin-bottom:8px;">Sin registros en el período</h4>
                    <p style="color:#999;">No hay pagos, comisiones ni reservas entre
                        <strong>${formatearFechaCorta(fechaInicio)}</strong> y
                        <strong>${formatearFechaCorta(fechaFin)}</strong>.</p>
                </div>`;
            const rfAcc = document.getElementById('rf-acciones');
            if (rfAcc) rfAcc.style.display = 'none';
            return;
        }

        _rfDatos = data;
        renderizarReporte(data);
        const rfAcc = document.getElementById('rf-acciones');
        if (rfAcc) rfAcc.style.display = 'flex';

    } catch (err) {
        cont.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">Error de conexión al generar el reporte.</p>`;
        console.error('generarReporteFinanciero:', err);
    }
}

function limpiarReporteFinanciero() {
    _rfDatos = null;
    if (window._rfChartServicios) { window._rfChartServicios.destroy(); window._rfChartServicios = null; }
    if (window._rfChartPagos)    { window._rfChartPagos.destroy();    window._rfChartPagos    = null; }
    const cont = document.getElementById('rf-contenido');
    if (cont) cont.innerHTML = '';
    const rfAcc = document.getElementById('rf-acciones');
    if (rfAcc) rfAcc.style.display = 'none';
}


// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZAR RESULTADOS
// ─────────────────────────────────────────────────────────────────────────────

function renderizarReporte(data) {
    const cont = document.getElementById('rf-contenido');
    if (!cont) return;

    const fi          = formatearFechaCorta(data.periodo.fecha_inicio);
    const ff          = formatearFechaCorta(data.periodo.fecha_fin);
    const total       = parseFloat(data.ingresos.total).toFixed(2);
    const comisiones  = parseFloat(data.comisiones.total).toFixed(2);
    const neta        = parseFloat(data.ganancia_neta).toFixed(2);
    const numPagos    = data.ingresos.cantidad;
    const netaColor   = parseFloat(neta) >= 0 ? '#2c3e50' : '#dc3545';
    const topServicio = data.servicios_top.length ? data.servicios_top[0] : null;

    cont.innerHTML = `
        <p style="font-size:13px;color:#888;text-align:center;margin-bottom:20px;">
            Período: <strong>${fi}</strong> — <strong>${ff}</strong>
        </p>

        <!-- ── Tarjetas resumen ─────────────────────────────────────────── -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:14px;margin-bottom:24px;">
            <div class="dash-card" style="text-align:center;padding:18px 12px;">
                <p style="font-size:11px;color:#888;margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px;">Ingresos Brutos</p>
                <p style="font-size:22px;font-weight:700;color:#27ae60;margin:0;">$${total}</p>
                <p style="font-size:12px;color:#999;margin:4px 0 0;">${numPagos} pago${numPagos !== 1 ? 's' : ''}</p>
            </div>
            <div class="dash-card" style="text-align:center;padding:18px 12px;">
                <p style="font-size:11px;color:#888;margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px;">Comisiones</p>
                <p style="font-size:22px;font-weight:700;color:#e67e22;margin:0;">$${comisiones}</p>
                <p style="font-size:12px;color:#999;margin:4px 0 0;">${data.comisiones.lista.length} esteticista${data.comisiones.lista.length !== 1 ? 's' : ''}</p>
            </div>
            <div class="dash-card" style="text-align:center;padding:18px 12px;">
                <p style="font-size:11px;color:#888;margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px;">Ganancia Neta</p>
                <p style="font-size:22px;font-weight:700;color:${netaColor};margin:0;">$${neta}</p>
                <p style="font-size:12px;color:#999;margin:4px 0 0;">Ingresos − Comisiones</p>
            </div>
            <div class="dash-card" style="text-align:center;padding:18px 12px;">
                <p style="font-size:11px;color:#888;margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px;">Top Servicio</p>
                <p style="font-size:14px;font-weight:700;color:var(--color-primario);margin:0;line-height:1.3;">
                    ${topServicio ? topServicio.nombre_servicio : '—'}
                </p>
                <p style="font-size:12px;color:#999;margin:4px 0 0;">
                    ${topServicio ? topServicio.total_reservas + ' reservas' : ''}
                </p>
            </div>
        </div>

        <!-- ── Gráficos ─────────────────────────────────────────────────── -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:24px;">
            <div class="dash-card" style="padding:20px;">
                <h4 style="font-size:13px;color:#444;margin:0 0 14px;">Top Servicios (reservas en el período)</h4>
                <canvas id="rf-chart-servicios"></canvas>
            </div>
            <div class="dash-card" style="padding:20px;">
                <h4 style="font-size:13px;color:#444;margin:0 0 14px;">Ingresos por Método de Pago</h4>
                <canvas id="rf-chart-pagos"></canvas>
            </div>
        </div>

        <!-- ── Tabla comisiones ──────────────────────────────────────────── -->
        ${data.comisiones.lista.length ? `
        <div class="dash-card" style="padding:20px;margin-bottom:20px;">
            <h4 style="font-size:13px;color:#444;margin:0 0 14px;">Comisiones por Esteticista</h4>
            <div class="admin-table-container" style="margin:0;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Esteticista</th>
                            <th>CI</th>
                            <th>Servicios</th>
                            <th>Total Comisión</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.comisiones.lista.map(c => `
                            <tr>
                                <td>${c.nombre}</td>
                                <td style="color:#888;font-size:13px;">${c.ci}</td>
                                <td>${c.cantidad}</td>
                                <td style="font-weight:600;color:#e67e22;">$${parseFloat(c.total_comision).toFixed(2)}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : ''}

        `;

    // Cargar Chart.js y dibujar gráficos
    cargarChartJs(() => {
        renderizarChartServicios(data.servicios_top);
        renderizarChartPagos(data.ingresos.desglose);
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// CHART.JS — carga dinámica desde CDN
// ─────────────────────────────────────────────────────────────────────────────

function cargarChartJs(callback) {
    if (typeof Chart !== 'undefined') { callback(); return; }
    const s  = document.createElement('script');
    s.src    = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = callback;
    document.head.appendChild(s);
}

function renderizarChartServicios(servicios) {
    const canvas = document.getElementById('rf-chart-servicios');
    if (!canvas || !servicios.length) return;
    window._rfChartServicios = new Chart(canvas, {
        type: 'bar',
        data: {
            labels:   servicios.map(s => s.nombre_servicio),
            datasets: [{
                label:           'Reservas',
                data:            servicios.map(s => s.total_reservas),
                backgroundColor: ['#d4a373','#e9c46a','#f4a261','#e76f51','#264653'],
                borderRadius:    6,
                borderSkipped:   false
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
                x: { ticks: { font: { size: 11 } } }
            }
        }
    });
}

function renderizarChartPagos(desglose) {
    const canvas = document.getElementById('rf-chart-pagos');
    if (!canvas || !desglose.length) return;
    window._rfChartPagos = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels:   desglose.map(d => d.metodo_pago || 'otro'),
            datasets: [{
                data:            desglose.map(d => parseFloat(d.total)),
                backgroundColor: ['#635bff','#d4a373','#27ae60','#e67e22','#3498db'],
                borderWidth:     2,
                borderColor:     '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
                tooltip: {
                    callbacks: { label: ctx => ` $${ctx.parsed.toFixed(2)} USD` }
                }
            }
        }
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR PDF — genera y descarga el reporte completo
// ─────────────────────────────────────────────────────────────────────────────

function exportarReportePDF() {
    if (!_rfDatos) {
        mostrarToast('Primero genera el reporte.', 'error');
        return;
    }
    try {
        _generarPDFReporte(_rfDatos);
    } catch (err) {
        mostrarToast('Error al generar PDF: ' + err.message, 'error');
        console.error('[PDF]', err);
    }
}

function _generarPDFReporte(data) {
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    const doc = new jsPDFClass({ unit: 'mm', format: 'a4' });

    // Área imprimible: x de 20 a 190 (170mm), y de 20 a 277 (257mm)
    const m  = 20;   // margen izquierdo/derecho
    const PW = 170;  // ancho imprimible
    let y    = 0;

    // Avanza de página si el contenido se acerca al final
    function sig(espacio) {
        if (y + espacio > 275) { doc.addPage(); y = 20; }
    }

    // Línea horizontal color primario
    function separador() {
        doc.setDrawColor(212, 163, 115);
        doc.setLineWidth(0.5);
        doc.line(m, y, m + PW, y);
        y += 7;
    }

    // Cabecera de tabla con fondo beige
    function cabeceraTabla(cols) {
        doc.setFillColor(245, 235, 220);
        doc.rect(m, y, PW, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        cols.forEach(({ texto, x }) => doc.text(texto, m + x, y + 5));
        y += 9;
    }

    // Fila de tabla con fondo alterno
    function filaTabla(celdas, indice) {
        sig(8);
        if (indice % 2 === 0) {
            doc.setFillColor(250, 248, 245);
            doc.rect(m, y, PW, 7, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        celdas.forEach(({ texto, x, negrita }) => {
            if (negrita) doc.setFont('helvetica', 'bold');
            doc.text(String(texto), m + x, y + 5);
            if (negrita) doc.setFont('helvetica', 'normal');
        });
        y += 7;
    }

    // ── ENCABEZADO ───────────────────────────────────────────────────────────
    doc.setFillColor(212, 163, 115);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SALÓN DE BELLEZA HISAMI', 105, 13, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte Financiero', 105, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Período: ${data.periodo.fecha_inicio}  al  ${data.periodo.fecha_fin}`, 105, 30, { align: 'center' });

    y = 46;

    // ── RESUMEN (4 filas simples, una por línea) ──────────────────────────────
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN FINANCIERO', m, y);
    y += 7;

    const filaResumen = (etiqueta, valor, colorRGB) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90, 90, 90);
        doc.text(etiqueta + ':', m + 2, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
        doc.text(valor, m + 70, y);
        y += 7;
    };

    filaResumen('Ingresos Brutos',
        `$${parseFloat(data.ingresos.total).toFixed(2)} USD  (${data.ingresos.cantidad} pago${data.ingresos.cantidad !== 1 ? 's' : ''})`,
        [39, 174, 96]);
    filaResumen('Comisiones Pagadas',
        `$${parseFloat(data.comisiones.total).toFixed(2)} USD  (${data.comisiones.lista.length} esteticista${data.comisiones.lista.length !== 1 ? 's' : ''})`,
        [230, 126, 34]);

    const neta      = parseFloat(data.ganancia_neta);
    const netaColor = neta >= 0 ? [44, 62, 80] : [192, 57, 43];
    filaResumen('Ganancia Neta',
        `$${neta.toFixed(2)} USD`,
        netaColor);

    if (data.servicios_top.length) {
        filaResumen('Servicio más solicitado',
            `${data.servicios_top[0].nombre_servicio} (${data.servicios_top[0].total_reservas} reservas)`,
            [155, 89, 182]);
    }

    y += 4;
    separador();

    // ── TOP SERVICIOS ─────────────────────────────────────────────────────────
    sig(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('TOP SERVICIOS DEL PERÍODO', m, y);
    y += 7;

    // Columnas: Servicio (0–105) | Reservas (107–130) | Ing. Est. (132–170)
    cabeceraTabla([
        { texto: 'Servicio',       x: 2   },
        { texto: 'Reservas',       x: 107 },
        { texto: 'Ing. Estimado',  x: 132 }
    ]);

    const servicios = data.servicios_top.length
        ? data.servicios_top
        : [{ nombre_servicio: 'Sin datos en el período', total_reservas: 0, ingreso_estimado: 0 }];

    servicios.forEach((s, i) => filaTabla([
        { texto: String(s.nombre_servicio).substring(0, 38), x: 2   },
        { texto: String(s.total_reservas),                   x: 107 },
        { texto: `$${parseFloat(s.ingreso_estimado).toFixed(2)}`, x: 132, negrita: true }
    ], i));

    y += 6;
    separador();

    // ── COMISIONES ────────────────────────────────────────────────────────────
    sig(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('COMISIONES POR ESTETICISTA', m, y);
    y += 7;

    if (data.comisiones.lista.length) {
        // Columnas: Nombre (0–82) | CI (84–107) | Servicios (109–132) | Comisión (134–170)
        cabeceraTabla([
            { texto: 'Esteticista', x: 2   },
            { texto: 'CI',          x: 84  },
            { texto: 'Servicios',   x: 109 },
            { texto: 'Comisión',    x: 134 }
        ]);
        data.comisiones.lista.forEach((c, i) => filaTabla([
            { texto: String(c.nombre).substring(0, 28),                      x: 2   },
            { texto: String(c.ci),                                            x: 84  },
            { texto: String(c.cantidad),                                      x: 109 },
            { texto: `$${parseFloat(c.total_comision).toFixed(2)} USD`, x: 134, negrita: true }
        ], i));
    } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('Sin comisiones registradas en el período seleccionado.', m + 2, y + 4);
        y += 10;
    }

    // ── PIE DE PÁGINA (siempre al final de la última página) ─────────────────
    const fechaGen = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
    const pieY     = doc.internal.pageSize.getHeight() - 12;
    doc.setDrawColor(212, 163, 115);
    doc.setLineWidth(0.5);
    doc.line(m, pieY - 4, m + PW, pieY - 4);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Generado el ${fechaGen} — Sistema de Gestión HISAMI`, 105, pieY, { align: 'center' });

    const nombreArchivo = `ReporteFinanciero_${data.periodo.fecha_inicio}_${data.periodo.fecha_fin}.pdf`;

    // Intentar descarga automática con blob URL
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = nombreArchivo;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    mostrarToast('PDF generado. Si no descargó, revisa la carpeta de descargas.', 'success');
}
