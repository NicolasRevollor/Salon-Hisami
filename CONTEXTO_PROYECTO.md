# 🧠 CONTEXTO DEL PROYECTO — Sistema "Hisami"

> **Cómo usar este archivo:** Este archivo está diseñado para ser leído por Claude (extensión VS Code) al inicio de cada sesión. Incluye TODO el contexto necesario para que Claude entienda el proyecto sin preguntar de nuevo. Pídele algo como: *"Lee CONTEXTO_PROYECTO.md antes de empezar a trabajar."*

---

## 📌 1. INFORMACIÓN GENERAL

| Campo | Valor |
|---|---|
| **Nombre del sistema** | Sistema de Información para Gestionar Citas, Reservas e Historial — Salón "Hisami" |
| **Universidad** | UAGRM — Facultad en Ciencias de la Computación y Telecomunicaciones |
| **Materia** | Sistemas de Información 1 |
| **Docente** | Ing. Angelica Garzon Cuellar |
| **Grupo** | #10 |
| **Semestre** | I/2026 |
| **Ubicación cliente** | Doble vía La Guardia, entre 3er y 4to anillo, Cond. Las Palmas II — Santa Cruz, Bolivia |
| **Tipo de proyecto** | Aplicación web |

**Integrantes:**
- Barrios Lozano Juan Pablo Mateo — 221043810
- Ortega Bazoalto Salet Maytane — 223043591
- Revollo Roman Adalid Nicolas — 220002290
- Salvatierra Choque Franz Sebastian — 223044288
- Valdez Farfan Ian Patrick — 221046127
- Vallar Valdez Sergio Oscar — 221186077

---

## 🎯 2. OBJETIVO DEL SISTEMA

**General:** Desarrollar un sistema de información web para gestionar la administración de citas, reservas e historial del salón de belleza "Hisami".

**Específicos:**
- Diseñar un diagrama de clases adecuado.
- Construir una base de datos relacional centralizada.
- Reemplazar el registro manual (cuadernos, WhatsApp) por una BD consultable al instante.
- Desarrollar el software en **PHP**.
- Conectar la BD a un servidor.
- Implementar funciones y procedimientos almacenados.

**Problema que resuelve:** El salón actualmente gestiona citas con agendas en papel y mensajería, generando: dobles reservas, inasistencias sin recordatorio, pérdida de historial de clientes, sobrecarga de la caja, mala coordinación de espacios y falta de canal digital 24/7.

---

## 🛠️ 3. STACK TECNOLÓGICO

| Capa | Tecnología |
|---|---|
| **Backend** | Node.js |
| **Base de datos** | **PostgreSQL** (BD existente: `proyectosi1`) |
| **Frontend** | HTML, CSS, JavaScript |
| **Servidor** | Local (on-premise) o VPS Linux |
| **Protocolo** | HTTPS con certificado SSL |
| **Metodología** | PUDS (Proceso Unificado de Desarrollo de Software) + UML |

> ⚠️ **NOTA IMPORTANTE:** El documento original del proyecto menciona MySQL en los objetivos, pero el SQL está escrito en sintaxis PostgreSQL (`SERIAL`, `NUMERIC`, `TEXT`, `ON DELETE CASCADE`). **Se decidió usar PostgreSQL** porque la BD ya está creada con el nombre `proyectosi1`.

---

## 👥 4. ACTORES DEL SISTEMA

| ID | Actor | Descripción |
|---|---|---|
| **A1** | **Administrador** | Dueño del salón. Gestión estratégica, control total, crear personal, configurar precios, ver reportes financieros, gestionar inventario, auditar bitácora. |
| **A2** | **Cliente** | Persona externa. Consulta disponibilidad, solicita citas, ve su historial, realiza pagos. Acceso vía web. |
| **A3** | **Esteticista / Personal** | Profesionales (estilistas, manicuristas). Ven su agenda, acceden al historial del cliente, registran notas técnicas, confirman finalización del servicio. |
| **A4** | **Encargado de Recepción / Caja** | Operativa diaria. Gestiona calendario, registra clientes, gestiona pagos, emite facturas, asigna kits. |
| **A5** | **Proveedor** | Suministra productos. El sistema registra sus datos y gestiona compras. |

---

## 🗄️ 5. MODELO DE DATOS — 16 TABLAS

### 5.1 Diagrama de relaciones (texto)

```
usuarios (superclase)
  ├── personal ──┬── personal_especialidades ── especialidades
  │              ├── kit ── contenido_kit ── inventario
  │              ├── reservas (id_esteticista)
  │              └── comision ── detalle_comision
  │
  └── clientes ──┬── reservas (id_cliente) ── detalle_reserva ── servicios
                 │                          └── pagos
                 └── historial

categoria ── servicios ── utiliza ── inventario
                       └── detalle_paquete ── paquetes
```

