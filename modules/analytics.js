// ===============================
// Analytics & Metrics System
// ===============================

const analytics = {
    sessions: [],
    events: [],
    metrics: {}
};

// ===============================
// Session Tracking
// ===============================
function startSession() {
    const session = {
        id: `session-${Date.now()}`,
        startedAt: new Date().toISOString(),
        events: [],
        metrics: {
            tasksCreated: 0,
            tasksCompleted: 0,
            messagessSent: 0,
            aiResponses: 0,
            handoffs: 0
        }
    };

    analytics.sessions.push(session);
    localStorage.setItem('currentSessionId', session.id);

    console.log('[Analytics] Session started:', session.id);
    return session;
}

function getCurrentSession() {
    const sessionId = localStorage.getItem('currentSessionId');
    return analytics.sessions.find(s => s.id === sessionId) || startSession();
}

function endSession() {
    const session = getCurrentSession();
    session.endedAt = new Date().toISOString();
    session.duration = new Date(session.endedAt) - new Date(session.startedAt);

    console.log('[Analytics] Session ended:', session.id, 'Duration:', Math.round(session.duration / 1000), 's');
}

// ===============================
// Event Tracking
// ===============================
function trackEvent(category, action, label = '', value = 0) {
    const event = {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        category,
        action,
        label,
        value,
        sessionId: getCurrentSession().id
    };

    analytics.events.push(event);
    getCurrentSession().events.push(event);

    // Update metrics
    updateMetrics(category, action, value);

    return event;
}

function updateMetrics(category, action, value) {
    const session = getCurrentSession();

    switch (category) {
        case 'task':
            if (action === 'created') session.metrics.tasksCreated++;
            if (action === 'completed') session.metrics.tasksCompleted++;
            break;
        case 'chat':
            if (action === 'message_sent') session.metrics.messagessSent++;
            if (action === 'ai_response') session.metrics.aiResponses++;
            break;
        case 'handoff':
            session.metrics.handoffs++;
            break;
    }
}

// ===============================
// Productivity Metrics
// ===============================
function calculateProductivityScore() {
    const tasks = state.tasks || [];
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;

    if (total === 0) return 0;

    // Base score from completion rate
    let score = (completed / total) * 50;

    // Bonus for recent activity
    const recentTasks = tasks.filter(t => {
        const created = new Date(t.createdAt);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return created > dayAgo;
    });
    score += Math.min(recentTasks.length * 5, 25);

    // Bonus for using AI chat
    const session = getCurrentSession();
    score += Math.min(session.metrics.aiResponses * 2, 25);

    return Math.round(Math.min(score, 100));
}

function getWeeklyStats() {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const weekTasks = (state.tasks || []).filter(t => new Date(t.createdAt) > weekAgo);
    const weekCompleted = weekTasks.filter(t => t.status === 'completed');

    const activities = (state.activities || []).filter(a => new Date(a.timestamp) > weekAgo);

    return {
        tasksCreated: weekTasks.length,
        tasksCompleted: weekCompleted.length,
        completionRate: weekTasks.length > 0 ? Math.round((weekCompleted.length / weekTasks.length) * 100) : 0,
        totalActivities: activities.length,
        avgTasksPerDay: Math.round(weekTasks.length / 7 * 10) / 10
    };
}

function getDailyStats() {
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const dayTasks = (state.tasks || []).filter(t => new Date(t.createdAt) > dayAgo);
    const dayCompleted = dayTasks.filter(t => t.status === 'completed');

    return {
        tasksCreated: dayTasks.length,
        tasksCompleted: dayCompleted.length,
        productivityScore: calculateProductivityScore()
    };
}

// ===============================
// Charts Data
// ===============================
function getTaskTrendData(days = 7) {
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const created = (state.tasks || []).filter(t =>
            t.createdAt && t.createdAt.startsWith(dateStr)
        ).length;

        const completed = (state.tasks || []).filter(t =>
            t.status === 'completed' && t.createdAt && t.createdAt.startsWith(dateStr)
        ).length;

        data.push({
            date: dateStr,
            label: date.toLocaleDateString('es-ES', { weekday: 'short' }),
            created,
            completed
        });
    }

    return data;
}

