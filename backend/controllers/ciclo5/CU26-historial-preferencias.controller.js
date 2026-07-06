// =============================================================================
// ciclo5/CU26-historial-preferencias.controller.js — HISTORIAL DE PREFERENCIAS DEL CLIENTE
// Ciclo 5 — Seguimiento personalizado por cliente
//
// Permite al esteticista o administrador registrar y consultar las preferencias
// particulares de cada cliente: técnicas favoritas, alergias, indicaciones
// especiales u otras observaciones de servicio.
//
// A diferencia de CU6 (que guarda un perfil de estilo estructurado), este módulo
// acumula observaciones libres categorizadas por tipo, formando un historial
// cronológico que crece con cada visita.
//
// Endpoints exportados:
//   getPreferenciasCliente  → GET  /api/ciclo5/clientes/:ci/preferencias
//   registrarPreferencia    → POST /api/ciclo5/clientes/:ci/preferencias
//
// BD:
//   observaciones_cliente(id, ci_cliente FK→usuarios.ci, tipo, descripcion, fecha_registro)
//   usuarios(ci, nombre, email)
// =============================================================================

// pool = la conexión a la base de datos PostgreSQL (config/db.js). Se usa
// para mandar comandos SQL con pool.query(...).
const pool = require('../../config/db');

