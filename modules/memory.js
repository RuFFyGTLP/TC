// ===============================
// Agent Memory System
// ===============================
// Persistent memory for agents to remember context across sessions

const agentMemory = {
    shortTerm: new Map(),  // Current session
    longTerm: [],          // Persisted facts
    workingContext: {}     // Current task context
};

// ===============================
// Short-Term Memory
// ===============================
function rememberShortTerm(agent, key, value) {
    if (!agentMemory.shortTerm.has(agent)) {
        agentMemory.shortTerm.set(agent, new Map());
    }
    agentMemory.shortTerm.get(agent).set(key, {
        value,
        timestamp: Date.now()
    });
}

function recallShortTerm(agent, key) {
    const agentMem = agentMemory.shortTerm.get(agent);
    if (!agentMem) return null;

    const item = agentMem.get(key);
    return item ? item.value : null;
}

function clearShortTerm(agent = null) {
    if (agent) {
        agentMemory.shortTerm.delete(agent);
    } else {
        agentMemory.shortTerm.clear();
    }
}

// ===============================
// Long-Term Memory (Persisted)
// ===============================
async function rememberLongTerm(fact) {
    const memory = {
        id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fact,
        importance: calculateImportance(fact),
        createdAt: new Date().toISOString(),
        recallCount: 0,
        lastRecalled: null
    };

    agentMemory.longTerm.push(memory);

    // Persist to IndexedDB
    if (typeof dbSave === 'function') {
        await dbSave('projectContext', {
            path: memory.id,
            type: 'memory',
            content: fact,
            metadata: {
                importance: memory.importance,
                createdAt: memory.createdAt
            }
        });
    }

    // Keep memory size manageable
    if (agentMemory.longTerm.length > 100) {
        pruneMemory();
    }

    return memory;
}

function calculateImportance(fact) {
    // Simple importance scoring
    let score = 0.5;

    // Keywords that indicate importance
    const importantPatterns = [
        /importante|crítico|urgente|priorit/i,
        /error|bug|problema|fallo/i,
        /decisión|arquitectura|diseño/i,
        /usuario|cliente|requisito/i,
        /api|endpoint|integración/i
    ];

    for (const pattern of importantPatterns) {
        if (pattern.test(fact)) score += 0.1;
    }

    // Length bonus (more detail = more important)
    if (fact.length > 100) score += 0.1;
    if (fact.length > 200) score += 0.1;

    return Math.min(score, 1);
}

function recallLongTerm(query, limit = 5) {
    // Simple keyword matching
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const scored = agentMemory.longTerm.map(mem => {
        let relevance = 0;
        const factLower = mem.fact.toLowerCase();

        for (const word of queryWords) {
            if (factLower.includes(word)) relevance += 1;
        }

        // Boost by importance and recency
        relevance *= mem.importance;
        const age = Date.now() - new Date(mem.createdAt).getTime();
        const recencyBoost = Math.max(0, 1 - age / (30 * 24 * 60 * 60 * 1000)); // 30 day decay
        relevance += recencyBoost * 0.5;

        return { ...mem, relevance };
    });

    // Sort by relevance and return top matches
    scored.sort((a, b) => b.relevance - a.relevance);

    // Update recall stats
    const results = scored.slice(0, limit).filter(m => m.relevance > 0);
    for (const mem of results) {
        const original = agentMemory.longTerm.find(m => m.id === mem.id);
        if (original) {
            original.recallCount++;
            original.lastRecalled = new Date().toISOString();
        }
    }

    return results;
}

function pruneMemory() {
    // Remove least important and rarely recalled memories
    agentMemory.longTerm.sort((a, b) => {
        const scoreA = a.importance + (a.recallCount * 0.1);
        const scoreB = b.importance + (b.recallCount * 0.1);
        return scoreB - scoreA;
    });

    // Keep top 80
    agentMemory.longTerm = agentMemory.longTerm.slice(0, 80);
}

