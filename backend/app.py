from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import requests as req
import uuid
import time

app = Flask(__name__)
CORS(app, origins="*")

# ============================================
#  IN-MEMORY STORAGE (no database)
# ============================================
chats = {}  # { chat_id: { title, messages[], exchange_count, category, understanding } }

OLLAMA_URL = "http://localhost:11434"
MODEL_NAME = "phi4-mini-reasoning"


# ============================================
#  AUTO DETECT MODEL
# ============================================
def find_model():
    global MODEL_NAME
    try:
        resp = req.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        models = [m['name'] for m in resp.json().get('models', [])]
        print(f"[OLLAMA] Available models: {models}")

        if not models:
            print("[OLLAMA] No models found!")
            return

        for m in models:
            if 'phi' in m.lower():
                MODEL_NAME = m
                print(f"[OLLAMA] Using: {MODEL_NAME}")
                return

        MODEL_NAME = models[0]
        print(f"[OLLAMA] Defaulting to: {MODEL_NAME}")

    except Exception as e:
        print(f"[OLLAMA] Cannot connect: {e}")


# ============================================
#  OLLAMA COMMUNICATION
# ============================================
def ask_ollama(prompt, max_tokens=1024):
    try:
        print(f"[OLLAMA] Sending request...")
        start = time.time()

        response = req.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": max_tokens
                }
            },
            timeout=300
        )

        elapsed = time.time() - start
        print(f"[OLLAMA] Response in {elapsed:.1f}s")

        if response.status_code != 200:
            print(f"[OLLAMA] Error: {response.text[:200]}")
            return f"Model error: {response.text[:200]}"

        answer = response.json().get('response', '')
        if not answer:
            return "Empty response from model. Try again."

        print(f"[OLLAMA] Got: {answer[:80]}...")
        return answer

    except req.exceptions.ConnectionError:
        return "Cannot connect to Ollama. Make sure to run: ollama serve"
    except req.exceptions.Timeout:
        return "Model timed out. Try again."
    except Exception as e:
        return f"Error: {str(e)}"


# ============================================
#  INTELLECTOR LOGIC
# ============================================
def classify_question(question):
    prompt = f"""Classify this question. Reply with ONE word ONLY.

FACTUAL = simple facts, definitions, full forms, dates, names, direct lookups
INTELLECTUAL = reasoning, understanding, concepts, how/why, problem-solving

Question: "{question}"

One word answer:"""

    result = ask_ollama(prompt, 20)
    category = 'factual' if 'FACTUAL' in result.upper() else 'intellectual'
    print(f"[CLASSIFY] {category}")
    return category


def make_title(message):
    prompt = f"""Write a 3-5 word title for this topic. Reply with ONLY the title, nothing else.

Topic: "{message}"

Title:"""

    title = ask_ollama(prompt, 20)
    title = title.strip().strip('"\'*#').split('\n')[0].strip()
    if len(title) < 2 or len(title) > 50:
        return message[:40]
    return title


def assess_understanding(history):
    convo = ""
    for msg in history[-6:]:
        convo += f"{msg['role'].upper()}: {msg['content']}\n\n"

    prompt = f"""Rate this student's understanding from 0 to 5.

{convo}

Reply in this exact format:
SCORE: [number 0-5]
READY: [YES or NO]"""

    result = ask_ollama(prompt, 30)

    score = 2
    ready = False

    for line in result.split('\n'):
        if 'SCORE' in line.upper():
            digits = ''.join(c for c in line if c.isdigit())
            if digits:
                score = min(5, max(0, int(digits[0])))
        if 'READY' in line.upper():
            ready = 'YES' in line.upper()

    print(f"[ASSESS] Score: {score}/5, Ready: {ready}")
    return score, ready


