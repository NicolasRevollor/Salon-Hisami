// =============================================================================
// ciclo5/CU25-ficha-esteticista.controller.js — FICHA DEL ESTETICISTA
// Ciclo 5 — Consulta consolidada del perfil y rendimiento individual
//
// Permite al administrador visualizar de forma centralizada el perfil completo
// de un esteticista: datos personales, especialidades asignadas, cantidad de
// citas atendidas en el mes actual, monto de comisiones acumuladas en ese
// mismo período, y el total histórico de comisiones ganadas desde siempre.
//
// Endpoint exportado:
//   getFichaEsteticista → GET /api/ciclo5/esteticistas/:ci/ficha
//
// Parámetro de ruta:
//   :ci → cédula de identidad del esteticista (ci_usuario en tabla usuarios)
//
// Respuesta exitosa:
//   { success: true, ficha: { ...datosPers, especialidades[], total_citas_mes,
//                             total_comisiones_mes, total_comisiones_historico } }
// Respuesta cuando no existe:
//   HTTP 404 → { success: false, message: 'Esteticista no encontrado.' }
//
// BD consultada:
//   personal(id_esteticista, ci_usuario, estado, area)
//   usuarios(ci, nombre, email, telefono)
//   personal_especialidades(id_esteticista FK, id_especialidad FK)
//   especialidades(id_especialidad, nombre_especialidad)
//   reservas(id_cita, id_esteticista FK, fecha, estado)
//   comision(id_comision, id_esteticista FK, fecha, monto_comision)
// =============================================================================

// pool = la conexión a la base de datos PostgreSQL, ya configurada en
// config/db.js. Se usa para mandar consultas SQL con pool.query(...).
const pool = require('../../config/db');

