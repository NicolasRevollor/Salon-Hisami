process.on('uncaughtException',  err    => console.error('💥 uncaughtException:', err.stack));
process.on('unhandledRejection', reason => console.error('💥 unhandledRejection:', reason));
process.on('beforeExit',         code   => console.error('💥 beforeExit — event loop vacío, code:', code));
process.on('exit',               code   => console.error('💥 exit, code:', code));
const _exit = process.exit.bind(process);
process.exit = (code) => { console.trace('💥 process.exit() llamado, code: ' + code); _exit(code); };

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes       = require('./routes/auth.routes');
const catalogoRoutes   = require('./routes/catalogo.routes');
const reservasRoutes   = require('./routes/reservas.routes');
const adminRoutes      = require('./routes/admin.routes');
const inventarioRoutes = require('./routes/inventario.routes');
const bitacoraRoutes   = require('./routes/bitacora.routes');
const ciclo3Routes     = require('./routes/ciclo3.routes');
const ciclo4Routes     = require('./routes/ciclo4.routes');
const ciclo4bRoutes    = require('./routes/ciclo4b.routes');
const ciclo4cRoutes    = require('./routes/ciclo4c.routes');
const reportesRoutes   = require('./routes/reportes.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.use(authRoutes);
app.use(catalogoRoutes);
app.use(reservasRoutes);
app.use(adminRoutes);
app.use(inventarioRoutes);
app.use(bitacoraRoutes);
app.use(ciclo3Routes);
app.use(ciclo4Routes);
app.use(ciclo4bRoutes);
app.use(ciclo4cRoutes);
app.use(reportesRoutes);

const PORT = 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor HISAMI funcionando en http://localhost:${PORT}`);
    console.log('server.listening:', server.listening);
});
server.on('close', () => console.error('💥 HTTP server se CERRÓ'));
server.on('error', err => console.error('💥 HTTP server error:', err.message));
