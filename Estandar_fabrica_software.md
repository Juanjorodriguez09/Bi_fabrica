# Estándar de la fábrica de software — checklist para aplicar a un proyecto nuevo

> Este documento es el "manual de instalación" del patrón validado en
> `Bi_fabrica` (`micomercio_bi_dashboard`). Complementa a
> `Roadmap_automatizacion_fabrica.md` (que cuenta *cómo se construyó y qué
> se probó*) y a `Contexto_fabrica_software.md` (decisiones de arquitectura
> generales). Este documento responde una sola pregunta: **¿qué hay que
> hacer, en orden, para prender este mismo flujo en otro repo?**

## 0. Qué resuelve esto, en una frase

Un humano abre un Issue con una plantilla fija → un plan estructurado se
genera y se comenta solo → el humano lo aprueba con `/aprobar` → el código
se escribe y el PR se abre solo → 3 subagentes revisan el PR solos y
comentan los hallazgos → si hay algo real y grave, se corrige solo (una
vez) → **el merge final sigue siendo, siempre, una decisión 100% manual**.

## 1. Qué se copia tal cual (sin editar nada)

**Corregido 2026-08-24, con evidencia real** (segundo proyecto,
`WebChat_Fabrica`) — esta tabla venía mal desde la primera versión: solo
esto es genuinamente genérico, sin ningún contenido específico de
`micomercio_bi_dashboard` adentro.

| Archivo | De dónde |
|---|---|
| `.github/ISSUE_TEMPLATE/solicitud-cambio.yml` | Este repo — pero revisar el campo `description:` del YAML antes de usarlo: la copia original traía hardcodeado "para micomercio_bi_dashboard" en el texto visible del formulario. Sin efecto funcional, pero se ve raro si no se corrige |
| `.github/workflows/generar-plan.yml` | Este repo |
| `.github/workflows/retroalimentar-plan.yml` | Este repo — faltaba en esta tabla en la versión anterior del documento, es igual de genérico que los otros tres workflows |
| `.github/workflows/disparar-routine.yml` | Este repo (ya parametrizado) |
| `.github/workflows/ajustar-pr.yml` | Este repo — agregado 2026-08-25, portado desde `WebChat_Fabrica`. 100% genérico (usa `${{ github.repository }}` en todo, sin nada hardcodeado). Cierra el gap de que `revisar-pr.yml` solo reacciona a eventos de PR (`opened`/`synchronize`), nunca a un comentario humano: un comentario que empieza con `/ajustar <texto libre>` en un PR abierto dispara la misma Routine `corregir-hallazgos-pr` (reutiliza `ROUTINE_CORREGIR_ID`/`FIX_PR_ROUTINE_API_TOKEN`, sin secrets nuevos) |
| `.github/workflows/continuar-plan-pausado.yml` | Este repo — agregado 2026-08-25, portado desde `WebChat_Fabrica`. 100% genérico. Complemento del mecanismo de "pausa y pregunta" de `implementar-plan-aprobado` (ver §3 paso 5): un comentario `/continuar <respuesta>` en un Issue con label `esperando-humano` puesta saca la label y vuelve a disparar la misma Routine `implementar-plan-aprobado`, que retoma la rama existente en vez de empezar de cero |
| `.claude/skills/estandares-seguridad-fabrica/SKILL.md` | Este repo — genérico a propósito, no menciona nada de este dashboard. Cada proyecto nuevo lo interpreta una vez en su propio skill de calidad (marcando aplica/no aplica/gap por punto), como se hizo acá en `modelo-calidad-iso25010` §6 |

## 1.1 Se copia, pero con referencias puntuales para ajustar

| Archivo | Qué hay que cambiar |
|---|---|
| `.github/workflows/revisar-pr.yml` | El prompt hardcodea el nombre del subagente de dominio (`validador-metricas`) y el nombre del doc técnico (`DOCUMENTACION_TECNICA.md`). Si el proyecto nuevo no tiene subagente de dominio, hay que quitar esa invocación del prompt (no solo omitir el archivo del subagente); si su doc técnico se llama distinto (o es simplemente `README.md`, como en `WebChat_Fabrica`), hay que cambiar esa referencia también. Son 2-3 líneas puntuales, no una reescritura — pero si no se tocan, el subagente `documentador` va a buscar un archivo que no existe |

## 2. Qué hay que adaptar o escribir a medida

