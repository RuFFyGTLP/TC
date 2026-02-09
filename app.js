// ===============================
// State Management
// ===============================
const state = {
    tasks: [],
    handoffs: [],
    activities: [],
    agents: {
        orquestador: { status: 'offline', currentTask: null },
        implementador: { status: 'offline', currentTask: null }
    },
    counters: { taskId: 0, handoffId: 0 },
    settings: {
        orquestador: { enabled: true, name: 'Orquestador Principal', provider: 'ollama', model: 'llama3.2', spec: 'architect', endpoint: '', temperature: 0.7 },
        implementador: { enabled: true, name: 'Implementador Dev', provider: 'ollama', model: 'llama3.2', spec: 'fullstack', endpoint: '', temperature: 0.3 },
        system: { projectName: 'Multi-Agent Hub', workDir: 'e:/Proyectos/TC', syncInterval: 10, notifications: true, darkTheme: true },
        advanced: { parallelLimit: 3, logLevel: 'info', logRetention: 30, handoffTimeout: 15 },
        integrations: {
            openai: '', anthropic: '', google: '', mistral: '', groq: '', github: '',
            ollama: { endpoint: 'http://localhost:11434', defaultModel: 'llama3.2' },
            lmstudio: { endpoint: 'http://localhost:1234', defaultModel: '' }
        }
    }
};

// ===============================
// Initialize App
// ===============================
document.addEventListener('DOMContentLoaded', async () => {
    // Load environment variables first
    if (typeof loadEnv === 'function') {
        await loadEnv();
    }

    loadState();
    setupNavigation();
    setupTaskForm();
    setupHandoffForm();
    setupFilters();
    loadSettingsUI();
    initializeTheme();
    render();

    document.getElementById('newTaskBtn').addEventListener('click', openNewTaskModal);
    document.getElementById('refreshActivity').addEventListener('click', () => {
        showToast('Actividad actualizada', 'info');
        render();
    });
});

