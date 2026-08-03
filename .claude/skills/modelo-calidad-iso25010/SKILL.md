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

- **Aislamiento multi-tenant por `site_id`:** la protección de seguridad
  más importante de este proyecto — evita que un cliente vea datos de
  otro. Cualquier query nueva que no lo respete es un hallazgo crítico.
- **SQL parametrizado:** todo `$queryRaw` usa template tag, nunca
  `$queryRawUnsafe` — sin inyección SQL conocida.
- **Ausencia de autenticación en este repo:** las rutas del dashboard no
  tienen ningún control de acceso propio — la documentación técnica asume
  un middleware "upstream" que no vive en este código. Esto es un riesgo
  real y explícito: si ese middleware upstream falla o no está bien
  configurado en un entorno dado, cualquiera con la URL ve datos agregados
  de todos los clientes de MiComercio. No es algo que este repo deba
  resolver por sí solo, pero sí algo que debe quedar señalado como
  supuesto de seguridad externo, no como "ya resuelto".
- `.env` con credenciales está en `.gitignore` — no se ha filtrado ninguna
  credencial en el historial de este repo (verificado en la Fase 1).
- Sin rate limiting en las rutas de lectura del dashboard.

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
