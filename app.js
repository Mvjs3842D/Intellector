// ═════════════════════════════════════════════════════════════
//  INTELLECTOR — AI-Assisted Academic Thinking Tool
//  Think First. Then Instruct.
// ═════════════════════════════════════════════════════════════

var CONFIG = {
    FIREBASE_API_KEY: "AIzaSyBfzFKgfyHof1lx_m7WHhf5C1v1T8-9aqs",
    FIREBASE_AUTH_DOMAIN: "intellector-cfcf9.firebaseapp.com",
    FIREBASE_PROJECT_ID: "intellector-cfcf9",
    FIREBASE_STORAGE_BUCKET: "intellector-cfcf9.firebasestorage.app",
    FIREBASE_MESSAGING_SENDER_ID: "929985485006",
    FIREBASE_APP_ID: "1:929985485006:web:91b5badf4ae86d03df189f"
};

// ═══════════════════════════════════════
// FIREBASE INIT
// ═══════════════════════════════════════

var firebaseConfig = {
    apiKey: CONFIG.FIREBASE_API_KEY,
    authDomain: CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: CONFIG.FIREBASE_PROJECT_ID,
    storageBucket: CONFIG.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: CONFIG.FIREBASE_MESSAGING_SENDER_ID,
    appId: CONFIG.FIREBASE_APP_ID
};

console.log("🚀 Starting Intellector...");

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    console.log("✅ Firebase initialized");
} catch (error) {
    console.error("❌ Firebase error:", error);
}

var auth = firebase.auth();
var db = firebase.firestore();

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════

var currentUser = null;
var currentChatId = null;
var isBusy = false;
var currentPhase = null;
var currentStep = 1;
var conversationHistory = [];

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════

auth.onAuthStateChanged(function(user) {
    var page = document.body.getAttribute("data-page");
    console.log("👤 Auth:", user ? user.email : "Not logged in", "Page:", page);

    hideElement("loadingScreen");

    if (user) {
        currentUser = {
            id: user.uid,
            name: user.displayName || "User",
            email: user.email || "",
            picture: user.photoURL || ""
        };

        saveUserToDatabase();

        if (page === "login") {
            window.location.href = "chat.html";
            return;
        }
        if (page === "chat") {
            showElement("chatApp");
            initializeChatPage();
        }
    } else {
        currentUser = null;
        if (page === "chat") {
            window.location.href = "index.html";
            return;
        }
        if (page === "login") {
            showElement("loginContent");
        }
    }
});

function googleLogin() {
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(function(result) {
            console.log("✅ Login:", result.user.email);
        })
        .catch(function(error) {
            console.error("❌ Login error:", error);
            if (error.code === 'auth/popup-blocked') {
                auth.signInWithRedirect(provider);
            } else {
                alert("Login failed: " + error.message);
            }
        });
}

function logout() {
    auth.signOut().then(function() {
        window.location.href = "index.html";
    });
}