function getStatusDistribution() {
    const tasks = state.tasks || [];

    return {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length
    };
}

function getPriorityDistribution() {
    const tasks = state.tasks || [];

    return {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
    };
}

function getAgentWorkload() {
    const tasks = state.tasks || [];

    return {
        orquestador: tasks.filter(t => t.assignedTo === 'orquestador' && t.status !== 'completed').length,
        implementador: tasks.filter(t => t.assignedTo === 'implementador' && t.status !== 'completed').length
    };
}

// ===============================
// AI Usage Stats
// ===============================
function getAIUsageStats() {
    const sessions = analytics.sessions;

    let totalMessages = 0;
    let totalResponses = 0;

    for (const session of sessions) {
        totalMessages += session.metrics?.messagessSent || 0;
        totalResponses += session.metrics?.aiResponses || 0;
    }

    return {
        totalMessages,
        totalResponses,
        sessionsCount: sessions.length,
        avgMessagesPerSession: sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0
    };
}

// ===============================
// Dashboard Render
// ===============================
function renderAnalyticsDashboard() {
    const weekly = getWeeklyStats();
    const daily = getDailyStats();
    const status = getStatusDistribution();
    const priority = getPriorityDistribution();
    const workload = getAgentWorkload();

    return `
        <div class="analytics-grid">
            <div class="analytics-card">
                <div class="analytics-value">${daily.productivityScore}%</div>
                <div class="analytics-label">Productividad</div>
                <div class="analytics-trend ${daily.productivityScore > 50 ? 'up' : 'down'}">
                    ${daily.productivityScore > 50 ? '↑' : '↓'} vs promedio
                </div>
            </div>
            
            <div class="analytics-card">
                <div class="analytics-value">${state.tasks?.length || 0}</div>
                <div class="analytics-label">Total Tareas</div>
            </div>
            
            <div class="analytics-card">
                <div class="analytics-value">${weekly.completionRate}%</div>
                <div class="analytics-label">Tasa Completado</div>
            </div>
            
            <div class="analytics-card">
                <div class="analytics-value">${weekly.avgTasksPerDay}</div>
                <div class="analytics-label">Tareas/Día</div>
            </div>
        </div>
        
        <div class="analytics-details">
            <div class="stat-row">
                <span>Pendientes:</span>
                <span class="stat-value pending">${status.pending}</span>
            </div>
            <div class="stat-row">
                <span>En Progreso:</span>
                <span class="stat-value progress">${status.inProgress}</span>
            </div>
            <div class="stat-row">
                <span>Completadas:</span>
                <span class="stat-value completed">${status.completed}</span>
            </div>
            <hr>
            <div class="stat-row">
                <span>Orquestador:</span>
                <span class="stat-value">${workload.orquestador} activas</span>
            </div>
            <div class="stat-row">
                <span>Implementador:</span>
                <span class="stat-value">${workload.implementador} activas</span>
            </div>
        </div>
    `;
}

// Initialize session on load
if (typeof window !== 'undefined') {
    window.addEventListener('load', startSession);
    window.addEventListener('beforeunload', endSession);
}

// Export for global access
window.analytics = analytics;
window.trackEvent = trackEvent;
window.calculateProductivityScore = calculateProductivityScore;
window.getWeeklyStats = getWeeklyStats;
window.getDailyStats = getDailyStats;
window.getTaskTrendData = getTaskTrendData;
window.getStatusDistribution = getStatusDistribution;
window.getPriorityDistribution = getPriorityDistribution;
window.getAgentWorkload = getAgentWorkload;
window.getAIUsageStats = getAIUsageStats;
window.renderAnalyticsDashboard = renderAnalyticsDashboard;
