# Contexto: Fábrica de Software — MiComercio S.A.S.

> **Cómo usar este documento:** pégalo al inicio de cualquier sesión nueva de
> Claude Code (o Claude normal) cuando necesites que entienda el proyecto
> completo sin tener que re-explicarlo. También sirve como referencia propia
> para no perder de vista decisiones ya tomadas vs. pendientes.
>
> Actualizado 2026-08-21: el piloto ya corre solo de punta a punta sobre un
> proyecto real (probado en vivo varias veces, no solo diseñado). Este
> documento refleja el estado real del código, no la visión original —
> varias piezas que estaban "por construir" en la primera versión ya están
> construidas y probadas.
>
> Actualizado 2026-08-24: se investigaron los agentes nativos de GitHub
> (Copilot coding agent / Agent HQ) y Codex a pedido del jefe, para
> responder si el pipeline con Issues es innecesario o si le falta
> flexibilidad. Conclusión: no es innecesario — ninguno reproduce el
> pipeline completo ya calibrado. Se aclaró también el rol exacto de n8n
> en el flujo (ver §3).

## 1. Qué es esto

MiComercio quiere estandarizar cómo se desarrolla, prueba y despliega
software internamente — una "fábrica de software" con un proceso único que
aplique a todos los proyectos, no solo al actual. El primer proyecto real
que se ejecuta bajo este modelo es la migración progresiva de un ERP/POS
existente hacia NestJS/TypeScript, pero la fábrica en sí es el objetivo de
fondo: primero se estructura bien el proceso, y solo después arranca la
migración usando esa fábrica ya funcionando.

Es un proyecto interno de MiComercio, de largo aliento. El **MVP** se está
validando en un piloto real (`micomercio_bi_dashboard`, clon independiente
del repo en producción — no toca el original): el ciclo completo Issue →
plan → aprobación → desarrollo → PR → revisión → merge ya corre sin
operación manual intermedia. Antes de escalarlo a más proyectos falta
confirmar que el mismo proceso se replica igual en un segundo repo.

## 2. El pipeline completo (visión, 7 etapas)

| # | Etapa | Quién actúa | Estado |
|---|---|---|---|
| 1 | **Solicitud** de ajuste/mejora/módulo nuevo | Humano redacta | Construido y probado: GitHub Issue con plantilla `solicitud-cambio.yml` |
| 2 | **Plan de trabajo** (y retroalimentación) | IA (subagente "planificador") | Construido y probado en vivo. Es conversación real, no una instrucción de un solo turno: cualquier comentario del humano antes de `/aprobar` dispara una replanificación (`retroalimentar-plan.yml`) que lee el hilo completo del Issue y ajusta el plan, o responde sin inventar cambios si es solo una pregunta. Puede repetirse varias veces |
| 3 | **Aprobación del plan** | Humano | Construido y probado: comentario `/aprobar` en el mismo Issue dispara el desarrollo. Más simple que lo planeado originalmente (ver §3) |
| 4 | **Desarrollo** | IA (Routine "implementar-plan-aprobado") | Construido y probado en vivo: dispara sola, crea rama `claude/issue-<n>-...`, abre PR. **No mergea** (a propósito). Hoy no pausa a mitad de desarrollo aunque surja una duda real no prevista en el plan — resuelve todo de forma conservadora y sigue; ese comportamiento está señalado como pendiente de cambiar (§6) |
| 5 | **Revisión/feedback iterativo** | IA — subagentes `revisor-codigo`, `validador-metricas`, `documentador` + auto-corrección calibrada | Construido y probado en vivo (4 PRs reales). Auto-fix de hallazgos reales corre solo, máximo 1 corrección automática por PR, y solo dispara ante hallazgo etiquetado "CRÍTICO" (no basta "REAL") — decisión conservadora explícita. **Codex como segunda IA de chequeo cruzado**: sigue sin integrar — el jefe decidió postergarlo, no descartarlo |
| 6 | **Preprod** | Automático (deploy) + Humano (pruebas de interfaz/responsive) | Por construir |
| 7 | **Producción** | 100% manual, a propósito (riesgo) | Decisión ya tomada, no se automatiza |

## 3. Decisiones de arquitectura ya tomadas

