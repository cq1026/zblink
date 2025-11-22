let currentAction = null;
let currentServiceKey = null;
let currentServiceName = null;

document.addEventListener('DOMContentLoaded', loadServices);

async function loadServices() {
    const container = document.getElementById('services-container');

    try {
        const response = await fetch('/api/services');
        const result = await response.json();

        if (result.success && result.services) {
            renderServices(result.services);
        } else {
            container.innerHTML = '<div class="error-state">Failed to load services</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error-state">Network error</div>';
    }
}

function renderServices(services) {
    const container = document.getElementById('services-container');

    if (services.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📦</span>
                <p>No services configured</p>
            </div>
        `;
        return;
    }

    container.innerHTML = services.map(service => `
        <div class="service-card">
            <div class="service-header">
                <div class="service-info">
                    <div class="service-name">${escapeHtml(service.name)}</div>
                    <div class="service-key">${escapeHtml(service.key)}</div>
                </div>
                <div class="service-actions">
                    <button class="btn btn-restart" onclick="confirmAction('restart', '${escapeHtml(service.key)}', '${escapeHtml(service.name)}')">
                        Restart
                    </button>
                    <button class="btn btn-stop" onclick="confirmAction('stop', '${escapeHtml(service.key)}', '${escapeHtml(service.name)}')">
                        Stop
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function confirmAction(action, serviceKey, serviceName) {
    currentAction = action;
    currentServiceKey = serviceKey;
    currentServiceName = serviceName;

    const actionNames = {
        restart: 'Restart',
        stop: 'Stop'
    };

    document.getElementById('modal-title').textContent = `${actionNames[action]} Service`;
    document.getElementById('modal-message').textContent = `Confirm ${actionNames[action].toLowerCase()} for "${serviceName}"`;
    document.getElementById('password-input').value = '';
    document.getElementById('modal-error').textContent = '';
    document.getElementById('password-modal').classList.add('active');

    setTimeout(() => {
        document.getElementById('password-input').focus();
    }, 100);
}

function closeModal() {
    document.getElementById('password-modal').classList.remove('active');
    currentAction = null;
    currentServiceKey = null;
    currentServiceName = null;
}

async function executeAction() {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('modal-error');
    const confirmBtn = document.getElementById('confirm-btn');

    if (!password) {
        errorEl.textContent = 'Please enter password';
        return;
    }

    confirmBtn.classList.add('loading');
    confirmBtn.disabled = true;
    errorEl.textContent = '';

    const actionNames = {
        restart: 'Restart',
        stop: 'Stop'
    };

    try {
        const response = await fetch(`/api/${currentAction}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                password,
                serviceKey: currentServiceKey
            }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            addLog('success', currentServiceName, `${actionNames[currentAction]} successful`);
            closeModal();
        } else {
            errorEl.textContent = result.error || 'Operation failed';
            if (result.error === '密码错误') {
                errorEl.textContent = 'Invalid password';
                document.getElementById('password-input').value = '';
                document.getElementById('password-input').focus();
            }
        }
    } catch (error) {
        errorEl.textContent = 'Network error';
        addLog('error', currentServiceName, `${actionNames[currentAction]} failed`);
    } finally {
        confirmBtn.classList.remove('loading');
        confirmBtn.disabled = false;
    }
}

function addLog(type, serviceName, message) {
    const container = document.getElementById('log-container');
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    entry.innerHTML = `
        <div class="log-header">
            <span class="log-service">${escapeHtml(serviceName)}</span>
            <span class="log-time">${time}</span>
        </div>
        <div class="log-message">${escapeHtml(message)}</div>
    `;

    container.insertBefore(entry, container.firstChild);
}

function clearLogs() {
    const container = document.getElementById('log-container');
    container.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">📋</span>
            <p>No recent activity</p>
        </div>
    `;
}

// Event listeners
document.getElementById('password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        executeAction();
    }
});

document.getElementById('password-modal').addEventListener('click', (e) => {
    if (e.target.id === 'password-modal') {
        closeModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});
