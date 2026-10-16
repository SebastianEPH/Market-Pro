# Market Pro

Sistema de minimarket **multi-tenant y modular** pensado para venderse como producto:

- **Tú (administrador de plataforma)** creas una *tienda* (instancia) por cada comprador, defines su usuario administrador y controlas **en tiempo real** qué módulos, qué acciones CRUD y qué características puede usar.
- **El comprador (administrador de la tienda)** reparte esos permisos entre su personal con roles y permisos directos, sin poder superar nunca el "techo" que le diste.
- **El vendedor** usa el punto de venta.

Todo el código está siempre desplegado y activo; el acceso se controla con datos.

---

## Estructura

```
Market-Pro/
├── config/                   Variables de entorno por ambiente
│   ├── .env.example          Plantilla (versionada)
│   ├── .env.dev              Desarrollo (no versionado)
│   └── .env.prod             Producción (no versionado)
├── sql/                      Migraciones Liquibase (formatted SQL), una base por microservicio
│   ├── identity/             changelog.yaml + tenants, usuarios, módulos, PERMISOS, roles, features + RLS
│   ├── catalog/              changelog.yaml + categorías, productos, movimientos de stock + RLS
│   └── sales/                changelog.yaml + cajas, ventas, numeración + RLS
├── scripts/
│   ├── dev.mjs               npm start: BD + backend + gateway + frontends con recarga
│   └── db.mjs                Roles/bases + comandos Liquibase por entorno
├── shared/                   Enums y contratos TS compartidos (backend + frontends)
├── backend/
│   ├── core/                 Runtime estilo Lambda: APIGW v2, inversify, middlewares, router, BD
│   ├── services/
│   │   ├── identity/         Lambda: auth, tenants, módulos, permisos, roles, usuarios
│   │   ├── catalog/          Lambda: categorías, productos, inventario
│   │   └── sales/            Lambda: caja, ventas, dashboard (habla con catalog)
│   └── local-gateway/        Emulador local de API Gateway HTTP API (sin Express)
├── frontend-common/          React compartido: cliente API, auth, guards, UI
├── frontend-admin/           Tu panel (plataforma)                 :5173
├── frontend-backoffice/      Panel del comprador                   :5174
└── frontend-pos/             Punto de venta del vendedor           :5175
```

## Arquitectura backend

### Microservicios = funciones Lambda

Cada servicio exporta `handler(event: APIGatewayProxyEventV2, context: Context)`.
No hay Express: la misma función corre igual en local y en AWS.

```
Cliente ─► API Gateway HTTP API ─► ANY /identity/{proxy+} ─► λ identity ─► market_identity
                                  ─► ANY /catalog/{proxy+}  ─► λ catalog  ─► market_catalog
                                  ─► ANY /sales/{proxy+}    ─► λ sales    ─► market_sales
                                                                 │
                                                                 └─ HTTP interno ─► catalog / identity
```

Localmente `backend/local-gateway` levanta un `node:http` que construye el **mismo evento payload 2.0**
(`version`, `routeKey`, `rawPath`, `requestContext.http`, `isBase64Encoded`, etc.) e invoca el handler.

### Pipeline de middlewares (clases `@injectable` de inversify)

```
RequestLogger → Cors → ErrorHandler → [Router] → JsonBody → Authentication
             → Access (permisos en tiempo real) → Permission (CRUD) → Feature → Validation (zod) → Controller
```

### Controladores declarativos

```ts
@injectable()
@Controller('/products', RouteScope.TENANT)
export class ProductsController {
  constructor(@inject(CatalogToken.ProductService) private readonly products: ProductService) {}

  @Post()
  @Permission(ModuleCode.PRODUCTS, PermissionAction.CREATE)
  @Body(createProductSchema)
  async create(request: ApiRequest): Promise<HttpResult> { ... }
}
```

- `RouteScope`: `PUBLIC`, `INTERNAL` (solo microservicios, cabecera `x-internal-key`), `AUTHENTICATED`, `PLATFORM`, `TENANT`.
- Varios `@Permission` = basta uno (OR). `@RequireFeature` = todas (AND).
- Inyección por **enums** (`CoreToken`, `IdentityToken`, `CatalogToken`, `SalesToken`) y repositorios detrás de interfaces.
- Sin alias `type`: solo `enum`, `interface` y clases.

### Modelo de permisos

Tabla única **`permissions`** = un registro por módulo × acción CRUD (`products:create`, `sales:read`, ...).

Permiso efectivo de un usuario:

```
módulo activo globalmente (modules.is_active)
 ∩ módulo habilitado y vigente para la tienda (tenant_modules)
 ∩ techo de la tienda (tenant_permissions)
 ∩ ( dueño ? todo : (permisos de roles ∪ ALLOW directos) − DENY directos )
```

| Quién | Dónde | Qué controla |
|---|---|---|
| Plataforma (tú) | `frontend-admin` | Módulos por tienda, acciones CRUD permitidas, vencimiento, features, suspensión |
| Dueño de la tienda | `frontend-backoffice` | Roles, permisos por usuario (ALLOW / DENY) dentro del techo |
| Vendedor | `frontend-pos` | Lo que su rol le permita |

**Tiempo real:** el JWT solo identifica al usuario. En cada request el middleware `Access` resuelve el perfil
actual (identity lo calcula en BD; los otros servicios lo piden a identity y lo cachean
`ACCESS_CACHE_TTL_SECONDS`, por defecto 15 s; con `0` es inmediato). Los frontends refrescan permisos
cada 20-30 s y al recuperar el foco: si apagas un módulo, desaparece del menú y su API responde
`403 MODULE_DISABLED`.

**Features** (`features` / `tenant_features`): `sales.discounts`, `sales.void`, `inventory.negative_stock`,
`users.max`, `products.max`. Las numéricas definen límites del plan.

**Anti-escalamiento:** un usuario que no es dueño solo puede otorgar permisos que él mismo tiene.

### Aislamiento de datos

Una base por microservicio y **Row Level Security** en todas las tablas por tenant. Cada transacción fija
`app.tenant_id`; la aplicación se conecta como `market_app` (no dueño, `FORCE ROW LEVEL SECURITY`), así que
aunque una consulta olvide filtrar, PostgreSQL no devuelve datos de otra tienda.

---

## Variables de entorno

Un archivo por ambiente en `config/`; el ambiente se pasa como **argumento**:

| Archivo | Uso | Versionado |
|---|---|---|
| `config/.env.example` | Plantilla con todas las variables documentadas | Sí |
| `config/.env.dev` | Desarrollo local | No |
| `config/.env.prod` | Producción | No |
| `config/.env.<otro>` | QA, staging… (`npm start -- qa`) | No |

- **Backend:** `Environment` (`backend/core/src/config/environment.ts`) carga `config/.env.<env>` según el argumento
  del proceso (`node dist/main.js dev`) y valida las variables del enum `ENV`; si falta alguna, aborta listándolas.
  En **AWS Lambda** no se usa archivo: se leen las variables configuradas en la función.
- **Frontends:** Vite usa `envDir: ../config` y `--mode <env>` (`dev` en desarrollo, `prod` en build). Solo se exponen las `VITE_*`.
- **Scripts:** `npm start -- <env>` y `npm run db -- <env> <comando>`.

## Base de datos (Liquibase)

Liquibase 4.28 (paquete npm `liquibase`, requiere Java 17+) con un changelog por base: `sql/<servicio>/changelog.yaml`.
Cada `.sql` es un changeset en *formatted SQL*; los datos demo (`900_*`) llevan `context:dev` y no se aplican en prod
(`LIQUIBASE_CONTEXTS`).

| Rol | Variable | Para qué |
|---|---|---|
| Superusuario | `DATABASE_POSTGRESQL_ADMIN_*` | Solo `bootstrap`: crear roles y bases |
| `market_owner` | `DATABASE_POSTGRESQL_OWNER_*` | Liquibase: dueño de las tablas |
| `market_app` | `DATABASE_POSTGRESQL_USER/PASSWORD` | Microservicios: solo DML, sujeto a RLS |

```bash
npm run db:setup            # dev: roles + bases + migraciones
npm run db:migrate          # dev: solo changesets pendientes
npm run db:status           # dev: pendientes
npm run db:history          # dev: aplicados
npm run db:reset            # dev: borra y recrea las 3 bases (bloqueado en PROD)
npm run db -- prod update   # cualquier entorno / comando
```

Para un cambio de esquema **no se editan** los archivos ya aplicados: se agrega un nuevo `00X_*.sql` con su
cabecera `--changeset` y se incluye en el `changelog.yaml` del servicio.

## Puesta en marcha (local)

Requisitos: Node 24+, Java 17+ (Liquibase) y PostgreSQL 18.

1. Completa `config/.env.dev` (la única variable vacía es `DATABASE_POSTGRESQL_ADMIN_PASSWORD`, la de tu usuario `postgres`).
2. Instala y arranca:

```bash
npm install
npm start                   # = npm start -- dev
```

`npm start` crea roles/bases, aplica Liquibase, compila el backend en watch, levanta el gateway y los 3 frontends con
recarga automática, y muestra los links:

| App | URL |
|---|---|
| API Gateway | http://localhost:3000 |
| Admin plataforma | http://localhost:5173 |
| Backoffice | http://localhost:5174 |
| POS | http://localhost:5175 |

Opciones: `npm start -- qa` (otro entorno), `npm start -- dev --no-db` (sin tocar la BD). En `PROD` nunca migra solo.

### Usuarios de desarrollo

| App | Tienda | Email | Contraseña |
|---|---|---|---|
| Admin plataforma | — | `admin@marketpro.local` | `Admin123*` |
| Backoffice (dueño) | `demo` | `owner@demo.local` | `Admin123*` |
| POS (cajero) | `demo` | `cajero@demo.local` | `Admin123*` |

Los datos demo (`sql/identity/900_*`, `sql/catalog/900_*`) solo se aplican con el contexto Liquibase `dev`.
Para generar otro hash: `npm run hash-password -- "NuevaClave"`.

---

## Endpoints principales

| Servicio | Ruta | Permiso |
|---|---|---|
| identity | `POST /identity/auth/login` `{ tenantSlug?, email, password }` | público |
| identity | `POST /identity/auth/refresh`, `POST /identity/auth/logout` | público |
| identity | `GET /identity/auth/me` | autenticado |
| identity | `GET/POST /identity/platform/tenants`, `GET/PATCH /identity/platform/tenants/{id}` | plataforma |
| identity | `PATCH /identity/platform/tenants/{id}/status` | plataforma |
| identity | `PUT /identity/platform/tenants/{id}/modules` / `features` | plataforma |
| identity | `GET /identity/platform/modules`, `PATCH /identity/platform/modules/{code}` | plataforma |
| identity | `/identity/users`, `/identity/roles`, `/identity/settings` | `users:*`, `roles:*`, `settings:*` |
| identity | `POST /identity/internal/access/resolve` | interno |
| catalog | `/catalog/categories`, `/catalog/products`, `/catalog/products/by-code/{code}` | `categories:*`, `products:*`, `pos:read` |
| catalog | `GET /catalog/inventory/movements`, `POST /catalog/inventory/adjustments` | `inventory:*` |
| catalog | `POST /catalog/internal/products/lookup`, `POST /catalog/internal/stock/apply` | interno |
| sales | `GET /sales/cash-sessions/current`, `POST /sales/cash-sessions/open`, `POST /sales/cash-sessions/{id}/close` | `cash_register:*` |
| sales | `POST /sales/sales` | `pos:create` |
| sales | `GET /sales/sales`, `POST /sales/sales/{id}/void` | `sales:read` / `pos:read`, `sales:delete` + `sales.void` |
| sales | `GET /sales/dashboard/summary` | `dashboard:read` |

Errores: `{ "error": { "code": "PERMISSION_DENIED", "message": "...", "details": ... }, "requestId": "..." }`.

---

## Despliegue en AWS Lambda

1. `npm run build:backend`.
2. Una función por servicio, runtime Node.js 24, handler `dist/handler.handler`
   (empaquetar `dist/` + `node_modules` de producción, o un bundle con esbuild — todas las inyecciones usan
   `@inject(TOKEN)` explícito, así que no depende de `emitDecoratorMetadata`).
3. Un **HTTP API (API Gateway v2)** con rutas `ANY /identity/{proxy+}`, `ANY /catalog/{proxy+}`,
   `ANY /sales/{proxy+}` → integración Lambda payload 2.0.
4. Variables de entorno por función: las mismas de `config/.env.example` (menos `*_ADMIN_*`, `*_OWNER_*`,
   `LIQUIBASE_*` y `VITE_*`). Cada función solo necesita su `DATABASE_<SERVICIO>`.
5. Migraciones desde CI o tu máquina: `npm run db -- prod update` (usa `config/.env.prod`).
6. Recomendado: RDS Proxy para el pool de conexiones, secretos en Secrets Manager, y reemplazar
   `HttpServiceTransport` por un transporte de invocación directa o rutas internas privadas
   (punto de extensión: `CoreToken.ServiceTransport`).

## Agregar un módulo nuevo

1. Nuevo changeset Liquibase en `sql/identity/` con el `INSERT` en `modules` y sus permisos CRUD (como `003_seed_catalog.sql`).
2. Agregar el código al enum `ModuleCode` en `shared/src/enums/access.enums.ts`.
3. Crear el microservicio o controlador con `@Permission(ModuleCode.NUEVO, PermissionAction.X)`.
4. Agregarlo al menú del frontend correspondiente con `module: ModuleCode.NUEVO`.
5. Habilitarlo por tienda desde `frontend-admin`.