- **Un repositorio = un proyecto = una Routine.** No hay clasificador
  automático que decida a qué proyecto pertenece una solicitud — quien la
  redacta decide en qué repo se abre el issue. Los `trigger_id` de las
  Routines y el nombre del repo ya están parametrizados (variables de repo
  de GitHub, no hardcodeados) — re-probado en vivo sin diferencia de
  comportamiento. Un clasificador automático de proyectos sigue siendo una
  posible mejora de fase 2, no del MVP.
- **Aprobaciones:** terminó siendo más simple que el plan original de
  "sesión en la nube + notificación push". En la práctica basta con
  comentar `/aprobar` directamente en el Issue (incluso desde el celular,
  con la app de GitHub) — el webhook de GitHub Actions dispara todo el
  flujo desde ahí. Probado en vivo. No hizo falta construir un mecanismo de
  aprobación remota dedicado.
- **Codex** no reemplaza a Claude Code — jugaría el rol de revisor
  independiente, para que el código no sea evaluado únicamente por la misma
  IA que lo escribió. El jefe analizó esto junto con una propuesta de
  arquitectura más amplia (orquestador propio + máquina de estados) el
  2026-08-19 y decidió explícitamente **postergarlo a mediano plazo**: casi
  todo lo demás de esa propuesta ya está resuelto con piezas más baratas
  (GitHub Projects como tablero, una Routine con cron para resumen diario,
  reabrir/enlazar Issues en vez de un mecanismo nuevo).
- **Agentes nativos de GitHub / Copilot / Agent HQ (investigado
  2026-08-24):** no reemplazan nada del pipeline — Copilot coding agent
  hace, función por función, lo mismo que ya cubre la Routine de
  desarrollo, solo que sin la calibración propia (checklist de seguridad,
  umbral de auto-fix, plan conversacional). El hallazgo con valor real es
  que el rol de "revisor cruzado" (el que se pensaba para Codex) tiene
  candidatos concretos para pilotar.
- **Revisor cruzado, requisito no negociable: tiene que operar desde el
  celular, sin depender de estar frente a una computadora** — mismo
  criterio que ya aplican para aprobar (`/aprobar`) desde la app de GitHub.
  Esto descarta al **Codex Plugin para Claude Code**
  (`openai/codex-plugin-cc`, comunidad, no oficial de OpenAI) como opción
  de producción: se invoca de forma local, reutilizando el CLI de Codex en
  tu máquina — rompe justo la propiedad de "todo se resuelve desde el
  teléfono" que ya tienen. Queda como chequeo manual puntual cuando estés
  en la computadora, no como pieza fija del pipeline. Los dos candidatos
  que sí corren 100% nativos en GitHub (revisables desde el celular) son:
  **Copilot code review** (US$10/mes, plan Pro individual) y **Codex —
  revisión nativa de PR en GitHub** vía `AGENTS.md` (requiere plan Plus,
  US$20/mes — confirmado que el plan Free de Codex solo cubre uso local
  por CLI, no la revisión automática de PR en GitHub). Con presupuesto
  para un plan pago nada más, **Copilot code review es la opción líder**:
  mismo tipo de rol, mitad de precio.
- **Cómo se estandariza entre proyectos:** antes de construir un Plugin
  formal de Claude Code, se resolvió primero con un documento vivo,
  `Estandar_fabrica_software.md` — el checklist concreto de onboarding de
  un proyecto nuevo: qué se copia tal cual (plantilla de Issue, 3
  workflows, 4 subagentes genéricos) y qué hay que adaptar (`CLAUDE.md` del
  proyecto destino, subagente de dominio si aplica), más los 8 pasos de
  configuración en orden. **Falta probarlo en un segundo proyecto real**
  para confirmar que el estándar funciona y no solo está documentado.
