// =============================================================================
// ciclo5/CU24-buscar-servicios.controller.js — BÚSQUEDA DE SERVICIOS POR CATEGORÍA
// Ciclo 5 — Gestión avanzada del catálogo
//
// Permite al administrador, encargado o cliente localizar servicios del salón
// filtrando por una categoría específica. Si no se indica categoría (o se pasa
// "todas"), devuelve todos los servicios activos sin filtro.
//
// Endpoints exportados:
//   getServiciosPorCategoria → GET /api/ciclo5/servicios/buscar?id_categoria=X
//
// Parámetros de consulta (query params):
//   id_categoria → número entero con el id de la categoría, o "todas" / ausente
//                  para retornar todos los servicios sin filtro.
//
// Respuesta exitosa:
//   { success: true, servicios: [...], total: N }
// Respuesta vacía (sin coincidencias):
//   { success: true, servicios: [], total: 0 }
//
// BD: servicios(id_servicio, nombre_servicio, descripcion, precio, id_categoria, estado)
//      categoria(id_categoria, nombre)
// =============================================================================

// pool es la conexión (o "piscina" de conexiones) a la base de datos
// PostgreSQL. Ya viene configurado en config/db.js — aquí solo se importa
// para poder usar pool.query(...) y mandar comandos SQL.
const pool = require('../../config/db');

