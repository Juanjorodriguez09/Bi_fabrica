# micomercio_bi_dashboard

## Qué es este proyecto

`Dashboard_Analytics`: la mitad **solo lectura** de un sistema de analítica
web propia de MiComercio (similar en concepto a Google Analytics). Es un
servicio Node.js + Express que agrega datos ya almacenados y sirve un
dashboard SPA. No escribe eventos — eso lo hace un servicio hermano,
`Micomercio_Analytics` (ingesta), que **no vive en este repo** y comparte la
misma base de datos.

- **Backend:** Express + Prisma ORM sobre PostgreSQL. Sin TypeScript, sin
  framework de backend adicional.
- **Frontend:** SPA en JavaScript vanilla, un solo archivo
  (`public/dashboard.js`, ~3200 líneas), sin build step, servida como
  estático por el mismo Express. Gráficas con Chart.js (CDN), export a
  PDF/CSV con jsPDF + html2canvas.
- **Base de datos:** PostgreSQL hosteado en Supabase, pero este repo **no
  usa Supabase como plataforma** — no hay `supabase-js`, no hay Supabase
  Auth, no hay Storage. Es Postgres estándar vía `DATABASE_URL` + Prisma.
- **Auth:** no existe en este repo. La autenticación de usuarios del
  dashboard es upstream (fuera de este código) — nunca agregar lógica de
  login/sesión aquí sin que te lo pidan explícitamente.
- **Multi-tenant:** cada cliente es un `site_config` con `siteId`. Todos los
  datos de `event`, `session`, `visitor` están aislados por `siteId`. No
  existe (ni debe existir) forma de consultar datos cruzados entre sitios.

Ver `DOCUMENTACION_TECNICA.md` para el detalle completo de arquitectura,
endpoints, modelo de datos y despliegue — es la fuente de verdad técnica de
este repo y debe mantenerse sincronizada con el código (ver subagente
`documentador`).

Este proyecto es el primer caso real de la "fábrica de software" interna de
MiComercio (contexto completo en `Contexto_fabrica_software.md`).

## Regla no negociable: local siempre, producción nunca

Este repo **siempre** trabaja contra el Postgres local levantado con
`docker compose up -d` (`localhost:5433`, ver `docker-compose.yml`). Nunca
contra la base de datos de producción.

- `DATABASE_URL` en `.env` debe apuntar exclusivamente a
  `postgresql://micomercio:micomercio_local_dev@localhost:5433/micomercio_local?schema=public`.
- Si en algún momento aparece una cadena de conexión distinta en `.env`,
  variables de entorno, o código — es un error, corregirlo antes de seguir.
- Para refrescar los datos locales con una copia más reciente de producción,
  seguir el protocolo del skill `entorno-seguro` (`pg_dump` de solo lectura,
  nunca la cadena de escritura de Prisma).

## Convenciones de código identificadas

Estas no son preferencias — son los patrones que el código ya sigue de
forma consistente en los 27 endpoints existentes. Un cambio que se desvíe de
esto sin razón es una señal de alerta para el subagente `revisor-codigo`.

- **Patrón de capas:** `routes/*.routes.js` → `controllers/*.controller.js`
  → `services/*.service.js`. El controller nunca habla con Prisma
  directamente; toda query vive en el service.
- **Respuesta HTTP uniforme:** siempre `{ success: true, data }` en éxito, o
  `{ success: false, error }` en fallo (ver `app.js` error handler central
  y cada controller). Nunca romper este sobre.
- **`siteId` primero, siempre:** cada función de controller que lee datos de
  un sitio valida `siteId` al inicio y responde `400` si falta. Cada query
  en el service filtra por `site_id` (o por `session_id`/`visitor_id` ya
  pre-filtrados por `site_id`) antes que cualquier otra condición.
- **snake_case en DB, camelCase hacia el frontend:** las columnas y modelos
  de Prisma son snake_case (igual que la tabla real: `site_id`,
  `occurred_at`, `pageviews_count`). Las funciones de `dashboard.service.js`
  siempre traducen a camelCase en el objeto que retornan
  (`uniqueVisitors`, `avgSessionDuration`, ...). `public/dashboard.js`
  consume esos nombres camelCase directamente — un cambio de nombre en el
  service que no se refleje en el frontend rompe la UI en silencio (sin
  error de tipos, porque no hay TypeScript).
- **Rango de fechas en UTC explícito:** siempre
  `new Date(startDate + 'T00:00:00.000Z')` /
  `new Date(endDate + 'T23:59:59.999Z')`, nunca fechas ambiguas sin
  timezone — es una fuente de bugs ya identificada y evitada a propósito en
  el código existente.
- **SQL raw solo con template tag parametrizado:** `prisma.$queryRaw\`...\``
  con interpolación de variables dentro del template (Prisma las
  parametriza automáticamente). **Nunca** `$queryRawUnsafe`. Los `bigint[]`
  se pasan como arrays JS y se castean con `::bigint[]` en el SQL.
- **BigInt de Postgres → Number en JS:** los IDs (`BigInt` en Prisma) se
  convierten explícitamente con `Number(...)` antes de devolverlos o
  usarlos en aritmética.
- **Forma de respuesta estable incluso sin datos:** cuando un filtro no
  devuelve sesiones/IPs, las funciones retornan el mismo objeto con todas
  las métricas en `0`, nunca `undefined` o un objeto parcial — el frontend
  asume que todas las claves siempre están presentes.
- **Filtros avanzados repetidos en cada endpoint:** `device`, `browser`,
  `country`, `city`, `source` (→ `utm_source`), `utmCampaign` — mismo
  vocabulario y mismo orden de aplicación en todas las funciones que los
  soportan.

## Lo que no hay todavía (no asumir que existe)

- Sin tests automatizados (`*.test.js`/`*.spec.js`).
- Sin ESLint/Prettier configurado.
- Sin TypeScript — el contrato de campos entre backend y frontend es solo
  por convención, nada lo valida en build/CI.
