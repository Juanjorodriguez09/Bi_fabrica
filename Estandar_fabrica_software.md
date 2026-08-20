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

| Archivo | De dónde |
|---|---|
| `.github/ISSUE_TEMPLATE/solicitud-cambio.yml` | Este repo |
| `.github/workflows/generar-plan.yml` | Este repo |
| `.github/workflows/disparar-routine.yml` | Este repo (ya parametrizado) |
| `.github/workflows/revisar-pr.yml` | Este repo (ya parametrizado) |
| `.claude/agents/planificador.md` | Este repo |
| `.claude/agents/revisor-codigo.md` | Este repo |
| `.claude/agents/documentador.md` | Este repo (el proyecto destino necesita un doc técnico equivalente a `DOCUMENTACION_TECNICA.md`, o ajustar el nombre dentro del subagente) |
| `.claude/agents/tester.md` | Este repo (queda definido pero fuera del flujo automático, igual que acá) |
| `.claude/skills/estandares-seguridad-fabrica/SKILL.md` | Este repo — genérico a propósito, no menciona nada de este dashboard. Cada proyecto nuevo lo interpreta una vez en su propio skill de calidad (marcando aplica/no aplica/gap por punto), como se hizo acá en `modelo-calidad-iso25010` §6 |

## 2. Qué hay que adaptar o escribir a medida

- **`CLAUDE.md` del proyecto destino** — no se copia, tiene que existir y
  estar al día *antes* de prender la fábrica. Los subagentes genéricos
  (`planificador`, `revisor-codigo`, `documentador`) dependen de leerlo
  para conocer las convenciones reales del proyecto. Sin esto, la calidad
  del plan y de la revisión baja mucho.
- **Un subagente de dominio, si aplica** (`validador-metricas` en este
  repo) — es específico de este dashboard, no se reutiliza tal cual. Cada
  proyecto decide si necesita el suyo (para lógica de negocio/cálculos
  particulares) o si lo omite directamente del prompt de `revisar-pr.yml`.

## 3. Checklist de configuración (una sola vez por proyecto)

En orden — cada paso depende del anterior:

1. **Instalar la GitHub App "Claude Code"** (`github.com/apps/claude`) con
   scope solo al repo nuevo — no "All repositories". Sin esto, la action
   no puede comentar aunque el token esté bien.
2. **Crear la label `solicitud`** en el repo, manualmente (Settings →
   Labels). Los formularios de Issue *no* la crean solos aunque el YAML la
   declare — es un gotcha ya confirmado, ver
   `[[feedback_gotchas_tecnicos_fabrica]]`.
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
     implementa, abre PR, nunca mergea).
   - `corregir-hallazgos-pr` — mismo prompt que la de este repo (lee el
     número de PR del payload, corrige solo hallazgos reales/críticos
     sobre la rama existente, nunca abre PR nuevo, nunca mergea).
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
- **Notificación de estado (Slack/push/etc.)** — todavía no está resuelto
  ni siquiera en este repo piloto (ver roadmap §4, punto 6). No forma
  parte del checklist hasta que se decida un canal.

## 5. Evidencia de que esto ya se validó dos veces en el mismo repo

No es solo diseño — el ciclo completo corrió de punta a punta, sin
operación manual intermedia entre `/aprobar` y el PR revisado, en dos
oportunidades reales: Issue #8 → PR #9 (2026-08-13) e Issue #14 → PR #15
(2026-08-18, después de parametrizar los workflows). El segundo caso
confirma además que la parametrización de este documento no cambia el
comportamiento — es la misma fábrica, solo que ahora configurable por
proyecto sin tocar código.

**Pendiente antes de decir que el estándar está terminado:** probarlo en
un segundo proyecto real, no solo documentarlo (ver
`Roadmap_automatizacion_fabrica.md` §6.2, punto 4).