// =============================================================================
// GET /api/ciclo5/servicios/buscar
// Devuelve los servicios activos que pertenecen a la categoría indicada.
// Si id_categoria es "todas" o está ausente, retorna todos los activos.
//
// Esta es la función que Express ejecuta automáticamente cada vez que llega
// una petición HTTP GET a la ruta /api/ciclo5/servicios/buscar (esa conexión
// entre la URL y esta función está en routes/ciclo5.routes.js).
// "req" (request) trae los datos que mandó quien hizo la petición.
// "res" (response) es el objeto que se usa para contestarle.
// =============================================================================
async function getServiciosPorCategoria(req, res) {
    // Todo el código va dentro de un try/catch: si algo sale mal (por
    // ejemplo, la base de datos no responde), el catch de más abajo evita
    // que el servidor entero se caiga, y en vez de eso responde con un
    // error 500 controlado.
    try {
        // req.query contiene todo lo que viene después del "?" en la URL.
        // Por ejemplo, si la URL es .../buscar?id_categoria=3, entonces
        // req.query.id_categoria será el string "3".
        // Con "const { id_categoria } = req.query;" simplemente se saca
        // ese valor y se guarda en una variable con el mismo nombre.
        const { id_categoria } = req.query;

        // Aquí se decide SI hay que filtrar por categoría o no.
        // Puede pasar que:
        //   - id_categoria no venga en la URL          → sería undefined (falsy)
        //   - id_categoria venga como el texto "todas"  → el admin eligió "Todas"
        //   - id_categoria venga como un número en texto (ej. "3") → sí filtrar
        // La variable filtrarPorCategoria queda en true SOLO en el último caso.
        // "id_categoria && id_categoria !== 'todas'" se lee así:
        //   "si id_categoria tiene algún valor (no es undefined/vacío) Y
        //    además ese valor no es la palabra 'todas', entonces sí filtrar".
        const filtrarPorCategoria = id_categoria && id_categoria !== 'todas';

        // Aquí se arma el texto de la consulta SQL que se le va a mandar a
        // la base de datos. Se explica pieza por pieza:
        //
        //   SELECT ...             → qué columnas se quieren traer
        //   FROM servicios s       → de la tabla "servicios", usando "s" como
        //                            apodo corto (alias) para no repetir la
        //                            palabra "servicios" en cada columna.
        //   LEFT JOIN categoria c  → además, se "pega" cada servicio con su
        //   ON s.id_categoria =      categoría correspondiente, comparando
        //      c.id_categoria        el id_categoria de servicios con el
        //                            id_categoria de la tabla categoria.
        //                            Es "LEFT JOIN" (y no un JOIN normal)
        //                            porque si un servicio no tuviera
        //                            categoría asignada, igual queremos que
        //                            aparezca en la lista (con
        //                            nombre_categoria en null), en vez de
        //                            que desaparezca por completo.
        //   WHERE s.estado='Activo' → solo interesan los servicios que están
        //                             activos (no los dados de baja).
        //   AND s.id_categoria=$1   → este pedazo SOLO se agrega si
        //                             filtrarPorCategoria es true (ver más
        //                             abajo el operador ternario). El "$1"
        //                             es un "hueco" que Postgres rellena de
        //                             forma segura con el valor real más
        //                             adelante (esto evita inyección SQL:
        //                             nunca se pega el valor directamente
        //                             como texto dentro del query).
        //   ORDER BY c.nombre,      → ordena el resultado alfabéticamente,
        //      s.nombre_servicio     primero por nombre de categoría y
        //                            luego por nombre de servicio, para que
        //                            la tabla se vea prolija y agrupada.
        //
        // El "${filtrarPorCategoria ? 'AND s.id_categoria = $1' : ''}" es un
        // operador ternario de JavaScript: "si filtrarPorCategoria es true,
        // pon el texto 'AND s.id_categoria = $1'; si es false, no pongas
        // nada (texto vacío)". Así el mismo query sirve para los dos casos
        // (con filtro y sin filtro) sin tener que escribir dos consultas
        // separadas.
        const query = `
            SELECT s.id_servicio,
                   s.nombre_servicio,
                   s.descripcion,
                   s.precio,
                   s.id_categoria,
                   c.nombre AS nombre_categoria
            FROM servicios s
            LEFT JOIN categoria c ON s.id_categoria = c.id_categoria
            WHERE s.estado = 'Activo'
            ${filtrarPorCategoria ? 'AND s.id_categoria = $1' : ''}
            ORDER BY c.nombre ASC, s.nombre_servicio ASC
        `;

        // "params" es el arreglo de valores que van a rellenar los "$1",
        // "$2", etc. del query de arriba. Como el query solo tiene UN "$1"
        // (y solo cuando filtrarPorCategoria es true), el arreglo:
        //   - si SÍ se filtra: [id_categoria]  → un solo elemento
        //   - si NO se filtra: []              → arreglo vacío, porque el
        //     query de ese caso no tiene ningún "$1" que rellenar.
        const params = filtrarPorCategoria ? [id_categoria] : [];

        // Aquí es donde realmente se manda la consulta a la base de datos
        // y se espera (await) a que responda. pool.query(...) devuelve un
        // objeto donde "result.rows" es un arreglo con una fila por cada
        // servicio encontrado (cada fila es un objeto con las columnas del
        // SELECT: id_servicio, nombre_servicio, etc.).
        const result = await pool.query(query, params);

        // Se responde al frontend en formato JSON. "success: true" le dice
        // al frontend que todo salió bien. "servicios" es la lista de
        // resultados. "total" es simplemente cuántas filas se encontraron
        // (result.rows.length cuenta los elementos del arreglo) — así el
        // frontend no tiene que contar el arreglo él mismo, ya viene listo.
        res.json({
            success:   true,
            servicios: result.rows,
            total:     result.rows.length
        });
    } catch (err) {
        // Si algo dentro del try falla (por ejemplo, un error de conexión a
        // la base de datos, o un error de sintaxis en el SQL), la ejecución
        // salta directo a este bloque catch, saltándose todo lo demás.
        //
        // console.error(...) imprime el error en la consola del servidor
        // (no lo ve el usuario final, solo sirve para que el desarrollador
        // pueda investigar qué pasó). El prefijo "[CU24]" ayuda a identificar
        // rápido de qué caso de uso viene el error cuando se revisan los logs.
        console.error('[CU24] Error al buscar servicios por categoría:', err.message);

        // res.status(500) marca la respuesta HTTP como "Error interno del
        // servidor". Junto con eso se manda un JSON con success:false y el
        // mensaje del error, para que el frontend pueda mostrarlo si quiere.
        res.status(500).json({ success: false, message: err.message });
    }
}

// module.exports es lo que hace que otras partes del proyecto (en este
// caso, routes/ciclo5.routes.js) puedan usar esta función haciendo
// require('./CU24-buscar-servicios.controller'). Solo se exporta
// getServiciosPorCategoria porque es la única función pública de este CU.
module.exports = { getServiciosPorCategoria };