- **Plugin de Claude Code — investigado a fondo (2026-08-24), NO usar
  todavía en el segundo proyecto.** Se confirmó con la documentación
  oficial que un plugin sí resuelve la administración de actualizaciones
  (versión semántica, auto-update, cada proyecto queda en la versión que
  quiera sin conflicto entre sí — ver detalle en §6, "Migración a plugin").
  Pero implica un cambio real de mecánica: los subagentes de un plugin
  **no** viven en `.claude/agents/`, y los workflows/Routines de hoy los
  referencian por **ruta literal de archivo** (`"usa el subagente definido
  en .claude/agents/planificador.md"`) — eso deja de funcionar con un
  plugin, hay que reescribirlo a referencia por nombre. Además, en GitHub
  Actions el plugin no se autodescubre: hay que declararlo explícito
  (`plugin_marketplaces`, `plugins`) en cada paso del `claude-code-action`.
  **Decisión:** no mezclar esto con la prueba del segundo proyecto — son
  dos variables distintas (¿el checklist se replica? vs. ¿funciona la
  sintaxis de plugin?) y si algo falla no se podría distinguir cuál. El
  segundo proyecto se hace con copia manual tal cual documenta
  `Estandar_fabrica_software.md`; el plugin es una migración deliberada
  posterior, ya con receta exacta (§6).
- **Automatización con y sin IA:** las tareas mecánicas/repetitivas deberían
  resolverse con cron de servidor + n8n (sin gastar tokens de IA), y solo lo
  que requiere criterio o análisis pasa por una Routine de Claude Code. Aún
  no se ha definido cómo se reparte esto en la práctica; el candidato
  concreto más avanzado es crear Issues desde fuera de GitHub vía n8n (nodo
  nativo "Create Issue"), anotado pero sin empezar.
- **Rol de n8n, precisado (2026-08-24):** n8n solo crearía el Issue —
  nunca gestiona la conversación posterior. Como no hay clasificador
  automático de proyecto (ver primer punto de esta sección), el formulario
  o webhook que dispara n8n necesita indicar explícitamente el proyecto
  (campo select, no texto libre), y n8n resuelve proyecto → owner/repo con
  una tabla de mapeo simple (mismo patrón que empresa → `public_site_id`
  en MiComercio Chat). Todo lo que pasa después de creado el Issue —
  aprobación, retroalimentación, correcciones, y a futuro la pausa-y-
  pregunta del developer — sigue pasando **directo en GitHub**, porque los
  workflows ya están enganchados a eventos de GitHub (`issue_comment`,
  `pull_request`) y porque el `planificador` necesita el hilo completo en
  un solo lugar para poder replanificar con contexto.
- **Claude Tag (Claude en Slack):** investigado y descartado por ahora —
  existe, pero requiere plan Team/Enterprise de Anthropic (no alcanza con
  la suscripción Pro/Max actual) y no dispara el flujo propio de la fábrica
  sin integración a medida.

## 4. Modelo de calidad

| Nivel | Estándar | Estado |
|---|---|---|
| Producto (el código) — Seguridad | ISO/IEC 25010 §6, interpretado como checklist de 20 puntos (`.claude/skills/estandares-seguridad-fabrica/SKILL.md`, genérico y reutilizable) | Aplicado y evaluado sobre el piloto: gaps reales confirmados (sin rate limiting, sin cabeceras HTTP de seguridad, sin escaneo de dependencias, sin monitoreo de queries; el más relevante en la práctica, escapar contenido de usuario, con historial real de 2 fallas). El `planificador` ahora produce siempre una sección obligatoria "Impacto y riesgos" en cada plan, que toca este checklist |
| Producto (el código) — resto de características ISO 25010 | ISO/IEC 25010 | Sigue como propuesta, sin aplicar en detalle todavía |
| Proceso (la fábrica) | ISO/IEC 330xx (SPICE) o CMMI, como marco de referencia | No busca certificación formal — sigue como plantilla de referencia, no aplicada en detalle |

## 5. Qué ya está resuelto y probado

- **Ciclo completo automático**, sin operación manual intermedia,
  confirmado en vivo varias veces sobre un proyecto real: Issue → plan →
  (retroalimentación opcional) → `/aprobar` → Routine → PR → revisión
  automática → auto-corrección calibrada → merge manual. Casos reales:
  Issue #8→PR #9, Issue #14→PR #15, más PR #6, #12 y #13 (prueba sintética
  deliberada del auto-fix).
- **Plan conversacional, no instrucción de un solo turno:** antes de
  aprobar, el humano puede comentar ajustes o preguntas en el Issue tantas
  veces como quiera; el planificador lee el hilo completo y responde en
  consecuencia. Ver detalle en §2, fila 2.
