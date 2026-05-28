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

    document.getElementById('reportes-tabs').innerHTML = tabs.map(t =>
        `<button class="btn-tab-reporte" id="tab-rep-${t.id}" onclick="seleccionarTabReporte('${t.id}')">${t.label}</button>`
    ).join('');

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
