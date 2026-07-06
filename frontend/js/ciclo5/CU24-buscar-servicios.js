// =============================================================================
// ciclo5/CU24-buscar-servicios.js — BÚSQUEDA DE SERVICIOS POR CATEGORÍA
// Ciclo 5 — Gestión avanzada del catálogo
//
// Permite al administrador, encargado o cliente localizar servicios del salón
// seleccionando una categoría desde el panel de Gestión > Servicios.
// El filtrado se realiza en el backend (consulta directa a BD).
//
// Funciones expuestas globalmente:
//   inicializarFiltroCategoriaAdmin()  → carga categorías en el select del filtro
//   filtrarServiciosPorCategoria()     → llama al backend y renderiza resultados
//   limpiarFiltroCategoriaAdmin()      → resetea filtro y muestra todos los servicios
//
// Depende de: main.js (API_BASE, serviciosCache, mostrarToast)
//             ciclo1/CU7-servicios.js (cargarServiciosAdmin — para el reset)
// =============================================================================

// =============================================================================
// Inicializa el dropdown (el <select>) de categorías del filtro.
// Se llama cada vez que el tab "Servicios" se activa en el panel admin, para
// que el select siempre refleje las categorías vigentes (por si el admin creó
// o eliminó alguna en la pestaña "Categorías" desde la última vez que se abrió).
//
// Es "async" porque adentro se usa "await" para esperar la respuesta del
// servidor antes de seguir — sin async/await, el código seguiría ejecutándose
// sin esperar a que llegue la respuesta de la red.
// =============================================================================
async function inicializarFiltroCategoriaAdmin() {
    // document.getElementById busca en el HTML de la página el elemento con
    // ese id exacto. Si el usuario no está viendo esta pestaña en particular,
    // ese elemento no estará visible/presente, así que "select" sería null.
    const select = document.getElementById('select-cat-admin-servicios');
    // "if (!select) return;" — si no se encontró el elemento, no hay nada
    // más que hacer, así que se sale de la función inmediatamente (return
    // sin nada devuelve "undefined", que en este caso no importa).
    if (!select) return;

    // try/catch: si algo falla (por ejemplo, no hay conexión a internet),
    // el catch de abajo evita que salte un error feo en la consola del
    // navegador sin control.
    try {
        // fetch(...) hace una petición HTTP al backend. API_BASE es una
        // variable global (definida en main.js) con la URL base del
        // servidor (por ejemplo "http://localhost:3000"). Se pide la lista
        // de TODAS las categorías del sistema (no es un endpoint propio de
        // CU24, es el genérico /api/categorias, reutilizado aquí).
        //
        // "await" pausa esta función hasta que el servidor responda, pero
        // SIN bloquear el resto de la página mientras tanto.
        const res  = await fetch(API_BASE + '/api/categorias');
        // La respuesta de fetch no viene lista para usar directamente: hay
        // que convertirla de "texto crudo" a un objeto de JavaScript con
        // res.json() (que también es asíncrono, por eso el segundo await).
        const data = await res.json();
        // Si el backend respondió pero marcó success:false (algo salió
        // mal de su lado), simplemente no se hace nada más (no se muestra
        // ningún error especial aquí, se deja el select como estaba).
        if (!data.success) return;

        // Se reconstruye el contenido del <select> desde cero:
        //   1. Se borra todo lo que tuviera antes (select.innerHTML = ...)
        //      y se deja solo la opción "Todas las categorías", que
        //      siempre debe existir como primera opción.
        select.innerHTML = '<option value="todas">— Todas las categorías —</option>';
        // "data.categorias" es el arreglo de categorías que mandó el
        // backend. .forEach(...) ejecuta el código de adentro UNA VEZ por
        // cada categoría del arreglo, con "cat" representando la categoría
        // actual en cada vuelta.
        data.categorias.forEach(cat => {
            // Se crea un elemento <option> nuevo, vacío, en memoria (todavía
            // no está en la página).
            const opt = document.createElement('option');
            // opt.value es lo que se manda cuando se selecciona esta opción
            // (el id numérico de la categoría, usado luego en el fetch de
            // filtrarServiciosPorCategoria).
            opt.value       = cat.id_categoria;
            // opt.textContent es el texto que VE el usuario en el dropdown
            // (el nombre legible de la categoría, ej. "Uñas").
            opt.textContent = cat.nombre;
            // Recién aquí se agrega el <option> al final del <select>, para
            // que aparezca en la página.
            select.appendChild(opt);
        });

        // Se busca también el elemento donde se muestra el conteo de
        // resultados de una búsqueda anterior (ej. "3 servicio(s) en
        // Uñas"), y se le borra el texto — si se está reinicializando el
        // filtro, no tiene sentido dejar un conteo de una búsqueda vieja.
        const indicador = document.getElementById('filtro-cat-resultado');
        if (indicador) indicador.textContent = '';
    } catch (err) {
        // Si fetch falló (por ejemplo, el servidor está apagado), se
        // registra el error en la consola del navegador para poder
        // investigarlo, pero no se interrumpe al usuario con una alerta.
        console.error('[CU24] Error cargando categorías para filtro:', err);
    }
}