- **Revisión automática de PR** (`revisar-pr.yml`): corre `revisor-codigo`,
  `validador-metricas` y `documentador` vía `Task` dentro de un
  `claude-code-action`, publica un comentario consolidado. `tester` queda
  fuera en la nube porque necesita servidor local.
- **Auto-corrección de hallazgos reales** (`corregir-hallazgos-pr.yml` +
  Routine `corregir-hallazgos-pr`): dispara solo cuando hay ≥1 hallazgo
  etiquetado "CRÍTICO" y el PR no fue corregido antes (máx. 1 corrección
  automática por PR). Umbral calibrado y confirmado a propósito (ver PR
  #13): un hallazgo "REAL" pero no crítico se deja para juicio humano.
- **Estandarización parametrizada:** `trigger_id` de ambas Routines y
  nombre del repo movidos a variables, re-probado en vivo sin diferencia de
  comportamiento.
- **Estándar de seguridad de 20 puntos** como skill reutilizable entre
  proyectos, y sección obligatoria "Impacto y riesgos" en todo plan.
- **`Estandar_fabrica_software.md`**: checklist de onboarding a un proyecto
  nuevo, listo para mostrarle a un tercero (jefe, otro dev).
- El **merge a producción sigue siendo, siempre, 100% manual** — decisión
  de diseño, no una limitación pendiente de resolver.
- Fundamentos generales ya dominados: diferencia Cowork vs. Claude Code,
  configuración de Routines (disparadores, por qué nunca tocan `main`
  directo), subagentes (campos, orquestación, ejecución en paralelo),
  Skills (personales vs. de proyecto) vs. subagentes, CLAUDE.md como
  memoria persistente.

## 6. Pendientes explícitos (orden de prioridad real)

1. **Probar el checklist de `Estandar_fabrica_software.md` en un segundo
   proyecto real** — **en curso (2026-08-24)**, repo
   `Juanjorodriguez09/WebChat_Fabrica` (copia independiente de
   `webmicomercio`, sin tocar el original, sin `.env`/token en el
   historial). Hallazgos ya confirmados, ambos corrigen la sección 1 del
   estándar:
   - **Los 4 subagentes genéricos NO son "copia tal cual"** — se leyeron
     completos y están escritos 100% para el stack del dashboard (Prisma,
     `siteId`, `DOCUMENTACION_TECNICA.md`). Hubo que reescribir el
     contenido de los cuatro para el nuevo stack (React/Vite, sin
     backend/DB), manteniendo la misma estructura/contrato de salida. Van
     en la categoría "se adapta" (§2), no en "se copia tal cual" (§1).
   - **`revisar-pr.yml` tampoco es genérico como está** — el prompt
     hardcodea `validador-metricas` y `DOCUMENTACION_TECNICA.md`. Hubo que
     quitar la invocación a `validador-metricas` (no existe subagente de
     dominio en este proyecto) y cambiar la referencia de documentación a
     `README.md`.
   Falta completar los 8 pasos de configuración (son 100% del usuario, en
   el navegador — GitHub App, label, secrets, Routines) y probar con un
   Issue real antes de decir que el estándar está confirmado.
2. **Construir "pausa y pregunta a mitad de desarrollo"** — pedido
   explícito del jefe: hoy la Routine de desarrollo nunca pausa. Diseño ya
   pensado (reutiliza el patrón de `corregir-hallazgos-pr`, que ya probó
   que una Routine puede continuar sobre una rama existente sin
   `persist_session`): el developer detecta una decisión real no prevista,
   comenta la pregunta, agrega label `esperando-humano` y termina el turno;
   un workflow nuevo dispara la misma Routine cuando alguien responde,
   continuando en la rama `claude/issue-<n>-*` existente. Sin construir
   todavía.
3. **Pilotar el revisor cruzado** (surgido de la investigación del
   2026-08-24, precisado el mismo día): **Copilot code review** es la
   opción líder — corre nativo en GitHub, revisable desde el celular, y a
   US$10/mes es la mitad de precio que la alternativa de Codex (US$20/mes,
   plan Plus, la revisión de PR en GitHub no entra en Free). Probarlo sobre
   2-3 PRs reales ya cerrados y comparar sus hallazgos contra
   `revisor-codigo` antes de activarlo como política fija. El Codex Plugin
   para Claude Code queda descartado como pieza de producción — se invoca
   local, depende de estar frente a una computadora, rompe el criterio de
   "todo se resuelve desde el celular"; sirve solo como chequeo manual
   puntual.
   **En pausa (2026-08-24): no avanzar todavía** — implica pagar, y el
   usuario primero necesita definir presupuesto con el jefe. No iniciar el
   piloto hasta que el usuario confirme que ya está definido.
4. **Crear Issues desde afuera de GitHub** (candidato: n8n, nodo nativo
   "Create Issue", con mapeo explícito proyecto → repo — ver §3) —
   anotado, no iniciado.
5. Ver en vivo el camino donde el auto-fix SÍ dispara (hallazgo etiquetado
   específicamente "CRÍTICO") — no bloqueante, solo falta el caso real.
6. Decidir canal de notificación de estado (push al celular vía Routine, o
   comentario de GitHub — ambos ya funcionan, falta decidir cuál queda
   como estándar).
7. Corregir `deploy-main.yml` heredado (apunta a secrets de Contabo que no
   existen en este clon; falla en cada push a `main` sin riesgo real porque
   nunca llega a conectar) — en espera de acceso a Contabo.

**Migración a Plugin de Claude Code (fase 2, después del segundo proyecto,
no antes):**
Receta exacta ya confirmada con documentación oficial (2026-08-24), no hay
que volver a investigarla:
- Mover `.claude/agents/{planificador,revisor-codigo,documentador,tester}.md`
  y `.claude/skills/estandares-seguridad-fabrica/SKILL.md` a la carpeta
  `agents/`/`skills/` de un plugin nuevo (`claude plugin init`), con
  manifiesto `.claude-plugin/plugin.json` versionado (`version: "X.Y.Z"`).
- Publicar ese plugin en un repo GitHub **privado** propio, usado como
  marketplace (`/plugin marketplace add tu-org/fabrica-plugins`).
- **Reescribir las referencias por ruta literal** en los prompts de
  `generar-plan.yml`, `retroalimentar-plan.yml`, y las dos Routines
  (`implementar-plan-aprobado`, `corregir-hallazgos-pr`) — de
  `"usa el subagente definido en .claude/agents/nombre.md"` a referencia
  por nombre (`nombre`) o namespace (`@agent-fabrica-plugins:nombre`).
- Agregar `plugin_marketplaces` y `plugins` como inputs explícitos en cada
  paso `claude-code-action` que hoy invoca un subagente — no se
  autodescubre en GitHub Actions.
- Actualizar `Estandar_fabrica_software.md` §1 para reflejar "instalar
  plugin" en vez de "copiar archivos tal cual", una vez validado.
- Los 3 workflows y la plantilla de Issue **siguen sin poder empaquetarse
  en el plugin** (viven en `.github/`, fuera del alcance de los plugins de
  Claude Code) — eso sigue siendo copia manual, con o sin plugin.

**De la migración real (identificados, aún sin resolver — no bloquean el
piloto de la fábrica):**
- **Characterization tests**: cómo generar una red de seguridad sobre
  código legado sin tests previos.
- **Patrón Strangler Fig**: migración incremental, conectado con el flujo
  de ramas ya definido.
- **Hooks**: mencionados en comparaciones, nunca construidos en la
  práctica.

**De decisión, no técnicos:**
- Resto de características ISO 25010 fuera de seguridad, y el marco de
  proceso SPICE/CMMI (§4) — siguen sin aplicarse en detalle.
- El alcance exacto de la migración real (¿sobre qué módulo del ERP/POS
  arranca, en qué plazo?) — el piloto de la fábrica ya está validado; esto
  es lo que falta decidir para arrancar la migración de fondo.

## 7. Próximo paso acordado

El piloto de la fábrica (etapas 1-5 del pipeline) ya está probado en vivo.
El próximo paso es cerrar la brecha entre "probado una vez" y "estándar
confirmado": replicarlo en un **segundo proyecto real** siguiendo
`Estandar_fabrica_software.md` tal cual está escrito, sin ajustes
improvisados — cualquier ajuste que haga falta es en sí mismo información
de qué le falta al estándar. En paralelo, construir "pausa y pregunta a
mitad de desarrollo" (pedido explícito del jefe, §6.2). Preprod (etapa 6)
sigue por construir y no es la prioridad inmediata.
