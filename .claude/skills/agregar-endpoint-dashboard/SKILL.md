---
name: agregar-endpoint-dashboard
description: Checklist para agregar un nuevo endpoint al dashboard de micomercio_bi_dashboard, siguiendo el mismo patrón que los 27 endpoints existentes. Úsalo cuando la tarea sea "agregar una métrica/vista/reporte nuevo al dashboard".
---

# Agregar un endpoint nuevo al dashboard

Este repo tiene 27 endpoints que siguen exactamente el mismo patrón en
`routes → controller → service`. Un endpoint nuevo debe seguirlo también —
no es una decisión de diseño abierta.

## Pasos, en orden

1. **Service** (`src/services/dashboard.service.js`): agrega la función de
   agregación. Debe:
   - Recibir `siteId` como primer parámetro y filtrar por él antes que
     cualquier otra condición.
   - Aceptar `startDate`, `endDate` si el dato es temporal, construidos con
     límites UTC explícitos (`T00:00:00.000Z` / `T23:59:59.999Z`).
   - Aceptar el mismo objeto `filters` que las demás funciones si el
     endpoint tiene sentido con filtros avanzados (`device`, `browser`,
     `country`, `city`, `source`, `utmCampaign`) — reusa
     `getFilteredSessionIds` si aplica en vez de reimplementar el filtrado.
   - Usar `prisma.$queryRaw` (template tag, nunca `Unsafe`) para
     agregaciones que Prisma Client no expresa bien (COUNT DISTINCT, AVG,
     EXTRACT, `ANY(...)::bigint[]`).
   - Devolver un objeto en camelCase, con forma estable incluso cuando no
     hay datos (mismas claves, valores en `0`/`[]`, nunca `undefined`).
   - Convertir cualquier `BigInt` a `Number` antes de devolverlo.

2. **Controller** (`src/controllers/dashboard.controller.js`): agrega la
   función que:
   - Parsea `siteId` con `parseInt`, responde `400` con
     `{ success: false, error: 'siteId is required' }` si falta.
   - Usa los helpers existentes `parseDateRange(req)` y
     `parseAdvancedFilters(req)`.
   - Llama al service y responde `{ success: true, data }`.
   - Envuelve todo en `try/catch` con `next(error)` — no manejo de errores
     ad hoc.

3. **Route** (`src/routes/dashboard.routes.js`): agrega la línea
   `router.get('/ruta', dashboardController.nombreFuncion);` en el bloque
   temático correspondiente (o crea uno nuevo si es una categoría distinta),
   con el comentario corto que ya usan las demás rutas.

4. **Frontend** (`public/dashboard.js`): consume el endpoint nuevo usando
   los mismos nombres de campo camelCase que devolvió el service — no
   renombres al consumir. Si el endpoint alimenta una gráfica, usa la misma
   paleta/estructura de Chart.js que las gráficas existentes de la misma
   sección.

5. **Documentación**: usa el subagente `documentador` (o hazlo tú mismo si
   no está disponible) para agregar el endpoint a la sección "4.2 Los 27
   endpoints del Dashboard" de `DOCUMENTACION_TECNICA.md`, con un ejemplo de
   respuesta real (no inventada).

6. **Verificación**: usa el subagente `tester` para probar el endpoint
   nuevo contra el Postgres local con un `siteId` real, incluyendo el caso
   sin `siteId` (debe dar `400`, no `500`). Si el endpoint agrega una
   métrica numérica nueva (no solo redistribuye datos existentes), usa
   también `validador-metricas` para confirmar que el número es correcto,
   no solo que el endpoint responde.

## Errores comunes a evitar (ya vistos en el código existente)

- Olvidar filtrar por `siteId` en una sub-query dentro de un `$queryRaw`
  que sí filtra en la query principal.
- Responder con una forma distinta cuando el resultado está vacío (objeto
  con menos claves en vez de ceros).
- Cambiar un nombre de campo en el service sin actualizar
  `public/dashboard.js` — no hay TypeScript que lo avise, se rompe en
  silencio en el navegador.
