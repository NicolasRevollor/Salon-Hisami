// =============================================================================
// voice-report.controller.js — Interpretación de comandos de voz para reportes
//
// ¿Qué hace este archivo?
//   El administrador habla (por ejemplo: "dame las comisiones de este mes")
//   y este archivo convierte ese texto en parámetros concretos que el sistema
//   puede usar para generar el reporte correcto.
//
// Hay dos funciones principales:
//   1. interpretarComando(texto)  → analiza el texto y devuelve qué reporte pedir
//   2. interpretarVoz(req, res)   → recibe la petición HTTP y llama a la anterior
// =============================================================================


// -----------------------------------------------------------------------------
// interpretarComando(texto)
//
// Recibe el texto que el administrador dijo en voz alta y lo analiza palabra
// por palabra para detectar:
//   - ¿Qué tipo de reporte quiere? (comisiones, reservas, financiero, etc.)
//   - ¿De qué período? (este mes, mes pasado, una semana, un mes concreto, etc.)
//   - ¿Qué subtipo? (por ejemplo en recetas: por insumos o por popularidad)
//   - ¿Qué rol de usuario? (Cliente o Personal, para el reporte de bitácora)
//
// Devuelve un objeto con todos esos datos listos para pasarle al generador
// de reportes del frontend.
// -----------------------------------------------------------------------------
function interpretarComando(texto) {

    // ── Paso 0: Limpiar el texto ─────────────────────────────────────────────
    // Convertimos todo a minúsculas para que "Comisiones" y "comisiones"
    // se traten igual. También quitamos tildes (á→a, é→e, etc.) porque el
    // reconocimiento de voz a veces las incluye y a veces no.
    // normalize('NFD') descompone cada letra con tilde en letra + símbolo de tilde,
    // y el replace borra todos esos símbolos, dejando solo la letra base.
    const t = texto.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');

    // ── Paso 0b: Fecha de hoy ────────────────────────────────────────────────
    // La necesitamos para calcular "este mes", "esta semana", "últimos 30 días", etc.
    const hoy    = new Date();
    const año    = hoy.getFullYear();
    const mesHoy = hoy.getMonth() + 1; // getMonth() devuelve 0-11, sumamos 1 para tener 1-12

    // ── Variables que vamos a rellenar según lo que diga el usuario ──────────
    // tipo       → qué reporte quiere (ej: 'comisiones', 'reservas')
    // subtipo    → variante dentro del tipo (ej: 'insumos' vs 'requeridos' en recetas)
    // mes        → clave "YYYY-MM" para filtrar por mes en bitácora
    // ci         → cédula de un empleado concreto (todavía no se detecta por voz)
    // rol        → 'Cliente' o 'Personal' (solo para bitácora)
    // fechaInicio/fechaFin → rango de fechas para el reporte financiero y otros
    let tipo = null, subtipo = null, mes = null,
        ci = null, rol = 'Cliente', fechaInicio = null, fechaFin = null;


    // =========================================================================
    // PASO 1 — ¿QUÉ TIPO DE REPORTE QUIERE EL USUARIO?
    //
    // Usamos expresiones regulares (regex) para buscar palabras clave en el
    // texto. El .test(t) devuelve true si alguna de esas palabras aparece.
    // El orden importa: el primer if que coincida gana.
    // =========================================================================

    if (/servicio|receta|popular|requerido|solicitad|pedid|top servicio/.test(t)) {
        // El usuario mencionó servicios, recetas o popularidad
        // → reporte de servicios más solicitados o más costosos en insumos
        tipo    = 'recetas';

        // Dentro de "recetas" hay dos variantes:
        //   - 'insumos'    → top 5 servicios que más insumos gastan
        //   - 'requeridos' → servicios más reservados (default)
        subtipo = /insumo|gasta|consum/.test(t) ? 'insumos' : 'requeridos';

    } else if (/comision|empleado|esteticist|trabajador/.test(t)) {
        // El usuario mencionó comisiones, empleados o esteticistas
        // → reporte de comisiones del personal
        tipo = 'comisiones';

    } else if (/reserva|cita|agenda/.test(t)) {
        // El usuario mencionó reservas, citas o agenda
        // → reporte de reservas por mes
        tipo = 'reservas';

    } else if (/bitacora|acceso|login|sesion|ingreso sistema/.test(t)) {
        // El usuario mencionó bitácora, accesos o inicios de sesión
        // → reporte de actividad del sistema (quién entró y cuándo)
        tipo = 'bitacora';

        // Para la bitácora hay que saber si quiere ver actividad de Clientes
        // o de Personal. Por defecto asumimos 'Cliente'.
        rol = /personal|empleado|trabajador/.test(t) ? 'Personal' : 'Cliente';

    } else if (/financiero|ingreso|ganancia|dinero|caja|pago|stripe|venta/.test(t)) {
        // El usuario mencionó finanzas, ingresos, ganancias, pagos, etc.
        // → reporte financiero (totales de caja)
        tipo = 'financiero';

    } else {
        // No se detectó ninguna palabra clave reconocible.
        // En vez de fallar, mostramos el reporte financiero como fallback seguro.
        tipo = 'financiero';
    }


    // =========================================================================
    // PASO 2 — ¿DE QUÉ PERÍODO QUIERE EL REPORTE?
    //
    // Intentamos detectar el período en este orden de prioridad:
    //   1. Mes concreto nombrado ("enero", "marzo", etc.)
    //   2. "esta semana" / "semana actual"
    //   3. "este mes"   / "mes actual"
    //   4. "mes pasado" / "mes anterior"
    //   5. "últimos 30 días"
    //   6. "últimos 7 días"
    //   7. Default según tipo (si no se dijo nada)
    // =========================================================================

    // Diccionario: nombre del mes en español → número de mes (1-12)
    const mesesMap = {
        enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
        julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
    };

    // Recorremos todos los meses y revisamos si el usuario dijo alguno
    for (const [nombre, num] of Object.entries(mesesMap)) {
        if (t.includes(nombre)) {
            // Calculamos el último día del mes para tener el rango completo
            // new Date(año, num, 0) → día 0 del mes siguiente = último día del mes actual
            const lastDay = new Date(año, num, 0).getDate();

            // Guardamos la clave "YYYY-MM" y el rango completo del mes
            mes         = `${año}-${String(num).padStart(2, '0')}`;           // ej: "2025-06"
            fechaInicio = `${año}-${String(num).padStart(2, '0')}-01`;        // ej: "2025-06-01"
            fechaFin    = `${año}-${String(num).padStart(2, '0')}-${lastDay}`; // ej: "2025-06-30"
            break; // con encontrar uno ya es suficiente
        }
    }

    // Si el usuario dijo "esta semana" o "semana actual"
    if (!fechaInicio && /esta semana|semana actual/.test(t)) {
        // Calculamos el lunes de la semana actual
        // getDay() devuelve 0=domingo, 1=lunes, ..., 6=sábado
        // La fórmula (getDay() + 6) % 7 convierte a 0=lunes, 1=martes, ..., 6=domingo
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
        fechaInicio = lunes.toISOString().split('T')[0]; // "YYYY-MM-DD" del lunes
        fechaFin    = hoy.toISOString().split('T')[0];   // "YYYY-MM-DD" de hoy
    }

    // Si el usuario dijo "este mes" o "mes actual"
    if (!fechaInicio && /este mes|mes actual/.test(t)) {
        mes         = `${año}-${String(mesHoy).padStart(2, '0')}`;
        fechaInicio = `${año}-${String(mesHoy).padStart(2, '0')}-01`; // primer día del mes
        fechaFin    = hoy.toISOString().split('T')[0];                // hasta hoy
    }

    // Si el usuario dijo "mes pasado" o "mes anterior"
    if (!fechaInicio && /mes pasado|mes anterior/.test(t)) {
        // Creamos una fecha apuntando al día 1 del mes anterior
        // new Date(año, mesHoy - 2, 1): mesHoy-1 sería el mes actual, mesHoy-2 el anterior
        const prev    = new Date(año, mesHoy - 2, 1);
        const pAño    = prev.getFullYear();
        const pMes    = prev.getMonth() + 1;
        const lastDay = new Date(pAño, pMes, 0).getDate(); // último día de ese mes

        mes         = `${pAño}-${String(pMes).padStart(2, '0')}`;
        fechaInicio = `${pAño}-${String(pMes).padStart(2, '0')}-01`;
        fechaFin    = `${pAño}-${String(pMes).padStart(2, '0')}-${lastDay}`;
    }

    // Si el usuario dijo "últimos 30 días"
    if (!fechaInicio && /ultimos? 30 dias|30 dias/.test(t)) {
        const d30 = new Date(hoy);
        d30.setDate(hoy.getDate() - 30); // retrocedemos 30 días desde hoy
        fechaInicio = d30.toISOString().split('T')[0];
        fechaFin    = hoy.toISOString().split('T')[0];
    }

    // Si el usuario dijo "últimos 7 días"
    if (!fechaInicio && /ultimos? 7 dias|7 dias/.test(t)) {
        const d7 = new Date(hoy);
        d7.setDate(hoy.getDate() - 7); // retrocedemos 7 días desde hoy
        fechaInicio = d7.toISOString().split('T')[0];
        fechaFin    = hoy.toISOString().split('T')[0];
    }

    // ── Valores por defecto si el usuario no especificó período ─────────────

    // Si es reporte financiero y no se dijo ninguna fecha → usar el mes actual
    // (tiene más sentido que no mostrar nada)
    if (tipo === 'financiero' && !fechaInicio) {
        mes         = `${año}-${String(mesHoy).padStart(2, '0')}`;
        fechaInicio = `${año}-${String(mesHoy).padStart(2, '0')}-01`;
        fechaFin    = hoy.toISOString().split('T')[0];
    }

    // Si es bitácora y no se detectó mes → usar el mes actual como clave de filtro
    if (tipo === 'bitacora' && !mes) {
        mes = `${año}-${String(mesHoy).padStart(2, '0')}`;
    }


    // =========================================================================
    // PASO 3 — PREPARAR LOS TEXTOS QUE SE MUESTRAN EN LA INTERFAZ
    //
    // El frontend necesita un texto legible para mostrarle al usuario
    // qué reporte interpretó el sistema, por ejemplo: "Comisiones" o
    // "Reporte Financiero". También formateamos el período detectado.
    // =========================================================================

    // Texto descriptivo del tipo de reporte (se muestra en la pastilla naranja)
    const tipoLabels = {
        recetas:    subtipo === 'insumos' ? 'Servicios por consumo de insumos' : 'Servicios más solicitados',
        comisiones: 'Comisiones',
        reservas:   'Reservas por mes',
        bitacora:   `Bitácora — ${rol}`,    // incluye el rol detectado
        financiero: 'Reporte Financiero'
    };

    // Texto del período (se muestra en la pastilla gris junto al tipo)
    // Si no se detectó período, queda en null y el frontend no muestra la pastilla
    const periodoLabel = fechaInicio && fechaFin
        ? `${fechaInicio} → ${fechaFin}`
        : null;

    // Devolvemos todos los datos en un objeto plano
    // El frontend usará tipo/subtipo para saber qué endpoint llamar,
    // y fechaInicio/fechaFin para filtrar los resultados
    return { tipo, subtipo, mes, ci, rol, fechaInicio, fechaFin, tipoLabel: tipoLabels[tipo], periodoLabel };
}