function saveUserToDatabase() {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.id).set({
        name: currentUser.name,
        email: currentUser.email,
        picture: currentUser.picture,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    .then(function() { console.log("✅ User saved"); })
    .catch(function(e) { console.error("❌ Save user error:", e.code, e.message); });
}

// ═══════════════════════════════════════
// INIT CHAT PAGE
// ═══════════════════════════════════════

function initializeChatPage() {
    console.log("💬 Init chat page");
    setText("userName", currentUser.name);
    setText("userEmail", currentUser.email);

    var avatarEl = document.getElementById("userAvatar");
    if (avatarEl) {
        if (currentUser.picture) {
            avatarEl.innerHTML = '<img src="' + currentUser.picture + '" alt="avatar">';
        } else {
            avatarEl.innerHTML = '<span>' + currentUser.name.charAt(0).toUpperCase() + '</span>';
        }
    }

    loadChatList();

    var input = document.getElementById("messageInput");
    if (input) input.focus();
}

// ═══════════════════════════════════════
// CHAT LIST
// ═══════════════════════════════════════

function loadChatList() {
    var listEl = document.getElementById("chatList");
    if (!listEl || !currentUser) return;

    listEl.innerHTML = '<div class="sidebar-message">Loading...</div>';

    db.collection("chats")
        .where("userId", "==", currentUser.id)
        .get()
        .then(function(snapshot) {
            var chats = [];
            snapshot.forEach(function(doc) {
                var d = doc.data();
                var ts = 0;
                if (d.updatedAt && d.updatedAt.toMillis) ts = d.updatedAt.toMillis();
                else if (d.createdAt && d.createdAt.toMillis) ts = d.createdAt.toMillis();
                chats.push({ id: doc.id, title: d.title || "New Chat", timestamp: ts });
            });

            chats.sort(function(a, b) { return b.timestamp - a.timestamp; });

            listEl.innerHTML = "";
            if (chats.length === 0) {
                listEl.innerHTML = '<div class="sidebar-message">No chats yet.<br>Start thinking!</div>';
                return;
            }

            chats.forEach(function(chat) {
                var div = document.createElement("div");
                div.className = "chat-list-item" + (chat.id === currentChatId ? " active" : "");
                div.innerHTML =
                    '<span class="chat-list-title">' + escapeHtml(chat.title) + '</span>' +
                    '<button class="chat-list-delete" onclick="event.stopPropagation(); deleteChat(\'' + chat.id + '\')" title="Delete">&times;</button>';
                div.onclick = function() { loadChat(chat.id); };
                listEl.appendChild(div);
            });
        })
        .catch(function(e) {
            console.error("❌ Load chats error:", e);
            listEl.innerHTML = '<div class="sidebar-message">Error loading chats</div>';
        });
}

// ═══════════════════════════════════════
// LOAD CHAT
// ═══════════════════════════════════════

function loadChat(chatId) {
    console.log("📂 Loading chat:", chatId);
    currentChatId = chatId;
    conversationHistory = [];

    hideElement("welcomeScreen");
    showElement("messagesContainer");

    var el = document.getElementById("messagesContainer");
    el.innerHTML = '<div class="loading-messages">Loading messages...</div>';

    closeSidebar();

    db.collection("chats").doc(chatId).collection("messages")
        .orderBy("createdAt", "asc")
        .get()
        .then(function(snapshot) {
            el.innerHTML = "";
            snapshot.forEach(function(doc) {
                var msg = doc.data();
                appendMessage(msg.role, msg.contentHtml || msg.content, true);
                conversationHistory.push({
                    role: msg.role === "user" ? "user" : "model",
                    content: msg.content
                });
            });
            scrollToBottom();
            loadChatList();
        })
        .catch(function(error) {
            console.error("❌ Load messages error:", error);
            db.collection("chats").doc(chatId).collection("messages").get()
                .then(function(snapshot) {
                    var msgs = [];
                    snapshot.forEach(function(doc) {
                        var m = doc.data();
                        m._t = (m.createdAt && m.createdAt.toMillis) ? m.createdAt.toMillis() : 0;
                        msgs.push(m);
                    });
                    msgs.sort(function(a, b) { return a._t - b._t; });

                    el.innerHTML = "";
                    msgs.forEach(function(msg) {
                        appendMessage(msg.role, msg.contentHtml || msg.content, true);
                        conversationHistory.push({
                            role: msg.role === "user" ? "user" : "model",
                            content: msg.content
                        });
                    });
                    scrollToBottom();
                });
        });
}

// ═══════════════════════════════════════
// NEW CHAT
// ═══════════════════════════════════════

function newChat() {
    currentChatId = null;
    currentPhase = null;
    currentStep = 1;
    conversationHistory = [];

    showElement("welcomeScreen");
    hideElement("messagesContainer");

    var el = document.getElementById("messagesContainer");
    if (el) el.innerHTML = "";

    loadChatList();
    closeSidebar();

    var input = document.getElementById("messageInput");
    if (input) { input.value = ""; input.focus(); }
}

// ═══════════════════════════════════════
// DELETE CHAT
// ═══════════════════════════════════════

function deleteChat(chatId) {
    if (!confirm("Delete this chat?")) return;

    db.collection("chats").doc(chatId).collection("messages").get()
        .then(function(snapshot) {
            var batch = db.batch();
            snapshot.forEach(function(doc) { batch.delete(doc.ref); });
            return batch.commit();
        })
        .then(function() {
            return db.collection("chats").doc(chatId).delete();
        })
        .then(function() {
            if (currentChatId === chatId) newChat();
            loadChatList();
        })
        .catch(function(e) { console.error("❌ Delete error:", e); });
}

// ═══════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════

function sendMessage() {
    if (isBusy) return;

    var input = document.getElementById("messageInput");
    var text = input.value.trim();
    if (!text) return;

    console.log("📤 Sending:", text.substring(0, 50));
    input.value = "";

    hideElement("welcomeScreen");
    showElement("messagesContainer");

    appendMessage("user", escapeHtml(text), false);
    showTyping();
    isBusy = true;

    conversationHistory.push({ role: "user", content: text });

    var mode = currentPhase || "general";
    var step = currentStep;

    var lowerText = text.toLowerCase();
    var phase2Tools = {
        "grammar": "Grammar Correction",
        "summarize": "Summarisation",
        "summarise": "Summarisation",
        "summary": "Summarisation",
        "critical": "Critical Evaluation",
        "evaluate": "Critical Evaluation",
        "perspective": "Perspective Analysis",
        "viewpoint": "Perspective Analysis",
        "stress test": "Stress Testing",
        "challenge": "Stress Testing",
        "counterpoint": "Stress Testing",
        "sharpen": "Language Sharpening",
        "language": "Language Sharpening",
        "restructure": "Structural Reorganisation",
        "reorganize": "Structural Reorganisation",
        "reorganise": "Structural Reorganisation",
        "structure": "Structural Reorganisation",
        "rewrite for": "Audience-Specific Rewriting",
        "adapt for": "Audience-Specific Rewriting",
        "audience": "Audience-Specific Rewriting"
    };

    var detectedTool = null;
    Object.keys(phase2Tools).forEach(function(keyword) {
        if (lowerText.includes(keyword)) {
            detectedTool = phase2Tools[keyword];
        }
    });

    if (detectedTool && conversationHistory.length > 2) {
        mode = "phase2";
        step = detectedTool;
    }

    var createStep;
    if (!currentChatId) {
        var title = text.substring(0, 50) + (text.length > 50 ? "..." : "");
        createStep = db.collection("chats").add({
            userId: currentUser.id,
            title: title,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function(ref) {
            currentChatId = ref.id;
            console.log("✅ Chat created:", currentChatId);
        });
    } else {
        createStep = Promise.resolve();
    }

    createStep
    .then(function() {
        return db.collection("chats").doc(currentChatId).collection("messages").add({
            role: "user",
            content: text,
            contentHtml: "<p>" + escapeHtml(text) + "</p>",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    })
    .then(function() {
        return callAI(text, mode, step);
    })
    .then(function(aiText) {
        hideTyping();
        var aiHtml = convertMarkdown(aiText);
        appendMessage("ai", aiHtml, true);

        conversationHistory.push({ role: "model", content: aiText });

        return db.collection("chats").doc(currentChatId).collection("messages").add({
            role: "ai",
            content: aiText,
            contentHtml: aiHtml,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    })
    .then(function() {
        return db.collection("chats").doc(currentChatId).update({
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    })
    .then(function() {
        isBusy = false;
        scrollToBottom();
        loadChatList();
    })
    .catch(function(error) {
        hideTyping();
        isBusy = false;
        console.error("❌ Error:", error);
        appendMessage("ai", '<p style="color: #ff6b6b;">❌ Error: ' + escapeHtml(error.message || "Something went wrong") + '</p>', true);
    });
}

// ═══════════════════════════════════════
// CALL AI
// ═══════════════════════════════════════

function callAI(prompt, mode, step) {
    console.log("🤖 Calling AI | Mode:", mode, "| Step:", step);

    var recentHistory = conversationHistory.slice(-10);

    return fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: prompt,
            mode: mode || "general",
            phase: currentPhase,
            step: step || currentStep,
            conversationHistory: recentHistory
        })
    })
    .then(function(response) {
        return response.json().then(function(data) {
            if (!response.ok) {
                throw new Error(data.error || "API error " + response.status);
            }
            return data;
        });
    })
    .then(function(data) {
        if (!data.text) throw new Error("Empty AI response");
        console.log("✅ AI responded");
        return data.text;
    });
}

// ═══════════════════════════════════════
// REFINEMENT TOOLS
// ═══════════════════════════════════════

function useRefinementTool(toolName) {
    var input = document.getElementById("messageInput");
    if (input) {
        input.value = "Apply " + toolName + " to the previous response";
        sendMessage();
    }
}

// ═══════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════

function appendMessage(role, content, isHtml) {
    var container = document.getElementById("messagesContainer");
    if (!container) return;

    var div = document.createElement("div");
    div.className = "message " + role;

    var avatarText = role === "user" ? "You" : "IN";
    var nameText = role === "user" ? "You" : "Intellector";
    var bodyContent = isHtml ? content : "<p>" + content + "</p>";

    var toolsHtml = "";
    if (role === "ai" && conversationHistory.length >= 2) {
        toolsHtml = '<div class="refinement-tools">' +
            '<div class="tools-label">📐 Refinement Tools (Phase II):</div>' +
            '<div class="tools-grid">' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Grammar Correction\')">✏️ Grammar</button>' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Summarisation\')">📝 Summarize</button>' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Critical Evaluation\')">🔍 Evaluate</button>' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Perspective Analysis\')">👁️ Perspectives</button>' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Stress Testing\')">💪 Stress Test</button>' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Language Sharpening\')">✨ Sharpen</button>' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Structural Reorganisation\')">🏗️ Restructure</button>' +
                '<button class="tool-btn" onclick="useRefinementTool(\'Audience-Specific Rewriting\')">🎯 Rewrite</button>' +
            '</div>' +
            '<div class="protection-line">🛡️ All refinements preserve your core argument</div>' +
        '</div>';
    }

    div.innerHTML =
        '<div class="message-inner">' +
            '<div class="message-avatar">' + avatarText + '</div>' +
            '<div class="message-body">' +
                '<div class="message-name">' + nameText + '</div>' +
                '<div class="message-text">' + bodyContent + '</div>' +
                toolsHtml +
            '</div>' +
        '</div>';

    container.appendChild(div);
    scrollToBottom();
}

function showTyping() {
    var container = document.getElementById("messagesContainer");
    if (!container) return;
    var div = document.createElement("div");
    div.className = "message ai";
    div.id = "typingIndicator";
    div.innerHTML =
        '<div class="message-inner">' +
            '<div class="message-avatar">IN</div>' +
            '<div class="message-body">' +
                '<div class="message-name">Intellector</div>' +
                '<div class="typing-dots"><span></span><span></span><span></span></div>' +
            '</div>' +
        '</div>';
    container.appendChild(div);
    scrollToBottom();
}

function hideTyping() {
    var el = document.getElementById("typingIndicator");
    if (el) el.remove();
}

function scrollToBottom() {
    var c = document.getElementById("messagesContainer");
    if (c) setTimeout(function() { c.scrollTop = c.scrollHeight; }, 50);
}

function showElement(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "flex";
}

function hideElement(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
}

function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function convertMarkdown(text) {
    if (!text) return '<p>No response</p>';

    var html = text
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    return '<div class="ai-content"><p>' + html + '</p></div>';
}

// ═══════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════

function toggleSidebar() {
    var s = document.getElementById("sidebar");
    if (s) s.classList.toggle("open");
}

function closeSidebar() {
    var s = document.getElementById("sidebar");
    if (s) s.classList.remove("open");
}

// ═══════════════════════════════════════
// KEYBOARD
// ═══════════════════════════════════════

function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// ═══════════════════════════════════════
// QUICK START
// ═══════════════════════════════════════

function quickStart(text) {
    var input = document.getElementById("messageInput");
    if (input) {
        input.value = text;
        sendMessage();
    }
}

console.log("✅ Intellector loaded — Think First. Then Instruct.");