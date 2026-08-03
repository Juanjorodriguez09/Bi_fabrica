---
name: entorno-seguro
description: Protocolo de entorno local seguro para micomercio_bi_dashboard — cómo levantar el Postgres local y refrescar datos reales sin tocar nunca producción. Úsalo antes de cualquier tarea que necesite datos, o cuando el .env / la base local no parezcan estar configurados.
---

# Entorno seguro — micomercio_bi_dashboard

## Regla no negociable

Este repo **siempre** trabaja contra el Postgres local de Docker. `DATABASE_URL`
en `.env` nunca debe apuntar a un host de producción. Si en algún momento
`.env` contiene una cadena de conexión que no sea `localhost:5433`
(o el puerto configurado en `docker-compose.yml`), es un error — corregirlo
antes de seguir, no preguntar "¿estará bien así?".

## Por qué este proyecto NO usa Supabase CLI

A pesar de que la base de datos de producción está hosteada en Supabase, este
repo **no usa Supabase como plataforma**: no hay `supabase-js`, no hay
Supabase Auth, no hay Storage. Todo el acceso es Postgres estándar vía Prisma
y `DATABASE_URL` (ver `prisma/schema.prisma` y `DOCUMENTACION_TECNICA.md`
sección 5). La autenticación de usuarios del dashboard es upstream, fuera de
este repo — no hay nada que anonimizar de `auth.users` porque este repo nunca
lo toca.

Por eso el entorno local es un **Postgres plano en Docker**, no el stack de
`supabase start`.

## Arquitectura del entorno local

- `docker-compose.yml` en la raíz del repo levanta un único contenedor
  `postgres:17` (misma versión mayor que producción — ver nota de versión
  abajo), puerto host `5433` (el `5432` nativo del Mac queda libre y sin
  tocar), volumen nombrado con persistencia.
- Este repo (`Dashboard_Analytics`) es la mitad **solo lectura** de un sistema
  de dos servicios. El otro servicio, `Micomercio_Analytics` (ingesta), no
  vive en este repo y **no se levanta en local**. Por eso no hay
  sincronización en vivo ni proceso que siga escribiendo eventos — los datos
  locales son una fotografía estática que se refresca manualmente.

## Cómo levantar el entorno desde cero

```bash
docker compose up -d
# esperar healthcheck:
docker inspect --format='{{.State.Health.Status}}' micomercio_bi_dashboard_local_db
```

## Cómo refrescar los datos (pg_dump manual)

No hay sincronización automática — se corre a mano cuando se necesita
información más reciente que la última fotografía.

1. **Nunca usar la cadena de escritura de Prisma de producción.** Pedir
   siempre una cadena de conexión de un rol de **solo lectura** en
   Supabase → Database → Roles.

2. El rol de solo lectura necesita, además de `SELECT` sobre las tablas,
   dos permisos que Supabase no da por defecto y que causan fallos silenciosos
   si faltan:

   ```sql
   -- Sin esto, pg_dump falla con "permission denied for sequence ..._id_seq"
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO <rol_readonly>;

   -- Sin esto, todas las tablas devuelven 0 filas porque tienen RLS activado
   -- (relrowsecurity = t) y el rol no tiene ninguna policy que le dé
   -- visibilidad. BYPASSRLS es aceptable aquí porque el único propósito
   -- de este rol es un dump completo de solo lectura, nunca se usa desde
   -- la app.
   ALTER ROLE <rol_readonly> BYPASSRLS;
   ```

   Si un `SELECT count(*)` contra ese rol devuelve `0` en todas las tablas
   pero `pg_dump` no marcó error de permisos, sospechar de RLS antes que de
   datos vacíos — verificar con:

   ```sql
   SELECT relname, relrowsecurity FROM pg_class
   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
   ```

3. Dump del esquema `public` completo (estructura + datos), nunca a un
   archivo dentro del repo (son datos reales de clientes — usar el
   scratchpad de la sesión, jamás versionarlos):

   ```bash
   pg_dump "<cadena_readonly>?sslmode=require" \
     --schema=public \
     --no-owner --no-privileges \
     --format=plain \
     --file=/ruta/scratchpad/dump_public.sql
   ```

4. Restaurar en el Postgres local. El dump trae su propio
   `CREATE SCHEMA public;`, así que hay que **eliminar** el `public` que ya
   existe por defecto en la base nueva antes de correrlo — **no recrearlo**,
   o el `CREATE SCHEMA` del dump chocará:

   ```bash
   psql "postgresql://micomercio:micomercio_local_dev@localhost:5433/micomercio_local" \
     -c "DROP SCHEMA public CASCADE;"

   psql "postgresql://micomercio:micomercio_local_dev@localhost:5433/micomercio_local" \
     -v ON_ERROR_STOP=1 \
     -f /ruta/scratchpad/dump_public.sql
   ```

5. Verificar que los conteos de filas por tabla coincidan entre origen y
   destino antes de dar por buena la restauración.

## Nota de versión: por qué Postgres 17, no 16

`pg_dump` genera sentencias `SET` con GUCs específicos de la versión del
servidor origen (ej. `transaction_timeout`, introducido en Postgres 17). Si
el contenedor local tiene una versión mayor menor a la de origen, la
restauración falla en las primeras líneas del dump. Regla general: la versión
mayor del contenedor local en `docker-compose.yml` debe igualar (o superar)
la versión mayor de producción — verificar con `pg_dump --version` /
el comentario `-- Dumped from database version X.Y` al inicio del dump antes
de restaurar.

## .env

`DATABASE_URL` en `.env` debe apuntar exclusivamente a:

```
postgresql://micomercio:micomercio_local_dev@localhost:5433/micomercio_local?schema=public
```

`.env` está en `.gitignore` — nunca se commitea. Antes de guardar cualquier
cambio a `.env`, mostrar el diff al usuario y esperar confirmación explícita.
