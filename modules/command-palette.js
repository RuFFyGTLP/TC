// ===============================
// Command Palette (Spotlight-style)
// ===============================

const commandPalette = {
    isOpen: false,
    commands: [],
    recentCommands: []
};

// ===============================
// Default Commands
// ===============================
function initCommandPalette() {
    commandPalette.commands = [
        // Navigation
        { id: 'nav-dashboard', label: 'Ir a Dashboard', category: 'Navegación', icon: '🏠', action: () => navigateTo('dashboard') },
        { id: 'nav-tasks', label: 'Ir a Tareas', category: 'Navegación', icon: '📋', action: () => navigateTo('tasks') },
        { id: 'nav-chat', label: 'Ir a Chat IA', category: 'Navegación', icon: '💬', action: () => navigateTo('chat') },
        { id: 'nav-handoffs', label: 'Ir a Handoffs', category: 'Navegación', icon: '🔄', action: () => navigateTo('handoffs') },
        { id: 'nav-activity', label: 'Ir a Actividad', category: 'Navegación', icon: '📊', action: () => navigateTo('activity') },
        { id: 'nav-settings', label: 'Ir a Configuración', category: 'Navegación', icon: '⚙️', action: () => navigateTo('settings') },

        // Actions
        { id: 'new-task', label: 'Nueva Tarea', category: 'Acciones', icon: '➕', action: () => openNewTaskModal?.() },
        { id: 'new-handoff', label: 'Nuevo Handoff', category: 'Acciones', icon: '🔄', action: () => openNewHandoffModal?.() },
        { id: 'save', label: 'Guardar Estado', category: 'Acciones', icon: '💾', action: () => { saveStateDB?.(); showToast?.('Estado guardado', 'success'); } },
        { id: 'export', label: 'Exportar Datos', category: 'Acciones', icon: '📤', action: () => exportData?.() },

        // Theme
        { id: 'theme-toggle', label: 'Cambiar Tema', category: 'Tema', icon: '🌓', action: () => toggleTheme?.() },
        { id: 'theme-dark', label: 'Tema Oscuro', category: 'Tema', icon: '🌙', action: () => { document.body.classList.remove('light-theme'); localStorage.setItem('theme', 'dark'); } },
        { id: 'theme-light', label: 'Tema Claro', category: 'Tema', icon: '☀️', action: () => { document.body.classList.add('light-theme'); localStorage.setItem('theme', 'light'); } },

        // Chat
        { id: 'chat-orquestador', label: 'Chat con Orquestador', category: 'Chat', icon: '🎯', action: () => { navigateTo('chat'); setAgent?.('orquestador'); } },
        { id: 'chat-implementador', label: 'Chat con Implementador', category: 'Chat', icon: '💻', action: () => { navigateTo('chat'); setAgent?.('implementador'); } },
        { id: 'chat-clear', label: 'Limpiar Chat', category: 'Chat', icon: '🗑️', action: () => { clearChat?.(); showToast?.('Chat limpiado', 'info'); } },

        // AI
        { id: 'ai-verify', label: 'Verificar APIs', category: 'IA', icon: '🔍', action: async () => { const r = await verifyAllAPIs?.(); console.log(r); showToast?.('Ver consola para resultados', 'info'); } },
        { id: 'ai-models', label: 'Ver Modelos Disponibles', category: 'IA', icon: '🤖', action: () => showModelsModal?.() },

        // Analytics
        { id: 'stats-productivity', label: 'Ver Productividad', category: 'Analytics', icon: '📈', action: () => { const score = calculateProductivityScore?.(); showToast?.(`Productividad: ${score}%`, 'info'); } },
        { id: 'stats-weekly', label: 'Estadísticas Semanales', category: 'Analytics', icon: '📊', action: () => { const stats = getWeeklyStats?.(); console.log(stats); showToast?.(`Esta semana: ${stats?.tasksCreated || 0} tareas`, 'info'); } },

        // Memory
        { id: 'memory-stats', label: 'Ver Estado de Memoria', category: 'Memoria', icon: '🧠', action: () => { const stats = getMemoryStats?.(); console.log(stats); showToast?.(`Memoria: ${stats?.longTermFacts || 0} hechos`, 'info'); } },
        { id: 'memory-clear', label: 'Limpiar Memoria', category: 'Memoria', icon: '🗑️', action: () => { clearShortTerm?.(); showToast?.('Memoria a corto plazo limpiada', 'info'); } },

        // System
        { id: 'reload', label: 'Recargar Aplicación', category: 'Sistema', icon: '🔄', action: () => location.reload() },
        { id: 'fullscreen', label: 'Pantalla Completa', category: 'Sistema', icon: '⛶', action: () => document.documentElement.requestFullscreen?.() },
        { id: 'shortcuts', label: 'Ver Atajos de Teclado', category: 'Sistema', icon: '⌨️', action: () => showShortcutsModal() }
    ];
}

// ===============================
// Navigation Helper
// ===============================
function navigateTo(section) {
    const navItem = document.querySelector(`[data-section="${section}"]`);
    if (navItem) navItem.click();
}

// ===============================
// Search Commands
// ===============================
function searchCommands(query) {
    if (!query) return commandPalette.commands.slice(0, 10);

    const lowerQuery = query.toLowerCase();

    return commandPalette.commands
        .filter(cmd =>
            cmd.label.toLowerCase().includes(lowerQuery) ||
            cmd.category.toLowerCase().includes(lowerQuery)
        )
        .sort((a, b) => {
            // Prioritize exact matches at start
            const aStarts = a.label.toLowerCase().startsWith(lowerQuery);
            const bStarts = b.label.toLowerCase().startsWith(lowerQuery);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
        })
        .slice(0, 10);
}

