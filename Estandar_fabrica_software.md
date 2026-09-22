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

## 0.1 Regla de arquitectura: qué es central y qué es por-proyecto (sin excepciones)

Esta regla aplica a **todo proyecto nuevo, sin excepción** — no es una
preferencia caso por caso, es la arquitectura de la fábrica:

**Centralizados — un solo agente para toda la fábrica, viven en el repo
hub `fabrica-status`, nunca se duplican por proyecto:**
- **`pm-diario`** (§7) — recorre todos los proyectos él mismo, no
  tendría sentido uno por repo.
- **`coordinador`** (§8) — clona el repo del Issue que le toca revisar
  al vuelo; un Coordinador por repo se probó y se descartó
  explícitamente a favor de este diseño central (ver §8.2).

**Por proyecto — viven en `.claude/agents/` de cada repo, se
reescriben siempre, nunca se copian ni se comparten entre proyectos:**
`planificador`, `revisor-codigo`, `documentador`, `tester`, `asesor`
(ver §2). La razón: necesitan conocimiento real del stack/código de
ese proyecto específico para ser útiles — un agente genérico sin ese
contexto solo puede producir generalidades, no un plan o una revisión
de verdad accionable.

**Regla práctica para cuando se diseñe una pieza nueva** (agente,
workflow, lo que sea): evaluar primero si puede ser central (un solo
lugar, todos los proyectos) — solo va por-proyecto si de verdad
necesita conocimiento profundo y específico del código de ese
proyecto para funcionar bien.

## 1. Qué se copia tal cual (sin editar nada)

**Corregido 2026-08-24, con evidencia real** (segundo proyecto,
`WebChat_Fabrica`) — esta tabla venía mal desde la primera versión: solo
esto es genuinamente genérico, sin ningún contenido específico de
`micomercio_bi_dashboard` adentro.

| Archivo | De dónde |
|---|---|
| `.github/ISSUE_TEMPLATE/solicitud-cambio.yml` | Este repo — pero revisar el campo `description:` del YAML antes de usarlo: la copia original traía hardcodeado "para micomercio_bi_dashboard" en el texto visible del formulario. Sin efecto funcional, pero se ve raro si no se corrige |
| `.github/workflows/generar-plan.yml` | Este repo — **corregido 2026-09-10**: no revisaba la label `solicitud` antes de disparar el planificador, a diferencia de `retroalimentar-plan.yml` y `disparar-routine.yml`, que sí lo hacían desde siempre. No se notaba mientras solo existía un tipo de Issue (todos traían `solicitud` por la única plantilla que había) — quedó expuesto en vivo al agregar `consulta-asesoria.yml`: un Issue de consulta disparaba el planificador completo además del `asesor`. Fix: mismo patrón de chequeo de label (`jq` sobre `$GITHUB_EVENT_PATH`) que ya usaban los otros dos workflows. Corregido en los dos repos existentes y en esta plantilla — ver `[[feedback_estandarizar_vs_a_medida]]` |
| `.github/workflows/retroalimentar-plan.yml` | Este repo — faltaba en esta tabla en la versión anterior del documento, es igual de genérico que los otros tres workflows |
| `.github/workflows/disparar-routine.yml` | Este repo (ya parametrizado) |
| `.github/workflows/ajustar-pr.yml` | Este repo — agregado 2026-08-25, portado desde `WebChat_Fabrica`. 100% genérico (usa `${{ github.repository }}` en todo, sin nada hardcodeado). Cierra el gap de que `revisar-pr.yml` solo reacciona a eventos de PR (`opened`/`synchronize`), nunca a un comentario humano: un comentario que empieza con `/ajustar <texto libre>` en un PR abierto dispara la misma Routine `corregir-hallazgos-pr` (reutiliza `ROUTINE_CORREGIR_ID`/`FIX_PR_ROUTINE_API_TOKEN`, sin secrets nuevos) |
| `.github/workflows/continuar-plan-pausado.yml` | Este repo — agregado 2026-08-25, portado desde `WebChat_Fabrica`. 100% genérico. Complemento del mecanismo de "pausa y pregunta" de `implementar-plan-aprobado` (ver §3 paso 5): un comentario `/continuar <respuesta>` en un Issue con label `esperando-humano` puesta saca la label y vuelve a disparar la misma Routine `implementar-plan-aprobado`, que retoma la rama existente en vez de empezar de cero |
| `.claude/skills/estandares-seguridad-fabrica/SKILL.md` | Este repo — genérico a propósito, no menciona nada de este dashboard. Cada proyecto nuevo lo interpreta una vez en su propio skill de calidad (marcando aplica/no aplica/gap por punto), como se hizo acá en `modelo-calidad-iso25010` §6 |
| `.github/ISSUE_TEMPLATE/consulta-asesoria.yml` | Este repo — agregado 2026-09-07, a pedido del jefe del usuario. 100% genérico. Segundo tipo de Issue, distinto de "Solicitud de cambio": para pedidos de asesoría/recomendación que NO implican tocar código (label `consulta`, no `solicitud`) |
| `.github/workflows/generar-asesoria.yml` | Este repo — agregado 2026-09-07, **corregido 2026-09-10**. 100% genérico. Dispara al subagente `asesor` (ver §2) cuando se abre un Issue con la label `consulta` — respuesta única con análisis/recomendación, sin plan de desarrollo ni PR, sin ciclo de `/aprobar`. La advertencia de "invocá al subagente de forma síncrona" quedó más débil que la de `generar-plan.yml` al escribirla — sin la frase "NO existe un más tarde" ni el ejemplo concreto de la falla — y el subagente terminó lanzándose en background en vivo (Issue creado vía Telegram: el turno dijo "voy a esperar su respuesta" y el job se completó sin publicar nada, `subagent_stats: started_in_background: 1, completed: 0`). Igualada a la redacción de `generar-plan.yml`, que no tuvo esta falla en ninguna de las pruebas de esta sesión |
| `.github/workflows/deploy-cpanel.yml` | Este repo — agregado 2026-09-17, **para proyectos con backend Node.js**. 100% parametrizado (variables/secrets de repo, nada hardcodeado). `push` a `main` despliega a dev, `push` a `pre` despliega a preprod — nunca mergea nada, solo actúa después de un merge ya hecho a mano. Ver §10 para la variante de proyectos estáticos (sin backend) y el detalle completo de por qué está diseñado así |

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
- **Los 5 subagentes de `.claude/agents/` (`planificador`, `revisor-codigo`,
  `documentador`, `tester`, `asesor`) — CORRECCIÓN IMPORTANTE (2026-08-24): no son
  copia tal cual, nunca lo fueron.** (`asesor` se sumó 2026-09-07, ver más
  abajo, con el mismo criterio que los otros 4.) La versión anterior de este documento
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
  **Regla de `planificador` que sí es estándar en todos los proyectos,
  no a medida (agregada 2026-09-07, a pedido del jefe del usuario):** el
  plan debe ser proporcional al tamaño real del pedido. La investigación
  (checklist de seguridad, análisis de impacto) siempre se hace completa,
  sin excepción — lo que se acorta es cuánto se escribe sobre lo que no
  encontró nada relevante. Un pedido chico (1 archivo, cambio
  visual/texto/config, sin lógica de negocio ni acceso a datos nuevo)
  tiene cada sección del plan en 1-3 líneas; un pedido grande (nuevo
  endpoint, modelo de datos, lógica de negocio, o cualquier punto real
  de seguridad que aplique) mantiene el detalle completo de siempre. Ya
  aplicado en `Bi_fabrica` y `WebChat_Fabrica` — cualquier `planificador`
  nuevo debe incluir esta misma sección, con el mismo criterio de corte.