def generate_response(question, history, exchange_count, understanding, category):
    convo = ""
    for msg in history[-8:]:
        role = "Student" if msg['role'] == 'user' else "Teacher"
        convo += f"{role}: {msg['content']}\n\n"

    # === FACTUAL: Direct answer ===
    if category == 'factual':
        prompt = f"""You are Intellector, a helpful AI assistant.
Give a clear, accurate, direct answer. Use markdown formatting.

{f"Previous conversation:{chr(10)}{convo}" if len(history) > 1 else ""}

Question: {question}

Answer:"""
        return ask_ollama(prompt)

    # === INTELLECTUAL: Socratic teaching ===
    if exchange_count == 0:
        prompt = f"""You are Intellector, an AI teacher using the Socratic method.

A student asked: "{question}"

This is the FIRST exchange. Your rules:
1. Show enthusiasm for their question
2. Do NOT give the direct answer
3. Ask what they already know about this topic
4. Give a real-world analogy or scenario to think about
5. Ask 1-2 guiding questions to start their thinking
6. Be warm and encouraging
7. Use markdown formatting
8. Keep response concise

Your response:"""

    elif exchange_count <= 2 and understanding < 3:
        prompt = f"""You are Intellector, an AI Socratic teacher.

CONVERSATION SO FAR:
{convo}

Student's latest message: "{question}"
Understanding level: {understanding}/5

STRATEGY - Early exchange, building basics:
1. Build on what they shared
2. Gently correct any wrong ideas
3. Give ONE helpful analogy or partial explanation
4. Do NOT give the complete answer yet
5. Ask a guiding question to push thinking forward
6. Be encouraging, use markdown

Your response:"""

    elif exchange_count <= 4 and understanding < 4:
        prompt = f"""You are Intellector, an AI Socratic teacher.

CONVERSATION SO FAR:
{convo}

Student's latest message: "{question}"
Understanding level: {understanding}/5
Exchange: {exchange_count}

STRATEGY - Mid conversation, deepening understanding:
1. Acknowledge their growing understanding
2. Fill specific knowledge gaps with more detail
3. Connect different concepts together
4. Can reveal more details now
5. Ask them to explain their understanding
6. Use examples, be warm, use markdown

Your response:"""

    else:
        prompt = f"""You are Intellector, an AI teacher.

CONVERSATION SO FAR:
{convo}

Student's latest message: "{question}"
Understanding level: {understanding}/5
Exchanges: {exchange_count}

STRATEGY - Time to reveal:
1. The student has engaged enough - give the COMPLETE answer now
2. Reference insights from your conversation
3. Explain the full concept clearly and thoroughly
4. Show how their thinking was on the right track
5. Summarize key concepts
6. Suggest related topics to explore
7. End with encouragement
8. Use markdown, be thorough

Your response:"""

    return ask_ollama(prompt)


# ============================================
#  API ROUTES
# ============================================

@app.route('/api/health', methods=['GET'])
def health():
    try:
        resp = req.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        models = [m['name'] for m in resp.json().get('models', [])]
        status = "connected"
    except Exception:
        models = []
        status = "disconnected"

    return jsonify({
        'status': 'running',
        'ollama': status,
        'model': MODEL_NAME,
        'available_models': models,
        'active_chats': len(chats)
    })


@app.route('/api/chats', methods=['GET'])
def get_chats():
    chat_list = []
    for cid, chat in chats.items():
        chat_list.append({
            'id': cid,
            'title': chat['title'],
            'created_at': chat['created_at'],
            'updated_at': chat['updated_at'],
            'exchange_count': chat['exchange_count'],
            'topic_category': chat['category'],
            'user_understanding_level': chat['understanding'],
            'ready_for_answer': chat['ready'],
            'message_count': len(chat['messages'])
        })

    # Sort by updated time descending
    chat_list.sort(key=lambda x: x['updated_at'], reverse=True)
    return jsonify(chat_list)


@app.route('/api/chats', methods=['POST'])
def create_chat():
    data = request.json or {}
    cid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    chats[cid] = {
        'title': data.get('title', 'New Chat'),
        'messages': [],
        'exchange_count': 0,
        'category': 'unknown',
        'understanding': 0,
        'ready': False,
        'created_at': now,
        'updated_at': now
    }

    print(f"[CHAT] Created: {cid}")

    return jsonify({
        'id': cid,
        'title': chats[cid]['title'],
        'created_at': now,
        'updated_at': now,
        'exchange_count': 0,
        'topic_category': 'unknown',
        'user_understanding_level': 0,
        'ready_for_answer': False,
        'message_count': 0
    }), 201


@app.route('/api/chats/<cid>', methods=['GET'])
def get_chat(cid):
    if cid not in chats:
        return jsonify({'error': 'Chat not found'}), 404

    chat = chats[cid]
    return jsonify({
        'id': cid,
        'title': chat['title'],
        'created_at': chat['created_at'],
        'updated_at': chat['updated_at'],
        'exchange_count': chat['exchange_count'],
        'topic_category': chat['category'],
        'user_understanding_level': chat['understanding'],
        'ready_for_answer': chat['ready'],
        'messages': [{
            'id': str(i),
            'chat_id': cid,
            'role': m['role'],
            'content': m['content'],
            'created_at': m['time']
        } for i, m in enumerate(chat['messages'])]
    })


