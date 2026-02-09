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

// Export for global access
window.ENV = ENV;
window.loadEnv = loadEnv;
window.getEnv = getEnv;
