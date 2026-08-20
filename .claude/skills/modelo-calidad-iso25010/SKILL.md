---
name: modelo-calidad-iso25010
description: Checklist de calidad ISO/IEC 25010 interpretado específicamente para micomercio_bi_dashboard (no la definición genérica de la norma). Úsalo como estructura de cualquier revisión o auditoría de código de este repo — cada hallazgo debe poder ubicarse en una de las 8 características.
---

# Modelo de calidad — ISO/IEC 25010 aplicado a micomercio_bi_dashboard

Este documento traduce las 8 características de la norma a lo que
significan concretamente en este repo, con base en el código real (no en
la definición abstracta). Es el checklist que usa `revisor-codigo`, y la
referencia para interpretar cualquier hallazgo de `validador-metricas` o
`tester` en términos de calidad de producto.

## 1. Adecuación funcional

Que las 27 agregaciones del dashboard calculen y expongan exactamente lo
que un cliente de MiComercio necesita ver de su sitio — ni de más ni de
menos.

- **Completitud:** cobertura de pageviews, sesiones, visitantes, embudo de
  conversión, e-commerce, geografía, tiempo real y comparación de
  periodos. Un endpoint que falta para una sección visible del dashboard es
  un hallazgo de esta característica.
- **Corrección:** el número que devuelve un endpoint es el número correcto
  (verificable independientemente — ver `validador-metricas`). Esta es la
  característica más crítica de este proyecto en particular: es un
  dashboard de BI, así que un cálculo incorrecto es peor que una
  funcionalidad faltante.
- **Pertinencia:** cada endpoint sirve una vista específica sin lógica de
  negocio sobrante; el dashboard no intenta ser una herramienta genérica.

## 2. Eficiencia de desempeño

- El volumen real hoy es modesto (~52k eventos, ~7.7k sesiones, 7 sitios),
  pero varias funciones de `dashboard.service.js` hacen dos pasadas
  (`getFilteredSessionIds` primero, luego una query con `session_id = ANY(...)`)
  en vez de una sola query con subquery — vigilar si esto escala mal cuando
  el volumen de eventos crezca en un orden de magnitud.
- No hay caché para endpoints que se repiten seguido (ej. `/realtime`,
  pensado para polling frecuente desde el frontend).
- No hay rate limiting en las rutas del dashboard (a diferencia del
  servicio de ingesta, que sí lo tiene) — un polling agresivo o mal
  configurado en el frontend puede saturar el Postgres compartido con
  ingesta.
- Los índices existentes (`site_id, occurred_at`, `site_id, started_at`,
  etc.) cubren los patrones de query actuales; un endpoint nuevo que
  filtre por una columna sin índice es un hallazgo de esta característica.

## 3. Compatibilidad

- **Coexistencia:** este repo y `Micomercio_Analytics` (ingesta) comparten
  el mismo schema de Postgres sin estar en el mismo repo — un cambio de
  schema aquí sin coordinar con el otro repo rompe la ingesta o el
  dashboard en producción.
- **Interoperabilidad:** API REST/JSON estándar, export a PDF/CSV con
  formatos abiertos. CORS explícito por variable de entorno.
- El frontend depende de tres librerías cargadas desde CDN (Chart.js,
  jsPDF, html2canvas) sin fallback local — si el CDN no responde, el
  dashboard completo deja de renderizar gráficas. Es un punto único de
  fallo de compatibilidad/disponibilidad del frontend.

## 4. Usabilidad

- Filtros combinables (dispositivo, navegador, país, ciudad, fuente, UTM),
  exportación a PDF/CSV, indicador de tiempo real, sidebar colapsable.
- No hay evidencia en el código de atributos de accesibilidad (`aria-*`,
  contraste verificado) — no se ha auditado, tratar como desconocido, no
  como "cumple".
- Manejo de error visible al usuario: el frontend lanza `Error` si
  `!data.success`, pero no está verificado qué ve el usuario final cuando
  eso pasa (¿mensaje claro o pantalla en blanco?) — pendiente de revisar
  en navegador real cuando se toque ese flujo.

