# Sistema de Registro de Ingresos y Egresos - Modalab Finance

<div align="center">

![Estado del proyecto](https://img.shields.io/badge/estado-activo-success)
![Versión](https://img.shields.io/badge/versión-1.0.0-blue)
![Tecnologías](https://img.shields.io/badge/tecnologías-HTML%20%7C%20JavaScript%20%7C%20Firebase-orange)

**Desarrolladora a cargo:** Elizabeth Carhuatocto O.

</div>

---

## 📖 Descripción del Proyecto

### ¿Por qué existe esta herramienta?

Este sistema nace de la necesidad de contar con una solución **ligera, accesible y multiusuario** para el registro y control financiero personal o empresarial. Muchas herramientas existentes son demasiado complejas, costosas o requieren infraestructura pesada. Esta aplicación ofrece una alternativa **gratuita, escalable y fácil de implementar** que puede funcionar tanto en modo local como sincronizada en la nube.

### ¿Para qué sirve?

La herramienta permite:

- ✅ **Registrar ingresos y egresos** de manera organizada por fecha, categoría y descripción
- ✅ **Visualizar resúmenes mensuales** con gráficos interactivos para análisis rápido
- ✅ **Filtrar y exportar datos** a Excel para reportes y auditorías
- ✅ **Gestionar múltiples usuarios** con roles diferenciados (administrador y usuario normal)
- ✅ **Personalizar la interfaz** según las necesidades de cada organización
- ✅ **Sincronizar datos en la nube** mediante Firebase Firestore (opcional)
- ✅ **Funcionar offline** usando localStorage del navegador

---

## 👤 Vista del Usuario

### Funcionalidades Principales

#### 1. **Inicio de Sesión**
- Autenticación segura con usuario y contraseña
- Soporte para múltiples cuentas guardadas en Firebase

#### 2. **Registro de Operaciones**
- Formulario intuitivo para ingresar transacciones
- Campos: fecha, tipo (ingreso/egreso), categoría, monto y descripción
- Categorías predefinidas y personalizables (Sueldo, Ventas, Comida, Transporte, Servicios, etc.)

#### 3. **Dashboard Visual**
- Resumen mensual automático con totales de ingresos, egresos y balance
- Gráficos de torta interactivos con Chart.js
- Navegación entre meses para análisis histórico

#### 4. **Historial y Filtros**
- Búsqueda por rango de fechas, mes específico, tipo o categoría
- Vista tipo tabla con acciones masivas (editar/eliminar múltiples registros)
- Exportación a Excel (.xlsx) con un clic
- Opción de impresión de reportes

#### 5. **Panel de Administración** (solo administradores)
- **Gestión de usuarios**: crear, listar y asignar roles
- **Personalización UI**: cambiar título, logo, colores y fondo de la aplicación
- **Administración de categorías**: agregar/eliminar categorías de ingresos y egresos
- **Configuraciones avanzadas**: habilitar vista de meses futuros

### Experiencia de Uso

| Perfil | Capacidades |
|--------|-------------|
| **Usuario Normal** | Registrar operaciones, ver su historial, filtrar, exportar, imprimir |
| **Administrador** | Todo lo anterior + gestionar usuarios, categorías y personalizar la interfaz |

### Dispositivos Soportados

- 💻 Desktop (navegadores modernos: Chrome, Firefox, Edge, Safari)
- 📱 Tablets (iPad, Android tablets) - interfaz adaptativa
- 📞 Móviles (iPhone, Android) - vista compacta con botones grandes

---

## 🛠️ Vista Técnica

### Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  index.html │  │ finance.js   │  │ firebase-config  │   │
│  │  (UI/UX)    │  │ (Lógica)     │  │ (Cloud Sync)     │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│         │                │                      │           │
│         ▼                ▼                      ▼           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Librerías Externas                      │   │
│  │  Bootstrap 5.3.2 | Chart.js 4.4.0 | SheetJS (XLSX)  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────┐
│   LOCAL STORAGE       │       │   FIREBASE FIRESTORE      │
│   (modo offline)      │       │   (sincronización cloud)  │
└───────────────────────┘       └───────────────────────────┘
            │
            ▼
┌───────────────────────┐
│   BACKEND OPCIONAL    │
│   Express + SQLite    │
│   (API REST local)    │
└───────────────────────┘
```

### Stack Tecnológico

#### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| HTML5 | - | Estructura semántica |
| CSS3 / Bootstrap | 5.3.2 | Estilos y diseño responsivo |
| JavaScript (Vanilla) | ES6+ | Lógica de negocio |
| Chart.js | 4.4.0 | Visualización de datos |
| SheetJS (XLSX) | Latest | Exportación a Excel |
| Firebase SDK | v9+ | Autenticación y base de datos en la nube |

#### Backend (Opcional)
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | LTS | Entorno de ejecución |
| Express | ^4.18.2 | Servidor web y API REST |
| SQLite3 | ^5.1.6 | Base de datos ligera local |
| CORS | ^2.8.5 | Seguridad de peticiones cruzadas |

### Estructura del Proyecto

```
/workspace
├── index.html                 # Punto de entrada principal
├── assets/
│   ├── css/
│   │   └── finance.css        # Estilos personalizados
│   └── js/
│       ├── finance.js         # Lógica principal de la aplicación (~50KB)
│       └── firebase-config.js # Configuración de Firebase
├── server/                    # Backend opcional (Express + SQLite)
│   ├── server.js              # Servidor y endpoints API
│   ├── db.js                  # Helper de base de datos
│   ├── finances.db            # SQLite database (auto-generada)
│   └── package.json           # Dependencias Node.js
├── firebase.json              # Configuración de Firebase Hosting
├── firestore.indexes.json     # Índices de Firestore
└── README.md                  # Este archivo
```

### Endpoints de la API (Backend Opcional)

Si se utiliza el servidor Express (`server/server.js`):

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/entries` | Obtener todos los registros |
| `POST` | `/api/entries` | Insertar un nuevo registro |
| `DELETE` | `/api/entries/:id` | Eliminar registro por ID |

**Puerto por defecto:** `4000` (configurable via `PORT` env variable)

### Esquema de Datos

#### Tabla SQLite / Colección Firestore `entries`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | TEXT | Identificador único (UUID) |
| `date` | TEXT | Fecha de la transacción (YYYY-MM-DD) |
| `type` | TEXT | Tipo: `ingreso` o `egreso` |
| `category` | TEXT | Categoría de la transacción |
| `amount` | REAL | Monto numérico |
| `description` | TEXT | Descripción opcional |

#### Colección Firestore `users`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `username` | STRING | Nombre de usuario |
| `password` | STRING | Contraseña (hash recomendado en producción) |
| `role` | STRING | `admin` o `user` |

#### Colección Firestore `settings`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `appTitle` | STRING | Título de la aplicación |
| `logoUrl` | STRING | URL del logo |
| `primaryColor` | STRING | Color principal (hex) |
| `bgColor` | STRING | Color de fondo (hex) |
| `bgImageUrl` | STRING | URL de imagen de fondo |
| `categories` | ARRAY | Lista de categorías personalizadas |
| `enableFutureMonths` | BOOLEAN | Mostrar meses futuros en gráficos |

### Instalación y Configuración

#### Opción 1: Solo Frontend (Recomendado para uso rápido)

```bash
# 1. Clonar o descargar el repositorio
# 2. Abrir index.html directamente en el navegador
# O usar un servidor local:
python -m http.server 5500
# Luego abrir: http://localhost:5500
```

#### Opción 2: Frontend + Firebase (Sincronización en la nube)

```bash
# 1. Configurar Firebase:
#    - Crear proyecto en https://console.firebase.google.com
#    - Habilitar Firestore Database
#    - Reemplazar configuración en assets/js/firebase-config.js

# 2. Desplegar en Firebase Hosting (opcional):
npm install -g firebase-tools
firebase login
firebase deploy
```

#### Opción 3: Frontend + Backend Local (Express + SQLite)

```bash
cd server

# Instalar dependencias
npm install

# Iniciar servidor
npm start

# El servidor correrá en http://localhost:4000
```

### Consideraciones de Seguridad

⚠️ **Importante para producción:**

1. **Contraseñas**: Actualmente se almacenan en texto plano en Firestore. En producción, implementar hashing (bcrypt, argon2).
2. **Reglas de Firestore**: Configurar reglas de seguridad en Firebase Console para restringir acceso no autorizado.
3. **API Keys**: La configuración de Firebase es visible en el cliente. Usar reglas de seguridad del lado del servidor.
4. **CORS**: El backend tiene CORS habilitado para desarrollo. Restringir orígenes en producción.
5. **Validación**: Implementar validación de datos más estricta en formularios y endpoints.

### Escalabilidad y Extensiones Futuras

El proyecto está diseñado para ser extendido fácilmente:

- 🔌 **Módulo de reportes PDF**: Generar reportes financieros en PDF
- 📊 **Dashboard avanzado**: Más tipos de gráficos y KPIs financieros
- 🔔 **Notificaciones**: Alertas de gastos excesivos o recordatorios
- 💳 **Integración bancaria**: Conectar con APIs bancarias para importación automática
- 🌐 **Multi-idioma**: Soporte para internacionalización (i18n)
- 📱 **PWA**: Convertir en Progressive Web App para instalación nativa

---

## 👩‍💻 Desarrolladora

<div align="center">

### Elizabeth Carhuatocto O.

**Ingeniera de Sistemas | Desarrolladora Full Stack | UX/UI Designer**

📧 Contacto:  eli.carhuatoctoo@gmail.com 
💼 LinkedIn:  https://www.linkedin.com/in/eli-carhuatocto-olivera/
🌐 Ubicación: Jesús María, Lima, Perú

*"Creando soluciones tecnológicas que simplifican la gestión de los emprendedores"*

</div>

---

## 📄 Licencia

Este proyecto es de uso libre bajo los términos que determine la propietaria del código.

---

## 🙏 Agradecimientos

- Bootstrap Team por el framework CSS
- Chart.js por la librería de visualización
- SheetJS por la capacidad de exportación Excel
- Firebase por la infraestructura backend-as-a-service

---

<div align="center">

**© 2024 Modalab Finance - Desarrollado por Elizabeth Carhuatocto O.**

*¿Necesitas soporte o personalizaciones? ¡Contáctame!*

</div>