// ===============================
// Working Context
// ===============================
function setWorkingContext(key, value) {
    agentMemory.workingContext[key] = value;
}

function getWorkingContext(key) {
    return agentMemory.workingContext[key];
}

function clearWorkingContext() {
    agentMemory.workingContext = {};
}

function getFullWorkingContext() {
    return { ...agentMemory.workingContext };
}

// ===============================
// Context Summary for AI
// ===============================
function buildMemoryContext(query) {
    const memories = recallLongTerm(query, 3);

    if (memories.length === 0) return '';

    let context = '### Memoria del Agente:\n';

    for (const mem of memories) {
        context += `- ${mem.fact}\n`;
    }

    return context + '\n';
}

// ===============================
// Auto-Extract Facts from Chat
// ===============================
function extractFacts(message, response) {
    const facts = [];

    // Extract decisions
    const decisionMatch = response.match(/(?:decidí|decidimos|usaremos|implementaremos|elegí)\s+(.{20,100})/gi);
    if (decisionMatch) {
        facts.push(...decisionMatch);
    }

    // Extract important info
    const importantMatch = response.match(/(?:importante:|nota:|recuerda:)\s*(.{20,150})/gi);
    if (importantMatch) {
        facts.push(...importantMatch.map(m => m.replace(/^(importante:|nota:|recuerda:)\s*/i, '')));
    }

    // Extract technical details
    const techMatch = response.match(/```[\s\S]{50,}?```/g);
    if (techMatch && techMatch.length > 0) {
        facts.push(`Se compartió código relacionado con: ${message.substring(0, 50)}...`);
    }

    return facts;
}

async function learnFromConversation(userMessage, aiResponse) {
    const facts = extractFacts(userMessage, aiResponse);

    for (const fact of facts) {
        await rememberLongTerm(fact);
    }

    // Also store the question-answer pair summary if it's substantial
    if (aiResponse.length > 200) {
        const summary = `Usuario preguntó sobre "${userMessage.substring(0, 50)}..." - Respuesta incluye ${aiResponse.length} caracteres`;
        await rememberLongTerm(summary);
    }
}

// ===============================
// Load/Save Memory
// ===============================
async function loadMemory() {
    try {
        if (typeof dbGetAll === 'function') {
            const memories = await dbGetAll('projectContext', 'type', 'memory');
            for (const mem of memories) {
                agentMemory.longTerm.push({
                    id: mem.path,
                    fact: mem.content,
                    importance: mem.metadata?.importance || 0.5,
                    createdAt: mem.metadata?.createdAt || new Date().toISOString(),
                    recallCount: 0,
                    lastRecalled: null
                });
            }
            console.log('[Memory] Loaded', agentMemory.longTerm.length, 'memories');
        }
    } catch (e) {
        console.warn('[Memory] Error loading:', e);
    }
}

function getMemoryStats() {
    return {
        shortTermAgents: agentMemory.shortTerm.size,
        longTermFacts: agentMemory.longTerm.length,
        workingContextKeys: Object.keys(agentMemory.workingContext).length,
        avgImportance: agentMemory.longTerm.length > 0
            ? Math.round(agentMemory.longTerm.reduce((s, m) => s + m.importance, 0) / agentMemory.longTerm.length * 100) / 100
            : 0
    };
}

// Export for global access
window.agentMemory = agentMemory;
window.rememberShortTerm = rememberShortTerm;
window.recallShortTerm = recallShortTerm;
window.rememberLongTerm = rememberLongTerm;
window.recallLongTerm = recallLongTerm;
window.setWorkingContext = setWorkingContext;
window.getWorkingContext = getWorkingContext;
window.getFullWorkingContext = getFullWorkingContext;
window.buildMemoryContext = buildMemoryContext;
window.learnFromConversation = learnFromConversation;
window.loadMemory = loadMemory;
window.getMemoryStats = getMemoryStats;