### 5.2 Tablas (estructura física PostgreSQL)

#### 🔹 `usuarios` — Superclase de autenticación
- `ci` VARCHAR(20) PK
- `nombre` VARCHAR(100) NOT NULL
- `telefono` VARCHAR(20)
- `email` VARCHAR(100) UNIQUE NOT NULL
- `contrasena` VARCHAR(255) NOT NULL ⚠️ *Debe almacenarse hasheada con `password_hash()`*
- `rol` VARCHAR(50) NOT NULL — valores: `'cliente'`, `'administrador'`, `'esteticista'`, `'encargado'`

#### 🔹 `personal` — Subclase (esteticistas)
- `id_esteticista` SERIAL PK
- `ci_usuario` VARCHAR(20) UNIQUE FK → usuarios(ci) ON DELETE CASCADE
- `estado` VARCHAR(20) DEFAULT 'Activo'

#### 🔹 `clientes` — Subclase
- `id_cliente` SERIAL PK
- `ci_usuario` VARCHAR(20) UNIQUE FK → usuarios(ci) ON DELETE CASCADE
- `direccion` TEXT

#### 🔹 `especialidades`
- `id_especialidad` SERIAL PK
- `nombre_especialidad` VARCHAR(50) UNIQUE NOT NULL

#### 🔹 `personal_especialidades` — Tabla intermedia M:N
- `id_esteticista` INT FK → personal(id_esteticista)
- `id_especialidad` INT FK → especialidades(id_especialidad)
- PK compuesta (id_esteticista, id_especialidad)

#### 🔹 `categoria`
- `id_categoria` SERIAL PK
- `nombre` VARCHAR(100) NOT NULL
- `descripcion` TEXT

#### 🔹 `servicios`
- `id_servicio` SERIAL PK
- `id_categoria` INT FK → categoria(id_categoria) ON DELETE SET NULL
- `nombre_servicio` VARCHAR(100) NOT NULL
- `descripcion` TEXT
- `precio` NUMERIC(10,2) NOT NULL
- `duracion_aprox` INTEGER (minutos)
- `estado` VARCHAR(20) DEFAULT 'Activo'

#### 🔹 `paquetes`
- `id_paquete` SERIAL PK
- `nombre` VARCHAR(100) NOT NULL
- `descripcion` TEXT
- `precio_promocional` NUMERIC(10,2) NOT NULL
- `fecha_inicio` DATE
- `fecha_final` DATE

#### 🔹 `detalle_paquete` — M:N paquetes-servicios
- `id_paquete` INT FK → paquetes(id_paquete)
- `id_servicio` INT FK → servicios(id_servicio)
- PK compuesta

#### 🔹 `inventario`
- `id_producto` SERIAL PK
- `nombre` VARCHAR(100) NOT NULL
- `descripcion` TEXT
- `cantidad` INTEGER DEFAULT 0
- `stock_minimo` INTEGER DEFAULT 0
- `precio_unitario` DECIMAL(10,2) DEFAULT 0.00
- `estado` VARCHAR(20) DEFAULT 'Activo'

#### 🔹 `utiliza` — M:N servicios-inventario (receta/fórmula)
- `id_servicio` INT FK
- `id_producto` INT FK
- `cantidad` INTEGER NOT NULL
- PK compuesta

#### 🔹 `kit` — 1:1 con personal
- `id_kit` SERIAL PK
- `id_esteticista` INT UNIQUE FK → personal(id_esteticista)
- `fecha_asignacion` DATE DEFAULT CURRENT_DATE
- `estado` VARCHAR(50) DEFAULT 'Activo'

#### 🔹 `contenido_kit` — M:N kit-inventario
- `id_kit` INT FK
- `id_producto` INT FK
- `cantidad` INTEGER NOT NULL
- PK compuesta

#### 🔹 `reservas` — Tabla central
- `id_cita` SERIAL PK
- `id_cliente` INT FK → clientes(id_cliente)
- `id_esteticista` INT FK → personal(id_esteticista)
- `fecha` DATE NOT NULL
- `hora` TIME NOT NULL
- `estado` VARCHAR(20) DEFAULT 'Pendiente' — valores: `'Pendiente'`, `'Confirmada'`, `'Cancelada'`, `'Finalizada'`

#### 🔹 `detalle_reserva` — M:N reservas-servicios
- `id_cita` INT FK
- `id_servicio` INT FK
- PK compuesta

#### 🔹 `pagos` — 1:1 con reservas
- `id_pago` SERIAL PK
- `id_cita` INT UNIQUE FK → reservas(id_cita)
- `fecha` DATE DEFAULT CURRENT_DATE
- `monto` NUMERIC(10,2) NOT NULL
- `metodo_pago` VARCHAR(50) NOT NULL

