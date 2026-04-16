# Documentación Técnica — MiComercio Analytics

**Versión:** 2.4.0
**Fecha:** Abril 2026
**Repositorios:** `micomercio_analytics` (ingesta) · `micomercio_bi_dashboard` (visualización)

---

## Índice

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura](#2-arquitectura)
3. [Micomercio Analytics — Script de Tracking e Ingesta](#3-micomercio-analytics--script-de-tracking-e-ingesta)
4. [Dashboard Analytics — Visualización](#4-dashboard-analytics--visualización)
5. [Base de Datos Compartida](#5-base-de-datos-compartida)
6. [Flujo Completo de Datos](#6-flujo-completo-de-datos)
7. [API de Ingesta](#7-api-de-ingesta)
8. [API del Dashboard](#8-api-del-dashboard)
9. [Seguridad y Multi-tenancy](#9-seguridad-y-multi-tenancy)
10. [Despliegue e Infraestructura](#10-despliegue-e-infraestructura)

---

## 1. Visión General del Sistema

MiComercio Analytics es un sistema de analítica web propio, similar en concepto a Google Analytics, diseñado para los clientes del ecosistema MiComercio. Consta de **dos servicios independientes** que comparten la misma base de datos PostgreSQL:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SITIO WEB DEL CLIENTE                        │
│  <script src="web-analytics.js" data-key="pk_live_xxx">         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ POST /api/v1/track (eventos)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│         SERVICIO DE INGESTA  (Micomercio_Analytics)             │
│   Node.js + Express · Puerto 3000                               │
│   Valida · Normaliza · Almacena eventos                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Prisma ORM
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              BASE DE DATOS POSTGRESQL (Supabase)                │
│   event · session · visitor · site_config · geo_cache           │
│   identified_user                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Prisma ORM
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│         SERVICIO DE DASHBOARD  (Dashboard_Analytics)            │
│   Node.js + Express · Puerto 3001                               │
│   Agrega · Calcula métricas · Sirve SPA                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP (JSON)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              DASHBOARD WEB (SPA — dashboard.js)                 │
│   Chart.js · Filtros · Exportación PDF/CSV                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura

### Principios de diseño

- **Separación de responsabilidades:** El servicio de ingesta solo escribe. El dashboard solo lee.
- **Multi-tenant:** Cada cliente tiene su `site_config` con `api_key` único. Todos los datos están aislados por `siteId`.
- **Idempotencia:** Los eventos tienen `eventUuid` único; duplicados no se insertan dos veces.
- **No-bloqueante:** La geolocalización se resuelve en background, después de responder al cliente.
- **Escalabilidad de escritura:** Índices en columnas críticas (`siteId`, `occurredAt`, `eventType`, `sessionId`).

### Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Lenguaje | Node.js ≥18 |
| Framework | Express.js 4.18.x |
| ORM | Prisma 5.9–5.10 |
| Base de datos | PostgreSQL (Supabase) |
| Validación (ingesta) | Zod 3.22 |
| Rate limiting | express-rate-limit |
| Gráficos (frontend) | Chart.js 4.4.1 |
| Exportación | jsPDF 2.5.1 + html2canvas |
| CI/CD | GitHub Actions + rsync + pm2 |
| Geolocalización | ip-api.com (free tier, caché 30 días) |

---

## 3. Micomercio Analytics — Script de Tracking e Ingesta

**Directorio:** `/Users/juanjoserodriguez/Desktop/Micomercio_Analytics`

### 3.1 Estructura de archivos

```
Micomercio_Analytics/
├── src/
│   ├── index.js                    # Entry point: arranca servidor, graceful shutdown
│   ├── app.js                      # Express app, registro de middlewares y rutas
│   ├── config/
│   │   └── index.js                # Puerto, rate limits, timeouts, TTLs
│   ├── routes/
│   │   ├── index.js                # Agrega rutas: /health + /api/v1/track
│   │   ├── track.routes.js         # POST /api/v1/track → middleware auth → controller
│   │   └── health.routes.js        # GET /health
│   ├── controllers/
│   │   ├── track.controller.js     # Valida payload Zod, extrae IP, llama trackService
│   │   └── health.controller.js    # Devuelve status + uptime + ping DB
│   ├── services/
│   │   ├── track.service.js        # Orquestador: visitor → session → event → geo
│   │   ├── visitor.service.js      # Upsert visitor, incrementa pageviews
│   │   ├── session.service.js      # Upsert session, calcula traffic source/medium
│   │   ├── event.service.js        # Crea evento idempotente, dispara increments
│   │   └── geo.service.js          # Resuelve IP → país/ciudad (async, no bloquea)
│   ├── repositories/
│   │   ├── site.repository.js      # Lookup site_config por api_key
│   │   ├── visitor.repository.js   # CRUD visitor via Prisma
│   │   ├── session.repository.js   # CRUD session via Prisma
│   │   ├── event.repository.js     # Upsert idempotente por eventUuid
│   │   └── geo.repository.js       # Cache geo por IP (upsert + hitCount)
│   ├── middlewares/
│   │   ├── auth.middleware.js       # Valida API key, adjunta req.site
│   │   ├── cors.middleware.js       # Permite todos los orígenes (seguridad vía API key)
│   │   ├── rateLimit.middleware.js  # 100 req/min/IP
│   │   └── errorHandler.middleware.js  # Centraliza errores → JSON response
│   ├── lib/
│   │   └── prisma.js               # Singleton PrismaClient
│   └── utils/
│       └── errors.js               # Clases: ValidationError, AuthError, NotFoundError
├── public/
│   ├── web-analytics.js            # Script de tracking (19.4 KB, vanilla JS, 969 líneas)
│   └── test.html                   # Página de prueba del pixel
├── prisma/
│   └── schema.prisma               # Schema compartido con el dashboard
├── migrations/
│   └── 001_add_traffic_source.sql  # Agrega columnas trafficSource/Medium
├── docs/                           # Especificaciones técnicas internas
├── tests/                          # Jest + Supertest
├── package.json
├── jest.config.js
└── .env
```

### 3.2 Pipeline de una petición

```
Sitio web cliente
      │
      │ POST /api/v1/track
      │ Header: X-API-Key: pk_live_xxx
      │ Body: { auth, visitor, session, event }
      ▼
[1] CORS Middleware
      Permite todos los orígenes, valida headers permitidos
      │
      ▼
[2] Rate Limit Middleware
      100 req/min/IP → 429 si se supera
      │
      ▼
[3] JSON Body Parser (límite 100 KB)
      │
      ▼
[4] Auth Middleware
      Busca apiKey en site_config (site.repository)
      Valida isActive → adjunta req.site
      → 401 si inválida o inactiva
      │
      ▼
[5] track.controller.js
      Valida payload con Zod (tipos, formatos UUID, URL)
      Extrae IP del cliente (X-Forwarded-For o socket)
      → 400 si falla validación
      │
      ▼
[6] track.service.js (orquestador)
      │
      ├─[6a] visitorService.resolveVisitor()
      │       UPSERT visitor por (siteId, visitorUuid)
      │       Crea si no existe, actualiza lastSeenAt si existe
      │
      ├─[6b] sessionService.resolveSession()
      │       UPSERT session por (siteId, sessionUuid)
      │       Calcula trafficSource:
      │         UTM source presente → usa utm_source
      │         Sin UTM pero con referrer → dominio del referrer
      │         Sin nada → "direct"
      │       Guarda: utm_*, gclid/fbclid/etc., browser, os, ip_address
      │
      ├─[6c] eventService.createEvent()
      │       INSERT idempotente por (siteId, eventUuid)
      │       Si ya existe → { created: false } (no duplica)
      │       Si es nuevo + type='pageview':
      │         incrementa visitor.totalPageviews
      │         incrementa session.pageviewsCount
      │
      └─[6d] geoService.resolveGeo(ip)  ← async, NO bloquea respuesta
              Busca en geo_cache por IP
              Si hit y no expirado → incrementa hitCount, retorna
              Si miss o expirado → llama ip-api.com (timeout 3s)
              Upsert geo_cache (TTL 30 días)
              Actualiza visitor.countryCode
      │
      ▼
[7] Respuesta HTTP 200
      {
        success: true,
        data: {
          visitorId: "123",
          sessionId: "456",
          eventCreated: true
        }
      }
      (La geo continúa en background)
```

### 3.3 El script de tracking — `web-analytics.js`

Es el pixel JavaScript que los clientes incrustán en sus sitios web. **Vanilla JS puro, sin dependencias, 19.4 KB.**

#### Integración en el sitio cliente

```html
<!-- Opción A: data-attributes -->
<script src="https://analytics.micomercio.com/web-analytics.js"
  data-key="pk_live_xxx"
  data-endpoint="https://analytics.micomercio.com/api/v1/track"
  data-track-clicks="true"
  data-track-scroll="true"
  data-track-forms="true"
  data-track-time="true"
  data-track-outbound="true"
  data-track-downloads="true"
  async>
</script>

<!-- Opción B: objeto de configuración global -->
<script>
  window.mcAnalyticsConfig = {
    key: 'pk_live_xxx',
    endpoint: 'https://analytics.micomercio.com/api/v1/track',
    trackClicks: true,
    trackScroll: true,
    trackForms: true,
    debug: false
  };
</script>
<script src="https://analytics.micomercio.com/web-analytics.js" async></script>
```

#### Gestión de identidad (cookies)

| Cookie | Duración | Propósito |
|--------|----------|-----------|
| `_mc_vid` | 365 días | UUID único del visitor (navegador) |
| `_mc_sid` | 30 minutos | UUID de sesión (se renueva por inactividad) |

#### Eventos rastreados automáticamente

| Evento | Disparo | metaData relevante |
|--------|---------|-------------------|
| `pageview` | Carga de página + navegación SPA (pushState/popState) | loadTime, screenWidth, language |
| `click` | Click en botones, links, elementos con `data-mc-track` | texto, id, clases, href, posición |
| `scroll_depth` | Al superar 25%, 50%, 75%, 90%, 100% de la página | depth, maxDepth, timeToReach |
| `form_start` | Primer foco en un campo de formulario | formId, fieldCount |
| `form_submit` | Submit del formulario | fieldsCompleted, timeToComplete |
| `time_on_page` | Al cambiar/cerrar pestaña o navegar | duration, visibleTime, engagementScore |
| `outbound_click` | Click a dominio externo | targetUrl, targetDomain |
| `whatsapp_click` | Click a wa.me o api.whatsapp.com | phoneNumber, messageText |
| `file_download` | Click a .pdf, .doc, .xls, .zip, etc. | fileName, fileExtension |

> **Privacidad de formularios:** Nunca captura valores de campos `password`, `card`, `cvv`, ni similares.

#### API pública del script

```javascript
// Tracking manual de eventos personalizados
mcAnalytics.track('mi_evento', { key: 'value' });

// Identificar usuario (vincula visitor con CRM)
mcAnalytics.identify({ userId: '123', email: 'x@x.com', name: 'Juan' });

// Obtener IDs actuales
const { visitorId, sessionId } = mcAnalytics.getIds();

// Eventos de e-commerce
mcAnalytics.ecommerce.viewProduct({ productId, productName, price });
mcAnalytics.ecommerce.addToCart({ productId, quantity, price });
mcAnalytics.ecommerce.beginCheckout({ total, itemCount });
mcAnalytics.ecommerce.purchase({ orderId, total, items });

// Privacidad
mcAnalytics.optOut();  // Borra cookies, desactiva tracking
mcAnalytics.optIn();   // Reactiva tracking
mcAnalytics.pause();   // Pausa temporal
mcAnalytics.resume();  // Reanuda
```

---

## 4. Dashboard Analytics — Visualización

**Directorio:** `/Users/juanjoserodriguez/Desktop/MiComercio/Dashboard_Analytics`
**Repositorio GitHub:** `micomercio-co/micomercio_bi_dashboard`

### 4.1 Estructura de archivos

```
Dashboard_Analytics/
├── src/
│   ├── app.js                          # Express: sirve SPA + monta rutas API
│   ├── lib/
│   │   └── prisma.js                   # Singleton PrismaClient
│   ├── routes/
│   │   ├── index.js                    # /health + montaje /api/v1/dashboard
│   │   └── dashboard.routes.js         # 27 endpoints GET
│   ├── controllers/
│   │   └── dashboard.controller.js     # Parsea parámetros, llama service, devuelve JSON
│   └── services/
│       └── dashboard.service.js        # Toda la lógica de agregación (1321 líneas)
├── public/
│   ├── index.html                      # SPA entry point (66 KB)
│   ├── dashboard.js                    # App frontend (3257 líneas)
│   └── styles.css                      # Estilos completos + dark mode (44 KB)
├── prisma/
│   └── schema.prisma                   # Mismo schema que el servicio de ingesta
├── docs/
│   ├── Mejora.md
│   └── prompt.md
├── package.json
└── .env
```

### 4.2 Los 27 endpoints del Dashboard

Todos son `GET /api/v1/dashboard/<endpoint>` y comparten parámetros comunes:

```
?siteId=1                          (requerido)
&startDate=2026-01-01              (opcional, default: hoy-7 días)
&endDate=2026-01-31                (opcional, default: hoy)
&device=mobile                     (filtro opcional)
&browser=Chrome                    (filtro opcional)
&country=CO                        (filtro opcional)
&city=Bogotá                       (filtro opcional)
&source=google                     (filtro opcional)
&utmCampaign=black_friday          (filtro opcional)
```

| Grupo | Endpoint | Descripción |
|-------|----------|-------------|
| **General** | `/sites` | Lista de sitios disponibles |
| | `/summary` | Métricas principales (visitas, sesiones, bounce rate, duración) |
| | `/summary/compare` | Comparación entre dos períodos |
| **Tendencias** | `/trend/daily` | Visitantes por día |
| | `/trend/hourly` | Visitantes por hora del día |
| **Eventos** | `/events` | Distribución de tipos de evento |
| | `/pages` | Páginas más visitadas |
| | `/clicks` | Elementos más clickeados |
| | `/referrers` | Referidores externos |
| | `/utms` | Parámetros UTM |
| **Audiencia** | `/devices` | Distribución por dispositivo |
| | `/browsers` | Distribución por navegador |
| | `/scroll` | Profundidad de scroll |
| **Geo & Tráfico** | `/location` | Distribución geográfica (país/ciudad) |
| | `/sources` | Fuentes de tráfico clasificadas |
| | `/countries` | Ranking de países |
| | `/heatmap` | Mapa de calor día × hora |
| **Tiempo Real** | `/realtime` | Visitantes últimos 30 minutos |
| | `/realtime/detailed` | Detalle de sesiones recientes |
| **Avanzado** | `/metrics/advanced` | Métricas combinadas avanzadas |
| | `/funnel` | Funnel de conversión personalizable |
| **Conversiones** | `/conversions` | Formularios + WhatsApp clicks |
| | `/conversions/trend` | Tendencia de conversiones por día |
| **E-commerce** | `/ecommerce/funnel` | Funnel: view → cart → checkout → purchase |
| | `/ecommerce/products` | Productos más vistos / más agregados al carrito |
| **Secciones** | `/sections` | Visitas por sección del sitio |

### 4.3 Flujo de una petición en el Dashboard

```
Browser (dashboard.js)
      │
      │ fetch('/api/v1/dashboard/summary?siteId=1&startDate=...&filters...')
      ▼
src/app.js (Express)
      │
      ▼
src/routes/dashboard.routes.js
      │  Mapea endpoint → función controlador
      ▼
src/controllers/dashboard.controller.js
      │  parseDateRange()       → extrae o aplica defaults
      │  parseAdvancedFilters() → extrae device, browser, country, city, source, utmCampaign
      │  Valida que siteId esté presente
      ▼
src/services/dashboard.service.js
      │
      ├─ getFilteredSessionIds(siteId, filters)
      │    Pre-filtra sessions por device/browser/geo/source
      │    (Para filtros geo: primero busca IPs en geo_cache, luego filtra sessions por IP)
      │
      └─ getSummary() / getTopPages() / etc.
           Queries Prisma ORM para datos simples
           Queries prisma.$queryRaw SQL para agregaciones complejas
           Retorna datos procesados
      │
      ▼
Controller: { success: true, data: {...}, filters: {...} }
      │
      ▼
Browser: dashboard.js
      Parsea JSON → actualiza state → renderiza Chart.js
```

### 4.4 Frontend (SPA)

El dashboard es una Single Page Application sin framework (JavaScript vanilla) servida directamente por Express desde `/public`.

#### Librerías cargadas desde CDN

```html
<script src="chart.js@4.4.1">           <!-- Gráficas -->
<script src="chartjs-plugin-datalabels"> <!-- Etiquetas en gráficas -->
<script src="jspdf@2.5.1">              <!-- Exportación PDF -->
<script src="html2canvas">              <!-- Captura DOM → PDF -->
```

#### Estado global (`window.state`)

```javascript
state = {
  siteId: null,
  startDate: '...',
  endDate: '...',
  currentSection: 'resumen',
  filters: {
    device: '', browser: '', country: '', city: '',
    source: '', utmCampaign: ''
  },
  charts: {},        // instancias Chart.js activas
  trendData: null,   // datos cacheados del trend
  alerts: {},        // config de alertas (guardada en localStorage)
  goals: {}          // config de metas (guardada en localStorage)
}
```

#### Secciones del dashboard

1. **Resumen** — KPIs principales + tendencia
2. **Tiempo Real** — Visitantes últimos 30 min (polling cada 30 seg)
3. **Adquisición** — Fuentes, referidores, UTMs, heatmap
4. **Interacción** — Páginas, clicks, scroll, secciones
5. **Audiencia** — Dispositivos, navegadores
6. **Ubicación** — Mapa por país/ciudad
7. **Conversiones** — Formularios + WhatsApp
8. **E-commerce** — Funnel + productos + revenue

#### Funcionalidades transversales

- **Tema:** Dark / Light (persiste en localStorage)
- **Filtros:** Fecha, dispositivo, browser, país, ciudad, fuente, UTM
- **Comparación:** Modo de comparación entre dos períodos
- **Exportación:** PDF (html2canvas + jsPDF) y CSV (generado en JS)
- **Metas:** Configuración de objetivos (pageviews, sesiones, bounce target)
- **Alertas:** Configuración de umbrales de alertas visuales
- **Tiempo real:** Badge en sidebar con visitantes activos

---

## 5. Base de Datos Compartida

**Host:** PostgreSQL en Supabase
**Acceso:** Ambos servicios usan el mismo `DATABASE_URL` con Prisma

### Modelo de datos

```
site_config
│  id, siteIdRef, companyIdRef, apiKey (UNIQUE), domain, isActive
│
├──< visitor (1:N)
│    id, siteId, visitorUuid (UUID cookie 365d), deviceType,
│    countryCode, firstSeenAt, lastSeenAt, totalPageviews
│    INDEX: (siteId, visitorUuid) UNIQUE
│
├──< session (1:N)
│    id, siteId, visitorId, sessionUuid, landingId
│    startedAt, lastActivityAt, pageviewsCount
│    -- UTM: utmSource, utmMedium, utmCampaign, utmContent, utmTerm...
│    -- Ad IDs: gclid, fbclid, msclkid, ttclid, lifattid, twclid, dclid
│    -- Device: browser, browserVersion, os, userAgent, ipAddress
│    -- Traffic: trafficSource, trafficMedium, referrer
│    INDEX: (siteId, sessionUuid) UNIQUE
│         + (siteId, startedAt)
│         + (siteId, trafficSource)
│
├──< event (1:N)
│    id, siteId, sessionId, visitorId
│    eventUuid (UNIQUE por siteId), eventType
│    pageUrl, pagePath, pageTitle, referrer
│    metaData (JSONB) ← datos variables por tipo de evento
│    occurredAt (TIMESTAMPTZ UTC)
│    INDEX: (siteId, eventUuid) UNIQUE
│         + (siteId, occurredAt)
│         + (siteId, eventType)
│         + (sessionId) + (visitorId)
│
└──< identified_user (1:1 con visitor)
     id, visitorId (UNIQUE), customerIdRef, email, phone
     fullName, identifiedAt, identificationMethod

geo_cache (tabla independiente)
  id, ipAddress (UNIQUE), countryCode, countryName, city, region
  expiresAt (30 días), hitCount
```

### Tipos de eventos almacenados en `event.eventType`

| eventType | Descripción | Fuente |
|-----------|-------------|--------|
| `pageview` | Vista de página | Automático |
| `click` | Click en elemento | Automático |
| `scroll_depth` | Profundidad de scroll | Automático |
| `form_start` | Inicio de formulario | Automático |
| `form_submit` | Envío de formulario | Automático |
| `time_on_page` | Tiempo en página | Automático |
| `outbound_click` | Click a sitio externo | Automático |
| `whatsapp_click` | Click a WhatsApp | Automático |
| `file_download` | Descarga de archivo | Automático |
| `view_product` | Vista de producto | Manual (ecommerce API) |
| `add_to_cart` | Agregar al carrito | Manual (ecommerce API) |
| `begin_checkout` | Inicio de checkout | Manual (ecommerce API) |
| `purchase` | Compra completada | Manual (ecommerce API) |

### Estructura JSONB de `metaData` por tipo de evento

```json
// pageview
{ "loadTime": 432, "screenWidth": 1920, "screenHeight": 1080, "language": "es" }

// click
{ "text": "Comprar ahora", "id": "btn-cta", "classes": "btn btn-primary", "href": "/checkout" }

// scroll_depth
{ "depth": 75, "maxDepth": 75, "documentHeight": 4200, "timeToReach": 12500 }

// form_submit
{ "formId": "contacto", "fieldsCompleted": 4, "fieldsEmpty": 0, "timeToComplete": 45000 }

// whatsapp_click
{ "phoneNumber": "+573001234567", "messageText": "Hola, quiero información", "linkText": "Contáctanos" }

// purchase
{ "orderId": "ORD-001", "total": 89900, "productId": "SKU-123", "productName": "Camiseta" }
```

---

## 6. Flujo Completo de Datos

```
1. CLIENTE NAVEGA SITIO WEB
   ─────────────────────────
   web-analytics.js se carga en el browser
   Lee/crea cookie _mc_vid (visitor UUID, 365d)
   Lee/crea cookie _mc_sid (session UUID, 30min)
   Detecta: browser, OS, UTMs, referrer, dispositivo

2. EVENTO CAPTURADO
   ─────────────────
   Usuario hace una acción (pageview, click, scroll...)
   web-analytics.js construye payload JSON
   POST /api/v1/track (keepalive: true, no bloquea al usuario)

3. INGESTA Y ALMACENAMIENTO
   ──────────────────────────
   Auth Middleware: valida API key → identifica site
   Zod: valida estructura del payload
   visitor → UPSERT en BD
   session → UPSERT en BD (con traffic source calculado)
   event   → INSERT idempotente por eventUuid
   Si pageview: incrementa contadores en visitor y session
   Responde 200 inmediatamente
   [Background] geo → ip-api.com → geo_cache → visitor.countryCode

4. USUARIO ABRE DASHBOARD
   ──────────────────────
   Autenticación (upstream, no en este repo)
   Carga lista de sitios: GET /api/v1/dashboard/sites
   Selecciona sitio y rango de fechas
   Frontend carga métricas: GET /api/v1/dashboard/summary?siteId=X...

5. PROCESAMIENTO Y VISUALIZACIÓN
   ─────────────────────────────
   dashboard.service.js agrega datos con Prisma + SQL raw
   Responde JSON → dashboard.js renderiza con Chart.js
   Usuario puede aplicar filtros (device, browser, geo, UTM)
   Todos los filtros re-consultan la API con los nuevos parámetros
   Exportar → jsPDF genera PDF con capturas del DOM o CSV con los datos tabulares
```

---

## 7. API de Ingesta

### `POST /api/v1/track`

**Autenticación:** Header `X-API-Key: pk_live_xxx`
**Rate limit:** 100 req/min/IP
**Content-Type:** application/json

#### Request body completo

```json
{
  "auth": {
    "apiKey": "pk_live_xxx",
    "domain": "tienda.cliente.com"
  },
  "visitor": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "deviceType": "desktop"
  },
  "session": {
    "uuid": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "referrer": "https://google.com/search?q=ropa",
    "landingPage": "/productos/camisetas",
    "utm": {
      "source": "google",
      "medium": "cpc",
      "campaign": "black_friday_2026",
      "content": "banner_principal",
      "term": "ropa mujer"
    },
    "clickIds": {
      "gclid": "ABC123...",
      "fbclid": null
    },
    "browser": "Chrome",
    "browserVersion": "120.0",
    "os": "Windows",
    "userAgent": "Mozilla/5.0..."
  },
  "event": {
    "uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "type": "pageview",
    "url": "https://tienda.cliente.com/productos/camisetas",
    "path": "/productos/camisetas",
    "title": "Camisetas - Tienda",
    "referrer": "https://google.com",
    "timestamp": "2026-04-15T14:30:00Z",
    "metaData": {
      "loadTime": 532,
      "screenWidth": 1920
    }
  }
}
```

#### Respuesta exitosa

```json
{
  "success": true,
  "data": {
    "visitorId": "12345",
    "sessionId": "67890",
    "eventCreated": true
  }
}
```

#### Códigos de error

| Código | Causa |
|--------|-------|
| 400 | Payload inválido (Zod validation error) |
| 401 | API key inválida o sitio inactivo |
| 429 | Rate limit superado (100 req/min) |
| 500 | Error interno del servidor |

### `GET /health`

```json
{
  "status": "ok",
  "timestamp": "2026-04-15T14:30:00Z",
  "uptime": 86400
}
```

---

## 8. API del Dashboard

Todos los endpoints responden:
```json
{
  "success": true,
  "data": { ... },
  "filters": { "startDate": "...", "endDate": "...", "device": "...", ... }
}
```

### Parámetros comunes

```
siteId        (requerido)     ID del sitio en site_config
startDate     (opcional)      Formato YYYY-MM-DD, default: hoy-7días
endDate       (opcional)      Formato YYYY-MM-DD, default: hoy
device        (opcional)      mobile | desktop | tablet
browser       (opcional)      Chrome | Safari | Firefox | ...
country       (opcional)      Código ISO (CO, US, MX...)
city          (opcional)      Nombre de ciudad
source        (opcional)      Fuente de tráfico (google, direct...)
utmCampaign   (opcional)      Nombre de campaña UTM
```

### Ejemplos de respuesta

#### `/summary`
```json
{
  "pageviews": 15420,
  "sessions": 3821,
  "uniqueVisitors": 2904,
  "newVisitors": 1823,
  "returningVisitors": 1081,
  "bounceRate": 42.3,
  "avgSessionDuration": 187,
  "avgPagesPerSession": 2.8
}
```

#### `/ecommerce/funnel`
```json
{
  "funnel": [
    { "step": "view_product",   "count": 4521, "dropRate": null },
    { "step": "add_to_cart",    "count": 1204, "dropRate": 73.4 },
    { "step": "begin_checkout", "count": 543,  "dropRate": 54.9 },
    { "step": "purchase",       "count": 312,  "dropRate": 42.5 }
  ],
  "revenue": 28540900,
  "avgTicket": 91477
}
```

---

## 9. Seguridad y Multi-tenancy

### Aislamiento por sitio

- Cada cliente tiene un registro en `site_config` con `apiKey` único y `domain`
- **Todos** los registros en `event`, `session`, `visitor` tienen `siteId`
- **Todos** los queries del dashboard filtran por `siteId` primero
- No existe forma de consultar datos cruzados entre sitios desde la API

### Autenticación en ingesta

```
Prioridad de lectura del API key:
1. Header X-API-Key
2. Header Authorization: Bearer <key>
3. Body: auth.apiKey
```

- El API key se valida contra `site_config.apiKey` en cada request
- Si el sitio tiene `isActive = false`, se rechaza con 401

### CORS en ingesta

- CORS abierto (`origin: '*'`) porque el script se incrusta en dominios de terceros
- La seguridad se delega al API key, no al origen de la petición

### CORS en dashboard

- Configurado vía `CORS_ORIGINS` en `.env` (lista de dominios permitidos)

### Variables de entorno críticas

```bash
# Ingesta (Micomercio_Analytics)
DATABASE_URL=postgresql://user:pass@host:5432/db
PORT=3000
NODE_ENV=production

# Dashboard (Dashboard_Analytics)
DATABASE_URL=postgresql://user:pass@host:5432/db   # misma BD
PORT=3001
NODE_ENV=production
CORS_ORIGINS=https://dashboard.micomercio.com
```

### Lo que NO está en este repo

- Autenticación de usuarios del dashboard (login, sesiones de operador) — se asume middleware upstream
- Panel de administración para crear/gestionar `site_config` y `api_key`

---

## 10. Despliegue e Infraestructura

### CI/CD — Dashboard Analytics

El repositorio `micomercio_bi_dashboard` tiene GitHub Actions configurado:

```yaml
Trigger: push a main
Steps:
  1. actions/checkout@v4    → clona el repo
  2. actions/setup-node@v4  → instala Node.js 24.13.0
  3. npm ci                 → instala dependencias (usa cache npm)
  4. easingthemes/ssh-deploy → rsync al servidor de producción
     Excluye: .git/, .github/, archivos en .gitignore
  5. Script post-deploy en servidor:
     npm ci
     npx prisma generate
     pm2 restart 1
```

### Servidor de producción

- **SO:** Ubuntu 24.04 LTS
- **Process manager:** pm2 (restart automático, logs)
- **Puerto ingesta:** 3000
- **Puerto dashboard:** 3001
- **Reverse proxy:** Nginx / Caddy (asumido upstream)

### Comandos de gestión

```bash
# Desarrollo local
npm run dev        # nodemon — recarga en cambios

# Producción
npm start          # node src/app.js (o src/index.js)

# Base de datos
npm run db:generate   # Regenera cliente Prisma (tras cambios en schema)
npx prisma migrate dev  # Aplica migraciones en desarrollo
npx prisma studio       # GUI para explorar la BD

# Proceso pm2
pm2 list           # Lista procesos activos
pm2 logs 1         # Ver logs del proceso dashboard
pm2 restart 1      # Reiniciar proceso
```

---

## Apéndice — Decisiones técnicas relevantes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Dos servicios separados | Un monolito | Cargas distintas: ingesta es write-heavy, dashboard es read-heavy |
| Polling cada 30s (tiempo real) | WebSockets | Simplicidad; volumen de usuarios no justifica WS |
| Geo en background | Geo sincrónico | ip-api.com puede tardar 3s; no penalizar la ingesta |
| Idempotencia por eventUuid | Sin control de duplicados | El script puede reintentar si falla la red |
| Prisma ORM + SQL raw | Solo ORM o solo SQL | ORM para casos simples, SQL raw para agregaciones complejas |
| Supabase (PostgreSQL) | MongoDB / ClickHouse | PostgreSQL soporta JSONB (metaData) + OLTP + OLAP en un solo servicio |
| Vanilla JS en el pixel | React / Vue | Sin framework = menor peso, sin conflictos con la web del cliente |
| CORS abierto en ingesta | CORS por dominio | El pixel se incrusta en dominios de terceros desconocidos |
