-- =============================================================
-- TABLAS PARA SISTEMA DE PAQUETES Y PRIVILEGIOS
-- =============================================================

-- 1. PAQUETES FUNCIONALES DEL SISTEMA
CREATE TABLE IF NOT EXISTS paquetes_sistema (
    id_paquete_sist INT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

-- 2. CASOS DE USO (CU) POR PAQUETE
CREATE TABLE IF NOT EXISTS casos_uso (
    id_cu INT PRIMARY KEY,
    id_paquete_sist INT REFERENCES paquetes_sistema(id_paquete_sist) ON DELETE CASCADE,
    nombre_cu VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ruta VARCHAR(100)
);

-- 3. TABLA DE PRIVILEGIOS
CREATE TABLE IF NOT EXISTS privilegios_usuario (
    id_privilegio SERIAL PRIMARY KEY,
    ci_usuario VARCHAR(20) REFERENCES usuarios(ci) ON DELETE CASCADE,
    id_cu INT REFERENCES casos_uso(id_cu) ON DELETE CASCADE,
    habilitado BOOLEAN DEFAULT true,
    UNIQUE(ci_usuario, id_cu)
);

-- =============================================================
-- INSERTS: LOS 5 PAQUETES Y SUS CASOS DE USO
-- =============================================================

INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(1, 'Seguridad', 'Gestion de acceso, login, recuperacion')
ON CONFLICT (id_paquete_sist) DO NOTHING;

INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(1, 1, 'CU1 - Login y Registro', 'Ingreso al sistema', '/login'),
(2, 1, 'CU2 - Recuperacion', 'Recuperar contrasena', '/recuperar')
ON CONFLICT (id_cu) DO NOTHING;

INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(2, 'Reservas', 'Gestion de citas')
ON CONFLICT (id_paquete_sist) DO NOTHING;

INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(3, 2, 'CU3 - Hacer Reserva', 'Cliente hace reserva', '/hacer-reserva'),
(21, 2, 'CU21 - Ver Mis Citas', 'Ver citas agendadas', '/mis-citas')
ON CONFLICT (id_cu) DO NOTHING;

INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(3, 'Caja y Finanzas', 'Pagos y comisiones')
ON CONFLICT (id_paquete_sist) DO NOTHING;

INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(4, 3, 'CU4 - Pagar Servicio', 'Procesar pagos', '/pagar'),
(5, 3, 'CU5 - Ver Comisiones', 'Ver comisiones', '/comisiones')
ON CONFLICT (id_cu) DO NOTHING;

INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(4, 'Servicios', 'Catalogo de servicios')
ON CONFLICT (id_paquete_sist) DO NOTHING;

INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(6, 4, 'CU6 - Ver Catalogo', 'Ver catalogo', '/catalogo'),
(7, 4, 'CU7 - Gestionar Servicios', 'Admin gestiona', '/gestion-servicios')
ON CONFLICT (id_cu) DO NOTHING;

INSERT INTO paquetes_sistema (id_paquete_sist, nombre, descripcion) VALUES
(5, 'Personal', 'Gestion de empleados')
ON CONFLICT (id_paquete_sist) DO NOTHING;

INSERT INTO casos_uso (id_cu, id_paquete_sist, nombre_cu, descripcion, ruta) VALUES
(8, 5, 'CU8 - Gestionar Personal', 'Admin gestiona empleados', '/gestion-personal'),
(9, 5, 'CU9 - Ver Agenda', 'Personal ve agenda', '/mi-agenda')
ON CONFLICT (id_cu) DO NOTHING;

-- =============================================================
-- PRIVILEGIOS POR DEFECTO
-- =============================================================

-- Clientes: CU1, CU2, CU3, CU21
INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 1, true FROM usuarios WHERE rol = 'Cliente'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 2, true FROM usuarios WHERE rol = 'Cliente'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 3, true FROM usuarios WHERE rol = 'Cliente'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 21, true FROM usuarios WHERE rol = 'Cliente'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

-- Personal: CU1, CU2, CU3, CU21, CU4, CU5, CU6, CU9
INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 1, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 2, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 3, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 21, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 4, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 5, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 6, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, 9, true FROM usuarios WHERE rol = 'Personal'
ON CONFLICT (ci_usuario, id_cu) DO NOTHING;

-- Administrador: TODOS los CUs
INSERT INTO privilegios_usuario (ci_usuario, id_cu, habilitado)
SELECT ci, id_cu, true FROM usuarios, casos_uso 
WHERE rol = 'Administrador'
ON CONFLICT (ci_usuario, id_cu) DO UPDATE SET habilitado = true;
