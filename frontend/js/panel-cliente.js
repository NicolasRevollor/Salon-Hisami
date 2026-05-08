// =============================================================================
// CU4-cliente.js — PANEL DEL CLIENTE: MIS CITAS, CANCELAR Y FAVORITOS
// Maneja las pestañas "Mis Citas" y "Favoritos" del panel de cliente.
// Los favoritos se guardan en localStorage del navegador (sin BD).
// Depende de: main.js (API_BASE, usuarioActual, mostrarToast, formatearFecha, abrirModalReserva)
// =============================================================================

// =============================================================================
// PESTAÑAS DEL PANEL CLIENTE
// Muestra u oculta las vistas "Mis Citas" (#vista-cli-citas) y
// "Favoritos" (#vista-cli-favoritos) según la pestaña clickeada.
// =============================================================================
function cambiarTabCliente(tab) {
    // Recorrer ambas pestañas y ocultar/mostrar según cuál esté activa
    ['citas', 'favoritos'].forEach(t => {
        const vista  = document.getElementById('vista-cli-' + t);
        const boton  = document.getElementById('tab-cli-' + t);
        if (vista)  vista.classList.toggle('seccion-oculta', t !== tab); // ocultar si NO es la tab activa
        if (boton)  boton.classList.toggle('active', t === tab);         // marcar como activo si SÍ es la tab
    });
    // Al entrar a Favoritos, renderizar la lista actualizada
    if (tab === 'favoritos') renderizarFavoritos();
}

// =============================================================================
// MIS RESERVAS — carga y muestra las reservas del cliente como acordeones
// Cada reserva es un elemento desplegable con todos sus detalles + botones de acción
// =============================================================================
async function cargarReservasCliente() {
    if (!usuarioActual) return; // nunca se debe llamar sin usuario logueado

    const cont = document.getElementById('contenedor-mis-reservas');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Cargando...</p>';

    try {
        const res  = await fetch(`${API_BASE}/api/reservas/cliente/${usuarioActual.ci}`);
        const data = await res.json();
        cont.innerHTML = '';

        if (data.success && data.reservas.length > 0) {
            data.reservas.forEach(r => {
                const fecha      = formatearFecha(r.fecha); // "15 de enero de 2025"
                const hora       = r.hora ? String(r.hora).substring(0, 5) : '—'; // "14:30"
                const esCfm        = r.estado === 'Confirmada';
                const cancelable   = r.estado !== 'Cancelada' && r.estado !== 'Finalizada';
                const reprogramable = cancelable && (r.reprogramaciones || 0) === 0;

                // Escapar comillas simples del nombre para que no rompa el onclick inline
                const nomEst = (r.nombre_esteticista || '').replace(/'/g, "\\'");
                const ciEst  = r.ci_esteticista || '';

                const div = document.createElement('div');
                div.className = 'reserva-acordeon';
                div.innerHTML = `
                    <button type="button" class="reserva-acordeon-btn" onclick="toggleReservaDetalle(this)">
                        <div class="reserva-acordeon-info">
                            <span class="reserva-acordeon-titulo">${r.nombre_item || 'Sin especificar'}</span>
                            <span class="reserva-acordeon-fecha">${fecha} — ${hora}</span>
                        </div>
                        <span class="badge ${esCfm ? 'confirmada' : 'pendiente'}">${r.estado}</span>
                        <span class="acordeon-arrow">▼</span>
                    </button>
                    <div class="reserva-acordeon-detalle">
                        <p><strong>Servicio/Paquete:</strong> ${r.nombre_item || '—'}</p>
                        <p><strong>Esteticista:</strong> ${r.nombre_esteticista || '—'}</p>
                        <p><strong>Fecha:</strong> ${fecha}</p>
                        <p><strong>Hora:</strong> ${hora}</p>
                        <p><strong>Método de pago:</strong> ${r.metodo_pago || '—'}</p>
                        <p><strong>Monto:</strong> Bs ${r.monto ? parseFloat(r.monto).toFixed(2) : '—'}</p>
                        <p><strong>Estado:</strong> <span class="badge ${esCfm ? 'confirmada' : 'pendiente'}">${r.estado}</span></p>
                        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
                            ${cancelable
                                ? `<button class="btn-cancelar-reserva" onclick="cancelarReserva(${r.id_cita})">Cancelar</button>`
                                : ''}
                            ${reprogramable
                                ? `<button class="btn-outline-dark" style="font-size:13px;"
                                    onclick="abrirModalEditarReserva(${r.id_cita},'${r.fecha?.substring(0,10)||''}','${hora}')">
                                    ✎ Reprogramar</button>`
                                : (cancelable
                                    ? `<span style="font-size:12px;color:#999;align-self:center;">Ya reprogramada</span>`
                                    : '')}
                            ${ciEst
                                ? `<button class="btn-outline-dark" style="font-size:13px;"
                                    onclick="guardarFavorito({ci:'${ciEst}',nombre:'${nomEst}',especialidades:'${(r.especialidades || '').replace(/'/g,"\\'")}'})"
                                    >★ Favorita</button>`
                                : ''}
                        </div>
                    </div>`;
                cont.appendChild(div);
            });
        } else {
            cont.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">No tienes reservas aún. ¡Haz tu primera cita!</p>';
        }
    } catch {
        cont.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Error al cargar reservas. Verifica tu conexión.</p>';
    }
}

