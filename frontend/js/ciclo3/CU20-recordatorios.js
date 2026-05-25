// =============================================================================
// CU20-recordatorios.js — Gestionar Recordatorios de Cita Automáticos
// Ciclo 3
//
// ¿Qué hace este archivo?
//   Permite al administrador enviar correos de recordatorio a los clientes
//   que tienen citas programadas en una fecha específica.
//
// ¿Cómo funciona?
//   1. El admin selecciona una fecha en el selector de fecha
//   2. Presiona "Buscar Citas" → buscarCitasParaRecordatorio()
//      → pide al backend las citas Pendientes/Confirmadas de ese día
//      → muestra una tabla con checkboxes (uno por cita)
//   3. Los clientes con correo vienen con el checkbox marcado por defecto
//   4. Los clientes SIN correo aparecen con el checkbox deshabilitado (no se les puede mandar)
//   5. El admin desmarca los que no quiere incluir y presiona "Enviar Recordatorios"
//   6. enviarRecordatoriosSeleccionados() → filtra los checkboxes marcados
//      → manda al backend solo las citas seleccionadas
//      → el backend envía los correos uno por uno
//   7. Se muestra un toast con cuántos se enviaron y cuántos fallaron
//
// Depende de:
//   main.js → API_BASE, usuarioActual, mostrarToast, formatearFecha
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// buscarCitasParaRecordatorio
// Pide las citas de la fecha seleccionada y las muestra en la tabla con checkboxes.
// ─────────────────────────────────────────────────────────────────────────────
async function buscarCitasParaRecordatorio() {
    // Leer la fecha del input de tipo date
    const fechaInput = document.getElementById('recor-fecha');
    const fecha = fechaInput?.value; // formato YYYY-MM-DD

    if (!fecha) { mostrarToast('Selecciona una fecha', 'error'); return; }

    const tbody  = document.getElementById('tabla-recordatorios-body');
    const btnEnv = document.getElementById('btn-enviar-recordatorios'); // botón "Enviar Recordatorios"
    if (!tbody) return;

    // Mostrar carga y ocultar el botón de enviar (aparecerá solo si hay citas)
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Buscando citas...</td></tr>';
    if (btnEnv) btnEnv.style.display = 'none';

    try {
        // GET al backend con la fecha como parámetro de consulta (?fecha=...)
        const res  = await fetch(`${API_BASE}/api/ciclo3/citas-proximas?fecha=${fecha}`);
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#e74c3c;padding:20px;">${data.message}</td></tr>`;
            return;
        }

        // Si no hay citas ese día, mostrar mensaje informativo
        if (!data.citas.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">
                No hay citas Pendientes o Confirmadas para el ${formatearFecha(fecha)}.</td></tr>`;
            return;
        }

        // Hay citas → mostrar el botón de enviar
        if (btnEnv) btnEnv.style.display = '';

        // Dibujar una fila por cada cita, con checkbox incluido
        tbody.innerHTML = data.citas.map((c, idx) => {
            const tieneEmail = !!c.email_cliente; // true si tiene correo, false si no
            return `
                <tr>
                    <!-- Checkbox: marcado si tiene email, deshabilitado si no -->
                    <td style="padding:10px;">
                        <input type="checkbox" id="chk-cita-${idx}" value="${idx}"
                               ${tieneEmail ? 'checked' : 'disabled'}
                               data-idx="${idx}">
                               <!-- data-idx guarda el índice para encontrarlo en el array después -->
                    </td>
                    <td style="padding:10px;">${c.nombre_cliente}</td>
                    <td style="padding:10px;">${c.hora_inicio || '—'}</td>
                    <td style="padding:10px;font-size:13px;color:#555;">${c.servicios || '—'}</td>
                    <td style="padding:10px;">
                        ${tieneEmail
                            ? `<span style="font-size:13px;color:#555;">${c.email_cliente}</span>`
                            : '<span style="color:#e74c3c;font-size:12px;">Sin correo</span>'}
                    </td>
                </tr>`;
        }).join('');

        // Guardar el array de citas en el atributo data del tbody
        // Así cuando el admin presione "Enviar" podemos leerlas sin volver a pedirlas al servidor
        document.getElementById('tabla-recordatorios-body').dataset.citas = JSON.stringify(data.citas);
    } catch {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#e74c3c;padding:20px;">Error de conexión.</td></tr>';
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// enviarRecordatoriosSeleccionados
// Lee los checkboxes marcados y manda los correos solo a esas citas.
// ─────────────────────────────────────────────────────────────────────────────
async function enviarRecordatoriosSeleccionados() {
    const tbody = document.getElementById('tabla-recordatorios-body');
    if (!tbody) return;

    // Recuperar el array de citas guardado en el dataset del tbody
    let citas = [];
    try { citas = JSON.parse(tbody.dataset.citas || '[]'); } catch { citas = []; }

    // Obtener todos los checkboxes que están marcados (checked = true)
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]:checked');

    // Leer el índice (data-idx) de cada checkbox marcado → saber qué citas incluir
    const indices = Array.from(checkboxes).map(ch => Number(ch.dataset.idx));

    // Filtrar el array de citas: solo las que corresponden a los índices marcados
    const seleccionadas = citas.filter((_, i) => indices.includes(i));

    if (!seleccionadas.length) {
        mostrarToast('No hay citas seleccionadas para enviar.', 'error');
        return;
    }

    // Deshabilitar el botón mientras se envían los correos (evita doble clic)
    const btn = document.getElementById('btn-enviar-recordatorios');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
        // POST al backend con las citas seleccionadas para que mande los correos
        const res  = await fetch(`${API_BASE}/api/ciclo3/recordatorios`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                citas:        seleccionadas, // solo las que el admin seleccionó
                ci_admin:     usuarioActual?.ci,
                nombre_admin: usuarioActual?.nombre,
                rol_admin:    usuarioActual?.rol
            })
        });
        const data = await res.json();

        // Mostrar resultado: cuántos correos se enviaron y cuántos fallaron
        mostrarToast(
            `Recordatorios enviados: ${data.enviados}. Errores: ${data.errores}.`,
            data.enviados > 0 ? 'success' : 'error'
        );
    } catch {
        mostrarToast('Error al enviar recordatorios.', 'error');
    } finally {
        // Rehabilitar el botón sin importar si tuvo éxito o no
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar Recordatorios'; }
    }
}
