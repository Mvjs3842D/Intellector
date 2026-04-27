// ============ STATE ============
const API_BASE = 'http://localhost:5000/api';

let state = {
    currentChatId: null,
    chats: [],
    isLoading: false,
    sidebarOpen: true
};

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    loadChats();
    setupInputListener();

    setInterval(checkHealth, 30000);
});

function setupInputListener() {
    const input = document.getElementById('message-input');
    input.addEventListener('input', () => {
        document.getElementById('send-btn').disabled = input.value.trim() === '';
    });
}

// ============ API ============
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    options.signal = controller.signal;

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            let msg = `HTTP ${response.status}`;
            try {
                const err = await response.json();
                msg = err.error || msg;
            } catch (e) {}
            throw new Error(msg);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Model is taking too long.');
        }
        throw error;
    }
}

async function checkHealth() {
    try {
        const health = await apiCall('/health');
        const el = document.getElementById('connection-status');
        if (health.ollama === 'connected') {
            el.innerHTML = `<div class="status-dot connected"></div>
                           <span>Ollama Connected (${health.model})</span>`;
        } else {
            el.innerHTML = `<div class="status-dot disconnected"></div>
                           <span>Ollama Disconnected</span>`;
        }
    } catch (e) {
        const el = document.getElementById('connection-status');
        el.innerHTML = `<div class="status-dot disconnected"></div>
                       <span>Backend Offline</span>`;
    }
}

// ============ CHATS ============
async function loadChats() {
    try {
        state.chats = await apiCall('/chats');
        renderChatHistory();
    } catch (e) {
        console.error('Failed to load chats:', e);
    }
}

function renderChatHistory() {
    const list = document.getElementById('chat-history-list');
    list.innerHTML = '';

    if (state.chats.length === 0) {
        list.innerHTML = `
            <div style="padding:20px 16px;text-align:center;
                        color:var(--text-tertiary);font-size:13px;">
                No chats yet. Start a conversation!
            </div>`;
        return;
    }

    state.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-history-item ${
            state.currentChatId === chat.id ? 'active' : ''
        }`;
        item.onclick = () => loadChat(chat.id);

        let iconClass = 'unknown-icon';
        let icon = 'fa-comment';
        if (chat.topic_category === 'factual') {
            iconClass = 'factual-icon';
            icon = 'fa-bolt';
        } else if (chat.topic_category === 'intellectual') {
            iconClass = 'intellectual-icon';
            icon = 'fa-graduation-cap';
        }

        item.innerHTML = `
            <i class="fas ${icon} chat-icon ${iconClass}"></i>
            <span class="chat-title">${escapeHtml(chat.title)}</span>
            <div class="chat-actions">
                <button onclick="event.stopPropagation();deleteChat('${chat.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;
        list.appendChild(item);
    });
}

async function createNewChat() {
    try {
        const chat = await apiCall('/chats', 'POST', { title: 'New Chat' });
        state.currentChatId = chat.id;
        await loadChats();
        showWelcomeScreen();
        clearMessages();
        updateTopBar(chat);
        document.getElementById('message-input').focus();
    } catch (e) {
        alert('Failed to create chat: ' + e.message);
    }
}

async function loadChat(chatId) {
    try {
        const chat = await apiCall(`/chats/${chatId}`);
        state.currentChatId = chatId;
        renderChatHistory();
        renderMessages(chat.messages || [], chat);
        updateTopBar(chat);
        document.getElementById('message-input').focus();
    } catch (e) {
        console.error('Failed to load chat:', e);
    }
}

async function deleteChat(chatId) {
    try {
        await apiCall(`/chats/${chatId}`, 'DELETE');
        if (state.currentChatId === chatId) {
            state.currentChatId = null;
            showWelcomeScreen();
        }
        await loadChats();
    } catch (e) {
        console.error('Delete failed:', e);
    }
}

// ============ MESSAGES ============
function renderMessages(messages, chat) {
    const container = document.getElementById('messages-container');
    const welcome = document.getElementById('welcome-screen');

    if (!messages || messages.length === 0) {
        welcome.style.display = 'flex';
        container.innerHTML = '';
        return;
    }

    welcome.style.display = 'none';
    container.innerHTML = '';

    messages.forEach(msg => {
        appendMessage(msg.role, msg.content, chat);
    });
    scrollToBottom();
}

