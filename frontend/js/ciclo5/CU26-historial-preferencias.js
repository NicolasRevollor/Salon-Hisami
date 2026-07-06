// =============================================================================
// ciclo5/CU26-historial-preferencias.js — HISTORIAL DE PREFERENCIAS DEL CLIENTE
// Ciclo 5 — Seguimiento personalizado por cliente
//
// Permite al esteticista o administrador registrar y consultar las preferencias
// particulares de cada cliente desde el panel Admin > Clientes.
// Cada observación tiene un tipo (categoría) y una descripción libre.
//
// Funciones expuestas globalmente:
//   abrirModalPreferenciasCliente(ci, nombre) → abre el modal y carga el historial
//   cerrarModalPreferenciasCliente()          → cierra el modal
//   manejarRegistrarPreferencia(e)            → submit del formulario de registro
//
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

// _cu26ClienteCI guarda el CI del cliente que está actualmente abierto en el
// modal. Se declara con "let" (no "const") porque su valor SÍ cambia: se
// actualiza cada vez que se abre el modal para un cliente distinto, y se
// vuelve a null cuando se cierra. Al estar declarada FUERA de cualquier
// función, es una variable "compartida": tanto abrirModalPreferenciasCliente
// como manejarRegistrarPreferencia y cerrarModalPreferenciasCliente pueden
// leerla y modificarla, sin tener que pasarla como parámetro de una función
// a otra.
let _cu26ClienteCI = null;

// TIPOS_PREFERENCIA es la lista fija de categorías que se pueden elegir al
// registrar una nueva observación. Se declara con "const" porque el arreglo
// en sí no se reemplaza por otro (aunque técnicamente se podría modificar su
// contenido, aquí nunca se hace — se usa solo para leerlo).
const TIPOS_PREFERENCIA = [
    'Técnica favorita',
    'Alergia',
    'Indicación especial',
    'Producto preferido',
    'Otro'
];

// =============================================================================
// Abre el modal de preferencias, guarda el CI del cliente actual, y dispara
// la carga de su historial. Se llama desde el botón correspondiente en la
// tabla de clientes (CU10), que le pasa el ci y el nombre de la fila en la
// que se hizo clic.
//
// ci     → cédula de identidad del cliente
// nombre → nombre del cliente (solo para mostrar en el encabezado del modal)
// =============================================================================
async function abrirModalPreferenciasCliente(ci, nombre) {
    // Se guarda el CI en la variable compartida _cu26ClienteCI. Esto es
    // necesario porque, más adelante, cuando el admin llene el formulario y
    // presione "Guardar", la función manejarRegistrarPreferencia() necesita
    // saber para QUÉ cliente es esa nueva observación — y en vez de tener
    // que pasarlo de nuevo como parámetro en cada evento, simplemente lo lee
    // de esta variable.
    _cu26ClienteCI = ci;

    // Se busca el elemento donde va el título del modal, y si existe, se le
    // pone el texto "Preferencias — <nombre del cliente>". El backtick con
    // ${nombre} es un "template literal": permite meter el valor de una
    // variable dentro de un texto sin tener que concatenar con "+".
    const tituloEl = document.getElementById('pref-cli-titulo');
    if (tituloEl) tituloEl.textContent = `Preferencias — ${nombre}`;

    // Se busca el <select> donde el admin elige el tipo de observación
    // nueva. "selectTipo.options.length <= 1" comprueba si el select
    // TODAVÍA no tiene las opciones de TIPOS_PREFERENCIA cargadas: el HTML
    // ya trae, por defecto, una sola opción vacía ("— Selecciona un tipo
    // —"), así que si options.length es 1 (o menos), quiere decir que
    // todavía no se agregaron las demás. Esto evita que, si el admin abre
    // el modal varias veces seguidas para distintos clientes, las opciones
    // se dupliquen cada vez (5 tipos la primera vez, 10 la segunda, etc.).
    const selectTipo = document.getElementById('pref-cli-tipo');
    if (selectTipo && selectTipo.options.length <= 1) {
        // .forEach recorre el arreglo TIPOS_PREFERENCIA una vez por cada
        // tipo, creando y agregando un <option> nuevo por cada uno.
        TIPOS_PREFERENCIA.forEach(t => {
            const opt = document.createElement('option');
            // Tanto el "value" (lo que se manda al backend) como el texto
            // visible son el mismo string (ej. "Alergia"), no hace falta
            // que sean distintos en este caso.
            opt.value = t;
            opt.textContent = t;
            selectTipo.appendChild(opt);
        });
    }

    // Se busca el <form> de registro y, si existe, se llama a .reset() —
    // un método nativo de los formularios HTML que borra todo lo que el
    // usuario hubiera escrito, dejándolo como recién cargado. Esto evita
    // que quede texto de un cliente anterior si el admin abre el modal para
    // uno distinto sin haber guardado antes.
    const form = document.getElementById('form-nueva-preferencia');
    if (form) form.reset();

    // Se quita la clase CSS que mantenía el modal oculto (ver
    // styles.css: ".seccion-oculta { display:none }"). A partir de esta
    // línea, el modal se vuelve visible en pantalla.
    document.getElementById('modal-preferencias-cliente').classList.remove('seccion-oculta');

    // Se llama (con await, para esperar a que termine) a la función que
    // trae y pinta el historial de observaciones de este cliente en
    // particular. Está definida más abajo en este mismo archivo.
    await _cu26CargarHistorial(ci);
}

