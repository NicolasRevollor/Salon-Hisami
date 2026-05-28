// =============================================================================
// config/db.js — CONEXIÓN A LA BASE DE DATOS PostgreSQL
//
// ¿Qué hace este archivo?
//   Crea un "pool" de conexiones a PostgreSQL y lo exporta para que
//   cualquier controlador pueda hacer consultas SQL simplemente haciendo:
//     const pool = require('../config/db');
//     const resultado = await pool.query('SELECT ...');
//
// ¿Qué es un Pool?
//   En vez de abrir y cerrar la conexión a la BD en cada petición
//   (lo cual es lento), el pool mantiene varias conexiones abiertas
//   y las reutiliza. Más eficiente y rápido.
//
// Credenciales:
//   Se leen del archivo .env (en la raíz del proyecto) mediante dotenv.
//   Así las contraseñas no quedan escritas directamente en el código.
//   Variables requeridas en .env:
//     DB_USER     → usuario de PostgreSQL (ej: postgres)
//     DB_PASSWORD → contraseña del usuario
//     DB_HOST     → servidor (ej: localhost)
//     DB_PORT     → puerto (ej: 5432)
//     DB_NAME     → nombre de la base de datos (ej: proyectosi1)
// =============================================================================

const { Pool } = require('pg');   // pg = librería oficial de PostgreSQL para Node.js
const path = require('path');
// DOTENV_QUIET=true suprime el mensaje de dotenv v17 en la terminal
process.env.DOTENV_QUIET = 'true';
// Ruta explícita al .env para que funcione sin importar desde qué carpeta se inicie el servidor
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Crear el pool con las credenciales del .env
const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT),  // parseInt porque .env devuelve strings
});

// Prueba de conexión al arrancar el servidor.
// Si falla aquí, revisa que PostgreSQL esté corriendo y que .env tenga las credenciales correctas.
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Error de conexión con PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conexión exitosa con PostgreSQL – base de datos: proyectosi1');
  }
});

// Exportar el pool para usarlo en todos los controladores con require('../config/db')
module.exports = pool;
