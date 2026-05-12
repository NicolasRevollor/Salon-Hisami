// =============================================================================
// CU2-catalogo.js — CATÁLOGO PÚBLICO DE SERVICIOS (página principal / landing)
// Muestra las tarjetas de servicios con filtros por categoría,
// y la sección de paquetes promocionales.
// Esta sección es visible para TODOS (logueados o no).
// Depende de: main.js (API_BASE, catalogoCompleto)
// =============================================================================

// =============================================================================
// Carga los servicios, categorías y paquetes desde la BD al mismo tiempo.
// Promise.all() espera que AMBAS peticiones terminen antes de procesar los datos.
// =============================================================================
async function cargarServiciosDeBD() {
    try {
        // Hacer las dos peticiones en paralelo para no esperar una por una
        const [resServ, resCat] = await Promise.all([
            fetch(API_BASE + '/api/servicios'),
            fetch(API_BASE + '/api/categorias')
        ]);
        const [dataServ, dataCat] = await Promise.all([resServ.json(), resCat.json()]);

        if (dataServ.success) {
            catalogoCompleto = dataServ.servicios; // guardar en variable global para filtrar sin pedir de nuevo
            mostrarServicios(dataServ.servicios);
            mostrarPaquetes(dataServ.paquetes || []); // también mostrar los paquetes promocionales
        }
        if (dataCat.success) {
            generarBotonesFiltro(dataCat.categorias); // crear los botones "Todos | Manicura | Pedicura..."
        }
    } catch (err) {
        console.error('Error al cargar el catálogo:', err);
    }
}

// Genera dinámicamente los botones de filtro (uno por categoría + el botón "Todos")
// Se insertan en el elemento con id="contenedor-filtros" del HTML
function generarBotonesFiltro(categorias) {
    const cont = document.getElementById('contenedor-filtros');
    if (!cont) return;
    cont.innerHTML = ''; // limpiar por si se recarga

    // Botón "Todos" para mostrar todos los servicios sin filtro
    const btnTodos = document.createElement('button');
    btnTodos.className  = 'btn-filtro activo'; // activo por defecto
    btnTodos.textContent = 'Todos';
    btnTodos.onclick = function() { filtrarServicios('todos', this); };
    cont.appendChild(btnTodos);

    // Un botón por cada categoría que existe en la BD
    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.className  = 'btn-filtro';
        btn.textContent = cat.nombre;
        btn.onclick = function() { filtrarServicios(cat.nombre, this); };
        cont.appendChild(btn);
    });
}

// Renderiza las tarjetas de servicios en el contenedor del catálogo.
// servicios → array de objetos servicio con nombre, descripcion, precio, etc.
function mostrarServicios(servicios) {
    const cont = document.getElementById('contenedor-servicios');
    if (!cont) return;
    cont.innerHTML = ''; // limpiar tarjetas previas

    servicios.forEach(s => {
        const card = document.createElement('div');
        card.className = 'card-servicio';
        card.innerHTML = `
            <span class="badge-categoria">${s.nombre_categoria || 'General'}</span>
            <h3>${s.nombre_servicio}</h3>
            <p>${s.descripcion || 'Servicio profesional'}</p>
            <div class="card-footer">
                <span class="card-precio">Bs ${parseFloat(s.precio).toFixed(2)}</span>
                <span style="color:#888;font-size:13px;">${s.duracion_minutos || ''} min</span>
            </div>`;
        cont.appendChild(card);
    });
}

// Filtra los servicios del array global catalogoCompleto por categoría.
// categoria → nombre de la categoría o 'todos'
// btn       → el botón que fue clickeado (para marcar como activo)
function filtrarServicios(categoria, btn) {
    // Quitar la clase 'activo' de todos los botones de filtro
    document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('activo'));
    // Marcar el botón clickeado como activo
    if (btn) btn.classList.add('activo');

    // Filtrar el array global (sin volver a pedir a la BD)
    const filtrados = categoria === 'todos'
        ? catalogoCompleto
        : catalogoCompleto.filter(s =>
            s.nombre_categoria &&
            s.nombre_categoria.toLowerCase() === categoria.toLowerCase()
          );
    mostrarServicios(filtrados);
}

// Renderiza las tarjetas de paquetes promocionales en #contenedor-paquetes.
// Muestra nombre, descripción, precio, servicios incluidos y fechas de vigencia.
function mostrarPaquetes(paquetes) {
    const cont = document.getElementById('contenedor-paquetes');
    const seccion = document.getElementById('paquetes');
    if (!cont) return;

    // Ocultar la sección si no hay paquetes en la BD
    if (!paquetes || paquetes.length === 0) {
        if (seccion) seccion.style.display = 'none';
        return;
    }
    if (seccion) seccion.style.display = '';

    cont.innerHTML = '';
    paquetes.forEach(p => {
        // Formatear fechas de vigencia si existen
        let vigencia = '';
        if (p.fecha_inicio || p.fecha_final) {
            const ini = p.fecha_inicio ? formatearFechaCorta(p.fecha_inicio) : '?';
            const fin = p.fecha_final  ? formatearFechaCorta(p.fecha_final)  : '?';
            vigencia = `<span class="paq-vigencia">Válido: ${ini} → ${fin}</span>`;
        }

        const card = document.createElement('div');
        card.className = 'card-paquete';
        card.innerHTML = `
            <div class="paq-badge">PROMOCIÓN</div>
            <h3 class="paq-nombre">${p.nombre}</h3>
            ${p.descripcion ? `<p class="paq-descripcion">${p.descripcion}</p>` : ''}
            ${vigencia}
            <div class="paq-footer">
                <span class="paq-precio">Bs ${parseFloat(p.precio_promocional || 0).toFixed(2)}</span>
                <button class="btn-reservar-paq" onclick="abrirModalReservaPaquete(${p.id_paquete})">
                    Reservar
                </button>
            </div>`;
        cont.appendChild(card);
    });
}

// Abre el modal de reserva con el paquete pre-seleccionado.
function abrirModalReservaPaquete(idPaquete) {
    // Seleccionar el radio de paquete
    const radioPaquete = document.getElementById('tipo-paquete');
    if (radioPaquete) {
        radioPaquete.checked = true;
        cambiarTipoReserva(); // recargar el select con paquetes
    }
    // Guardar el id del paquete para pre-seleccionarlo una vez que cargue el select
    window._preselPaqueteId = idPaquete;
    abrirModalReserva();
}
