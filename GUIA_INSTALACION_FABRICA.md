# Guía de instalación — Fábrica de software

Esta guía es autocontenida: no hace falta haber leído ningún otro
documento antes. Sirve para instalar el mismo sistema en **cualquier
cuenta de GitHub y cualquier proyecto**, no solo en los repos originales.

## Qué es esto, en una frase

Un humano abre un Issue con una plantilla fija → un plan de desarrollo se
genera solo y se comenta en el Issue → el humano lo aprueba escribiendo
`/aprobar` → el código se escribe solo y se abre un Pull Request → tres
subagentes revisan ese PR solos y comentan lo que encuentran → si hay
algo real y grave, se corrige solo (una sola vez) → **el merge final
siempre lo hace un humano, nunca es automático**.

## Qué necesitás antes de empezar

- Una cuenta de GitHub con permisos de administrador sobre el/los
  repo(s) que querés meter a la fábrica (para crear secrets, variables,
  labels, instalar la GitHub App).
- Una suscripción a Claude Code (plan Pro o Max) — de ahí sale el token
  que usan los workflows para invocar a Claude.
- Acceso a `claude.ai/code` para crear "Environments" (entornos en la
  nube) y "Routines" (rutinas programadas).
- Una cuenta de Telegram, **solo si** vas a instalar la Parte B (agente
  PM diario) y querés el canal de Telegram.

## Cómo está organizada esta guía

- **Parte A** — instala el pipeline de desarrollo en **un** proyecto
  (Issue → plan → aprobación humana → desarrollo → revisión → PR).
  Repetí esta parte una vez por cada repo que quieras sumar a la
  fábrica. Es la única parte estrictamente necesaria — todo lo demás es
  opcional y se apoya en esta.
- **Parte B** — instala el agente que revisa el estado de **todos** los
  proyectos una vez al día (Issues pendientes, PRs por revisar, cosas
  trabadas) y lo publica en un dashboard visual. Se instala **una sola
  vez** para toda la cuenta, no por proyecto.
- **Parte C** — instala el Coordinador: reemplaza que apruebes cada
  plan a mano (y, con su incremento C.7, que decidas a mano si pedir un
  ajuste tras la revisión de un PR). Se instala **una sola vez** para
  toda la cuenta.
- **Parte D** — hace que los planes clasificados como más riesgosos
  (`esfuerzo-grande`) se implementen con un modelo de IA más capaz. Por
  proyecto, opcional.
- **Parte E** — el paso a un servidor real (cPanel) para tener la app
  corriendo de verdad en ambientes de desarrollo/preproducción, más los
  gotchas de plataforma encontrados en el camino. Por proyecto,
  independiente de las demás partes (no necesita ninguna de ellas
  instalada primero).

Cada parte de la B a la E es independiente y opcional — instalá solo las
que te interesen, en cualquier orden, siempre que la Parte A del
proyecto correspondiente ya exista.

---

# PARTE A — Pipeline de desarrollo (por cada proyecto)

## A.0 Antes de tocar nada: escribir `CLAUDE.md`

Este archivo tiene que existir en la raíz del repo **antes** de prender
la fábrica. Los subagentes que vas a crear en el paso A.3 lo leen para
saber las convenciones reales del proyecto (stack, estructura de
carpetas, patrones de código, qué NO existe todavía). Sin esto, la
calidad de los planes y las revisiones baja mucho.

No hay una plantilla única — depende del proyecto — pero como mínimo
tiene que responder:

- ¿Qué es este proyecto? (una descripción corta, en lenguaje simple)
- Stack técnico (lenguaje, framework, base de datos, cómo se corre
  localmente)
- Convenciones de código reales que ya sigue el proyecto (no las que te
  gustaría que siguiera)
- Qué NO existe todavía (tests, TypeScript, CI, lo que sea) — para que
  ningún subagente lo asuma ni lo señale como "falta" en cada revisión

Si no sabés por dónde empezar, abrí una sesión de Claude Code en el repo
y pedile: *"Leé todo el código de este repo y escribime un CLAUDE.md
completo con la estructura de un archivo de convenciones para agentes de
IA: qué es el proyecto, stack, convenciones de código reales que ya sigue
(no ideales), y qué no existe todavía (tests, CI, etc.)."*

## A.1 Copiar estos archivos tal cual (sin editar nada)

Creá estos archivos exactamente como están acá. Son genéricos — no
mencionan ningún proyecto concreto.

### `.github/ISSUE_TEMPLATE/solicitud-cambio.yml`

```yaml
name: Solicitud de cambio
description: Pide un ajuste, mejora o funcionalidad nueva
title: "[Solicitud]: "
labels: ["solicitud"]
body:
  - type: markdown
    attributes:
      value: |
        Contá qué necesitás, con tus palabras — no hace falta llenar todo.
        Solo "Objetivo" es obligatorio. El resto es opcional: si lo dejás
        vacío, el planificador va a investigar el código para completarlo,
        o te va a preguntar en el plan si de verdad hace falta que lo
        definas vos. Y una vez que el plan quede comentado, podés seguir
        conversando ahí mismo — cualquier comentario que no sea `/aprobar`
        se toma como ajuste, y el plan se vuelve a generar con eso en
        cuenta, tantas veces como haga falta antes de aprobar.

  - type: textarea
    id: objetivo
    attributes:
      label: Objetivo
      description: Qué se quiere lograr, con tus propias palabras. Es el único campo obligatorio.
      placeholder: "Ej: el cliente me pidió poder filtrar por rango de edad en la sección de audiencia"
    validations:
      required: true

  - type: textarea
    id: alcance
    attributes:
      label: Alcance (opcional)
      description: Qué SÍ incluye este cambio y qué explícitamente NO, si ya lo tenés claro.
    validations:
      required: false

  - type: textarea
    id: contexto
    attributes:
      label: Contexto (opcional)
      description: Por qué se pide esto, quién lo pidió, o cualquier antecedente relevante.
    validations:
      required: false

  - type: textarea
    id: restricciones
    attributes:
      label: Restricciones de calidad (opcional)
      description: Reglas que no se pueden romper para este cambio, más allá de las que ya aplican siempre (ver CLAUDE.md).
    validations:
      required: false

  - type: textarea
    id: criterio_validacion
    attributes:
      label: Criterio de validación (opcional)
      description: Cómo se sabe que el cambio quedó bien hecho, si ya lo tenés claro. Si no, el planificador lo propone.
    validations:
      required: false

  - type: textarea
    id: salida_esperada
    attributes:
      label: Salida esperada (opcional)
      description: Qué se espera ver al final (endpoint nuevo, cambio visual, reporte, etc.), si ya lo tenés claro.
    validations:
      required: false
```

**Antes de usarlo:** cambiá el `name:` del primer campo si querés
personalizar el título del formulario en la UI de GitHub. No es
obligatorio, es solo estético.

### `.github/workflows/generar-plan.yml`

```yaml
name: Generar plan de desarrollo desde Issue

on:
  issues:
    types: [opened]

permissions:
  contents: read
  issues: write
  id-token: write

jobs:
  generar_plan:
    runs-on: ubuntu-latest
    steps:
      - name: Verificar label "solicitud"
        id: check
        run: |
          HAS_LABEL=$(jq -r '.issue.labels | map(.name == "solicitud") | any' "$GITHUB_EVENT_PATH")
          echo "has_label=$HAS_LABEL" >> "$GITHUB_OUTPUT"

      - name: 🚚 Checkout Code
        if: steps.check.outputs.has_label == 'true'
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: 🧠 Planificador — generar plan estructurado
        if: steps.check.outputs.has_label == 'true'
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true
          settings: |
            {
              "permissions": {
                "allow": ["Bash(gh issue comment *)", "Bash(gh issue edit *)", "Write"]
              }
            }
          prompt: |
            Usa el subagente planificador definido en .claude/agents/planificador.md
            para analizar la siguiente solicitud (Issue #${{ github.event.issue.number }}
            de este repo, título: "${{ github.event.issue.title }}") y generar el prompt
            de desarrollo estructurado según el formato de salida que ese subagente
            define (Objetivo, Alcance, Contexto, Archivos a tocar, Restricciones
            de calidad, Criterio de validación, Preguntas abiertas si aplica).

            IMPORTANTE sobre cómo invocar al subagente: este es un job de GitHub
            Actions de un solo turno, sin sesión interactiva después — NO existe un
            "más tarde" en el que puedas continuar. Invoca al subagente planificador
            de forma SÍNCRONA/bloqueante (NO en segundo plano, NO como tarea async) y
            espera su resultado completo dentro de este mismo turno antes de seguir.
            Si lo lanzas en segundo plano y terminas tu turno diciendo "seguirá en
            background", el job se completa igual y el plan nunca se genera ni se
            publica — eso ya pasó una vez y es exactamente lo que no debes repetir.

            El cuerpo completo del Issue ya está incluido abajo, tal cual. NO ejecutes
            `gh issue view`, git, ni ningún otro comando para volver a consultarlo —
            todo lo que necesitas ya está aquí o se lee con Read/Grep/Glob dentro del
            repo ya clonado.

            Antes de planificar, lee CLAUDE.md y los skills relevantes en
            .claude/skills/ tal como indica el subagente planificador.

            NO escribas ni modifiques código. NO abras rama ni Pull Request.

            Cuando el subagente planificador te devuelva el plan, tu ÚLTIMO paso
            obligatorio es publicarlo como comentario en este mismo Issue, para que
            un humano lo apruebe antes de que empiece cualquier desarrollo. El único
            comando de Bash autorizado en este entorno es `gh issue comment` — usa
            exactamente:

            ```
            gh issue comment ${{ github.event.issue.number }} --body-file <ruta-a-un-archivo-temporal-con-el-plan>
            ```

            (escribe el plan a un archivo temporal con la herramienta Write antes de
            correr ese comando). Ningún otro comando de Bash está autorizado y quedará
            bloqueado — no lo intentes. La tarea no está completa hasta que el
            comentario quede publicado en el Issue.

            CRÍTICO: ejecutá `gh issue comment` **exactamente una sola vez, con el plan
            completo ya terminado**. No lo uses para probar, para verificar que el
            comando funciona, ni para publicar un borrador corto antes del definitivo —
            cada ejecución publica un comentario real y visible, no hay forma de
            "probar en seco". Si el plan es largo, igual va completo en un solo
            `--body-file`, nunca partido en varias llamadas. Escribí el archivo
            completo con Write, revisalo vos mismo antes, y recién ahí ejecutá el
            comando una única vez.

            Después de publicar el comentario, agregá al Issue la label de esfuerzo
            que corresponda según lo que el subagente planificador determinó en su
            sección "Extensión del plan" (pedido chico o grande):

            ```
            gh issue edit ${{ github.event.issue.number }} --add-label "esfuerzo-chico"
            ```
            o
            ```
            gh issue edit ${{ github.event.issue.number }} --add-label "esfuerzo-grande"
            ```

            Ejecutá solo UNA de las dos, la que corresponda. Si el comando falla
            porque la label no existe en este repo, no lo intentes de nuevo ni falles
            en silencio — está bien, la tarea ya se completó con el comentario del
            plan publicado.

            Cuerpo del Issue:
            ${{ github.event.issue.body }}
```

### `.github/workflows/retroalimentar-plan.yml`

```yaml
name: Retroalimentar plan antes de aprobar

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write
  id-token: write

jobs:
  retroalimentar_plan:
    if: >
      github.event.issue.pull_request == null &&
      github.event.comment.user.type != 'Bot' &&
      contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
      !startsWith(github.event.comment.body, '/aprobar') &&
      !startsWith(github.event.comment.body, '/continuar') &&
      !contains(github.event.comment.body, 'Generated by [Claude Code]')
    runs-on: ubuntu-latest
    steps:
      - name: 🚚 Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Verificar label "solicitud"
        id: check
        run: |
          HAS_LABEL=$(jq -r '.issue.labels | map(.name == "solicitud") | any' "$GITHUB_EVENT_PATH")
          echo "has_label=$HAS_LABEL" >> "$GITHUB_OUTPUT"

      - name: Traer el hilo completo del Issue (cuerpo + todos los comentarios)
        if: steps.check.outputs.has_label == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue view ${{ github.event.issue.number }} --repo ${{ github.repository }} \
            --json title,body,comments > issue-thread.json
          echo "Comentarios en el hilo: $(jq '.comments | length' issue-thread.json)"

      - name: Verificar que todavía no se aprobó
        id: approved_check
        if: steps.check.outputs.has_label == 'true'
        run: |
          ALREADY_APPROVED=$(jq -r '[.comments[].body] | map(startswith("/aprobar")) | any' issue-thread.json)
          echo "already_approved=$ALREADY_APPROVED" >> "$GITHUB_OUTPUT"

      - name: 🔁 Replanificar con el ajuste del humano
        if: steps.check.outputs.has_label == 'true' && steps.approved_check.outputs.already_approved == 'false'
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true
          settings: |
            {
              "permissions": {
                "allow": ["Bash(gh issue comment *)", "Write"]
              }
            }
          prompt: |
            Estás retroalimentando el plan de desarrollo del Issue #${{ github.event.issue.number }}
            de este repo (${{ github.repository }}). Ya existe un plan anterior, generado por el
            subagente planificador, comentado en este mismo Issue — y un humano acaba de dejar un
            comentario nuevo con un ajuste, pregunta o corrección sobre ese plan.

            El hilo completo (título, cuerpo original del Issue, y TODOS los comentarios en orden
            cronológico — incluido el plan anterior y el comentario de ajuste más reciente) ya está
            en el archivo issue-thread.json, en la raíz de este checkout — léelo con la herramienta
            Read. NO ejecutes `gh issue view`, `git`, ni ningún otro comando para volver a
            consultarlo, ya lo tenés completo ahí.

            Usa el subagente planificador definido en .claude/agents/planificador.md para generar
            una versión ACTUALIZADA del plan de desarrollo, siguiendo su mismo formato de salida de
            siempre (Objetivo, Alcance, Contexto, Archivos a tocar, Restricciones de calidad,
            Criterio de validación, Preguntas abiertas si aplica). La actualización debe partir del
            plan anterior (no lo reescribas desde cero si no hace falta) e incorporar explícitamente
            el ajuste que acaba de pedir el humano en su comentario más reciente del hilo. Si el
            comentario del humano es en realidad una pregunta o no aporta un ajuste real al plan,
            respondé eso mismo con claridad en el nuevo comentario, sin inventar un cambio que no
            pidieron.

            IMPORTANTE sobre cómo invocar al subagente: este es un job de GitHub Actions de un solo
            turno, sin sesión interactiva después. Invocalo de forma SÍNCRONA/bloqueante (NO en
            segundo plano, NO como tarea async) y esperá su resultado completo antes de seguir.

            Antes de replanificar, leé CLAUDE.md y los skills relevantes en .claude/skills/, tal
            como indica el subagente planificador.

            NO escribas ni modifiques código. NO abras rama ni Pull Request. NO decidas vos si el
            plan queda aprobado — esa decisión es exclusivamente del humano, comentando `/aprobar`
            en un comentario aparte.

            Cuando tengas el plan actualizado, tu ÚLTIMO paso obligatorio es publicarlo como un
            NUEVO comentario en este Issue (no reemplaza al anterior, queda como historial de la
            conversación) con exactamente:

            ```
            gh issue comment ${{ github.event.issue.number }} --body-file <ruta-a-un-archivo-temporal-con-el-plan>
            ```

            Ningún otro comando de Bash está autorizado y quedará bloqueado — no lo intentes. La
            tarea no está completa hasta que el comentario quede publicado.

            CRÍTICO: ejecutá `gh issue comment` **exactamente una sola vez, con el plan
            actualizado completo ya terminado**. No lo uses para probar, para verificar que el
            comando funciona, ni para publicar un borrador corto antes del definitivo — cada
            ejecución publica un comentario real y visible, no hay forma de "probar en seco". Si
            el plan es largo, igual va completo en un solo `--body-file`, nunca partido en varias
            llamadas. Escribí el archivo completo con Write, revisalo vos mismo antes, y recién
            ahí ejecutá el comando una única vez.
```

