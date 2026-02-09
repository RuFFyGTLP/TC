// ===============================
// Local Models Detection
// ===============================
// Auto-detect Ollama and LM Studio models

const localModels = {
    ollama: { connected: false, models: [], endpoint: 'http://localhost:11434' },
    lmstudio: { connected: false, models: [], endpoint: 'http://localhost:1234' },
    lastCheck: null,
    autoRefreshInterval: null
};

// ===============================
// Ollama Detection
// ===============================
async function detectOllamaModels() {
    const endpoint = state?.settings?.integrations?.ollama?.endpoint || localModels.ollama.endpoint;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${endpoint}/api/tags`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            localModels.ollama.connected = false;
            localModels.ollama.models = [];
            return { connected: false, models: [], error: 'No responde' };
        }

        const data = await response.json();
        const models = (data.models || []).map(m => ({
            id: m.name,
            name: m.name.split(':')[0],
            size: formatBytes(m.size),
            modified: m.modified_at,
            family: m.details?.family || 'unknown',
            parameters: m.details?.parameter_size || 'N/A',
            quantization: m.details?.quantization_level || 'N/A'
        }));

        localModels.ollama.connected = true;
        localModels.ollama.models = models;
        localModels.ollama.endpoint = endpoint;

        console.log('[Models] Ollama detectado:', models.length, 'modelos');

        return { connected: true, models, endpoint };

    } catch (e) {
        localModels.ollama.connected = false;
        localModels.ollama.models = [];
        return { connected: false, models: [], error: e.message };
    }
}

// ===============================
// LM Studio Detection
// ===============================
async function detectLMStudioModels() {
    const endpoint = state?.settings?.integrations?.lmstudio?.endpoint || localModels.lmstudio.endpoint;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${endpoint}/v1/models`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            localModels.lmstudio.connected = false;
            localModels.lmstudio.models = [];
            return { connected: false, models: [], error: 'No responde' };
        }

        const data = await response.json();
        const models = (data.data || []).map(m => ({
            id: m.id,
            name: m.id.split('/').pop().replace(/-/g, ' '),
            owned_by: m.owned_by || 'user',
            type: m.object || 'model'
        }));

        localModels.lmstudio.connected = true;
        localModels.lmstudio.models = models;
        localModels.lmstudio.endpoint = endpoint;

        console.log('[Models] LM Studio detectado:', models.length, 'modelos');

        return { connected: true, models, endpoint };

    } catch (e) {
        localModels.lmstudio.connected = false;
        localModels.lmstudio.models = [];
        return { connected: false, models: [], error: e.message };
    }
}

// ===============================
// Detect All Local Models
// ===============================
async function detectAllLocalModels() {
    console.log('[Models] Detectando modelos locales...');

    const [ollama, lmstudio] = await Promise.all([
        detectOllamaModels(),
        detectLMStudioModels()
    ]);

    localModels.lastCheck = new Date().toISOString();

    const result = {
        ollama,
        lmstudio,
        totalModels: ollama.models.length + lmstudio.models.length,
        timestamp: localModels.lastCheck
    };

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('modelsDetected', { detail: result }));

    return result;
}

// ===============================
// Get Available Models for Provider
// ===============================
function getLocalModels(provider) {
    switch (provider) {
        case 'ollama':
            return localModels.ollama.models;
        case 'lmstudio':
            return localModels.lmstudio.models;
        default:
            return [];
    }
}

function getAllLocalModels() {
    return {
        ollama: localModels.ollama,
        lmstudio: localModels.lmstudio
    };
}

function isProviderConnected(provider) {
    return localModels[provider]?.connected || false;
}

// ===============================
// Auto-Refresh
// ===============================
function startModelAutoRefresh(intervalMinutes = 5) {
    if (localModels.autoRefreshInterval) {
        clearInterval(localModels.autoRefreshInterval);
    }

    localModels.autoRefreshInterval = setInterval(() => {
        detectAllLocalModels();
    }, intervalMinutes * 60 * 1000);

    // Initial detection
    detectAllLocalModels();

    console.log('[Models] Auto-refresh iniciado cada', intervalMinutes, 'minutos');
}

function stopModelAutoRefresh() {
    if (localModels.autoRefreshInterval) {
        clearInterval(localModels.autoRefreshInterval);
        localModels.autoRefreshInterval = null;
    }
}

