// =============================================================================
// CU3-reservar.js — RESERVAR CITA (modal completo de reserva)
// Flujo: elegir tipo (servicio/paquete) → item → fecha → esteticista(s)
//        → hora → método de pago → revisar disponibilidad → confirmar
// Depende de: main.js (API_BASE, usuarioActual, mostrarToast, mostrarSeccion,
//             getEsteticistasSeleccionadas, formatearFecha, formatearFechaCorta)
//             CU4-cliente.js (cargarReservasCliente — para refrescar después de confirmar)
// =============================================================================

// Plantilla HTML del select vacío de esteticista (se muestra cuando no hay servicio elegido aún)
const SELECT_EST_BASE = `<select id="reserva-esteticista" onchange="cargarHorasDisponibles()"
    style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
    <option value="">-- Selecciona un servicio primero --</option>
</select>`;

// =============================================================================
// Abre el modal de reserva. Si el usuario NO está logueado, redirige al login.
// Resetea el formulario a su estado inicial.
// =============================================================================
async function abrirModalReserva() {
    if (!usuarioActual) { mostrarSeccion('login'); return; } // el modal solo existe para logueados

    document.getElementById('form-reserva').reset();
    document.getElementById('reserva-esteticista-container').innerHTML = SELECT_EST_BASE;
    document.getElementById('resumen-reserva').style.display  = 'none';
    document.getElementById('btn-confirmar-reserva').style.display = 'none';

    await cargarItemsReserva(); // cargar servicios o paquetes según el tipo seleccionado
    document.getElementById('modal-reserva').classList.remove('seccion-oculta');
}

// Cierra el modal de reserva sin guardar nada
function cerrarModalReserva() {
    document.getElementById('modal-reserva').classList.add('seccion-oculta');
}

// Se llama cuando el usuario cambia entre las opciones "Servicio" y "Paquete".
// Resetea los campos dependientes para evitar datos mezclados.
async function cambiarTipoReserva() {
    await cargarItemsReserva(); // recargar el select de items según el nuevo tipo
    document.getElementById('reserva-esteticista-container').innerHTML = SELECT_EST_BASE;
    document.getElementById('label-esteticista-res').textContent = 'Esteticista';
    document.getElementById('reserva-hora').innerHTML = '<option value="">-- Elige fecha y esteticista --</option>';
    document.getElementById('resumen-reserva').style.display = 'none';
}

// Carga el <select id="reserva-item"> con servicios o paquetes según el tipo seleccionado
async function cargarItemsReserva() {
    const tipo  = document.querySelector('input[name="tipo-reserva"]:checked')?.value || 'servicio';
    const label = document.getElementById('label-item-reserva');
    const sel   = document.getElementById('reserva-item');
    sel.innerHTML = '<option value="">-- Selecciona --</option>';

    if (tipo === 'servicio') {
        label.textContent = 'Servicio';
        try {
            const res  = await fetch(API_BASE + '/api/servicios');
            const data = await res.json();
            if (data.success) {
                data.servicios.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value       = s.id_servicio;
                    opt.textContent = `${s.nombre_servicio} — Bs ${parseFloat(s.precio).toFixed(2)}`;
                    opt.dataset.tipo = 'servicio';
                    sel.appendChild(opt);
                });
            }
        } catch { mostrarToast('Error cargando servicios', 'error'); }

    } else {
        // PAQUETE: mostrar nombre, precio y vigencia en cada opción
        label.textContent = 'Paquete Promocional';
        try {
            const res  = await fetch(API_BASE + '/api/servicios'); // el endpoint devuelve servicios Y paquetes
            const data = await res.json();
            if (data.success && data.paquetes) {
                data.paquetes.forEach(p => {
                    const opt = document.createElement('option');
                    // Calcular texto de vigencia si el paquete tiene fechas definidas
                    let vigencia = '';
                    if (p.fecha_inicio || p.fecha_final) {
                        const ini = p.fecha_inicio ? formatearFechaCorta(p.fecha_inicio) : '?';
                        const fin = p.fecha_final  ? formatearFechaCorta(p.fecha_final)  : '?';
                        vigencia = ` | Vigencia: ${ini} → ${fin}`;
                    }
                    opt.value       = p.id_paquete;
                    opt.textContent = `${p.nombre} — Bs ${parseFloat(p.precio_promocional || 0).toFixed(2)}${vigencia}`;
                    opt.dataset.tipo = 'paquete';
                    sel.appendChild(opt);
                });
            }
        } catch { mostrarToast('Error cargando paquetes', 'error'); }
    }
}