// Theme Management
function initializeTheme() {
    const darkTheme = state.settings.system?.darkTheme !== false;
    document.documentElement.setAttribute('data-theme', darkTheme ? 'dark' : 'light');
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    state.settings.system.darkTheme = newTheme === 'dark';
    saveState();
    showToast(`Tema ${newTheme === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
}

window.toggleTheme = toggleTheme;

// ===============================
// Local Storage
// ===============================
function loadState() {
    const saved = localStorage.getItem('agentHubState');
    if (saved) {
        const parsed = JSON.parse(saved);

        // Config migration: Remove antigravity (deprecated)
        if (parsed.settings?.orquestador?.provider === 'antigravity') {
            parsed.settings.orquestador.provider = 'ollama';
            parsed.settings.orquestador.model = ''; // Let detection fill it
        }
        if (parsed.settings?.implementador?.provider === 'antigravity') {
            parsed.settings.implementador.provider = 'ollama';
            parsed.settings.implementador.model = '';
        }

        Object.assign(state, parsed);
    }
    // Try loading from IndexedDB if available (async)
    if (typeof loadStateDB === 'function') {
        loadStateDB().then(dbState => {
            if (dbState) {
                // Same migration for DB state
                if (dbState.settings?.orquestador?.provider === 'antigravity') {
                    dbState.settings.orquestador.provider = 'ollama';
                    dbState.settings.orquestador.model = '';
                }
                if (dbState.settings?.implementador?.provider === 'antigravity') {
                    dbState.settings.implementador.provider = 'ollama';
                    dbState.settings.implementador.model = '';
                }
                Object.assign(state, dbState);
                console.log('Estado cargado desde IndexedDB');
                updateUI();
                if (typeof updateChatContextDisplay === 'function') updateChatContextDisplay();
            }
        });
    }

    // Add initial activity if empty
    if (state.activities.length === 0) {
        state.activities.push({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            agent: 'SISTEMA',
            action: 'INIT',
            message: 'Sistema de cooperación multi-agente inicializado'
        });
        saveState();
    }
}

function saveState() {
    localStorage.setItem('agentHubState', JSON.stringify(state));
}

// ===============================
// Navigation
// ===============================
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.dataset.section;

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');

            const titles = { dashboard: 'Dashboard', tasks: 'Gestión de Tareas', handoffs: 'Historial de Handoffs', activity: 'Log de Actividad', chat: 'Chat IA', settings: 'Configuración' };
            document.querySelector('.page-title').textContent = titles[sectionId] || sectionId;
        });
    });
}

// ===============================
// Task Management
// ===============================
function setupTaskForm() {
    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const task = {
            id: `TASK-${String(++state.counters.taskId).padStart(3, '0')}`,
            title: document.getElementById('taskTitle').value,
            priority: document.getElementById('taskPriority').value,
            assignedTo: document.getElementById('taskAssigned').value,
            context: document.getElementById('taskContext').value,
            criteria: document.getElementById('taskCriteria').value,
            status: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: 'orquestador'
        };

        state.tasks.push(task);
        addActivity('ORQUESTADOR', 'TASK_CREATE', `Creada tarea ${task.id}: "${task.title}"`);
        saveState();
        closeModal();
        render();
        showToast(`Tarea ${task.id} creada exitosamente`, 'success');

        e.target.reset();
    });
}

function updateTaskStatus(taskId, newStatus) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        const oldStatus = task.status;
        task.status = newStatus;
        addActivity(task.assignedTo.toUpperCase(), 'TASK_UPDATE',
            `Tarea ${taskId} cambiada de ${oldStatus} a ${newStatus}`);
        saveState();
        render();
    }
}

function deleteTask(taskId) {
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index > -1) {
        state.tasks.splice(index, 1);
        addActivity('SISTEMA', 'TASK_DELETE', `Eliminada tarea ${taskId}`);
        saveState();
        render();
        showToast('Tarea eliminada', 'info');
    }
}

// ===============================
// Handoff Management
// ===============================
function setupHandoffForm() {
    document.getElementById('handoffForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const handoff = {
            id: `HO-${String(++state.counters.handoffId).padStart(3, '0')}`,
            taskRef: document.getElementById('handoffTaskId').value,
            from: document.getElementById('handoffFrom').value,
            to: document.getElementById('handoffTo').value,
            summary: document.getElementById('handoffSummary').value,
            context: document.getElementById('handoffContext').value,
            constraints: document.getElementById('handoffConstraints').value,
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        state.handoffs.push(handoff);
        addActivity(handoff.from.toUpperCase(), 'HANDOFF_CREATE',
            `Handoff ${handoff.id} creado para tarea ${handoff.taskRef}`);
        saveState();
        closeHandoffModal();
        render();
        showToast(`Handoff ${handoff.id} creado`, 'success');

        e.target.reset();
    });
}

function openHandoffModal(taskId) {
    document.getElementById('handoffTaskId').value = taskId;
    document.getElementById('handoffModal').classList.add('active');
}

function closeHandoffModal() {
    document.getElementById('handoffModal').classList.remove('active');
}

function updateHandoffStatus(handoffId, newStatus) {
    const handoff = state.handoffs.find(h => h.id === handoffId);
    if (handoff) {
        handoff.status = newStatus;
        addActivity(handoff.to.toUpperCase(), 'HANDOFF_UPDATE',
            `Handoff ${handoffId} marcado como ${newStatus}`);
        saveState();
        render();
    }
}

// ===============================
// Activity Management
// ===============================
function addActivity(agent, action, message) {
    state.activities.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        agent,
        action,
        message
    });

    if (state.activities.length > 100) {
        state.activities = state.activities.slice(0, 100);
    }
}

// ===============================
// Filters
// ===============================
function setupFilters() {
    document.getElementById('taskFilter').addEventListener('change', (e) => {
        renderTaskList(e.target.value);
    });
}

// ===============================
// Rendering
// ===============================
function render() {
    renderStats();
    renderKanban();
    renderTaskList('all');
    renderHandoffs();
    renderActivityLog();
    renderActivityFeed();
}

function renderStats() {
    const pending = state.tasks.filter(t => t.status === 'pending').length;
    const progress = state.tasks.filter(t => t.status === 'in_progress').length;
    const completed = state.tasks.filter(t => t.status === 'completed').length;

    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('progressCount').textContent = progress;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('handoffCount').textContent = state.handoffs.length;

    document.querySelector('#pendingColumn .column-count').textContent = pending;
    document.querySelector('#progressColumn .column-count').textContent = progress;
    document.querySelector('#completedColumn .column-count').textContent = completed;
}

function renderKanban() {
    const columns = { pending: 'pendingColumn', in_progress: 'progressColumn', completed: 'completedColumn' };

    Object.entries(columns).forEach(([status, colId]) => {
        const content = document.querySelector(`#${colId} .column-content`);
        const tasks = state.tasks.filter(t => t.status === status);

        if (tasks.length === 0) {
            content.innerHTML = '<div class="empty-column"><p style="color: var(--text-muted); font-size: 0.8rem; padding: 20px; text-align: center;">Sin tareas</p></div>';
        } else {
            content.innerHTML = tasks.map(task => `
                <div class="task-card" draggable="true" data-task-id="${task.id}" onclick="showTaskDetails('${task.id}')">
                    <div class="task-card-title">${task.title}</div>
                    <div class="task-card-meta">
                        <span class="task-priority ${task.priority}">${task.priority}</span>
                        <span class="task-agent">${task.assignedTo}</span>
                    </div>
                </div>
            `).join('');
        }

        // Enable drop zone
        content.addEventListener('dragover', handleDragOver);
        content.addEventListener('drop', (e) => handleDrop(e, status));
        content.addEventListener('dragleave', handleDragLeave);
    });

    // Add drag events to all task cards
    document.querySelectorAll('.task-card[draggable="true"]').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
}

// Drag & Drop handlers
let draggedTaskId = null;

function handleDragStart(e) {
    draggedTaskId = e.target.dataset.taskId;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTaskId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.column-content').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, newStatus) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const task = state.tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
        const oldStatus = task.status;
        task.status = newStatus;
        saveState();
        render();
        addActivity(task.assignedTo.toUpperCase(), 'TASK_MOVED', `Tarea "${task.title}" movida de ${oldStatus} a ${newStatus}`);
        showToast(`Tarea movida a ${newStatus.replace('_', ' ')}`, 'success');
    }

    draggedTaskId = null;
}


