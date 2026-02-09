// ===============================
// Notifications System
// ===============================

const notifications = {
    enabled: false,
    permission: 'default',
    queue: []
};

// ===============================
// Permission Request
// ===============================
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('[Notifications] Not supported');
        return false;
    }

    if (Notification.permission === 'granted') {
        notifications.enabled = true;
        notifications.permission = 'granted';
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notifications.permission = permission;
        notifications.enabled = permission === 'granted';
        return notifications.enabled;
    }

    return false;
}

// ===============================
// Show Notification
// ===============================
function showNotification(title, options = {}) {
    if (!notifications.enabled) {
        // Queue for later
        notifications.queue.push({ title, options });
        console.log('[Notifications] Queued:', title);
        return null;
    }

    const defaultOptions = {
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%236366f1"/><circle cx="50" cy="50" r="15" fill="white"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%236366f1"/></svg>',
        vibrate: [100, 50, 100],
        requireInteraction: false,
        silent: false,
        ...options
    };

    try {
        const notification = new Notification(title, defaultOptions);

        notification.onclick = () => {
            window.focus();
            if (options.onClick) options.onClick();
            notification.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        return notification;
    } catch (e) {
        console.error('[Notifications] Error:', e);
        return null;
    }
}

// ===============================
// Task Notifications
// ===============================
function notifyTaskCreated(task) {
    showNotification('Nueva Tarea Creada', {
        body: task.title,
        tag: 'task-created',
        data: { taskId: task.id }
    });
}

function notifyTaskCompleted(task) {
    showNotification('🎉 Tarea Completada', {
        body: task.title,
        tag: 'task-completed',
        data: { taskId: task.id }
    });
}

function notifyHandoff(handoff) {
    showNotification('🔄 Nuevo Handoff', {
        body: `${handoff.from} → ${handoff.to}: ${handoff.taskTitle}`,
        tag: 'handoff',
        data: { handoffId: handoff.id }
    });
}

// ===============================
// AI Notifications
// ===============================
function notifyAIResponse(agent) {
    showNotification(`${agent} respondió`, {
        body: 'Revisa el chat para ver la respuesta',
        tag: 'ai-response'
    });
}

function notifyAIError(error) {
    showNotification('⚠️ Error de IA', {
        body: error,
        tag: 'ai-error'
    });
}

// ===============================
// Reminder System
// ===============================
const reminders = [];

function setReminder(title, message, delayMinutes) {
    const reminder = {
        id: `reminder-${Date.now()}`,
        title,
        message,
        scheduledFor: new Date(Date.now() + delayMinutes * 60 * 1000),
        timeout: null
    };

    reminder.timeout = setTimeout(() => {
        showNotification(title, {
            body: message,
            tag: reminder.id,
            requireInteraction: true
        });

        // Remove from list
        const index = reminders.findIndex(r => r.id === reminder.id);
        if (index > -1) reminders.splice(index, 1);
    }, delayMinutes * 60 * 1000);

    reminders.push(reminder);
    console.log('[Reminders] Set for', delayMinutes, 'minutes:', title);

    return reminder;
}

function cancelReminder(reminderId) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) {
        clearTimeout(reminder.timeout);
        const index = reminders.indexOf(reminder);
        reminders.splice(index, 1);
        console.log('[Reminders] Cancelled:', reminderId);
    }
}

function getActiveReminders() {
    return reminders.map(r => ({
        id: r.id,
        title: r.title,
        message: r.message,
        scheduledFor: r.scheduledFor
    }));
}

// ===============================
// Sound Effects
// ===============================
const sounds = {
    notification: null,
    success: null,
    error: null
};

function initSounds() {
    // Create audio context for sounds
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();

        sounds.notification = createBeep(audioCtx, 800, 0.1);
        sounds.success = createBeep(audioCtx, 1000, 0.15);
        sounds.error = createBeep(audioCtx, 400, 0.2);
    } catch (e) {
        console.warn('[Sounds] Audio not supported');
    }
}

function createBeep(audioCtx, frequency, duration) {
    return () => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + duration);
    };
}

function playSound(type) {
    if (sounds[type]) {
        try {
            sounds[type]();
        } catch (e) { }
    }
}

// Initialize on load
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        initSounds();
        // Request permission after user interaction
        document.addEventListener('click', () => {
            if (notifications.permission === 'default') {
                requestNotificationPermission();
            }
        }, { once: true });
    });
}

// Export for global access
window.notifications = notifications;
window.requestNotificationPermission = requestNotificationPermission;
window.showNotification = showNotification;
window.notifyTaskCreated = notifyTaskCreated;
window.notifyTaskCompleted = notifyTaskCompleted;
window.notifyHandoff = notifyHandoff;
window.notifyAIResponse = notifyAIResponse;
window.setReminder = setReminder;
window.cancelReminder = cancelReminder;
window.getActiveReminders = getActiveReminders;
window.playSound = playSound;