// =============================================================================
// Se llama cuando el usuario elige un servicio o paquete del select.
// Carga las esteticistas disponibles filtradas por especialidad.
//   - Servicio  → muestra un <select> único de esteticista
//   - Paquete   → muestra checkboxes (puede elegir varias esteticistas)
// =============================================================================
async function cargarEsteticistasParaItem() {
    const tipo  = document.querySelector('input[name="tipo-reserva"]:checked')?.value || 'servicio';
    const id    = document.getElementById('reserva-item').value;
    const cont  = document.getElementById('reserva-esteticista-container');
    const label = document.getElementById('label-esteticista-res');

    // Resetear hora y resumen porque cambiaron las opciones
    document.getElementById('reserva-hora').innerHTML = '<option value="">-- Elige esteticista primero --</option>';
    document.getElementById('resumen-reserva').style.display = 'none';

    if (!id) { cont.innerHTML = SELECT_EST_BASE; return; } // nada seleccionado → select vacío

    cont.innerHTML = '<p style="color:#999;font-size:13px;padding:8px 0;">Cargando esteticistas...</p>';
    try {
        // La URL cambia según el tipo: para paquete usa id_paquete, para servicio usa id_servicio
        // El servidor filtrará las esteticistas cuya especialidad coincida con la categoría del item
        const url = tipo === 'servicio'
            ? `${API_BASE}/api/esteticistas?id_servicio=${id}`
            : `${API_BASE}/api/esteticistas?id_paquete=${id}`;
        const res  = await fetch(url);
        const data = await res.json();
        const ests = data.esteticistas || [];

        if (tipo === 'servicio') {
            // SERVICIO: select único, solo puede elegirse 1 esteticista
            label.textContent = 'Esteticista';
            cont.innerHTML = `<select id="reserva-esteticista" onchange="cargarHorasDisponibles()"
                style="width:100%;padding:10px;border:none;border-bottom:1px solid #aaa;outline:none;background:transparent;font-family:inherit;">
                <option value="">-- Selecciona esteticista --</option>
            </select>`;
            const sel = document.getElementById('reserva-esteticista');
            ests.forEach(est => {
                const opt = document.createElement('option');
                opt.value       = est.ci;
                opt.textContent = `${est.nombre}${est.especialidades ? ' (' + est.especialidades + ')' : ''}`;
                sel.appendChild(opt);
            });
            if (!ests.length) sel.innerHTML = '<option value="">Sin esteticistas disponibles para este servicio</option>';

            // Si se llegó aquí desde "Reservar con favorita", pre-seleccionar la esteticista
            if (window._preselFavCi) {
                sel.value = window._preselFavCi;
                if (sel.value) {
                    cargarHorasDisponibles(); // cargar horas para la esteticista pre-seleccionada
                } else {
                    mostrarToast('La esteticista favorita no atiende este servicio', 'error');
                }
                window._preselFavCi = null; // limpiar para no volver a pre-seleccionar
            }

        } else {
            // PAQUETE: checkboxes, puede seleccionarse 1 o más esteticistas
            label.textContent = 'Esteticistas (puede seleccionar varias)';
            cont.innerHTML = `<div id="reserva-esteticistas-checks"
                style="max-height:150px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:6px;"></div>`;
            const checksDiv = document.getElementById('reserva-esteticistas-checks');
            if (ests.length > 0) {
                ests.forEach(est => {
                    const lbl = document.createElement('label');
                    lbl.className = 'est-check-item';
                    const cb = document.createElement('input');
                    cb.type  = 'checkbox';
                    cb.value = est.ci;
                    cb.dataset.nombre = est.nombre; // guardado en data-nombre para leerlo en getEsteticistasSeleccionadas
                    cb.addEventListener('change', cargarHorasDisponibles);
                    lbl.appendChild(cb);
                    lbl.appendChild(document.createTextNode(
                        ` ${est.nombre}${est.especialidades ? ' (' + est.especialidades + ')' : ''}`
                    ));
                    checksDiv.appendChild(lbl);
                });
            } else {
                checksDiv.innerHTML = '<p style="color:#888;font-size:13px;padding:8px;">Sin esteticistas disponibles para este paquete</p>';
            }
        }
    } catch { cont.innerHTML = '<p style="color:red;font-size:13px;">Error al cargar esteticistas. Intenta de nuevo.</p>'; }
}