- **`asesor` (agregado 2026-09-07, a pedido del jefe del usuario)** —
  subagente nuevo, de **solo lectura** (`tools: Read, Grep, Glob`, sin
  Write/Edit/Bash), que responde Issues con la label `consulta` (plantilla
  `consulta-asesoria.yml`): recomendaciones, evaluaciones o explicaciones
  que NO implican escribir código. Nunca genera un plan de desarrollo ni
  abre PR — si su conclusión es que hace falta un cambio real, lo dice
  como recomendación final ("abrí una Solicitud de cambio para...") y
  ahí termina su trabajo. Igual que los otros 4, se reescribe por
  proyecto (contexto/stack real), pero la estructura (Respuesta corta /
  Análisis / Consideraciones de seguridad / Próximos pasos) es estándar.
- **Labels de esfuerzo `esfuerzo-chico`/`esfuerzo-grande` (agregado
  2026-09-07)** — no es un subagente nuevo, es un paso agregado a
  `generar-plan.yml`: después de publicar el comentario del plan, el
  mismo job le pone al Issue la label que corresponda según la
  clasificación que `planificador` ya determinó en su sección "Extensión
  del plan" (ver arriba). El agente PM diario (§7) lee esa label del
  mismo array `labels` que ya trae `gh api .../issues` — sin llamada
  nueva a la API — y el dashboard la muestra como badge en cada tarjeta.
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
2. **Crear las labels `solicitud`, `esperando-humano`, `consulta`,
   `esfuerzo-chico` y `esfuerzo-grande`** en el repo, manualmente
   (Settings → Labels). Los formularios de Issue *no* crean sus labels
   solos aunque el YAML las declare — es un gotcha ya confirmado, ver
   `[[feedback_gotchas_tecnicos_fabrica]]`. `esperando-humano` la usa el
   mecanismo de "pausa y pregunta" (ver paso 5); `consulta` la usa
   `consulta-asesoria.yml`/`generar-asesoria.yml` (agregado 2026-09-07,
   ver §2); `esfuerzo-chico`/`esfuerzo-grande` las pone `generar-plan.yml`
   (agregado 2026-09-07, ver §2) — sin ellas creadas, los `gh issue edit
   --add-label` correspondientes fallan (silenciosamente para las de
   esfuerzo, por diseño — ver el prompt de `generar-plan.yml`).
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
     #8). **Incluye la palabra clave de cierre automático, agregada
     2026-09-05** (bug real encontrado por el agente PM diario — ver
     §7.2): al abrir el PR, la Routine debe incluir siempre en la
     descripción `Closes #<número del Issue>`, **en inglés** — GitHub
     no reconoce `Cierra #<número>` como palabra clave de cierre, así
     que el merge nunca cerraba el Issue solo. Con la palabra clave en
     inglés, el merge manual a `main` (que sigue siendo 100% humano, esto
     no lo cambia) cierra el Issue como efecto nativo de GitHub, sin
     workflow adicional.
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
10. **Conectar el repo nuevo al Coordinador central** (agregado
    2026-09-14, ver §8) — mismo tipo de paso manual que el anterior, con
    piezas propias del repo nuevo, no solo de conexión:
    - Agregar el repo al scope del PAT `GH_TOKEN_COORDINADOR`.
    - Conectar el repo como fuente adicional de la Routine
      `coordinador-central` (mismo límite de plataforma que el punto 9).
    - Copiar `.github/workflows/coordinador-avisar-plan.yml` al repo
      nuevo (genérico, sin nada específico del proyecto).
    - Aplicar el mismo diff a `disparar-routine.yml` del repo nuevo (ver
      §8.1) para que acepte un `/aprobar` posteado por un bot.
    - Agregar los secrets/vars `COORDINADOR_API_TOKEN` (Secret) y
      `ROUTINE_COORDINADOR_ID` (Variable) — pestañas distintas, ver §8.4.
    - Agregar el paso 4.5 a las instrucciones de la Routine
      `implementar-plan-aprobado` de este repo (ver §8.1).
11. **Armar los 3 ambientes (dev/preprod/prod) y el despliegue
    automático** (agregado 2026-09-17/21/22, ver §10 para el detalle
    completo y los gotchas) — **estándar para todo proyecto nuevo, no
    opcional. Es puro Git, hacerlo de una vez, aunque cPanel todavía no
    esté armado — no depende de eso:**
    - **Crear las ramas `pre` y `prod`** (GitHub → selector de ramas →
      escribir el nombre → "Create branch: X from...") — `main` ya
      existe siempre, `pre` se crea desde `main`, y **`prod` se crea
      desde `pre`, nunca desde `main` directo**, para mantener la
      cadena de promoción correcta. Sin esto, no hay dónde promover
      nada — es el primer paso, antes que cualquier configuración de
      cPanel.
    - Subdominios `dev.`/`preprod.` del dominio de la cuenta cPanel del
      proyecto (dev y preprod comparten cuenta; prod es una cuenta
      cPanel separada por proyecto).
    - Copiar `deploy-cpanel.yml` (backend Node) o su variante estática
      (frontend sin backend propio, ver §10) — nunca escribirlo desde
      cero para un proyecto nuevo. Reconoce las 3 ramas solo: `push` a
      `main`/`pre`/`prod` dispara el deploy al ambiente correspondiente.
    - Secret `CPANEL_SSH_PRIVATE_KEY` + variables `CPANEL_SSH_HOST`,
      `CPANEL_SSH_PORT`, `CPANEL_SSH_USER`, `CPANEL_PATH_DEV`,
      `CPANEL_PATH_PREPROD` (dev/preprod, mismos nombres en todo
      proyecto). Para producción, credenciales **separadas** (cuenta
      cPanel distinta): secret `CPANEL_PROD_SSH_PRIVATE_KEY` + variables
      `CPANEL_PROD_SSH_HOST`, `CPANEL_PROD_SSH_PORT`,
      `CPANEL_PROD_SSH_USER`, `CPANEL_PROD_PATH` — quedan sin configurar
      hasta que exista un cPanel de producción real para ese proyecto,
      sin que eso rompa nada de dev/preprod mientras tanto.
    - Directory Privacy (contraseña) en dev/preprod desde el arranque
      si el proyecto tiene backend/base de datos real — no esperar a
      que un bot lo encuentre (ver §10).
    - **El merge sigue siendo, siempre, 100% manual** — esto solo
      automatiza el despliegue después de un merge ya hecho a mano, no
      el merge en sí. La promoción entre ramas (`main → pre → prod`) es
      un Pull Request más, igual de manual. `pre → prod` en particular
      sigue siendo, a propósito, la frontera que nunca se automatiza.

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

