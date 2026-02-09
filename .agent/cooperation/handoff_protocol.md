# 🔄 Protocolo de Handoff

Procedimiento para transferir trabajo entre agentes.

---

## ¿Qué es un Handoff?

Un **handoff** es la transferencia formal de una tarea o contexto de un agente a otro. Incluye toda la información necesaria para que el agente receptor pueda continuar el trabajo sin ambigüedades.

---

## Cuándo Hacer Handoff

| Situación | De | A |
|-----------|-----|-----|
| Tarea de implementación lista | Orquestador | Implementador |
| Código completado para revisión | Implementador | Orquestador |
| Problema arquitectónico encontrado | Implementador | Orquestador |
| Integración necesaria | Implementador | Orquestador |

---

## Formato de Handoff

Agregar al final de `task_broker.md` en la sección "Historial de Handoffs":

```yaml
---
handoff_id: HO-001
timestamp: 2026-02-09T02:00:00Z
from: orquestador
to: implementador
task_ref: TASK-001
status: pending | acknowledged | completed

summary: |
  Breve descripción de lo que se transfiere

context: |
  Contexto detallado sobre la tarea.
  Incluir decisiones tomadas, restricciones,
  y cualquier información relevante.

relevant_files:
  - path: src/components/Example.tsx
    reason: "Componente a modificar"
  - path: src/types/index.ts
    reason: "Tipos a usar"

constraints:
  - "Usar TypeScript estricto"
  - "Seguir patrones existentes"
  - "No agregar dependencias nuevas"

acceptance_criteria:
  - "Tests pasan"
  - "Sin errores de linting"
  - "Documentación actualizada"

questions:
  - "¿Alguna preferencia para el nombre del hook?"

notes_for_review:
  - "Revisar manejo de errores"
---
```

---

## Proceso de Handoff

### Agente Emisor

1. **Preparar contexto**
   - Resumir el estado actual
   - Listar archivos relevantes
   - Documentar decisiones tomadas

2. **Crear entrada de handoff**
   - Usar formato YAML arriba
   - Ser específico en constraints
   - Definir criterios de aceptación claros

3. **Actualizar task_broker.md**
   - Marcar tarea con `assigned_to` correcto
   - Cambiar status a `pending` o `in_progress`

4. **Actualizar activity_log.md**
   - Registrar el handoff

### Agente Receptor

1. **Revisar handoff**
   - Leer contexto completo
   - Revisar archivos listados
   - Entender constraints

2. **Acknowledger**
   - Cambiar `status: acknowledged` en el handoff
   - Registrar en activity_log.md

3. **Ejecutar**
   - Realizar el trabajo
   - Respetar constraints
   - Cumplir acceptance_criteria

4. **Completar**
   - Cambiar `status: completed`
   - Agregar notas si es necesario
   - Preparar handoff de vuelta si aplica

---

## Ejemplo de Flujo

```
1. Usuario pide: "Agregar autenticación OAuth"

2. Orquestador:
   - Crea TASK-001: "Diseñar flujo OAuth"
   - Crea TASK-002: "Implementar backend OAuth"
   - Crea TASK-003: "Implementar UI de login"
   - Handoff TASK-002 y TASK-003 a Implementador

3. Implementador:
   - Acknowledge handoff
   - Implementa backend
   - Implementa UI
   - Marca tareas completadas
   - Handoff de vuelta para revisión

4. Orquestador:
   - Revisa código
   - Integra cambios
   - Entrega al usuario
```

---

## Reglas Importantes

> [!IMPORTANT]
>
> - **Nunca asumir**: Si algo no está claro, preguntar
> - **Ser explícito**: Mejor más contexto que menos
> - **Documentar todo**: El próximo agente no tiene tu memoria
> - **Respetar constraints**: Son obligatorios, no sugerencias