function appendMessage(role, content, chat = null) {
    const container = document.getElementById('messages-container');
    document.getElementById('welcome-screen').style.display = 'none';

    const msgEl = document.createElement('div');
    msgEl.className = `message ${role}-message`;

    let avatarIcon = role === 'user' ? 'fa-user' : 'fa-brain';
    let badge = '';

    if (role === 'assistant' && chat) {
        if (chat.topic_category === 'intellectual' && !chat.ready_for_answer) {
            badge = `<div class="message-badge badge-teaching">
                        <i class="fas fa-graduation-cap"></i> Teaching Mode
                     </div>`;
        } else if (chat.topic_category === 'factual') {
            badge = `<div class="message-badge badge-direct">
                        <i class="fas fa-bolt"></i> Direct Answer
                     </div>`;
        }
    }

    let rendered = content;
    if (role === 'assistant') {
        try {
            rendered = marked.parse(content);
        } catch (e) {
            rendered = content.replace(/\n/g, '<br>');
        }
    } else {
        rendered = escapeHtml(content).replace(/\n/g, '<br>');
    }

    msgEl.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            ${badge}
            <div class="message-bubble">${rendered}</div>
        </div>`;

    container.appendChild(msgEl);

    // Highlight code blocks
    msgEl.querySelectorAll('pre code').forEach(block => {
        try { hljs.highlightElement(block); } catch(e) {}
    });

    scrollToBottom();
}

function clearMessages() {
    document.getElementById('messages-container').innerHTML = '';
}

function showWelcomeScreen() {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('messages-container').innerHTML = '';
    document.getElementById('current-chat-title').textContent = 'Intellector';
    document.getElementById('chat-meta').innerHTML = '';
    document.getElementById('teaching-indicator').style.display = 'none';
}

// ============ SEND MESSAGE ============
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content || state.isLoading) return;

    // Auto create chat if needed
    if (!state.currentChatId) {
        try {
            const chat = await apiCall('/chats', 'POST', { title: 'New Chat' });
            state.currentChatId = chat.id;
        } catch (e) {
            alert('Cannot create chat. Is the backend running on port 5000?');
            return;
        }
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('send-btn').disabled = true;

    // Show user message
    appendMessage('user', content);

    // Show typing
    state.isLoading = true;
    showTyping(true);

    const startTime = Date.now();
    const typingTimer = setInterval(() => {
        const el = document.querySelector('.typing-text');
        if (!el) return;
        const sec = Math.floor((Date.now() - startTime) / 1000);
        if (sec > 5 && sec <= 15) el.textContent = 'Processing your question...';
        else if (sec > 15 && sec <= 30) el.textContent = 'Analyzing and crafting response...';
        else if (sec > 30 && sec <= 60) el.textContent = 'Still working... small models take time';
        else if (sec > 60) el.textContent = `Working... ${sec}s elapsed`;
    }, 3000);

    try {
        const result = await apiCall(
            `/chats/${state.currentChatId}/message`,
            'POST',
            { content }
        );

        clearInterval(typingTimer);
        showTyping(false);

        appendMessage('assistant', result.assistant_message.content, result.chat);
        updateTopBar(result.chat);
        await loadChats();

    } catch (e) {
        clearInterval(typingTimer);
        showTyping(false);
        appendMessage('assistant',
            `⚠️ Error: ${e.message}\n\nMake sure:\n1. Ollama is running (ollama serve)\n2. Backend is running on port 5000`
        );
    } finally {
        state.isLoading = false;
    }
}

function showTyping(show) {
    document.getElementById('typing-indicator').style.display =
        show ? 'flex' : 'none';
    if (show) scrollToBottom();
}

// ============ UI UPDATES ============
function updateTopBar(chat) {
    document.getElementById('current-chat-title').textContent = chat.title || 'New Chat';

    let meta = '';
    if (chat.topic_category && chat.topic_category !== 'unknown') {
        const cls = chat.topic_category === 'factual'
            ? 'category-factual' : 'category-intellectual';
        const icon = chat.topic_category === 'factual'
            ? 'fa-bolt' : 'fa-graduation-cap';
        const label = chat.topic_category === 'factual'
            ? 'Factual' : 'Intellectual';
        meta = `<span class="category-label ${cls}">
                    <i class="fas ${icon}"></i> ${label}
                </span>`;
    }
    document.getElementById('chat-meta').innerHTML = meta;

    const indicator = document.getElementById('teaching-indicator');
    if (chat.topic_category === 'intellectual') {
        indicator.style.display = 'flex';
        const pct = (chat.user_understanding_level / 5) * 100;
        document.getElementById('understanding-fill').style.width = pct + '%';
        document.getElementById('understanding-label').textContent =
            `Understanding: ${chat.user_understanding_level}/5`;
    } else {
        indicator.style.display = 'none';
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleSection(section) {
    const content = document.getElementById(`${section}-content`);
    const toggle = document.getElementById(`${section}-toggle`);
    content.classList.toggle('expanded');
    if (toggle) {
        toggle.style.transform = content.classList.contains('expanded')
            ? 'rotate(180deg)' : 'rotate(0)';
    }
}

// ============ HELPERS ============
function useExample(text) {
    document.getElementById('message-input').value = text;
    document.getElementById('send-btn').disabled = false;
    sendMessage();
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function scrollToBottom() {
    const area = document.getElementById('chat-area');
    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Context menu stubs (HTML references these)
function showContextMenu() {}
function contextAction() {}
function showCreateProjectModal() {}
function createProject() {}
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}