- **Un repo hub nuevo y dedicado, privado** (acá:
  `Juanjorodriguez09/fabrica-status`) — no vive dentro de ningún proyecto
  real. Solo contiene `.claude/agents/pm-diario.md` (el subagente que
  arma el reporte) y un `CLAUDE.md` mínimo.
- **Un segundo repo, público, solo para el dashboard visual** (acá:
  `Juanjorodriguez09/fabrica-status-dashboard`, agregado 2026-09-05) —
  separado a propósito del repo hub: GitHub Pages privado requiere plan
  Pro/Team/Enterprise, y hacer público el repo hub expondría el
  historial completo de comentarios del Issue fijo (más detalle que el
  snapshot curado). Este repo solo tiene `index.html` (la vista) y
  `data/estado.json` (el snapshot que genera cada corrida) — nada
  operativo.
- **Un Issue fijo** en el repo hub (acá `#1`, "📋 Estado diario de la
  fábrica") — ahí se comenta cada corrida, queda como historial.
- **Tres Personal Access Tokens (fine-grained) de mínimo privilegio** —
  no uno solo, porque un fine-grained PAT no puede tener permisos
  distintos por repo dentro de un mismo token:
  - **Solo lectura** (`Issues`, `Pull requests`, `Metadata` — todo en
    "Read-only") con acceso a los repos de proyecto de la fábrica
    (`Bi_fabrica`, `WebChat_Fabrica`, y cualquiera que se sume — ver 7.3).
  - **Lectura y escritura** (`Issues: Read and write`) con acceso SOLO al
    repo hub (`fabrica-status`).
  - **Lectura y escritura** (`Contents: Read and write`) con acceso SOLO
    al repo del dashboard (`fabrica-status-dashboard`) — usado para
    `git push`, no para la Contents API (ver 7.4.3).
  - Los tres con expiración de 1 año, nunca "sin expiración".
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
    GH_TOKEN_STATUS=<el PAT de lectura/escritura del repo hub>
    GH_TOKEN_DASHBOARD=<el PAT de lectura/escritura del repo del dashboard>
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
  - Repos conectados: el repo hub, el repo del dashboard, más **cada
    repo de proyecto que el reporte debe leer** (ver el gotcha de
    plataforma en 7.3/7.4 — esto es obligatorio, no opcional, para los
    tres tipos de repo).
  - Instrucciones:
    ```
    Ejecutá de forma síncrona (no delegues a un subagente en background) las
    instrucciones de .claude/agents/pm-diario.md en este mismo repo. Generá
    el reporte diario de estado de la fábrica y publicalo en los dos canales
    indicados ahí: el Issue fijo de este repo y Telegram.
    ```

### 7.2 Cómo clasifica y publica el reporte

`pm-diario.md` mantiene una **lista fija de repos** (ver 7.4 — no hay
forma de descubrirla dinámicamente, se probó y no es posible). Para cada
Issue/PR abierto de cada repo de la lista, lo ubica en una de 5
categorías por prioridad — Pausado esperando decisión humana / PR
esperando revisión o merge / Pendiente de aprobar / Recién abierto sin
plan / Estancado — más una sección de "Completado ayer". Publica siempre
en **tres** canales (Issue fijo en `fabrica-status`, Telegram, y
`data/estado.json` en el repo público `fabrica-status-dashboard` que
alimenta el dashboard visual — ver 7.6), incluso si algo falló, dejando
el error explícito en vez de omitir en silencio. Nunca comenta en los
repos de proyecto, solo lee de ahí.

**Historial de "Cierre administrativo pendiente" como categoría propia**
(agregada 2026-09-05, sacada 2026-09-07): se probó separar de "Estancado"
los Issues con PR ya mergeado que solo faltaba cerrar, para no
mezclarlos con Issues genuinamente sin resolución. Se sacó a los dos días
porque el root cause real (la palabra clave de cierre en español, ver
§3 paso 5) ya estaba corregido hacia adelante, y el usuario prefirió no
mantener una categoría dedicada para un caso que no debería repetirse —
si vuelve a aparecer, cae en "Estancado" sin categoría propia, sin
ocultarse.

### 7.3 Sumar un proyecto nuevo al reporte — 3 pasos obligatorios, no 2

Este es el mismo ítem que §3 paso 9, repetido acá porque es fácil
olvidarlo si solo se mira este documento desde la perspectiva de "un
proyecto nuevo". Son tres, no dos — ver 7.4 para por qué el tercero es
inevitable:

1. **Agregar el repo al scope del PAT `GH_TOKEN_FABRICA`** (GitHub →
   Settings → Developer settings → fine-grained tokens → editar el
   token → agregar el repo).
2. **Conectar el repo como fuente adicional de la Routine
   `reporte-diario-fabrica`** (editar la Routine → botón `+` junto a los
   repos ya conectados) — sin esto, aunque el PAT ya lo vea, la llamada
   real desde la sesión falla con `403`. Confirmado en vivo el
   2026-08-31.
3. **Agregar el repo a la lista fija dentro de `pm-diario.md`** — ver
   7.4, no hay alternativa dinámica. Sin este paso el repo simplemente no
   aparece en el reporte, sin ningún error visible (a diferencia del
   paso 2, que si falla es un `403` explícito).

### 7.4 Gotchas de plataforma — proxy de red de la sesión de la Routine

Tres límites reales, descubiertos en vivo en sucesivas corridas, todos
del mismo proxy que intercepta el tráfico de red de una sesión de
Routine hacia GitHub:

1. **GraphQL bloqueado casi por completo** (2026-09-02): "This GraphQL
   query is not enabled for this session — only the pinned set of
   PR-review operations is served". `gh repo list`, `gh issue list` y
   `gh pr list` usan GraphQL por dentro y fallan siempre en una sesión de
   Routine, no solo con determinados campos. Fix: usar exclusivamente
   `gh api` (REST puro) para todo — descubrimiento, listado, comentarios,
   reviews.
2. **Ningún endpoint (ni REST ni GraphQL) permite "listar a qué tiene
   acceso este token"** (2026-09-02): se probó `gh api user/repos` (REST)
   con la esperanza de esquivar el bloqueo de GraphQL del punto 1, y
   también falló: "sessions are bound to their configured repositories.
   Use repository-scoped endpoints". No es un problema de GraphQL vs
   REST — es que la sesión, por diseño, solo puede llamar a endpoints
   **repo-scoped** (`repos/{owner}/{repo}/...`) de repos explícitamente
   conectados a ella. No hay forma de descubrir repos dinámicamente desde
   dentro de una Routine — de ahí la lista fija de 7.2/7.3.
3. **Escrituras vía la API REST/GraphQL bloqueadas casi por completo**
   (2026-09-05): "Write access to this GitHub API path is not permitted
   through this proxy". `gh issue comment` funciona porque está en la
   lista acotada de operaciones permitidas (comentarios de Issues/PRs),
   pero un `PUT` de la Contents API (`repos/{owner}/{repo}/contents/...`,
   usado para escribir un archivo cualquiera) no — sin importar el repo,
   incluso uno conectado a la sesión. **`git clone`/`git push` por HTTPS
   con un token embebido en la URL sí funciona** — no pasa por esta API,
   es el mismo mecanismo que ya usan con éxito `implementar-plan-aprobado`
   y `corregir-hallazgos-pr` para pushear commits. Cualquier subagente
   nuevo que necesite escribir un archivo (no un comentario) desde una
   Routine debe usar `git push`, nunca la Contents API.

Si se escribe un subagente nuevo que necesite leer o escribir en GitHub
desde una Routine, aplicar estos tres criterios desde el principio en vez
de descubrirlos por prueba y error otra vez.

### 7.5 Validado en vivo

- 2026-08-31: primera corrida real, con datos de los dos repos de
  proyecto (encontró el bug de la fecha fija y el uso del conector MCP en
  vez de `gh` — ambos corregidos).
- 2026-09-02: corrida posterior al fix de `gh` — usó los tokens correctos
  vía `gh` (no MCP) y la fecha se calculó bien; encontró el bloqueo de
  GraphQL (7.4.1), corregido; el intento de reemplazo con `gh api
  user/repos` también falló (7.4.2), y se volvió a la lista fija.
- 2026-09-05: primera corrida con el tercer canal (dashboard) conectado —
  el reporte de texto/Telegram/Issue salió limpio, pero la escritura de
  `data/estado.json` vía Contents API falló (7.4.3, ya corregido a
  `git push`).
- 2026-09-07: **confirmado en vivo que el `git push` al repo del
  dashboard funciona de punta a punta** — tres commits reales de la
  Routine (`2026-09-05` x2, `2026-09-07`) en `fabrica-status-dashboard`,
  con datos frescos y correctos. Los tres canales quedan validados.

### 7.6 Dashboard visual (agregado 2026-09-05)

A pedido del jefe del usuario: además del Issue y Telegram (texto), un
dashboard visual interactivo — kanban por categoría, KPIs, filtro por
repo, búsqueda. HTML/CSS/JS puro, sin build step ni framework (mismo
criterio que el frontend de este mismo dashboard, `public/dashboard.js`),
publicado gratis con GitHub Pages.

**Por qué es un repo aparte** (`fabrica-status-dashboard`, público) y no
el mismo repo hub: GitHub Pages privado requiere plan Pro/Team/Enterprise
— en el plan gratuito, Pages solo funciona en un repo público. Hacer
público el repo hub expondría el historial completo de comentarios del
Issue fijo (texto libre, potencialmente más detallado que el snapshot);
en cambio el repo del dashboard solo tiene el snapshot curado
(`data/estado.json`: número, título, motivo corto, fecha) — menos
superficie expuesta por el mismo resultado. **Decisión explícita
confirmada con el usuario**: publicar ahí los títulos/motivos del backlog
interno (nombres de tooltips, pruebas de n8n/Telegram, etc.) es
aceptable; los links a los Issues reales (privados) no se pueden abrir
sin acceso.

El JSON lo escribe `pm-diario.md` en cada corrida (ver 7.4.3 para el
mecanismo de publicación). El dashboard no tiene backend ni build step —
`index.html` hace `fetch("data/estado.json")` directo al abrir la
página.

**Historial por fecha (agregado 2026-09-07):** cada corrida hace su
propio commit en `fabrica-status-dashboard`, así que el historial de git
del repo ya es, de por sí, un snapshot diario — no hizo falta agregarle
nada a `pm-diario.md` para tener esto. El selector "Ver fecha" del
dashboard consulta en el navegador la API pública de commits de GitHub
(`GET /repos/{owner}/{repo}/commits?path=data/estado.json`, sin
autenticación — el repo es público, sujeto al rate limit no autenticado
de GitHub, ~60 req/hora por IP, aceptable para uso personal esporádico) y
cuando se elige una fecha anterior, trae el JSON de ese commit puntual
vía `raw.githubusercontent.com/{owner}/{repo}/{sha}/data/estado.json`.
Es solo frontend — no toca `pm-diario.md` ni ninguna credencial.

## 8. Coordinador central — aprueba/retroalimenta planes solo, sin humano

A pedido del jefe del usuario (2026-09-10/11): tras ver la fábrica
funcionando, pidió reducir la intervención humana a solo el aviso final,
en vez de tener que aprobar cada plan y responder sus preguntas abiertas
a mano. El Coordinador reemplaza ese punto de intervención — nunca deja
un plan sin resolver, nunca pausa esperando a un humano.

**Igual que §7 (una sola vez para toda la fábrica, no por proyecto).**
Primer intento: se piloteó por-repo en `Bi_fabrica` (mismo patrón que
`revisar-pr.yml`), pero el usuario aclaró que lo quería **central**, un
solo Coordinador para todos los proyectos — mismo criterio que
`pm-diario`. La versión final, la que se documenta acá, ya es la
centralizada. **Confirmado en vivo el 2026-09-14, en los dos repos**
(`Bi_fabrica` Issue #36 — caso sin código; `WebChat_Fabrica` Issue #22 →
PR #23 — caso con código real).

### 8.1 Qué se crea

- **En el repo hub** (`fabrica-status`, el mismo de §7):
  - `.claude/agents/coordinador.md` — el criterio de decisión, genérico
    para cualquier proyecto: clona el repo del Issue a revisar (con
    `git clone` + token, no con la Contents API — mismo motivo que 7.4.3),
    lee su `CLAUDE.md`/skills, decide, comenta la aprobación.
  - `.claude/conocimiento/decisiones.md` — base de conocimiento
    **compartida entre todos los proyectos** (no una por repo): registro
    liviano en texto/git de decisiones no triviales, para no responder
    dos veces distinto la misma pregunta de fondo. Pensada para migrar a
    una base de datos real más adelante (el jefe ofreció un cPanel) — no
    bloquea nada mientras tanto.
- **Un PAT nuevo, `GH_TOKEN_COORDINADOR`** (fine-grained): `Issues: Read
  and write` + `Contents: Read-only` sobre los repos de proyecto —
  distinto de `GH_TOKEN_FABRICA` (que es solo lectura) y de
  `GH_TOKEN_STATUS`/`GH_TOKEN_DASHBOARD` (que son de otro repo), mismo
  criterio de mínimo privilegio de siempre.
- **Una Routine nueva, `coordinador-central`**, en `fabrica-status`, con:
  - Trigger: **"Add an API trigger"** (no horario) — se dispara cuando
    un repo de proyecto avisa que hay un plan nuevo.
  - Repos conectados: el repo hub + cada repo de proyecto (mismo límite
    de plataforma que ya se explica en 7.3/7.4 — sin conectar el repo,
    la sesión no puede llamar a su API aunque el token sí tenga acceso).
  - Instrucciones:
    ```
    Ejecutá de forma síncrona (no delegues a un subagente en background) las
    instrucciones de .claude/agents/coordinador.md en este mismo repo, usando
    el payload recibido para saber en qué repo y qué Issue tenés que revisar.
    ```
- **En cada repo de proyecto**, dos piezas nuevas y una modificación a
  un workflow ya existente:
  - `.github/workflows/coordinador-avisar-plan.yml` — workflow chico,
    dispara sobre el mismo evento que detecta un plan nuevo (comentario
    bot con `## Objetivo`, no `/aprobar`) y solo llama `/fire` a la
    Routine central — no razona nada localmente, mismo patrón que
    `disparar-routine.yml`.
  - Dos secrets/vars nuevos: `COORDINADOR_API_TOKEN` (Secret) y
    `ROUTINE_COORDINADOR_ID` (Variable) — **ojo, son dos pestañas
    distintas** en Settings → Secrets and variables → Actions, ver 8.4.
  - `.github/workflows/disparar-routine.yml` **modificado** (no es un
    archivo nuevo, es un cambio a uno ya compartido): la condición de
    disparo ahora también acepta un `/aprobar` posteado por una
    identidad bot, no solo por un humano OWNER/COLLABORATOR/MEMBER:
    ```diff
    - contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
    + (contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) || github.event.comment.user.type == 'Bot') &&
    ```
- **La Routine `implementar-plan-aprobado` de cada proyecto, con un paso
  nuevo (4.5) agregado a sus instrucciones** (se edita directo en la UI
  de la Routine, no es un archivo de repo):
  ```
  4.5. Si el plan aprobado concluye que NO hace falta ningún cambio de
     código (por ejemplo, la funcionalidad ya existe, o el Issue es un
     duplicado ya resuelto en otro Issue/PR) — no sigas a los pasos 5-9,
     no crees rama ni PR. No dejes esa decisión para que la tome un
     humano: cerrá el Issue vos mismo con `gh issue close <numero>
     --comment "<explicación breve, citando la evidencia concreta de por
     qué no hace falta desarrollo>"`. Terminá el turno ahí.
  ```
  Sin este paso, la Routine solo *decía* que había que cerrar el Issue
  pero lo dejaba abierto — un punto de intervención humana que había
  quedado sin cubrir (encontrado en vivo con el Issue #36 de prueba).

### 8.2 Cómo decide

Para cada pregunta abierta del plan: si se puede derivar de evidencia
real (código, `CLAUDE.md`, un skill, una decisión anterior en
`decisiones.md`) la resuelve citando esa evidencia; si es una decisión
de producto sin respuesta objetiva, elige la opción más conservadora y
consistente con el patrón ya existente, dejando explícito por qué. Nunca
deja una pregunta sin resolver ni pausa — a diferencia del mecanismo de
"pausa y pregunta" de `implementar-plan-aprobado` (§3 paso 5), que sigue
existiendo para decisiones que aparecen *durante* el desarrollo (después
de que el Coordinador ya aprobó el plan), no para la aprobación en sí.

### 8.3 Límite del merge (frontera, no bloqueo)

**Decisión explícita del usuario:** el Coordinador algún día va a poder
mergear directo a un ambiente `pre` (preprod), una vez que exista ese
ambiente — pero `pre → prod` sigue siendo 100% manual, igual que "el
merge es siempre humano" fue la regla no negociable desde el origen de
este proyecto. **Hoy (sin el ambiente `pre` construido todavía, depende
de Contabo) el Coordinador llega hasta "PR abierto y revisado, listo
para mergear" — el merge a `main` sigue siendo tu clic**, no porque
falte autonomía, sino porque el destino (`pre`) todavía no existe.

### 8.4 Gotchas de plataforma, encontrados en vivo

1. **`claude-code-action` rechaza correr si el actor que disparó el
   workflow es un bot** ("Workflow initiated by non-human actor... Add
   bot to allowed_bots list or use '*'") — apareció en el primer intento
   (piloto por-repo, ya reemplazado por el diseño central de 8.1, pero
   el gotcha sigue siendo válido para cualquier workflow futuro que
   reaccione con `claude-code-action` directo a un comentario de bot):
   agregar `allowed_bots: "*"` al step.
2. **`Secrets` y `Variables` son pestañas distintas** en Settings →
   Secrets and variables → Actions — poner `COORDINADOR_API_TOKEN` o
   `ROUTINE_COORDINADOR_ID` en la pestaña equivocada hace que
   `${{ secrets.X }}`/`${{ vars.X }}` resuelva vacío, y el `curl` de
   `coordinador-avisar-plan.yml` falla con **exit code 43** ("bad
   function argument") sin ningún mensaje de error claro más allá del
   código de salida — si aparece ese error, lo primero a revisar es en
   qué pestaña quedó cada valor.

### 8.5 Qué falta (próximos incrementos, no construidos)

- **Incremento 3** (bloqueado hasta que el entorno `pre` real esté
  levantado, ver §10): merge a `pre` + entorno de pruebas UX con URL
  real (ver §4 — GitHub Pages no puede hospedar esto, necesita un
  servidor real).
- Confirmar que aprobar varios planes a la vez efectivamente corre en
  paralelo (cada `/fire` debería ser una sesión independiente, pero no
  se probó explícitamente con 2-3 simultáneos).
- Reanudo automático si se agota la cuota/tokens — sin resolver.
- "Sesiones de planning facilitadas con PO" (parte del diagrama más
  amplio que mandó el jefe, ver §8) — todavía sin bajar a un diseño
  concreto.

### 8.6 Incremento 2 construido — decide ajustes de PR (2026-09-16)

Cierra el segundo punto de intervención humana: hasta ahora, si
`revisar-pr.yml` encontraba un hallazgo REAL/CRÍTICO pero el PR ya había
gastado su único intento automático de corrección (más de 1 commit), el
comentario quedaba esperando que un humano escribiera `/ajustar` a mano.
Ahora el Coordinador toma esa decisión — con un límite de seguridad
explícito para no entrar en loop.

**Qué se creó/modificó (en los dos repos de proyecto):**

- `revisar-pr.yml` **modificado**: cuando hay hallazgo real y el intento
  automático ya se usó, el comentario de revisión ahora agrega al final
  una marca literal:
  ```
  🧭 ESPERANDO_DECISION: hay hallazgos reales sin corregir y ya se usó el intento automático de corrección.
  ```
- `.github/workflows/coordinador-avisar-ajuste.yml` **nuevo** — mismo
  patrón que `coordinador-avisar-plan.yml` (§8.1): dispara `/fire` a la
  MISMA Routine `coordinador-central` (no hace falta una Routine nueva)
  cuando un comentario de bot en un PR contiene esa marca.
- `ajustar-pr.yml` **modificado**: la condición de disparo ahora también
  acepta `/ajustar` posteado por una identidad bot, mismo cambio que ya
  se le había hecho a `disparar-routine.yml` para `/aprobar`:
  ```diff
  - github.event.comment.user.type != 'Bot' &&
  - contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
  + (contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) || github.event.comment.user.type == 'Bot') &&
  ```
- `.claude/agents/coordinador.md` (hub `fabrica-status`) **modificado**:
  ahora distingue dos tareas por el texto del payload que lo invoca —
  Tarea 1 (aprobar plan, sin cambios) y Tarea 2 (decidir un ajuste de
  PR, nueva). El payload de `coordinador-avisar-ajuste.yml` menciona
  "hallazgos reales de revisión sin corregir" en un PR; el de
  `coordinador-avisar-plan.yml` menciona "un plan nuevo".

**Límite de seguridad, decisión explícita del usuario — nunca lo
saltees:** el Coordinador puede pedir como máximo **un** `/ajustar`
extra por PR. Lo verifica contando `commits` vía `gh pr view --repo
<owner>/<repo> --json commits` (nunca por memoria/supuesto): si ya hay
más de 2 commits, el intento extra ya se usó (por él mismo antes, o por
un humano) y no insiste — escala con la label `esperando-humano` (ya
existe en los dos repos) en vez de arriesgar un loop. Además, incluso
con margen disponible, si el hallazgo es en el fondo una decisión de
producto sin respuesta objetiva (no algo que un ajuste de código
resuelva mejor), escala directo sin gastar el intento.

**Gap de credenciales encontrado antes de terminar:**
`GH_TOKEN_COORDINADOR` (creado para §8) solo tenía scope `Issues` +
`Contents: Read-only` — la Tarea 2 necesita además **`Pull requests:
Read and write`** (para `gh pr view`/`gh pr comment`/`gh pr edit
--add-label`) en el mismo token, sobre los mismos repos. No hace falta
un token nuevo ni tocar Secrets — es el mismo `GH_TOKEN_COORDINADOR`
editado con el permiso agregado.

**Sin validar en vivo todavía** (2026-09-16) — depende de que un PR real
tenga un hallazgo que sobreviva la primera corrección automática, más
difícil de forzar a propósito que los otros flujos. Decisión explícita
del usuario: dejarlo desplegado y confirmarlo la próxima vez que ocurra
naturalmente, en vez de gastar una prueba sintética ahora.

### 8.7 pm-diario/dashboard extendido — muestra qué decidió el Coordinador solo (2026-09-16)

`pm-diario.md` ahora revisa, para cada Issue/PR (con los mismos
comentarios que ya leía para clasificarlo, sin llamada nueva), si algún
comentario empieza con `/aprobar`/`/ajustar` y fue posteado por una
identidad bot — lo marca (`decidido_por_coordinador: true` en el JSON)
sin cambiarle la categoría, y suma una línea nueva al reporte de texto
por repo ("Decidido por el Coordinador, sin intervención humana"). El
dashboard (`fabrica-status-dashboard/index.html`) agrega un badge por
tarjeta y un KPI con el total del día, mismo patrón visual ya usado para
`esfuerzo-chico`/`esfuerzo-grande`. **Sin validar visualmente en el
sitio publicado todavía** — depende de la próxima corrida de la Routine
diaria.

### 8.8 El Coordinador ya no dispara al instante — margen de 20 min para el humano (2026-09-22)

**Confirmado en vivo (WebChat_Fabrica Issue #27):** el diseño original
(`coordinador-avisar-plan.yml`/`coordinador-avisar-ajuste.yml`, on:
`issue_comment: created`) disparaba al Coordinador **9 segundos** después
de que el planificador posteara un plan — y el Coordinador terminaba de
decidir y comentar en **~90 segundos** más. En la práctica, el humano
nunca tenía margen real para responder las preguntas abiertas él mismo
antes de que el Coordinador ya las hubiera resuelto. Esto contradice el
propósito del Coordinador: es un **respaldo** para cuando el humano no
actúa, no una carrera contra él.

**Cambio:** los dos workflows de disparo instantáneo se eliminaron.
Reemplazados por un único workflow programado por repo,
`.github/workflows/coordinador-vigilar.yml` (`cron: '*/15 * * * *'` +
`workflow_dispatch`), que:
- Lista Issues/PRs abiertos con `gh api` (REST, mismo motivo que siempre
  — GraphQL bloqueado en las Routines, no en el runner de Actions).
- Para cada uno, mira el **último comentario**: si es de un bot, tiene
  `## Objetivo` sin `/aprobar` (Issue) o `🧭 ESPERANDO_DECISION` (PR), y
  **lleva 20+ minutos ahí sin respuesta humana**, recién ahí llama
  `/fire` sobre `coordinador-central` — exactamente el mismo payload que
  antes.
- Es idempotente en la práctica: en cuanto el Coordinador comenta, el
  último comentario deja de cumplir la condición, así que el próximo
  chequeo (15 min después) ya no lo vuelve a disparar. Con el Coordinador
  terminando en ~90s, el margen de 15 min entre chequeos hace ese riesgo
  de doble disparo despreciable.
- Aplicado igual en `Bi_fabrica` y `WebChat_Fabrica` — mecanismo
  estandarizado, no a medida de un repo (ver `[[feedback_estandarizar_vs_a_medida]]`).

**Bug real encontrado y corregido en el mismo repaso** (en
`coordinador.md`, el único lugar donde vive): el comando documentado para
postear la decisión (`gh issue comment ... --body-file archivo`) falla
con un 403 de GraphQL bloqueado en la sesión de la Routine — igual que
los comandos ya documentados como bloqueados en `pm-diario.md`, pero que
acá no estaba contemplado. El Coordinador improvisó un fallback
(`gh api ... -f body=@archivo`) que **no lee el archivo con `-f`** (solo
`-F` lo hace) — posteó el texto `@/tmp/decision.txt` literal en un Issue
real (WebChat_Fabrica #27), atribuido al usuario humano porque
`GH_TOKEN_COORDINADOR` es un PAT bajo su propia cuenta, no una identidad
bot separada. Corregido: el único patrón válido para publicar ahora es

```bash
jq -Rs '{body: .}' /tmp/decision.txt | GH_TOKEN="$GH_TOKEN_COORDINADOR" gh api "repos/<owner>/<repo>/issues/<numero>/comments" --input -
```

que arma el JSON explícitamente y no depende de que `gh` interprete el
`@`.

### 8.9 Dos gaps más encontrados en la misma ronda de pruebas (2026-09-22)

**`revisar-pr.yml` puede reportar "success" sin cumplir lo pedido.**
Confirmado en vivo dos veces sobre el mismo PR real (WebChat_Fabrica
#28): (1) con un hallazgo etiquetado `REAL/CRÍTICO`, no disparó la
corrección automática que le correspondía (Caso C); (2) en la
re-revisión tras un `/ajustar`, ni siquiera publicó el comentario
consolidado. En ambos casos el job de GitHub Actions terminó
"success" — sin acceso a los logs detallados del step (bloqueados sin
permisos de admin) no se pudo confirmar la causa exacta, pero el patrón
coincide con el mismo tipo de fallo silencioso ya visto y corregido antes
en `generar-asesoria.yml` (§ tanda de pruebas del 2026-09-10). **Fix
aplicado en los dos repos y en `GUIA_INSTALACION_FABRICA.md`:** un
checklist final explícito, obligando al modelo a confirmarse a sí mismo
(antes de terminar el turno) que efectivamente ejecutó `gh pr comment` y,
si correspondía, el `curl` de disparo — mismo principio que ya funcionó
para el bug del `asesor`. Sin volver a confirmar en vivo si esto lo
resuelve del todo; si vuelve a pasar, hace falta reforzarlo más.

**`documentador.md` de `WebChat_Fabrica` tenía una regla contradictoria
consigo misma.** Su punto 3 dice que debe crear secciones nuevas en el
README para lo que el código ya tiene, aunque el cambio puntual no lo
haya tocado — pero en la práctica (`revisar-pr.yml` lo invoca siempre en
modo "solo diagnóstico, no apliques cambios") nunca llega a ejecutar esa
regla como edición, así que la aplicaba mal: descartaba el hueco como
"no genera divergencia nueva, fuera de alcance de este PR" en vez de
señalarlo como recomendación. **Fix:** aclarado explícitamente que la
regla 3 sigue aplicando en modo diagnóstico, solo que como recomendación
en el reporte en vez de una edición directa. Aplicado en
`WebChat_Fabrica` y en el meta-prompt de `GUIA_INSTALACION_FABRICA.md`
(ítem 3 de A.3).

## 9. Modelo de IA según esfuerzo (2026-09-15)

No es un ahorro de costo — es un upgrade selectivo de capacidad para el
trabajo de mayor riesgo, usando la clasificación `esfuerzo-chico`/
`esfuerzo-grande` que el `planificador` ya venía poniendo (§2), sin
mecanismo nuevo de clasificación.

- `esfuerzo-chico` sigue exactamente en **Sonnet**, sin ningún cambio.
- `esfuerzo-grande` dispara una **segunda Routine**,
  `implementar-plan-aprobado-grande` — mismas instrucciones exactas que
  la original, configurada con **Opus** en vez de Sonnet.
- `disparar-routine.yml` y `continuar-plan-pausado.yml` (los dos repos)
  eligen cuál Routine llamar leyendo la label del Issue, con un paso
  nuevo ("Detectar esfuerzo") y una expresión ternaria en el `env:` del
  step de disparo:
  ```yaml
  ROUTINE_ID: ${{ steps.esfuerzo.outputs.es_grande == 'true' && vars.ROUTINE_IMPLEMENTAR_GRANDE_ID || vars.ROUTINE_IMPLEMENTAR_ID }}
  ROUTINE_TOKEN: ${{ steps.esfuerzo.outputs.es_grande == 'true' && secrets.ROUTINE_API_TOKEN_GRANDE || secrets.ROUTINE_API_TOKEN }}
  ```
- Por repo, hace falta crear: la Routine nueva (mismo entorno CCR que la
  original, solo cambia el modelo elegido al crearla) +
  `ROUTINE_API_TOKEN_GRANDE` (Secret) + `ROUTINE_IMPLEMENTAR_GRANDE_ID`
  (Variable).

**Confirmado en vivo en `Bi_fabrica`** (Issue #37): el Coordinador
resolvió 4 preguntas abiertas reales con buen criterio (encontró código
reutilizable existente en vez de proponer duplicarlo), y el log de
`disparar-routine.yml` confirmó que se llamó al `ROUTINE_ID` de la
Routine configurada con Opus. **Desplegado también en `WebChat_Fabrica`**
(misma Routine/secrets/vars creadas), pero sin probar ahí — decisión
explícita del usuario de no gastar una segunda prueba del mismo
mecanismo ya confirmado.

## 10. Entorno real de despliegue — cPanel dev/preprod/prod (estándar, validado 2026-09-21)

Primera vez que la fábrica sale de "todo vive en GitHub Actions" hacia
un servidor real. El jefe dio acceso a un cPanel compartido
(`fabricaiamic@fabrica.micomercio.co`, hosting en `supercp.com`) y
confirmó la arquitectura de infraestructura (independiente de la
arquitectura de la fábrica en sí):

- **Desarrollo y preproducción comparten un solo cPanel** — carpetas y
  bases de datos separadas, mismo panel/recursos. No un cPanel por
  ambiente.
- **Producción es un cPanel separado por proyecto** (repo/producto, no
  por cliente/tenant de MiComercio Chat — confirmado explícitamente con
  el usuario, sin necesidad de volver a preguntarle al jefe) — para que
  la caída de un proyecto no afecte a los demás.
- El repo de cada proyecto es público (`Bi_fabrica`,
  `WebChat_Fabrica`) — el propio "Git™ Version Control" nativo de cPanel
  puede clonarlo sin ninguna credencial. Cuando la fábrica se mude a la
  cuenta de GitHub limpia (que el usuario mismo va a crear, no el jefe),
  revisar si siguen siendo públicos o si hace falta una deploy key.

**Los pasos concretos, literales, están en `GUIA_INSTALACION_FABRICA.md`
Parte E** (no acá — este documento es la bitácora de decisiones y
gotchas, no el instructivo). Validado de punta a punta en `Bi_fabrica`:
subdominios dev/preprod, bases PostgreSQL con sus usuarios, apps
Node.js corriendo, rama `pre` en el repo, clave SSH propia para
despliegue, y el workflow de despliegue automático (ver más abajo)
pusheado y confirmado.

**Gotchas de plataforma reales, para no repetir el tiempo de
depuración:**

1. **`prisma generate` se cae por memoria en este cPanel**
   (`RangeError: Out of memory: Cannot allocate Wasm memory for new
   instance`) — el hosting impone `ulimit -v` de 4GB (CloudLinux/LVE) y
   el motor WASM de Prisma (desde ~v5.2x) reserva un bloque grande de
   memoria virtual de una sola vez al arrancar, sin importar cuánta
   memoria real vaya a usar — no es arreglable sin acceso root (subir el
   límite requiere WHM). **Workaround, sin tocar el servidor:** generar
   el cliente de Prisma en la máquina local (sin esa restricción), con
   `binaryTargets` en `prisma/schema.prisma` incluyendo el target real
   que pide el `nodevenv` de cPanel (confirmarlo con el mensaje de error
   exacto de Prisma al cargar el cliente — en este caso
   `debian-openssl-1.0.x`, aunque el SO real del servidor sea RHEL7), y
   subir `node_modules/.prisma/client` ya generado por `rsync`/SCP en vez
   de correr `prisma generate` en el servidor.
2. **Vaciar la carpeta de una app Node ya creada en "Setup Node.js App"
   borra también su `.htaccess`** (con las directivas
   `PassengerAppRoot`/`PassengerBaseURI`/`PassengerNodejs`/
   `PassengerAppType`/`PassengerStartupFile`) — sin él, Stop/Save de esa
   app falla con `FileNotFoundError` desde el `cl_selector` de
   CloudLinux. Evitar: crear el Node app DESPUÉS de clonar el repo en la
   carpeta (no antes), o guardar ese archivo antes de vaciar la carpeta.
3. **El límite de procesos (LVE) de una cuenta cPanel compartida se
   agota fácil — pero la causa real casi nunca es SSH.** La primera
   hipótesis (conexiones SSH cortadas de golpe) **se descartó con
   evidencia** — se reprodujo el bloqueo varias veces con sesiones SSH
   siempre cerradas limpio. Las causas reales, confirmadas una por
   una, aislando variables (chequeo de procesos después de cada paso,
   nunca varios cambios a la vez):
   - **Motor "library"/"binary" de Prisma paniqueando en runtime**
     (`PANIC: timer has gone away`, del crate `futures-timer`) — no
     solo al generar el cliente (síntoma 1, gotcha #1 de arriba), sino
     al ejecutar una consulta real, con el cliente ya generado y
     funcionando. Confirmado que la misma query, mismo cliente,
     ejecutada localmente por túnel SSH contra la misma base, no
     paniquea nunca — es específico de correr el motor en Rust dentro
     de este hosting (hipótesis: CPU throttling de CloudLinux). **Fix
     real, no workaround: motor `driverAdapters` con
     `@prisma/adapter-pg`** (JS puro sobre el paquete `pg`, sin motor
     Rust) — ver `prisma/schema.prisma` y `src/lib/prisma.js` de
     `Bi_fabrica` como referencia exacta. La versión de
     `@prisma/adapter-pg` tiene que coincidir exacto con la de
     `prisma`/`@prisma/client` (no tomar la última del paquete sin
     verificar).
   - **Un bot de escaneo de secretos, sin relación con el código.**
     Tráfico externo genérico de internet (no dirigido a este proyecto)
     probando rutas típicas de credenciales filtradas (`.env`,
     `wp-config.php`, `aws.yml`, etc.) a 100+ requests/segundo durante
     unos segundos — encontró el subdominio nuevo apenas quedó público.
     **Fix: Directory Privacy (contraseña HTTP) en cualquier subdominio
     dev/preprod que tenga backend/base de datos real**, desde el
     arranque, no después de que pase. Coexiste sin problema con las
     directivas `Passenger*`/`SetEnv` ya presentes en el `.htaccess`.
   - **Concurrencia real del frontend, ya con el bug de Prisma
     resuelto.** Una sola carga de página con varias llamadas
     verdaderamente simultáneas (`Promise.all([...12 fetches...])`)
     agota el límite igual — confirmado aislando con `/health` (sin
     tocar base de datos) repetido 15 veces seguidas *secuenciales* sin
     ningún problema, contra la misma carga con las 12 en paralelo sí.
     **Fix: limitar la concurrencia del lado del cliente** (cola con
     máximo 3 en vuelo a la vez en vez de todas de una) — no es algo
     que el backend pueda resolver solo, es una responsabilidad del
     código que arma las requests.

   Cuando el límite ya se agotó y quedó pegado (no baja solo):
   **absolutamente todo lo que necesite forkear un proceso nuevo
   falla** (`cagefs_enter: Unable to fork`, o en Node directamente
   `fork: Resource temporarily unavailable`) — SSH, Terminal, Resource
   Usage, crear una app nueva. **No hay forma de destrabarlo sin acceso
   root/WHM** — si la cuenta es un plan Reseller (sin Terminal en WHM),
   ni siquiera el dueño de la cuenta puede — hay que pedirle al hosting
   que mate los procesos del lado de ellos.

**Diseño del despliegue automático, ya construido y parametrizado —
`.github/workflows/deploy-cpanel.yml`:** dispara con `push` a `main`
(→ dev) o `pre` (→ preprod), nunca mergea nada — actúa después de un
merge ya hecho a mano, el merge sigue siendo siempre manual. Para
proyectos con backend Node.js: corre `npm ci`/`prisma generate` **en
el runner de GitHub Actions** (sin límite de procesos ni memoria, a
diferencia del cPanel) y sube el resultado ya armado por `rsync` —
nunca instala ni genera nada pesado en el servidor compartido. El
reinicio de la app es tocar `tmp/restart.txt` (mecanismo nativo de
Phusion Passenger/LiteSpeed), no un botón de la UI.

**Variante para proyectos estáticos (sin backend propio, ej.
`WebChat_Fabrica`):** mucho más simple, y sin ninguna de las 3 causas
de arriba — no hay Prisma, no hay concurrencia de backend que agote
procesos, ni siquiera hace falta "Setup Node.js App". El paso de
`npm ci`/`prisma generate` se reemplaza por `npm run build`, el
`TARGET` del `rsync` es la carpeta pública del subdominio, y no hace
falta ningún `SCRIPT_AFTER` de reinicio (no hay proceso que reiniciar).
Directory Privacy es opcional en este caso — un bot escaneándolo solo
recibe 404s inofensivos, no hay riesgo de agotar procesos.

**Gotcha de DNS, si el subdominio no carga ni por http ni por
https:** los subdominios nuevos tienen que ser hijos del dominio real
de la cuenta cPanel (`algo.fabrica.micomercio.co`), nunca "hermanos"
del mismo (`algo.micomercio.co`) — la cuenta no controla la zona DNS
completa de `micomercio.co`, solo `fabrica.micomercio.co` y sus
subdominios. Un dominio hermano no resuelve ni con certificado ni sin
él, aunque los archivos estén bien subidos.
