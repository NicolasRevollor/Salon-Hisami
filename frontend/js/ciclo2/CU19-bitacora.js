// =============================================================================
// CU19-bitacora.js — BITÁCORA DEL SISTEMA (panel administrador)
// Ciclo 2 — Auditoría y trazabilidad de acciones
// Muestra todos los eventos registrados en la tabla `bitacora` de la BD.
// Acciones registradas: LOGIN, LOGOUT, CREAR_RESERVA, EDITAR_RESERVA,
//                       CANCELAR_RESERVA, COMPLETAR_RESERVA.
// BD: bitacora(id_bitacora, ci_usuario, nombre_usuario, rol, accion, descripcion, fecha_hora)
// Depende de: main.js (API_BASE)
// =============================================================================

// Etiquetas legibles en español y colores por tipo de acción registrada
const ACCION_ESTILOS = {
    LOGIN:             { texto: 'Inicio sesión',   color: '#27ae60' },
    LOGOUT:            { texto: 'Cierre sesión',   color: '#7f8c8d' },
    CREAR_RESERVA:     { texto: 'Nueva reserva',   color: '#2980b9' },
    EDITAR_RESERVA:    { texto: 'Editó reserva',   color: '#f39c12' },
    CANCELAR_RESERVA:  { texto: 'Canceló reserva', color: '#e74c3c' },
    COMPLETAR_RESERVA: { texto: 'Completó reserva',color: '#8e44ad' },
};

// Carga y muestra todos los eventos de la bitácora desde la BD, ordenados del más reciente.
// Usa ACCION_ESTILOS para mostrar cada tipo de acción con su etiqueta y color correspondientes.
async function cargarBitacoraAdmin() {
    const tbody = document.getElementById('tabla-admin-bitacora-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Cargando...</td></tr>';

    try {
        const res  = await fetch(API_BASE + '/api/admin/bitacora');
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#e74c3c;padding:20px;">Error al cargar la bitácora.</td></tr>';
            return;
        }
        if (!data.eventos.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Sin eventos registrados aún.</td></tr>';
            return;
        }

        tbody.innerHTML = data.eventos.map(ev => {
            // Usar el estilo del mapa o un fallback genérico si la acción no está mapeada
            const estilo = ACCION_ESTILOS[ev.accion] || { texto: ev.accion, color: '#333' };
            // Color del badge de estado: verde si Exitoso, rojo si Fallido, gris si otro
            const estadoColor = ev.estado === 'Exitoso' ? '#27ae60' : ev.estado === 'Fallido' ? '#e74c3c' : '#7f8c8d';
            return `
                <tr>
                    <td>${ev.fecha_hora || '—'}</td>
                    <td>${ev.nombre_usuario || '—'}</td>
                    <td>${ev.rol || '—'}</td>
                    <td>
                        <span style="display:inline-block;padding:3px 10px;border-radius:12px;
                                     background:${estilo.color}22;color:${estilo.color};
                                     font-size:12px;font-weight:600;">
                            ${estilo.texto}
                        </span>
                    </td>
                    <td>
                        <span style="display:inline-block;padding:3px 10px;border-radius:12px;
                                     background:${estadoColor}22;color:${estadoColor};
                                     font-size:12px;font-weight:600;">
                            ${ev.estado || '—'}
                        </span>
                    </td>
                    <td style="font-size:13px;color:#555;">${ev.descripcion || '—'}</td>
                </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#e74c3c;padding:20px;">Error de conexión al cargar la bitácora.</td></tr>';
    }
}