// Abre o cierra el panel de detalles de una reserva acordeón.
// btn → el botón header que fue clickeado
function toggleReservaDetalle(btn) {
    const detalle = btn.nextElementSibling; // el div de detalles está justo después del botón
    const arrow   = btn.querySelector('.acordeon-arrow');
    const abierto = detalle.classList.toggle('abierto'); // alterna la clase
    if (arrow) arrow.classList.toggle('rotado', abierto); // rotar la flecha ▼ → ▲
}

// Alias para el botón "Nueva Reserva" del panel cliente
function nuevaReserva() { abrirModalReserva(); }

// =============================================================================
// CANCELAR RESERVA
// Pide confirmación → llama al servidor (DELETE) → refresca la lista.
// El servidor envía correos a cliente y esteticista antes de borrar.
// =============================================================================
async function cancelarReserva(id_cita) {
    if (!confirm('¿Estás segura de que deseas cancelar esta reserva?\nEsta acción no se puede deshacer y se enviará un correo de notificación.')) return;

    try {
        const res  = await fetch(`${API_BASE}/api/reservas/${id_cita}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Reserva cancelada. Recibirás un correo de confirmación.');
            cargarReservasCliente(); // refrescar la lista de reservas
        } else {
            mostrarToast(data.message || 'Error al cancelar la reserva', 'error');
        }
    } catch { mostrarToast('Error de conexión al cancelar', 'error'); }
}

// =============================================================================
// FAVORITOS — guardados en localStorage del navegador
// localStorage es un almacenamiento del navegador que persiste entre sesiones.
// Guardamos un array JSON: [{ ci, nombre, especialidades }, ...]
// =============================================================================

// Devuelve el array de favoritos desde localStorage (o array vacío si no hay nada guardado)
function getFavoritos() {
    return JSON.parse(localStorage.getItem('hisami_favoritos') || '[]');
}

// Agrega una esteticista a favoritos si no está ya guardada.
// est → { ci, nombre, especialidades }
function guardarFavorito(est) {
    const favs = getFavoritos();
    // Verificar que no esté duplicada comparando por CI (identificador único)
    if (favs.find(f => f.ci === est.ci)) {
        mostrarToast(`${est.nombre} ya está en tus favoritas`); return;
    }
    favs.push(est);
    localStorage.setItem('hisami_favoritos', JSON.stringify(favs));
    mostrarToast(`★ ${est.nombre} agregada a favoritas`);
}

// Elimina una esteticista de favoritos por su CI y refresca la vista
function eliminarFavorito(ci) {
    const favs = getFavoritos().filter(f => f.ci !== ci); // excluir la que se quiere quitar
    localStorage.setItem('hisami_favoritos', JSON.stringify(favs));
    renderizarFavoritos(); // actualizar la lista en pantalla
    mostrarToast('Esteticista eliminada de favoritas');
}

// Renderiza las tarjetas de esteticistas favoritas en el contenedor #contenedor-favoritos
function renderizarFavoritos() {
    const cont = document.getElementById('contenedor-favoritos');
    if (!cont) return;

    const favs = getFavoritos();
    if (!favs.length) {
        cont.innerHTML = `<p style="color:#999;text-align:center;padding:30px;">
            Aún no tienes esteticistas favoritas.<br>
            Guárdalas desde el detalle de tus reservas (★ Guardar esteticista).
        </p>`;
        return;
    }

    cont.innerHTML = '';
    favs.forEach(est => {
        // Escapar comillas simples del nombre para que no rompa el onclick inline
        const nombreSafe = (est.nombre || '').replace(/'/g, "\\'");
        const card = document.createElement('div');
        card.className = 'reserva-acordeon';
        card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:18px 25px;flex-wrap:wrap;gap:10px;';
        card.innerHTML = `
            <div>
                <strong style="font-size:15px;">${est.nombre || '—'}</strong>
                ${est.especialidades ? `<p style="color:#888;font-size:13px;margin:4px 0 0;">${est.especialidades}</p>` : ''}
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn-reservar"
                    onclick="reservarConFavorita('${est.ci}','${nombreSafe}')">Reservar</button>
                <button class="btn-outline-dark"
                    onclick="eliminarFavorito('${est.ci}')" style="font-size:13px;">✕ Quitar</button>
            </div>`;
        cont.appendChild(card);
    });
}

// Abre el modal de reserva pre-configurado para una esteticista favorita.
function reservarConFavorita(ci, nombre) {
    cambiarTabCliente('citas');
    window._preselFavCi = ci;
    abrirModalReserva();
    mostrarToast(`Selecciona el servicio para continuar con ${nombre}`);
}

// =============================================================================
// REPROGRAMAR / EDITAR RESERVA (CU3 — modificar)
// Permite cambiar la fecha y hora de una cita pendiente o confirmada.
// =============================================================================

function abrirModalEditarReserva(id_cita, fecha, hora) {
    document.getElementById('edit-reserva-id').value    = id_cita;
    document.getElementById('edit-reserva-fecha').value = fecha;

    // Poblar el select de horas con las mismas opciones del modal de reserva
    const selHora = document.getElementById('edit-reserva-hora');
    const horas   = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
    selHora.innerHTML = horas.map(h =>
        `<option value="${h}" ${h === hora ? 'selected' : ''}>${h}</option>`
    ).join('');

    document.getElementById('modal-editar-reserva').classList.remove('seccion-oculta');
}

function cerrarModalEditarReserva() {
    document.getElementById('modal-editar-reserva').classList.add('seccion-oculta');
}

async function manejarEditarReserva(e) {
    e.preventDefault();
    const id_cita = document.getElementById('edit-reserva-id').value;
    const fecha   = document.getElementById('edit-reserva-fecha').value;
    const hora    = document.getElementById('edit-reserva-hora').value;

    if (!fecha || !hora) { mostrarToast('Elige fecha y hora', 'error'); return; }

    // Validar que la fecha no sea en el pasado
    const [y, m, d] = fecha.split('-').map(Number);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (new Date(y, m - 1, d) < hoy) {
        mostrarToast('La fecha no puede ser en el pasado', 'error'); return;
    }

    try {
        const res  = await fetch(`${API_BASE}/api/reservas/${id_cita}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                fecha, hora,
                ci_usuario:     usuarioActual.ci,
                nombre_usuario: usuarioActual.nombre,
                rol:            usuarioActual.rol
            })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Cita reprogramada exitosamente');
            cerrarModalEditarReserva();
            cargarReservasCliente();
        } else {
            mostrarToast(data.message || 'Error al reprogramar', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
}