function renderTaskList(filter) {
    const container = document.getElementById('taskList');
    let tasks = state.tasks;

    if (filter !== 'all') {
        tasks = tasks.filter(t => t.status === filter);
    }

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
                <p>No hay tareas${filter !== 'all' ? ' con este filtro' : ''}</p>
                <button class="btn btn-secondary" onclick="openNewTaskModal()">Crear tarea</button>
            </div>
        `;
        return;
    }

    container.innerHTML = tasks.map(task => `
        <div class="task-list-item">
            <div class="task-info">
                <div class="task-title">${task.id}: ${task.title}</div>
                <div class="task-meta-info">
                    <span class="task-priority ${task.priority}">${task.priority}</span>
                    <span>Asignado: ${task.assignedTo}</span>
                    <span>Estado: ${task.status}</span>
                </div>
            </div>
            <div class="task-actions">
                ${task.status === 'pending' ? `<button class="btn btn-sm btn-secondary" onclick="updateTaskStatus('${task.id}', 'in_progress')">Iniciar</button>` : ''}
                ${task.status === 'in_progress' ? `<button class="btn btn-sm btn-primary" onclick="updateTaskStatus('${task.id}', 'completed')">Completar</button>` : ''}
                <button class="btn btn-sm btn-ghost" onclick="openHandoffModal('${task.id}')">Handoff</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteTask('${task.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderHandoffs() {
    const container = document.getElementById('handoffList');

    if (state.handoffs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/>
                    <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                </svg>
                <p>No hay handoffs registrados</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.handoffs.map(h => `
        <div class="handoff-item">
            <div class="handoff-header">
                <div class="handoff-agents">
                    <span class="handoff-agent ${h.from}">${h.from}</span>
                    <span class="handoff-arrow">→</span>
                    <span class="handoff-agent ${h.to}">${h.to}</span>
                </div>
                <span class="handoff-status ${h.status}">${h.status}</span>
            </div>
            <div class="handoff-summary">${h.summary}</div>
            <div class="handoff-time">${h.id} • Tarea: ${h.taskRef} • ${formatTime(h.timestamp)}</div>
            ${h.status === 'pending' ? `<button class="btn btn-sm btn-secondary" style="margin-top:12px" onclick="updateHandoffStatus('${h.id}', 'acknowledged')">Acknowledge</button>` : ''}
            ${h.status === 'acknowledged' ? `<button class="btn btn-sm btn-primary" style="margin-top:12px" onclick="updateHandoffStatus('${h.id}', 'completed')">Completar</button>` : ''}
        </div>
    `).join('');
}

function renderActivityLog() {
    const container = document.getElementById('activityLog');

    if (state.activities.length === 0) {
        container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg><p>Sin actividad</p></div>`;
        return;
    }

    container.innerHTML = state.activities.slice(0, 50).map(a => `
        <div class="log-entry">
            <span class="log-time">${formatTime(a.timestamp)}</span>
            <span class="log-agent ${a.agent.toLowerCase()}">${a.agent}</span>
            <span class="log-action">[${a.action}]</span>
            <span class="log-message">${a.message}</span>
        </div>
    `).join('');
}

function renderActivityFeed() {
    const container = document.getElementById('activityFeed');
    const recent = state.activities.slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg><p>Sin actividad</p></div>`;
        return;
    }

    container.innerHTML = recent.map(a => `
        <div class="feed-item">
            <div class="feed-icon ${a.action.includes('HANDOFF') ? 'handoff' : 'task'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${a.action.includes('HANDOFF') ? '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/>' : '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'}
                </svg>
            </div>
            <div class="feed-content-text">
                <div class="feed-title">${a.message}</div>
                <div class="feed-time">${a.agent} • ${formatTime(a.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// ===============================
// Modals
// ===============================
function openNewTaskModal() {
    document.getElementById('taskModal').classList.add('active');
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
}

function showTaskDetails(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        showToast(`Tarea: ${task.title}`, 'info');
    }
}

// ===============================
// Toast Notifications
// ===============================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>',
        error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
    };

    toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[type]}</svg>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===============================
// Utilities
// ===============================
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Expose functions globally
window.openNewTaskModal = openNewTaskModal;
window.closeModal = closeModal;
window.openHandoffModal = openHandoffModal;
window.closeHandoffModal = closeHandoffModal;
window.updateTaskStatus = updateTaskStatus;
window.deleteTask = deleteTask;
window.updateHandoffStatus = updateHandoffStatus;
window.showTaskDetails = showTaskDetails;

// ===============================
// Settings Management
// ===============================
function loadSettingsUI() {
    const s = state.settings;

    // Agent settings
    const orqEnabled = document.getElementById('orquestadorEnabled');
    const impEnabled = document.getElementById('implementadorEnabled');

    if (orqEnabled) orqEnabled.checked = s.orquestador.enabled;
    if (impEnabled) impEnabled.checked = s.implementador.enabled;

    setInputValue('orquestadorName', s.orquestador.name);
    setInputValue('orquestadorModel', s.orquestador.model);
    setInputValue('orquestadorSpec', s.orquestador.spec);
    setInputValue('implementadorName', s.implementador.name);
    setInputValue('implementadorModel', s.implementador.model);
    setInputValue('implementadorSpec', s.implementador.spec);

    // System settings
    setInputValue('projectName', s.system.projectName);
    setInputValue('workDir', s.system.workDir);
    setInputValue('syncInterval', s.system.syncInterval);

    const notifEnabled = document.getElementById('notificationsEnabled');
    const darkTheme = document.getElementById('darkTheme');
    if (notifEnabled) notifEnabled.checked = s.system.notifications;
    if (darkTheme) darkTheme.checked = s.system.darkTheme;

    // Advanced settings
    setInputValue('parallelLimit', s.advanced.parallelLimit);
    setInputValue('logLevel', s.advanced.logLevel);
    setInputValue('logRetention', s.advanced.logRetention);
    setInputValue('handoffTimeout', s.advanced.handoffTimeout);

    // Integrations
    setInputValue('openaiKey', s.integrations.openai);
    setInputValue('anthropicKey', s.integrations.anthropic);
    setInputValue('githubToken', s.integrations.github);
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function saveSettings() {
    const s = state.settings;

    // Agent settings
    const orqEnabled = document.getElementById('orquestadorEnabled');
    const impEnabled = document.getElementById('implementadorEnabled');

    s.orquestador.enabled = orqEnabled ? orqEnabled.checked : true;
    s.implementador.enabled = impEnabled ? impEnabled.checked : true;
    s.orquestador.name = getInputValue('orquestadorName');
    s.orquestador.model = getInputValue('orquestadorModel');
    s.orquestador.spec = getInputValue('orquestadorSpec');
    s.implementador.name = getInputValue('implementadorName');
    s.implementador.model = getInputValue('implementadorModel');
    s.implementador.spec = getInputValue('implementadorSpec');

    // System settings
    s.system.projectName = getInputValue('projectName');
    s.system.workDir = getInputValue('workDir');
    s.system.syncInterval = parseInt(getInputValue('syncInterval')) || 10;

    const notifEnabled = document.getElementById('notificationsEnabled');
    const darkTheme = document.getElementById('darkTheme');
    s.system.notifications = notifEnabled ? notifEnabled.checked : true;
    s.system.darkTheme = darkTheme ? darkTheme.checked : true;

    // Advanced settings
    s.advanced.parallelLimit = parseInt(getInputValue('parallelLimit')) || 3;
    s.advanced.logLevel = getInputValue('logLevel');
    s.advanced.logRetention = parseInt(getInputValue('logRetention')) || 30;
    s.advanced.handoffTimeout = parseInt(getInputValue('handoffTimeout')) || 15;

    // Integrations
    s.integrations.openai = getInputValue('openaiKey');
    s.integrations.anthropic = getInputValue('anthropicKey');
    s.integrations.github = getInputValue('githubToken');

    saveState();
    addActivity('SISTEMA', 'SETTINGS_UPDATE', 'Configuración actualizada');
    showToast('Configuración guardada exitosamente', 'success');
}

function resetSettings() {
    state.settings = {
        orquestador: { enabled: true, name: 'Orquestador Principal', model: 'antigravity', spec: 'architect' },
        implementador: { enabled: true, name: 'Implementador Dev', model: 'antigravity', spec: 'fullstack' },
        system: { projectName: 'Multi-Agent Hub', workDir: 'e:/Proyectos/TC', syncInterval: 10, notifications: true, darkTheme: true },
        advanced: { parallelLimit: 3, logLevel: 'info', logRetention: 30, handoffTimeout: 15 },
        integrations: { openai: '', anthropic: '', github: '' }
    };
    loadSettingsUI();
    saveState();
    showToast('Configuración restablecida', 'info');
}

function exportSettings() {
    const data = {
        settings: state.settings,
        tasks: state.tasks,
        handoffs: state.handoffs,
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenthub-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Configuración exportada', 'success');
}

// ===============================
// AI Models Catalog
// ===============================
const modelsCatalog = {
    openai: [
        { value: 'gpt-4o', label: 'GPT-4o (Más reciente)' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'o1-preview', label: 'o1-preview (Reasoning)' },
        { value: 'o1-mini', label: 'o1-mini' }
    ],
    anthropic: [
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Último)' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
    ],
    google: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-pro', label: 'Gemini Pro' }
    ],
    mistral: [
        { value: 'mistral-large-latest', label: 'Mistral Large' },
        { value: 'mistral-medium-latest', label: 'Mistral Medium' },
        { value: 'mistral-small-latest', label: 'Mistral Small' },
        { value: 'codestral-latest', label: 'Codestral (Coding)' },
        { value: 'open-mixtral-8x22b', label: 'Mixtral 8x22B' },
        { value: 'open-mixtral-8x7b', label: 'Mixtral 8x7B' }
    ],
    cohere: [
        { value: 'command-r-plus', label: 'Command R+' },
        { value: 'command-r', label: 'Command R' },
        { value: 'command', label: 'Command' }
    ],
    groq: [
        { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
        { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' },
        { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Ultra Fast)' },
        { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
        { value: 'gemma2-9b-it', label: 'Gemma 2 9B' }
    ],
    ollama: [
        { value: 'llama3.2', label: 'Llama 3.2' },
        { value: 'llama3.1', label: 'Llama 3.1' },
        { value: 'llama3', label: 'Llama 3' },
        { value: 'codellama', label: 'Code Llama' },
        { value: 'mistral', label: 'Mistral' },
        { value: 'mixtral', label: 'Mixtral' },
        { value: 'qwen2.5', label: 'Qwen 2.5' },
        { value: 'qwen2.5-coder', label: 'Qwen 2.5 Coder' },
        { value: 'deepseek-coder-v2', label: 'DeepSeek Coder V2' },
        { value: 'phi3', label: 'Phi-3' },
        { value: 'gemma2', label: 'Gemma 2' },
        { value: 'starcoder2', label: 'StarCoder 2' }
    ],
    lmstudio: [
        { value: 'local-model', label: 'Modelo Local Cargado' },
        { value: 'llama-3.2-3b', label: 'Llama 3.2 3B' },
        { value: 'qwen2.5-coder-7b', label: 'Qwen 2.5 Coder 7B' },
        { value: 'deepseek-coder-6.7b', label: 'DeepSeek Coder 6.7B' },
        { value: 'codellama-7b', label: 'Code Llama 7B' },
        { value: 'mistral-7b', label: 'Mistral 7B' }
    ],
    llamacpp: [
        { value: 'local', label: 'Modelo Local' }
    ],
    huggingface: [
        { value: 'meta-llama/Llama-3.2-3B-Instruct', label: 'Llama 3.2 3B' },
        { value: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen 2.5 Coder 32B' },
        { value: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B Instruct' },
        { value: 'bigcode/starcoder2-15b', label: 'StarCoder2 15B' }
    ],
    antigravity: [
        { value: 'antigravity-1', label: 'Antigravity (Default)' }
    ],
    cursor: [
        { value: 'cursor-small', label: 'Cursor Small' },
        { value: 'cursor-fast', label: 'Cursor Fast' }
    ],
    codeium: [
        { value: 'codeium-default', label: 'Codeium Default' }
    ],
    // Local providers will be populated dynamically
    ollama: [],
    lmstudio: [],
    antigravity: [
        { value: 'antigravity-1', label: 'Antigravity v1 (Experimental)' }
    ]
};

// Update local provider catalogs from detection module
function updateLocalCatalogs() {
    if (typeof getAllLocalModels === 'function') {
        const local = getAllLocalModels();

        if (local.ollama?.connected) {
            modelsCatalog.ollama = local.ollama.models.map(m => ({
                value: m.name,
                label: `${m.name} (${m.size || 'Unknown'})`
            }));
        }

        if (local.lmstudio?.connected) {
            modelsCatalog.lmstudio = local.lmstudio.models.map(m => ({
                value: m.id,
                label: m.name || m.id
            }));
        }
    }
}

async function updateModelList(agent) {
    const providerSelect = document.getElementById(`${agent}Provider`);
    const modelSelect = document.getElementById(`${agent}Model`);
    const endpointInput = document.getElementById(`${agent}Endpoint`);

    if (!providerSelect || !modelSelect) return;

    // Refresh local catalogs first
    updateLocalCatalogs();

    const provider = providerSelect.value;
    let models = modelsCatalog[provider] || [];

    // If local provider has no models, try to detect again
    if ((provider === 'ollama' || provider === 'lmstudio') && models.length === 0) {
        if (typeof detectAllLocalModels === 'function') {
            await detectAllLocalModels();
            updateLocalCatalogs();
            models = modelsCatalog[provider] || [];
        }
    }

    // Clear and populate model select
    const currentModel = modelSelect.value || state.settings[agent]?.model;
    modelSelect.innerHTML = '';

    if (models.length > 0) {
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            if (model.value === currentModel) option.selected = true;
            modelSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.textContent = provider === 'antigravity'
            ? 'No disponible localmente'
            : 'No se detectaron modelos (Revisa conexión)';
        modelSelect.appendChild(option);
    }

    // Show/hide endpoint based on provider
    if (endpointInput && endpointInput.parentElement) {
        const localProviders = ['ollama', 'lmstudio', 'llamacpp'];
        const isLocal = localProviders.includes(provider);
        endpointInput.parentElement.style.display = isLocal ? 'block' : 'none';

        if (isLocal && !endpointInput.value) {
            const defaultEndpoints = {
                ollama: 'http://localhost:11434',
                lmstudio: 'http://localhost:1234',
                llamacpp: 'http://localhost:8080'
            };
            endpointInput.value = defaultEndpoints[provider] || '';
        }
    }
}

// Initialize model lists on load
function initializeModelLists() {
    updateModelList('orquestador');
    updateModelList('implementador');

    // Set saved values if not already set by loadSettingsUI
    const s = state.settings;
    setInputValue('orquestadorProvider', s.orquestador.provider);
    setInputValue('implementadorProvider', s.implementador.provider);

    // Now set the saved models (needs delay for async population)
    setTimeout(() => {
        if (s.orquestador.model) setInputValue('orquestadorModel', s.orquestador.model);
        if (s.implementador.model) setInputValue('implementadorModel', s.implementador.model);
    }, 500);
}

// Ensure settings are loaded correctly on init
document.addEventListener('DOMContentLoaded', () => {
    // Listen for model detection events
    window.addEventListener('modelsDetected', () => {
        updateLocalCatalogs();
        // Refresh dropdowns if settings panel is open
        if (document.querySelector('.settings-modal.active')) {
            updateModelList('orquestador');
            updateModelList('implementador');
        }
    });

    // Initial detection
    setTimeout(initializeModelLists, 100);
});


// ===============================
// Connection Tests
// ===============================
async function testOllamaConnection() {
    const endpoint = document.getElementById('ollamaEndpoint')?.value || 'http://localhost:11434';
    const statusEl = document.getElementById('ollamaStatus');
    const modelSelect = document.getElementById('ollamaDefaultModel');

    try {
        statusEl.textContent = 'Conectando...';
        statusEl.className = 'integration-status';

        const response = await fetch(`${endpoint}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            const models = data.models || [];

            statusEl.textContent = `Conectado (${models.length} modelos)`;
            statusEl.className = 'integration-status connected';

            // Populate model select
            modelSelect.innerHTML = '<option value="">Seleccionar modelo</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = `${model.name} (${formatBytes(model.size)})`;
                modelSelect.appendChild(option);
            });

            // Update ollama models in catalog
            modelsCatalog.ollama = models.map(m => ({ value: m.name, label: m.name }));

            showToast(`Ollama conectado: ${models.length} modelos disponibles`, 'success');
            addActivity('SISTEMA', 'CONNECTION_TEST', `Ollama conectado en ${endpoint}`);
        } else {
            throw new Error('No responde');
        }
    } catch (error) {
        statusEl.textContent = 'Desconectado';
        statusEl.className = 'integration-status';
        showToast('No se pudo conectar a Ollama. ¿Está ejecutándose?', 'error');
    }
}