// ===============================
// UI Helper - Model Selector HTML
// ===============================
function renderModelSelector(provider, selectedModel = '') {
    const models = getLocalModels(provider);
    const connected = isProviderConnected(provider);

    if (!connected) {
        return `
            <div class="model-status disconnected">
                <span class="status-dot"></span>
                <span>${provider === 'ollama' ? 'Ollama' : 'LM Studio'} no detectado</span>
                <button onclick="detectAllLocalModels()" class="btn-detect">🔄 Detectar</button>
            </div>
        `;
    }

    if (models.length === 0) {
        return `
            <div class="model-status warning">
                <span class="status-dot"></span>
                <span>Conectado pero sin modelos instalados</span>
            </div>
        `;
    }

    return `
        <div class="model-status connected">
            <span class="status-dot"></span>
            <span>${models.length} modelo(s) disponible(s)</span>
        </div>
        <select class="model-select" data-provider="${provider}" onchange="updateSelectedModel('${provider}', this.value)">
            ${models.map(m => `
                <option value="${m.id}" ${m.id === selectedModel ? 'selected' : ''}>
                    ${m.name} ${m.size ? `(${m.size})` : ''}
                </option>
            `).join('')}
        </select>
    `;
}

function renderModelsList() {
    const ollama = localModels.ollama;
    const lmstudio = localModels.lmstudio;

    let html = '<div class="models-list">';

    // Ollama section
    html += `
        <div class="provider-section">
            <div class="provider-header">
                <span class="provider-icon">🦙</span>
                <span class="provider-name">Ollama</span>
                <span class="provider-status ${ollama.connected ? 'connected' : 'disconnected'}">
                    ${ollama.connected ? '● Conectado' : '○ Desconectado'}
                </span>
            </div>
            <div class="provider-models">
    `;

    if (ollama.connected && ollama.models.length > 0) {
        for (const model of ollama.models) {
            html += `
                <div class="model-card" onclick="selectModel('ollama', '${model.id}')">
                    <div class="model-name">${model.name}</div>
                    <div class="model-meta">
                        <span>${model.size}</span>
                        <span>${model.parameters}</span>
                    </div>
                </div>
            `;
        }
    } else if (ollama.connected) {
        html += '<div class="no-models">No hay modelos instalados. Usa <code>ollama pull llama3.2</code></div>';
    } else {
        html += '<div class="no-models">Ollama no está ejecutándose</div>';
    }

    html += '</div></div>';

    // LM Studio section
    html += `
        <div class="provider-section">
            <div class="provider-header">
                <span class="provider-icon">🖥️</span>
                <span class="provider-name">LM Studio</span>
                <span class="provider-status ${lmstudio.connected ? 'connected' : 'disconnected'}">
                    ${lmstudio.connected ? '● Conectado' : '○ Desconectado'}
                </span>
            </div>
            <div class="provider-models">
    `;

    if (lmstudio.connected && lmstudio.models.length > 0) {
        for (const model of lmstudio.models) {
            html += `
                <div class="model-card" onclick="selectModel('lmstudio', '${model.id}')">
                    <div class="model-name">${model.name}</div>
                    <div class="model-meta">
                        <span>${model.owned_by}</span>
                    </div>
                </div>
            `;
        }
    } else if (lmstudio.connected) {
        html += '<div class="no-models">No hay modelos cargados en LM Studio</div>';
    } else {
        html += '<div class="no-models">LM Studio no está ejecutándose o el servidor local no está activo</div>';
    }

    html += '</div></div></div>';

    return html;
}

// ===============================
// Utility
// ===============================
function formatBytes(bytes) {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
}

// ===============================
// Initialize on Load
// ===============================
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // Detect models after a short delay to let the app initialize
        setTimeout(() => {
            detectAllLocalModels();
        }, 1000);
    });
}

// Export for global access
window.localModels = localModels;
window.detectOllamaModels = detectOllamaModels;
window.detectLMStudioModels = detectLMStudioModels;
window.detectAllLocalModels = detectAllLocalModels;
window.getLocalModels = getLocalModels;
window.getAllLocalModels = getAllLocalModels;
window.isProviderConnected = isProviderConnected;
window.startModelAutoRefresh = startModelAutoRefresh;
window.renderModelSelector = renderModelSelector;
window.renderModelsList = renderModelsList;
