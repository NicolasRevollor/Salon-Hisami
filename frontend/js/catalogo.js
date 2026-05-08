// =============================================================================
// CU2-catalogo.js — CATÁLOGO PÚBLICO DE SERVICIOS (página principal / landing)
// Muestra las tarjetas de servicios con filtros por categoría.
// Esta sección es visible para TODOS (logueados o no).
// Depende de: main.js (API_BASE, catalogoCompleto)
// =============================================================================

// =============================================================================
// Carga los servicios y las categorías desde la BD al mismo tiempo (en paralelo).
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
