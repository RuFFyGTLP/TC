// ===============================
// Environment Variables Loader
// ===============================
// Carga variables desde .env para aplicaciones frontend
// Nota: En producción, usar un backend para servir las keys

const ENV = {};

async function loadEnv() {
    try {
        const response = await fetch('.env');
        if (!response.ok) {
            console.warn('[ENV] No .env file found, using defaults');
            return;
        }

        const text = await response.text();
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('#')) continue;

            // Parse KEY=VALUE
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) continue;

            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();

            // Remove quotes if present
            ENV[key] = value.replace(/^["']|["']$/g, '');
        }

        console.log('[ENV] Loaded environment variables:', Object.keys(ENV).length);
        applyEnvToState();

    } catch (e) {
        console.warn('[ENV] Error loading .env:', e.message);
    }
}

function applyEnvToState() {
    // Apply to state.settings.integrations
    if (!state.settings.integrations) {
        state.settings.integrations = {};
    }

    // Local providers
    if (ENV.OLLAMA_ENDPOINT) {
        state.settings.integrations.ollama = state.settings.integrations.ollama || {};
        state.settings.integrations.ollama.endpoint = ENV.OLLAMA_ENDPOINT;
    }

    if (ENV.LMSTUDIO_ENDPOINT) {
        state.settings.integrations.lmstudio = state.settings.integrations.lmstudio || {};
        state.settings.integrations.lmstudio.endpoint = ENV.LMSTUDIO_ENDPOINT;
    }

    // Cloud providers
    if (ENV.OPENAI_API_KEY && ENV.OPENAI_API_KEY !== 'sk-...') {
        state.settings.integrations.openai = ENV.OPENAI_API_KEY;
    }

    if (ENV.ANTHROPIC_API_KEY && ENV.ANTHROPIC_API_KEY !== 'sk-ant-...') {
        state.settings.integrations.anthropic = ENV.ANTHROPIC_API_KEY;
    }

    if (ENV.GOOGLE_AI_KEY && ENV.GOOGLE_AI_KEY !== 'AIza...') {
        state.settings.integrations.google = ENV.GOOGLE_AI_KEY;
    }

    if (ENV.GROQ_API_KEY && ENV.GROQ_API_KEY !== 'gsk_...') {
        state.settings.integrations.groq = ENV.GROQ_API_KEY;
    }

    if (ENV.GITHUB_TOKEN && ENV.GITHUB_TOKEN !== 'ghp_...') {
        state.settings.integrations.github = ENV.GITHUB_TOKEN;
    }

    // Optional settings
    if (ENV.DEFAULT_PROVIDER) {
        state.settings.orquestador = state.settings.orquestador || {};
        state.settings.orquestador.provider = ENV.DEFAULT_PROVIDER;
        state.settings.implementador = state.settings.implementador || {};
        state.settings.implementador.provider = ENV.DEFAULT_PROVIDER;
    }

    if (ENV.DEFAULT_MODEL) {
        state.settings.orquestador = state.settings.orquestador || {};
        state.settings.orquestador.model = ENV.DEFAULT_MODEL;
        state.settings.implementador = state.settings.implementador || {};
        state.settings.implementador.model = ENV.DEFAULT_MODEL;
    }
}

// Helper to get env variable
function getEnv(key, defaultValue = '') {
    return ENV[key] || defaultValue;
}

// ===============================
// API Verification Functions
// ===============================
async function verifyOllama() {
    const endpoint = state.settings.integrations.ollama?.endpoint || ENV.OLLAMA_ENDPOINT || 'http://localhost:11434';
    try {
        const response = await fetch(`${endpoint}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) return { ok: false, error: 'No responde' };
        const data = await response.json();
        return { ok: true, models: data.models?.map(m => m.name) || [] };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function verifyLMStudio() {
    const endpoint = state.settings.integrations.lmstudio?.endpoint || ENV.LMSTUDIO_ENDPOINT || 'http://localhost:1234';
    try {
        const response = await fetch(`${endpoint}/v1/models`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) return { ok: false, error: 'No responde' };
        const data = await response.json();
        return { ok: true, models: data.data?.map(m => m.id) || [] };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function verifyOpenAI() {
    const apiKey = state.settings.integrations.openai || ENV.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-...') return { ok: false, error: 'API Key no configurada' };

    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
            const err = await response.json();
            return { ok: false, error: err.error?.message || 'Error de autenticación' };
        }
        const data = await response.json();
        const chatModels = data.data?.filter(m => m.id.includes('gpt')).map(m => m.id) || [];
        return { ok: true, models: chatModels };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function verifyGoogle() {
    const apiKey = state.settings.integrations.google || ENV.GOOGLE_AI_KEY;
    if (!apiKey || apiKey === 'AIza...') return { ok: false, error: 'API Key no configurada' };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) return { ok: false, error: 'API Key inválida' };
        const data = await response.json();
        const models = data.models?.filter(m => m.name.includes('gemini')).map(m => m.name.split('/').pop()) || [];
        return { ok: true, models };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function verifyGroq() {
    const apiKey = state.settings.integrations.groq || ENV.GROQ_API_KEY;
    if (!apiKey || apiKey === 'gsk_...') return { ok: false, error: 'API Key no configurada' };

    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) return { ok: false, error: 'API Key inválida' };
        const data = await response.json();
        return { ok: true, models: data.data?.map(m => m.id) || [] };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function verifyAllAPIs() {
    console.log('[API] Verificando conexiones...');

    const results = {
        ollama: await verifyOllama(),
        lmstudio: await verifyLMStudio(),
        openai: await verifyOpenAI(),
        google: await verifyGoogle(),
        groq: await verifyGroq()
    };

    console.log('[API] Resultados:', results);
    return results;
}

async function getAvailableModels(provider) {
    switch (provider) {
        case 'ollama': return (await verifyOllama()).models || [];
        case 'lmstudio': return (await verifyLMStudio()).models || [];
        case 'openai': return (await verifyOpenAI()).models || ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        case 'google': return (await verifyGoogle()).models || ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'];
        case 'groq': return (await verifyGroq()).models || ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
        default: return [];
    }
}

// Export for global access
window.ENV = ENV;
window.loadEnv = loadEnv;
window.getEnv = getEnv;
window.verifyOllama = verifyOllama;
window.verifyLMStudio = verifyLMStudio;
window.verifyOpenAI = verifyOpenAI;
window.verifyGoogle = verifyGoogle;
window.verifyGroq = verifyGroq;
window.verifyAllAPIs = verifyAllAPIs;
window.getAvailableModels = getAvailableModels;