// =============================================================================
// Muestra TODAS las horas disponibles (09:00 – 18:00) en el select de hora.
// NO filtra las horas ocupadas aquí — el filtrado ocurre en "Revisar Disponibilidad".
// Esto permite que el usuario elija cualquier hora y luego le decimos si hay conflicto.
// =============================================================================
function cargarHorasDisponibles() {
    const selHora = document.getElementById('reserva-hora');
    const ests    = getEsteticistasSeleccionadas();
    const fecha   = document.getElementById('reserva-fecha').value;

    // Solo activar el select de horas cuando ya hay fecha y esteticista elegidas
    if (!fecha || !ests.length) return;

    const todasHoras = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
    selHora.innerHTML = '<option value="">-- Selecciona hora --</option>';
    todasHoras.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h; opt.textContent = h;
        selHora.appendChild(opt);
    });
}

// =============================================================================
// "Revisar Disponibilidad" — verifica si cada esteticista elegida está libre
// en la fecha y hora seleccionadas.
// Si todas están disponibles → muestra el botón "Confirmar Reserva".
// Si alguna no está disponible → muestra error con su nombre.
// =============================================================================
async function revisarReserva() {
    const tipo     = document.querySelector('input[name="tipo-reserva"]:checked')?.value;
    const selItem  = document.getElementById('reserva-item');
    const itemId   = selItem.value;
    const itemText = selItem.options[selItem.selectedIndex]?.text || '';
    const fecha    = document.getElementById('reserva-fecha').value;
    const hora     = document.getElementById('reserva-hora').value;
    const pago     = document.getElementById('reserva-pago').value;
    const ests     = getEsteticistasSeleccionadas();

    // Validar que todos los campos estén completos antes de verificar
    if (!itemId)      { mostrarToast('Selecciona un servicio o paquete', 'error'); return; }
    if (!fecha)       { mostrarToast('Selecciona la fecha', 'error'); return; }
    if (!ests.length) { mostrarToast('Selecciona al menos una esteticista', 'error'); return; }
    if (!hora)        { mostrarToast('Selecciona la hora', 'error'); return; }
    if (!pago)        { mostrarToast('Selecciona el método de pago', 'error'); return; }

    // Verificar que la fecha no sea en el pasado (comparación sin zona horaria)
    const [y, m, d] = fecha.split('-').map(Number);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (new Date(y, m - 1, d) < hoy) {
        mostrarToast('La fecha no puede ser en el pasado', 'error'); return;
    }

    // Mostrar el resumen de la reserva para que el usuario lo revise
    const divResumen  = document.getElementById('resumen-reserva');
    const contResumen = document.getElementById('resumen-contenido');
    const divDisp     = document.getElementById('disponibilidad-estado');
    const btnConfirm  = document.getElementById('btn-confirmar-reserva');

    contResumen.innerHTML = `
        <p><strong>${tipo === 'servicio' ? 'Servicio' : 'Paquete'}:</strong> ${itemText}</p>
        <p><strong>Fecha:</strong> ${formatearFecha(fecha)}</p>
        <p><strong>Esteticista(s):</strong> ${ests.map(e => e.nombre).join(', ')}</p>
        <p><strong>Hora:</strong> ${hora}</p>
        <p><strong>Pago:</strong> ${pago === 'efectivo' ? 'Efectivo' : 'Código QR'}</p>`;
    divResumen.style.display = 'block';
    divDisp.innerHTML = '<span style="color:#888;">Verificando disponibilidad...</span>';
    btnConfirm.style.display = 'none';

    try {
        // Verificar en paralelo la disponibilidad de TODAS las esteticistas elegidas
        const resultados = await Promise.all(ests.map(est =>
            fetch(`${API_BASE}/api/verificar-disponibilidad?ci_esteticista=${est.ci}&fecha=${fecha}&hora=${hora}`)
                .then(r => r.json())
                .then(d => ({ nombre: est.nombre, disponible: d.disponible }))
                .catch(() => ({ nombre: est.nombre, disponible: true })) // si falla la verificación, asumir disponible
        ));

        const noDisponibles = resultados.filter(r => !r.disponible);
        if (noDisponibles.length === 0) {
            // ✓ Todas disponibles → habilitar el botón de confirmar
            divDisp.innerHTML = `<span class="disp-ok">✓ ${ests.length > 1
                ? 'Todas las esteticistas están disponibles' : 'La esteticista está disponible'} en ese horario</span>`;
            btnConfirm.style.display = 'block';
        } else {
            // ✗ Una o más esteticistas tienen choque → mostrar quiénes son
            const nombres = noDisponibles.map(r => r.nombre).join(', ');
            divDisp.innerHTML = `<span class="disp-error">✕ ${nombres} ya tiene(n) una reserva en ese horario. Por favor elige otra hora.</span>`;
            btnConfirm.style.display = 'none';
        }
    } catch {
        // Si la verificación falla por red, mostrar igual el botón para no bloquear al usuario
        divDisp.innerHTML = '<span style="color:#888;">No se pudo verificar disponibilidad. Puedes intentar confirmar de todas formas.</span>';
        btnConfirm.style.display = 'block';
    }
}

