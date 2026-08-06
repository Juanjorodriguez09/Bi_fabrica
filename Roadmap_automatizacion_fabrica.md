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
| 2 | Issue como entrada formal | 🟡 Construido, sin probar en vivo | `.github/ISSUE_TEMPLATE/solicitud-cambio.yml` — campos objetivo/alcance/contexto/restricciones/criterio de validación/salida esperada |
| 3 | Activación con GitHub Actions (desde el Issue) | 🟡 Construido, sin probar en vivo | `.github/workflows/generar-plan.yml`, dispara con `issues: [opened]`. Falta abrir un Issue real y ver si corre bien — depende del secret `CLAUDE_CODE_OAUTH_TOKEN` en el repo, generado con `claude setup-token` desde una cuenta con plan Pro/Max/Team/Enterprise (consume cuota de suscripción, no facturación por token — decisión tomada explícitamente para no pagar API aparte) |
| 4 | Generación de prompt estructurado | 🟡 Construido, sin probar en vivo | Subagente `.claude/agents/planificador.md` — lee `CLAUDE.md` + skills relevantes y traduce el Issue a un prompt de desarrollo con formato fijo. Invocado desde `generar-plan.yml` |
| 5 | Aprobación humana (de la intención/plan) | 🟡 Decidido, no probado en vivo | Mecanismo elegido: sesión en la nube de Claude Code + notificación push (no Remote Control local). `Contexto_fabrica_software.md` §3 y §6 lo marcan explícitamente como *"esto no se ha probado en vivo todavía"* |
| 6 | Desarrollo automatizado | 🟢 Probado, pero manual/local, no disparado por Routine | El fix de XSS (`769d0f0`) se hizo con Claude Code local. Funciona bien, pero nadie lo disparó automáticamente desde un Issue — lo inició un humano en su terminal |
| 7 | Push al repositorio | 🟢 Funciona, pero 100% manual hoy | Todos los commits del repo, incluido el de la fábrica (`97c9a24`), se pushean directo a `main` por el humano. No existe todavía el patrón "Routine → rama `claude/` → PR" que sí está *decidido* en `Contexto_fabrica_software.md` §3 |
| 8 | Revisión automática por agentes | 🟢 **Construido y probado en un caso real** | 4 subagentes existen en `.claude/agents/`: `revisor-codigo`, `validador-metricas`, `documentador`, `tester`. Se ejecutaron en cadena sobre el fix de XSS con resultados concretos y accionables (ver `feedback.md`) |
| 9 | Feedback y corrección | 🟢 **Probado en un caso real** | `feedback.md` documenta el ciclo completo: `revisor-codigo` encontró 1 hallazgo crítico + 2 menores en un primer pase, se corrigieron, y quedó verificado en un segundo pase antes de dar por cerrado el cambio |
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

El tramo **de desarrollo y push** (pasos 6 y 7) funciona, pero solo en su
forma manual/local: un humano corre Claude Code en su terminal y pushea. La
pieza que falta no es "que funcione", sino "que se dispare solo y pase por
`claude/` + PR en vez de commit directo a `main`" — que es justo la
arquitectura ya decidida en `Contexto_fabrica_software.md` §3, pendiente de
construir.

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

1. ~~**Formato de Issue como entrada formal**~~ — construido:
   `.github/ISSUE_TEMPLATE/solicitud-cambio.yml`. Falta abrir un Issue real
   para confirmar que el formulario se ve y se comporta como se espera.
2. ~~**Workflow de GitHub Actions disparado por Issue**~~ — construido:
   `.github/workflows/generar-plan.yml`, dispara con `issues: [opened]` y
   corre `anthropics/claude-code-action@v1`, autenticado con
   `CLAUDE_CODE_OAUTH_TOKEN` (consume cuota de suscripción Pro/Max, no
   facturación por token — ver nota abajo). **Pendiente antes de la
   primera prueba:** generar el token con `claude setup-token` (logueado
   con la cuenta Pro, por ahora) y guardarlo como secret `CLAUDE_CODE_OAUTH_TOKEN`
   en el repo (Settings → Secrets and variables → Actions).
   **Importante — no es "configurar y olvidar":** ese token expira al año
   y la renovación es manual, no automática — si nadie lo renueva, el
   workflow empieza a fallar en silencio con error de autenticación. Vale
   la pena poner un recordatorio (agosto 2027) el día que se genere.
3. ~~**Subagente "planificador"**~~ — construido:
   `.claude/agents/planificador.md`. Transforma el Issue en el prompt
   estructurado del paso 4, sin escribir código ni tomar decisiones de
   producto.
4. **Validar en vivo la aprobación remota** — sesión en la nube + push a
   la app móvil. Ya está *decidido* cómo hacerlo, falta *probarlo* una sola
   vez de punta a punta.
5. **Patrón Routine → rama `claude/` → PR** — hoy el desarrollo y el push
   son manuales. Falta que una Routine dispare Claude Code, trabaje en una
   rama `claude/...` y abra el PR sola, dejando el merge a un humano.
6. **Notificación de estado** — elegir un solo canal para el MVP (probable
   candidato: comentario automático en el propio Issue/PR de GitHub, que no
   requiere credenciales nuevas de Slack/Teams) y conectarlo al final del
   ciclo de revisión de agentes.
7. **Corregir y renombrar el deploy heredado** (§3) — **en espera**: requiere
   acceso a Contabo que el usuario no tiene por ahora. No bloquea nada del
   resto; se retoma cuando haya acceso.

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
1. **Cerrar la entrada del flujo en este mismo repo** — construido
   (plantilla de Issue + workflow `generar-plan.yml` + subagente
   `planificador`). Falta: (a) generar `CLAUDE_CODE_OAUTH_TOKEN` con
   `claude setup-token` y guardarlo como secret del repo, y (b) abrir un
   Issue real de prueba y confirmar que el plan que comenta el workflow es
   correcto y no escribe código ni abre PR — la sintaxis del Action se
   armó con investigación fresca de la documentación oficial, pero como
   cualquier integración nueva, la primera corrida real es la que confirma
   que quedó bien.
2. **Probar la aprobación remota una vez, en vivo,** sobre un cambio
   trivial (por ejemplo, un ajuste cosmético del dashboard), para no gastar
   la primera prueba en algo que importe si falla.
3. **Conectar el patrón Routine → `claude/` → PR** usando el mismo caso de
   prueba del punto 2, reutilizando los 4 subagentes que ya funcionan
   (`revisor-codigo`, `validador-metricas`, `documentador`, `tester`) tal
   como están — no hace falta tocarlos para esta fase.
4. **Agregar la notificación de estado** al final del ciclo de revisión,
   como comentario automático en el PR (más simple que integrar Slack/Teams
   para un primer MVP).
5. **Solo después de que ese ciclo completo funcione una vez de punta a
   punta en este repo**, extraer subagentes + skills hacia el Plugin
   reutilizable (`Contexto_fabrica_software.md` §7) y probarlo en un segundo
   proyecto.

Lo que queda fuera de esta ruta a propósito, porque ya está resuelto o no es
bloqueante para el MVP: integración de Codex como revisor cruzado, y el
reparto fino entre cron/n8n vs. Routines — ambos siguen abiertos en
`Contexto_fabrica_software.md` §6 pero no impiden avanzar en lo de arriba.
