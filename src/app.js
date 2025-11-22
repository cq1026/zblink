let currentAction = null;

function confirmAction(action, actionName) {
    currentAction = action;
    document.getElementById('modal-title').textContent = actionName;
    document.getElementById('modal-message').textContent = `请输入密码以确认${actionName}`;
    document.getElementById('password-input').value = '';
    document.getElementById('modal-error').textContent = '';
    document.getElementById('password-modal').classList.add('active');
    document.getElementById('password-input').focus();
}

function closeModal() {
    document.getElementById('password-modal').classList.remove('active');
    currentAction = null;
}

async function executeAction() {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('modal-error');

    if (!password) {
        errorEl.textContent = '请输入密码';
        return;
    }

    const confirmBtn = document.querySelector('.modal-actions .btn-primary');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '执行中...';
    errorEl.textContent = '';

    try {
        const response = await fetch(`/api/${currentAction}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            addLog('success', `${getActionName(currentAction)}成功`);
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
        addLog('error', `${getActionName(currentAction)}失败: 网络错误`);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认';
    }
}

function getActionName(action) {
    const names = {
        restart: '重启服务',
        start: '启动服务',
        stop: '停止服务',
        redeploy: '重新部署'
    };
    return names[action] || action;
}

function addLog(type, message) {
    const container = document.getElementById('log-container');
    const emptyMsg = container.querySelector('.log-empty');
    if (emptyMsg) {
        emptyMsg.remove();
    }

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;

    const time = new Date().toLocaleString('zh-CN');
    entry.innerHTML = `
        <div class="log-time">${time}</div>
        <div>${message}</div>
    `;

    container.insertBefore(entry, container.firstChild);
}

// Handle Enter key in password input
document.getElementById('password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        executeAction();
    }
});

// Close modal on outside click
document.getElementById('password-modal').addEventListener('click', (e) => {
    if (e.target.id === 'password-modal') {
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});