### `.github/workflows/disparar-routine.yml`

```yaml
name: Disparar Routine al aprobar plan

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write

jobs:
  disparar_routine:
    if: >
      github.event.issue.pull_request == null &&
      contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
      (github.event.comment.body == '/aprobar' || startsWith(github.event.comment.body, '/aprobar'))
    runs-on: ubuntu-latest
    steps:
      - name: Verificar que el Issue tiene la label "solicitud"
        id: check
        run: |
          HAS_LABEL=$(jq -r '.issue.labels | map(.name == "solicitud") | any' "$GITHUB_EVENT_PATH")
          echo "has_label=$HAS_LABEL" >> "$GITHUB_OUTPUT"

      - name: 🚀 Disparar Routine vía API
        if: steps.check.outputs.has_label == 'true'
        id: fire
        run: |
          RESPONSE=$(curl -s -X POST "https://api.anthropic.com/v1/claude_code/routines/${{ vars.ROUTINE_IMPLEMENTAR_ID }}/fire" \
            -H "Authorization: Bearer ${{ secrets.ROUTINE_API_TOKEN }}" \
            -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
            -H "anthropic-version: 2023-06-01" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"Issue #${{ github.event.issue.number }} de ${{ github.repository }} fue aprobado por ${{ github.event.comment.user.login }} (comentario /aprobar). Implementa el plan de desarrollo ya comentado en ese Issue, siguiendo tus instrucciones.\"}")
          echo "$RESPONSE"
          echo "session_url=$(echo "$RESPONSE" | jq -r '.claude_code_session_url // empty')" >> "$GITHUB_OUTPUT"

      - name: Comentar confirmación en el Issue
        if: steps.check.outputs.has_label == 'true' && steps.fire.outputs.session_url != ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue comment ${{ github.event.issue.number }} --repo ${{ github.repository }} \
            --body "🚀 Plan aprobado — Routine disparada para implementarlo. Seguimiento: ${{ steps.fire.outputs.session_url }}"

      - name: Avisar si faltó la label "solicitud"
        if: steps.check.outputs.has_label != 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue comment ${{ github.event.issue.number }} --repo ${{ github.repository }} \
            --body "⚠️ No disparé la Routine: este Issue no tiene la label \`solicitud\` (la que agrega automáticamente la plantilla solicitud-cambio.yml). Si esto no viene de esa plantilla, no hay un plan estructurado que implementar."
```

### `.github/workflows/ajustar-pr.yml`

```yaml
name: Ajustar PR tras revisión humana

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  ajustar_pr:
    if: >
      github.event.issue.pull_request != null &&
      github.event.comment.user.type != 'Bot' &&
      contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
      startsWith(github.event.comment.body, '/ajustar')
    runs-on: ubuntu-latest
    steps:
      - name: Obtener la rama del PR
        id: pr
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          HEAD_REF=$(gh pr view ${{ github.event.issue.number }} --repo ${{ github.repository }} --json headRefName -q '.headRefName')
          echo "head_ref=$HEAD_REF" >> "$GITHUB_OUTPUT"

      - name: 🔧 Disparar Routine de corrección vía API
        id: fire
        env:
          FIX_PR_ROUTINE_API_TOKEN: ${{ secrets.FIX_PR_ROUTINE_API_TOKEN }}
          PR_NUMBER: ${{ github.event.issue.number }}
          REPO: ${{ github.repository }}
          HEAD_REF: ${{ steps.pr.outputs.head_ref }}
          COMMENT_USER: ${{ github.event.comment.user.login }}
          COMMENT_BODY: ${{ github.event.comment.body }}
        run: |
          PAYLOAD=$(jq -n \
            --arg pr "$PR_NUMBER" \
            --arg repo "$REPO" \
            --arg ref "$HEAD_REF" \
            --arg user "$COMMENT_USER" \
            --arg body "$COMMENT_BODY" \
            '{text: ("PR #" + $pr + " de " + $repo + " (rama " + $ref + ") tiene un ajuste pedido por un humano (" + $user + "): " + $body + ". Aplicá el ajuste directamente sobre esa rama, commiteá y empujá — NO abras un PR nuevo, este PR ya existe y se actualiza solo con el push.")}')
          RESPONSE=$(curl -s -X POST "https://api.anthropic.com/v1/claude_code/routines/${{ vars.ROUTINE_CORREGIR_ID }}/fire" \
            -H "Authorization: Bearer $FIX_PR_ROUTINE_API_TOKEN" \
            -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
            -H "anthropic-version: 2023-06-01" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD")
          echo "$RESPONSE"
          echo "session_url=$(echo "$RESPONSE" | jq -r '.claude_code_session_url // empty')" >> "$GITHUB_OUTPUT"

      - name: Comentar confirmación en el PR
        if: steps.fire.outputs.session_url != ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr comment ${{ github.event.issue.number }} --repo ${{ github.repository }} \
            --body "🔧 Ajuste solicitado — Routine disparada sobre esta misma rama. Seguimiento: ${{ steps.fire.outputs.session_url }}"
```

### `.github/workflows/continuar-plan-pausado.yml`

```yaml
name: Continuar plan pausado

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write

jobs:
  continuar_plan:
    if: >
      github.event.issue.pull_request == null &&
      github.event.comment.user.type != 'Bot' &&
      contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
      startsWith(github.event.comment.body, '/continuar') &&
      contains(github.event.issue.labels.*.name, 'esperando-humano')
    runs-on: ubuntu-latest
    steps:
      - name: Sacar la label esperando-humano (evita re-disparos mientras trabaja)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue edit ${{ github.event.issue.number }} --repo ${{ github.repository }} \
            --remove-label "esperando-humano"

      - name: ▶️ Continuar Routine vía API
        id: fire
        env:
          ROUTINE_API_TOKEN: ${{ secrets.ROUTINE_API_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          REPO: ${{ github.repository }}
          COMMENT_USER: ${{ github.event.comment.user.login }}
        run: |
          PAYLOAD=$(jq -n \
            --arg n "$ISSUE_NUMBER" \
            --arg repo "$REPO" \
            --arg user "$COMMENT_USER" \
            '{text: ("Issue #" + $n + " de " + $repo + " estaba pausado esperando respuesta humana. " + $user + " respondió en un comentario nuevo del Issue — leé el hilo completo del Issue (tu propia pregunta y la respuesta más reciente) y CONTINUÁ el desarrollo en la rama existente claude/issue-" + $n + "-* (no crees una rama nueva, no reinicies el trabajo ya hecho). Si no encontrás esa rama, algo salió mal: comentalo en el Issue y detenete ahí, no arranques de cero.")}')
          RESPONSE=$(curl -s -X POST "https://api.anthropic.com/v1/claude_code/routines/${{ vars.ROUTINE_IMPLEMENTAR_ID }}/fire" \
            -H "Authorization: Bearer $ROUTINE_API_TOKEN" \
            -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
            -H "anthropic-version: 2023-06-01" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD")
          echo "$RESPONSE"
          echo "session_url=$(echo "$RESPONSE" | jq -r '.claude_code_session_url // empty')" >> "$GITHUB_OUTPUT"

      - name: Comentar confirmación en el Issue
        if: steps.fire.outputs.session_url != ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue comment ${{ github.event.issue.number }} --repo ${{ github.repository }} \
            --body "▶️ Retomando el desarrollo con tu respuesta. Seguimiento: ${{ steps.fire.outputs.session_url }}"
```

### `.claude/skills/estandares-seguridad-fabrica/SKILL.md`

```markdown
---
name: estandares-seguridad-fabrica
description: Checklist de seguridad genérico de la fábrica de software — 20 puntos que aplican a cualquier proyecto, independientemente del stack. No está adaptado a ningún repo específico; cada proyecto lo interpreta en su propio skill de calidad. Úsalo como referencia al planificar (impacto/riesgos) y al revisar código.
---

# Estándar de seguridad de la fábrica (genérico, reutilizable entre proyectos)

Estos 20 puntos son el piso mínimo de seguridad que cualquier proyecto de
la fábrica debe evaluar — no todos aplican a todos los stacks (un proyecto
sin autenticación propia no "hashea contraseñas" porque no las maneja),
pero **todos deben evaluarse explícitamente como aplica/no aplica/gap
encontrado**, nunca omitirse en silencio. Un ítem marcado "no aplica" sin
explicar por qué es indistinguible de un ítem que nadie revisó.

Este documento es intencionalmente genérico — no menciona ningún repo
concreto. Cada proyecto que entra a la fábrica copia este archivo tal cual
y lo interpreta en su propio skill de calidad.

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
```

### `.github/ISSUE_TEMPLATE/consulta-asesoria.yml`

Segundo tipo de Issue, aparte de "Solicitud de cambio" — para pedidos de
asesoría/recomendación que NO implican tocar código.

```yaml
name: Consulta o asesoría
description: Pedí una recomendación, evaluación o explicación — no implica escribir código
title: "[Consulta]: "
labels: ["consulta"]
body:
  - type: markdown
    attributes:
      value: |
        Usá esto cuando necesitás una opinión, evaluación o explicación —
        no un cambio de código. Por ejemplo: "¿conviene usar X o Y para
        esto?", "¿esto que hicimos es seguro?", "¿por qué el endpoint Z se
        comporta así?". Vas a recibir una respuesta única con el análisis
        y una recomendación, sin plan de desarrollo ni `/aprobar` — si de
        la respuesta surge que hace falta un cambio real, abrí después un
        Issue de "Solicitud de cambio" aparte.

  - type: textarea
    id: pregunta
    attributes:
      label: Pregunta o tema
      description: Qué necesitás que se evalúe, recomiende o explique.
      placeholder: "Ej: ¿conviene mover el filtro de fechas al backend o dejarlo en el frontend como está ahora?"
    validations:
      required: true

  - type: textarea
    id: contexto
    attributes:
      label: Contexto (opcional)
      description: Por qué surge esta duda, o cualquier antecedente relevante.
    validations:
      required: false
```

### `.github/workflows/generar-asesoria.yml`