#### 🔹 `comision`
- `id_comision` SERIAL PK
- `id_cita` INT UNIQUE FK → reservas(id_cita)
- `id_esteticista` INT FK → personal(id_esteticista)
- `porcentaje` NUMERIC(5,2) NOT NULL
- `monto_comision` NUMERIC(10,2) NOT NULL
- `fecha` DATE DEFAULT CURRENT_DATE
- `estado_pago` VARCHAR(50) DEFAULT 'Pendiente'

#### 🔹 `detalle_comision`
- `id_detalle_comision` SERIAL PK
- `id_comision` INT FK → comision(id_comision)
- `id_esteticista` INT FK → personal(id_esteticista)
- `porcentaje` NUMERIC(5,2)
- `monto_individual` NUMERIC(10,2)

#### 🔹 `historial`
- `id_historial` SERIAL PK
- `id_cliente` INT FK → clientes(id_cliente)
- `servicio_realizado` VARCHAR(255) NOT NULL
- `fecha` DATE NOT NULL
- `observaciones` TEXT

---

## 📋 6. CASOS DE USO POR CICLO (PUDS)

### 🔄 CICLO #1 (en desarrollo / prioridad inmediata)

| ID | Caso de uso | Prioridad | Actor principal |
|---|---|---|---|
| **CU1** | Iniciar Sesión | Alta | Todos |
| **CU2** | Cerrar Sesión | Media | Todos |
| **CU7** | Gestionar Servicio | Alta | Administrador |
| **CU10** | Gestionar Cliente | Alta | Administrador |
| **CU16** | Gestionar Comisiones | Media | Administrador |
| **CU18** | Gestionar Roles / Privilegios | Alta | Administrador |

### 🔄 CICLO #2

| ID | Caso de uso | Prioridad | Actor principal |
|---|---|---|---|
| **CU3** | Gestionar Cita / Reserva | Alta | Cliente, Encargado |
| **CU8** | Gestionar Categoría de Servicio | Media | Administrador |
| **CU9** | Gestionar Paquetes / Ofertas | Baja | Administrador |
| **CU11** | Gestionar Personal / Esteticistas | Alta | Administrador |
| **CU12** | Gestionar Especialidades | Media | Administrador |
| **CU19** | Administrar Bitácora | Baja | Administrador |

### 📑 Lista completa de Casos de Uso

- **CU1.** Iniciar Sesión
- **CU2.** Cerrar Sesión
- **CU3.** Gestionar Cita/Reserva (registrar, modificar, cancelar)
- **CU4.** Realizar Pago de Reserva
- **CU5.** Emitir Factura / Nota de Venta
- **CU6.** Registro de Preferencias y Seguimiento de Estilo
- **CU7.** Gestionar Servicio
- **CU8.** Gestionar Categoría de Servicio
- **CU9.** Gestionar Paquetes / Ofertas
- **CU10.** Gestionar Cliente
- **CU11.** Gestionar Personal / Esteticistas
- **CU12.** Gestionar Especialidades
- **CU13.** Gestionar Apertura y Cierre de Caja
- **CU14.** Gestionar Kit Personal de Esteticista
- **CU15.** Monitorear Alertas de Stock
- **CU16.** Gestionar Comisiones de Personal
- **CU17.** Generar Reporte Financiero
- **CU18.** Gestionar Roles / Privilegios
- **CU19.** Administrar Bitácora
- **CU20.** Gestionar Recordatorios de Cita Automáticos (Email/WhatsApp)
- **CU21.** Integrar WhatsApp empresarial
- **CU22.** Gestionar Compras / Pedidos
- **CU23.** Gestionar Consumo por Servicio (Receta/Fórmula)

---

## 🔐 7. REGLAS DE NEGOCIO Y VALIDACIONES CRÍTICAS

1. **Autenticación:** Login con email + contraseña hasheada (`password_hash()` / `password_verify()` de PHP).
2. **Roles:** El rol del usuario determina qué módulos puede ver. Validar SIEMPRE en el servidor, no solo en el cliente.
3. **Reservas:**
   - No se permite agendar dos reservas del mismo esteticista en el mismo horario (validar con `duracion_aprox`).
   - Estados válidos: `Pendiente`, `Confirmada`, `Cancelada`, `Finalizada`.
4. **Pagos:** Una reserva tiene 1 pago (relación 1:1). Solo reservas en estado `Finalizada` deberían pagarse.
5. **Inventario:** Al ejecutar un servicio (al pasar a `Finalizada`), descontar productos según `utiliza`.
6. **Stock mínimo:** Generar alerta cuando `cantidad <= stock_minimo`.
7. **Comisiones:** Calcular automáticamente al confirmar pago basado en porcentaje del esteticista.
8. **Herencia usuarios → clientes/personal:** Al registrar un cliente o personal, primero crear el registro en `usuarios`, luego en la subclase correspondiente. Idealmente con TRANSACCIÓN.