// =============================================================================
// Ejecuta la búsqueda según la categoría seleccionada en el <select> del
// filtro. Llama al endpoint GET /api/ciclo5/servicios/buscar y reemplaza el
// contenido de la tabla con el resultado que llegue.
//
// Se dispara con el evento "onchange" del select (ver el HTML): cada vez
// que el admin elige una categoría distinta, esta función se ejecuta sola.
// =============================================================================
async function filtrarServiciosPorCategoria() {
    // Se buscan los 3 elementos del HTML que esta función necesita tocar:
    //   - select    → de dónde se lee qué categoría se eligió
    //   - indicador → dónde se escribe el conteo de resultados
    //   - tbody     → el <tbody> de la tabla, donde van las filas de
    //                 resultados (cada <tr> es una fila)
    const select     = document.getElementById('select-cat-admin-servicios');
    const indicador  = document.getElementById('filtro-cat-resultado');
    const tbody      = document.getElementById('tabla-admin-servicios-body');
    // Si falta el select o el tbody, quiere decir que esta vista no está
    // activa en este momento — no tiene sentido seguir.
    if (!select || !tbody) return;

    // select.value es el "value" del <option> actualmente seleccionado:
    // será el texto "todas" o el id numérico de una categoría (como texto).
    const idCategoria = select.value;

    // Si el usuario volvió a elegir "Todas", no tiene sentido llamar al
    // endpoint de búsqueda filtrada (CU24): en vez de eso, se limpia el
    // indicador y se llama a cargarServiciosAdmin() — esa función vive en
    // ciclo1/CU7-servicios.js y ya trae y pinta TODOS los servicios sin
    // ningún filtro. Así se reutiliza código en vez de duplicar lógica.
    if (idCategoria === 'todas') {
        if (indicador) indicador.textContent = '';
        cargarServiciosAdmin();
        // El "return" aquí es importante: corta la función para que el
        // código de más abajo (que sí hace la llamada filtrada) no se
        // ejecute también.
        return;
    }

    try {
        // Se arma la URL completa del endpoint de búsqueda, agregando el
        // id de categoría como query param. encodeURIComponent(...)
        // convierte el valor a un formato seguro para meter en una URL
        // (por si tuviera caracteres especiales, aunque aquí normalmente
        // solo sería un número).
        const url  = `${API_BASE}/api/ciclo5/servicios/buscar?id_categoria=${encodeURIComponent(idCategoria)}`;
        // Se hace la petición y se espera la respuesta.
        const res  = await fetch(url);
        // Se convierte la respuesta a un objeto de JavaScript.
        const data = await res.json();

        // Si el backend marcó success:false, se muestra un mensaje de
        // error tipo "toast" (una notificación pequeña, función definida
        // en main.js) y se corta la función aquí.
        if (!data.success) {
            mostrarToast('Error al filtrar servicios', 'error');
            return;
        }

        // Se actualiza el texto que muestra cuántos resultados hubo.
        if (indicador) {
            // select.options[select.selectedIndex].text es el TEXTO visible
            // de la opción seleccionada (el nombre de la categoría), no su
            // "value" (que sería solo el número de id).
            const catNombre = select.options[select.selectedIndex].text;
            // Operador ternario: si data.total es mayor a 0, se arma un
            // mensaje con la cantidad; si no, se avisa que no hubo
            // resultados. El backtick (`) permite meter variables dentro
            // del texto usando ${...} (esto se llama "template literal").
            indicador.textContent = data.total > 0
                ? `${data.total} servicio(s) en "${catNombre}"`
                : `Sin servicios en "${catNombre}"`;
        }

        // Se borra todo el contenido anterior de la tabla antes de pintar
        // los nuevos resultados, para no ir acumulando filas viejas.
        tbody.innerHTML = '';

        // Si el arreglo de servicios que llegó está vacío, se muestra una
        // única fila con un mensaje centrado, en vez de una tabla vacía sin
        // ninguna explicación.
        if (data.servicios.length === 0) {
            // Se crea un elemento <tr> (fila de tabla) nuevo en memoria.
            const tr = document.createElement('tr');
            // innerHTML permite meter HTML directamente como texto dentro
            // del elemento. colspan="5" hace que esta única celda ocupe el
            // ancho de las 5 columnas de la tabla (ID, Nombre, Precio,
            // Categoría, Acciones), para que el mensaje quede centrado en
            // todo el ancho de la tabla y no solo en la primera columna.
            tr.innerHTML = `
                <td colspan="5" style="text-align:center; color:#999; padding:30px;">
                    No se encontraron servicios en esta categoría.
                </td>`;
            // Se agrega esa fila al tbody para que se vea en la página.
            tbody.appendChild(tr);
            // Se corta aquí: no hay servicios que recorrer más abajo.
            return;
        }

        // Si SÍ hay servicios, se recorre el arreglo uno por uno con
        // .forEach(...), creando y agregando una fila <tr> por cada
        // servicio encontrado. El formato de las columnas es el mismo que
        // usa cargarServiciosAdmin() en CU7, para que la tabla se vea
        // idéntica esté filtrada o no.
        data.servicios.forEach(s => {
            // serviciosCache es un objeto global (definido en CU7) que
            // guarda los datos de cada servicio por su id, para que los
            // botones "Editar" puedan encontrar rápido los datos completos
            // de un servicio sin tener que volver a pedirlos al backend.
            // "typeof serviciosCache !== 'undefined'" comprueba que esa
            // variable exista antes de usarla (por si este archivo se
            // cargara en algún contexto donde CU7 todavía no se cargó).
            if (typeof serviciosCache !== 'undefined') serviciosCache[s.id_servicio] = s;

            const tr = document.createElement('tr');
            // Se arma el HTML de la fila con los datos del servicio actual.
            // parseFloat(s.precio).toFixed(2) convierte el precio a número
            // y lo deja siempre con 2 decimales (ej. "120.00" en vez de
            // "120" o "120.5").
            // s.nombre_categoria || 'N/A' significa: "si nombre_categoria
            // viene vacío/null, mostrar el texto 'N/A' en su lugar".
            // Los botones "Editar" y "Eliminar" llaman a funciones
            // definidas en otros archivos de ciclo1 (CU7), pasándoles el
            // id (y el nombre, en el caso de eliminar) del servicio de
            // esta fila en particular.
            tr.innerHTML = `
                <td>${s.id_servicio}</td>
                <td>${s.nombre_servicio}</td>
                <td>Bs ${parseFloat(s.precio).toFixed(2)}</td>
                <td>${s.nombre_categoria || 'N/A'}</td>
                <td>
                    <button class="btn-table"
                        onclick="abrirModalAdminServicio(${s.id_servicio})">Editar</button>
                    <button class="btn-table-danger"
                        onclick="eliminarServicio(${s.id_servicio},'${s.nombre_servicio.replace(/'/g, "\\'")}')">Eliminar</button>
                </td>`;
            // Se agrega la fila recién armada al final de la tabla.
            tbody.appendChild(tr);
        });
    } catch (err) {
        // Este catch atrapa errores de RED (por ejemplo, que el backend no
        // responda), que son distintos del caso "data.success === false"
        // que ya se maneja más arriba (ese es un error que el backend SÍ
        // pudo contestar, solo que con un resultado negativo).
        console.error('[CU24] Error al filtrar servicios:', err);
        mostrarToast('Error de conexión al filtrar servicios', 'error');
    }
}

// =============================================================================
// Botón "Limpiar": vuelve a poner el select en "Todas", borra el texto del
// indicador de resultados, y recarga la lista completa de servicios (sin
// ningún filtro aplicado).
//
// A diferencia de las dos funciones de arriba, esta NO es "async" porque no
// hace ninguna petición al backend directamente — delega esa parte a
// cargarServiciosAdmin() (de CU7), que sí es la que llama al servidor.
// =============================================================================
function limpiarFiltroCategoriaAdmin() {
    const select    = document.getElementById('select-cat-admin-servicios');
    const indicador = document.getElementById('filtro-cat-resultado');
    // Si el select existe, se le fuerza el valor a "todas" (esto mueve la
    // selección visible del dropdown de vuelta a esa opción).
    if (select) select.value = 'todas';
    // Se borra cualquier texto de conteo que hubiera quedado de una
    // búsqueda anterior.
    if (indicador) indicador.textContent = '';
    // Misma función que usa filtrarServiciosPorCategoria() cuando el select
    // vuelve a "todas" — se reutiliza para no tener dos formas distintas de
    // "cargar todos los servicios sin filtro" en el código.
    cargarServiciosAdmin();
}