- **`CLAUDE.md` del proyecto destino** — no se copia, tiene que existir y
  estar al día *antes* de prender la fábrica. Los subagentes genéricos
  (`planificador`, `revisor-codigo`, `documentador`) dependen de leerlo
  para conocer las convenciones reales del proyecto. Sin esto, la calidad
  del plan y de la revisión baja mucho.
- **Los 4 subagentes de `.claude/agents/` (`planificador`, `revisor-codigo`,
  `documentador`, `tester`) — CORRECCIÓN IMPORTANTE (2026-08-24): no son
  copia tal cual, nunca lo fueron.** La versión anterior de este documento
  los tenía mal clasificados en §1. Se leyeron completos al armar
  `WebChat_Fabrica` y están escritos al 100% para el stack de
  `micomercio_bi_dashboard` (Prisma, Postgres, `siteId`,
  `DOCUMENTACION_TECNICA.md`, `dashboard.service.js`) — ninguno de esos
  conceptos existe en un proyecto con otro stack. Lo que sí es reutilizable
  es la **estructura**: el formato de salida de cada uno, la sección "Qué
  NO hacer", y el rol de cada subagente en el pipeline. Al prender la
  fábrica en un proyecto nuevo, usar los cuatro archivos de acá como
  **plantilla de forma**, y reescribir el contenido (ejemplos, checks
  específicos, convenciones referenciadas) para el proyecto destino —
  igual de qué se hace con `CLAUDE.md`, no como una copia de archivo.
- **Un subagente de dominio, si aplica** (`validador-metricas` en este
  repo) — es específico de este dashboard, no se reutiliza tal cual. Cada
  proyecto decide si necesita el suyo (para lógica de negocio/cálculos
  particulares) o si lo omite directamente del prompt de `revisar-pr.yml`
  (ver §1.1 — si se omite, hay que editar el prompt, no alcanza con no
  crear el archivo).
- **`.claude/skills/<nombre>/SKILL.md` — el skill de calidad propio del
  proyecto (aquí `modelo-calidad-iso25010`) — PASO OBLIGATORIO, no
  opcional (corregido 2026-08-27: en `WebChat_Fabrica` este paso se saltó
  al armar el proyecto, porque antes solo estaba mencionado de pasada en
  la nota de §1, no como ítem propio de este checklist — ya corregido ahí
  y en este documento).** Interpreta las 8 características de ISO/IEC
  25010 para el stack real del proyecto (no la definición genérica de la
  norma), incluyendo una sección de Seguridad que traduce los 20 puntos de
  `estandares-seguridad-fabrica` (aplica/no aplica/gap, con justificación)
  a ese proyecto concreto. Lo usan `revisor-codigo` (como estructura del
  reporte) y `planificador` (en la sección "Impacto y riesgos"). Usar el
  de este repo como plantilla de forma, no de contenido — el stack real
  cambia todas las interpretaciones.

## 3. Checklist de configuración (una sola vez por proyecto)

En orden — cada paso depende del anterior:

1. **Instalar la GitHub App "Claude Code"** (`github.com/apps/claude`) con
   scope solo al repo nuevo — no "All repositories". Sin esto, la action
   no puede comentar aunque el token esté bien.
2. **Crear las labels `solicitud` y `esperando-humano`** en el repo,
   manualmente (Settings → Labels). Los formularios de Issue *no* crean
   `solicitud` solos aunque el YAML la declare — es un gotcha ya
   confirmado, ver `[[feedback_gotchas_tecnicos_fabrica]]`.
   `esperando-humano` la usa el mecanismo de "pausa y pregunta" (ver paso
   5) — sin ella creada, `gh issue edit --add-label` falla.
3. **Configurar el secret `CLAUDE_CODE_OAUTH_TOKEN`** (Settings → Secrets
   and variables → Actions → Secrets) — se genera con `claude setup-token`,
   consume cuota de suscripción Pro/Max, no facturación por token. Expira
   al año, la renovación es manual.
4. **Crear un environment CCR** para el proyecto (vía `claude.ai/code` o el
   flujo de creación de Routines) — cada proyecto tiene el suyo, no se
   comparte entre repos.
