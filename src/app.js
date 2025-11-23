let currentAction = null;
let currentServiceKey = null;
let currentServiceName = null;
let currentAccount = null;
let allServices = [];
let allAccounts = [];
let serviceStatuses = {};

document.addEventListener('DOMContentLoaded', loadServices);

async function loadServices() {
    const container = document.getElementById('services-container');
    const tabsContainer = document.getElementById('tabs-container');

    try {
        const response = await fetch('/api/services');
        const result = await response.json();

        if (result.success) {
            allAccounts = result.accounts || [];
            allServices = result.services || [];

            if (allAccounts.length > 0) {
                currentAccount = allAccounts[0];
                renderTabs();
                renderServices();
                // Fetch statuses after rendering
                fetchStatuses();
            } else {
                tabsContainer.innerHTML = '';
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📦</span>
                        <p>No accounts configured</p>
                    </div>
                `;
            }
        } else {
            container.innerHTML = '<div class="error-state">Failed to load services</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error-state">Network error</div>';
    }
}

async function fetchStatuses() {
    try {
        const response = await fetch('/api/status');
        const result = await response.json();

        if (result.success) {
            serviceStatuses = result.statuses || {};
            updateStatusBadges();
        }
    } catch (error) {
        console.error('Failed to fetch statuses:', error);
    }
}

function updateStatusBadges() {
    document.querySelectorAll('.status-badge').forEach(badge => {
        const key = badge.dataset.key;
        const status = serviceStatuses[key] || 'UNKNOWN';
        badge.textContent = getStatusText(status);
        badge.className = `status-badge status-${status.toLowerCase()}`;
    });
}

function getStatusText(status) {
    const texts = {
        'RUNNING': 'Running',
        'SUSPENDED': 'Stopped',
        'STARTING': 'Starting',
        'STOPPING': 'Stopping',
        'BUILDING': 'Building',
        'CRASHED': 'Crashed',
        'PENDING': 'Pending',
        'UNKNOWN': 'Unknown'
    };
    return texts[status] || status;
}

function renderTabs() {
    const tabsContainer = document.getElementById('tabs-container');

    if (allAccounts.length <= 1) {
        tabsContainer.innerHTML = '';
        return;
    }

    tabsContainer.innerHTML = `
        <div class="tabs">
            ${allAccounts.map(account => `
                <button class="tab ${account === currentAccount ? 'active' : ''}"
                        onclick="switchAccount('${escapeHtml(account)}')">
                    ${escapeHtml(account)}
                </button>
            `).join('')}
            <div class="tab-indicator" id="tab-indicator"></div>
        </div>
    `;

    updateTabIndicator();
}

function switchAccount(account) {
    if (account === currentAccount) return;

    currentAccount = account;

    // Update tab active state
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.trim() === account);
    });

    updateTabIndicator();
    renderServices();
    updateStatusBadges();
}

function updateTabIndicator() {
    const activeTab = document.querySelector('.tab.active');
    const indicator = document.getElementById('tab-indicator');

    if (activeTab && indicator) {
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.left = `${activeTab.offsetLeft}px`;
    }
}

function renderServices() {
    const container = document.getElementById('services-container');
    const services = allServices.filter(s => s.account === currentAccount);

    if (services.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📦</span>
                <p>No services in this account</p>
            </div>
        `;
        return;
    }

    container.innerHTML = services.map((service, index) => `
        <div class="service-card" style="animation-delay: ${index * 0.05}s">
            <div class="service-header">
                <div class="service-info">
                    <div class="service-name-row">
                        <span class="service-name">${escapeHtml(service.name)}</span>
                        <span class="status-badge status-unknown" data-key="${escapeHtml(service.key)}">Loading</span>
                    </div>
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
            // Refresh status after action with delay for API to process
            setTimeout(fetchStatuses, 2000);
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

// Update tab indicator on window resize
window.addEventListener('resize', updateTabIndicator);
