---
name: estandares-seguridad-fabrica
description: Checklist de seguridad genérico de la fábrica de software — 20 puntos que aplican a cualquier proyecto, independientemente del stack. No está adaptado a ningún repo específico; cada proyecto lo interpreta en su propio skill de calidad (ver modelo-calidad-iso25010 en este repo como ejemplo de esa interpretación). Úsalo como referencia al planificar (impacto/riesgos) y al revisar código.
---

# Estándar de seguridad de la fábrica (genérico, reutilizable entre proyectos)

Estos 20 puntos son el piso mínimo de seguridad que cualquier proyecto de
la fábrica debe evaluar — no todos aplican a todos los stacks (un proyecto
sin autenticación propia no "hashea contraseñas" porque no las maneja),
pero **todos deben evaluarse explícitamente como aplica/no aplica/gap
encontrado**, nunca omitirse en silencio. Un ítem marcado "no aplica" sin
explicar por qué es indistinguible de un ítem que nadie revisó.

Este documento es intencionalmente genérico — no menciona ningún repo
concreto. Cada proyecto que entre a la fábrica copia este archivo tal cual
(ver `Estandar_fabrica_software.md`) y lo interpreta en su propio skill de
calidad, igual que ya se hizo acá con ISO/IEC 25010.

## Los 20 puntos

1. **Oculta las claves API.** Ninguna clave, token o secreto vive
   hardcodeado en el código fuente — siempre por variable de entorno, nunca
   en un valor por defecto ni en un comentario "para probar".
2. **Elimina secretos de Git.** Ningún `.env`, clave privada o token queda
   commiteado, ni siquiera en el historial. Si algo así se filtró alguna
   vez, rotar la credencial es obligatorio — quitarlo del working tree no
   alcanza, sigue en el historial.
3. **Usa una clave con privilegio mínimo para acceso a la base de datos.**
   Si el proyecto usa una plataforma con claves diferenciadas (ej. Supabase
   anon key vs. service role key), la app nunca usa la clave de máximo
   privilegio desde código expuesto al cliente. Si el proyecto accede a
   Postgres directo (sin esa capa), el rol de conexión de la app tiene solo
   los permisos que necesita, no de superusuario.
4. **Activa Row Level Security (RLS) o el control de acceso a nivel de fila
   equivalente**, si la plataforma de base de datos lo ofrece y hay datos
   multi-tenant o multi-usuario. Si el acceso es exclusivamente vía backend
   propio con su propio filtro explícito (no vía la capa de la plataforma),
   documentar por qué RLS no aplica y cuál es el mecanismo que cumple el
   mismo rol.
5. **Cifra datos sensibles.** PII, credenciales, datos de pago o cualquier
   dato cuya fuga tenga consecuencia legal/reputacional real va cifrado en
   reposo o, como mínimo, evaluado explícitamente si necesita estarlo — no
   asumir que "no es sensible" sin revisar qué campos existen.
6. **Fuerza autenticación del lado del servidor.** Ninguna autorización se
   decide solo en el cliente (frontend) — el servidor vuelve a validar
   quién es el usuario y qué puede hacer, incluso si el frontend ya
   "ocultó" una opción.
7. **Restringe el acceso a registros según a quién pertenecen.** Cualquier
   consulta que devuelva datos de un usuario/cliente/tenant filtra
   explícitamente por su identificador — nunca devuelve todo y confía en
   que el frontend filtre.
8. **Bloquea la manipulación de campos no autorizados (mass assignment).**
   Un endpoint que recibe un objeto del cliente y lo pasa directo a una
   escritura de base de datos sin una lista explícita de campos permitidos
   es un hallazgo — un campo inesperado (`role`, `isAdmin`, `siteId` ajeno)
   no debe poder colarse.
9. **Protege las cookies de sesión.** Si el proyecto maneja sesión propia,
   las cookies llevan `HttpOnly`, `Secure` y `SameSite` apropiados — nunca
   accesibles desde JavaScript del lado del cliente.
10. **Hashea contraseñas.** Nunca en texto plano ni con hash reversible —
    algoritmo diseñado para contraseñas (bcrypt/argon2/scrypt), nunca
    MD5/SHA genérico sin salt.
11. **Limita intentos de inicio de sesión.** Rate limiting específico sobre
    el endpoint de login/autenticación, para frenar fuerza bruta —
    independiente del rate limiting general de la API.
12. **Añade protección contra bots** en formularios o endpoints públicos
    sensibles a abuso automatizado (captcha, honeypot, o verificación
    equivalente), cuando el endpoint es alcanzable sin autenticación.
13. **Monitorea las consultas a la base de datos.** Alguna forma de
    logging/observabilidad sobre queries lentas o anómalas — no
    necesariamente una herramienta cara, pero sí algo más que "nos
    enteramos cuando un cliente se queja".
14. **Valida todas las entradas.** Todo dato que entra por body, query
    params o headers se valida por tipo/formato/rango antes de usarse —
    nunca se asume que el cliente mandó lo esperado.
15. **Escapa el contenido generado por el usuario** antes de insertarlo en
    HTML (XSS) o en cualquier salida que se interprete (SQL, shell,
    templates). Es el ítem con más historial real de fallar por omisión
    silenciosa — un desarrollador (humano o IA) agrega una feature nueva
    copiando un patrón parecido pero se olvida del escape, y nada lo avisa
    hasta que alguien lo prueba con el input equivocado.
16. **Restringe la subida de archivos** — tipo MIME validado (no solo por
    extensión), tamaño máximo, y almacenamiento fuera de rutas ejecutables
    del servidor.
17. **Limita las respuestas de la API** — paginación obligatoria en
    endpoints que pueden devolver colecciones grandes, y rate limiting
    general para evitar que un cliente (malicioso o mal configurado) sature
    el servicio.
18. **Añade cabeceras de seguridad HTTP** (`Content-Security-Policy`,
    `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`,
    `Strict-Transport-Security` cuando aplica) — no dejarlas en los
    valores por defecto del framework sin revisar.
19. **Fuerza HTTPS.** Ninguna comunicación sensible viaja sin cifrar —
    verificar tanto a nivel de la app como del proxy/balanceador que
    termina la conexión.
20. **Escanea dependencias.** Alguna forma de detectar vulnerabilidades
    conocidas en paquetes de terceros (`npm audit`, Dependabot, o
    equivalente) — no basta con "lo instalamos una vez y ya".

## Cómo se usa esto en el flujo de la fábrica

- **Al planificar** (`planificador`): recorrer los 20 puntos contra el
  cambio solicitado — ¿el pedido toca alguno de estos aspectos? Si sí,
  decirlo explícitamente en la sección de impacto/riesgos del plan, no
  dejarlo implícito.
- **Al revisar** (`revisor-codigo`): cualquier hallazgo de seguridad debe
  poder ubicarse en uno de estos 20 puntos (o en la característica
  "Seguridad" del modelo de calidad del proyecto, si existe una
  interpretación más específica).
- **Por proyecto:** cada repo interpreta esta lista una vez, en su propio
  skill de calidad (marcando aplica/no aplica/gap encontrado con
  justificación), para no repetir el análisis genérico en cada plan o
  revisión individual — el análisis puntual solo verifica si el cambio
  concreto afecta algo ya marcado, o si descubre un gap nuevo no
  documentado todavía.