5. **Crear las dos Routines genéricas**, apuntando al repo y al
   environment de este proyecto nuevo:
   - `implementar-plan-aprobado` — mismo prompt que la de este repo (lee
     el número de Issue del payload, busca el plan en los comentarios, lo
     implementa, abre PR, nunca mergea). **Incluye el mecanismo de "pausa
     y pregunta" agregado 2026-08-25** (paso 0 y 3/3.5 del prompt actual):
     si aparece una decisión real, no prevista ni en el plan ni en sus
     "Preguntas abiertas", que cambia comportamiento o alcance de forma no
     trivial, la Routine comenta la pregunta en el Issue, agrega la label
     `esperando-humano`, pushea el trabajo parcial y termina el turno sin
     abrir PR — en vez de resolverla sola. Al recibir un `/continuar` (vía
     `continuar-plan-pausado.yml`), retoma la misma rama existente en vez
     de empezar de cero. Validado en vivo de punta a punta en
     `WebChat_Fabrica` con una prueba deliberada (Issue #7 → pausa → PR
     #8).
   - `corregir-hallazgos-pr` — mismo prompt que la de este repo, **con la
     distinción de dos disparadores agregada 2026-08-25** (ver el prompt
     actual de esta Routine, no solo este resumen): además del disparo
     automático post-revisión (busca hallazgos en el comentario
     consolidado, se detiene si no hay), ahora también atiende el disparo
     MANUAL de `ajustar-pr.yml` — si el payload dice "tiene un ajuste
     pedido por un humano: <texto>", aplica ese texto tal cual, sin buscar
     hallazgos de revisión. Sin este agregado, `/ajustar` en el proyecto
     nuevo dispara la Routine pero esta se frena sola sin hacer nada.
   - Para cada una: "Add an API trigger" en la UI de la Routine, guardar el
     token (`sk-ant-oat01-...`, se muestra una sola vez).
6. **Guardar los secrets de disparo**: `ROUTINE_API_TOKEN` (token de
   `implementar-plan-aprobado`) y `FIX_PR_ROUTINE_API_TOKEN` (token de
   `corregir-hallazgos-pr`), como secrets del repo.
7. **Guardar las variables de repo** (Settings → Secrets and variables →
   Actions → pestaña **Variables**, no Secrets — los `trigger_id` no son
   sensibles): `ROUTINE_IMPLEMENTAR_ID` y `ROUTINE_CORREGIR_ID`, con el ID
   de cada Routine creada en el paso 5.
8. **Probar con un Issue real de bajo riesgo** (un cambio chico y
   reversible) antes de confiar el flujo a un cambio importante — es lo
   que se hizo acá con el tooltip de "Rebote" después de parametrizar los
   workflows.
9. **Conectar el repo nuevo al agente PM diario** (agregado 2026-08-31,
   ver `[[project_bi_fabrica_estado]]`) — el reporte diario de estado de
   la fábrica (`Juanjorodriguez09/fabrica-status`, Routine
   `reporte-diario-fabrica`) no descubre repos nuevos solo. Es un paso
   manual en dos partes, y las dos son obligatorias o el repo nuevo queda
   invisible en el reporte sin ningún error que lo avise:
   - **Conectar el repo como fuente adicional de la Routine**: en la
     rutina `reporte-diario-fabrica` (editar), agregar el repo nuevo con
     el botón `+` al lado de los repos ya conectados. Esto es un límite de
     seguridad de la plataforma, no configurable de otro modo: una sesión
     en la nube solo puede llamar a la API de GitHub de los repos que
     tiene explícitamente conectados, sin importar qué token se le pase
     por variable de entorno — confirmado en vivo el 2026-08-31 cuando el
     primer intento con `Bi_fabrica`/`WebChat_Fabrica` sin conectar dio
     `403` pese a que el token (`GH_TOKEN_FABRICA`) era válido.
   - **Agregar el repo a la lista fija dentro de**
     `.claude/agents/pm-diario.md` **(en el repo `fabrica-status`)** —
     el subagente no descubre repos dinámicamente, tiene la lista
     hardcodeada a propósito (ver el archivo).
   Si alguno de los dos pasos se salta, el síntoma es distinto: sin
   conectar el repo a la Routine, el reporte lo intenta leer y falla con
   `403` (visible, avisa); sin agregarlo a la lista de `pm-diario.md`, el
   reporte simplemente no lo menciona (silencioso, no avisa) — por eso el
   orden de este ítem no importa, pero hacer los dos sí.

## 3.1 Si el proyecto nuevo está en otra cuenta/organización de GitHub

El checklist de arriba es el mismo, sin ningún paso extra — nada en él
asume que el repo está en esta cuenta (`Juanjorodriguez09`). Tres cosas
para tener claras antes de asumir que "simplemente funciona":

- **Los secrets y variables de un repo nunca se copian solos a otro repo**,
  ni siquiera si es la misma persona dueña de ambos — es una regla de
  GitHub, no de la fábrica (ya se confirmó esto mismo con
  `deploy-main.yml` al clonar este repo, ver
  `[[feedback_gotchas_tecnicos_fabrica]]`). Cada repo nuevo necesita sus
  propios secrets/variables creados a mano (pasos 3, 6, 7).
- **`CLAUDE_CODE_OAUTH_TOKEN` no depende de la cuenta de GitHub** — es un
  token de la cuenta/suscripción de Claude Code, no de GitHub. Si el
  proyecto nuevo lo maneja la misma persona con la misma suscripción,
  técnicamente se puede reutilizar el mismo valor de token como secret en
  el repo nuevo, sin generar uno distinto (aunque generar uno nuevo por
  proyecto también es válido y más fácil de rotar/revocar por separado).
- **El `environment_id` y las Routines si están atados a un repo
  específico** (`session_context.sources.git_repository.url`) — no se
  "mueven" a otra cuenta, se crean de cero apuntando al repo nuevo. El
  checklist ya lo dice como "crear las Routines" (paso 5), no como
  "reusar" — por diseño, esto ya cubre el caso de cambiar de cuenta igual
  que el caso de un repo nuevo en la misma cuenta, sin diferencia.

**Importante — esto está razonado y confirmado por inspección del código,
no probado en vivo todavía con una cuenta de GitHub distinta.** La única
prueba real que existe hoy es "proyecto nuevo, misma cuenta" (este mismo
repo, cuando se creó). Antes de decir con total seguridad "cambiar de
cuenta no rompe nada", falta ejecutar el checklist una vez de punta a
punta en una cuenta distinta — ver §5 y el pendiente en
`Roadmap_automatizacion_fabrica.md` §6.2.

## 4. Qué NO es parte de este estándar (a propósito)

- **El deploy a servidor** (`deploy-main.yml` en este repo) — cada
  proyecto tiene su propio destino de despliegue o ninguno; no es parte
  del patrón de la fábrica, es infraestructura aparte de cada proyecto.
- **El merge a `main`** — siempre manual, en todos los proyectos, sin
  excepción. No hay ninguna configuración que lo automatice.
- **Notificación de estado por proyecto individual** (ej. avisar en cada
  repo cuando algo se traba) — no existe, y no hace falta: el agente PM
  diario (§7) ya cubre esta necesidad de forma centralizada, cruzando
  todos los proyectos en un solo reporte en vez de un mecanismo por repo.

## 5. Evidencia de que esto ya se validó dos veces en el mismo repo

No es solo diseño — el ciclo completo corrió de punta a punta, sin
operación manual intermedia entre `/aprobar` y el PR revisado, en dos
oportunidades reales: Issue #8 → PR #9 (2026-08-13) e Issue #14 → PR #15
(2026-08-18, después de parametrizar los workflows). El segundo caso
confirma además que la parametrización de este documento no cambia el
comportamiento — es la misma fábrica, solo que ahora configurable por
proyecto sin tocar código.

## 6. Segundo proyecto en curso — lo que ya corrigió este documento

`WebChat_Fabrica` (copia independiente de `webmicomercio`, un widget de
chat React/Vite sin base de datos propia) es la primera prueba real del
checklist completo, arrancada el 2026-08-24. Ya en el primer intento
aparecieron 3 hallazgos reales, todos ya corregidos en este documento
(§1, §1.1, §2): la tabla de "copia tal cual" tenía un workflow faltante
(`retroalimentar-plan.yml`), clasificaba mal los 4 subagentes genéricos
(no son copia tal cual), y no advertía que `revisar-pr.yml` necesita
ajustes puntuales. Es exactamente la razón de ser de probarlo en un
proyecto real antes de darlo por confirmado — encontrar esto documentando
en abstracto habría sido mucho más difícil.

**Confirmado en vivo, 2026-08-25** — los 8 pasos de configuración se
completaron en `WebChat_Fabrica` y el ciclo corrió de punta a punta con
Issues reales, dos veces (Issue #3→PR#4, Issue #5/#6→PR#6), ambos
mergeados. El estándar queda validado en un segundo proyecto, no solo en
el original. Un cuarto hallazgo se sumó en el camino, ya corregido acá y
en `[[feedback_gotchas_tecnicos_fabrica]]`: la ausencia total de un
mecanismo para que un humano pida un ajuste sobre un PR ya abierto, antes
de mergear, sin salir del flujo de comentarios — se cerró con
`ajustar-pr.yml` (§1) y la actualización de `corregir-hallazgos-pr` (§3,
paso 5), y ya se portó también a este repo.

**Mecanismo de "pausa y pregunta" construido y validado, 2026-08-25** —
`continuar-plan-pausado.yml` (§1) más la actualización de
`implementar-plan-aprobado` (§3, paso 5). En el camino apareció un quinto
hallazgo: las Routines postean sus comentarios de estado usando la sesión
del usuario humano, no una identidad de bot — `retroalimentar-plan.yml`
las tomaba por feedback humano real y disparaba una replanificación
innecesaria (dos veces, en esta misma prueba). Corregido excluyendo por la
firma fija de Claude Code y por el comando `/continuar` — detalle completo
en `[[feedback_gotchas_tecnicos_fabrica]]`. **Corregido en los dos repos
existentes, no solo documentado acá** — es un fix del mecanismo genérico,
no algo específico de un proyecto (criterio explícito: ver
`[[feedback_estandarizar_vs_a_medida]]`).

## 7. Agente PM diario — una sola vez para toda la fábrica, no por proyecto

A diferencia de §1-§6 (que se repiten por cada proyecto nuevo), esto se
configura **una vez** y después cubre todos los proyectos a la vez.
Genera un reporte diario del estado de todos los repos de la fábrica
(Issues pendientes de aprobar, PRs pendientes de revisión/merge, ítems
pausados esperando una decisión humana), publicado en GitHub y por
Telegram. Confirmado en vivo el 2026-08-31.

### 7.1 Qué se crea

- **Un repo hub nuevo y dedicado** (acá: `Juanjorodriguez09/fabrica-status`)
  — no vive dentro de ningún proyecto real. Solo contiene
  `.claude/agents/pm-diario.md` (el subagente que arma el reporte) y un
  `CLAUDE.md` mínimo.
- **Un Issue fijo** en ese repo (acá `#1`, "📋 Estado diario de la
  fábrica") — ahí se comenta cada corrida, queda como historial.
- **Dos Personal Access Tokens (fine-grained) de mínimo privilegio** — no
  uno solo, porque un fine-grained PAT no puede tener permisos distintos
  por repo dentro de un mismo token:
  - **Solo lectura** (`Issues`, `Pull requests`, `Metadata` — todo en
    "Read-only") con acceso a los repos de proyecto de la fábrica
    (`Bi_fabrica`, `WebChat_Fabrica`, y cualquiera que se sume — ver 7.3).
  - **Lectura y escritura** (`Issues: Read and write`) con acceso SOLO al
    repo hub (`fabrica-status`).
  - Los dos con expiración de 1 año, nunca "sin expiración".
- **Credenciales de Telegram**: el token del bot ya usado para crear
  Issues (recuperable en cualquier momento vía BotFather → `/mybots` →
  elegir el bot → "API Token", sin necesidad de regenerarlo) y el
  `chat_id` del destinatario (se obtiene revisando las ejecuciones del
  workflow de n8n que ya escucha ese bot, o con `getUpdates` si el bot no
  tiene webhook activo).
- **Un Cloud Environment** (acá `fabrica-status-env`) vinculado al repo
  hub, con:
  - Acceso a la red: **Completo** (necesita salir a `api.telegram.org`,
    no solo a GitHub).
  - Variables de entorno (no hay una sección separada de "secrets" en
    esta versión de la plataforma — la única advertencia real es que son
    visibles a cualquiera que use el entorno; en cuenta individual sin
    otros usuarios no es un problema, revisar de nuevo si esto se muda a
    una organización con más gente):
    ```
    GH_TOKEN_FABRICA=<el PAT de solo lectura>
    GH_TOKEN_STATUS=<el PAT de lectura/escritura>
    TELEGRAM_BOT_TOKEN=<token del bot>
    TELEGRAM_CHAT_ID=<chat_id del destinatario>
    ISSUE_ESTADO_DIARIO=<número del Issue fijo, ej. 1>
    ```
  - Script de configuración — instala `gh`, que no viene preinstalado en
    el entorno y el subagente lo necesita para respetar la separación de
    los dos tokens (sin esto, el agente puede terminar usando un
    conector MCP de GitHub con un alcance de acceso distinto al
    diseñado, sin que se note a simple vista):
    ```bash
    if ! command -v gh >/dev/null 2>&1; then
      type -p curl >/dev/null && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
      sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
      sudo apt update && sudo apt install gh -y
    fi
    ```
- **Una Routine** (acá `reporte-diario-fabrica`) apuntando al repo hub y
  a ese entorno, con:
  - Activador de **horario** (Schedule), no "Vía API" — diario, hora fija
    (acá 8:00 AM, zona Bogotá/GMT-5).
  - Repos conectados: el repo hub más **cada repo de proyecto que el
    reporte debe leer** (ver el gotcha de plataforma en 7.3 — esto es
    obligatorio, no opcional).
  - Instrucciones:
    ```
    Ejecutá de forma síncrona (no delegues a un subagente en background) las
    instrucciones de .claude/agents/pm-diario.md en este mismo repo. Generá
    el reporte diario de estado de la fábrica y publicalo en los dos canales
    indicados ahí: el Issue fijo de este repo y Telegram.
    ```

### 7.2 Cómo clasifica y publica el reporte

El subagente `pm-diario.md` no tiene una lista fija de repos —
la descubre en cada corrida con
`GH_TOKEN="$GH_TOKEN_FABRICA" gh repo list <owner> --json nameWithOwner`,
así que agregar un repo nuevo no implica editar este archivo (ver 7.3
para lo que sí hay que tocar). Para cada Issue/PR abierto de cada repo
devuelto, lo ubica en una de 5 categorías por prioridad — Pausado
esperando decisión humana / PR esperando revisión o merge / Pendiente de
aprobar / Recién abierto sin plan / Estancado — más una sección de
"Completado ayer". Publica siempre en los dos canales (Issue fijo +
Telegram), incluso si algo falló, dejando el error explícito en vez de
omitir en silencio. Nunca comenta en los repos de proyecto, solo lee de
ahí.

### 7.3 Sumar un proyecto nuevo al reporte — 2 pasos obligatorios, no 1

Este es el mismo ítem que §3 paso 9, repetido acá porque es fácil
olvidarlo si solo se mira este documento desde la perspectiva de "un
proyecto nuevo":

1. **Agregar el repo al scope del PAT `GH_TOKEN_FABRICA`** (GitHub →
   Settings → Developer settings → fine-grained tokens → editar el
   token → agregar el repo).
2. **Conectar el repo como fuente adicional de la Routine
   `reporte-diario-fabrica`** (editar la Routine → botón `+` junto a los
   repos ya conectados).

El paso 2 no es opcional aunque el paso 1 ya se haya hecho: **una sesión
de Routine en la nube solo puede llamar a la API de GitHub de los repos
explícitamente conectados a ELLA, sin importar qué acceso tenga el
token** — confirmado en vivo el 2026-08-31 (`403` con un token válido,
hasta conectar el repo). Sin el paso 2, el reporte falla con un error
visible para ese repo. Sin el paso 1, el repo directamente no aparece en
la lista que descubre `gh repo list` — ninguna de las dos fallas es
silenciosa siempre que `pm-diario.md` esté configurado como se documenta
en 7.1 (reportar cualquier error explícito, nunca omitir en silencio).

### 7.4 Gotcha de plataforma — GraphQL bloqueado en la sesión de la Routine

Confirmado en vivo el 2026-09-02: esta sesión rechaza casi todo GraphQL
("This GraphQL query is not enabled for this session — only the pinned
set of PR-review operations is served"). `gh repo list`, `gh issue list`
y `gh pr list` usan GraphQL por dentro y **fallan siempre en esta
sesión**, no solo con determinados campos — `pm-diario.md` ya está
reescrito para usar exclusivamente `gh api` (REST puro) en todo:
descubrimiento de repos (`gh api user/repos`), listado de issues/PRs
(`gh api repos/<owner>/<repo>/issues` y `.../pulls`), comentarios y
reviews. Si se escribe un subagente nuevo que necesite listar
issues/PRs desde una Routine, aplicar el mismo criterio desde el
principio en vez de descubrirlo por prueba y error otra vez.

### 7.5 Validado en vivo

- 2026-08-31: primera corrida real, con datos de los dos repos de
  proyecto (encontró el bug de la fecha fija y el uso del conector MCP en
  vez de `gh` — ambos ya corregidos).
- 2026-09-02: corrida posterior al fix de `gh` — usó los tokens
  correctos vía `gh` (no MCP) y la fecha se calculó bien; encontró el
  bloqueo de GraphQL de 7.4, ya corregido en el subagente.
- Pendiente: una corrida más después del fix de GraphQL (REST puro) para
  confirmar que el reporte sale limpio, sin ningún error en la sección
  final.
