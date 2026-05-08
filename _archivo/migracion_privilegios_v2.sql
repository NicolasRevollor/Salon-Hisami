-- =============================================================
-- ESTRUCTURA FINAL: 5 PAQUETES CON TODOS SUS CUS
-- =============================================================

-- 1. PAQUETE: GESTION DE SEGURIDAD
CREATE TABLE IF NOT EXISTS paquetes_sistema (
    id_paquete_sist INT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(1, 'Gestion de Seguridad', 'Control de acceso, login, roles y auditoria')
ON CONFLICT (id_paquete_sist) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;

-- 2. PAQUETE: GESTION DE RESERVAS Y CLIENTES
INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(2, 'Gestion de Reservas y Clientes', 'Centraliza la agenda, clientes y comunicacion')
ON CONFLICT (id_paquete_sist) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;

-- 3. PAQUETE: GESTION DE CATALOGO Y PERSONAL
INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(3, 'Gestion de Catalogo y Personal', 'Organiza la oferta comercial y el talento humano')
ON CONFLICT (id_paquete_sist) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;

-- 4. PAQUETE: GESTION DE CAJA Y FINANZAS
INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(4, 'Gestion de Caja y Finanzas', 'Controla el flujo monetario, pagos y comisiones')
ON CONFLICT (id_paquete_sist) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;

-- 5. PAQUETE: GESTION DE INVENTARIO
INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(5, 'Gestion de Inventario', 'Supervisa insumos, consumos y stock')
ON CONFLICT (id_paquete_sist) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;

-- =============================================================
-- CASOS DE USO (CUS) POR PAQUETE
-- =============================================================

CREATE TABLE IF NOT EXISTS casos_uso (
    id_cu INT PRIMARY KEY,
    id_paquete_sist INT REFERENCES paquetes_sistema(id_paquete_sist) ON DELETE CASCADE,
    nombre_cu VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ruta VARCHAR(100)
);

-- PAQUETE 1: SEGURIDAD
INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(1, 1, 'CU1 - Iniciar Sesion', 'Login y registro de acceso', '/login'),
(2, 1, 'CU2 - Cerrar Sesion', 'Salida del sistema', '/logout'),
(18, 1, 'CU18 - Gestionar Roles/Privilegios', 'Define niveles de autoridad', '/admin-privilegios'),
(19, 1, 'CU19 - Administrar Bitacora', 'Registro auditable de acciones', '/bitacora')
ON CONFLICT (id_cu) DO UPDATE SET id_paquete_sist = EXCLUDED.id_paquete_sist, nombre_cu = EXCLUDED.nombre_cu, descripcion = EXCLUDED.descripcion, ruta = EXCLUDED.ruta;

-- PAQUETE 2: RESERVAS Y CLIENTES
INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(3, 2, 'CU3 - Gestionar Cita/Reserva', 'Bloqueo de espacios en agenda', '/hacer-reserva'),
(10, 2, 'CU10 - Gestionar Cliente', 'Datos de contacto de personas', '/gestion-clientes'),
(6, 2, 'CU6 - Registro Preferencias', 'Historial clinico-estetico', '/preferencias'),
(20, 2, 'CU20 - Recordatorios Automaticos', 'Alertas a clientes antes de cita', '/recordatorios'),
(21, 2, 'CU21 - Integrar WhatsApp', 'Comunicacion externa con clientes', '/whatsapp')
ON CONFLICT (id_cu) DO UPDATE SET id_paquete_sist = EXCLUDED.id_paquete_sist, nombre_cu = EXCLUDED.nombre_cu, descripcion = EXCLUDED.descripcion, ruta = EXCLUDED.ruta;

-- PAQUETE 3: CATALOGO Y PERSONAL
INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(8, 3, 'CU8 - Gestionar Categoria', 'Jerarquia del menu del salon', '/gestion-categorias'),
(7, 3, 'CU7 - Gestionar Servicio', 'Administra servicios individuales', '/gestion-servicios'),
(9, 3, 'CU9 - Gestionar Paquetes', 'Combina servicios en promociones', '/gestion-paquetes'),
(11, 3, 'CU11 - Gestionar Personal', 'Perfiles de trabajadores activos', '/gestion-personal'),
(12, 3, 'CU12 - Gestionar Especialidades', 'Puente entre personal y catalogo', '/gestion-especialidades')
ON CONFLICT (id_cu) DO UPDATE SET id_paquete_sist = EXCLUDED.id_paquete_sist, nombre_cu = EXCLUDED.nombre_cu, descripcion = EXCLUDED.descripcion, ruta = EXCLUDED.ruta;

-- PAQUETE 4: CAJA Y FINANZAS
INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(13, 4, 'CU13 - Gestionar Apertura/Cierre', 'Inicia y finaliza ciclo financiero', '/caja'),
(4, 4, 'CU4 - Realizar Pago de Reserva', 'Procesa ingreso por servicio', '/pagar'),
(5, 4, 'CU5 - Emitir Factura', 'Genera comprobante de pago', '/factura'),
(16, 4, 'CU16 - Gestionar Comisiones', 'Calcula remuneracion variable', '/comisiones'),
(17, 4, 'CU17 - Generar Reporte Financiero', 'Vision gerencial de ganancias', '/reportes')
ON CONFLICT (id_cu) DO UPDATE SET id_paquete_sist = EXCLUDED.id_paquete_sist, nombre_cu = EXCLUDED.nombre_cu, descripcion = EXCLUDED.descripcion, ruta = EXCLUDED.ruta;

-- PAQUETE 5: INVENTARIO
INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(23, 5, 'CU23 - Gestionar Compras/Pedidos', 'Registra entrada de mercaderia al local', '/compras'),
(14, 5, 'CU14 - Gestionar Kit de Personal', 'Salida de insumos al carrito de trabajo', '/kits'),
(24, 5, 'CU24 - Gestionar Consumo/Receta', 'Define formula estandar por servicio', '/recetas'),
(15, 5, 'CU15 - Monitorear Alertas Stock', 'Vigilante de niveles criticos', '/alertas-stock')
ON CONFLICT (id_cu) DO UPDATE SET id_paquete_sist = EXCLUDED.id_paquete_sist, nombre_cu = EXCLUDED.nombre_cu, descripcion = EXCLUDED.descripcion, ruta = EXCLUDED.ruta;

-- =============================================================
-- TABLA DE PRIVILEGIOS
-- =============================================================
CREATE TABLE IF NOT EXISTS privilegios_usuario (
    id_privilegio SERIAL PRIMARY KEY,
    ci_usuario VARCHAR(20) REFERENCES usuarios(ci) ON DELETE CASCADE,
    id_cu INT REFERENCES casos_uso(id_cu) ON DELETE CASCADE,
    habilitado BOOLEAN DEFAULT true,
    UNIQUE(ci_usuario, id_cu)
);

-- =============================================================
-- PRIVILEGIOS POR DEFECTO
-- =============================================================

-- CLIENTES: Seguridad (CU1, CU2) + Reservas (CU3, CU21)
INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, id_cu, true FROM usuarios, casos_uso 
WHERE rol = 'Cliente' AND id_cu IN (1, 2, 3, 21)
ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true;

-- PERSONAL: Seguridad + Reservas + Caja + Personal + Inventario(basico)
INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, id_cu, true FROM usuarios, casos_uso 
WHERE rol = 'Personal' AND id_cu IN (1, 2, 3, 21, 4, 5, 6, 9, 14, 15)
ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true;

-- ADMINISTRADOR: TODOS los privilegios
INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, id_cu, true FROM usuarios, casos_uso 
WHERE rol = 'Administrador'
ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true;