```yaml
name: Responder consulta de asesoría

on:
  issues:
    types: [opened]

permissions:
  contents: read
  issues: write
  id-token: write

jobs:
  responder_asesoria:
    runs-on: ubuntu-latest
    steps:
      - name: Verificar label "consulta"
        id: check
        run: |
          HAS_LABEL=$(jq -r '.issue.labels | map(.name == "consulta") | any' "$GITHUB_EVENT_PATH")
          echo "has_label=$HAS_LABEL" >> "$GITHUB_OUTPUT"

      - name: 🚚 Checkout Code
        if: steps.check.outputs.has_label == 'true'
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: 💬 Asesor — responder la consulta
        if: steps.check.outputs.has_label == 'true'
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true
          settings: |
            {
              "permissions": {
                "allow": ["Bash(gh issue comment *)", "Write"]
              }
            }
          prompt: |
            Usa el subagente asesor definido en .claude/agents/asesor.md para
            responder la siguiente consulta (Issue #${{ github.event.issue.number }}
            de este repo, título: "${{ github.event.issue.title }}"), siguiendo el
            formato de salida que ese subagente define.

            Esto NO es una solicitud de cambio de código — es una consulta/pedido de
            asesoría. NO generes un plan de desarrollo, NO escribas código, NO abras
            rama ni Pull Request, bajo ninguna circunstancia, aunque la respuesta
            implique que "convendría" hacer un cambio — en ese caso, decilo como
            recomendación dentro de la respuesta, no lo implementes.

            IMPORTANTE sobre cómo invocar al subagente: este es un job de GitHub
            Actions de un solo turno, sin sesión interactiva después — NO existe un
            "más tarde" en el que puedas continuar. Invoca al subagente asesor de
            forma SÍNCRONA/bloqueante (NO en segundo plano, NO como tarea async) y
            espera su resultado completo dentro de este mismo turno antes de seguir.
            Si lo lanzas en segundo plano y terminas tu turno diciendo "voy a esperar
            su respuesta" o "seguirá en background", el job se completa igual y la
            respuesta nunca se genera ni se publica — eso ya pasó una vez y es
            exactamente lo que no debes repetir.

            El cuerpo completo del Issue ya está incluido abajo, tal cual. NO
            ejecutes `gh issue view`, git, ni ningún otro comando para volver a
            consultarlo.

            Cuando el subagente asesor te devuelva la respuesta, tu ÚLTIMO paso
            obligatorio es publicarla como comentario en este mismo Issue:

            ```
            gh issue comment ${{ github.event.issue.number }} --body-file <ruta-a-un-archivo-temporal-con-la-respuesta>
            ```

            (escribí la respuesta a un archivo temporal con Write antes de correr
            ese comando). Ningún otro comando de Bash está autorizado. La tarea no
            está completa hasta que el comentario quede publicado.

            CRÍTICO: ejecutá `gh issue comment` **exactamente una sola vez, con la
            respuesta completa ya terminada** — no hay forma de "probar en seco",
            cada ejecución publica un comentario real y visible.

            Cuerpo del Issue:
            ${{ github.event.issue.body }}
```

## A.2 Copiar este archivo con 2 líneas a ajustar

### `.github/workflows/revisar-pr.yml`

```yaml
name: Revisar PR abierto por Routine

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write
  issues: write
  id-token: write

jobs:
  revisar_pr:
    if: startsWith(github.head_ref, 'claude/')
    runs-on: ubuntu-latest
    steps:
      - name: 🚚 Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Traer el diff del PR
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr diff ${{ github.event.pull_request.number }} --repo ${{ github.repository }} > pr-diff.txt
          echo "Líneas del diff: $(wc -l < pr-diff.txt)"

      - name: 🔍 Revisión con subagentes
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true
          settings: |
            {
              "permissions": {
                "allow": ["Bash(gh pr comment *)", "Bash(curl *)", "Write"]
              }
            }
          prompt: |
            Estás revisando el PR #${{ github.event.pull_request.number }} del repo
            `${{ github.repository }}`, rama `${{ github.head_ref }}` contra `main`,
            título: "${{ github.event.pull_request.title }}". Este PR tiene
            ${{ github.event.pull_request.commits }} commit(s) hasta ahora.

            El diff completo de este PR ya está escrito en el archivo pr-diff.txt en
            la raíz de este mismo checkout (ruta relativa al repo, NO en /tmp — fuera
            del checkout no tienes permiso de lectura automático) — léelo con la
            herramienta Read antes de continuar. NO ejecutes `gh pr diff`, `git diff`
            ni ningún otro comando para volver a obtenerlo, ya lo tienes.

            Corre estos subagentes de proyecto sobre ese diff, usando la
            herramienta Task con el `subagent_type` exacto (ya están definidos en
            .claude/agents/ de este repo, invócalos directamente):

            1. `revisor-codigo` — revisión de calidad del diff.
            2. `documentador` — para confirmar si la documentación técnica del
               proyecto necesita actualizarse (dile explícitamente que NO aplique
               ningún cambio, solo diagnostique).

            [[VER NOTA 1 ABAJO SOBRE UN TERCER SUBAGENTE OPCIONAL]]

            NO invoques `tester` — no hay servidor local disponible en este entorno
            cloud.

            IMPORTANTE — no intentes verificar nada corriendo servicios: este entorno
            de GitHub Actions NO tiene Docker, base de datos, ni el servidor de la app
            corriendo, y nunca los va a tener. NO intentes levantar el servidor ni
            ningún comando para "probar" el cambio en ejecución — ninguno de esos
            comandos está autorizado y vas a perder tiempo del job entero chocando
            contra el muro de aprobación sin que nadie pueda aprobarlo. Tu única
            fuente de verdad es la lectura estática del código en pr-diff.txt y el
            resto del checkout — toda la revisión se hace por lectura, nunca por
            ejecución.

            IMPORTANTE sobre cómo invocar cada subagente: este es un job de GitHub
            Actions de un solo turno, sin sesión interactiva después — NO existe un
            "más tarde" en el que puedas continuar. Invoca cada subagente de forma
            SÍNCRONA/bloqueante (NO en segundo plano, NO como tarea async) y espera
            su resultado completo antes de seguir con el siguiente.

            Cuando tengas los resultados, escribe UN solo comentario consolidado
            (más severo primero, con secciones claras por subagente, marcando
            explícitamente cada hallazgo como REAL/CRÍTICO o COSMÉTICO/INFORMATIVO)
            a un archivo temporal con Write, y publícalo con:

            ```
            gh pr comment ${{ github.event.pull_request.number }} --body-file <ruta-del-archivo>
            ```

            Después de publicar el comentario, decidí si corresponde disparar una
            corrección automática, con esta regla exacta:

            - Si NO hay ningún hallazgo REAL/CRÍTICO (solo cosméticos, informativos, o
              ninguno) → no hagas nada más, terminaste.
            - Si SÍ hay al menos un hallazgo REAL/CRÍTICO, pero este PR ya tiene más de
              1 commit (${{ github.event.pull_request.commits }} > 1, es decir ya se
              corrigió automáticamente antes) → no dispares otra corrección, ya se usó
              el único intento automático permitido; deja el comentario para que un
              humano decida. Terminaste.
            - Si SÍ hay al menos un hallazgo REAL/CRÍTICO Y este PR tiene exactamente 1
              commit (nunca se corrigió automáticamente antes) → disparás la Routine de
              corrección UNA sola vez, ejecutando exactamente:

              ```
              curl -X POST "https://api.anthropic.com/v1/claude_code/routines/${{ vars.ROUTINE_CORREGIR_ID }}/fire" \
                -H "Authorization: Bearer $FIX_PR_ROUTINE_API_TOKEN" \
                -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
                -H "anthropic-version: 2023-06-01" \
                -H "Content-Type: application/json" \
                -d "{\"text\": \"PR #${{ github.event.pull_request.number }} tiene hallazgos reales de revisión pendientes de corregir, ver el comentario de revisión más reciente en el PR.\"}"
              ```

            `curl` y `gh pr comment` son los únicos comandos de Bash autorizados en
            este entorno — cualquier otro quedará bloqueado, no lo intentes. La tarea
            no está completa hasta que el comentario de revisión quede publicado (y,
            si aplica según la regla de arriba, la corrección disparada).

            CRÍTICO: ejecutá `gh pr comment` **exactamente una sola vez, con el
            comentario consolidado completo ya terminado**. No lo uses para probar, ni
            para publicar un borrador corto antes del definitivo — cada ejecución
            publica un comentario real y visible en el PR, no hay forma de "probar en
            seco". Si el comentario es largo, igual va completo en un solo
            `--body-file`, nunca partido en varias llamadas.

            NO escribas código, NO corrijas nada tú mismo, NO abras otra rama ni PR —
            tu única salida es el comentario de revisión y, cuando corresponda, el
            disparo de la Routine de corrección.
        env:
          FIX_PR_ROUTINE_API_TOKEN: ${{ secrets.FIX_PR_ROUTINE_API_TOKEN }}
```

**Los dos ajustes que tenés que hacer vos, según tu proyecto:**

1. **Subagente de dominio (opcional).** Si tu proyecto tiene lógica de
   negocio/cálculos particulares que ameritan un subagente propio (por
   ejemplo, algo que valide que las métricas de un dashboard sean
   correctas), creá ese subagente aparte (ver A.3) y agregalo a la lista
   numerada del prompt de arriba, en el lugar donde dice `[[VER NOTA 1...]]`
   — reemplazá esa línea por el ítem `3.` con el nombre y la instrucción
   de tu subagente. Si no tenés uno, simplemente borrá la línea
   `[[VER NOTA 1...]]`, no hace falta nada más.
2. **Nombre de la documentación técnica.** El prompt dice "la
   documentación técnica del proyecto" en genérico — si tu proyecto tiene
   un archivo específico (`DOCUMENTACION_TECNICA.md`, `ARCHITECTURE.md`,
   o simplemente `README.md`), mencionalo explícitamente ahí para que el
   subagente `documentador` sepa qué archivo mantener actualizado.

## A.3 Escribir estos archivos a medida (no se copian tal cual)

Estos 6 archivos **dependen del stack real de tu proyecto** — no existe
una versión genérica que sirva para cualquier repo. Lo que sí es
reutilizable es la estructura/formato de cada uno. La forma más rápida y
confiable de escribirlos bien es pedírselo a Claude Code directamente,
dentro de una sesión normal (no en un workflow) en tu repo, con las
instrucciones exactas de abajo.

Abrí una sesión de Claude Code en la raíz de tu repo (ya con `CLAUDE.md`
escrito, paso A.0) y pegale este prompt completo:

```
Necesito que crees 6 archivos para armar la "fábrica de software" en este
repo. Antes de escribir nada, leé CLAUDE.md completo y explorá la
estructura real del código (carpetas principales, cómo está organizado).
Cada archivo va en .claude/agents/<nombre>.md salvo el último.

1. `.claude/agents/planificador.md` — subagente que convierte una
   solicitud de cambio (Issue de GitHub con los campos Objetivo, Alcance,
   Contexto, Restricciones de calidad, Criterio de validación, Salida
   esperada) en un prompt de desarrollo estructurado. NUNCA escribe ni
   modifica código, ni toma decisiones de producto. Antes de planificar
   debe leer CLAUDE.md y los skills en .claude/skills/ (van a existir
   `estandares-seguridad-fabrica` siempre, y un skill de calidad propio
   del proyecto — ver ítem 5). El plan SIEMPRE debe incluir una sección
   "Impacto y riesgos" con: qué más del proyecto puede verse afectado,
   dificultades técnicas anticipadas, y qué puntos del checklist de
   seguridad de 20 puntos toca el cambio (aunque el Issue no lo
   mencione). Formato de salida: Markdown con las secciones ## Objetivo,
   ## Alcance (incluye/excluye), ## Contexto, ## Archivos a tocar, ##
   Impacto y riesgos, ## Restricciones de calidad, ## Criterio de
   validación, ## Preguntas abiertas (omitir esta última si no hay
   ninguna). Si el Issue es ambiguo en un punto que cambia el resultado,
   señalarlo como pregunta abierta en vez de asumir. El plan tiene que
   ser proporcional al tamaño real del pedido: la investigación
   (checklist de seguridad, análisis de impacto) siempre es completa, sin
   excepción, pero para un pedido chico (1 archivo, cambio visual/texto/
   config, sin lógica de negocio ni acceso a datos nuevo) cada sección
   del plan queda en 1-3 líneas — si no encontrás nada relevante de
   seguridad, decilo en una frase corta en vez de desarrollarlo en
   párrafos. Para un pedido grande (nuevo endpoint, modelo de datos,
   lógica de negocio, o cualquier punto real de seguridad que sí
   aplique), mantené el detalle completo.

2. `.claude/agents/revisor-codigo.md` — subagente que revisa un diff de
   código (o el proyecto completo, en modo auditoría) contra el skill de
   calidad del proyecto (ítem 5) — NUNCA reescribe código, solo reporta
   hallazgos concretos con archivo y línea. Definí, en orden de
   severidad para ESTE proyecto en particular (basado en lo que leíste
   del código real), una lista de 6-8 señales concretas de código a
   revisar — no genéricas, específicas de los patrones y riesgos reales
   de este stack. Dos modos de salida: (a) revisión normal — lista de
   hallazgos más severo primero, con archivo:línea, qué está mal, a qué
   característica de calidad corresponde, y el escenario concreto que
   falla; si no hay hallazgos, decirlo explícito. (b) auditoría base
   (proyecto completo, no un diff) — organizada en las 8 secciones del
   skill de calidad ISO/IEC 25010, una por característica.

3. `.claude/agents/documentador.md` — subagente que mantiene la
   documentación técnica del proyecto (identificá cuál es: puede ser
   README.md, ARCHITECTURE.md, o un archivo dedicado si existe)
   sincronizada con el código real. No redacta desde cero — detecta y
   corrige divergencias. Usa `git diff`/`git log` para ver qué cambió,
   ubica la sección correspondiente, y edita solo lo que divergió sin
   reescribir secciones que siguen siendo ciertas.

4. `.claude/agents/tester.md` — subagente que verifica manualmente que
   el sistema sigue funcionando después de un cambio, levantando el
   proyecto localmente (si tiene forma de correr local — decime cuál es
   el comando real, lo viste en CLAUDE.md o en el código) y probando
   los endpoints/flujos afectados con datos reales. Si el proyecto no
   tiene forma de correr localmente de forma simple, decímelo en vez de
   inventar un mecanismo. NO prueba nunca contra producción. NO inventa
   una suite de tests con un framework nuevo sin que se lo pidan
   explícitamente.

5. `.claude/skills/modelo-calidad-<slug-corto-del-proyecto>/SKILL.md` —
   interpretación de las 8 características de ISO/IEC 25010 (Adecuación
   funcional, Eficiencia de desempeño, Compatibilidad, Usabilidad,
   Fiabilidad, Seguridad, Mantenibilidad, Portabilidad) para el stack
   REAL de este proyecto, no la definición genérica de la norma. La
   sección 6 (Seguridad) tiene que interpretar, en una tabla, cada uno
   de los 20 puntos de .claude/skills/estandares-seguridad-fabrica/SKILL.md
   para este proyecto concreto, marcando cada uno como ✅ cubierto / ⚠️
   gap encontrado / "No aplica" con una justificación real basada en el
   código que leíste — no genérica. Sé honesto sobre los gaps reales que
   encuentres, no asumas que todo está bien.

6. `.claude/agents/asesor.md` — subagente de **solo lectura** (nunca
   escribe ni modifica código, nunca abre rama ni PR) que responde
   consultas/pedidos de asesoría — Issues con la label `consulta`
   (plantilla consulta-asesoria.yml), distintos de una solicitud de
   cambio. Investiga el código real y responde con evidencia concreta
   (archivo:línea), apoyándose en CLAUDE.md y en los mismos skills del
   ítem 5. Si su conclusión es que hace falta un cambio de código real,
   lo dice como recomendación final ("recomiendo abrir una Solicitud de
   cambio para...") y ahí termina — NUNCA redacta un plan de desarrollo
   ni lo implementa. Formato de salida: ## Respuesta corta (1-3 líneas),
   ## Análisis (razonamiento con evidencia), ## Consideraciones de
   seguridad (solo si aplica algún punto del checklist de 20), ##
   Próximos pasos (solo si de verdad hace falta un cambio de código;
   omitir si no).

Para los 6 archivos: no inventes convenciones que no viste en el código
o en CLAUDE.md. Si un subagente de dominio tiene sentido para este
proyecto (lógica de negocio/cálculos particulares que ameriten su propio
revisor), decímelo antes de crear nada — no lo agregues sin preguntar.
```

