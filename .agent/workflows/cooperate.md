---
description: Activar modo de cooperación multi-agente para dividir trabajo
---

# Workflow: Cooperación Multi-Agente

Este workflow permite a dos IAs cooperar y repartirse el trabajo.

## Prerrequisitos

- Archivos de cooperación en `.agent/cooperation/`
- Ambos agentes con acceso al mismo sistema de archivos

---

## Paso 1: Iniciar Sesión de Cooperación

Lee el estado actual:

```
cat .agent/cooperation/shared_state.json
```

Actualiza el estado para marcar tu agente como online:

- Si eres **Orquestador**: `agents.orquestador.status = "online"`
- Si eres **Implementador**: `agents.implementador.status = "online"`

---

## Paso 2: Revisar Tareas Pendientes

Lee el task broker:

```
cat .agent/cooperation/task_broker.md
```

Busca tareas con:

- `status: pending`
- `assigned_to: [tu_rol]`

---

## Paso 3: Tomar una Tarea

1. Cambia el status de la tarea a `in_progress`
2. Actualiza `shared_state.json` con `current_task`
3. Registra en `activity_log.md`:

   ```
   [FECHA HORA] [TU_ROL] [TASK_START] Iniciando TASK-XXX: "título"
   ```

---

## Paso 4: Ejecutar la Tarea

Trabaja en la tarea según su descripción y acceptance_criteria.

Si necesitas pasar trabajo al otro agente:

1. Lee `.agent/cooperation/handoff_protocol.md`
2. Crea un handoff en `task_broker.md`
3. Registra en `activity_log.md`

---

## Paso 5: Completar la Tarea

1. Mueve la tarea a "Tareas Completadas" en `task_broker.md`
2. Cambia `status: completed`
3. Registra en `activity_log.md`:

   ```
   [FECHA HORA] [TU_ROL] [TASK_COMPLETE] Completada TASK-XXX
   ```

4. Limpia `current_task` en `shared_state.json`

---

## Paso 6: Finalizar Sesión

Cuando termines:

1. Marca tu agente como `offline` en `shared_state.json`
2. Registra en `activity_log.md`:

   ```
   [FECHA HORA] [TU_ROL] [SESSION_END] Sesión finalizada
   ```

---

## Comandos Rápidos

### Ver estado

```bash
cat .agent/cooperation/shared_state.json
```

### Ver tareas

```bash
cat .agent/cooperation/task_broker.md
```

### Ver actividad reciente

```bash
tail -20 .agent/cooperation/activity_log.md
```

---

## Roles

| Rol | Cuándo usarlo |
|-----|---------------|
| **Orquestador** | Primera IA que recibe la solicitud del usuario |
| **Implementador** | Segunda IA que recibe trabajo delegado |

---

## Tips

> [!TIP]
>
> - Siempre lee el contexto completo antes de empezar
> - Actualiza el activity_log frecuentemente
> - Si hay dudas, agrégalas al handoff como preguntas
> - Respeta los constraints del handoff
