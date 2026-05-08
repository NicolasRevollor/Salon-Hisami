// =============================================================================
// config/db.js — CONEXIÓN A LA BASE DE DATOS PostgreSQL
//
// ¿Qué es un Pool?
//   Imagina que conectarse a la BD es como abrir una puerta con llave cada vez.
//   Un "Pool" guarda varias puertas abiertas al mismo tiempo para reutilizarlas,
//   en lugar de abrir y cerrar una en cada petición. Esto hace el servidor más rápido.
//
// ¿Cómo se usa en otros archivos?
//   const pool = require('../config/db');
//   const result = await pool.query('SELECT * FROM tabla');
// =============================================================================

const { Pool } = require('pg'); // librería oficial de Node.js para PostgreSQL

// Datos de conexión: igual que cuando te conectas con pgAdmin
const pool = new Pool({
    user:     'postgres',      // usuario de PostgreSQL
    host:     'localhost',     // la BD corre en esta misma computadora
    database: 'proyectosi1',   // nombre exacto de la base de datos del proyecto
    password: 'lalito007',     // contraseña del usuario postgres
    port:     5432,            // puerto por defecto de PostgreSQL (no cambiar)
});

// Verificar que la conexión funciona al iniciar el servidor.
// SELECT NOW() es la consulta más simple posible — solo pide la hora actual.
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('❌ Error de conexión con PostgreSQL:', err.stack);
    } else {
        console.log('✅ Conexión exitosa con PostgreSQL — base de datos: proyectosi1');
    }
});

// Exportar el pool para que cualquier controlador pueda importarlo y hacer consultas
module.exports = pool;