// =============================================================================
// Confirma y guarda la(s) reserva(s) en la BD.
// Si es un paquete con múltiples esteticistas, el servidor crea una reserva por cada una.
// =============================================================================
async function manejarConfirmarReserva(e) {
    e.preventDefault();

    const tipo   = document.querySelector('input[name="tipo-reserva"]:checked')?.value;
    const itemId = document.getElementById('reserva-item').value;
    const fecha  = document.getElementById('reserva-fecha').value;
    const hora   = document.getElementById('reserva-hora').value;
    const pago   = document.getElementById('reserva-pago').value;
    const ests   = getEsteticistasSeleccionadas();

    try {
        const res  = await fetch(API_BASE + '/api/reservas', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                ci_cliente:      usuarioActual.ci,
                ci_esteticistas: ests.map(e => e.ci), // array de CIs (1 o varios)
                fecha,
                hora,
                metodo_pago:  pago,
                id_servicio:  tipo === 'servicio' ? itemId : null,
                id_paquete:   tipo === 'paquete'  ? itemId : null
            })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast(data.message || '¡Reserva confirmada!');
            cerrarModalReserva();
            cargarReservasCliente(); // refrescar "Mis Citas" en el panel del cliente
        } else {
            mostrarToast(data.message || 'Error al confirmar la reserva', 'error');
        }
    } catch { mostrarToast('Error de conexión al confirmar', 'error'); }
}