Revisá lo que te devuelva antes de aceptarlo — es un punto de partida de
buena calidad, no algo para aprobar a ciegas. Si Claude Code te pregunta
por un subagente de dominio y decís que sí, va a crear un séptimo archivo
(`.claude/agents/<nombre>.md`) — anotá su nombre, lo vas a necesitar en
el ajuste 1 de A.2.

## A.4 Checklist de configuración (una sola vez por proyecto)

Hacé estos pasos **en este orden** — cada uno depende del anterior.

**1. Instalar la GitHub App "Claude Code"**
`github.com/apps/claude` → Install → elegí **"Only select repositories"**
y marcá tu repo (nunca "All repositories"). Sin esto, nada de lo que
sigue puede comentar en tu repo aunque el resto esté bien configurado.

**2. Crear las labels `solicitud`, `esperando-humano`, `consulta`,
`esfuerzo-chico` y `esfuerzo-grande`**
En tu repo: Settings → Labels → New label. Creá las cinco, exactamente
con esos nombres (minúsculas, tal cual). Los formularios de Issue
declaran sus labels pero GitHub **no las crea solo** — es un paso manual
obligatorio: sin `solicitud`, el workflow `disparar-routine.yml` nunca la
encuentra; sin `consulta`, `generar-asesoria.yml` nunca dispara; sin las
dos de esfuerzo, el paso que las agrega en `generar-plan.yml` simplemente
falla en silencio (no rompe nada más, pero te quedás sin el dato en el
dashboard).

**3. Generar y guardar `CLAUDE_CODE_OAUTH_TOKEN`**
Con el CLI de Claude Code instalado localmente, corré:
```bash
claude setup-token
```
Te va a dar un token. En tu repo: Settings → Secrets and variables →
Actions → pestaña **Secrets** → New repository secret → nombre
`CLAUDE_CODE_OAUTH_TOKEN`, pegá el valor. **Este token consume cuota de tu
suscripción Pro/Max, no facturación aparte.** Expira al año — la
renovación es manual, agendalo.

**4. Crear un Environment (entorno en la nube)**
Andá a `claude.ai/code`, buscá la sección de entornos en la nube ("Nube"
en el selector del compositor, o "New Environment") y creá uno nuevo,
vinculado a tu repo. Un entorno por proyecto, no se comparte entre repos.

**5. Crear las dos Routines**

**Routine A — `implementar-plan-aprobado`:**
- Repo: el tuyo. Environment: el del paso 4.
- Trigger: **"Add an API trigger"** (no horario).
- Instrucciones (pegar tal cual):
```
Leé el payload que recibiste. Va a mencionar un número de Issue de este
repo que fue aprobado con /aprobar. Buscá en los comentarios de ese Issue
el plan de desarrollo más reciente generado por el subagente
planificador (formato: ## Objetivo, ## Alcance, etc.) e implementalo.

Antes de escribir código: si el Issue ya tiene la label
"esperando-humano" O ya existe una rama claude/issue-<n>-* en este repo,
significa que este trabajo ya empezó y se pausó esperando una respuesta
humana — hacé checkout de esa rama existente y continuá ahí, NO crees una
rama nueva ni reinicies el trabajo ya hecho.

Si en el proceso aparece una decisión real, no prevista ni en el plan ni
en sus "Preguntas abiertas", que cambia comportamiento o alcance de forma
no trivial: NO la resuelvas vos solo. Comentá la pregunta específica en
el Issue, agregá la label "esperando-humano" con
`gh issue edit <n> --add-label "esperando-humano"`, pusheá el trabajo
parcial que ya tengas en la rama, y terminá tu turno sin abrir PR. Si es
una duda menor ya cubierta por el plan o resolvible de forma conservadora
sin cambiar el alcance, resolvela vos y seguí — no pausar por cualquier
cosa.

Si podés completar el desarrollo: creá la rama claude/issue-<n>-<slug-corto>
(si no existe ya), commiteá los cambios, y abrí un Pull Request contra la
rama principal. En la descripción del PR incluí siempre la línea
`Closes #<n>` (en inglés, exactamente así — GitHub no reconoce la palabra
en español y el Issue nunca se cerraría solo al mergear). Nunca hagas
merge del PR vos mismo — eso es siempre una decisión humana. Comentá en
el Issue original el link al PR abierto.
```
- Guardá y copiá el token que te muestra (`sk-ant-oat01-...`) — **se
  muestra una sola vez**.

**Routine B — `corregir-hallazgos-pr`:**
- Repo: el tuyo. Environment: el del paso 4.
- Trigger: **"Add an API trigger"**.
- Instrucciones (pegar tal cual):
```
Leé el payload que recibiste sobre un PR de este repo. Hay dos casos
posibles, distinguilos por el texto del payload:

CASO 1 — dice "tiene un ajuste pedido por un humano: <texto>": aplicá ESE
texto tal cual sobre la rama del PR que menciona el payload (hacé
checkout de esa rama exacta, no otra). NO busques hallazgos de revisión
automática en este caso, el pedido humano ya es la instrucción completa.

CASO 2 — dice "tiene hallazgos reales de revisión pendientes de
corregir": buscá el comentario de revisión consolidado más reciente en
ese PR (con `gh pr view <n> --json comments` o similar) y corregí
específicamente los hallazgos marcados REAL o CRÍTICO — ignorá los
marcados COSMÉTICO/INFORMATIVO salvo que sean triviales de corregir de
paso.

En los dos casos: hacé checkout de la rama existente del PR (nunca crees
una rama nueva ni abras un PR nuevo — este PR ya existe, se actualiza
solo con un push a su misma rama), commiteá la corrección, y pusheá.
Comentá brevemente en el PR qué corregiste.
```
- Guardá y copiá el token.

**6. Guardar los secrets de disparo**
Settings → Secrets and variables → Actions → **Secrets**:
- `ROUTINE_API_TOKEN` = token de la Routine A
- `FIX_PR_ROUTINE_API_TOKEN` = token de la Routine B

**7. Guardar las variables de repo**
Settings → Secrets and variables → Actions → pestaña **Variables** (no
Secrets — estos IDs no son sensibles):
- `ROUTINE_IMPLEMENTAR_ID` = el ID de la Routine A (lo ves en la URL de
  la Routine o en su configuración, empieza con `trig_`)
- `ROUTINE_CORREGIR_ID` = el ID de la Routine B

**8. Probar con un Issue real de bajo riesgo**
Abrí un Issue chico con la plantilla nueva antes de confiarle algo
importante. Seguí el ciclo completo una vez de punta a punta: plan
comentado solo → `/aprobar` → PR abierto solo → comentario de revisión
solo → mergear vos a mano.

**9. (Opcional) Conectar este repo a la Parte B**, si ya la instalaste —
ver B.4.

---

# PARTE B — Agente PM diario + dashboard (una sola vez, toda la cuenta)

Esto se instala **una vez**, no por proyecto. Recorre todos los repos de
la Parte A que le vayas conectando y publica un reporte diario: qué está
pausado esperando una decisión, qué PR falta revisar/mergear, qué Issue
nunca recibió un plan, qué está estancado. En tres canales: un Issue fijo
de GitHub, Telegram, y un dashboard visual público.

## B.0 Qué se crea, de un vistazo

- Un repo **privado** (el "hub") con el agente y el historial.
- Un repo **público** (solo sirve el dashboard, nada operativo).
- Un Issue fijo en el repo hub.
- Tres Personal Access Tokens de GitHub, cada uno con el mínimo acceso
  posible.
- Credenciales de un bot de Telegram (opcional, solo si querés ese
  canal).
- Un Environment y una Routine con horario.

## B.1 Crear los dos repos

1. `github.com/new` → nombre a elección (ej. `fabrica-status`) →
   **Private** → vacío, sin README ni nada. Este es el repo hub.
2. `github.com/new` → nombre a elección (ej. `fabrica-status-dashboard`)
   → **Public** (tiene que ser público — GitHub Pages privado requiere
   plan Pro/Team/Enterprise) → vacío. Este es el repo del dashboard.

En el repo hub, creá un Issue nuevo, título libre (ej. "📋 Estado diario
de la fábrica"), sin plantilla. Anotá el número que le queda asignado
(normalmente `#1`).

## B.2 Los tres tokens

Los tres en `github.com/settings/personal-access-tokens/new` (fine-grained,
no el tipo "classic"). **Los tres con expiración de 1 año, nunca "sin
expiración".**

| Token | Repositorios | Permisos |
|---|---|---|
| `GH_TOKEN_FABRICA` | Cada repo de proyecto de la Parte A (empezá con los que ya tengas, agregás más después) | `Issues: Read-only`, `Pull requests: Read-only`, `Metadata: Read-only` |
| `GH_TOKEN_STATUS` | Solo el repo hub | `Issues: Read and write` |
| `GH_TOKEN_DASHBOARD` | Solo el repo del dashboard | `Contents: Read and write` |

## B.3 Credenciales de Telegram (opcional)

Si querés el canal de Telegram, necesitás:
1. Un bot: hablale a `@BotFather` en Telegram, `/newbot`, seguí las
   instrucciones, te da un token (`123456:ABC-...`).
2. Tu `chat_id`: mandale cualquier mensaje al bot, después abrí en el
   navegador `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` y buscá
   `"chat":{"id": ...}` en la respuesta.

Si no querés Telegram, salteá este paso y sacá la parte de Telegram de
las instrucciones del subagente en B.5 y de la Routine en B.7.

## B.4 Placer el subagente en el repo hub

En el repo hub, creá `.claude/agents/pm-diario.md` con este contenido —
reemplazá `<owner>` por tu usuario/organización de GitHub y la lista de
repos de la sección "Repos que tenés que recorrer" por los tuyos reales:

```markdown
---
name: pm-diario
description: Genera el reporte diario de estado de todos los repos de la fábrica de software. Se ejecuta una vez al día vía una Routine con horario, nunca a demanda.
tools: Read, Bash
---

Eres el project manager diario de la fábrica de software. Tu única función
es recorrer los repos de proyecto, clasificar el estado de sus Issues y
Pull Requests abiertos, y publicar un reporte — no tomás decisiones de
flujo, no aprobás ni rechazás nada, no comentás en los repos de proyecto.

## Regla general: siempre REST (`gh api`), nunca `gh repo list` / `gh issue list` / `gh pr list`

Una sesión de Routine en la nube bloquea casi todo GraphQL. Esos tres
comandos de gh CLI usan GraphQL por dentro y fallan siempre en una sesión
de Routine, no solo con ciertos campos — no los uses ni como primer
intento. Usá siempre `gh api` (REST puro) para todo lo que sigue acá.
`gh issue comment` sí es REST y funciona normalmente.

## Repos que tenés que recorrer

Lista fija, mantenida a mano — no hay forma de descubrirla
dinámicamente (se probó `gh api user/repos` y también falla: una sesión
de Routine solo puede llamar a endpoints repo-scoped de repos
explícitamente conectados a ella, no hay ningún endpoint de
"descubrimiento"):

- `<owner>/<repo-1>`
- `<owner>/<repo-2>`

Agregar un repo nuevo acá requiere TRES pasos, no solo editar esta lista:
1. Agregarlo al scope del PAT GH_TOKEN_FABRICA.
2. Conectarlo como fuente adicional de la Routine (ver B.7) — sin esto,
   la llamada real desde la sesión falla con 403 aunque el PAT lo vea.
3. Agregarlo a esta lista — sin esto, el repo no aparece en el reporte,
   sin ningún error visible.

## Credenciales disponibles en el entorno

- `GH_TOKEN_FABRICA` — solo lectura sobre los repos de proyecto de la
  lista de arriba. Usalo SOLO para leer esos repos.
- `GH_TOKEN_STATUS` — lectura/escritura sobre este mismo repo hub
  únicamente. Usalo SOLO para publicar el reporte en el Issue fijo.
- `GH_TOKEN_DASHBOARD` — lectura/escritura sobre el repo del dashboard
  únicamente. Usalo SOLO para publicar data/estado.json ahí.
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — si instalaste el canal de
  Telegram (omitir todo lo de Telegram si no).
- `ISSUE_ESTADO_DIARIO` — número del Issue fijo en este repo.

`gh` toma el token de la variable de entorno `GH_TOKEN`. Seteala por
comando, nunca de forma global — hay tokens distintos para propósitos
distintos. Usá siempre `gh` con estos tokens, nunca un conector MCP de
GitHub ni ninguna otra credencial disponible en la sesión, aunque `gh`
no esté instalado y tengas otra forma de leer GitHub disponible — si
`gh` no está, es un error de infraestructura a reportar explícito, no
una razón para usar otra vía en silencio.

```bash
GH_TOKEN="$GH_TOKEN_FABRICA" gh api "repos/<owner>/<repo>/issues?state=open&per_page=100"
GH_TOKEN="$GH_TOKEN_FABRICA" gh api "repos/<owner>/<repo>/pulls?state=open&per_page=100"
GH_TOKEN="$GH_TOKEN_FABRICA" gh api "repos/<owner>/<repo>/issues/<numero>/comments"
GH_TOKEN="$GH_TOKEN_FABRICA" gh api "repos/<owner>/<repo>/pulls/<numero>/reviews"
```

Repetí para cada repo de la lista.

## Cómo clasificar lo que encontrás

Para cada Issue o PR abierto, ubicalo en una sola categoría, en este
orden de prioridad:

1. **Pausado esperando decisión humana** — el último comentario es de un
   agente pidiendo una decisión/aclaración, y nadie respondió.
2. **PR abierto esperando revisión o merge** — sin review con
   `state: "APPROVED"`, o aprobado pero sin mergear.
3. **Pendiente de aprobar** — Issue con plan ya generado, sin `/aprobar`.
4. **Recién abierto sin plan** — Issue sin ningún comentario del
   planificador.
5. **Estancado** — nada de lo anterior aplica, sin actividad hace más de
   5 días.

Aparte, armá "Completado ayer": Issues cerrados o PRs mergeados en las
últimas 24 horas (`gh api ".../issues?state=closed&since=<ISO 24h atrás>"`,
y para PRs `state=closed` filtrando `merged_at` vos mismo, el endpoint no
acepta `since` para PRs).

## Qué NO hacer

- No comentes en los Issues/PRs de los repos de proyecto — solo leés.
- No tomes decisiones de flujo (no apruebes, cierres, ni mergees).
- No ocultes errores ni omitas secciones — si algo falla, decilo
  explícito en vez de saltear en silencio.

## Formato del reporte

Calculá la fecha con `date +%F` en el momento de la ejecución, nunca la
asumas ni la copies de una corrida anterior.

```
📋 Estado de la fábrica — {fecha}

