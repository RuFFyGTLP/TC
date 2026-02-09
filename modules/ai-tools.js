// ===============================
// AI Tools System
// ===============================

const aiTools = {
    // File operations
    readFile: {
        name: 'readFile',
        description: 'Lee el contenido de un archivo',
        parameters: { path: 'string' },
        execute: async (params) => {
            // In browser, we use File System Access API
            try {
                const [fileHandle] = await window.showOpenFilePicker();
                const file = await fileHandle.getFile();
                return await file.text();
            } catch (e) {
                return `Error: ${e.message}`;
            }
        }
    },

    writeFile: {
        name: 'writeFile',
        description: 'Escribe contenido a un archivo',
        parameters: { path: 'string', content: 'string' },
        execute: async (params) => {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: params.path.split('/').pop()
                });
                const writable = await handle.createWritable();
                await writable.write(params.content);
                await writable.close();
                return 'Archivo guardado correctamente';
            } catch (e) {
                return `Error: ${e.message}`;
            }
        }
    },

    // Web search
    searchWeb: {
        name: 'searchWeb',
        description: 'Busca información en la web',
        parameters: { query: 'string' },
        execute: async (params) => {
            // Using DuckDuckGo instant answers API (no key needed)
            try {
                const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1`);
                const data = await response.json();
                return data.Abstract || data.Answer || 'No se encontraron resultados';
            } catch (e) {
                return `Error en búsqueda: ${e.message}`;
            }
        }
    },

    // Current time
    getTime: {
        name: 'getTime',
        description: 'Obtiene la fecha y hora actual',
        parameters: {},
        execute: async () => new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'long' })
    },

    // Calculate
    calculate: {
        name: 'calculate',
        description: 'Realiza cálculos matemáticos',
        parameters: { expression: 'string' },
        execute: async (params) => {
            try {
                // Safe eval using Function constructor
                const result = Function(`"use strict"; return (${params.expression})`)();
                return `Resultado: ${result}`;
            } catch (e) {
                return `Error de cálculo: ${e.message}`;
            }
        }
    },

    // Get project tasks
    getTasks: {
        name: 'getTasks',
        description: 'Obtiene las tareas del proyecto',
        parameters: { status: 'string (optional)' },
        execute: async (params) => {
            let tasks = state.tasks;
            if (params.status) {
                tasks = tasks.filter(t => t.status === params.status);
            }
            return JSON.stringify(tasks, null, 2);
        }
    },

    // Create task
    createTask: {
        name: 'createTask',
        description: 'Crea una nueva tarea',
        parameters: { title: 'string', description: 'string', priority: 'string', assignedTo: 'string' },
        execute: async (params) => {
            const task = {
                id: `task-${Date.now()}`,
                title: params.title,
                description: params.description || '',
                priority: params.priority || 'medium',
                assignedTo: params.assignedTo || 'orquestador',
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            state.tasks.push(task);
            saveState();
            render();
            return `Tarea creada: ${task.title} (ID: ${task.id})`;
        }
    }
};

// ===============================
// Tool Execution
// ===============================
async function executeToolCall(toolName, params) {
    const tool = aiTools[toolName];
    if (!tool) {
        return `Error: Herramienta '${toolName}' no encontrada`;
    }

    try {
        const result = await tool.execute(params);
        addActivity('SISTEMA', 'TOOL_EXEC', `Ejecutada herramienta: ${toolName}`);
        return result;
    } catch (e) {
        return `Error ejecutando ${toolName}: ${e.message}`;
    }
}

// ===============================
// Agent Specializations
// ===============================
const agentSpecs = {
    architect: {
        name: 'Arquitecto',
        systemPrompt: `Eres un arquitecto de software senior. Tu rol es:
- Diseñar la arquitectura de sistemas
- Definir patrones y mejores prácticas
- Revisar código y proponer mejoras
- Crear diagramas y documentación técnica
- Dividir proyectos grandes en tareas manejables

Siempre responde de forma estructurada usando markdown.
Cuando te pidan implementación, delega al Implementador.`,
        tools: ['readFile', 'searchWeb', 'getTasks', 'createTask']
    },

    fullstack: {
        name: 'Full-Stack Developer',
        systemPrompt: `Eres un desarrollador full-stack experto. Tu rol es:
- Escribir código limpio y eficiente
- Implementar features y corregir bugs
- Crear tests unitarios y de integración
- Optimizar rendimiento
- Documentar código

Muestra código siempre que sea útil.
Usa bloques de código markdown con el lenguaje especificado.`,
        tools: ['readFile', 'writeFile', 'calculate', 'getTasks']
    },

    tester: {
        name: 'QA Engineer',
        systemPrompt: `Eres un ingeniero de QA experto. Tu rol es:
- Diseñar casos de prueba
- Escribir tests automatizados
- Identificar bugs y edge cases
- Validar requisitos
- Reportar problemas de forma clara

Siempre incluye pasos para reproducir y resultado esperado.`,
        tools: ['readFile', 'getTasks', 'searchWeb']
    },

    devops: {
        name: 'DevOps Engineer',
        systemPrompt: `Eres un ingeniero DevOps experto. Tu rol es:
- Configurar pipelines de CI/CD
- Gestionar infraestructura
- Optimizar despliegues
- Monitorear sistemas
- Automatizar procesos

Incluye siempre comandos y configuraciones específicas.`,
        tools: ['readFile', 'writeFile', 'searchWeb']
    }
};

// ===============================
// Autonomous Task Decomposition
// ===============================
async function decomposeTask(taskDescription) {
    const prompt = `Analiza esta tarea y divídela en subtareas específicas y accionables:

TAREA: ${taskDescription}

Responde SOLO con un JSON array con este formato:
[
    { "title": "Subtarea 1", "priority": "high|medium|low", "estimatedHours": 2, "dependencies": [] },
    ...
]`;

    const response = await generateAIResponse(prompt);

    try {
        // Extract JSON from response
        const match = response.match(/\[[\s\S]*\]/);
        if (match) {
            return JSON.parse(match[0]);
        }
    } catch (e) {
        console.error('Error parsing task decomposition:', e);
    }

    return null;
}

// ===============================
// Handoff Automation
// ===============================
async function generateHandoffContext(task, fromAgent, toAgent) {
    const prompt = `Genera un resumen de contexto para transferir esta tarea:

TAREA: ${task.title}
DESCRIPCIÓN: ${task.description}
DE: ${fromAgent}
A: ${toAgent}

Incluye:
1. Estado actual del trabajo
2. Decisiones tomadas
3. Próximos pasos recomendados
4. Archivos relevantes
5. Posibles problemas a tener en cuenta`;

    return await generateAIResponse(prompt);
}

async function autoHandoff(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return null;

    // Determine target agent based on task type
    const currentAgent = task.assignedTo;
    const targetAgent = currentAgent === 'orquestador' ? 'implementador' : 'orquestador';

    // Generate context
    const context = await generateHandoffContext(task, currentAgent, targetAgent);

    // Create handoff
    const handoff = {
        id: `handoff-${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        from: currentAgent,
        to: targetAgent,
        context: context,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    state.handoffs.push(handoff);
    task.assignedTo = targetAgent;
    saveState();
    render();

    addActivity(currentAgent.toUpperCase(), 'HANDOFF', `Transferencia automática a ${targetAgent}: ${task.title}`);

    return handoff;
}

// ===============================
// Multi-Agent Debate (Consensus Layer)
// ===============================
async function debateQuestion(question, participants = ['orquestador', 'implementador']) {
    const responses = [];

    // Get response from each participant
    for (const agent of participants) {
        const originalAgent = chatState.currentAgent;
        chatState.currentAgent = agent;

        const response = await generateAIResponse(`
Pregunta para debate: ${question}

Responde desde tu perspectiva como ${agentSpecs[state.settings[agent]?.spec || 'architect'].name}.
Sé conciso pero argumenta tu posición.`);

        responses.push({ agent, response });
        chatState.currentAgent = originalAgent;
    }

    // Synthesize responses
    const synthesis = await generateAIResponse(`
Sintetiza las siguientes respuestas en una conclusión unificada:

${responses.map(r => `**${r.agent}**: ${r.response}`).join('\n\n')}

Pregunta original: ${question}

Proporciona:
1. Puntos de acuerdo
2. Puntos de desacuerdo
3. Recomendación final`);

    return {
        question,
        responses,
        synthesis
    };
}

// ===============================
// Project Analysis
// ===============================
async function analyzeProject() {
    const analysis = {
        timestamp: new Date().toISOString(),
        tasks: {
            total: state.tasks.length,
            pending: state.tasks.filter(t => t.status === 'pending').length,
            inProgress: state.tasks.filter(t => t.status === 'in_progress').length,
            completed: state.tasks.filter(t => t.status === 'completed').length
        },
        handoffs: {
            total: state.handoffs.length,
            pending: state.handoffs.filter(h => h.status === 'pending').length
        },
        agents: {
            orquestador: state.settings.orquestador?.enabled,
            implementador: state.settings.implementador?.enabled
        }
    };

    // Generate AI insights
    const insights = await generateAIResponse(`
Analiza estos datos del proyecto y proporciona insights:

${JSON.stringify(analysis, null, 2)}

Proporciona:
1. Estado general del proyecto
2. Posibles cuellos de botella
3. Recomendaciones de mejora
4. Próximos pasos sugeridos`);

    analysis.insights = insights;
    return analysis;
}

// Export for global access
window.aiTools = aiTools;
window.executeToolCall = executeToolCall;
window.decomposeTask = decomposeTask;
window.autoHandoff = autoHandoff;
window.debateQuestion = debateQuestion;
window.analyzeProject = analyzeProject;