// ===============================
// UI Rendering
// ===============================
function openCommandPalette() {
    commandPalette.isOpen = true;

    let modal = document.getElementById('commandPaletteModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'commandPaletteModal';
        modal.className = 'command-palette-overlay';
        modal.innerHTML = `
            <div class="command-palette">
                <div class="command-input-wrapper">
                    <span class="command-icon">⌘</span>
                    <input type="text" class="command-input" placeholder="Escribe un comando..." autocomplete="off">
                </div>
                <div class="command-results"></div>
                <div class="command-footer">
                    <span><kbd>↑↓</kbd> Navegar</span>
                    <span><kbd>Enter</kbd> Ejecutar</span>
                    <span><kbd>Esc</kbd> Cerrar</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add styles if not present
        addCommandPaletteStyles();
    }

    modal.classList.add('active');

    const input = modal.querySelector('.command-input');
    const results = modal.querySelector('.command-results');

    input.value = '';
    input.focus();

    let selectedIndex = 0;
    let currentResults = searchCommands('');

    function renderResults() {
        results.innerHTML = currentResults.map((cmd, i) => `
            <div class="command-item ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
                <span class="command-item-icon">${cmd.icon}</span>
                <span class="command-item-label">${cmd.label}</span>
                <span class="command-item-category">${cmd.category}</span>
            </div>
        `).join('');
    }

    renderResults();

    function executeSelected() {
        const cmd = currentResults[selectedIndex];
        if (cmd) {
            closeCommandPalette();
            cmd.action();

            // Track recent
            commandPalette.recentCommands = [cmd.id, ...commandPalette.recentCommands.filter(id => id !== cmd.id)].slice(0, 5);
        }
    }

    input.oninput = () => {
        currentResults = searchCommands(input.value);
        selectedIndex = 0;
        renderResults();
    };

    input.onkeydown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
            renderResults();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            renderResults();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeSelected();
        } else if (e.key === 'Escape') {
            closeCommandPalette();
        }
    };

    results.onclick = (e) => {
        const item = e.target.closest('.command-item');
        if (item) {
            selectedIndex = parseInt(item.dataset.index);
            executeSelected();
        }
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeCommandPalette();
        }
    };
}

function closeCommandPalette() {
    commandPalette.isOpen = false;
    const modal = document.getElementById('commandPaletteModal');
    if (modal) modal.classList.remove('active');
}

function showShortcutsModal() {
    const shortcuts = [
        { keys: 'Ctrl + K', action: 'Abrir Chat' },
        { keys: 'Ctrl + N', action: 'Nueva Tarea' },
        { keys: 'Ctrl + S', action: 'Guardar Estado' },
        { keys: 'Ctrl + P', action: 'Paleta de Comandos' },
        { keys: 'Escape', action: 'Cerrar Modal' }
    ];

    showToast?.(`Atajos: ${shortcuts.map(s => `${s.keys} = ${s.action}`).join(' | ')}`, 'info');
}

// ===============================
// Styles
// ===============================
function addCommandPaletteStyles() {
    if (document.getElementById('commandPaletteStyles')) return;

    const style = document.createElement('style');
    style.id = 'commandPaletteStyles';
    style.textContent = `
        .command-palette-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: none;
            justify-content: center;
            padding-top: 15vh;
            z-index: 10000;
        }
        
        .command-palette-overlay.active {
            display: flex;
        }
        
        .command-palette {
            width: 100%;
            max-width: 600px;
            background: var(--bg-card, #1a1a2e);
            border: 1px solid var(--border-color, #333);
            border-radius: 12px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            animation: slideDown 0.2s ease;
        }
        
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        .command-input-wrapper {
            display: flex;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid var(--border-color, #333);
        }
        
        .command-icon {
            font-size: 1.5rem;
            margin-right: 12px;
            opacity: 0.5;
        }
        
        .command-input {
            flex: 1;
            background: transparent;
            border: none;
            font-size: 1.1rem;
            color: var(--text-primary, #fff);
            outline: none;
        }
        
        .command-results {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .command-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            cursor: pointer;
            transition: background 0.1s;
        }
        
        .command-item:hover,
        .command-item.selected {
            background: var(--accent-primary, #6366f1);
        }
        
        .command-item-icon {
            font-size: 1.2rem;
            margin-right: 12px;
            width: 24px;
            text-align: center;
        }
        
        .command-item-label {
            flex: 1;
            font-weight: 500;
        }
        
        .command-item-category {
            font-size: 0.75rem;
            opacity: 0.6;
            padding: 2px 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
        }
        
        .command-footer {
            display: flex;
            gap: 16px;
            padding: 12px 16px;
            border-top: 1px solid var(--border-color, #333);
            font-size: 0.75rem;
            opacity: 0.6;
        }
        
        .command-footer kbd {
            padding: 2px 6px;
            background: var(--bg-tertiary, #2a2a3e);
            border: 1px solid var(--border-color, #444);
            border-radius: 4px;
            font-family: monospace;
        }
    `;
    document.head.appendChild(style);
}

// ===============================
// Keyboard Shortcut
// ===============================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + P: Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (commandPalette.isOpen) {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
    }
});

// Initialize on load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initCommandPalette);
}

// Export for global access
window.commandPalette = commandPalette;
window.openCommandPalette = openCommandPalette;
window.closeCommandPalette = closeCommandPalette;
window.searchCommands = searchCommands;