## <repo 1>
- Pausado esperando decisión humana: ...
- PR abierto esperando revisión o merge: ...
- Pendiente de aprobar: ...
- Recién abierto sin plan: ...
- Estancado: ...
- Completado ayer: ...

## <repo 2>
(mismas secciones, una por cada repo de la lista)

## Errores al generar este reporte
(solo si aplica)
```

Si una categoría no tiene ítems, escribí "ninguno" — no omitas la línea.

## Datos estructurados para el dashboard (data/estado.json)

Armá el mismo contenido en JSON, en un archivo temporal (`/tmp/estado.json`,
no en este checkout):

```json
{
  "generado_en": "2026-01-01T08:00:00-05:00",
  "repos": [
    {
      "nombre": "repo-1",
      "categorias": {
        "pausado_esperando_decision": [
          {"numero": 25, "tipo": "issue", "titulo": "...", "url": "https://github.com/...", "motivo": "...", "ultima_actividad": "2026-01-01", "esfuerzo": "chico"}
        ],
        "pr_esperando_revision_merge": [],
        "pendiente_de_aprobar": [],
        "recien_abierto_sin_plan": [],
        "estancado": []
      },
      "completado_ayer": []
    }
  ],
  "errores": []
}
```

`tipo` es `"issue"` o `"pr"`. `url` es el link directo
(`https://github.com/<owner>/<repo>/issues/<numero>` o `.../pull/<numero>`).
`motivo` es la misma frase corta que ya escribiste en el texto para ese
ítem. `esfuerzo` es `"chico"` o `"grande"` si el ítem tiene la label
`esfuerzo-chico`/`esfuerzo-grande` (la pone `generar-plan.yml`, ver A.4)
— ya viene en el mismo array `labels` de `gh api .../issues` que ya
estás leyendo, no hace falta una llamada nueva; si no tiene ninguna de
las dos labels, omití la clave o dejala en `null`.

**Publicalo con `git push`, no con la Contents API de GitHub — el
proxy de la sesión bloquea las escrituras vía API REST/GraphQL casi por
completo, salvo `gh issue comment`.**

```bash
rm -rf /tmp/dashboard-repo
git clone "https://x-access-token:${GH_TOKEN_DASHBOARD}@github.com/<owner>/<repo-dashboard>.git" /tmp/dashboard-repo
cp /tmp/estado.json /tmp/dashboard-repo/data/estado.json
cd /tmp/dashboard-repo
git config user.email "pm-diario@fabrica"
git config user.name "pm-diario"
git add data/estado.json
git commit -m "Actualizar estado diario ($(date +%F))"
git push
cd -
```

Si falla, reportalo en "Errores al generar este reporte" — el dashboard
va a mostrar el último JSON válido, pero el humano tiene que saber que
no se actualizó hoy.

## Publicación (todos los canales configurados, siempre)

**Issue en el repo hub:**
```bash
GH_TOKEN="$GH_TOKEN_STATUS" gh issue comment "$ISSUE_ESTADO_DIARIO" \
  --repo <owner>/<repo-hub> \
  --body "$REPORTE"
```

**Telegram** (si lo instalaste — omitir si no):
```bash
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" \
  -d parse_mode="HTML" \
  --data-urlencode text="$REPORTE"
```

**`data/estado.json`** — ya cubierto arriba, el `git push` de ahí ES la
publicación para este canal.

Publicá en todos los canales siempre, incluso si el reporte incluye
errores.
```

También creá un `CLAUDE.md` mínimo en el repo hub explicando que es un
repo hub sin código de producto (una o dos líneas alcanza).

## B.5 El dashboard visual

En el repo del dashboard (el público), creá dos archivos:

1. `data/estado.json` — un archivo semilla vacío para que la página no
   falle antes de la primera corrida real:
```json
{"generado_en": null, "repos": [], "errores": ["Todavía no corrió la Routine — este es un archivo semilla."]}
```

2. `index.html` — copialo tal cual desde el repo de referencia público
   `https://github.com/Juanjorodriguez09/fabrica-status-dashboard/blob/main/index.html`
   (es público, se puede ver y copiar el contenido directamente desde
   GitHub sin necesitar acceso especial). Es HTML/CSS/JS puro, sin build
   step ni dependencias externas — no hace falta tocar nada para que
   funcione, salvo que quieras personalizar colores o textos.

## B.6 Activar GitHub Pages

En el repo del dashboard: Settings → Pages → **Source: "Deploy from a
branch"** → Branch: `main`, carpeta `/ (root)` → Save. En un par de
minutos te da una URL pública (`https://<tu-usuario>.github.io/<repo>/`).

## B.7 Environment y Routine

**Environment** (`claude.ai/code` → "Nube" → nuevo entorno):
- Repo: el repo hub.
- Acceso a la red: **Completo** (necesita salir a `api.telegram.org`, si
  usás ese canal).
- Variables de entorno:
```
GH_TOKEN_FABRICA=<token de B.2>
GH_TOKEN_STATUS=<token de B.2>
GH_TOKEN_DASHBOARD=<token de B.2>
TELEGRAM_BOT_TOKEN=<token de B.3, si aplica>
TELEGRAM_CHAT_ID=<chat_id de B.3, si aplica>
ISSUE_ESTADO_DIARIO=<número del Issue fijo de B.1>
```
- Script de configuración (instala `gh`, no viene preinstalado):
```bash
if ! command -v gh >/dev/null 2>&1; then
  type -p curl >/dev/null && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update && sudo apt install gh -y
fi
```

**Routine** (nombre a elección, ej. `reporte-diario-fabrica`):
- Repo: el repo hub. Environment: el de arriba.
- Trigger: **Schedule** (horario), diario, la hora y zona horaria que
  prefieras.
- Repos conectados: el repo hub, el repo del dashboard, **más cada repo
  de proyecto de la Parte A que quieras que aparezca en el reporte**
  (botón `+` al lado de los repos ya conectados) — es obligatorio para
  los tres tipos de repo, sin importar qué acceso tenga cada token. Sin
  conectar un repo acá, la sesión no puede llamar a su API aunque el
  token sí tenga permiso.
- Instrucciones:
```
Ejecutá de forma síncrona (no delegues a un subagente en background) las
instrucciones de .claude/agents/pm-diario.md en este mismo repo. Generá
el reporte diario de estado de la fábrica y publicalo en todos los
canales indicados ahí.
```

## B.8 Probar

Disparala manualmente una vez (no esperes al horario programado) y
confirmá los tres canales: comentario nuevo en el Issue fijo, mensaje en
Telegram (si aplica), y la URL de GitHub Pages mostrando datos reales.

## B.9 Sumar un proyecto nuevo de la Parte A al reporte

Tres pasos, siempre los tres:
1. Agregar el repo al scope del PAT `GH_TOKEN_FABRICA`.
2. Conectarlo a la Routine (botón `+`).
3. Agregarlo a la lista fija dentro de `pm-diario.md`, en el repo hub.

---

# PARTE C — Coordinador central (una sola vez, toda la cuenta)

Reduce la intervención humana un paso más allá de la Parte A: en vez de
que vos apruebes cada plan y respondas sus preguntas abiertas a mano, el
Coordinador lo hace solo — nunca deja un plan sin resolver, nunca pausa
esperando a un humano. Se instala **una sola vez**, igual que la Parte
B, y cubre todos los proyectos que le vayas conectando.

**Dónde termina su autonomía, a propósito:** el Coordinador llega hasta
"PR abierto y revisado, listo para mergear" — el merge a la rama
principal sigue siendo tu clic. No es una limitación técnica, es la
misma regla de todo este sistema ("el merge es siempre humano") aplicada
acá también.

El Coordinador tiene **dos tareas** (la segunda es un incremento sobre
la primera, se puede instalar por separado — ver C.7 si solo querés la
primera por ahora):

1. **Aprobar planes** (C.1-C.6) — reemplaza que apruebes cada plan y
   respondas sus preguntas abiertas a mano.
2. **Decidir ajustes de PR** (C.7) — reemplaza que decidas a mano si
   pedir `/ajustar` cuando la revisión automática de un PR encuentra un
   hallazgo real que sobrevivió al único intento de corrección
   automática.

## C.1 Qué se crea

- **En el repo hub** (el mismo de la Parte B):
  - `.claude/agents/coordinador.md` — el criterio de decisión, para las
    dos tareas.
  - `.claude/conocimiento/decisiones.md` — un registro liviano (texto en
    git) de decisiones no triviales, compartido entre todos los
    proyectos, para no resolver dos veces distinto la misma pregunta de
    fondo. Podés migrarlo a una base de datos real más adelante sin que
    nada dependa de eso ahora.
- **Un cuarto PAT** (fine-grained), `GH_TOKEN_COORDINADOR`: `Issues:
  Read and write` + `Pull requests: Read and write` (esta segunda solo
  hace falta si instalás también C.7) + `Contents: Read-only` sobre los
  repos de proyecto — distinto de `GH_TOKEN_FABRICA` (que es solo
  lectura). 1 año de expiración, igual que los demás.
- **Una Routine nueva**, `coordinador-central`, en el repo hub:
  - Trigger: **"Add an API trigger"** (no horario).
  - Repos conectados: el repo hub + cada repo de proyecto.
  - Instrucciones:
    ```
    Ejecutá de forma síncrona (no delegues a un subagente en background) las
    instrucciones de .claude/agents/coordinador.md en este mismo repo, usando
    el payload recibido para saber en qué repo y qué Issue/PR tenés que
    revisar.
    ```
- **En cada repo de proyecto de la Parte A**: un workflow chico que
  avisa, más dos valores de configuración, más un cambio a
  `disparar-routine.yml`, más un paso nuevo en la Routine
  `implementar-plan-aprobado` — ver C.3. Si instalás también C.7: otro
  workflow chico más, más un cambio a `ajustar-pr.yml` y a
  `revisar-pr.yml`.

## C.2 `.claude/agents/coordinador.md` (repo hub)

