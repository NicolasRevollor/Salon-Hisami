// =============================================================================
// reportes.js — CU17: GENERADOR DE REPORTES
//
// Quién puede usar qué:
//   Administrador → Recetas, Comisiones (todos), Reservas, Bitácora
//   Personal      → Solo Comisiones (propias, CI forzado a su usuario)
// =============================================================================

// Estado del reporte actualmente generado (se usa al exportar)
let reporteActual = { tipo: '', datos: [], columnas: [], titulo: '', filaDestacada: -1, granTotal: undefined };

// Helper: convierte "YYYY-MM" a "Enero 2025"
function mesClaveALabel(clave) {
    if (!clave) return '—';
    const [y, m] = clave.split('-').map(Number);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${meses[m - 1]} ${y}`;
}

// =============================================================================
// ABRIR / CERRAR MODAL
// =============================================================================
function abrirModalReportes() {
    if (!usuarioActual) return;
    const rol = usuarioActual.rol;
    if (rol !== 'Administrador' && rol !== 'Personal') {
        mostrarToast('No tienes permisos para generar reportes.', 'error');
        return;
    }
    reporteActual = { tipo: '', datos: [], columnas: [], titulo: '', filaDestacada: -1 };
    document.getElementById('reportes-resultado').innerHTML = '';
    document.getElementById('reportes-acciones').style.display = 'none';
    renderizarTabsReportes();
    document.getElementById('modal-reportes').classList.remove('seccion-oculta');
}

function cerrarModalReportes() {
    document.getElementById('modal-reportes').classList.add('seccion-oculta');
}

// =============================================================================
// TABS — Admin ve los 4; Personal solo ve "Mis Comisiones"
// =============================================================================
function renderizarTabsReportes() {
    const esAdmin = usuarioActual.rol === 'Administrador';
    const tabs = esAdmin ? [
        { id: 'recetas',     label: 'Recetas / Servicios' },
        { id: 'comisiones',  label: 'Comisiones'          },
        { id: 'reservas',    label: 'Reservas'             },
        { id: 'bitacora',    label: 'Bitácora'             }
    ] : [
        { id: 'comisiones', label: 'Mis Comisiones' }
    ];

    const btnVoz = esAdmin
        ? `<button class="btn-tab-reporte" id="btn-voz-reporte"
               onclick="iniciarReporteVoz()"
               style="margin-left:auto;background:#d4a373;color:#fff;border-color:#d4a373;font-weight:600;display:inline-flex;align-items:center;gap:6px;"
               title="Generar reporte por comando de voz">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
               Voz
           </button>`
        : '';

    document.getElementById('reportes-tabs').innerHTML =
        tabs.map(t =>
            `<button class="btn-tab-reporte" id="tab-rep-${t.id}" onclick="seleccionarTabReporte('${t.id}')">${t.label}</button>`
        ).join('') + btnVoz;

    seleccionarTabReporte(tabs[0].id);
}

function seleccionarTabReporte(tipo) {
    document.querySelectorAll('.btn-tab-reporte').forEach(b => b.classList.remove('activo'));
    const btn = document.getElementById('tab-rep-' + tipo);
    if (btn) btn.classList.add('activo');
    reporteActual = { tipo, datos: [], columnas: [], titulo: '', filaDestacada: -1, granTotal: undefined };
    document.getElementById('reportes-resultado').innerHTML = '';
    document.getElementById('reportes-acciones').style.display = 'none';
    renderizarFiltrosReporte(tipo);
}

// =============================================================================
// FILTROS — UI distinta según el tab activo
// =============================================================================
async function renderizarFiltrosReporte(tipo) {
    const cont = document.getElementById('reportes-filtros');
    const esAdmin = usuarioActual.rol === 'Administrador';

    if (tipo === 'recetas') {
        cont.innerHTML = `
            <div class="reporte-filtros-box">
                <p style="margin:0 0 12px;color:#666;font-size:14px;">Elige qué reporte quieres generar:</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
                    <label class="reporte-radio-label">
                        <input type="radio" name="tipo-receta" value="requeridos" checked>
                        Servicios más requeridos
                    </label>
                    <label class="reporte-radio-label">
                        <input type="radio" name="tipo-receta" value="insumos">
                        Top 5 — más insumos gastan
                    </label>
                </div>
                <button class="btn-generar-reporte" onclick="generarReporteRecetas()">Generar Reporte</button>
            </div>`;

    } else if (tipo === 'comisiones') {
        let selectorEmpleado = '';
        if (esAdmin) {
            let opts = '<option value="">— Todos los empleados —</option>';
            try {
                const r = await fetch(`${API_BASE}/api/reportes/empleados`);
                const d = await r.json();
                if (d.success) {
                    opts += d.empleados.map(e =>
                        `<option value="${e.ci}">${e.nombre}</option>`
                    ).join('');
                }
            } catch { /* sin conexión → queda solo "Todos" */ }
            selectorEmpleado = `
                <div style="margin-bottom:14px;">
                    <label class="reporte-label">Empleado</label>
                    <select id="filtro-com-ci" class="reporte-select">${opts}</select>
                </div>`;
        } else {
            selectorEmpleado = `<p style="margin:0 0 14px;color:#666;font-size:14px;">
                Mostrando tus comisiones agrupadas por mes.</p>`;
        }
        cont.innerHTML = `
            <div class="reporte-filtros-box">
                ${selectorEmpleado}
                <button class="btn-generar-reporte" onclick="generarReporteComisiones()">Generar Reporte</button>
            </div>`;

    } else if (tipo === 'reservas') {
        cont.innerHTML = `
            <div class="reporte-filtros-box">
                <p style="margin:0 0 14px;color:#666;font-size:14px;">
                    Muestra los últimos 12 meses con total de reservas, finalizadas, canceladas y pendientes.
                </p>
                <button class="btn-generar-reporte" onclick="generarReporteReservas()">Generar Reporte</button>
            </div>`;

    } else if (tipo === 'bitacora') {
        // Generar últimos 12 meses para el selector
        const opciones = [];
        const hoy = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            opciones.push(`<option value="${key}">${mesClaveALabel(key)}</option>`);
        }
        cont.innerHTML = `
            <div class="reporte-filtros-box">
                <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;">
                    <div>
                        <label class="reporte-label">Mes</label>
                        <select id="filtro-bit-mes" class="reporte-select">${opciones.join('')}</select>
                    </div>
                    <div>
                        <label class="reporte-label">Rol</label>
                        <select id="filtro-bit-rol" class="reporte-select">
                            <option value="Cliente">Cliente</option>
                            <option value="Personal">Personal</option>
                        </select>
                    </div>
                </div>
                <button class="btn-generar-reporte" onclick="generarReporteBitacora()">Generar Reporte</button>
            </div>`;
    }
}

// =============================================================================
// GENERADORES — cada función consulta su endpoint y llama a renderizarTabla
// =============================================================================
async function generarReporteRecetas() {
    const subtipo = document.querySelector('input[name="tipo-receta"]:checked')?.value || 'requeridos';
    const endpoint = subtipo === 'insumos'
        ? '/api/reportes/servicios-insumos'
        : '/api/reportes/servicios-requeridos';

    mostrarCargandoReporte();
    try {
        const d = await (await fetch(`${API_BASE}${endpoint}`)).json();
        if (!d.success) throw new Error(d.message);

        if (subtipo === 'insumos') {
            reporteActual.titulo    = 'Top 5 Servicios que Más Insumos Gastan';
            reporteActual.columnas  = ['#', 'Servicio', 'Tipos de Insumos', 'Cantidad Total en Receta'];
            reporteActual.datos     = d.datos.map((row, i) => [
                i + 1, row.nombre_servicio, row.tipos_insumos, row.total_cantidad
            ]);
        } else {
            reporteActual.titulo   = 'Servicios Más Requeridos';
            reporteActual.columnas = ['#', 'Servicio', 'Total Reservas'];
            reporteActual.datos    = d.datos.map((row, i) => [
                i + 1, row.nombre_servicio, row.total_reservas
            ]);
        }
        renderizarTablaReporte();
    } catch (err) {
        mostrarErrorReporte(err.message);
    }
}

async function generarReporteComisiones() {
    const esAdmin = usuarioActual.rol === 'Administrador';
    const ci = esAdmin
        ? (document.getElementById('filtro-com-ci')?.value || '')
        : usuarioActual.ci;

    mostrarCargandoReporte();
    try {
        const url = `${API_BASE}/api/reportes/comisiones${ci ? '?ci=' + encodeURIComponent(ci) : ''}`;
        const d = await (await fetch(url)).json();
        if (!d.success) throw new Error(d.message);

        const todosTodos = esAdmin && !ci;
        const granTotal = d.datos.reduce((sum, row) => sum + parseFloat(row.total_bs || 0), 0);
        reporteActual.granTotal = granTotal;

        if (todosTodos) {
            reporteActual.titulo   = 'Reporte de Comisiones — Todos los Empleados';
            reporteActual.columnas = ['Empleado', 'CI', 'Mes', 'Total (Bs)', 'Cantidad'];
            reporteActual.datos    = d.datos.map(row => [
                row.nombre_empleado, row.ci,
                mesClaveALabel(row.mes_clave),
                `Bs. ${parseFloat(row.total_bs).toFixed(2)}`,
                row.cantidad
            ]);
        } else {
            const nombre = d.datos[0]?.nombre_empleado || '';
            reporteActual.titulo   = `Comisiones — ${nombre || 'Empleado'}`;
            reporteActual.columnas = ['Mes', 'Total (Bs)', 'Cantidad de Comisiones'];
            reporteActual.datos    = d.datos.map(row => [
                mesClaveALabel(row.mes_clave),
                `Bs. ${parseFloat(row.total_bs).toFixed(2)}`,
                row.cantidad
            ]);
        }
        renderizarTablaReporte();
    } catch (err) {
        mostrarErrorReporte(err.message);
    }
}

async function generarReporteReservas() {
    mostrarCargandoReporte();
    try {
        const d = await (await fetch(`${API_BASE}/api/reportes/reservas-mes`)).json();
        if (!d.success) throw new Error(d.message);

        reporteActual.titulo   = 'Reservas por Mes (últimos 12 meses)';
        reporteActual.columnas = ['Mes', 'Total', 'Finalizadas', 'Canceladas', 'Pendientes'];
        reporteActual.datos    = d.datos.map(row => [
            mesClaveALabel(row.mes_clave),
            row.total_reservas, row.finalizadas, row.canceladas, row.pendientes
        ]);

        // Destacar el mes con más reservas
        if (d.datos.length > 0) {
            reporteActual.filaDestacada = d.datos.reduce((best, row, i, arr) =>
                parseInt(row.total_reservas) > parseInt(arr[best].total_reservas) ? i : best, 0);
        }
        renderizarTablaReporte();
    } catch (err) {
        mostrarErrorReporte(err.message);
    }
}

async function generarReporteBitacora() {
    const mes = document.getElementById('filtro-bit-mes')?.value;
    const rol = document.getElementById('filtro-bit-rol')?.value;

    mostrarCargandoReporte();
    try {
        const url = `${API_BASE}/api/reportes/bitacora-logins?mes=${mes}&rol=${encodeURIComponent(rol)}`;
        const d = await (await fetch(url)).json();
        if (!d.success) throw new Error(d.message);

        reporteActual.titulo   = `Usuarios con Más Ingresos — ${rol} — ${mesClaveALabel(mes)}`;
        reporteActual.columnas = ['#', 'Usuario', 'CI', 'Rol', 'Ingresos en el Mes'];
        reporteActual.datos    = d.datos.map((row, i) => [
            i + 1, row.nombre_usuario, row.ci_usuario, row.rol, row.total_logins
        ]);
        renderizarTablaReporte();
    } catch (err) {
        mostrarErrorReporte(err.message);
    }
}

// =============================================================================
// RENDER DE TABLA
// =============================================================================
function mostrarCargandoReporte() {
    document.getElementById('reportes-resultado').innerHTML =
        '<p style="text-align:center;color:#aaa;padding:30px 0;font-size:14px;">Cargando...</p>';
    document.getElementById('reportes-acciones').style.display = 'none';
}

function mostrarErrorReporte(msg) {
    document.getElementById('reportes-resultado').innerHTML =
        `<p style="text-align:center;color:#e74c3c;padding:20px;font-size:14px;">Error: ${msg}</p>`;
}

function renderizarTablaReporte() {
    const { titulo, columnas, datos, filaDestacada } = reporteActual;
    const cont = document.getElementById('reportes-resultado');

    if (!datos.length) {
        cont.innerHTML = '<p style="text-align:center;color:#aaa;padding:30px 0;font-size:14px;">No hay datos para mostrar.</p>';
        return;
    }

    const encabezados = columnas.map(c =>
        `<th style="padding:10px 14px;background:#f5e6d3;text-align:left;font-size:12px;color:#777;font-weight:600;white-space:nowrap;">${c}</th>`
    ).join('');

    const filas = datos.map((row, i) => {
        const destacada = i === filaDestacada;
        const bg = destacada ? 'background:#fff8ec;' : (i % 2 === 0 ? 'background:#fff;' : 'background:#fafafa;');
        const celdas = row.map(v =>
            `<td style="padding:9px 14px;border-bottom:1px solid #f0e8df;font-size:13px;">${v ?? '—'}</td>`
        ).join('');
        const badge = destacada
            ? `<td style="padding:9px 14px;border-bottom:1px solid #f0e8df;font-size:11px;color:#d4a373;white-space:nowrap;font-weight:700;">★ Más reservas</td>`
            : (filaDestacada >= 0 ? `<td style="padding:9px 14px;border-bottom:1px solid #f0e8df;"></td>` : '');
        return `<tr style="${bg}">${celdas}${badge}</tr>`;
    }).join('');

    const thBadge = filaDestacada >= 0
        ? `<th style="padding:10px 14px;background:#f5e6d3;"></th>` : '';

    const totalBox = reporteActual.granTotal !== undefined
        ? `<div style="margin-top:12px;padding:12px 16px;background:#fff8ec;border:1.5px solid #d4a373;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
               <span style="font-size:13px;color:#666;font-weight:600;">TOTAL GENERAL DE COMISIONES</span>
               <span style="font-size:16px;font-weight:700;color:#b5813a;">Bs. ${reporteActual.granTotal.toFixed(2)}</span>
           </div>`
        : '';

    cont.innerHTML = `
        <h4 style="margin:0 0 12px;font-size:14px;color:#555;font-weight:600;">${titulo}</h4>
        <div style="overflow-x:auto;border-radius:8px;border:1px solid #f0e8df;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${encabezados}${thBadge}</tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
        ${totalBox}`;

    document.getElementById('reportes-acciones').style.display = 'flex';
}

// =============================================================================
// EXPORTAR CSV
// =============================================================================
function exportarReporteCSV() {
    const { tipo, columnas, datos, granTotal } = reporteActual;
    if (!datos.length) return;

    const bom  = '﻿'; // BOM para que Excel muestre tildes
    const head = columnas.join(',');
    const rows = datos.map(row =>
        row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    );
    if (granTotal !== undefined) {
        rows.push(`"TOTAL GENERAL","Bs. ${granTotal.toFixed(2)}"`);
    }
    const csv  = bom + [head, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reporte_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// =============================================================================
// EXPORTAR PDF (abre ventana nueva y usa el diálogo de impresión del navegador)
// =============================================================================
function exportarReportePDF() {
    const { columnas, datos, titulo, granTotal } = reporteActual;
    if (!datos.length) return;

    const ths  = columnas.map(c => `<th>${c}</th>`).join('');
    const trs  = datos.map(row =>
        `<tr>${row.map(v => `<td>${v ?? '—'}</td>`).join('')}</tr>`
    ).join('');
    const totalHtml = granTotal !== undefined
        ? `<div class="total-box"><span>TOTAL GENERAL DE COMISIONES</span><strong>Bs. ${granTotal.toFixed(2)}</strong></div>`
        : '';
    const fecha = new Date().toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' });

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8">
        <title>${titulo}</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; padding: 28px 32px; color: #333; font-size: 13px; }
            .cabecera { border-bottom: 2px solid #d4a373; padding-bottom: 12px; margin-bottom: 18px; }
            .cabecera h2 { color: #b5813a; font-size: 17px; }
            .cabecera p  { color: #888; font-size: 11px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f5e6d3; padding: 9px 12px; text-align: left; font-size: 11px; color: #666; font-weight: 600; }
            td { padding: 8px 12px; border-bottom: 1px solid #eee; }
            tr:nth-child(even) td { background: #fafafa; }
            .total-box { margin-top: 14px; padding: 10px 14px; border: 1.5px solid #d4a373; border-radius: 6px; background: #fff8ec; display: flex; justify-content: space-between; }
            .total-box span { font-size: 12px; color: #666; font-weight: 600; }
            .total-box strong { font-size: 15px; color: #b5813a; }
            @media print { body { padding: 0; } button { display: none; } }
        </style>
    </head><body>
        <div class="cabecera">
            <h2>${titulo}</h2>
            <p>Generado el ${fecha} &mdash; Salón de Belleza HISAMI</p>
        </div>
        <table>
            <thead><tr>${ths}</tr></thead>
            <tbody>${trs}</tbody>
        </table>
        ${totalHtml}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
}

// =============================================================================
// REPORTE POR COMANDO DE VOZ
// Usa Web Speech API (Chrome/Edge) para capturar la voz del administrador,
// envía el texto al backend para interpretación NLP y genera el reporte.
// =============================================================================

let _reconocimientoVoz = null;

// Inyecta estilos de animación del micrófono una sola vez
(function inyectarEstilosVoz() {
    if (document.getElementById('voz-styles')) return;
    const s = document.createElement('style');
    s.id = 'voz-styles';
    s.textContent = `
        @keyframes vozPulse {
            0%,100% { transform:scale(1);   box-shadow:0 0 0 0 rgba(212,163,115,.4); }
            50%      { transform:scale(1.1); box-shadow:0 0 0 10px rgba(212,163,115,0); }
        }
        #voz-icono-mic { animation: vozPulse 1.1s ease-in-out infinite; display:inline-flex; }
        #voz-icono-mic.detenido { animation:none; }
    `;
    document.head.appendChild(s);
})();

function iniciarReporteVoz() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        mostrarToast('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.', 'error');
        return;
    }

    // Resaltar botón de voz
    document.querySelectorAll('.btn-tab-reporte').forEach(b => b.classList.remove('activo'));
    const btnVoz = document.getElementById('btn-voz-reporte');
    if (btnVoz) btnVoz.style.background = '#b5813a';

    // Mostrar UI de escucha en el área de filtros
    document.getElementById('reportes-filtros').innerHTML = `
        <div style="text-align:center;padding:24px 16px;">
            <span id="voz-icono-mic" style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:#fff3e0;color:#d4a373;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </span>
            <p id="voz-estado-txt" style="color:#d4a373;font-weight:700;font-size:15px;margin:14px 0 6px;">
                Escuchando...
            </p>
            <p id="voz-transcripcion-txt"
               style="color:#555;font-size:13px;min-height:22px;font-style:italic;margin-bottom:14px;"></p>
            <p style="color:#bbb;font-size:11px;margin-bottom:18px;">
                Ejemplo: &ldquo;Dame el reporte de comisiones de este mes&rdquo;
            </p>
            <button onclick="cancelarVoz()"
                style="padding:7px 22px;background:#f0f0f0;border:none;border-radius:6px;cursor:pointer;color:#666;font-size:13px;display:inline-flex;align-items:center;gap:6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Cancelar
            </button>
        </div>`;
    document.getElementById('reportes-resultado').innerHTML = '';
    document.getElementById('reportes-acciones').style.display = 'none';

    _reconocimientoVoz = new SR();
    _reconocimientoVoz.lang           = 'es-BO';
    _reconocimientoVoz.interimResults = true;
    _reconocimientoVoz.maxAlternatives = 1;

    _reconocimientoVoz.onresult = (event) => {
        const transcripcion = event.results[0][0].transcript;
        const esFinal       = event.results[0].isFinal;
        const el = document.getElementById('voz-transcripcion-txt');
        if (el) el.textContent = `"${transcripcion}"`;
        if (esFinal) _procesarTextoVoz(transcripcion);
    };

    _reconocimientoVoz.onerror = (event) => {
        const msgs = { 'no-speech': 'No se detectó voz. Intenta de nuevo.', 'not-allowed': 'Permiso de micrófono denegado.' };
        const el = document.getElementById('voz-estado-txt');
        if (el) { el.textContent = msgs[event.error] || `Error: ${event.error}`; el.style.color = '#e74c3c'; }
        const mic = document.getElementById('voz-icono-mic');
        if (mic) mic.classList.add('detenido');
    };

    _reconocimientoVoz.onend = () => {
        const mic = document.getElementById('voz-icono-mic');
        if (mic) mic.classList.add('detenido');
    };

    _reconocimientoVoz.start();
}

function cancelarVoz() {
    if (_reconocimientoVoz) { try { _reconocimientoVoz.stop(); } catch(_){} _reconocimientoVoz = null; }
    const btnVoz = document.getElementById('btn-voz-reporte');
    if (btnVoz) btnVoz.style.background = '#d4a373';
    seleccionarTabReporte('recetas');
}

async function _procesarTextoVoz(texto) {
    const estadoEl = document.getElementById('voz-estado-txt');
    if (estadoEl) { estadoEl.textContent = 'Interpretando...'; estadoEl.style.color = '#888'; }
    const mic = document.getElementById('voz-icono-mic');
    if (mic) mic.classList.add('detenido');

    try {
        const res  = await fetch(`${API_BASE}/api/reportes/voz`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ texto })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        _mostrarInterpretacion(texto, data.interpretacion);
        await _ejecutarReportePorVoz(data.interpretacion);

    } catch (err) {
        mostrarErrorReporte(`No pude interpretar el comando: ${err.message}`);
    }
}

function _mostrarInterpretacion(textoOriginal, interp) {
    const textoEscapado = textoOriginal.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    document.getElementById('reportes-filtros').innerHTML = `
        <div id="voz-interp-box" style="background:#fff8ec;border:1.5px solid #d4a373;border-radius:10px;padding:14px 16px;margin-bottom:6px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;">
                <p style="font-size:11px;color:#aaa;margin:0;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Comando detectado</p>
                <button onclick="_activarEdicionComando('${textoEscapado}')"
                    title="Editar comando"
                    style="background:none;border:none;cursor:pointer;padding:2px;color:#b8956a;display:inline-flex;align-items:center;flex-shrink:0;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <p id="voz-texto-detectado" style="font-size:13px;color:#555;font-style:italic;margin-bottom:12px;">"${textoOriginal}"</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <span style="background:#d4a373;color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
                    ${interp.tipoLabel}
                </span>
                ${interp.periodoLabel ? `<span style="background:#f0f0f0;color:#666;padding:4px 12px;border-radius:12px;font-size:12px;display:inline-flex;align-items:center;gap:5px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ${interp.periodoLabel}
                </span>` : ''}
            </div>
        </div>`;
}

function _activarEdicionComando(textoActual) {
    const box = document.getElementById('voz-interp-box');
    if (!box) return;
    box.innerHTML = `
        <p style="font-size:11px;color:#aaa;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Editar comando</p>
        <textarea id="voz-editor-txt"
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d4a373;border-radius:7px;font-size:14px;color:#333;resize:vertical;min-height:52px;font-family:inherit;outline:none;"
            rows="2">${textoActual}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;">
            <button onclick="seleccionarTabReporte('recetas')"
                style="padding:6px 16px;background:#f0f0f0;border:none;border-radius:6px;cursor:pointer;color:#666;font-size:13px;display:inline-flex;align-items:center;gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Cancelar
            </button>
            <button onclick="_confirmarEdicionComando()"
                style="padding:6px 18px;background:#d4a373;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
                Regenerar reporte
            </button>
        </div>`;
    const editor = document.getElementById('voz-editor-txt');
    if (editor) {
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _confirmarEdicionComando(); }
        });
    }
}

function _confirmarEdicionComando() {
    const editor = document.getElementById('voz-editor-txt');
    const texto = editor ? editor.value.trim() : '';
    if (!texto) return;
    document.getElementById('reportes-resultado').innerHTML = '';
    document.getElementById('reportes-acciones').style.display = 'none';
    _procesarTextoVoz(texto);
}

async function _ejecutarReportePorVoz(interp) {
    const { tipo, subtipo, mes, ci, rol, fechaInicio, fechaFin } = interp;

    // Resaltar tab correspondiente
    document.querySelectorAll('.btn-tab-reporte').forEach(b => b.classList.remove('activo'));
    const tabId = document.getElementById('tab-rep-' + tipo);
    if (tabId) tabId.classList.add('activo');

    mostrarCargandoReporte();

    try {
        switch (tipo) {
            case 'recetas':     await _vozRecetas(subtipo);              break;
            case 'comisiones':  await _vozComisiones(ci);                break;
            case 'reservas':    await _vozReservas();                    break;
            case 'bitacora':    await _vozBitacora(mes, rol);            break;
            case 'financiero':  await _vozFinanciero(fechaInicio, fechaFin); break;
            default:
                mostrarErrorReporte('No pude identificar el tipo de reporte. Intenta ser más específico.');
        }
    } catch (err) {
        mostrarErrorReporte(err.message);
    }
}

// ── Generadores por voz ──────────────────────────────────────────────────────

async function _vozRecetas(subtipo = 'requeridos') {
    const endpoint = subtipo === 'insumos'
        ? '/api/reportes/servicios-insumos'
        : '/api/reportes/servicios-requeridos';
    const d = await (await fetch(`${API_BASE}${endpoint}`)).json();
    if (!d.success) throw new Error(d.message);
    if (subtipo === 'insumos') {
        reporteActual.titulo   = 'Top 5 Servicios que Más Insumos Gastan';
        reporteActual.columnas = ['#', 'Servicio', 'Tipos de Insumos', 'Cantidad Total en Receta'];
        reporteActual.datos    = d.datos.map((r, i) => [i + 1, r.nombre_servicio, r.tipos_insumos, r.total_cantidad]);
    } else {
        reporteActual.titulo   = 'Servicios Más Requeridos';
        reporteActual.columnas = ['#', 'Servicio', 'Total Reservas'];
        reporteActual.datos    = d.datos.map((r, i) => [i + 1, r.nombre_servicio, r.total_reservas]);
    }
    reporteActual.tipo = 'recetas';
    renderizarTablaReporte();
}

async function _vozComisiones(ci = '') {
    const url = `${API_BASE}/api/reportes/comisiones${ci ? '?ci=' + encodeURIComponent(ci) : ''}`;
    const d   = await (await fetch(url)).json();
    if (!d.success) throw new Error(d.message);
    const granTotal = d.datos.reduce((s, r) => s + parseFloat(r.total_bs || 0), 0);
    reporteActual.granTotal = granTotal;
    if (!ci) {
        reporteActual.titulo   = 'Reporte de Comisiones — Todos los Empleados';
        reporteActual.columnas = ['Empleado', 'CI', 'Mes', 'Total (Bs)', 'Cantidad'];
        reporteActual.datos    = d.datos.map(r => [r.nombre_empleado, r.ci, mesClaveALabel(r.mes_clave), `Bs. ${parseFloat(r.total_bs).toFixed(2)}`, r.cantidad]);
    } else {
        reporteActual.titulo   = `Comisiones — ${d.datos[0]?.nombre_empleado || ''}`;
        reporteActual.columnas = ['Mes', 'Total (Bs)', 'Cantidad de Comisiones'];
        reporteActual.datos    = d.datos.map(r => [mesClaveALabel(r.mes_clave), `Bs. ${parseFloat(r.total_bs).toFixed(2)}`, r.cantidad]);
    }
    reporteActual.tipo = 'comisiones';
    renderizarTablaReporte();
}

async function _vozReservas() {
    const d = await (await fetch(`${API_BASE}/api/reportes/reservas-mes`)).json();
    if (!d.success) throw new Error(d.message);
    reporteActual.titulo   = 'Reservas por Mes (últimos 12 meses)';
    reporteActual.columnas = ['Mes', 'Total', 'Finalizadas', 'Canceladas', 'Pendientes'];
    reporteActual.datos    = d.datos.map(r => [mesClaveALabel(r.mes_clave), r.total_reservas, r.finalizadas, r.canceladas, r.pendientes]);
    reporteActual.tipo     = 'reservas';
    if (d.datos.length > 0)
        reporteActual.filaDestacada = d.datos.reduce((best, r, i, arr) =>
            parseInt(r.total_reservas) > parseInt(arr[best].total_reservas) ? i : best, 0);
    renderizarTablaReporte();
}

async function _vozBitacora(mes, rol = 'Cliente') {
    if (!mes) {
        const hoy = new Date();
        mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    }
    const url = `${API_BASE}/api/reportes/bitacora-logins?mes=${mes}&rol=${encodeURIComponent(rol)}`;
    const d   = await (await fetch(url)).json();
    if (!d.success) throw new Error(d.message);
    reporteActual.titulo   = `Usuarios con Más Ingresos — ${rol} — ${mesClaveALabel(mes)}`;
    reporteActual.columnas = ['#', 'Usuario', 'CI', 'Rol', 'Ingresos en el Mes'];
    reporteActual.datos    = d.datos.map((r, i) => [i + 1, r.nombre_usuario, r.ci_usuario, r.rol, r.total_logins]);
    reporteActual.tipo     = 'bitacora';
    renderizarTablaReporte();
}

async function _vozFinanciero(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) {
        const hoy = new Date();
        fechaFin    = hoy.toISOString().split('T')[0];
        fechaInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    }
    const url = `${API_BASE}/api/reportes/financiero?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&tipo_reporte=personalizado`;
    const d   = await (await fetch(url)).json();
    if (!d.success) throw new Error(d.message);

    reporteActual.titulo   = `Reporte Financiero — ${fechaInicio} al ${fechaFin}`;
    reporteActual.columnas = ['Método de Pago', 'Transacciones', 'Total (USD)'];
    reporteActual.datos    = d.ingresos.desglose.map(r => [
        r.metodo_pago, r.cantidad, `$${parseFloat(r.total).toFixed(2)}`
    ]);
    reporteActual.tipo        = 'financiero';
    reporteActual.granTotal   = undefined;
    reporteActual.filaDestacada = -1;

    renderizarTablaReporte();

    // Añadir KPIs debajo de la tabla
    const cont = document.getElementById('reportes-resultado');
    cont.innerHTML += `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;">
            <div style="background:#fff8ec;border-radius:8px;padding:14px;text-align:center;border:1px solid #f0e8df;">
                <div style="font-size:20px;font-weight:700;color:#d4a373;">$${parseFloat(d.ingresos.total).toFixed(2)}</div>
                <div style="font-size:11px;color:#aaa;margin-top:4px;">Ingresos totales</div>
            </div>
            <div style="background:#fff8ec;border-radius:8px;padding:14px;text-align:center;border:1px solid #f0e8df;">
                <div style="font-size:20px;font-weight:700;color:#d4a373;">$${parseFloat(d.comisiones.total).toFixed(2)}</div>
                <div style="font-size:11px;color:#aaa;margin-top:4px;">Comisiones</div>
            </div>
            <div style="background:#fff8ec;border-radius:8px;padding:14px;text-align:center;border:1px solid #f0e8df;">
                <div style="font-size:20px;font-weight:700;color:#b5813a;">$${parseFloat(d.ganancia_neta).toFixed(2)}</div>
                <div style="font-size:11px;color:#aaa;margin-top:4px;">Ganancia neta</div>
            </div>
        </div>`;
    document.getElementById('reportes-acciones').style.display = 'flex';
}