// =============================================================================
// GET /api/ciclo5/esteticistas/:ci/ficha
// Devuelve la ficha completa del esteticista identificado por su CI.
// La sección de rendimiento (citas y comisiones) se calcula sobre el mes actual.
//
// Esta función se ejecuta automáticamente cuando llega una petición HTTP GET
// a una URL como /api/ciclo5/esteticistas/12345678/ficha (el ":ci" en la ruta
// es un "parámetro dinámico": lo que sea que el usuario ponga ahí — en este
// ejemplo "12345678" — Express lo pone disponible en req.params.ci).
// =============================================================================
async function getFichaEsteticista(req, res) {
    // try/catch: si cualquier línea de aquí adentro lanza un error (por
    // ejemplo, se cae la conexión a la base de datos), la ejecución salta
    // directo al catch de al final, en vez de tumbar el servidor completo.
    try {
        // req.params.ci es el pedazo de la URL que reemplazó a ":ci". Por
        // ejemplo, si la petición fue a /api/ciclo5/esteticistas/12345678/ficha,
        // entonces ci = "12345678" (siempre llega como texto/string).
        // OJO: esto es la cédula, NO el id_esteticista interno de la tabla
        // "personal" — ese id todavía no se conoce, hay que buscarlo.
        const { ci } = req.params;

        // ── PASO 1: Traer los datos personales + las especialidades ─────────
        //
        // Esta consulta junta (con JOIN) TRES tablas en un solo viaje a la
        // base de datos, para no tener que hacer 3 consultas separadas:
        //
        //   personal p       → tiene id_esteticista, estado (Activo/Inactivo)
        //                       y area (en qué área trabaja).
        //   usuarios u        → tiene el nombre, correo y teléfono de la
        //                       persona (esos datos NO están en "personal",
        //                       están en la tabla general de usuarios).
        //   personal_especialidades pe / especialidades e
        //                     → tabla intermedia que conecta un esteticista
        //                       con las especialidades que tiene asignadas
        //                       (una persona puede tener varias, por eso se
        //                       necesita esta tabla "puente").
        //
        // "JOIN usuarios u ON p.ci_usuario = u.ci" es un JOIN normal (no
        // LEFT): esto significa que solo trae la fila si SÍ existe un
        // usuario con ese ci. Como todo esteticista debería tener su
        // usuario, esto está bien — si no existiera, algo estaría mal en
        // los datos y de todos modos no habría nada que mostrar.
        //
        // "LEFT JOIN personal_especialidades" y "LEFT JOIN especialidades"
        // SÍ son LEFT (a diferencia del de arriba), porque un esteticista
        // podría no tener NINGUNA especialidad asignada todavía, y aun así
        // se le debe poder ver la ficha (solo que sin especialidades).
        // Con un JOIN normal, si no tuviera especialidades, la fila entera
        // desaparecería del resultado — por eso se usa LEFT.
        //
        // json_agg(...) es una función especial de PostgreSQL que junta
        // varias filas en un solo arreglo (array) de JSON. Como un
        // esteticista puede tener 2 especialidades, sin json_agg saldrían
        // 2 filas separadas (una por cada especialidad) repitiendo todos los
        // demás datos personales — con json_agg, todas esas especialidades
        // quedan comprimidas en un solo campo tipo lista, por ejemplo:
        //   [{"id":1,"nombre":"Uñas"}, {"id":2,"nombre":"Cabello"}]
        //
        // json_build_object('id', ..., 'nombre', ...) arma, para cada
        // especialidad, un objeto JSON con esas dos propiedades (en vez de
        // solo el número del id).
        //
        // "FILTER (WHERE e.id_especialidad IS NOT NULL)" es importante: como
        // se usó LEFT JOIN, si el esteticista NO tiene especialidades, el
        // LEFT JOIN de todos modos genera una fila con "e.id_especialidad"
        // en NULL. Sin este FILTER, json_agg metería ese NULL dentro del
        // arreglo (quedaría algo como [null], que se ve feo). El FILTER le
        // dice a json_agg "ignora las filas donde no hay especialidad real".
        //
        // COALESCE(expresión, '[]'::json) significa: "si la expresión de
        // adentro termina dando NULL (que pasaría si, después del FILTER, no
        // queda ninguna especialidad), entonces usa '[]' (un arreglo JSON
        // vacío) en su lugar". Así el frontend siempre recibe un arreglo,
        // nunca null, y no tiene que estar comprobando ese caso especial.
        //
        // GROUP BY es obligatorio aquí porque se está usando json_agg (una
        // función de "agregación", como SUM o COUNT): hay que decirle a
        // Postgres "agrupa todas las filas que tengan estos mismos datos
        // personales, y arma UN SOLO renglón por esteticista, juntando sus
        // especialidades en el arreglo". Por eso se listan ahí todas las
        // columnas normales que NO son especialidades.
        const fichaRes = await pool.query(`
            SELECT p.id_esteticista,
                   u.ci,
                   u.nombre,
                   u.email,
                   u.telefono,
                   p.estado,
                   p.area,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id',     e.id_especialidad,
                               'nombre', e.nombre_especialidad
                           )
                       ) FILTER (WHERE e.id_especialidad IS NOT NULL),
                       '[]'::json
                   ) AS especialidades
            FROM personal p
            JOIN usuarios u ON p.ci_usuario = u.ci
            LEFT JOIN personal_especialidades pe ON p.id_esteticista = pe.id_esteticista
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE u.ci = $1
            GROUP BY p.id_esteticista, u.ci, u.nombre, u.email, u.telefono, p.estado, p.area
        `, [ci]);

        // fichaRes.rows es un arreglo. Si el CI no corresponde a ningún
        // esteticista registrado, ese arreglo viene vacío (length === 0).
        // En ese caso se corta la función aquí mismo con un "return":
        //   - se responde con el código HTTP 404 ("no encontrado")
        //   - success:false para que el frontend sepa que falló
        //   - un mensaje de error legible para mostrar en pantalla
        // El "return" es clave: evita que el código siga bajando e intente
        // hacer las consultas de citas/comisiones con datos que no existen.
        if (fichaRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Esteticista no encontrado.'
            });
        }

        // Si llegamos hasta aquí, SÍ se encontró al esteticista. Se guarda
        // la primera (y única) fila del resultado en una variable con
        // nombre más claro. fichaRes.rows[0] es un objeto con propiedades
        // como esteticista.id_esteticista, esteticista.nombre, etc.
        const esteticista = fichaRes.rows[0];

        // ── PASO 2: Contar cuántas citas atendió este mes ────────────────────
        //
        // Se busca en la tabla "reservas" cuántas filas cumplen TODAS estas
        // condiciones a la vez (todas conectadas con AND):
        //   - id_esteticista = $1        → que sean de este esteticista
        //   - estado = 'Completada'      → que ya se hayan completado (no
        //                                   cuentan las pendientes, ni las
        //                                   canceladas, ni las confirmadas
        //                                   que todavía no pasaron)
        //   - DATE_TRUNC('month', fecha) → que la fecha de la reserva caiga
        //     = DATE_TRUNC('month',        dentro del mismo mes y año que
        //       CURRENT_DATE)              "ahora" (la fecha actual del
        //                                  servidor).
        //
        // DATE_TRUNC('month', una_fecha) "recorta" una fecha para quedarse
        // solo con el año y el mes (el día siempre queda en 1). Por ejemplo,
        // si hoy es 2026-07-06, DATE_TRUNC('month', CURRENT_DATE) da
        // 2026-07-01. Y si una reserva fue el 2026-07-23, su
        // DATE_TRUNC('month', fecha) también da 2026-07-01. Como los dos
        // valores truncados son IGUALES, esa reserva SÍ cuenta como "de este
        // mes" — sin importar el día exacto en que ocurrió.
        //
        // COUNT(*) simplemente cuenta cuántas filas cumplieron con el WHERE.
        const citasRes = await pool.query(`
            SELECT COUNT(*) AS total_citas_mes
            FROM reservas
            WHERE id_esteticista = $1
              AND estado = 'Completada'
              AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
        `, [esteticista.id_esteticista]);

        // ── PASO 3: Sumar las comisiones ganadas este mes ────────────────────
        //
        // Parecido al paso anterior, pero en vez de contar filas, se SUMAN
        // los montos de la columna monto_comision de todas las comisiones
        // de este esteticista generadas este mes.
        //
        // COALESCE(SUM(...), 0) es necesario porque SUM() de SQL devuelve
        // NULL (no 0) cuando no hay NINGUNA fila que sumar. Sin el COALESCE,
        // si el esteticista no tuviera ninguna comisión este mes, el
        // resultado sería null y se rompería el cálculo más abajo
        // (parseFloat(null) da NaN). Con COALESCE, en ese caso se devuelve
        // 0 directamente.
        const comisionRes = await pool.query(`
            SELECT COALESCE(SUM(monto_comision), 0) AS total_comisiones_mes
            FROM comision
            WHERE id_esteticista = $1
              AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
        `, [esteticista.id_esteticista]);

        // ── PASO 4: Sumar TODAS las comisiones históricas (sin filtro de mes) ─
        //
        // Es la misma idea que el paso 3, pero SIN la condición de
        // DATE_TRUNC — así se suman las comisiones de TODA la vida del
        // esteticista en el sistema, no solo las del mes en curso. Sirve
        // para mostrar en la ficha cuánto ha generado en comisiones desde
        // que empezó a trabajar, además del dato "solo este mes".
        // COALESCE(SUM(...), 0) por la misma razón que arriba: si el
        // esteticista nunca tuvo ninguna comisión, SUM devolvería NULL en
        // vez de 0.
        const comisionHistoricoRes = await pool.query(`
            SELECT COALESCE(SUM(monto_comision), 0) AS total_comisiones_historico
            FROM comision
            WHERE id_esteticista = $1
        `, [esteticista.id_esteticista]);

        // ── PASO 5: Armar y mandar la respuesta final ────────────────────────
        //
        // "...esteticista" es la sintaxis de "spread" de JavaScript: copia
        // todas las propiedades del objeto esteticista (id_esteticista, ci,
        // nombre, email, telefono, estado, area, especialidades) dentro de
        // este nuevo objeto "ficha", como si se hubieran escrito una por una.
        //
        // Luego se le agregan las tres métricas calculadas en los pasos
        // 2, 3 y 4. Se usa parseInt(..., 10) y parseFloat(...) porque
        // cuando Postgres devuelve el resultado de un COUNT o un SUM, el
        // driver de node (pg / node-postgres) los entrega como texto
        // (string), no como número real de JavaScript. Sin esta
        // conversión, en el frontend podría pasar algo como sumar "3" + "2"
        // y obtener el texto "32" en vez del número 5. Convertirlos aquí,
        // en el backend, asegura que el frontend siempre reciba números de
        // verdad.
        res.json({
            success: true,
            ficha: {
                ...esteticista,
                total_citas_mes:            parseInt(citasRes.rows[0].total_citas_mes, 10),
                total_comisiones_mes:       parseFloat(comisionRes.rows[0].total_comisiones_mes),
                total_comisiones_historico: parseFloat(comisionHistoricoRes.rows[0].total_comisiones_historico)
            }
        });
    } catch (err) {
        // Si algo falló en cualquiera de las 3 consultas (o antes), cae acá.
        // Se registra el error en la consola del servidor (para que el
        // desarrollador lo vea en los logs) con el prefijo "[CU25]" para
        // identificar fácilmente de qué parte del sistema viene.
        console.error('[CU25] Error al obtener ficha del esteticista:', err.message);

        // Se responde con código HTTP 500 (error interno del servidor) y un
        // JSON indicando que falló, junto con el mensaje del error.
        res.status(500).json({ success: false, message: err.message });
    }
}

// Se exporta la función para que routes/ciclo5.routes.js pueda importarla
// y conectarla con la URL /api/ciclo5/esteticistas/:ci/ficha.
module.exports = { getFichaEsteticista };