// =============================================================================
// initCU26() crea la tabla "observaciones_cliente" en la base de datos, PERO
// solo si todavía no existe (por eso "CREATE TABLE IF NOT EXISTS"). Esto
// permite que el proyecto funcione sin tener que correr un script de
// instalación aparte: la primera vez que arranca el servidor, la tabla se
// crea sola; las siguientes veces, como ya existe, esta instrucción no hace
// nada (no la borra ni la vuelve a crear).
//
// Columnas de la tabla:
//   id             → número único autogenerado (SERIAL) que identifica cada
//                    observación. Es la "llave primaria" (PRIMARY KEY).
//   ci_cliente     → la cédula del cliente al que pertenece esta observación.
//                    "REFERENCES usuarios(ci)" significa que este valor
//                    DEBE existir como un "ci" real en la tabla usuarios
//                    (esto es una "llave foránea" o FK) — así se evita que
//                    se guarde una observación de un cliente que no existe.
//                    "ON DELETE CASCADE" quiere decir: si algún día se borra
//                    ese usuario de la tabla usuarios, todas sus
//                    observaciones se borran automáticamente también (no
//                    quedan "huérfanas" apuntando a un cliente que ya no
//                    existe).
//   tipo           → texto corto que dice de qué categoría es la
//                    observación (ej. "Alergia", "Técnica favorita").
//   descripcion    → el texto libre donde se explica la observación.
//   fecha_registro → el momento exacto en que se guardó, puesto
//                    automáticamente por la base de datos con
//                    "DEFAULT NOW()" (no hay que mandarlo desde el código).
// =============================================================================
async function initCU26() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS observaciones_cliente (
            id              SERIAL PRIMARY KEY,
            ci_cliente      VARCHAR(20) NOT NULL
                                REFERENCES usuarios(ci) ON DELETE CASCADE,
            tipo            VARCHAR(80) NOT NULL,
            descripcion     TEXT        NOT NULL,
            fecha_registro  TIMESTAMP   NOT NULL DEFAULT NOW()
        )
    `);
}

// Esta línea es la que realmente EJECUTA initCU26(). Se llama una sola vez,
// apenas Node.js carga este archivo (que pasa cuando arranca el servidor y
// se hace el "require" de este controller desde las rutas).
// ".catch(err => ...)" es importante: initCU26() es una función async, y si
// fallara (por ejemplo, si la base de datos no estuviera disponible en ese
// momento), sin este .catch Node.js consideraría eso un error "no
// manejado" y podría tumbar todo el servidor. Con el .catch, el error
// simplemente se imprime en consola y el servidor sigue funcionando.
initCU26().catch(err => console.error('❌ Error init CU26:', err.message));

// =============================================================================
// GET /api/ciclo5/clientes/:ci/preferencias
// Devuelve los datos básicos del cliente y su historial completo de observaciones,
// ordenado de más reciente a más antiguo.
//
// Respuesta: { success, cliente: { ci, nombre, email }, observaciones: [...] }
// 404 si el CI no corresponde a un cliente registrado.
//
// Esta función se conecta automáticamente con la URL
// /api/ciclo5/clientes/:ci/preferencias cuando llega una petición GET
// (la conexión entre la URL y esta función está en routes/ciclo5.routes.js).
// =============================================================================
async function getPreferenciasCliente(req, res) {
    // Todo dentro de try/catch para que un error inesperado no tumbe el
    // servidor, sino que responda con un error 500 controlado.
    try {
        // req.params.ci es el pedazo de la URL que reemplazó al ":ci" (por
        // ejemplo, si la URL fue /api/ciclo5/clientes/12345678/preferencias,
        // entonces ci = "12345678").
        const { ci } = req.params;

        // Antes de buscar observaciones, hay que confirmar dos cosas a la
        // vez: que ese CI exista como usuario, Y que ese usuario tenga el
        // rol "Cliente" (y no sea, por ejemplo, un empleado o un admin al
        // que alguien le puso mal el CI). Por eso se hace un JOIN con la
        // tabla "roles": en la tabla "usuarios" el rol se guarda como un
        // número (id_rol), así que hay que ir a la tabla roles para poder
        // comparar por el nombre real ('Cliente') en vez de un número.
        const cliRes = await pool.query(`
            SELECT u.ci, u.nombre, u.email
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.ci = $1 AND r.nombre = 'Cliente'
        `, [ci]);

        // Si cliRes.rows viene vacío, quiere decir que no se encontró
        // ningún usuario con ese CI que además tenga el rol Cliente. Puede
        // ser porque el CI no existe, o porque existe pero es de otro rol.
        // En cualquiera de los dos casos, se corta aquí con un 404 y NO se
        // llega a buscar observaciones (no tendría sentido).
        if (cliRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
        }

        // Si el cliente sí existe, se traen TODAS sus observaciones
        // guardadas hasta ahora. "ORDER BY fecha_registro DESC" las ordena
        // de la más nueva a la más vieja (DESC = descendente), para que en
        // el modal del frontend la observación más reciente aparezca
        // primero en la línea de tiempo.
        const obsRes = await pool.query(`
            SELECT id, tipo, descripcion, fecha_registro
            FROM observaciones_cliente
            WHERE ci_cliente = $1
            ORDER BY fecha_registro DESC
        `, [ci]);

        // Se responde con dos partes:
        //   - "cliente" → un solo objeto con los datos básicos (ci, nombre,
        //     email) para mostrar en el encabezado del modal. Se usa
        //     cliRes.rows[0] porque, aunque la consulta podría en teoría
        //     traer más de una fila, un CI es único, así que solo importa
        //     la primera (y única) fila.
        //   - "observaciones" → el arreglo completo de observaciones
        //     (puede venir vacío [] si el cliente todavía no tiene
        //     ninguna registrada — eso NO es un error).
        res.json({
            success:       true,
            cliente:       cliRes.rows[0],
            observaciones: obsRes.rows
        });
    } catch (err) {
        // Cualquier error de conexión o de sintaxis SQL cae aquí. Se
        // imprime en consola con el prefijo [CU26] para identificar de
        // dónde viene, y se responde con un 500.
        console.error('[CU26] Error al obtener preferencias:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// =============================================================================
// POST /api/ciclo5/clientes/:ci/preferencias
// Registra una nueva observación para el cliente indicado.
//
// Body esperado: { tipo, descripcion }
//   tipo        → categoría de la observación (no vacío)
//   descripcion → texto libre (no vacío)
//
// Respuesta: { success, message, observacion: { id, tipo, descripcion, fecha_registro } }
//
// A diferencia de getPreferenciasCliente (que es GET y solo lee datos), esta
// función es POST porque su trabajo es CREAR algo nuevo en la base de datos.
// =============================================================================
async function registrarPreferencia(req, res) {
    try {
        // ci viene de la URL (parámetro de ruta), igual que en la función
        // anterior. tipo y descripcion, en cambio, vienen del "body" de la
        // petición — es decir, del JSON que el frontend mandó en el cuerpo
        // del POST (algo como { "tipo": "Alergia", "descripcion": "..." }).
        const { ci }                 = req.params;
        const { tipo, descripcion }  = req.body;

        // ── Validaciones de campos obligatorios ──────────────────────────────
        // Se revisa ANTES de tocar la base de datos, para no gastar una
        // consulta si los datos ya vienen incompletos. Cada "if" corta la
        // función con un "return" apenas encuentra un problema, así que si
        // el tipo está vacío, ni siquiera se llega a revisar la descripción.
        //
        // "!tipo" es true si tipo es undefined, null, o un string vacío "".
        // "!tipo.trim()" es true si tipo tiene solo espacios en blanco (por
        // ejemplo "   "), porque .trim() quita los espacios de los bordes y
        // si queda un string vacío, "!" lo convierte en true.
        // Se usa "||" (OR) entre ambas condiciones: si CUALQUIERA de las dos
        // es true, se considera que el campo no es válido.
        if (!tipo || !tipo.trim()) {
            return res.status(400).json({ success: false, message: 'El tipo de observación es obligatorio.' });
        }
        if (!descripcion || !descripcion.trim()) {
            return res.status(400).json({ success: false, message: 'La descripción es obligatoria.' });
        }

        // Igual que en getPreferenciasCliente: hay que confirmar que el CI
        // corresponda a un usuario con rol "Cliente" antes de insertar
        // nada. Esto evita crear una observación "huérfana" apuntando a un
        // CI que no existe, o registrarle una preferencia a un empleado o
        // administrador por error.
        const cliCheck = await pool.query(
            `SELECT u.ci FROM usuarios u
             JOIN roles r ON u.id_rol = r.id_rol
             WHERE u.ci = $1 AND r.nombre = 'Cliente'`,
            [ci]
        );
        // Si no se encontró ningún cliente con ese CI, se corta aquí con
        // un 404 y no se llega a la parte de insertar.
        if (cliCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
        }

        // Aquí se inserta finalmente la nueva fila en la tabla
        // observaciones_cliente. Los tres valores $1, $2, $3 se rellenan,
        // en orden, con ci, tipo.trim() y descripcion.trim() (el .trim()
        // se aplica de nuevo aquí para asegurarse de guardar el texto sin
        // espacios sueltos al principio o al final).
        //
        // Notar que NO se manda ninguna fecha: la columna fecha_registro
        // tiene "DEFAULT NOW()" en la definición de la tabla, así que
        // Postgres pone la fecha y hora actuales automáticamente.
        //
        // "RETURNING id, tipo, descripcion, fecha_registro" le pide a
        // Postgres que, después de insertar, devuelva esos mismos datos de
        // la fila recién creada — incluyendo el "id" que se generó solo
        // (gracias a SERIAL). Así no hace falta hacer una segunda consulta
        // para saber qué id le tocó a esta observación nueva.
        const insertRes = await pool.query(`
            INSERT INTO observaciones_cliente (ci_cliente, tipo, descripcion)
            VALUES ($1, $2, $3)
            RETURNING id, tipo, descripcion, fecha_registro
        `, [ci, tipo.trim(), descripcion.trim()]);

        // Se responde con éxito, incluyendo:
        //   - un mensaje de confirmación para mostrar al usuario
        //   - "observacion": el objeto con los datos de la fila recién
        //     creada (insertRes.rows[0], la primera y única fila que
        //     devolvió el RETURNING de arriba).
        res.json({
            success:      true,
            message:      'Preferencia registrada correctamente.',
            observacion:  insertRes.rows[0]
        });
    } catch (err) {
        // Error inesperado (conexión, SQL, etc.) — se registra en consola
        // con el prefijo [CU26] y se responde con un 500.
        console.error('[CU26] Error al registrar preferencia:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// Se exportan las dos funciones para que routes/ciclo5.routes.js pueda
// importarlas y conectarlas con sus respectivas rutas (GET y POST).
module.exports = { getPreferenciasCliente, registrarPreferencia };
