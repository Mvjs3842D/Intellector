// ══════════════════════════════════════════════════════════════
//
//   INTELLECTOR — COMPLETE APPLICATION
//
//   ⚠️ EDIT LINES 10-21 WITH YOUR OWN KEYS ⚠️
//
// ══════════════════════════════════════════════════════════════


// ╔════════════════════════════════════════════════════════════╗
// ║                                                            ║
// ║   🔑 YOUR CONFIGURATION — EDIT THESE VALUES 🔑            ║
// ║                                                            ║
// ╚════════════════════════════════════════════════════════════╝

var CONFIG = {
    // Firebase Config — Get from Firebase Console → Project Settings → Your Apps
    FIREBASE_API_KEY: "AIzaSyBfzFKgfyHof1lx_m7WHhf5C1v1T8-9aqs",
    FIREBASE_AUTH_DOMAIN: "intellector-cfcf9.firebaseapp.com",
    FIREBASE_PROJECT_ID: "intellector-cfcf9",
    FIREBASE_STORAGE_BUCKET: "intellector-cfcf9.firebasestorage.app",
    FIREBASE_MESSAGING_SENDER_ID: "929985485006",
    FIREBASE_APP_ID: "1:929985485006:web:91b5badf4ae86d03df189f",

    // Gemini API Key — Get from https://aistudio.google.com/app/apikey
    GEMINI_API_KEY: "AIzaSyBNaqFIVkSoOEB8x07mzAAkElxbMnyxRaA"
};

// ══════════════════════════════════════════════════════════════
//   DO NOT EDIT BELOW THIS LINE
// ══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════
// FIREBASE INITIALIZATION
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
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase initialized");
} catch (error) {
    console.error("❌ Firebase error:", error);
    alert("Firebase configuration error. Check your config in app.js");
}

var auth = firebase.auth();
var db = firebase.firestore();


// ═══════════════════════════════════════
// USER STATE
// ═══════════════════════════════════════

var currentUser = null;
var currentChatId = null;
var isBusy = false;


// ═══════════════════════════════════════
// AUTH STATE LISTENER
// ═══════════════════════════════════════

auth.onAuthStateChanged(function(user) {
    var page = document.body.getAttribute("data-page");
    
    console.log("👤 Auth state:", user ? user.email : "Not logged in");
    console.log("📄 Page:", page);

    // Hide loading screen
    hideElement("loadingScreen");

    if (user) {
        // User IS logged in
        currentUser = {
            id: user.uid,
            name: user.displayName || "User",
            email: user.email || "",
            picture: user.photoURL || ""
        };

        // Save user to database
        saveUserToDatabase();

        if (page === "login") {
            // Redirect to chat
            window.location.href = "chat.html";
            return;
        }

        if (page === "chat") {
            // Show chat app
            showElement("chatApp");
            initializeChatPage();
        }

    } else {
        // User is NOT logged in
        currentUser = null;

        if (page === "chat") {
            // Redirect to login
            window.location.href = "index.html";
            return;
        }

        if (page === "login") {
            // Show login button
            showElement("loginContent");
        }
    }
});


// ═══════════════════════════════════════
// GOOGLE LOGIN
// ═══════════════════════════════════════

function googleLogin() {
    console.log("🔐 Starting Google login...");
    
    var provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .then(function(result) {
            console.log("✅ Login successful:", result.user.email);
        })
        .catch(function(error) {
            console.error("❌ Login error:", error);
            alert("Login failed: " + error.message);
        });
}


// ═══════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════

function logout() {
    console.log("🚪 Logging out...");
    auth.signOut().then(function() {
        window.location.href = "index.html";
    });
}


// ═══════════════════════════════════════
// SAVE USER TO DATABASE
// ═══════════════════════════════════════

