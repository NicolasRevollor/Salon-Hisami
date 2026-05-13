const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT),
});

pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Error de conexión con PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conexión exitosa con PostgreSQL – base de datos: proyectosi1');
  }
});

module.exports = pool;