@app.route('/api/chats/<cid>', methods=['DELETE'])
def delete_chat(cid):
    if cid in chats:
        del chats[cid]
    return jsonify({'message': 'Deleted'})


@app.route('/api/chats/<cid>/rename', methods=['PUT'])
def rename_chat(cid):
    if cid not in chats:
        return jsonify({'error': 'Not found'}), 404
    data = request.json or {}
    chats[cid]['title'] = data.get('title', chats[cid]['title'])
    return jsonify({'id': cid, 'title': chats[cid]['title']})


# ============ MAIN MESSAGE ENDPOINT ============

@app.route('/api/chats/<cid>/message', methods=['POST'])
def send_message(cid):
    if cid not in chats:
        return jsonify({'error': 'Chat not found'}), 404

    data = request.json or {}
    user_text = data.get('content', '').strip()
    if not user_text:
        return jsonify({'error': 'Empty message'}), 400

    chat = chats[cid]
    now = datetime.utcnow().isoformat()

    print(f"\n{'='*50}")
    print(f"[MSG] Chat: {cid[:8]}...")
    print(f"[MSG] User: {user_text[:60]}")
    print(f"[MSG] Exchange: {chat['exchange_count']}")
    print(f"[MSG] Category: {chat['category']}")

    # Save user message
    chat['messages'].append({
        'role': 'user',
        'content': user_text,
        'time': now
    })

    # Build history for context
    history = [{'role': m['role'], 'content': m['content']}
               for m in chat['messages']]

    # FIRST MESSAGE: Classify + Title
    if chat['exchange_count'] == 0:
        print("[MSG] First message - classifying...")
        chat['category'] = classify_question(user_text)

        print("[MSG] Generating title...")
        chat['title'] = make_title(user_text)
        print(f"[MSG] Category: {chat['category']}, Title: {chat['title']}")

    # ASSESS UNDERSTANDING (after first exchange, intellectual only)
    if chat['category'] == 'intellectual' and chat['exchange_count'] > 0:
        print("[MSG] Assessing understanding...")
        score, ready = assess_understanding(history)
        chat['understanding'] = score
        chat['ready'] = ready

    # GENERATE RESPONSE
    print("[MSG] Generating response (may take 30-120s)...")
    ai_text = generate_response(
        user_text,
        history,
        chat['exchange_count'],
        chat['understanding'],
        chat['category']
    )

    # Save AI message
    ai_now = datetime.utcnow().isoformat()
    chat['messages'].append({
        'role': 'assistant',
        'content': ai_text,
        'time': ai_now
    })

    # Update chat state
    chat['exchange_count'] += 1
    chat['updated_at'] = ai_now

    print(f"[MSG] Done! Response: {len(ai_text)} chars")
    print(f"{'='*50}\n")

    return jsonify({
        'user_message': {
            'id': str(uuid.uuid4()),
            'chat_id': cid,
            'role': 'user',
            'content': user_text,
            'created_at': now
        },
        'assistant_message': {
            'id': str(uuid.uuid4()),
            'chat_id': cid,
            'role': 'assistant',
            'content': ai_text,
            'created_at': ai_now
        },
        'chat': {
            'id': cid,
            'title': chat['title'],
            'created_at': chat['created_at'],
            'updated_at': chat['updated_at'],
            'exchange_count': chat['exchange_count'],
            'topic_category': chat['category'],
            'user_understanding_level': chat['understanding'],
            'ready_for_answer': chat['ready'],
            'message_count': len(chat['messages'])
        }
    })


# Dummy projects endpoints (frontend expects them)
@app.route('/api/projects', methods=['GET'])
def get_projects():
    return jsonify([])


@app.route('/api/projects', methods=['POST'])
def create_project():
    return jsonify({'id': '0', 'name': 'Default', 'chat_count': 0}), 201


# ============================================
#  START
# ============================================
if __name__ == '__main__':
    print("")
    print("=" * 50)
    print("  INTELLECTOR - Backend Server")
    print("  No database - in-memory only")
    print("=" * 50)

    find_model()

    print(f"  Model:   {MODEL_NAME}")
    print(f"  Server:  http://localhost:5000")
    print(f"  Health:  http://localhost:5000/api/health")
    print("=" * 50)
    print("")

    app.run(debug=True, port=5000, host='0.0.0.0')