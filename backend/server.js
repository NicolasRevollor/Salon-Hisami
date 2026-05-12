// =============================================================================
// server.js — PUNTO DE ENTRADA DEL SERVIDOR HISAMI
//
// Este archivo hace SOLO tres cosas:
//   1. Configura Express (middlewares: cors, json, archivos estáticos)
//   2. Registra todas las rutas (importadas desde la carpeta routes/)
//   3. Arranca el servidor en el puerto 3000
//
// Para iniciar: node backend/server.js   (desde la carpeta pagina/)
//          o:   npm start
//
// ¿Por qué tan corto?
//   Antes todo el código estaba aquí. Ahora cada responsabilidad está
//   en su propio archivo, así es mucho más fácil encontrar y modificar algo.
// 
// Estructura del backend:
//   config/
//     db.js          → conexión a PostgreSQL  
//     mailer.js      → configuración de correos (nodemailer)
//   controllers/
//     auth.controller.js       → login, registro, contraseñas, menús 
//     catalogo.controller.js   → servicios, categorías, comisiones
//     reservas.controller.js   → esteticistas, disponibilidad, reservas
//     admin.controller.js      → CRUD de empleados, servicios, paquetes, privilegios
//     inventario.controller.js → insumos, compras, recetas
//   routes/
//     auth.routes.js       → define las URLs de autenticación
//     catalogo.routes.js   → define las URLs del catálogo
//     reservas.routes.js   → define las URLs de reservas
//     admin.routes.js      → define las URLs del admin
//     inventario.routes.js → define las URLs del inventario
// =============================================================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// ── Importar todas las rutas ──────────────────────────────────────────────
const authRoutes       = require('./routes/auth.routes');
const catalogoRoutes   = require('./routes/catalogo.routes');
const reservasRoutes   = require('./routes/reservas.routes');
const adminRoutes      = require('./routes/admin.routes');
const inventarioRoutes = require('./routes/inventario.routes');
const bitacoraRoutes   = require('./routes/bitacora.routes');

const app = express();

// =============================================================================
// MIDDLEWARES — se ejecutan en CADA petición antes de llegar a la ruta
//
// cors()           → permite que el navegador haga peticiones desde otro puerto
//                    (ej: frontend en :5500 habla con backend en :3000)
// express.json()   → permite leer req.body cuando el cliente envía datos JSON
// express.static() → sirve los archivos del frontend (HTML, CSS, JS de /frontend)
// =============================================================================
app.use(cors());
app.use(express.json());

// Servir el frontend estático
// __dirname es la carpeta de este archivo → pagina/backend/
// '../frontend' sube un nivel y entra a pagina/frontend/
app.use(express.static(path.join(__dirname, '../frontend')));

// =============================================================================
// REGISTRAR RUTAS
// app.use(router) monta todas las rutas del router en la aplicación.
// El orden aquí no afecta — cada router tiene sus propias URLs definidas.
// =============================================================================
app.use(authRoutes);
app.use(catalogoRoutes);
app.use(reservasRoutes);
app.use(adminRoutes);
app.use(inventarioRoutes);
app.use(bitacoraRoutes);

// =============================================================================
// ARRANCAR EL SERVIDOR
// El servidor queda escuchando en http://localhost:3000
// Todo lo que se conecte a ese puerto será atendido por Express.
// =============================================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor HISAMI funcionando en http://localhost:${PORT}`);
});
