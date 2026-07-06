// =============================================================================
// ciclo5/CU25-ficha-esteticista.js — FICHA DEL ESTETICISTA (panel admin)
// Ciclo 5 — Consulta consolidada del perfil y rendimiento individual
//
// Permite al administrador visualizar de forma centralizada el perfil completo
// de un esteticista: datos personales, especialidades, citas atendidas y
// comisiones acumuladas en el mes actual.
//
// Funciones expuestas globalmente:
//   verFichaEsteticista(ci)     → abre el modal y carga la ficha desde el backend
//   cerrarModalFichaEsteticista → cierra el modal de la ficha
//
// Depende de: main.js (API_BASE, mostrarToast)
// =============================================================================

// =============================================================================
// Abre el modal de ficha, muestra un estado de "cargando..." mientras tanto,
// y pide los datos completos al backend. Se llama desde el botón "Ver Ficha"
// de la tabla de Gestión de Personal (CU11), que le pasa el CI del empleado
// sobre el que se hizo clic.
//
// ci → cédula de identidad del esteticista (así se llama la columna
//      ci_usuario en la base de datos, pero para el frontend es simplemente
//      "el CI del empleado que se quiere ver").
// =============================================================================
async function verFichaEsteticista(ci) {
    // Se busca el <div> del modal en el HTML. Si no existe (por ejemplo, si
    // este archivo se cargara en una página que no tiene ese modal), no hay
    // nada más que hacer.
    const modal = document.getElementById('modal-ficha-esteticista');
    if (!modal) return;

    // Antes de pedir nada al backend, se rellena el contenido del modal con
    // un ícono animado ("spinner") y el texto "Cargando ficha...". Esto le
    // da al administrador una señal visual inmediata de que algo está
    // pasando, en vez de que el modal se vea vacío mientras se espera la
    // respuesta de la red (que puede tardar un poco, porque el backend hace
    // 3 consultas encadenadas para armar la ficha completa).
    //
    // _fichaSetContenido es una función auxiliar definida más abajo en este
    // mismo archivo — solo mete el HTML que se le pasa dentro del
    // contenedor correspondiente del modal.
    _fichaSetContenido(`
        <div style="text-align:center; padding:40px 0; color:#999;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4a373" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;">
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
            <p style="margin-top:12px; font-size:14px;">Cargando ficha...</p>
        </div>
    `);
    // classList.remove('seccion-oculta') quita la clase CSS que mantenía el
    // modal escondido (ver styles.css: ".seccion-oculta { display:none }").
    // Al quitarla, el modal se vuelve visible en pantalla — recién en este
    // momento el usuario ve el spinner de "Cargando ficha...".
    modal.classList.remove('seccion-oculta');

    // try/catch para que un fallo de red no rompa la página, sino que se
    // muestre un mensaje de error dentro del propio modal.
    try {
        // Se hace la petición al backend. encodeURIComponent(ci) convierte
        // el CI a un formato seguro para pegarlo dentro de una URL (por si
        // tuviera algún carácter especial, aunque normalmente un CI es solo
        // números). "await" espera a que la respuesta llegue antes de
        // seguir con la siguiente línea.
        const res  = await fetch(`${API_BASE}/api/ciclo5/esteticistas/${encodeURIComponent(ci)}/ficha`);
        // Se convierte la respuesta (que llega como texto) a un objeto de
        // JavaScript con el que sí se puede trabajar directamente.
        const data = await res.json();

        // data.success viene en false tanto si el backend respondió con un
        // 404 (esteticista no encontrado) como con cualquier otro error
        // controlado. En ese caso se reemplaza el spinner por un mensaje de
        // error, usando el texto que mandó el backend si vino (data.message)
        // o un mensaje genérico si no.
        if (!data.success) {
            _fichaSetContenido(`
                <p style="text-align:center; color:#dc3545; padding:30px;">
                    ${data.message || 'No se pudo cargar la ficha del esteticista.'}
                </p>
            `);
            return;
        }

        // Si todo salió bien, se le pasa data.ficha (el objeto con todos
        // los datos del esteticista) a la función que arma el HTML visual
        // completo de la ficha.
        _fichaRenderizar(data.ficha);
    } catch (err) {
        // Este catch atrapa errores de conexión (por ejemplo, que el
        // backend esté apagado), distintos del caso "success: false" de
        // arriba (ese SÍ llega a responder, solo que con un error).
        console.error('[CU25] Error al cargar ficha:', err);
        _fichaSetContenido(`
            <p style="text-align:center; color:#dc3545; padding:30px;">
                Error de conexión. Intenta nuevamente.
            </p>
        `);
    }
}

