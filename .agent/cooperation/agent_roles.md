# 🤖 Roles de Agentes

Definición de roles y responsabilidades en el sistema multi-agente.

---

## Agente Orquestador

**Identificador**: `orquestador`

### Responsabilidades

- 📐 **Planificación**: Analizar solicitudes y dividir en tareas
- 🔍 **Revisión**: Validar código y artefactos del implementador
- 🧩 **Integración**: Combinar resultados de múltiples tareas
- 📊 **Priorización**: Ordenar tareas por importancia y dependencias
- 🎯 **Arquitectura**: Decisiones de diseño de alto nivel

### Cuándo Actuar

- Al recibir una nueva solicitud del usuario
- Al completarse tareas del implementador
- Para resolución de conflictos o bloqueos

### Archivos que Modifica

- `task_broker.md` (crear/actualizar tareas)
- `shared_state.json` (estado global)
- Archivos de planificación y diseño

---

## Agente Implementador

**Identificador**: `implementador`

### Responsabilidades

- 💻 **Codificación**: Escribir código según especificaciones
- 🧪 **Testing**: Crear y ejecutar pruebas
- 📝 **Documentación**: Documentar código y APIs
- 🐛 **Debugging**: Resolver errores y problemas
- 🔧 **Refactoring**: Mejorar código existente

### Cuándo Actuar

- Al tener tareas asignadas en `task_broker.md`
- Al recibir handoff del orquestador
- Para tareas de implementación específicas

### Archivos que Modifica

- Código fuente del proyecto
- Tests
- Documentación técnica

---

## Matriz de Decisión

| Situación | Responsable | Acción |
|-----------|-------------|--------|
| Nueva solicitud del usuario | Orquestador | Analizar y dividir |
| Tarea de código asignada | Implementador | Ejecutar |
| Revisión necesaria | Orquestador | Validar |
| Bug encontrado | Implementador | Corregir |
| Conflicto de merge | Orquestador | Resolver |
| Documentación de API | Implementador | Escribir |
| Decisión arquitectónica | Orquestador | Decidir |

---

## Comunicación Entre Agentes

### Del Orquestador al Implementador

1. Crear tarea en `task_broker.md`
2. Opcionalmente crear handoff con contexto detallado
3. Marcar `assigned_to: implementador`

### Del Implementador al Orquestador

1. Marcar tarea como `status: completed`
2. Agregar notas de implementación
3. Listar archivos modificados

---

## Reglas de Conflicto

1. **Prioridad de tareas**: El orquestador decide
2. **Estándares de código**: Seguir patrones existentes
3. **Bloqueos**: Notificar inmediatamente en `activity_log.md`
4. **Dudas**: Preguntar antes de asumir