function saveUserToDatabase() {
    if (!currentUser) return;
    
    db.collection("users").doc(currentUser.id).set({
        name: currentUser.name,
        email: currentUser.email,
        picture: currentUser.picture,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    .then(function() {
        console.log("✅ User saved to database");
    })
    .catch(function(error) {
        console.error("❌ Error saving user:", error);
    });
}


// ═══════════════════════════════════════
// INITIALIZE CHAT PAGE
// ═══════════════════════════════════════

function initializeChatPage() {
    console.log("💬 Initializing chat page...");
    
    // Show user info
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
    
    // Load chat history
    loadChatList();
    
    // Focus input
    var input = document.getElementById("messageInput");
    if (input) input.focus();
}


// ═══════════════════════════════════════
// LOAD CHAT LIST (Sidebar)
// ═══════════════════════════════════════

function loadChatList() {
    var listEl = document.getElementById("chatList");
    if (!listEl) return;
    
    listEl.innerHTML = '<div class="sidebar-message">Loading chats...</div>';
    
    db.collection("chats")
        .where("userId", "==", currentUser.id)
        .get()
        .then(function(snapshot) {
            var chats = [];
            
            snapshot.forEach(function(doc) {
                var data = doc.data();
                var timestamp = data.updatedAt ? data.updatedAt.toMillis() : 0;
                chats.push({
                    id: doc.id,
                    title: data.title || "New Chat",
                    timestamp: timestamp
                });
            });
            
            // Sort by newest first
            chats.sort(function(a, b) {
                return b.timestamp - a.timestamp;
            });
            
            // Render list
            listEl.innerHTML = "";
            
            if (chats.length === 0) {
                listEl.innerHTML = '<div class="sidebar-message">No chats yet.<br>Start a conversation!</div>';
                return;
            }
            
            chats.forEach(function(chat) {
                var div = document.createElement("div");
                div.className = "chat-list-item" + (chat.id === currentChatId ? " active" : "");
                div.innerHTML = 
                    '<span class="chat-list-title">' + escapeHtml(chat.title) + '</span>' +
                    '<button class="chat-list-delete" onclick="event.stopPropagation(); deleteChat(\'' + chat.id + '\')" title="Delete">×</button>';
                div.onclick = function() {
                    loadChat(chat.id);
                };
                listEl.appendChild(div);
            });
            
            console.log("✅ Loaded " + chats.length + " chats");
        })
        .catch(function(error) {
            console.error("❌ Error loading chats:", error);
            listEl.innerHTML = '<div class="sidebar-message">Error loading chats</div>';
        });
}


// ═══════════════════════════════════════
// LOAD A SPECIFIC CHAT
// ═══════════════════════════════════════

function loadChat(chatId) {
    console.log("📂 Loading chat:", chatId);
    
    currentChatId = chatId;
    
    hideElement("welcomeScreen");
    showElement("messagesContainer");
    
    var messagesEl = document.getElementById("messagesContainer");
    messagesEl.innerHTML = '<div class="loading-messages">Loading messages...</div>';
    
    closeSidebar();
    
    db.collection("chats").doc(chatId).collection("messages")
        .orderBy("createdAt", "asc")
        .get()
        .then(function(snapshot) {
            messagesEl.innerHTML = "";
            
            snapshot.forEach(function(doc) {
                var msg = doc.data();
                appendMessage(msg.role, msg.contentHtml || msg.content, true);
            });
            
            scrollToBottom();
            loadChatList();
        })
        .catch(function(error) {
            console.error("❌ Error loading messages:", error);
            
            // Try without orderBy (in case no index)
            db.collection("chats").doc(chatId).collection("messages")
                .get()
                .then(function(snapshot) {
                    messagesEl.innerHTML = "";
                    snapshot.forEach(function(doc) {
                        var msg = doc.data();
                        appendMessage(msg.role, msg.contentHtml || msg.content, true);
                    });
                    scrollToBottom();
                });
        });
}


// ═══════════════════════════════════════
// NEW CHAT
// ═══════════════════════════════════════

function newChat() {
    console.log("🆕 Starting new chat");
    
    currentChatId = null;
    
    showElement("welcomeScreen");
    hideElement("messagesContainer");
    
    var messagesEl = document.getElementById("messagesContainer");
    if (messagesEl) messagesEl.innerHTML = "";
    
    loadChatList();
    closeSidebar();
    
    var input = document.getElementById("messageInput");
    if (input) {
        input.value = "";
        input.focus();
    }
}


// ═══════════════════════════════════════
// DELETE CHAT
// ═══════════════════════════════════════

function deleteChat(chatId) {
    if (!confirm("Delete this chat?")) return;
    
    console.log("🗑️ Deleting chat:", chatId);
    
    // Delete all messages first
    db.collection("chats").doc(chatId).collection("messages")
        .get()
        .then(function(snapshot) {
            var batch = db.batch();
            snapshot.forEach(function(doc) {
                batch.delete(doc.ref);
            });
            return batch.commit();
        })
        .then(function() {
            // Delete the chat document
            return db.collection("chats").doc(chatId).delete();
        })
        .then(function() {
            console.log("✅ Chat deleted");
            if (currentChatId === chatId) {
                newChat();
            }
            loadChatList();
        })
        .catch(function(error) {
            console.error("❌ Error deleting chat:", error);
        });
}


// ═══════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════

function sendMessage() {
    if (isBusy) return;
    
    var input = document.getElementById("messageInput");
    var text = input.value.trim();
    
    if (!text) return;
    
    console.log("📤 Sending message:", text.substring(0, 50) + "...");
    
    input.value = "";
    
    // Show messages area
    hideElement("welcomeScreen");
    showElement("messagesContainer");
    
    // Show user message
    appendMessage("user", escapeHtml(text), false);
    
    // Show typing indicator
    showTyping();
    
    isBusy = true;
    
    // Create chat if needed
    var chatPromise;
    
    if (!currentChatId) {
        var title = text.substring(0, 50) + (text.length > 50 ? "..." : "");
        
        chatPromise = db.collection("chats").add({
            userId: currentUser.id,
            title: title,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function(docRef) {
            currentChatId = docRef.id;
            console.log("✅ Created chat:", currentChatId);
            return currentChatId;
        });
    } else {
        chatPromise = Promise.resolve(currentChatId);
    }
    
    chatPromise
        .then(function(chatId) {
            // Save user message
            return db.collection("chats").doc(chatId).collection("messages").add({
                role: "user",
                content: text,
                contentHtml: "<p>" + escapeHtml(text) + "</p>",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(function() {
            // Call Gemini API
            return callGemini(text);
        })
        .then(function(aiResponse) {
            hideTyping();
            
            var aiHtml = convertMarkdown(aiResponse);
            appendMessage("ai", aiHtml, true);
            
            // Save AI message
            return db.collection("chats").doc(currentChatId).collection("messages").add({
                role: "ai",
                content: aiResponse,
                contentHtml: aiHtml,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(function() {
            // Update chat timestamp
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
            appendMessage("ai", '<p style="color: #ff6b6b;">Error: ' + error.message + '</p>', true);
        });
}


// ═══════════════════════════════════════
// CALL GEMINI API
// ═══════════════════════════════════════

function callGemini(prompt) {
    console.log("🤖 Calling Gemini API...");
    
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + CONFIG.GEMINI_API_KEY;
    
    var body = {
        contents: [{
            parts: [{
                text: "You are Intellector, a helpful AI assistant. Answer clearly and helpfully.\n\nUser: " + prompt
            }]
        }]
    };
    
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.error) {
            throw new Error(data.error.message || "Gemini API error");
        }
        
        var text = data.candidates[0].content.parts[0].text;
        console.log("✅ Gemini response received");
        return text;
    });
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
    
    div.innerHTML = 
        '<div class="message-inner">' +
            '<div class="message-avatar">' + avatarText + '</div>' +
            '<div class="message-body">' +
                '<div class="message-name">' + nameText + '</div>' +
                '<div class="message-text">' + bodyContent + '</div>' +
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
    var container = document.getElementById("messagesContainer");
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
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
    // Simple markdown conversion
    var html = text
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    return '<p>' + html + '</p>';
}


// ═══════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════

function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("open");
    }
}

function closeSidebar() {
    var sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.remove("open");
    }
}


// ═══════════════════════════════════════
// KEYBOARD HANDLING
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


// ═══════════════════════════════════════
// LOG READY
// ═══════════════════════════════════════

console.log("✅ Intellector app.js loaded");