```markdown
---
name: coordinador
description: Revisa el plan de desarrollo más reciente de un Issue de cualquier proyecto de la fábrica y decide, con criterio propio, si aprobarlo o cómo resolver sus preguntas abiertas antes de aprobar. También decide, cuando un PR queda con hallazgos reales de revisión sin corregir tras agotar el intento automático, si pedir un ajuste más o escalar a un humano. Reemplaza la intervención humana en ambos puntos — nunca deja nada sin resolver ni pausa esperando a un humano salvo que explícitamente decida escalar. Se ejecuta una vez por Issue/PR, disparado por la Routine coordinador-central vía /fire, nunca a demanda dentro de un repo de proyecto.
tools: Read, Grep, Glob, Bash
---

Eres el Coordinador central de la fábrica de software — el mismo criterio
de decisión aplica a todos los proyectos, no uno distinto por repo. Tenés
dos tipos de tarea posibles; el texto del payload que te invocó te dice
cuál es:

- Si el payload menciona **"un plan nuevo para revisar en el Issue"** →
  es la **Tarea 1** (aprobar un plan).
- Si el payload menciona **"hallazgos reales de revisión sin corregir"**
  en un **PR** → es la **Tarea 2** (decidir un ajuste) — solo aplica si
  instalaste también C.7 de esta guía; si no la instalaste, este caso
  nunca va a ocurrir y podés ignorar esa sección entera.

No mezcles los dos flujos — cada payload trae solo uno de los dos casos.

## Tarea 1: aprobar un plan de desarrollo

Tu trabajo es decidir, con la misma responsabilidad que tendría un humano
con contexto completo, si el plan de desarrollo de un Issue está listo
para aprobarse — y si tiene preguntas abiertas, resolverlas vos mismo con
el mejor criterio posible, sin dejar nada pendiente para un humano.

## Regla general: siempre REST (`gh api`), nunca `gh repo list` / `gh issue list` / `gh pr list`

Esta sesión de Routine bloquea casi todo GraphQL — esos tres comandos de
`gh` fallan siempre acá. Usá siempre `gh api` (REST puro) o
`gh issue view`/`gh issue comment` (que sí son REST) para todo lo que
sigue.

## De qué repo/Issue/PR se trata

El payload que te invoca menciona el repo (`<owner>/<repo>`) y el número
de Issue o PR a revisar — nunca asumas que es este mismo repo (el hub no
tiene Issues de proyecto).

## Credenciales disponibles en el entorno

- `GH_TOKEN_COORDINADOR` — lectura/escritura de Issues y Pull Requests
  (esta segunda solo si instalaste C.7), y **lectura** de Contents,
  sobre los repos de proyecto de la fábrica. Usalo para todo lo de este
  archivo.

`gh` toma el token de la variable de entorno `GH_TOKEN` — seteala por
comando: `GH_TOKEN="$GH_TOKEN_COORDINADOR" gh ...`.

## Cómo investigar el repo del Issue

Este checkout es el del repo hub, no el del proyecto — para leer
`CLAUDE.md`, los skills, y el código real que necesitás para resolver
preguntas técnicas, cloná el repo del Issue a un directorio temporal:

```bash
rm -rf /tmp/repo-revisar
GH_TOKEN="$GH_TOKEN_COORDINADOR" git clone "https://x-access-token:${GH_TOKEN_COORDINADOR}@github.com/<owner>/<repo>.git" /tmp/repo-revisar
```

Ahí adentro vas a encontrar `CLAUDE.md`, `.claude/skills/`, y el código
real — leelos con Read/Grep/Glob igual que si fuera un checkout normal.

## Traer el hilo del Issue

```bash
GH_TOKEN="$GH_TOKEN_COORDINADOR" gh issue view <numero> --repo <owner>/<repo> --json title,body,comments
```

## Contexto que debés leer siempre, antes de decidir

1. `CLAUDE.md` del repo clonado.
2. Los skills de calidad y de seguridad del repo clonado.
3. `.claude/conocimiento/decisiones.md`, **en este mismo repo** (el hub,
   no el clonado) — decisiones anteriores del Coordinador sobre casos
   parecidos, de cualquier proyecto.
4. El hilo completo del Issue — el plan del planificador, con su
   sección "Preguntas abiertas" si la tiene.
5. El código real relevante a cada pregunta abierta.

## Cómo decidir

Para cada pregunta abierta del plan:

- Si la respuesta se puede derivar con evidencia real del código, del
  `CLAUDE.md`, de un skill, o de una decisión anterior en
  `decisiones.md` — respondela así, citando la evidencia (archivo:línea
  cuando aplique).
- Si es una decisión de producto/negocio sin una respuesta "correcta"
  objetiva — elegí la opción más conservadora y más consistente con
  patrones ya existentes en el proyecto, y decilo explícitamente así.
- Nunca dejes una pregunta sin resolver. Tu turno siempre termina en una
  decisión, no en otra pregunta ni en una pausa.

Si el plan no tiene preguntas abiertas y el alcance es razonable,
aprobalo directo, sin inventar objeciones que el plan no plantea.

## Qué NO hacer (Tarea 1)

- No pauses ni dejes la decisión para un humano — en la Tarea 1 siempre
  hay una decisión posible, nunca hace falta escalar.
- No escribas código ni modifiques el repo del proyecto — tu única
  salida es el comentario de decisión.
- No inventes alcance nuevo que ni el Issue ni el plan pidieron.
- No comentes en ningún repo que no sea el mencionado en el payload que
  te invocó.

(La Tarea 2, si la instalaste, sí tiene un caso legítimo de escalar a un
humano — ver esa sección. No lo confundas con esta regla, que aplica
solo a la Tarea 1.)

## Publicar la decisión

```
/aprobar

Resolución de preguntas abiertas:
- <pregunta 1>: <respuesta y por qué>

Plan aprobado con estas resoluciones.
```

(O, si no había preguntas abiertas, un texto breve confirmando que se
revisó sin objeciones — siempre empezando la primera línea con
`/aprobar`.)

```bash
GH_TOKEN="$GH_TOKEN_COORDINADOR" gh issue comment <numero> --repo <owner>/<repo> --body-file /tmp/decision.txt
```

## Registrar la decisión (si fue relevante)

Si resolviste al menos una pregunta abierta no trivial, agregá una
entrada corta a `.claude/conocimiento/decisiones.md` (en este repo, el
hub) con el formato que ya tiene el archivo, y commiteala:

```bash
git add .claude/conocimiento/decisiones.md
git commit -m "Registrar decisión del Coordinador — <owner>/<repo> #<numero>"
git push
```

Si el plan no tenía preguntas abiertas, no hace falta registrar nada.

## Tarea 2: decidir un ajuste de PR (solo si instalaste C.7)

Este caso llega cuando `revisar-pr.yml` encontró hallazgos REAL/CRÍTICO
en un PR, pero ya usó su único intento automático de corrección (el PR
tiene más de 1 commit) — así que dejó un comentario con la marca
`🧭 ESPERANDO_DECISION` y no hizo nada más. Tu trabajo es decidir si vale
la pena pedir **un** ajuste más, o si hay que escalar a un humano.

### Límite de seguridad — nunca lo saltees

Solo podés pedir **un** ajuste extra por PR, nunca más. Confirmalo así
antes de decidir nada:

```bash
GH_TOKEN="$GH_TOKEN_COORDINADOR" gh pr view <numero> --repo <owner>/<repo> --json commits,comments,title,headRefName,baseRefName
```

- Si `commits` tiene **más de 2** elementos → el intento extra ya se usó
  (por vos antes, o por un humano) → **no pidas otro ajuste bajo ningún
  concepto**, pasá directo a "Escalar a un humano" más abajo.
- Si `commits` tiene **2 o menos** elementos → todavía tenés margen para
  pedir el único ajuste extra permitido — seguí con el criterio de abajo
  para decidir si conviene.

### Cómo decidir si pedís el ajuste o escalás directo

Leé el comentario de revisión más reciente (el que tiene
`🧭 ESPERANDO_DECISION`) y los hallazgos REAL/CRÍTICO que describe.

- Si los hallazgos son del tipo que un ajuste de código puede resolver
  razonablemente (un bug concreto, una validación faltante, una capa mal
  usada, algo que viola una convención documentada en el `CLAUDE.md` del
  repo clonado) → **pedí el ajuste** (ver abajo), con una instrucción
  concreta de qué corregir, citando el hallazgo exacto.
- Si los hallazgos son en el fondo una decisión de producto/negocio sin
  respuesta objetiva — **no gastes el único intento**, escalá directo
  aunque tengas margen.

### Pedir el ajuste

Cloná el repo si todavía no lo hiciste (mismo comando de arriba) para
verificar el hallazgo contra el código real. Armá el comentario:

```
/ajustar

<instrucción concreta de qué corregir, citando el hallazgo REAL/CRÍTICO exacto del comentario de revisión — archivo:línea cuando aplique>
```

```bash
GH_TOKEN="$GH_TOKEN_COORDINADOR" gh pr comment <numero> --repo <owner>/<repo> --body-file /tmp/decision.txt
```

(`gh pr comment` funciona igual que `gh issue comment` para un PR.)

### Escalar a un humano

Publicá un comentario explicando por qué (sin el prefijo `/ajustar`,
para que no dispare nada) y agregá la label `esperando-humano` (ya
existe en el repo, se crea en A.4):

```bash
GH_TOKEN="$GH_TOKEN_COORDINADOR" gh pr comment <numero> --repo <owner>/<repo> --body-file /tmp/decision.txt
GH_TOKEN="$GH_TOKEN_COORDINADOR" gh pr edit <numero> --repo <owner>/<repo> --add-label "esperando-humano"
```

### Registrar la decisión (Tarea 2)

Igual que en Tarea 1: si la decisión no fue trivial (sobre todo si
escalaste), agregá una entrada corta a `decisiones.md` con el mismo
formato de comandos de la sección de Tarea 1.
```

Y `.claude/conocimiento/decisiones.md` (semilla, mismo repo hub):

```markdown
# Decisiones del Coordinador

Registro compartido entre todos los proyectos de la fábrica — decisiones
no triviales que tomó el `coordinador`, ya sea al aprobar planes o al
decidir un ajuste de PR. Versión liviana (texto en git); migrable a una
base de datos real más adelante.

## <fecha> — <owner>/<repo> Issue/PR #<n>: <resumen de la pregunta>

Decisión: <qué se resolvió y por qué>

Todavía sin entradas.
```

## C.3 En cada repo de proyecto

### `.github/workflows/coordinador-avisar-plan.yml`

```yaml
name: Avisar al Coordinador central de un plan nuevo

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write

jobs:
  avisar_coordinador:
    if: >
      github.event.issue.pull_request == null &&
      github.event.comment.user.type == 'Bot' &&
      contains(github.event.comment.body, '## Objetivo') &&
      !startsWith(github.event.comment.body, '/aprobar')
    runs-on: ubuntu-latest
    steps:
      - name: 🧭 Avisar al Coordinador central vía API
        run: |
          RESPONSE=$(curl -s -X POST "https://api.anthropic.com/v1/claude_code/routines/${{ vars.ROUTINE_COORDINADOR_ID }}/fire" \
            -H "Authorization: Bearer ${{ secrets.COORDINADOR_API_TOKEN }}" \
            -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
            -H "anthropic-version: 2023-06-01" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"Hay un plan nuevo para revisar en el Issue #${{ github.event.issue.number }} de ${{ github.repository }}. Repo completo: ${{ github.repository }}. Revisalo y decidí si aprobarlo, resolviendo cualquier pregunta abierta que tenga.\"}")
          echo "$RESPONSE"
```

### Modificar `disparar-routine.yml` (ya existe, de la Parte A)

Cambiá la condición del job para que también acepte un `/aprobar`
posteado por una identidad bot, no solo por vos:

```diff
- contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
+ (contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) || github.event.comment.user.type == 'Bot') &&
```

### Agregar el paso 4.5 a `implementar-plan-aprobado`

En las instrucciones de esa Routine (editar en la UI), insertá este
paso entre el 4 y el 5 existentes:

```
4.5. Si el plan aprobado concluye que NO hace falta ningún cambio de
   código (por ejemplo, la funcionalidad ya existe, o el Issue es un
   duplicado ya resuelto en otro Issue/PR) — no sigas a los pasos 5-9,
   no crees rama ni PR. No dejes esa decisión para que la tome un
   humano: cerrá el Issue vos mismo con `gh issue close <numero>
   --comment "<explicación breve, citando la evidencia concreta de por
   qué no hace falta desarrollo>"`. Terminá el turno ahí.
```

Sin este paso, la Routine solo *dice* que habría que cerrar el Issue
pero lo deja abierto — un punto de intervención humana sin cubrir.

## C.4 Checklist de configuración

1. Crear `GH_TOKEN_COORDINADOR` (fine-grained): repos de proyecto,
   `Issues: Read and write` + `Contents: Read-only`, 1 año. Si vas a
   instalar también C.7, agregale de una vez `Pull requests: Read and
   write` (evita tener que volver a editarlo después).
2. Crear la Routine `coordinador-central` en el repo hub, con el
   Environment ya usado en la Parte B (agregale la variable
   `GH_TOKEN_COORDINADOR` ahí) y los repos de proyecto conectados.
3. Guardar el token de la Routine (se muestra una sola vez).
4. En cada repo de proyecto: agregar los dos archivos de C.3, el secret
   `COORDINADOR_API_TOKEN` (pestaña **Secrets**) y la variable
   `ROUTINE_COORDINADOR_ID` (pestaña **Variables** — son pestañas
   distintas; si los ponés en la equivocada, el `curl` del workflow
   falla con exit code 43, sin mensaje de error claro).
5. Agregar el paso 4.5 a `implementar-plan-aprobado` en cada repo.

## C.5 Probar

Abrí un Issue chico de Solicitud de cambio y **no comentes nada** — el
plan debería publicarse, y sin que hagas nada más, un comentario que
empiece con `/aprobar` debería aparecer solo, seguido de un PR abierto y
revisado (o, si resulta que no hacía falta ningún cambio, el Issue se
cierra solo con la explicación).

## C.6 Sumar un proyecto nuevo al Coordinador

Cinco pasos, todos en el repo nuevo (además de tenerlo ya instalado con
la Parte A):
1. Agregar el repo al scope del PAT `GH_TOKEN_COORDINADOR`.
2. Conectarlo a la Routine `coordinador-central` (botón `+`).
3. Copiar `coordinador-avisar-plan.yml` (C.3) tal cual.
4. Aplicar el mismo diff a `disparar-routine.yml` del repo nuevo.
5. Agregar los secrets/vars y el paso 4.5, igual que en C.4.

Si instalaste también C.7, sumale además sus 3 piezas (workflow nuevo +
2 diffs) al repo nuevo — mismo criterio, copiar/aplicar tal cual.

## C.7 Incremento — el Coordinador también decide ajustes de PR (opcional)

Se instala **después** de C.1-C.6 (necesita que el Coordinador y sus
credenciales ya existan) y cierra un segundo punto de intervención
humana: hoy, si `revisar-pr.yml` (Parte A) encuentra un hallazgo
REAL/CRÍTICO pero el PR ya gastó su único intento automático de
corrección, el comentario queda esperando que alguien escriba `/ajustar`
a mano. Con esto, decide el Coordinador — con un límite de seguridad
para no entrar en loop (máximo **un** ajuste extra por PR, después
escala con la label `esperando-humano`).

### Modificar `revisar-pr.yml` (ya existe, de la Parte A)

Reemplazá el bloque de decisión (donde dice "Después de publicar el
comentario, decidí si corresponde disparar una corrección automática")
por esta versión, que agrega la marca `🧭 ESPERANDO_DECISION` al
comentario cuando el intento automático ya se usó y sigue habiendo
hallazgos reales:

```diff
- Cuando tengas los resultados, escribe UN solo comentario consolidado
+ Antes de escribir el comentario, decidí cuál de estos 3 casos aplica —
+ porque en uno de ellos el comentario necesita una marca especial:
+
+ - **Caso A** — NO hay ningún hallazgo REAL/CRÍTICO.
+ - **Caso B** — SÍ hay al menos un hallazgo REAL/CRÍTICO, pero este PR
+   ya tiene más de 1 commit → ya se usó el único intento automático.
+ - **Caso C** — SÍ hay al menos un hallazgo REAL/CRÍTICO Y este PR tiene
+   exactamente 1 commit (nunca se corrigió automáticamente antes).
+
+ Escribe UN solo comentario consolidado
  (más severo primero, con secciones claras por subagente, marcando
  explícitamente cada hallazgo como REAL/CRÍTICO o COSMÉTICO/INFORMATIVO)