// =============================================================================
// Cierra el modal y "limpia" el estado interno (vuelve _cu26ClienteCI a
// null). Esto último es importante: si por accidente se disparara un submit
// del formulario después de cerrado el modal (por ejemplo, presionando
// Enter en un campo que quedó con el foco), la función
// manejarRegistrarPreferencia() vería _cu26ClienteCI en null y se
// detendría de inmediato, en vez de intentar registrar algo sin saber para
// qué cliente es.
// =============================================================================
function cerrarModalPreferenciasCliente() {
    // "?." (optional chaining): si getElementById no encuentra el modal
    // (devuelve null), no intenta llamar a .classList sobre null (lo que
    // rompería con un error), simplemente no hace nada y sigue de largo.
    document.getElementById('modal-preferencias-cliente')?.classList.add('seccion-oculta');
    _cu26ClienteCI = null;
}

// =============================================================================
// Se ejecuta cuando el admin envía (hace submit) el formulario de "Registrar
// nueva observación". Valida los datos, los manda al backend por POST, y si
// todo sale bien, refresca el historial mostrado en el modal.
//
// "e" es el objeto del evento de submit que dispara automáticamente el
// navegador cuando alguien presiona el botón de tipo "submit" dentro de un
// <form> (o presiona Enter en un campo de ese form).
// =============================================================================
async function manejarRegistrarPreferencia(e) {
    // e.preventDefault() evita el comportamiento por defecto de un <form>
    // al hacer submit, que sería recargar la página completa (perdiendo
    // todo el estado de la aplicación). Al llamarlo, el envío queda
    // completamente bajo el control de este código de JavaScript.
    e.preventDefault();
    // Si por algún motivo no hay un cliente activo guardado (por ejemplo,
    // el modal ya se cerró), no hay a quién asociarle la preferencia, así
    // que se corta la función aquí mismo sin hacer nada más.
    if (!_cu26ClienteCI) return;

    // Se leen los valores actuales de los dos campos del formulario:
    //   - pref-cli-tipo es un <select>, así que .value es la opción
    //     elegida (o texto vacío "" si sigue en la opción por defecto).
    //   - pref-cli-descripcion es un <textarea>, .value es el texto que
    //     escribió el admin. .trim() le quita los espacios en blanco de
    //     los bordes (por ejemplo, si el admin escribió "  hola  ", queda
    //     "hola").
    // El "?." antes de .value evita un error si, por alguna razón, el
    // elemento no existiera en el DOM en ese momento.
    const tipo        = document.getElementById('pref-cli-tipo')?.value;
    const descripcion = document.getElementById('pref-cli-descripcion')?.value.trim();

    // Validaciones básicas ANTES de llamar al backend, para darle feedback
    // inmediato al admin sin tener que esperar una respuesta de red.
    // mostrarToast(mensaje, tipo) es una función de main.js que muestra una
    // notificación pequeña en pantalla; 'error' la pinta de rojo.
    // El backend, de todos modos, vuelve a validar estos mismos campos por
    // su cuenta (nunca hay que confiar solo en la validación del frontend).
    if (!tipo) { mostrarToast('Selecciona un tipo de observación', 'error'); return; }
    if (!descripcion) { mostrarToast('La descripción no puede estar vacía', 'error'); return; }

    // Se busca el botón de "Guardar" y se deshabilita mientras se espera la
    // respuesta del servidor. Esto evita que, si el admin hace doble clic
    // por impaciencia, se envíen dos peticiones seguidas y se registre la
    // misma observación dos veces.
    const btnGuardar = document.getElementById('btn-guardar-preferencia');
    if (btnGuardar) btnGuardar.disabled = true;

    try {
        // Se hace la petición POST al backend. A diferencia de un fetch GET
        // (que solo necesita la URL), un POST necesita configurar:
        //   - method: 'POST'                        → el tipo de petición
        //   - headers: Content-Type application/json → le avisa al backend
        //     que el cuerpo de la petición viene en formato JSON
        //   - body: JSON.stringify({...})             → convierte el objeto
        //     de JavaScript {tipo, descripcion} a un texto JSON, que es el
        //     formato que realmente viaja por la red (JavaScript no puede
        //     mandar objetos "vivos" a través de HTTP, solo texto).
        // El CI va en la URL (no en el body), porque la ruta del backend es
        // POST /api/ciclo5/clientes/:ci/preferencias.
        const res  = await fetch(`${API_BASE}/api/ciclo5/clientes/${encodeURIComponent(_cu26ClienteCI)}/preferencias`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ tipo, descripcion })
        });
        // Se convierte la respuesta del servidor a un objeto de JavaScript.
        const data = await res.json();

        // Si el backend contestó con éxito...
        if (data.success) {
            // ...se muestra una notificación de confirmación...
            mostrarToast('Preferencia registrada exitosamente.');
            // ...se limpia el formulario, dejándolo listo para que el
            // admin pueda registrar otra observación seguida sin tener que
            // borrar el texto anterior a mano...
            document.getElementById('form-nueva-preferencia')?.reset();
            // ...y se vuelve a pedir el historial completo al backend, para
            // que la observación recién creada aparezca de inmediato en la
            // línea de tiempo del modal (sin esto, tendría que cerrarse y
            // volver a abrirse el modal para verla).
            await _cu26CargarHistorial(_cu26ClienteCI);
        } else {
            // Si success vino en false, se muestra el mensaje que mandó el
            // backend (por ejemplo, "El tipo de observación es
            // obligatorio." o "Cliente no encontrado."), o un mensaje
            // genérico si por algún motivo no vino ningún mensaje.
            mostrarToast(data.message || 'Error al registrar la preferencia', 'error');
        }
    } catch (err) {
        // Este catch atrapa errores de RED (por ejemplo, que el servidor
        // esté caído), distintos del caso "data.success === false" de
        // arriba (que sí es una respuesta válida del servidor, solo que
        // negativa).
        console.error('[CU26] Error al registrar preferencia:', err);
        mostrarToast('Error de conexión. Intenta nuevamente.', 'error');
    } finally {
        // El bloque "finally" se ejecuta SIEMPRE, sin importar si el try
        // tuvo éxito o si saltó al catch. Se usa aquí para asegurarse de
        // que el botón de "Guardar" vuelva a habilitarse en cualquier caso
        // (si no se hiciera en finally y hubiera un error, el botón podría
        // quedar deshabilitado para siempre).
        if (btnGuardar) btnGuardar.disabled = false;
    }
}