## 5. Fiabilidad

- **Madurez:** sin tests automatizados, las regresiones solo se detectan
  manualmente (`tester`) o en producción. Es la brecha más grande de esta
  característica.
- **Disponibilidad:** un solo proceso PM2 en un VPS (Contabo), sin réplica
  ni failover documentado en este repo.
- **Tolerancia a fallos:** hay un error handler central que evita que una
  excepción tumbe el proceso completo, pero no hay reintentos ni circuit
  breaker si Postgres no responde — un fallo de conexión a la base
  devuelve 500 en cada endpoint hasta que se recupera.
- **Recuperabilidad:** no hay backups ni estrategia de recuperación
  documentados en este repo (dependen de lo que Supabase provea del lado
  de producción, fuera del alcance de este código).

## 6. Seguridad

Interpretación de los 20 puntos de `estandares-seguridad-fabrica` (el
estándar genérico de la fábrica) aplicados a este repo concreto:

| # | Punto | Estado en este repo |
|---|---|---|
| 1 | Oculta claves API | ✅ Todo por `.env`/variables de entorno, sin valores hardcodeados. |
| 2 | Elimina secretos de Git | ✅ `.env` en `.gitignore`, sin credenciales filtradas en el historial (verificado en Fase 1). |
| 3 | Clave de DB con privilegio mínimo | ⚠️ **Gap:** no hay evidencia en este repo de qué rol de Postgres usa `DATABASE_URL` en producción — verificar que no sea el rol de máximo privilegio de Supabase. |
| 4 | RLS | **No aplica tal cual** — este repo no accede vía la capa de Supabase (PostgREST/RLS), es Postgres directo vía Prisma (ver skill `entorno-seguro`). El control de acceso equivalente es el filtro explícito por `site_id` en cada query (ver aislamiento multi-tenant abajo) — ese es el mecanismo real, no RLS. |
| 5 | Cifra datos sensibles | ⚠️ **Gap sin evaluar:** `session`/`visitor` guardan IP y geolocalización derivada — es dato potencialmente sensible (PII) y no está documentado si va cifrado en reposo o solo protegido por aislamiento de acceso. Señalar en cualquier cambio que toque esas columnas. |
| 6 | Fuerza autenticación del servidor | **No aplica a este repo por diseño** — la autenticación es upstream, fuera de este código (ver `CLAUDE.md`). Riesgo real y explícito, ya documentado: si el middleware upstream falla, cualquiera con la URL ve datos agregados. No es responsabilidad de este repo resolverlo, pero sí señalarlo, nunca asumirlo "ya resuelto". |
| 7 | Restringe acceso a registros | ✅ **La protección más importante de este proyecto:** aislamiento multi-tenant por `site_id` en cada query — directa o vía `session_id`/`visitor_id` ya filtrados. Cualquier query nueva que no lo respete es un hallazgo crítico. |
| 8 | Bloquea manipulación de campos | ✅ Los filtros avanzados (`device`, `browser`, `country`, etc.) son parámetros de consulta interpretados explícitamente por el service, no un objeto pasado directo a una escritura — no hay mass assignment porque este repo no escribe datos de negocio (es solo lectura). |
| 9 | Protege cookies de sesión | **No aplica** — sin sesión propia en este repo. |
| 10 | Hashea contraseñas | **No aplica** — sin manejo de contraseñas en este repo. |
| 11 | Limita intentos de login | **No aplica** — sin login en este repo. |
| 12 | Protección contra bots | ⚠️ **Gap:** las rutas de lectura son públicas (sujeto al punto 6) y no tienen ninguna verificación anti-bot — relacionado con la ausencia de rate limiting ya conocida. |
| 13 | Monitorea consultas de DB | ❌ **Gap confirmado, deuda conocida:** sin logging ni alertas sobre queries lentas o anómalas. |
| 14 | Valida todas las entradas | ⚠️ Parcial — `siteId` se valida (400 si falta), pero no hay validación sistemática de tipo/formato en el resto de query params (fechas, filtros). Señalar si un cambio nuevo confía en un input sin validarlo. |
| 15 | Escapa contenido del usuario | ⚠️ **Gap real, con historial:** el patrón `escapeHtml()` existe y se usa en la mayoría del frontend, pero se encontraron y corrigieron dos casos reales donde un `innerHTML` nuevo lo omitió (badge del header, tooltip de sitio) — ver `Roadmap_automatizacion_fabrica.md`. Es el punto de mayor riesgo real de este repo en la práctica: cualquier `innerHTML` nuevo en `dashboard.js` que no pase por `escapeHtml()` es un hallazgo, sin excepción. |
| 16 | Restringe subida de archivos | **No aplica** — sin funcionalidad de subida de archivos en este repo. |
| 17 | Limita respuestas de API | ❌ **Gap confirmado, deuda conocida:** sin rate limiting en las rutas de lectura del dashboard (a diferencia del servicio de ingesta, que sí lo tiene). Paginación existe en endpoints de listado (`getTopPages`, etc. con `limit`), pero no hay tope duro contra un `limit` arbitrariamente alto pedido por el cliente. |
| 18 | Cabeceras de seguridad HTTP | ❌ **Gap sin evaluar todavía** — no hay evidencia en el código de `helmet` o configuración explícita de CSP/`X-Frame-Options` en `app.js`. |
| 19 | Fuerza HTTPS | Responsabilidad del proxy/deploy (Contabo + reverse proxy), no de este código — verificar en el workflow de deploy cuando se corrija (`deploy-main.yml`, ver roadmap §3), no asumir. |
| 20 | Escanea dependencias | ❌ **Gap confirmado, deuda conocida:** sin Dependabot ni `npm audit` en CI. |

