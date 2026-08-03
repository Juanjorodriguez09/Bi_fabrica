---
name: convenciones-sql-agregacion
description: Reglas para escribir queries de agregación (Prisma Client o SQL raw) en micomercio_bi_dashboard sin introducir fugas entre sitios, inyección SQL, o números incorrectos. Úsalo al escribir o revisar cualquier query en src/services/dashboard.service.js.
---

# Convenciones de SQL/agregación en este repo

`dashboard.service.js` tiene 27 funciones y 42 queries `$queryRaw`. Estas
reglas ya están seguidas de forma consistente en el código existente — no
son una propuesta, son lo que hay que igualar.

## 1. `site_id` antes que cualquier otra condición

Todo query que toque `event`, `session`, `visitor` o `identified_user` debe
filtrar por `site_id` — directamente, o mediante una lista de
`session_id`/`visitor_id` que ya fue filtrada por `site_id` antes (patrón
`getFilteredSessionIds`). Una sub-query dentro de un `$queryRaw` que se
olvida de heredar este filtro es una fuga de datos entre clientes distintos
de MiComercio, aunque la query externa sí filtre.

## 2. SQL raw: solo template tag parametrizado

```js
// Correcto — Prisma parametriza automáticamente lo interpolado
prisma.$queryRaw`SELECT * FROM event WHERE site_id = ${siteId}`

// Prohibido — nunca en este repo
prisma.$queryRawUnsafe(`SELECT * FROM event WHERE site_id = ${siteId}`)
```

Arrays para `IN`/`ANY`: pasar el array de JS directo y castear en SQL, como
ya hace el código:

```js
prisma.$queryRaw`... WHERE session_id = ANY(${sessionIds}::bigint[])`
```

## 3. Fechas: siempre límites UTC explícitos

```js
const start = new Date(startDate + 'T00:00:00.000Z');
const end = new Date(endDate + 'T23:59:59.999Z');
```

Nunca construir un rango de fechas sin `Z` explícito — es la fuente de bugs
de timezone ya identificada y evitada a propósito en este código
(`occurred_at`/`started_at` son `TIMESTAMPTZ`).

## 4. Evitar doble conteo en JOIN

Cuando un JOIN puede multiplicar filas (ej. `event` × `session` ×
`visitor`), usar `COUNT(DISTINCT ...)` sobre la columna que realmente
identifica la entidad que se está contando, no `COUNT(*)`. Antes de dar por
buena una agregación con JOIN, preguntarse: "¿esta fila puede repetirse por
culpa del JOIN?" — si la respuesta es sí, la métrica está mal a menos que
use `DISTINCT` explícitamente.

## 5. Filtros avanzados: mismo vocabulario en todas partes

`device`, `browser`, `country`, `city`, `source` (mapea a `utm_source`),
`utmCampaign` (mapea a `utm_campaign`). Si una función nueva soporta
filtros, debe soportar el mismo conjunto con los mismos nombres — no
inventar un filtro con otro nombre para el mismo concepto.

## 6. BigInt → Number antes de responder

Los IDs son `BigInt` en Prisma/Postgres. Convertir con `Number(...)` antes
de meterlos en la respuesta JSON o en aritmética — un `BigInt` sin convertir
rompe `JSON.stringify` (Express lo hace por debajo en `res.json`).

## 7. Forma de respuesta estable ante resultado vacío

Si un filtro no deja ninguna fila, devolver el mismo objeto con todas las
métricas en `0` (o `[]` para listas) — nunca un objeto con menos claves.
`public/dashboard.js` no verifica la presencia de cada clave antes de
leerla.

## Cómo verificar que una query nueva cumple esto

Usa el subagente `validador-metricas` para comparar el resultado contra una
query manual independiente en el Postgres local — no basta con que la query
corra sin error de sintaxis.