async function testLMStudioConnection() {
    const endpoint = document.getElementById('lmstudioEndpoint')?.value || 'http://localhost:1234';
    const statusEl = document.getElementById('lmstudioStatus');
    const modelSelect = document.getElementById('lmstudioDefaultModel');

    try {
        statusEl.textContent = 'Conectando...';
        statusEl.className = 'integration-status';

        const response = await fetch(`${endpoint}/v1/models`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            const models = data.data || [];

            statusEl.textContent = `Conectado (${models.length} modelos)`;
            statusEl.className = 'integration-status connected';

            // Populate model select
            modelSelect.innerHTML = '<option value="">Seleccionar modelo</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                modelSelect.appendChild(option);
            });

            // Update lmstudio models in catalog
            modelsCatalog.lmstudio = models.map(m => ({ value: m.id, label: m.id }));

            showToast(`LM Studio conectado: ${models.length} modelos disponibles`, 'success');
            addActivity('SISTEMA', 'CONNECTION_TEST', `LM Studio conectado en ${endpoint}`);
        } else {
            throw new Error('No responde');
        }
    } catch (error) {
        statusEl.textContent = 'Desconectado';
        statusEl.className = 'integration-status';
        showToast('No se pudo conectar a LM Studio. ¿Está ejecutándose con servidor activo?', 'error');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Override loadSettingsUI to include new fields
const originalLoadSettingsUI = loadSettingsUI;
function loadSettingsUIExtended() {
    originalLoadSettingsUI();
    initializeModelLists();

    // Load integration endpoints
    const integ = state.settings.integrations;
    setInputValue('ollamaEndpoint', integ.ollama?.endpoint || 'http://localhost:11434');
    setInputValue('lmstudioEndpoint', integ.lmstudio?.endpoint || 'http://localhost:1234');
    setInputValue('googleKey', integ.google || '');
    setInputValue('mistralKey', integ.mistral || '');
    setInputValue('groqKey', integ.groq || '');
}

// Override saveSettings to include new fields
const originalSaveSettings = saveSettings;
function saveSettingsExtended() {
    const s = state.settings;

    // Agent settings with provider
    s.orquestador.provider = getInputValue('orquestadorProvider');
    s.orquestador.model = getInputValue('orquestadorModel');
    s.orquestador.endpoint = getInputValue('orquestadorEndpoint');
    s.orquestador.temperature = parseFloat(getInputValue('orquestadorTemp')) || 0.7;

    s.implementador.provider = getInputValue('implementadorProvider');
    s.implementador.model = getInputValue('implementadorModel');
    s.implementador.endpoint = getInputValue('implementadorEndpoint');
    s.implementador.temperature = parseFloat(getInputValue('implementadorTemp')) || 0.3;

    // New integrations
    s.integrations.google = getInputValue('googleKey');
    s.integrations.mistral = getInputValue('mistralKey');
    s.integrations.groq = getInputValue('groqKey');
    s.integrations.ollama = {
        endpoint: getInputValue('ollamaEndpoint'),
        defaultModel: getInputValue('ollamaDefaultModel')
    };
    s.integrations.lmstudio = {
        endpoint: getInputValue('lmstudioEndpoint'),
        defaultModel: getInputValue('lmstudioDefaultModel')
    };

    originalSaveSettings();
}

// Replace functions
loadSettingsUI = loadSettingsUIExtended;
saveSettings = saveSettingsExtended;

window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.exportSettings = exportSettings;
window.updateModelList = updateModelList;
window.testOllamaConnection = testOllamaConnection;
window.testLMStudioConnection = testLMStudioConnection;

// ===============================
// Chat System
// ===============================
const chatState = {
    currentAgent: 'orquestador',
    messages: [],
    isGenerating: false
};

// System prompts for agents
const agentPrompts = {
    orquestador: `Eres el Agente Orquestador, un arquitecto de software experto especializado en:
- Planificación y diseño de arquitecturas
- Revisión de código y mejores prácticas
- Coordinación de tareas entre agentes
- Análisis de requisitos y documentación

Responde de forma clara y estructurada. Usa markdown para formatear tu respuesta.
Cuando te pidan código, delega al Implementador. Tu rol es planificar y revisar.`,

    implementador: `Eres el Agente Implementador, un desarrollador full-stack experto especializado en:
- Escritura de código limpio y eficiente
- Implementación de features y bugfixes
- Testing y debugging
- Documentación técnica

Responde con código cuando sea apropiado. Usa bloques de código markdown.
Sé conciso y práctico. Muestra ejemplos de código cuando sea útil.`
};

async function selectChatAgent(agent) {
    chatState.currentAgent = agent;

    // Update active button state
    document.querySelectorAll('.agent-btn').forEach(btn => {
        const isActive = btn.dataset.agent === agent;
        btn.classList.toggle('active', isActive);

        // Also update visual indication in button
        if (isActive) {
            const status = state.agents[agent]?.status || 'offline';
            btn.querySelector('svg').style.color = status === 'online' ? 'var(--success)' : 'currentColor';
        }
    });

    // Update context display
    await updateChatContextDisplay();
}

async function updateChatContextDisplay() {
    const agent = chatState.currentAgent;
    const settings = state.settings[agent];

    const providerEl = document.getElementById('chatProvider');
    const modelEl = document.getElementById('chatModel');
    const statusEl = document.getElementById('chatStatus');

    if (providerEl) providerEl.textContent = settings.provider || 'No configurado';
    if (modelEl) modelEl.textContent = settings.model || 'No seleccionado';

    // Check connection
    if (statusEl) {
        statusEl.innerHTML = '<span class="status-dot warning"></span> Verificando...';
        statusEl.className = 'context-value status-indicator warning';

        const isConnected = await checkProviderConnection(settings.provider);

        statusEl.innerHTML = `<span class="status-dot"></span> ${isConnected ? 'Conectado' : 'Desconectado'}`;
        statusEl.className = `context-value status-indicator ${isConnected ? 'connected' : 'disconnected'}`;

        // Update agent status in state
        if (state.agents[agent]) {
            state.agents[agent].status = isConnected ? 'online' : 'offline';
        }
    }
}

async function checkProviderConnection(provider) {
    if (!provider) return false;

    try {
        if (provider === 'ollama') {
            const res = await verifyOllama();
            return res.ok;
        } else if (provider === 'lmstudio') {
            const res = await verifyLMStudio();
            return res.ok;
        } else if (['openai', 'anthropic', 'google', 'mistral', 'groq'].includes(provider)) {
            // Check if key is configured
            const key = state.settings.integrations[provider];
            return !!key && key.length > 10;
        } else {
            return false; // Unknown provider
        }
    } catch (e) {
        console.warn('Connection check failed:', e);
        return false;
    }
}

// Initial update
document.addEventListener('DOMContentLoaded', () => {
    // Escuchar cambios de configuración para actualizar UI
    const observer = new MutationObserver(() => {
        if (document.querySelector('.chat-panel.active')) {
            updateChatContextDisplay();
        }
    });

    // Watch for config changes in state proxy if possible, or just use event
    window.addEventListener('settingsChanged', () => {
        updateChatContextDisplay();
    });
});

function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

function sendSuggestion(text) {
    document.getElementById('chatInput').value = text;
    sendChatMessage();
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || chatState.isGenerating) return;

    input.value = '';

    // Add user message
    const userMsg = addChatMessage('user', message);
    if (typeof saveChatMessage === 'function') {
        await saveChatMessage(userMsg);
    }

    // Show typing indicator
    chatState.isGenerating = true;
    document.getElementById('typingIndicator').style.display = 'flex';
    document.getElementById('sendBtn').disabled = true;

    try {
        const agent = chatState.currentAgent;
        const settings = state.settings[agent];
        const provider = settings.provider || 'ollama';
        const model = settings.model || 'llama3.2';

        // Check if streaming is available
        const useStreaming = (provider === 'ollama' || provider === 'lmstudio') &&
            typeof streamOllamaResponse === 'function';

        if (useStreaming) {
            // Create placeholder message for streaming
            const msgEl = addChatMessageElement('agent', '');
            const textEl = msgEl.querySelector('.message-text');
            textEl.classList.add('streaming-cursor');

            const messages = buildMessageHistory(message);
            const streamFn = provider === 'ollama' ? streamOllamaResponse : streamLMStudioResponse;

            await streamFn(model, messages,
                (chunk, fullText) => {
                    textEl.innerHTML = typeof parseMarkdown === 'function'
                        ? parseMarkdown(fullText)
                        : formatMessageText(fullText);
                    document.getElementById('chatMessages').scrollTop =
                        document.getElementById('chatMessages').scrollHeight;
                },
                async (finalText) => {
                    textEl.classList.remove('streaming-cursor');
                    const agentMsg = { type: 'agent', text: finalText, agent: chatState.currentAgent };
                    chatState.messages.push(agentMsg);
                    if (typeof saveChatMessage === 'function') {
                        await saveChatMessage(agentMsg);
                    }
                }
            );
        } else {
            const response = await generateAIResponse(message);
            const agentMsg = addChatMessage('agent', response);
            if (typeof saveChatMessage === 'function') {
                await saveChatMessage(agentMsg);
            }
        }
    } catch (error) {
        addChatMessage('agent', `❌ Error: ${error.message}\n\nAsegúrate de que el proveedor esté configurado correctamente en la sección de Configuración.`);
    } finally {
        chatState.isGenerating = false;
        document.getElementById('typingIndicator').style.display = 'none';
        document.getElementById('sendBtn').disabled = false;
    }
}