// ─── Helpers internos ────────────────────────────────────────────────────────
// Las funciones de aquí abajo empiezan con el prefijo "_cu26" para dejar
// claro que son de uso interno de este archivo (una convención de nombres,
// no algo que JavaScript exija). No se llaman desde el HTML ni desde otros
// archivos del proyecto.

// =============================================================================
// Pide al backend el historial completo de observaciones de un cliente
// (GET /api/ciclo5/clientes/:ci/preferencias) y lo dibuja como una "línea de
// tiempo" vertical dentro del modal. Se llama tanto al abrir el modal como
// después de registrar una preferencia nueva, para que la vista quede
// siempre actualizada.
// =============================================================================
async function _cu26CargarHistorial(ci) {
    // Se busca el contenedor donde va a ir el historial dibujado.
    const lista = document.getElementById('pref-cli-historial');
    if (!lista) return;

    // Mientras se espera la respuesta del backend, se muestra un mensaje de
    // "Cargando historial..." en gris y centrado, para que el usuario sepa
    // que algo está pasando.
    lista.innerHTML = '<p style="text-align:center; color:#aaa; padding:16px; font-size:13px;">Cargando historial...</p>';

    try {
        const res  = await fetch(`${API_BASE}/api/ciclo5/clientes/${encodeURIComponent(ci)}/preferencias`);
        const data = await res.json();

        // Si el backend respondió que no encontró al cliente (u otro
        // error controlado), se muestra ese mensaje en rojo dentro del
        // contenedor, en vez de la línea de tiempo.
        if (!data.success) {
            lista.innerHTML = `<p style="color:#dc3545; font-size:13px; padding:10px;">${data.message}</p>`;
            return;
        }

        // Si el cliente existe pero data.observaciones viene como un
        // arreglo vacío (todavía no se le registró ninguna preferencia),
        // se muestra un aviso en cursiva en vez de una lista vacía.
        if (data.observaciones.length === 0) {
            lista.innerHTML = '<p style="text-align:center; color:#aaa; font-size:13px; padding:16px; font-style:italic;">Aún no hay preferencias registradas para este cliente.</p>';
            return;
        }

        // Si hay observaciones, se arma una "tarjeta" de HTML por cada una,
        // usando .map(...) (que arma un nuevo arreglo con el resultado de
        // cada vuelta) y al final .join('') las pega todas en un solo
        // string de HTML para mostrarlas juntas.
        //
        // "(obs, idx)" — .map le pasa a la función, en cada vuelta, tanto
        // el elemento actual del arreglo (obs, la observación) como su
        // posición dentro del arreglo (idx, empezando en 0). Esto se usa
        // para saber si es la primera observación (la más reciente, ya que
        // el backend las manda ordenadas de más nueva a más vieja) y para
        // decidir si hay que dibujar la "línea conectora" hacia la
        // siguiente tarjeta.
        lista.innerHTML = data.observaciones.map((obs, idx) => {
            // esPrimero es true solo quando idx es 0 — la primera
            // observación del arreglo, que por el ORDER BY DESC del
            // backend es siempre la más reciente.
            const esPrimero = idx === 0;
            // Se convierte la fecha (que llega como texto ISO desde el
            // backend, algo como "2026-07-06T14:30:00.000Z") a un objeto
            // Date de JavaScript, y luego a un texto legible en español
            // boliviano ('es-BO'), mostrando día, mes, año, hora y minuto.
            const fecha = new Date(obs.fecha_registro).toLocaleString('es-BO', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            // El punto de la línea de tiempo se pinta de color dorado si
            // es la observación más reciente, o gris claro si es una más
            // antigua — así resalta visualmente cuál es la última.
            const colorBorde = esPrimero ? '#d4a373' : '#e0e0e0';
            // _cu26ColorTipo (definida más abajo) devuelve los colores de
            // fondo/texto que le corresponden al "tipo" de esta
            // observación, para que el badge se vea distinto según sea
            // Alergia, Técnica favorita, etc.
            const colorTipo  = _cu26ColorTipo(obs.tipo);

            // Se arma el HTML de esta tarjeta individual:
            //   - Un punto de color + una línea vertical que conecta con
            //     la siguiente tarjeta (excepto en la última, donde no hay
            //     nada después que conectar — por eso el operador ternario
            //     "idx < data.observaciones.length - 1 ? ... : ''").
            //   - El badge con el tipo de observación y la fecha.
            //   - El texto de la descripción, pasado por
            //     _cu26EscapeHtml(...) para evitar que caracteres como
            //     "<" o ">" rompan el HTML o permitan inyectar código.
            return `
                <div style="display:flex; gap:12px; padding:12px 0; border-bottom:1px solid #f5f5f5;">
                    <!-- Línea de tiempo -->
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0;">
                        <div style="width:10px; height:10px; border-radius:50%;
                                    background:${colorBorde}; flex-shrink:0; margin-top:4px;"></div>
                        ${idx < data.observaciones.length - 1
                            ? `<div style="width:2px; flex:1; background:#f0f0f0; margin-top:4px;"></div>`
                            : ''}
                    </div>
                    <!-- Contenido -->
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:4px; margin-bottom:4px;">
                            <span style="display:inline-block; background:${colorTipo.bg}; color:${colorTipo.text};
                                         border-radius:20px; padding:2px 10px; font-size:11px; font-weight:600;">
                                ${obs.tipo}
                            </span>
                            <span style="font-size:11px; color:#bbb; white-space:nowrap;">${fecha}</span>
                        </div>
                        <p style="margin:0; font-size:13px; color:#444; line-height:1.5; word-break:break-word;">
                            ${_cu26EscapeHtml(obs.descripcion)}
                        </p>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        // Error de red al pedir el historial (distinto de un
        // data.success === false, que sí es una respuesta válida del
        // servidor).
        console.error('[CU26] Error al cargar historial:', err);
        lista.innerHTML = '<p style="color:#dc3545; font-size:13px; padding:10px;">Error de conexión al cargar el historial.</p>';
    }
}

// =============================================================================
// Devuelve un objeto { bg, text } (color de fondo y color de texto) según el
// tipo de observación, para que cada categoría sea reconocible de un
// vistazo por su color en la línea de tiempo (ej. las alergias en rojo,
// para que resalten como algo importante de no olvidar).
//
// Si el tipo que llega no está en el "mapa" de colores (por ejemplo, si es
// "Otro", o algún valor viejo que ya no está en TIPOS_PREFERENCIA), se usa
// un gris neutro por defecto en vez de que la página se rompa.
// =============================================================================
function _cu26ColorTipo(tipo) {
    // "mapa" es un objeto donde cada "clave" es el nombre de un tipo, y su
    // "valor" es otro objeto con los dos colores que le corresponden.
    const mapa = {
        'Alergia':            { bg: '#fde8e8', text: '#b91c1c' },
        'Técnica favorita':   { bg: '#e8f5e9', text: '#2e7d32' },
        'Indicación especial':{ bg: '#e8f0fd', text: '#1a56db' },
        'Producto preferido': { bg: '#fdf3e7', text: '#7a5c2e' }
    };
    // "mapa[tipo]" busca dentro del objeto la entrada que coincida
    // exactamente con el texto de "tipo". Si no la encuentra, mapa[tipo]
    // da "undefined", y el operador "||" hace que en ese caso se use el
    // objeto gris de la derecha en su lugar.
    return mapa[tipo] || { bg: '#f0f0f0', text: '#555' };
}

// =============================================================================
// Escapa (reemplaza) los caracteres especiales de HTML dentro de un texto,
// antes de insertarlo en la página con innerHTML.
//
// La descripción de una observación es texto libre que escribe el admin —
// si por ejemplo escribiera algo con "<" o ">" (aunque sea sin mala
// intención, como "cliente prefiere <3cm de largo"), sin este escape esos
// caracteres podrían romper el HTML de la página o, en el peor caso,
// permitir que se ejecute código no deseado (esto se llama un ataque XSS).
// Por eso, antes de mostrarlo, se reemplaza cada carácter peligroso por su
// versión seguros (llamada "entidad HTML"):
//   &  → &amp;
//   <  → &lt;
//   >  → &gt;
//   "  → &quot;
// =============================================================================
function _cu26EscapeHtml(str) {
    // String(str) asegura que, aunque "str" no fuera ya un texto por algún
    // motivo, se convierta a uno antes de intentar usar .replace(...).
    // Cada .replace(...) se encadena uno después del otro, aplicándose
    // sobre el resultado del anterior — por eso el orden importa: primero
    // se reemplaza "&" (para no afectar los "&amp;" que se generan después).
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