// =============================================================================
// Cierra el modal de la ficha (botón "✕" del encabezado, o clic fuera del
// modal, según cómo esté conectado en el HTML).
//
// El "?." antes de .classList es "optional chaining": si
// getElementById no encuentra el elemento (devuelve null), en vez de
// romper con un error tipo "no se puede leer classList de null", esta
// sintaxis simplemente no hace nada y sigue de largo.
//
// No hace falta limpiar el contenido del modal aquí: la próxima vez que se
// abra con verFichaEsteticista(), esa función ya sobrescribe todo con el
// spinner antes de pedir los datos nuevos.
// =============================================================================
function cerrarModalFichaEsteticista() {
    document.getElementById('modal-ficha-esteticista')?.classList.add('seccion-oculta');
}

// ─── Helpers internos ────────────────────────────────────────────────────────
// Las funciones de aquí abajo empiezan con "_" para marcar que son de uso
// interno de este archivo (una convención, no algo que JavaScript obligue).
// No están pensadas para llamarse desde otros archivos ni desde el HTML.

// =============================================================================
// Reemplaza TODO el contenido del área de datos del modal (el <div> donde va
// el cuerpo de la ficha) con el HTML que se le pase como parámetro.
//
// Se centraliza en una sola función para no tener que repetir
// "document.getElementById('ficha-esteticista-cuerpo')" en cada lugar del
// archivo donde se necesita cambiar lo que se ve dentro del modal (spinner,
// mensaje de error, o la ficha completa).
// =============================================================================
function _fichaSetContenido(html) {
    const area = document.getElementById('ficha-esteticista-cuerpo');
    if (area) area.innerHTML = html;
}