- a un archivo temporal con Write, y publícalo con:
+ a un archivo temporal con Write. Si el caso es **B**, agregá al final
+ del comentario, en su propia línea, EXACTAMENTE este texto:
+
+ ```
+ 🧭 ESPERANDO_DECISION: hay hallazgos reales sin corregir y ya se usó el intento automático de corrección.
+ ```
+
+ Publicá el comentario con:

  ```
  gh pr comment ${{ github.event.pull_request.number }} --body-file <ruta-del-archivo>
  ```

- Después de publicar el comentario, decidí si corresponde disparar una
- corrección automática, con esta regla exacta:
+ Después de publicar el comentario, actuá según el caso:

- - Si NO hay ningún hallazgo REAL/CRÍTICO (solo cosméticos, informativos, o
-   ninguno) → no hagas nada más, terminaste.
- - Si SÍ hay al menos un hallazgo REAL/CRÍTICO, pero este PR ya tiene más de
-   1 commit (${{ github.event.pull_request.commits }} > 1, es decir ya se
-   corrigió automáticamente antes) → no dispares otra corrección, ya se usó
-   el único intento automático permitido; deja el comentario para que un
-   humano decida. Terminaste.
- - Si SÍ hay al menos un hallazgo REAL/CRÍTICO Y este PR tiene exactamente 1
-   commit (nunca se corrigió automáticamente antes) → disparás la Routine de
-   corrección UNA sola vez, ejecutando exactamente:
+ - **Caso A** → no hagas nada más, terminaste.
+ - **Caso B** → no dispares ninguna corrección — el comentario ya lleva
+   la marca de arriba, que el Coordinador va a leer para decidir.
+   Terminaste.
+ - **Caso C** → disparás la Routine de corrección UNA sola vez,
+   ejecutando exactamente:
```

### `.github/workflows/coordinador-avisar-ajuste.yml` (nuevo, cada repo de proyecto)

```yaml
name: Avisar al Coordinador central de un ajuste pendiente

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  avisar_coordinador:
    if: >
      github.event.issue.pull_request != null &&
      github.event.comment.user.type == 'Bot' &&
      contains(github.event.comment.body, '🧭 ESPERANDO_DECISION')
    runs-on: ubuntu-latest
    steps:
      - name: 🧭 Avisar al Coordinador central vía API
        run: |
          RESPONSE=$(curl -s -X POST "https://api.anthropic.com/v1/claude_code/routines/${{ vars.ROUTINE_COORDINADOR_ID }}/fire" \
            -H "Authorization: Bearer ${{ secrets.COORDINADOR_API_TOKEN }}" \
            -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
            -H "anthropic-version: 2023-06-01" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"El PR #${{ github.event.issue.number }} de ${{ github.repository }} tiene hallazgos reales de revisión sin corregir, y ya se usó el intento automático de corrección. Repo completo: ${{ github.repository }}. Revisá el hilo del PR y decidí si pedís un ajuste más (con /ajustar) o si esto queda esperando una decisión humana.\"}")
          echo "$RESPONSE"
```

Reusa `COORDINADOR_API_TOKEN`/`ROUTINE_COORDINADOR_ID` (C.4) — no hace
falta ninguna Routine ni secret/variable nueva.

### Modificar `ajustar-pr.yml` (ya existe, de la Parte A)

Mismo cambio que ya se le hizo a `disparar-routine.yml` en C.3, para que
el Coordinador pueda postear `/ajustar`:

```diff
- github.event.comment.user.type != 'Bot' &&
- contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) &&
+ (contains(fromJSON('["OWNER","COLLABORATOR","MEMBER"]'), github.event.comment.author_association) || github.event.comment.user.type == 'Bot') &&
```

### Checklist de C.7

1. Editar `GH_TOKEN_COORDINADOR` (el mismo, no uno nuevo): agregar
   `Pull requests: Read and write`.
2. Aplicar los dos diffs (`revisar-pr.yml`, `ajustar-pr.yml`) en cada
   repo de proyecto.
3. Agregar `coordinador-avisar-ajuste.yml` en cada repo de proyecto.
4. Confirmar que la label `esperando-humano` ya existe (se creó en A.4)
   — se reusa tal cual, no hace falta crear una nueva.

### Probar C.7

Más difícil de forzar que el resto — depende de que un PR real tenga un
hallazgo que sobreviva la primera corrección automática. Si no querés
esperar a que ocurra naturalmente, podés introducir a propósito un bug
menor y pedir dos rondas de corrección, revisando que la segunda vez el
comentario de `revisar-pr.yml` lleve la marca y el Coordinador reaccione
(con `/ajustar` o escalando, según el caso).

---

# PARTE D — Modelo de IA según esfuerzo (opcional, por proyecto)

No es un ahorro de costo — es un upgrade selectivo de capacidad para el
trabajo de mayor riesgo. Reusa la clasificación `esfuerzo-chico`/
`esfuerzo-grande` que el `planificador` (Parte A) ya pone como label al
publicar el plan — no agrega ningún mecanismo de clasificación nuevo,
solo hace que la Routine que implementa el plan sea distinta según esa
label.

## D.1 Qué se crea (por proyecto)

- **Una Routine nueva**, copia exacta de `implementar-plan-aprobado`
  (mismas instrucciones, mismo Environment) pero configurada con un
  modelo más capaz (Opus en vez de Sonnet) al crearla.
- **Dos valores de configuración nuevos**, en el repo de proyecto:
  `ROUTINE_API_TOKEN_GRANDE` (Secret) y `ROUTINE_IMPLEMENTAR_GRANDE_ID`
  (Variable) — el token y el ID de esa Routine nueva.

## D.2 Modificar `disparar-routine.yml` y `continuar-plan-pausado.yml`

Agregá este paso antes del que dispara la Routine:

```yaml
- name: Detectar esfuerzo (elige el modelo de la Routine)
  id: esfuerzo
  run: |
    ES_GRANDE=$(jq -r '.issue.labels | map(.name == "esfuerzo-grande") | any' "$GITHUB_EVENT_PATH")
    echo "es_grande=$ES_GRANDE" >> "$GITHUB_OUTPUT"
```

Y cambiá el `env:` del step que dispara la Routine para elegir entre las
dos según ese resultado:

```yaml
env:
  ROUTINE_ID: ${{ steps.esfuerzo.outputs.es_grande == 'true' && vars.ROUTINE_IMPLEMENTAR_GRANDE_ID || vars.ROUTINE_IMPLEMENTAR_ID }}
  ROUTINE_TOKEN: ${{ steps.esfuerzo.outputs.es_grande == 'true' && secrets.ROUTINE_API_TOKEN_GRANDE || secrets.ROUTINE_API_TOKEN }}
```

(Ajustá los nombres de la variable `ROUTINE_ID`/`ROUTINE_TOKEN` a los
que ya use tu `run:` — el punto es la expresión ternaria, no el nombre.)

## D.3 Probar

Abrí un Issue de Solicitud de cambio con alcance grande a propósito (o
confirmá que el plan lo clasificó como `esfuerzo-grande`) y revisá, en
el log de Actions del paso que dispara la Routine, que el `ROUTINE_ID`
usado sea el de la Routine nueva (con Opus), no el original.

---

# PARTE E — Despliegue real en servidor (cPanel dev/preprod)

Primera vez que la fábrica sale de "todo vive en GitHub Actions" hacia
un servidor real donde la app corre de verdad. Esta parte asume un
hosting compartido con **cPanel** — si tu servidor es distinto (VPS
propio, otro panel), la lógica de fondo (subdominios separados para
dev/preprod, base de datos separada por ambiente, generar el cliente de
Prisma sin depender del servidor si hace falta) sigue aplicando, pero
los pasos de UI no.

**Arquitectura de infraestructura recomendada** (independiente de la
arquitectura de la fábrica de las Partes A-D):
- **Desarrollo y preproducción comparten un solo cPanel** — carpetas y
  bases de datos separadas, mismo panel/recursos. Evita pagar/administrar
  un panel por ambiente.
- **Producción es un cPanel separado por proyecto** (por repo/producto,
  no por cliente/tenant si tu app es multi-tenant) — para que la caída
  de un proyecto no afecte a los demás.

## E.1 Por cada proyecto: subdominios

Uno para dev, uno para preprod, cada uno con su propia carpeta —
**cPanel → Domains → Create A New Domain**:

- `dev.<tudominio>` → **desmarcá** "Share document root" (el checkbox
  viene marcado por defecto, y esa elección es permanente) → Document
  Root propio, ej. `dev-<nombre-proyecto>`.
- `preprod.<tudominio>` → mismo patrón, ej. `preprod-<nombre-proyecto>`.

**Gotcha real:** escribí el nombre completo del subdominio de una sola
vez en el campo Domain — si lo corregís después de haber tocado otros
campos, cPanel puede autocompletar mal (duplicar un segmento del
dominio). Si el Document Root queda mal después de crear el dominio, se
corrige entrando a **Manage** de ese dominio y escribiendo la ruta
correcta en "New Document Root", sin necesidad de borrar y recrear todo.

## E.2 Por cada proyecto: base de datos

Una base + un usuario por ambiente (PostgreSQL si tu proyecto lo
necesita — confirmá primero en **cPanel → buscar "PostgreSQL
Databases"** que el hosting lo soporte, no asumas que solo hay MySQL).
Con el wizard (**PostgreSQL Database Wizard**):

1. Crear la base (ej. `<proyecto>_dev`).
2. Crear el usuario — **el nombre de usuario no puede ser idéntico al
   nombre de la base** (cPanel lo rechaza con "not allowed to create a
   user with the same name"), agregale un sufijo como `_app`.
3. **Bug visual conocido del wizard:** en el paso 3 ("Add user to the
   database") puede mostrar el nombre de la base con el prefijo de la
   cuenta duplicado — es solo un error de visualización de ese paso, no
   pasa nada realmente mal. Si preferís no arriesgarte, salí con
   "Return to PostgreSQL Databases Main" y vinculá el usuario a la base
   manualmente desde la sección "Add User To Database" más abajo en esa
   misma pantalla (ahí sí aparece el nombre correcto).
4. Repetir para preprod.

Guardá las contraseñas generadas en un lugar seguro de tu lado (gestor
de contraseñas, o un secret) — no hace falta compartirlas para seguir
con los pasos de UI siguientes.

## E.3 Por cada proyecto: la app Node.js (o el stack que use tu proyecto)

**Orden recomendado, confirmado en vivo:** cloná el repo PRIMERO,
recién después creá la app Node.js sobre esa misma carpeta — invertir
este orden (crear la app y clonar después) es lo que rompe el
`.htaccess`, ver el gotcha en E.5.

**Paso A — clonar el repo.** cPanel → **Git™ Version Control → Create
Repository**, con "Clone a Repository" activado:

- **Clone URL**: la URL pública del repo (`https://github.com/<owner>/<repo>.git`
  — si es privado, hace falta una credencial en la URL o una deploy key,
  no cubierto acá).
- **Repository Path**: la carpeta creada en E.1 (ej. `dev-<proyecto>`).

**Gotcha real, confirmado en una cuenta cPanel recién creada:** el
propio `Create A New Domain` de E.1 ya deja la carpeta con contenido
(`.well-known/`, `Cgi-bin/` — scaffolding automático de cPanel), aunque
todavía no hayas creado ninguna app Node ahí. El clone falla con
`"You cannot use the '.../<carpeta>' directory because it already
contains files."` **Antes de clonar**, andá al File Manager, entrá a
esa carpeta, activá "Show Hidden Files (dotfiles)", seleccioná todo
(incluidas `.well-known` y `Cgi-bin`) y borralo — son carpetas vacías
de scaffolding, no tienen nada tuyo, borrarlas es seguro.

Repetí para preprod, apuntando la rama que corresponda (dev suele ser
`main`/`develop`; para preprod puede convenir crear una rama `pre`
dedicada si no existe, mergeada manualmente desde `main` cuando algo
está listo para promover) — en la pantalla "Administrar" del repo ya
clonado, pestaña "Información básica", campo "Checked-Out Branch".

**Paso B — recién ahora, crear la app.** cPanel → **Setup Node.js App
→ Create Application**, una por ambiente:

- **Node.js version**: la más nueva disponible (los frameworks
  modernos, Prisma incluido, no corren bien en versiones viejas tipo
  Node 10).
- **Application mode**: `Development` para dev, `Production` para
  preprod.
- **Application root**: la carpeta creada en E.1, ya clonada en el
  Paso A.
- **Application URL**: el subdominio de E.1.
- **Application startup file**: el archivo real de arranque de tu app
  (ej. `src/app.js`).
