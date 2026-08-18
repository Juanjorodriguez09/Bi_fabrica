# Roadmap: flujo de automatización de la fábrica — dónde estamos vs. dónde queremos llegar

> **Origen de este documento:** contrasta el flujo de automatización propuesto
> en una sesión con otra IA (10 pasos: Issue → GitHub Actions → prompt
> estructurado → aprobación → desarrollo → push → revisión por agentes →
> feedback → notificación) contra lo que **ya existe y está probado en este
> repo**, según evidencia real (commits, archivos, `feedback.md`). Complementa
> a `Contexto_fabrica_software.md`, que sigue siendo la referencia de
> decisiones de arquitectura tomadas para la fábrica en general.

## 1. Mapa de estado por paso del flujo

| # | Paso del flujo propuesto | Estado | Evidencia |
|---|---|---|---|
| 1 | Solicitud del cliente/humano | 🟡 Decidido, no construido | `Contexto_fabrica_software.md` §3: "quien la redacta decide en qué repo se abre el issue" — decisión tomada, ningún mecanismo formal creado todavía |
| 2 | Issue como entrada formal | 🟢 **Construido y probado en vivo** | `.github/ISSUE_TEMPLATE/solicitud-cambio.yml` — campos objetivo/alcance/contexto/restricciones/criterio de validación/salida esperada. Probado con 5 Issues reales (#1–#5) |
| 3 | Activación con GitHub Actions (desde el Issue) | 🟢 **Construido y probado en vivo** | `.github/workflows/generar-plan.yml`, dispara con `issues: [opened]`, autenticado con `CLAUDE_CODE_OAUTH_TOKEN` (consume cuota de suscripción Pro/Max, no facturación por token). Run exitoso sobre el Issue #5 (`31499851757`) |
| 4 | Generación de prompt estructurado | 🟢 **Construido y probado en vivo** | Subagente `.claude/agents/planificador.md` — lee `CLAUDE.md` + skills relevantes, investiga el código real, y traduce el Issue a un prompt de desarrollo con formato fijo. El plan del Issue #5 incluso detectó una ambigüedad real (nombre de la tarjeta KPI) y citó `DOCUMENTACION_TECNICA.md` para explicar el concepto de sesión |
| 5 | Aprobación humana (de la intención/plan) | 🟢 **Probado en vivo, con matiz importante** | Se disparó una Routine cloud real (`trig_019EaCwvP4hsHoDUk2nFJGyD`) que implementó el plan del Issue #5 de punta a punta. La notificación push **sí llegó** al celular (entrega confirmada), pero **no bloqueó nada** — llegó cuando la Routine ya había terminado (push + PR incluidos), no como gate antes de una acción consecuente. La aprobación humana real en esta prueba fue *disparar la Routine a mano después de leer el plan*, no un permiso pedido a mitad de camino. Queda abierto si existe un modo que sí pause a esperar aprobación — ver gap #4 |
| 6 | Desarrollo automatizado | 🟢 **Probado, ahora también vía Routine cloud** | El fix de XSS (`769d0f0`) se hizo con Claude Code local. Además, la Routine de prueba (§ paso 5) implementó el tooltip del Issue #5 de punta a punta en un entorno cloud (`micomercio-bi-dashboard-env`), sin intervención local — dos caminos probados: local manual, y cloud vía Routine |
| 7 | Push al repositorio | 🟢 **Probado — patrón Routine → rama → PR confirmado** | La Routine de prueba creó la rama `claude/tooltip-sesiones`, commiteó, pusheó, y abrió el PR **#6** contra `main` sin mergear — exactamente el patrón decidido en `Contexto_fabrica_software.md` §3. El merge queda, a propósito, como paso manual separado |
| 8 | Revisión automática por agentes | 🟢 **Construido, probado, y ahora 100% automático** | 4 subagentes en `.claude/agents/` (`tester` excluido de lo automático, necesita servidor local). `revisar-pr.yml` (2026-08-14) dispara solo con `pull_request: opened/synchronize` en ramas `claude/**`, corre los 3 restantes vía `Task`, publica comentario consolidado marcando cada hallazgo REAL/CRÍTICO vs COSMÉTICO/INFORMATIVO. Camino recorrido: manual en local (fix XSS) → manual con workaround `general-purpose` (PRs #6, #9, #12 — resolución por nombre de subagente sigue sin funcionar en esta sesión CLI local, causa raíz no confirmada) → 100% automático dentro de `claude-code-action` en GitHub Actions (PR #12, `synchronize`, sin workaround necesario ahí) |
| 9 | Feedback y corrección | 🟢 **Probado en cuatro casos reales; calibración del umbral de auto-corrección aclarada** | `feedback.md` (XSS) y PR #6: `revisor-codigo` encontró un desborde real de CSS + 2 menores, corregidos con una segunda Routine manual, verificado con capturas, mergeado (`44582eb`). PR #9: sin hallazgos. PR #12: único hallazgo clasificado COSMÉTICO, sin corrección disparada (correcto). **PR #13 (2026-08-18, prueba sintética deliberada):** se introdujo a propósito un bug real de seguridad (badge nuevo del header con `innerHTML` sin `escapeHtml`, inconsistente con el patrón ya usado para el mismo campo `domain`). `revisor-codigo` lo encontró y lo razonó bien — incluso detectó un segundo detalle no anticipado (`option.text` revierte el escape del DOM) — pero lo clasificó **"REAL, severidad moderada, no crítica"** (riesgo bajo real: `domain` lo carga un admin, no un visitante ni datos de tracking). Con esa etiqueta, la regla de disparo (`≥1 hallazgo REAL/CRÍTICO`) **no se activó** — 0 commits nuevos, sin segunda Routine. Corregido a mano (`textContent`) para cerrar el PR. **Conclusión:** el mecanismo de "no disparar" funciona correctamente incluso frente a un hallazgo real genuino, no solo frente a lo cosmético — el filtro es más fino de lo que parecía. Sigue sin validarse en vivo el camino donde SÍ dispara (necesita un hallazgo que el propio subagente etiquete "CRÍTICO", no solo "REAL") |
| 10 | Notificación de estado (Slack/Teams/email/GitHub) | ⚪ No abordado | No hay integración con ningún canal de notificación en el repo ni en la config de subagentes |
| — | Deploy a servidor tras push a `main` | 🔴 Heredado del repo original, hoy roto en el clon | `.github/workflows/deploy-main.yml` es una copia exacta (byte a byte) del workflow del repo original `micomercio-co/micomercio_bi_dashboard`. Verificado por la API pública de GitHub: la única ejecución en este clon (`Juanjorodriguez09/Bi_fabrica`, run `30845049803`, commit `97c9a24`) **falló en el paso "🚀 Deploy via Rsync"** — los secrets de Contabo no están configurados (o están mal) en este repo. Ver §3 |

**Leyenda:** 🟢 construido y probado · 🟡 decidido pero sin construir/probar · ⚪ no abordado todavía.

## 2. Lo que esto significa en conjunto

El tramo **medio** del flujo (revisión por agentes + feedback iterativo, pasos
8 y 9) es, hoy, la parte más madura de toda la fábrica — más que el resto,
incluido lo que la otra IA describe como "ya existe o está parcialmente
validado". Tenemos evidencia de un ciclo real, no solo el diseño.

Los dos **extremos** del flujo (entrada por Issue + arranque automático, y
salida por notificación) están en cero — ni siquiera hay decisión de diseño
tomada para la notificación, y para el disparo por Issue la decisión es
solo "cada humano elige el repo", sin mecanismo.

El tramo **de desarrollo y push** (pasos 6 y 7) ya tiene dos caminos
probados: manual/local (el fix de XSS) y ahora también vía **Routine
cloud** (rama `claude/tooltip-sesiones` → PR #6, sin mergear) — el patrón
que `Contexto_fabrica_software.md` §3 dejaba como pendiente de construir ya
está construido y confirmado en vivo. Lo que queda abierto no es si
funciona, sino si el *disparo* de esa Routine puede pasar de "el humano la
lanza a mano tras leer el plan" a "se dispara sola desde el Issue" — y si
existe un mecanismo real de aprobación *bloqueante* a mitad de camino (ver
§1 fila 5 y el gap #4), distinto de la notificación push informativa que sí
quedó confirmada.

**Un riesgo real, ya verificado — no una hipótesis:** este repo es un clon
independiente que se creó a propósito para trabajar la fábrica *sin tocar*
el repo original que ya está entregado a la empresa y en producción
(`micomercio-co/micomercio_bi_dashboard`). Al clonar, `deploy-main.yml` se
copió tal cual, con los mismos nombres de secret que usa el original
(`CONTABO_SSH_HOST`, `CONTABO_SSH_USER`, `CONTABO_SSH_PRIVATE_KEY_PRE`,
`CONTABO_SSH_DIR_MAIN_BI_DASH`). Los *valores* de esos secrets son
independientes por repo en GitHub — no se copian solos — y hoy, en este
clon, no están puestos o están mal: el único run que existe falló al
conectar/deployar. **Eso es bueno** — significa que no hay riesgo activo
ahora mismo de que un push aquí pise la producción real. Pero es una mina
dormida: si alguien copia por costumbre los mismos valores del repo
original a los secrets de este clon, el próximo push a `main` sí
deployaría de verdad, y sin confirmar el destino exacto no se puede
descartar que sea la misma carpeta que usa la empresa. La solución no es
solo "cuidado" — es la de §3: secrets nuevos y dedicados, apuntando
explícitamente a un destino de preproducción distinto, nunca reutilizar
los del original.

## 3. El deploy heredado: qué conservar, qué corregir, y por qué importa para la fábrica

Confirmado con el usuario: `deploy-main.yml` no nació con la idea de la
fábrica — existía antes, en el repo original, para poner el dashboard en
línea como funcionalidad entregada a la empresa. Al clonar el proyecto para
trabajar la fábrica aparte, el workflow vino incluido. La decisión es
**conservarlo**, no borrarlo — pero corregido, y pensado como pieza
reutilizable del patrón, no como algo específico de este repo.

**Qué corregir en este repo, concretamente:**

1. **Secrets nuevos y exclusivos de este clon** en GitHub → Settings →
   Secrets de `Juanjorodriguez09/Bi_fabrica`: `CONTABO_SSH_HOST`,
   `CONTABO_SSH_USER`, `CONTABO_SSH_PRIVATE_KEY_PRE`,
   `CONTABO_SSH_DIR_MAIN_BI_DASH`. Deben apuntar a un directorio de
   preproducción dedicado a este experimento — nunca al mismo valor que
   tiene el repo original. Si ese directorio de preprod para
   `bi_dashboard` todavía no existe en el Contabo, hay que crearlo antes.
2. **Renombrar el workflow** de "Deploy Main (Production)" a algo como
   "Deploy Preproducción" — el nombre actual es un resto del repo original
   y hoy es engañoso: este repo, por diseño, no debe tocar producción real
   nunca (mismo principio que ya aplica a la base de datos en `CLAUDE.md`:
   *"local siempre, producción nunca"* — aquí se extiende de la BD al
   deploy de código).
3. La pista más útil ya está en el propio nombre del secret: el sufijo
   `_PRE` en `CONTABO_SSH_PRIVATE_KEY_PRE` indica que la infraestructura
   real de MiComercio **ya distingue pre/prod** como convención (se
   confirma también en `micomercio-api`, que tiene `deploy_pre.yml` y
   `deploy_main.yml` separados). La fábrica no inventa un esquema nuevo —
   sigue la misma convención que ya existe en la empresa.

**Cómo encaja con la automatización nueva (pasos 6–7 del flujo, §1):** hoy
el disparador es "push directo a `main` por el humano". Cuando exista el
patrón Routine → rama `claude/` → PR (pendiente #5 en la gap list de
abajo), el disparador de este mismo deploy sigue siendo un push a `main` —
solo que ese push ya no lo hace el humano a mano, sino un merge de PR que
el humano aprobó. El deploy a preprod pasa a ser automático de punta a
punta; **la promoción a producción real sigue siendo, a propósito, un paso
100% aparte y manual** (etapa 7 del pipeline en
`Contexto_fabrica_software.md`) — este workflow nunca debe tocar esa etapa.

**Por qué esto es una pieza de fábrica, no solo de este repo:** cuando se
extraiga el Plugin reutilizable (`Contexto_fabrica_software.md` §7), el
*patrón* de este workflow (checkout → setup → rsync/deploy → reinicio del
proceso) es lo que se replica en cada proyecto nuevo — pero los *secrets*
y el *destino* nunca se comparten entre proyectos ni se heredan del repo
original de cada uno. Cada proyecto que entre a la fábrica necesita su
propio par pre/prod separado, igual que se está corrigiendo acá.

## 4. Qué falta cerrar (gap list concreto)

En orden de qué desbloquea qué:

1. ~~**Formato de Issue como entrada formal**~~ — construido y **probado
   en vivo** (`.github/ISSUE_TEMPLATE/solicitud-cambio.yml`, Issues #1–#5).
2. ~~**Workflow de GitHub Actions disparado por Issue**~~ — construido y
   **probado en vivo** (`.github/workflows/generar-plan.yml`), autenticado
   con `CLAUDE_CODE_OAUTH_TOKEN` (consume cuota de suscripción Pro/Max, no
   facturación por token). **Importante — no es "configurar y olvidar":**
   ese token expira al año y la renovación es manual, no automática — si
   nadie lo renueva, el workflow empieza a fallar en silencio con error de
   autenticación. Vale la pena poner un recordatorio (agosto 2027).
3. ~~**Subagente "planificador"**~~ — construido y **probado en vivo**
   (`.claude/agents/planificador.md`). En el Issue #5 investigó el código
   real (no solo leyó el Issue), citó `DOCUMENTACION_TECNICA.md`, y dejó
   preguntas abiertas explícitas en vez de asumir — exactamente el
   comportamiento que se le pidió.

**Cuatro fallas reales encontradas y corregidas en el camino hasta el
primer éxito (Issue #5, run `31499851757`), documentadas por si se repite
el patrón al extraer el Plugin reutilizable:**
   - Faltaba `id-token: write` en `permissions` — sin él, la action no
     puede obtener el token OIDC que necesita para autenticarse.
   - La GitHub App "Claude Code" no estaba instalada en el repo — el
     secret `CLAUDE_CODE_OAUTH_TOKEN` no es suficiente por sí solo.
   - Sin restricción, Claude intentaba `gh issue view` para releer el
     Issue (innecesario, el cuerpo ya viene en el prompt) y quedaba
     bloqueado por el muro de aprobación de Bash en CI (nadie ahí para
     aprobar) — se resolvió prohibiéndole Bash explícitamente en el prompt.
   - Con Bash prohibido, el plan se generaba perfecto pero nunca quedaba
     publicado: en "automation mode" (con `prompt` directo) la action
     **nunca** postea el resultado sola — eso solo pasa en "interactive
     mode" (menciones `@claude`), confirmado con la documentación oficial.
     Se resolvió autorizando explícitamente solo `Bash(gh issue comment *)`
     vía el input `settings`, e indicándole que ese es su último paso
     obligatorio.
4. ~~**Validar en vivo la aprobación remota**~~ — **probado**, con un
   hallazgo importante: la notificación push llega (entrega confirmada),
   pero no bloquea — la Routine corrió de punta a punta sin pausar, porque
   `allowed_tools` ya autorizaba `Bash` de antemano (a diferencia del
   GitHub Action, que exige aprobación por comando salvo que se
   pre-autorice explícitamente vía `settings`). **Abierto:** si se quiere
   el gate bloqueante literal (la IA se detiene sola a pedir aprobación
   antes de pushear/abrir PR), falta investigar si existe ese modo — probar
   una Routine sin `Bash` pre-autorizado y ver si el muro de permiso que
   surge ahí sí dispara una notificación aprobable desde el celular. No es
   bloqueante para seguir: el gate humano real de esta prueba (leer el plan
   y disparar la Routine a mano) ya cumple la intención de fondo.
5. ~~**Patrón Routine → rama `claude/` → PR**~~ — **probado en vivo, ciclo
   completo hasta merge**: Routine `trig_019EaCwvP4hsHoDUk2nFJGyD`
   implementó el plan del Issue #5, creó la rama `claude/tooltip-sesiones`,
   commiteó, pusheó, abrió el PR #6, se revisó con los 4 subagentes, se
   corrigió un hallazgo real con una segunda corrida de la Routine sobre la
   misma rama, y se mergeó a `main` — el merge en sí siguió siendo, a
   propósito, la única acción 100% manual del ciclo.
5b. ~~**Conectar el disparo: Issue aprobado → Routine automática**~~ —
   **construido y probado en vivo, ciclo completo sin operación manual
   intermedia** (Issue #8, 2026-08-13). Piezas:
   - La Routine se reescribió como **genérica** (`implementar-plan-aprobado`,
     `trig_019EaCwvP4hsHoDUk2nFJGyD`): ya no tiene una tarea hardcodeada,
     lee el número de Issue del payload de disparo, busca el plan
     estructurado en los comentarios de ese Issue, y lo implementa.
   - Label `solicitud` creada en el repo (GitHub Issue Forms **no crea
     labels automáticamente** aunque el YAML del formulario las declare —
     solo las aplica si ya existen; los Issues #1–#7 se crearon sin ella
     sin que nadie lo notara, hasta que este workflow la necesitó).
   - Token de disparo por API generado desde `claude.ai/code/routines`
     ("Add an API trigger"), guardado como secret `ROUTINE_API_TOKEN`.
   - `.github/workflows/disparar-routine.yml`: dispara con
     `issue_comment: created`, valida que el comentario sea `/aprobar` de
     alguien con permiso de escritura y que el Issue tenga la label
     `solicitud`, y hace `curl` al endpoint
     `POST api.anthropic.com/v1/claude_code/routines/{id}/fire` (API en
     research preview, header `anthropic-beta:
     experimental-cc-routine-2026-04-01`) — luego comenta de vuelta en el
     Issue con el link de seguimiento de la sesión.
   - **Prueba real de punta a punta:** Issue #8 (KPI "Visitantes") → plan
     comentado por `planificador` (con una pregunta abierta no
     bloqueante) → humano comenta `/aprobar` → GitHub Action dispara la
     Routine (14 segundos después) → Routine implementa el tooltip,
     **resuelve la pregunta abierta leyendo el código real** de
     `getSummary()` en vez de inventar la definición, generaliza por su
     cuenta el fix de desborde del PR #6 a un breakpoint nuevo (3
     columnas, no se le pidió explícitamente), abre el **PR #9**, y
     comenta de vuelta en el Issue enlazándolo. Nadie tocó nada entre el
     `/aprobar` y el PR abierto.
   - **Caso de borde ya observado y manejado correctamente:** el Issue #7
     (KPI "Sesiones únicas") generó un plan que se **negó a proceder**
     porque ese KPI no existe como tarjeta distinta de "Sesiones" — quedó
     documentado como pregunta bloqueante en vez de que el planificador
     inventara una interpretación. Ese Issue se dejó sin aprobar a
     propósito, como evidencia de que el checkpoint humano funciona
     también para frenar, no solo para avanzar.
6. **Notificación de estado** — elegir un solo canal para el MVP. Con el
   hallazgo del punto 4, ahora hay dos candidatos confirmados que funcionan
   sin credenciales nuevas: comentario automático en el Issue/PR de GitHub
   (usado ya en el paso 1), o la notificación push al celular (entrega ya
   confirmada, aunque hoy es del tipo "aviso", no interactiva) — falta
   decidir cuál usar para qué caso y conectarlo al final del ciclo de
   revisión de agentes.
7. **Corregir y renombrar el deploy heredado** (§3) — **en espera**: requiere
   acceso a Contabo que el usuario no tiene por ahora. No bloquea nada del
   resto; se retoma cuando haya acceso.

**Aclarado (2026-08-18): el filtro `startsWith(github.head_ref, 'claude/')`
en `revisar-pr.yml` es a propósito, no una limitación.** Mira la rama de
*origen* del PR, no la de destino — así que usar `develop` u otro nombre
como rama base no afecta nada. Pero un PR abierto desde una rama que un
humano cree a mano (sin el prefijo `claude/`) hoy **no** dispara revisión
ni auto-corrección — el filtro existe justamente para distinguir "esto lo
generó la fábrica" de "esto lo tocó un humano directamente", ya que la
Routine `implementar-plan-aprobado` siempre nombra sus ramas así por
convención propia. Si algún día se quiere revisión automática también
sobre ramas manuales, hay que ampliar esa condición a propósito — no es
el comportamiento por defecto hoy.

Los pasos 1–3 no dependen entre sí más que en orden lógico y se pueden
construir esta semana sobre el mismo repo. Los pasos 4–5 son los que
`Contexto_fabrica_software.md` ya marca como "no probado en vivo" — son de
validación, no de diseño. El paso 6 es el más aislado y el que menos
bloquea al resto. El foco actual es 1–6; el paso 7 queda documentado pero
pausado hasta tener acceso a Contabo.

## 5. Ruta propuesta

Coherente con el "próximo paso acordado" de `Contexto_fabrica_software.md`
§7 (validar el flujo completo sobre este proyecto real antes de extraer un
Plugin reutilizable):

0. **En espera, no ahora.** Corregir el deploy heredado (§3) requiere
   acceso al panel/servidor de Contabo que hoy el usuario no tiene — no es
   bloqueante para el resto y se retoma cuando haya acceso. Mientras tanto
   sigue siendo la mina dormida documentada en §2 (riesgo bajo mientras
   nadie copie secrets del repo original), pero no es foco de trabajo
   actual. El resto del roadmap no depende de esto.
1. ~~**Cerrar la entrada del flujo en este mismo repo**~~ — **hecho y
   confirmado en vivo** (Issue #5, run `31499851757`): plantilla de Issue
   + workflow `generar-plan.yml` + subagente `planificador` funcionando de
   punta a punta, plan publicado correctamente como comentario, sin
   escribir código ni abrir rama/PR.
2. ~~**Probar la aprobación remota una vez, en vivo**~~ — **hecho**: la
   notificación push llega, pero no bloquea (ver gap #4 en §4). Investigar
   el gate bloqueante literal queda como pendiente aparte, no bloqueante.
3. ~~**Conectar el patrón Routine → `claude/` → PR**~~ — **hecho y
   confirmado en vivo, ciclo completo**: Routine
   `trig_019EaCwvP4hsHoDUk2nFJGyD` → rama `claude/tooltip-sesiones` → PR #6
   → los 4 subagentes de revisión corrieron sobre el diff real (vía
   workaround `general-purpose`, ver §1 fila 8) → encontraron un hallazgo
   real → una segunda corrida de la misma Routine lo corrigió sobre la
   misma rama → verificado con capturas → **mergeado a `main`**
   (`44582eb`). Es el primer ciclo de la fábrica cerrado de punta a punta
   sobre un cambio real.
4. ~~**Conectar el disparo: Issue aprobado → Routine automática**~~ —
   **hecho y confirmado en vivo, sin operación manual intermedia**
   (Issue #8, 2026-08-13). `disparar-routine.yml` + Routine genérica
   `implementar-plan-aprobado` + label `solicitud`: un comentario
   `/aprobar` dispara la Routine sola vía la API de Routines
   (`POST .../routines/{id}/fire`), que implementó el tooltip de
   "Visitantes", resolvió su propia pregunta abierta leyendo el código
   real, y abrió el **PR #9** — 14 segundos entre el comentario y el
   arranque de la Routine, cero intervención humana en el medio. Con esto,
   el flujo completo (Issue → plan → aprobación → código → PR) corre solo
   de punta a punta por primera vez; solo el merge final sigue siendo, a
   propósito, 100% manual. Detalle completo en §4 gap 5b.
5. ~~**Conectar los 4 subagentes de revisión al flujo automático**~~ —
   **hecho y confirmado en vivo** (`revisar-pr.yml`, 2026-08-14): dispara
   solo con `pull_request: opened/synchronize` en ramas `claude/**`, corre
   `revisor-codigo`/`validador-metricas`/`documentador` vía `Task` dentro
   de un `claude-code-action`, publica un comentario consolidado marcando
   cada hallazgo como REAL/CRÍTICO o COSMÉTICO/INFORMATIVO. `tester` queda
   fuera (necesita servidor local). Probado sobre PR #9 (manual, con
   workaround `general-purpose`) y PR #12 (100% automático, disparado por
   `synchronize` — sin hallazgos reales, correctamente no disparó
   corrección).
6. ~~**Auto-corrección de hallazgos reales**~~ — **construida
   (2026-08-14), lógica de "no disparar" confirmada en vivo dos veces
   (PR #12: cosmético; PR #13: real-pero-moderado), disparo real
   pendiente de un caso CRÍTICO que lo amerite.** Si `revisar-pr.yml`
   encuentra ≥1 hallazgo REAL/CRÍTICO y el PR tiene 1 solo commit (nunca
   corregido automáticamente antes), dispara la Routine
   **"corregir-hallazgos-pr"** (`trig_011GvjnLZDc14GW79UtQyYUS`) vía
   `/fire`, que corrige solo eso sobre la MISMA rama (sin PR nuevo) — el
   push resultante re-dispara la revisión (`synchronize`), pero el guard
   de "más de 1 commit" evita un segundo ciclo automático. Límite: una
   sola corrección automática por PR, después queda para juicio humano.
   **Decisión explícita (2026-08-18):** dejar el umbral tal cual está —
   exigir "CRÍTICO" y no solo "REAL" es comportamiento conservador
   correcto, no un bug: evita que la fábrica reescriba código sola por
   hallazgos de bajo riesgo real que un humano puede simplemente leer y
   decidir. Ver PR #13 en fila 9 de §1 para el caso que confirmó esto.
7. **Agregar la notificación de estado** al final del ciclo de revisión,
   como comentario automático en el PR (más simple que integrar Slack/Teams
   para un primer MVP) — con el hallazgo de §4 gap #6, evaluar también usar
   la notificación push ya confirmada como canal complementario.
8. **El merge sigue siendo, a propósito, 100% manual** — decisión
   confirmada explícitamente con el usuario (2026-08-14), no solo por
   inercia: es el único checkpoint humano que queda en todo el ciclo, y el
   que va a importar de verdad el día que `deploy-main.yml` apunte a un
   servidor real (mergear pasaría a disparar un deploy). No se reconsidera
   hasta que el sistema demuestre varios ciclos estables.
9. **Condición cumplida (2026-08-18) → foco actual.** El ciclo completo
   corrió de punta a punta sin operación manual intermedia (Issue #8→PR#9),
   la revisión automática corrió sola sobre PRs reales (#9, #12, #13), y la
   lógica de auto-corrección se probó y calibró en ambos sentidos posibles
   hasta ahora (no dispara ante cosmético ni ante real-moderado — falta
   solo el caso crítico). Con eso, arranca la extracción hacia un estándar
   reutilizable — ver §6.

**Dos bugs nuevos encontrados y corregidos el 2026-08-14** (documentados en
detalle en `[[feedback_gotchas_tecnicos_fabrica]]`, memoria persistente):
invocación de subagentes en segundo plano dentro de un job de un solo
turno (Issue #10, éxito silencioso sin publicar nada), y permiso de
`Read` bloqueado fuera del checkout del repo (PR #12, mismo síntoma). Los
dos comparten un patrón: un job de CI "success" no garantiza que haya
pasado algo real — verificar siempre el resultado, no solo la conclusión
del workflow.

Lo que queda fuera de esta ruta a propósito, porque ya está resuelto o no es
bloqueante para el MVP: integración de Codex como revisor cruzado, y el
reparto fino entre cron/n8n vs. Routines — ambos siguen abiertos en
`Contexto_fabrica_software.md` §6 pero no impiden avanzar en lo de arriba.

## 6. Hacia el estándar reutilizable (aplicable a otros proyectos)

Todo lo construido hasta acá funciona, pero está **anclado a este repo
específico**: nombres de repo, IDs de environment y de Routines quedaron
escritos a mano en los workflows y en la config de las Routines. Llevarlo a
un segundo proyecto hoy significa copiar cada archivo y editarlo a mano,
no "instalar un estándar".

### 6.1 Inventario: qué es genérico ya, qué es específico de este repo

| Pieza | Hoy | Para ser reutilizable |
|---|---|---|
| `.github/ISSUE_TEMPLATE/solicitud-cambio.yml` | Genérico, sin nombres de repo | Copiar tal cual a cualquier proyecto nuevo |
| `.claude/agents/planificador.md` | Genérico — lee `CLAUDE.md` del repo donde corre, no asume nada de este dashboard | Copiar tal cual |
| `.claude/agents/revisor-codigo.md` | Genérico — revisión ISO/IEC 25010 sobre el diff | Copiar tal cual |
| `.claude/agents/documentador.md` | Genérico en estructura, pero referencia `DOCUMENTACION_TECNICA.md` por nombre | Copiar, pero el proyecto destino necesita un doc técnico equivalente (o ajustar el nombre) |
| `.claude/agents/validador-metricas.md` | **Específico de este repo** — conoce `dashboard.service.js`, cálculos de KPIs concretos | No se reutiliza tal cual; es el ejemplo de "subagente de dominio" que cada proyecto necesita escribir a medida, o simplemente omitir si no aplica |
| `.claude/agents/tester.md` | Genérico en intención, pero deshabilitado en todo el flujo automático (necesita servidor local, no disponible en cloud) | Copiar; decidir por proyecto si tiene sentido activarlo en algún punto |
| `generar-plan.yml` | Genérico — ninguna referencia a este repo en el YAML | Copiar tal cual |
| `disparar-routine.yml` | **Tiene hardcodeado** el `trigger_id` de la Routine `implementar-plan-aprobado` en la URL del `curl` | Mover el ID a un secret o variable de repo (`vars.ROUTINE_IMPLEMENTAR_ID`) en vez de texto fijo en el YAML — así el archivo es idéntico en cualquier proyecto |
| `revisar-pr.yml` | **Tiene hardcodeado** el `trigger_id` de `corregir-hallazgos-pr` en el prompt | Mismo tratamiento: mover a variable de repo |
| Routine `implementar-plan-aprobado` | **Prompt genérico** (ya no tiene tarea hardcodeada, lee el Issue del payload), pero `session_context.sources.git_repository.url` y `environment_id` son específicos de este repo | Cada proyecto crea su propia copia de la Routine apuntando a su propio repo/environment — el *prompt* se reutiliza copiando el texto, no hay forma de "compartir" una Routine entre repos |
| Routine `corregir-hallazgos-pr` | Igual que la anterior | Igual que la anterior |
| `deploy-main.yml` | Específico de este proyecto (rsync a Contabo) | No es parte del estándar de la fábrica — cada proyecto tiene su propio deploy o ninguno |

### 6.2 Qué falta construir para tener un estándar real

1. ~~**Parametrizar los dos workflows con trigger IDs hardcodeados**~~ —
   **hecho y confirmado en vivo (2026-08-18).** `disparar-routine.yml` y
   `revisar-pr.yml` ahora leen `vars.ROUTINE_IMPLEMENTAR_ID` /
   `vars.ROUTINE_CORREGIR_ID` en vez de tener los IDs escritos en el YAML;
   también se reemplazó el nombre del repo hardcodeado en los prompts por
   `${{ github.repository }}`. **Ciclo completo re-probado después del
   cambio, de punta a punta, sin ningún ajuste adicional:** Issue #14
   (tooltip "Rebote") → plan → `/aprobar` → Routine (leyendo la variable
   nueva) → PR #15 → revisión automática limpia → merge → `git pull` local
   → **confirmado visualmente en el navegador**, tooltip funcionando. La
   parametrización no cambió el comportamiento, solo de dónde salen los
   IDs — que es exactamente lo que hace que estos dos archivos ahora se
   puedan copiar a otro proyecto sin editar una sola línea.
2. **Checklist de onboarding de un proyecto nuevo** — hoy ese conocimiento
   vive repartido entre este roadmap y la memoria de Claude Code, no en un
   documento que otra persona (o yo, en otra sesión) pueda seguir sin
   re-derivar todo. Debe cubrir, en orden: instalar la GitHub App "Claude
   Code" (scope solo al repo), crear la label `solicitud`, crear un
   environment CCR para el proyecto, crear las dos Routines genéricas
   apuntando a ese environment/repo, generar y guardar sus tokens de
   disparo (`ROUTINE_API_TOKEN`, `FIX_PR_ROUTINE_API_TOKEN`) y los IDs como
   `vars` de repo, confirmar que el proyecto tiene un `CLAUDE.md` con
   convenciones reales (los subagentes genéricos dependen de que exista y
   esté actualizado).
3. **Decidir qué hacer con el subagente de dominio** (`validador-metricas`
   en este proyecto) — cada proyecto nuevo probablemente necesita el suyo
   propio (o ninguno). El estándar debe dejar claro que ese subagente es
   *opcional y a medida*, no parte del paquete base.
4. **Probarlo en un segundo proyecto real** — es la única forma de
   confirmar que el estándar realmente generaliza y no quedaron supuestos
   implícitos de este repo. Candidato natural: algún otro repo de
   MiComercio con `CLAUDE.md` ya escrito.

No se construye automáticamente por sí solo — es trabajo nuevo, deliberado,
distinto de "documentar lo que ya existe". Queda como el siguiente bloque
de trabajo después de cerrar la documentación de hoy.