// =============================================================================
// Construye y muestra la ficha completa dentro del modal, a partir del
// objeto "f" (de "ficha") que devuelve el backend.
//
// La forma de "f" es (ver getFichaEsteticista en el controller):
//   { id_esteticista, ci, nombre, email, telefono, estado, area,
//     especialidades: [{id, nombre}, ...],
//     total_citas_mes, total_comisiones_mes, total_comisiones_historico }
// =============================================================================
function _fichaRenderizar(f) {
    // new Date() crea un objeto con la fecha/hora ACTUAL del navegador.
    // .toLocaleString('es', {...}) lo convierte a texto legible en español,
    // mostrando solo el mes (en palabras) y el año — por ejemplo:
    // "julio de 2026". Esto se usa como título de la sección "Rendimiento".
    const mes    = new Date().toLocaleString('es', { month: 'long', year: 'numeric' });

    // Se arma un pequeño "badge" (etiqueta con fondo de color) que muestra
    // si el esteticista está Activo o no. Es un operador ternario:
    // "si f.estado es exactamente el texto 'Activo', usa el HTML verde;
    //  si no (cualquier otro valor), usa el HTML rojo con el texto
    //  'No Activo'".
    const estado = f.estado === 'Activo'
        ? '<span style="background:#d4edda; color:#155724; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600;">Activo</span>'
        : '<span style="background:#f8d7da; color:#721c24; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600;">No Activo</span>';

    // Se arma el HTML de los "chips" (etiquetas redondeadas) de
    // especialidades. Primero se comprueba:
    //   - que f.especialidades sea realmente un arreglo (Array.isArray)
    //   - Y que ese arreglo tenga al menos un elemento (.length > 0)
    // Si ambas cosas son ciertas, se recorre el arreglo con .map(...)
    // (parecido a forEach, pero .map ARMA un nuevo arreglo con lo que
    // devuelva cada vuelta) generando un <span> por cada especialidad, y
    // luego .join('') los pega todos en un solo texto (sin ningún
    // separador entre ellos, porque el margen visual ya lo da el CSS).
    // Si el arreglo viniera vacío (esteticista sin especialidades), en vez
    // de eso se muestra un texto gris avisando que no tiene ninguna.
    const chipsHtml = Array.isArray(f.especialidades) && f.especialidades.length > 0
        ? f.especialidades.map(e =>
            `<span style="display:inline-block; background:#fdf3e7; color:#7a5c2e; border:1px solid #d4a373;
                          border-radius:20px; padding:4px 12px; font-size:13px; margin:3px;">${e.nombre}</span>`
          ).join('')
        : '<span style="color:#999; font-size:13px;">Sin especialidades asignadas</span>';

    // Se arma TODO el HTML de la ficha en un solo bloque grande y se lo
    // pasa a _fichaSetContenido para que lo pinte dentro del modal. El
    // HTML está dividido en secciones, cada una explicada con un
    // comentario HTML (<!-- ... -->) que ya venía en el archivo original:
    //   1. Encabezado: avatar (ícono genérico de persona) + nombre + CI +
    //      badge de estado.
    //   2. Datos personales: teléfono, correo y área de trabajo, cada uno
    //      en una "tarjeta" con fondo suave.
    //   3. Especialidades: los chips armados arriba.
    //   4. Rendimiento del mes: dos tarjetas grandes con degradado de
    //      color, una mostrando el número de citas atendidas y otra el
    //      monto de comisiones ganadas ese mismo mes.
    //   5. Comisiones histórico total: una tarjeta ancha aparte con la
    //      suma de TODAS las comisiones del esteticista desde siempre
    //      (sin filtrar por mes), para diferenciarla claramente del dato
    //      "solo este mes" de la sección anterior.
    //
    // f.telefono || '—' y f.email || '—' significan: "si el dato viene
    // vacío/null, mostrar un guión largo en su lugar" (para no dejar un
    // espacio en blanco raro si el esteticista no cargó ese dato).
    //
    // parseFloat(f.total_comisiones_mes).toFixed(2) convierte el monto a
    // número y lo deja siempre con 2 decimales (ej. "150.00").
    _fichaSetContenido(`
        <!-- Encabezado: avatar + nombre + estado -->
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
            <div style="width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,#d4a373,#b5813a);
                        display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
            <div>
                <h3 style="margin:0; font-size:20px; color:var(--texto-oscuro);">${f.nombre}</h3>
                <p style="margin:4px 0 6px; font-size:13px; color:#888;">CI: ${f.ci}</p>
                ${estado}
            </div>
        </div>

        <hr style="border:none; border-top:1px solid #f0e8df; margin-bottom:18px;">

        <!-- Datos personales -->
        <div style="margin-bottom:18px;">
            <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px;
                      color:#b5813a; margin-bottom:10px;">Información Personal</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div style="background:#fdf3e7; border-radius:8px; padding:10px 14px;">
                    <p style="font-size:11px; color:#999; margin:0 0 2px;">Teléfono</p>
                    <p style="font-size:14px; font-weight:600; color:#333; margin:0;">${f.telefono || '—'}</p>
                </div>
                <div style="background:#fdf3e7; border-radius:8px; padding:10px 14px;">
                    <p style="font-size:11px; color:#999; margin:0 0 2px;">Correo</p>
                    <p style="font-size:14px; font-weight:600; color:#333; margin:0; word-break:break-all;">${f.email || '—'}</p>
                </div>
                <div style="background:#fdf3e7; border-radius:8px; padding:10px 14px; grid-column:1/-1;">
                    <p style="font-size:11px; color:#999; margin:0 0 2px;">Área de Trabajo</p>
                    <p style="font-size:14px; font-weight:600; color:#333; margin:0;">${f.area || '—'}</p>
                </div>
            </div>
        </div>

        <!-- Especialidades -->
        <div style="margin-bottom:20px;">
            <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px;
                      color:#b5813a; margin-bottom:10px;">Especialidades</p>
            <div>${chipsHtml}</div>
        </div>

        <hr style="border:none; border-top:1px solid #f0e8df; margin-bottom:18px;">

        <!-- Rendimiento del mes -->
        <div>
            <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px;
                      color:#b5813a; margin-bottom:10px;">Rendimiento — ${mes}</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div style="background:linear-gradient(135deg,#d4a373,#b5813a); border-radius:12px;
                            padding:18px 16px; text-align:center; color:white;">
                    <p style="font-size:34px; font-weight:800; margin:0; line-height:1;">${f.total_citas_mes}</p>
                    <p style="font-size:12px; margin:6px 0 0; opacity:0.9;">Citas atendidas</p>
                </div>
                <div style="background:linear-gradient(135deg,#5a9e7a,#3d7d5a); border-radius:12px;
                            padding:18px 16px; text-align:center; color:white;">
                    <p style="font-size:28px; font-weight:800; margin:0; line-height:1;">
                        Bs ${parseFloat(f.total_comisiones_mes).toFixed(2)}
                    </p>
                    <p style="font-size:12px; margin:6px 0 0; opacity:0.9;">Comisiones este mes</p>
                </div>
            </div>
        </div>

        <!-- Comisiones histórico total: es la suma de TODAS las comisiones
             del esteticista desde que empezó a trabajar, sin filtrar por
             mes (a diferencia de la tarjeta de arriba, que solo cuenta el
             mes en curso). Se muestra en una tarjeta ancha aparte, debajo
             de las dos de "Rendimiento del mes", para no confundir un dato
             con el otro. -->
        <div style="margin-top:12px; background:linear-gradient(135deg,#7a5c2e,#4d3a1c); border-radius:12px;
                    padding:16px 20px; display:flex; justify-content:space-between; align-items:center; color:white;">
            <span style="font-size:13px; opacity:0.9;">Comisiones acumuladas (histórico total)</span>
            <span style="font-size:22px; font-weight:800;">
                Bs ${parseFloat(f.total_comisiones_historico).toFixed(2)}
            </span>
        </div>
    `);
}
