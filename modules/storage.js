// ===============================
// IndexedDB Storage Layer
// ===============================
const DB_NAME = 'AgentHubDB';
const DB_VERSION = 1;
let db = null;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            const database = e.target.result;

            // Store for app state
            if (!database.objectStoreNames.contains('state')) {
                database.createObjectStore('state', { keyPath: 'id' });
            }

            // Store for chat history
            if (!database.objectStoreNames.contains('chatHistory')) {
                const chatStore = database.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true });
                chatStore.createIndex('agent', 'agent', { unique: false });
                chatStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Store for project context (RAG)
            if (!database.objectStoreNames.contains('projectContext')) {
                const contextStore = database.createObjectStore('projectContext', { keyPath: 'path' });
                contextStore.createIndex('type', 'type', { unique: false });
            }

            // Store for embeddings
            if (!database.objectStoreNames.contains('embeddings')) {
                const embStore = database.createObjectStore('embeddings', { keyPath: 'id' });
                embStore.createIndex('source', 'source', { unique: false });
            }
        };
    });
}

async function dbSave(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbGetAll(storeName, indexName = null, query = null) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const target = indexName ? store.index(indexName) : store;
        const request = query ? target.getAll(query) : target.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ===============================
// Chat History with IndexedDB
// ===============================
async function saveChatMessage(message) {
    if (!db) await initDB();
    const chatMessage = {
        ...message,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
    };
    await dbSave('chatHistory', chatMessage);
    return chatMessage;
}

async function getChatHistory(agent = null, limit = 50) {
    if (!db) await initDB();
    let messages = await dbGetAll('chatHistory');
    if (agent) {
        messages = messages.filter(m => m.agent === agent || m.type === 'user');
    }
    return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-limit);
}

async function clearChatHistory(agent = null) {
    if (!db) await initDB();
    if (agent) {
        const messages = await dbGetAll('chatHistory');
        const toDelete = messages.filter(m => m.agent === agent);
        for (const msg of toDelete) {
            await dbDelete('chatHistory', msg.id);
        }
    } else {
        await dbClear('chatHistory');
    }
}

// ===============================
// State Management with IndexedDB
// ===============================
async function saveStateDB() {
    if (!db) await initDB();
    await dbSave('state', { id: 'appState', ...state });
    // Also save to localStorage as backup
    localStorage.setItem('agentHubState', JSON.stringify(state));
}

async function loadStateDB() {
    try {
        await initDB();
        const saved = await dbGet('state', 'appState');
        if (saved) {
            delete saved.id;
            Object.assign(state, saved);
            return true;
        }
    } catch (e) {
        console.warn('IndexedDB failed, falling back to localStorage', e);
    }

    // Fallback to localStorage
    const localSaved = localStorage.getItem('agentHubState');
    if (localSaved) {
        Object.assign(state, JSON.parse(localSaved));
    }
    return false;
}

// ===============================
// Streaming API for Chat
// ===============================
async function streamOllamaResponse(model, messages, onChunk, onComplete) {
    const endpoint = state.settings.integrations.ollama?.endpoint || 'http://localhost:11434';

    const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: true
        })
    });

    if (!response.ok) throw new Error('Ollama no responde');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
            try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                    fullContent += json.message.content;
                    onChunk(json.message.content, fullContent);
                }
                if (json.done) {
                    onComplete(fullContent);
                    return fullContent;
                }
            } catch (e) { }
        }
    }

    onComplete(fullContent);
    return fullContent;
}

async function streamLMStudioResponse(model, messages, onChunk, onComplete) {
    const endpoint = state.settings.integrations.lmstudio?.endpoint || 'http://localhost:1234';

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: true,
            temperature: state.settings[chatState.currentAgent]?.temperature || 0.7
        })
    });

    if (!response.ok) throw new Error('LM Studio no responde');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim() && l.startsWith('data: '));

        for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') {
                onComplete(fullContent);
                return fullContent;
            }
            try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                    fullContent += content;
                    onChunk(content, fullContent);
                }
            } catch (e) { }
        }
    }

    onComplete(fullContent);
    return fullContent;
}

