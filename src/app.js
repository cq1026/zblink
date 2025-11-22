let currentAction = null;
let currentServiceKey = null;

// Load services on page load
document.addEventListener('DOMContentLoaded', loadServices);

async function loadServices() {
    try {
        const response = await fetch('/api/services');
        const result = await response.json();

        if (result.success && result.services) {
            renderServices(result.services);
        } else {
            showError('加载服务列表失败');
        }
    } catch (error) {
        showError('网络错误，无法加载服务');
    }
}

function renderServices(services) {
    const container = document.getElementById('services-container');

    if (services.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">未配置任何服务</p>';
        return;
    }

    container.innerHTML = services.map(service => `
        <div class="service-card">
            <div class="service-header">
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="service-id">${service.key}</div>
                </div>
            </div>
            <div class="service-actions">
                <button class="btn btn-restart" onclick="confirmAction('restart', '${service.key}', '${service.name}')">
                    重启
                </button>
                <button class="btn btn-start" onclick="confirmAction('start', '${service.key}', '${service.name}')">
                    启动
                </button>
                <button class="btn btn-stop" onclick="confirmAction('stop', '${service.key}', '${service.name}')">
                    停止
                </button>
                <button class="btn btn-redeploy" onclick="confirmAction('redeploy', '${service.key}', '${service.name}')">
                    部署
                </button>
            </div>
        </div>
    `).join('');
}

function showError(message) {
    const container = document.getElementById('services-container');
    container.innerHTML = `<p style="text-align: center; color: var(--danger); padding: 40px;">${message}</p>`;
}

function confirmAction(action, serviceKey, serviceName) {
    currentAction = action;
    currentServiceKey = serviceKey;

    const actionNames = {
        restart: '重启',
        start: '启动',
        stop: '停止',
        redeploy: '部署'
    };

    document.getElementById('modal-title').textContent = `${actionNames[action]} ${serviceName}`;
    document.getElementById('modal-message').textContent = `请输入密码以确认${actionNames[action]}操作`;
    document.getElementById('password-input').value = '';
    document.getElementById('modal-error').textContent = '';
    document.getElementById('password-modal').classList.add('active');
    document.getElementById('password-input').focus();
}

function closeModal() {
    document.getElementById('password-modal').classList.remove('active');
    currentAction = null;
    currentServiceKey = null;
}

async function executeAction() {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('modal-error');

    if (!password) {
        errorEl.textContent = '请输入密码';
        return;
    }

    const confirmBtn = document.querySelector('.btn-confirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '执行中...';
    errorEl.textContent = '';

    const actionNames = {
        restart: '重启',
        start: '启动',
        stop: '停止',
        redeploy: '部署'
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
            addLog('success', currentServiceKey, `${actionNames[currentAction]}成功`);
            closeModal();
        } else {
            errorEl.textContent = result.error || '操作失败';
            if (result.error === '密码错误') {
                document.getElementById('password-input').value = '';
                document.getElementById('password-input').focus();
            }
        }
    } catch (error) {
        errorEl.textContent = '网络错误，请重试';
        addLog('error', currentServiceKey, `${actionNames[currentAction]}失败: 网络错误`);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认';
    }
}

function addLog(type, serviceName, message) {
    const container = document.getElementById('log-container');
    const emptyMsg = container.querySelector('.log-empty');
    if (emptyMsg) {
        emptyMsg.remove();
    }

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;

    const time = new Date().toLocaleTimeString('zh-CN');
    entry.innerHTML = `
        <div class="log-header">
            <span class="log-service">${serviceName}</span>
            <span class="log-time">${time}</span>
        </div>
        <div class="log-message">${message}</div>
    `;

    container.insertBefore(entry, container.firstChild);
}

function clearLogs() {
    const container = document.getElementById('log-container');
    container.innerHTML = '<p class="log-empty">暂无操作记录</p>';
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