- **Environment variables**: como mínimo `DATABASE_URL` (con la
  credencial de E.2 — **usá una contraseña 100% alfanumérica, ver el
  gotcha en E.6**) y cualquier otra que tu app necesite (revisar
  `.env.example` del repo) — `NODE_ENV` lo pone solo el "Application
  mode" de arriba, no lo agregues a mano.

Por último, en la app de "Setup Node.js App", corré **"Run NPM
Install"**.

## E.4 Gotcha real — el motor "library" de Prisma (WASM) es inestable en hosting restringido (si tu proyecto usa Prisma)

Muchos hostings compartidos con CloudLinux imponen un `ulimit -v` (típico:
4GB) por cuenta. El motor por defecto de Prisma desde ~v5.2x, llamado
**"library"** (un `.so.node` cargado en el mismo proceso vía Node-API,
basado en un runtime Rust/WASM), tiene dos síntomas distintos del mismo
problema de fondo — no asumas que arreglar uno te libra del otro:

**Síntoma 1, al generar el cliente:** `prisma generate` intenta reservar
un bloque grande de memoria virtual de una sola vez al arrancar, sin
importar cuánta memoria real vaya a usar, y falla con:
```
RangeError: WebAssembly.Instance(): Out of memory: Cannot allocate Wasm memory for new instance
```

**Síntoma 2, real, confirmado en vivo (2026-09-17) — mucho más grave:**
incluso con el cliente ya generado y cargando bien, **una consulta real
en producción puede hacer paniquear el motor en tiempo de ejecución**,
con una query tan simple como `prisma.modelo.findMany()` sin nada raro:
```
PANIC: timer has gone away
This is a non-recoverable error which happens when the Prisma Query Engine has a panic.
```
Esto pasó al cargar un dashboard que dispara varias llamadas a la API en
paralelo — cada una paniqueando el motor "library" (que corre EN el
mismo proceso Node, vía Node-API) parece matar el proceso de forma más
sucia que una excepción de JavaScript normal (confirmado por separado:
un `throw`/`MODULE_NOT_FOUND` común no deja procesos pegados, se limpia
solo). Con varias llamadas en paralelo paniqueando a la vez, alcanzó
para agotar el límite de 75 procesos de la cuenta con una sola carga de
página — el hallazgo más importante de todo este documento en cuanto a
causa raíz del bloqueo de procesos.

**No es un bug del código que escribas** — es una consulta de Prisma
completamente estándar. Es una inestabilidad conocida del motor
"library" en hosting con memoria/recursos restringidos.

**Solución real, no un workaround — cambiar al motor "binary":** el
motor binary es un ejecutable separado (`query-engine-<target>`, sin
`.so.node`) que corre como proceso propio en vez de cargarse dentro del
proceso Node — mucho más estable en este tipo de hosting, sin el panic
de "timer has gone away":

```prisma
generator client {
  provider      = "prisma-client-js"
  engineType    = "binary"
  binaryTargets = ["native", "debian-openssl-1.0.x"]
}
```

(El target exacto depende del servidor — confirmalo con el mensaje
de error que da Prisma al intentar cargar el cliente ahí: dice
explícitamente qué target detectó y cuál le falta. En un cPanel real
probado, el sistema operativo reportaba RHEL7 pero el `nodevenv` de
cPanel pedía `debian-openssl-1.0.x` — no asumas que coincide con el
SO que ves en `cat /etc/redhat-release`.)

**El resto del workaround sigue igual** (generá localmente, subí por
`rsync`, nunca corras `prisma generate` en el servidor — ver también el
gotcha de `.npmrc`/`ignore-scripts` en E.6, necesario porque
`@prisma/client` dispara `prisma generate` solo vía su propio
`postinstall`, sin que nadie lo pida explícitamente):

1. En tu máquina local, con `engineType = "binary"` ya en el schema,
   corré `npx prisma generate` (sin la restricción de memoria del
   servidor) — genera los binarios `query-engine-*` para los targets
   configurados.
2. Subí `node_modules/.prisma/client` ya generado al servidor por
   `rsync`/SCP, en vez de correr `prisma generate` ahí:
   ```bash
   rsync -avz --delete -e "ssh -i <tu-clave> -p <puerto>" node_modules/.prisma/ usuario@servidor:<ruta-app>/node_modules/.prisma/
   ```
   (`--delete` importa acá si estás migrando de motor library a binary
   en una app que ya tenía el `.so.node` viejo subido — si no, quedan
   los dos motores mezclados en el servidor sin necesidad.)
3. Confirmá que carga sin error: `node -e "new (require('@prisma/client').PrismaClient)()"`
   dentro del entorno de la app (activalo con el comando que muestra la
   página de "Setup Node.js App", algo como
   `source ~/nodevenv/<app>/<version>/bin/activate && cd ~/<carpeta-app>`).
4. **La prueba real no es solo instanciar el cliente — es hacer una
   consulta real** (`$queryRaw` o `findMany` contra una tabla real). El
   síntoma 2 solo aparece en runtime, con datos reales, no al
   instanciar. Confirmalo antes de dar por cerrado el gotcha.

## E.5 Gotcha real — vaciar la carpeta de una app ya creada rompe el `.htaccess`

Si seguiste E.3 en el orden "crear la app Node primero, vaciar después
para clonar" (en vez de vaciar antes de crear la app), vaciar la carpeta
con File Manager borra también el `.htaccess` que "Setup Node.js App"
había generado con las directivas de Passenger
(`PassengerAppRoot`/`PassengerBaseURI`/`PassengerNodejs`/
`PassengerAppType`/`PassengerStartupFile`). Sin ese archivo, cualquier
Stop/Save de esa app falla con `FileNotFoundError` desde el
`cl_selector` de CloudLinux, con un mensaje que sugiere (equivocadamente)
un problema de límite de recursos.

**Evitarlo:** crear la app Node DESPUÉS de clonar el repo en la carpeta,
no antes. Si ya pasó, se arregla recreando el archivo a mano (por SSH o
Terminal) con:

```
PassengerAppRoot "<ruta-completa-de-la-app>"
PassengerBaseURI "/"
PassengerNodejs "<ruta-al-binario-node-del-nodevenv>"
PassengerAppType node
PassengerStartupFile <archivo-de-arranque>
```

## E.6 Gotcha real — contraseñas con caracteres especiales corrompen el `SetEnv`

Las "Environment variables" que cargás en **Setup Node.js App** las
escribe cPanel como directivas `SetEnv` dentro del `.htaccess` de la
app (envueltas en `<IfModule Litespeed>` si el servidor es LiteSpeed —
confirmalo con `curl -sI https://<tudominio>` y mirá el header
`server:`, no asumas cuál es). Si la contraseña de la base de datos
tiene ciertos caracteres especiales (confirmado con `{`, sospechoso
también `?`/`;` por ser caracteres reservados en URLs), cPanel puede
escribir mal la línea — en un caso real quedó insertado un **espacio
antes del `@`** (`...contraseña @localhost...`), lo que rompe el
parseo del `DATABASE_URL` con errores confusos tipo `PANIC: timer has
gone away` del motor de Prisma, sin ningún mensaje que apunte a la
causa real.

**Evitarlo:** generá las contraseñas de base de datos (E.2) **100%
alfanuméricas, sin ningún símbolo** — no confíes en que el generador de
contraseñas de cPanel evite esto solo, revisá el resultado. Si ya
creaste una con símbolos y algo no conecta, lo primero a mirar es el
`.htaccess` de la app (`cat` por SSH, o File Manager con archivos
ocultos visibles) para confirmar que la línea `SetEnv DATABASE_URL...`
quedó exactamente como la escribiste.

## E.7 Gotcha real — la cuenta puede agotar su límite de procesos, causa raíz confirmada

Las cuentas cPanel compartidas con CloudLinux tienen un límite de
**cantidad de procesos simultáneos** (no de memoria) — buscalo en
**cPanel → Resource Usage → "Number Of Processes"**. Si llega a 100%,
**absolutamente todo lo que necesite crear un proceso nuevo falla**
(`cagefs_enter: Unable to fork`): SSH, Terminal, Resource Usage, crear
una app nueva — no es un problema de una herramienta puntual, y no hay
forma de destrabarlo sin acceso root/WHM (subir el límite de procesos,
NPROC, del paquete).

**Causa raíz confirmada en vivo (2026-09-17), reproducida de forma
controlada:** no es tener varias apps activas, ni sesiones SSH mal
cerradas (se descartó explícitamente — ver el detalle en E.4). Es el
**panic del motor "library" de Prisma en tiempo de ejecución**
("timer has gone away", ver E.4) — cargar una página que dispara varias
consultas de Prisma en paralelo (típico de un dashboard) hizo que
varias instancias del motor paniquearan al mismo tiempo, y eso agotó
el cupo de 75 procesos con una sola carga de página. Reproducido dos
veces en la misma sesión: 0 procesos en subdominios/BD/clone/npm
install/rsync, salto directo a 75/75 solo al cargar el dashboard con el
motor "library" activo.

**La solución es la de E.4 (cambiar a `engineType = "binary"`), no
subir el límite de procesos** — subir el límite tapa el síntoma pero no
arregla que el motor siga paniqueando. Si tu proyecto no usa Prisma, o
ya usás el motor binary y seguís topando el límite, ahí sí valdría la
pena pedir subir el NPROC como estaba planteado antes.

**Mientras se aplica el fix, o si vuelve a pasar por otra causa:**
esperar no lo resuelve (la limpieza de la LVE puede tardar mucho o no
pasar) — hay que pedirle a quien tenga acceso root/WHM que libere la
cuenta o suba el límite temporalmente. Pedir también que confirmen qué
lo está consumiendo (`lveinfo` desde WHM) en vez de asumir.

**Reglas generales que siguen aplicando, más allá de esta causa
puntual:**
- No encadenar muchas conexiones SSH automatizadas sin manejar bien el
  cierre, y dejar que una conexión termine limpio antes de abrir la
  siguiente.
- Mientras no esté confirmado que el fix de Prisma resolvió todo del
  todo, mantené una sola app Node.js "Started" a la vez (dev o
  preprod, nunca las dos) — Detener (no Destruir) la que no estés
  usando desde Setup Node.js App antes de iniciar la otra.

## E.8 Despliegue automático — diseñado (2026-09-17), sin probar en vivo todavía

`.github/workflows/deploy-cpanel.yml` (reemplaza cualquier workflow viejo
apuntando a otra infra, ej. Contabo/pm2, que ya no aplica): dispara con
`push` a `main` (→ dev) o `pre` (→ preprod), nunca mergea nada — el merge
sigue siendo 100% manual, esto solo actúa después de que ya se mergeó.

**Decisión de diseño clave, a partir del incidente de E.7:** `npm ci` y
`npx prisma generate` corren en el runner de GitHub Actions (sin límite
de procesos ni de memoria), nunca en el cPanel compartido — el `rsync`
sube `node_modules` ya armado. El servidor no vuelve a correr una
instalación de dependencias ni el generate de Prisma en el flujo
automático, lo que reduce el riesgo de repetir el bloqueo de procesos.
Usa la acción `easingthemes/ssh-deploy` (ya estaba probada en el
workflow viejo, action real y mantenida, no un endpoint de cPanel sin
confirmar).

**Gotcha evitado antes de que pase, no encontrado en vivo:** el rsync
usa `--delete` para mantener el servidor igual al repo — sin excluir
bien, borraría el `.htaccess` que genera "Setup Node.js App" (no vive
en el repo de Git), repitiendo el gotcha de E.5. El `EXCLUDE` del
workflow protege `.htaccess`, `tmp/` y `stderr.log` explícitamente.

El restart de la app después del deploy es **tocar `tmp/restart.txt`**
(mecanismo nativo de Phusion Passenger, el motor que usa "Setup
Node.js App" — confirmado por las directivas `Passenger*` que ya vimos
en el `.htaccess`), no hace falta ningún botón de la UI ni SSH aparte.

**Secrets/variables nuevos a crear por repo** (Settings → Secrets and
variables → Actions):
- Secret `CPANEL_SSH_PRIVATE_KEY` — la clave privada ya autorizada en
  la cuenta (ver E.3/gotcha de clave SSH).
- Variables (no secrets, no son sensibles): `CPANEL_SSH_HOST`,
  `CPANEL_SSH_PORT`, `CPANEL_SSH_USER`, `CPANEL_PATH_DEV`,
  `CPANEL_PATH_PREPROD`.

**Sin probar en vivo todavía** — depende de que el cPanel esté
disponible (ver E.7, bloqueado por el límite de procesos al
2026-09-17). Primera prueba real: push chico a `main` después de que
se confirme que dev responde manualmente.

## E.9 Qué falta (no cubierto todavía en esta parte)

- **El merge `pre → prod`** — sigue siendo, a propósito, 100% manual
  (mismo principio de toda esta guía), y el cPanel de producción
  (separado por proyecto, ver arriba) todavía no se instaló en ningún
  proyecto real.

---

# Qué NO es parte de este sistema (a propósito)

- **El merge a la rama principal** — siempre manual, sin excepción,
  incluso con el Coordinador de la Parte C instalado — llega hasta "PR
  listo", nunca lo mergea él. No hay ninguna configuración acá que lo
  automatice.
- **El despliegue automático a producción** — la Parte E cubre cómo
  levantar dev/preprod a mano; el `pre → prod` sigue siendo manual, sin
  excepción, por el mismo principio.
- **Confirmación de que funciona en cuentas distintas de la original**
  — este documento está escrito para que sea portable a cualquier cuenta
  (nada asume una cuenta específica), pero la validación en vivo
  completa se hizo en una sola cuenta de GitHub hasta ahora. Si algo no
  coincide exactamente con lo que ves en tu cuenta, es información nueva
  a corregir en este documento, no necesariamente un error tuyo.