// ===============================
// Code Syntax Highlighting
// ===============================
function highlightCode(code, language = '') {
    const keywords = {
        javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined'],
        python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'raise', 'with', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'lambda', 'self'],
        css: ['@media', '@keyframes', '@import', '!important'],
        html: ['DOCTYPE', 'html', 'head', 'body', 'div', 'span', 'script', 'style', 'link', 'meta']
    };

    let highlighted = escapeHtml(code);

    // Highlight strings
    highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g, '<span class="hljs-string">$&</span>');

    // Highlight comments
    highlighted = highlighted.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm, '<span class="hljs-comment">$&</span>');

    // Highlight numbers
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="hljs-number">$1</span>');

    // Highlight keywords
    const lang = language.toLowerCase();
    const langKeywords = keywords[lang] || keywords.javascript;
    langKeywords.forEach(kw => {
        const regex = new RegExp(`\\b(${kw})\\b`, 'g');
        highlighted = highlighted.replace(regex, '<span class="hljs-keyword">$1</span>');
    });

    return highlighted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===============================
// Enhanced Markdown Parser
// ===============================
function parseMarkdown(text) {
    let html = text;

    // Code blocks with syntax highlighting
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const highlighted = highlightCode(code.trim(), lang || '');
        return `<pre class="code-block" data-language="${lang || 'code'}"><div class="code-header"><span class="code-lang">${lang || 'code'}</span><button class="copy-btn" onclick="copyCode(this)">📋 Copiar</button></div><code>${highlighted}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Numbered lists
    html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Blockquotes
    html = html.replace(/^>\s*(.*)$/gm, '<blockquote>$1</blockquote>');

    // Tables
    html = html.replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.every(c => /^[-:]+$/.test(c.trim()))) return '';
        const cellHtml = cells.map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cellHtml}</tr>`;
    });
    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="md-table">$&</table>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

function copyCode(btn) {
    const codeBlock = btn.closest('.code-block');
    const code = codeBlock.querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '✅ Copiado!';
        setTimeout(() => btn.textContent = originalText, 2000);
    });
}

window.copyCode = copyCode;

// ===============================
// Auto-backup System
// ===============================
let backupInterval = null;

function startAutoBackup() {
    if (backupInterval) clearInterval(backupInterval);

    backupInterval = setInterval(async () => {
        await saveStateDB();
        console.log('[AutoBackup] Estado guardado:', new Date().toLocaleTimeString());
    }, 5 * 60 * 1000); // Every 5 minutes
}

function exportData() {
    const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        state: state,
        chatHistory: [] // Will be populated async
    };

    getChatHistory().then(history => {
        data.chatHistory = history;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agenthub-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup exportado correctamente', 'success');
    });
}

async function importData(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.state) {
            Object.assign(state, data.state);
            await saveStateDB();
        }

        if (data.chatHistory && data.chatHistory.length > 0) {
            for (const msg of data.chatHistory) {
                await saveChatMessage(msg);
            }
        }

        render();
        showToast('Datos importados correctamente', 'success');
    } catch (e) {
        showToast('Error al importar: ' + e.message, 'error');
    }
}

window.exportData = exportData;
window.importData = importData;

// ===============================
// Service Worker Registration
// ===============================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('[SW] Registered:', reg.scope);
        }).catch(err => {
            console.warn('[SW] Registration failed:', err);
        });
    });
}

// ===============================
// Keyboard Shortcuts
// ===============================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K: Focus chat input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            document.querySelector('[data-section="chat"]')?.click();
            setTimeout(() => chatInput.focus(), 100);
        }
    }

    // Ctrl/Cmd + N: New task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openNewTaskModal();
    }

    // Ctrl/Cmd + S: Save/Export
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveStateDB();
        showToast('Estado guardado', 'success');
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
});
