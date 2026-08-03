# Contexto: Fábrica de Software — MiComercio S.A.S.

> **Cómo usar este documento:** pégalo al inicio de cualquier sesión nueva de
> Claude Code (o Claude normal) cuando necesites que entienda el proyecto
> completo sin tener que re-explicarlo. También sirve como referencia propia
> para no perder de vista decisiones ya tomadas vs. pendientes.

## 1. Qué es esto

MiComercio quiere estandarizar cómo se desarrolla, prueba y despliega
software internamente — una "fábrica de software" con un proceso único que
aplique a todos los proyectos, no solo al actual. El primer proyecto real
que se ejecuta bajo este modelo es la migración progresiva de un ERP/POS
existente hacia NestJS/TypeScript, pero la fábrica en sí es el objetivo de
fondo: primero se estructura bien el proceso, y solo después arranca la
migración usando esa fábrica ya funcionando.

Es un proyecto interno de MiComercio, de largo aliento. Se busca un **MVP a
corto plazo** que valide el proceso en un proyecto real ya existente que
necesita mejoras (no un proyecto de práctica), antes de escalarlo a más
proyectos.

## 2. El pipeline completo (visión, 7 etapas)

| # | Etapa | Quién actúa | Estado |
|---|---|---|---|
| 1 | **Solicitud** de ajuste/mejora/módulo nuevo | Humano redacta | Definido: GitHub Issue, sin sistema de tickets a medida en el MVP |
| 2 | **Plan de trabajo** | IA (subagente "planificador") | Por construir |
| 3 | **Aprobación del plan** | Humano | Vía sesión en la nube + notificación push al celular |
| 4 | **Desarrollo** | IA (Claude Code) | Local primero, luego automatizado vía Routine |
| 5 | **Revisión/feedback iterativo** | IA — subagente revisor + **Codex como segunda IA de chequeo cruzado** (no autorevisión) | Codex sin integrar todavía — pendiente de investigar |
| 6 | **Preprod** | Automático (deploy) + Humano (pruebas de interfaz/responsive) | Por construir |
| 7 | **Producción** | 100% manual, a propósito (riesgo) | Decisión ya tomada, no se automatiza |

## 3. Decisiones de arquitectura ya tomadas

- **Un repositorio = un proyecto = una Routine.** No hay clasificador
  automático que decida a qué proyecto pertenece una solicitud — quien la
  redacta decide en qué repo se abre el issue. Un clasificador automático
  de proyectos es una posible mejora de fase 2, no del MVP.
- **Aprobaciones remotas:** se resuelven con sesiones en la nube de Claude
  Code (el mismo mecanismo que usan las Routines) + notificación push a la
  app móvil de Claude — no con Remote Control local, porque ese requiere
  que el computador siga encendido y conectado. Esto **no se ha probado en
  vivo todavía**.
- **Codex** no reemplaza a Claude Code — juega el rol de revisor
  independiente, para que el código no sea evaluado únicamente por la
  misma IA que lo escribió.
- **Cómo se estandariza entre proyectos (la pieza clave):** los Skills de
  proyecto (`.claude/skills/`) solo viven dentro de un repo. Para que la
  fábrica sea de verdad "un mismo proceso para todos los proyectos", las
  reglas comunes (convenciones de código, protocolo de copia segura,
  estándar de documentación, checklist de calidad, plantillas de
  subagentes) deben empaquetarse como un **Plugin de Claude Code**, en su
  propio repositorio separado, e instalarse en cada proyecto. Así, actualizar
  la regla una vez la propaga a todos los proyectos que lo tengan instalado.
  Lo específico de cada proyecto (CLAUDE.md, la Routine, algún Skill muy
  puntual) sigue viviendo en el repo de ese proyecto.
- **Automatización con y sin IA:** las tareas mecánicas/repetitivas deberían
  resolverse con cron de servidor + n8n (sin gastar tokens de IA), y solo lo
  que requiere criterio o análisis pasa por una Routine de Claude Code. Aún
  no se ha definido cómo se reparte esto en la práctica.

## 4. Modelo de calidad (propuesta, pendiente de validar con el jefe)

| Nivel | Estándar propuesto | Para qué |
|---|---|---|
| Producto (el código) | ISO/IEC 25010 | Ya se usa como requisito universitario; se convierte en checklist del subagente revisor |
| Proceso (la fábrica) | ISO/IEC 330xx (SPICE) o CMMI, como marco de referencia | No busca certificación formal — se usa como plantilla para diseñar las etapas del pipeline de forma madura |

## 5. Qué ya está resuelto y probado

- Diferencia y uso de **Cowork vs. Claude Code** (por qué el trabajo técnico
  va por Code, no por Cowork).
- **Routines**: cómo se configuran, disparadores (horario/push/API), por qué
  nunca tocan `main` directo (siempre rama `claude/` + Pull Request).
- **Subagentes**: campos (`name`, `description`, `tools`, `model`, system
  prompt), cómo se orquestan (invocación automática por `description`,
  ejecución en paralelo, coordinación vía sistema de archivos y resultados
  pasados entre agentes).
- **Skills** (personales vs. de proyecto) y la diferencia con subagentes
  (conocimiento pasivo vs. actor que ejecuta).
- **CLAUDE.md** como memoria persistente, incluida la técnica de referenciar
  `@feedback.md` para que se autocargue.
- Ciclo completo probado en vivo con el jefe: bug intencional → detectado
  por la Routine nocturna → corregido al día siguiente con el feedback.

## 6. Pendientes explícitos (no bloquean arrancar, pero hay que resolverlos)

**Técnicos, por investigar:**
- Integración de Codex como revisor independiente dentro del mismo flujo de PR.
- Reparto real de cron/n8n vs. Routines de IA.
- Validar en vivo las sesiones en la nube / notificaciones push para
  aprobación remota (todavía no probado).

**De la migración real (identificados, aún sin resolver):**
- **Characterization tests**: cómo generar una red de seguridad sobre código
  legado que no tiene tests previos.
- **Patrón Strangler Fig**: migración incremental, conectado con el flujo de
  ramas ya definido.
- **Hooks**: mencionados en comparaciones, nunca construidos en la práctica.

**De decisión, no técnicos:**
- El modelo de calidad (sección 4) es una propuesta — falta validación
  formal del jefe.
- El alcance exacto del MVP (¿qué etapas del pipeline, sobre qué proyecto
  específico, en qué plazo?) — sugerido pero no confirmado con el jefe.

## 7. Próximo paso acordado

Validar el flujo completo (Routine + subagentes revisor/tester/documentador
+ CLAUDE.md) sobre un **proyecto real ya existente** que necesita mejoras
(no un ejercicio de práctica). Solo después de que ese flujo funcione bien
en un proyecto, se extraen esos Skills y subagentes hacia un **Plugin**
reutilizable, y se instala en un segundo proyecto para confirmar que se
comporta igual en otro repo.