---

## 📁 8. ESTRUCTURA DE CARPETAS RECOMENDADA (PHP)

```
Pagina/
├── config/
│   └── conexion.php              # Conexión PDO a PostgreSQL
├── public/                       # Document root del servidor
│   ├── index.php                 # Página de inicio
│   ├── login.php
│   ├── logout.php
│   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   └── img/
│   └── modulos/
│       ├── clientes/
│       ├── personal/
│       ├── servicios/
│       ├── reservas/
│       ├── pagos/
│       ├── inventario/
│       └── reportes/
├── includes/
│   ├── header.php
│   ├── footer.php
│   ├── sidebar.php
│   └── auth.php                  # Verificación de sesión y rol
├── modelos/                      # Clases PHP (POO)
│   ├── Usuario.php
│   ├── Cliente.php
│   ├── Personal.php
│   ├── Servicio.php
│   ├── Reserva.php
│   └── ...
├── controladores/
│   ├── ClienteController.php
│   ├── ReservaController.php
│   └── ...
├── sql/
│   ├── 01_schema.sql            # CREATE TABLE
│   ├── 02_datos_iniciales.sql   # INSERT seed
│   └── 03_consultas.sql         # Vistas, funciones, procedimientos
└── CONTEXTO_PROYECTO.md         # ← Este archivo
```

---

## 🔌 9. CONEXIÓN A LA BD (PostgreSQL — `proyectosi1`)

Plantilla para `config/conexion.php`:

```php
<?php
// config/conexion.php
$host     = 'localhost';
$puerto   = '5432';
$basedatos = 'proyectosi1';
$usuario  = 'postgres';      // ← ajustar al usuario real
$password = '';              // ← ajustar a la contraseña real

try {
    $dsn = "pgsql:host=$host;port=$puerto;dbname=$basedatos";
    $pdo = new PDO($dsn, $usuario, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("Error de conexión: " . $e->getMessage());
}
```

> Asegurarse de tener instalada la extensión `pdo_pgsql` (en `php.ini` quitar el `;` de `extension=pdo_pgsql`).

---

## ✅ 10. CHECKLIST DE PROGRESO

Marcar lo que ya está hecho:

- [ ] BD `proyectosi1` creada en PostgreSQL
- [ ] Todas las 16 tablas creadas
- [ ] Datos iniciales insertados (categorías, especialidades, etc.)
- [ ] Conexión PHP-PostgreSQL funcionando
- [ ] **CU1** — Login funcional con hash de contraseñas
- [ ] **CU2** — Logout
- [ ] **CU18** — Sistema de roles (middleware de autorización)
- [ ] **CU10** — CRUD de clientes
- [ ] **CU7** — CRUD de servicios
- [ ] **CU16** — Cálculo de comisiones
- [ ] **CU3** — CRUD de reservas con validación de horario
- [ ] **CU11** — CRUD de personal
- [ ] **CU12** — CRUD de especialidades

---

## 🎨 11. CONVENCIONES DE CÓDIGO

- **Idioma:** Variables, funciones y comentarios en español (consistente con la BD).
- **Nombres de tablas:** snake_case, plural (ya está así en la BD).
- **Nombres de columnas:** snake_case, español (ya está así).
- **PHP:** PSR-12 cuando sea posible. Usar `<?php` (nunca `<?`).
- **Seguridad:**
  - SIEMPRE usar **prepared statements** (`PDO::prepare()`) — nunca concatenar SQL.
  - Sanitizar salidas con `htmlspecialchars()` en HTML.
  - Validar entrada en servidor, no solo en cliente.
  - `session_start()` en cada página protegida + verificar rol.
  - Hashear contraseñas: `password_hash($pwd, PASSWORD_DEFAULT)`.

---

## 📝 12. INSTRUCCIONES PARA CLAUDE EN VS CODE

Cuando trabajes en este proyecto:

1. **Lee este archivo primero** para entender el contexto antes de generar código.
2. Usa **PostgreSQL**, NO MySQL (aunque el documento original mencione MySQL).
3. Prioriza los casos de uso del **CICLO #1** primero.
4. Sigue la **estructura de carpetas** definida en la sección 8.
5. Usa **PDO** para todas las conexiones a BD (nunca `pg_connect()` directo).
6. Aplica las **reglas de seguridad** de la sección 11 SIEMPRE.
7. Si una tabla del documento entra en conflicto con una existente en `proyectosi1`, pregunta antes de modificar.
8. Mantén el código **comentado en español**.

---

*Última actualización: 2026-05-07 — basado en el documento original "Proyecto SI1, 15 de abril, 7:02 p.m."*