**SQL parametrizado** (no es uno de los 20 puntos genéricos, pero es la
protección de inyección más relevante de este stack): todo `$queryRaw` usa
template tag, nunca `$queryRawUnsafe` — sin inyección SQL conocida.

## 7. Mantenibilidad

- **Modularidad entre capas:** buena (`routes` → `controllers` →
  `services`), consistente en los 27 endpoints.
- **Modularidad interna:** débil en los dos archivos más grandes —
  `dashboard.service.js` (1321 líneas, 27 funciones) y `dashboard.js`
  frontend (3257 líneas, un solo archivo) concentran casi toda la lógica.
- **Analizabilidad:** baja — sin tests ni linter, entender el efecto de un
  cambio requiere lectura manual completa del archivo afectado.
- **Modificabilidad:** el contrato de nombres de campo entre backend y
  frontend es solo por convención (sin TypeScript ni validación de
  esquema) — un rename se rompe en silencio.
- **Capacidad de prueba:** la mayor deuda técnica conocida del proyecto —
  cero tests automatizados. Aceptado como estado actual, no como algo a
  corregir de forma oportunista en cada cambio; es una decisión pendiente
  de priorizar explícitamente.

## 8. Portabilidad

- **Adaptabilidad:** configuración por variables de entorno (`PORT`,
  `DATABASE_URL`, `CORS_ORIGINS`) — sin valores hardcodeados de entorno.
- **Instalabilidad:** `npm ci` + `prisma generate` + `pm2 restart`,
  documentado y automatizado en CI (`.github/workflows/deploy-main.yml`).
- **Coexistencia de versiones:** el dump/restauración de Fase 1 mostró que
  la compatibilidad con Postgres no es transparente entre versiones
  mayores (17 vs. 16 falló por un GUC nuevo) — portar este proyecto a otra
  versión mayor de Postgres no es trivial sin probarlo primero.
- **Reemplazabilidad:** fuertemente acoplado a la estructura de tablas
  compartida con `Micomercio_Analytics` — cambiar el ORM o el modelo de
  datos aquí implica coordinar el otro repo también.

## Cómo usar este checklist

Cualquier hallazgo de una revisión de código debe poder etiquetarse con una
de estas 8 características. Si un hallazgo no encaja en ninguna, probablemente
no es un hallazgo de calidad de producto sino una preferencia de estilo —
tratarlo aparte, con menor prioridad.