// =============================================================================
// interpretarVoz(req, res)
//
// Endpoint HTTP: POST /api/reportes/voz
// Body esperado: { texto: "dame las comisiones de este mes" }
//
// Recibe el texto transcrito del reconocimiento de voz, lo pasa a
// interpretarComando() y devuelve el resultado al frontend.
//
// Si el texto llega vacío → responde con error 400 (Bad Request)
// Si interpretarComando() falla internamente → responde con error 500
// =============================================================================
async function interpretarVoz(req, res) {
    const { texto } = req.body;

    // Validación básica: si no llegó texto o es solo espacios, rechazamos la petición
    if (!texto || !texto.trim())
        return res.status(400).json({ success: false, message: 'texto es requerido.' });

    try {
        // Limpiamos espacios al inicio/final y delegamos toda la lógica a interpretarComando
        const interpretacion = interpretarComando(texto.trim());

        // Devolvemos la interpretación al frontend para que genere el reporte
        res.json({ success: true, interpretacion });

    } catch (err) {
        // Si algo falla de forma inesperada, avisamos sin exponer detalles internos
        res.status(500).json({ success: false, message: err.message });
    }
}

// Exportamos solo interpretarVoz — interpretarComando es interna, no necesita ruta propia
module.exports = { interpretarVoz };