function buildMessageHistory(userMessage) {
    return [
        { role: 'system', content: agentPrompts[chatState.currentAgent] },
        ...chatState.messages.slice(-10).map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.text
        })),
        { role: 'user', content: userMessage }
    ];
}

function addChatMessage(type, text) {
    const messagesContainer = document.getElementById('chatMessages');

    // Remove welcome message if exists
    const welcome = messagesContainer.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const message = {
        type,
        text,
        timestamp: new Date().toISOString(),
        agent: type === 'agent' ? chatState.currentAgent : null
    };

    chatState.messages.push(message);

    addChatMessageElement(type, text, message.timestamp);
    return message;
}

function addChatMessageElement(type, text, timestamp = new Date().toISOString()) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;

    const avatarSvg = type === 'user'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0113 0"/></svg>'
        : chatState.currentAgent === 'orquestador'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0113 0"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>';

    const formattedText = typeof parseMarkdown === 'function' ? parseMarkdown(text) : formatMessageText(text);

    messageEl.innerHTML = `
        <div class="message-avatar">${avatarSvg}</div>
        <div class="message-content">
            <div class="message-text">${formattedText}</div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageEl;
}

function formatMessageText(text) {
    // Use enhanced markdown parser if available
    if (typeof parseMarkdown === 'function') {
        return parseMarkdown(text);
    }
    // Fallback basic markdown parsing
    return text
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

async function generateAIResponse(userMessage) {
    const agent = chatState.currentAgent;
    const settings = state.settings[agent];
    const provider = settings.provider || 'ollama';
    const model = settings.model || 'llama3.2';

    // Build messages array with system prompt
    const messages = [
        { role: 'system', content: agentPrompts[agent] },
        ...chatState.messages.slice(-10).map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.text
        })),
        { role: 'user', content: userMessage }
    ];

    // Route to appropriate provider
    switch (provider) {
        case 'ollama':
            return await callOllama(model, messages);
        case 'lmstudio':
            return await callLMStudio(model, messages);
        case 'openai':
            return await callOpenAI(model, messages);
        case 'anthropic':
            return await callAnthropic(model, messages);
        case 'google':
            return await callGoogle(model, messages);
        case 'groq':
            return await callGroq(model, messages);
        default:
            return `El proveedor "${provider}" no está implementado aún. Por favor selecciona Ollama o LM Studio para uso local.`;
    }
}

// Provider Implementations
async function callOllama(model, messages) {
    const endpoint = state.settings.integrations.ollama?.endpoint || 'http://localhost:11434';

    const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false
        })
    });

    if (!response.ok) throw new Error('Ollama no responde. ¿Está ejecutándose?');

    const data = await response.json();
    return data.message?.content || 'Sin respuesta del modelo';
}

async function callLMStudio(model, messages) {
    const endpoint = state.settings.integrations.lmstudio?.endpoint || 'http://localhost:1234';

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: state.settings[chatState.currentAgent]?.temperature || 0.7
        })
    });

    if (!response.ok) throw new Error('LM Studio no responde. ¿Está el servidor activo?');

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Sin respuesta del modelo';
}

async function callOpenAI(model, messages) {
    const apiKey = state.settings.integrations.openai;
    if (!apiKey) throw new Error('API Key de OpenAI no configurada');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: state.settings[chatState.currentAgent]?.temperature || 0.7
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error de OpenAI');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Sin respuesta';
}

async function callAnthropic(model, messages) {
    const apiKey = state.settings.integrations.anthropic;
    if (!apiKey) throw new Error('API Key de Anthropic no configurada');

    // Note: Anthropic requires a backend proxy due to CORS
    throw new Error('Anthropic requiere un backend proxy. Usa Ollama o LM Studio para acceso directo.');
}

async function callGoogle(model, messages) {
    const apiKey = state.settings.integrations.google;
    if (!apiKey) throw new Error('API Key de Google no configurada');

    // Convert messages format for Gemini
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] }
        })
    });

    if (!response.ok) throw new Error('Error de Google AI');

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
}

async function callGroq(model, messages) {
    const apiKey = state.settings.integrations.groq;
    if (!apiKey) throw new Error('API Key de Groq no configurada');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: state.settings[chatState.currentAgent]?.temperature || 0.7
        })
    });

    if (!response.ok) throw new Error('Error de Groq');

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Sin respuesta';
}

function clearChat() {
    chatState.messages = [];
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = `
        <div class="chat-welcome">
            <div class="welcome-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
            </div>
            <h3>Chat con Agentes IA</h3>
            <p>Inicia una conversación con el agente seleccionado para planificar, revisar código o implementar tareas.</p>
            <div class="welcome-suggestions">
                <button class="suggestion-chip" onclick="sendSuggestion('Analiza el estado actual del proyecto')">
                    📊 Analizar proyecto
                </button>
                <button class="suggestion-chip" onclick="sendSuggestion('¿Qué tareas están pendientes?')">
                    📋 Ver tareas
                </button>
                <button class="suggestion-chip" onclick="sendSuggestion('Ayúdame a planificar la siguiente feature')">
                    🎯 Planificar
                </button>
            </div>
        </div>
    `;
    showToast('Chat limpiado', 'info');
}

// Initialize chat when section is shown
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        selectChatAgent('orquestador');
    }, 100);
});

// Expose chat functions
window.selectChatAgent = selectChatAgent;
window.sendChatMessage = sendChatMessage;
window.sendSuggestion = sendSuggestion;
window.handleChatKeydown = handleChatKeydown;
window.clearChat = clearChat;
