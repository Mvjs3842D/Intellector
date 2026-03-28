"""
AI Chatbot Web Application
Built with Streamlit and Google Gemini API
Author: Senior Python Developer
Version: 1.0.0
Description: A professional chatbot interface that leverages Google's Gemini AI
             model to provide intelligent, conversational responses.
"""

# ============================================================================
# IMPORTS
# ============================================================================
import os
import time
import streamlit as st
import google.generativeai as genai
from dotenv import load_dotenv

# ============================================================================
# CONFIGURATION & INITIALIZATION
# ============================================================================

# Load environment variables from .env file (for local development)
load_dotenv()

# --- Page Configuration ---
# Must be the first Streamlit command
st.set_page_config(
    page_title="AI Chatbot | Powered by Gemini",
    page_icon="🤖",
    layout="centered",
    initial_sidebar_state="expanded",
)

# --- Constants ---
# System instruction that guides the AI's behavior and response style
SYSTEM_INSTRUCTION = """
You are a highly knowledgeable, friendly, and professional AI assistant. 
Follow these guidelines strictly for every response:

1. **Clarity**: Provide clear, concise, and well-structured answers.
2. **Formatting**: Use bullet points, numbered lists, headers, and code blocks 
   where appropriate to improve readability.
3. **Accuracy**: If you're unsure about something, explicitly state that rather 
   than guessing or fabricating information.
4. **Tone**: Maintain a warm, professional, and approachable tone throughout.
5. **Completeness**: Address all parts of the user's question thoroughly.
6. **Examples**: Provide practical examples when they help explain concepts.
7. **Context Awareness**: Remember and reference earlier parts of the conversation 
   when relevant.
8. **Safety**: Decline requests for harmful, unethical, or illegal content politely.
"""

# Model configuration parameters
GENERATION_CONFIG = {
    "temperature": 0.7,        # Controls randomness (0=deterministic, 1=creative)
    "top_p": 0.95,             # Nucleus sampling threshold
    "top_k": 40,               # Top-k sampling parameter
    "max_output_tokens": 8192, # Maximum response length
}

# Safety settings to filter harmful content
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]


# ============================================================================
# CUSTOM CSS STYLING
# ============================================================================
def apply_custom_css():
    """Apply custom CSS styles for a polished, modern chat interface."""
    st.markdown("""
    <style>
        /* ---- Main Container Styling ---- */
        .main .block-container {
            padding-top: 2rem;
            padding-bottom: 2rem;
            max-width: 800px;
        }
        
        /* ---- Header Styling ---- */
        .main-header {
            text-align: center;
            padding: 1.5rem 0;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .main-header h1 {
            margin: 0;
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .main-header p {
            margin: 0.5rem 0 0 0;
            font-size: 1rem;
            opacity: 0.9;
        }
        
        /* ---- Chat Message Styling ---- */
        .stChatMessage {
            border-radius: 12px;
            margin-bottom: 0.75rem;
            padding: 0.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        /* ---- Sidebar Styling ---- */
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
        }
        
        [data-testid="stSidebar"] .block-container {
            padding-top: 2rem;
        }
        
        /* ---- Sidebar Header ---- */
        .sidebar-header {
            text-align: center;
            padding: 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            color: white;
            margin-bottom: 1.5rem;
        }
        
        .sidebar-header h2 {
            margin: 0;
            font-size: 1.3rem;
        }
        
        /* ---- Info Box Styling ---- */
        .info-box {
            background: white;
            border-radius: 10px;
            padding: 1rem;
            margin: 0.75rem 0;
            border-left: 4px solid #667eea;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .info-box h4 {
            margin: 0 0 0.5rem 0;
            color: #333;
        }
        
        .info-box p, .info-box li {
            color: #555;
            font-size: 0.9rem;
            margin: 0.25rem 0;
        }
        
        /* ---- Stats Box ---- */
        .stats-box {
            background: white;
            border-radius: 10px;
            padding: 1rem;
            margin: 0.75rem 0;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .stats-number {
            font-size: 2rem;
            font-weight: 700;
            color: #667eea;
        }
        
        .stats-label {
            font-size: 0.85rem;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* ---- Button Styling ---- */
        .stButton > button {
            width: 100%;
            border-radius: 8px;
            font-weight: 600;
            padding: 0.5rem 1rem;
            transition: all 0.3s ease;
        }
        
        /* ---- Footer Styling ---- */
        .footer {
            text-align: center;
            padding: 1rem;
            color: #888;
            font-size: 0.8rem;
            margin-top: 2rem;
            border-top: 1px solid #eee;
        }
        
        /* ---- Welcome Message ---- */
        .welcome-container {
            text-align: center;
            padding: 3rem 1rem;
            color: #888;
        }
        
        .welcome-container .emoji {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        
        .welcome-container h3 {
            color: #555;
            margin-bottom: 0.5rem;
        }
        
        .welcome-container p {
            color: #888;
            max-width: 400px;
            margin: 0 auto;
        }
        
        /* ---- Suggestion Chips ---- */
        .suggestion-chip {
            display: inline-block;
            background: linear-gradient(135deg, #667eea20, #764ba220);
            border: 1px solid #667eea40;
            border-radius: 20px;
            padding: 0.4rem 1rem;
            margin: 0.25rem;
            font-size: 0.85rem;
            color: #555;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .suggestion-chip:hover {
            background: linear-gradient(135deg, #667eea40, #764ba240);
            transform: translateY(-1px);
        }
        
        /* ---- Hide Streamlit Branding ---- */
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        header {visibility: hidden;}
    </style>
    """, unsafe_allow_html=True)


# ============================================================================
# API & MODEL INITIALIZATION
# ============================================================================
def initialize_gemini_model():
    """
    Initialize and return the Google Gemini generative model.
    
    Returns:
        genai.GenerativeModel: Configured Gemini model instance.
        
    Raises:
        ValueError: If the API key is not found in environment variables.
        Exception: If model initialization fails for any other reason.
    """
    # Retrieve API key from environment variables
    api_key = os.getenv("GEMINI_API_KEY")
    
    # Validate API key exists
    if not api_key:
        raise ValueError(
            "🔑 GEMINI_API_KEY not found in environment variables.\n\n"
            "**Local Setup:**\n"
            "1. Create a `.env` file in the project root\n"
            "2. Add: `GEMINI_API_KEY=your_api_key_here`\n\n"
            "**Render Deployment:**\n"
            "1. Go to your Render service dashboard\n"
            "2. Navigate to Environment → Add `GEMINI_API_KEY`\n\n"
            "Get your API key at: https://makersuite.google.com/app/apikey"
        )
    
    # Validate API key format (basic check)
    if len(api_key.strip()) < 10:
        raise ValueError(
            "🔑 The GEMINI_API_KEY appears to be invalid (too short).\n"
            "Please check your API key and try again."
        )
    
    # Configure the Google Generative AI library with the API key
    genai.configure(api_key=api_key.strip())
    
    # Create and return the model with system instructions
    model = genai.GenerativeModel(
        model_name="gemini-pro",
        generation_config=GENERATION_CONFIG,
        safety_settings=SAFETY_SETTINGS,
    )
    
    return model


def get_gemini_response(model, chat_history, user_message):
    """
    Send a message to Gemini and get a response, including conversation context.
    
    Args:
        model: The initialized Gemini model instance.
        chat_history: List of previous chat messages for context.
        user_message: The current user message to process.
        
    Returns:
        str: The AI-generated response text.
        
    Raises:
        Exception: If the API call fails or returns an invalid response.
    """
    try:
        # Build the conversation history for context
        # Include system instruction as the first message for context
        history_for_api = []
        
        # Add previous messages as context (limit to last 20 for performance)
        recent_history = chat_history[-20:] if len(chat_history) > 20 else chat_history
        
        for msg in recent_history:
            role = "user" if msg["role"] == "user" else "model"
            history_for_api.append({
                "role": role,
                "parts": [msg["content"]]
            })
        
        # Start a chat session with history
        chat = model.start_chat(history=history_for_api)
        
        # Prepend system instruction to the user's message for guidance
        enhanced_message = f"{SYSTEM_INSTRUCTION}\n\nUser's message: {user_message}"
        
        # If it's the first message, include system instruction
        # For subsequent messages, send just the user message
        if len(chat_history) == 0:
            response = chat.send_message(enhanced_message)
        else:
            response = chat.send_message(user_message)
        
        # Validate response
        if response and response.text:
            return response.text.strip()
        else:
            # Check if response was blocked by safety filters
            if response.prompt_feedback and response.prompt_feedback.block_reason:
                return (
                    "⚠️ I'm unable to respond to that request as it was flagged "
                    "by content safety filters. Please try rephrasing your question."
                )
            return "I apologize, but I wasn't able to generate a response. Please try again."
            
    except genai.types.BlockedPromptException:
        return (
            "⚠️ Your message was blocked by safety filters. "
            "Please rephrase your question and try again."
        )
    except genai.types.StopCandidateException:
        return (
            "⚠️ The response generation was stopped unexpectedly. "
            "Please try again with a different question."
        )
    except Exception as e:
        error_message = str(e).lower()
        
        # Provide user-friendly error messages based on error type
        if "quota" in error_message or "rate" in error_message:
            raise Exception(
                "📊 API rate limit reached. Please wait a moment and try again."
            )
        elif "invalid" in error_message and "key" in error_message:
            raise Exception(
                "🔑 Invalid API key. Please check your GEMINI_API_KEY."
            )
        elif "not found" in error_message or "404" in error_message:
            raise Exception(
                "🔍 The AI model is currently unavailable. Please try again later."
            )
        elif "connection" in error_message or "network" in error_message:
            raise Exception(
                "🌐 Network error. Please check your internet connection."
            )
        else:
            raise Exception(f"❌ An error occurred: {str(e)}")


# ============================================================================
# SESSION STATE MANAGEMENT
# ============================================================================
def initialize_session_state():
    """
    Initialize Streamlit session state variables.
    Sets up chat history and model instance on first load.
    """
    # Initialize chat history as empty list
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []
    
    # Initialize model instance
    if "model" not in st.session_state:
        st.session_state.model = None
    
    # Initialize error state
    if "api_error" not in st.session_state:
        st.session_state.api_error = None
    
    # Initialize message counter for statistics
    if "total_messages" not in st.session_state:
        st.session_state.total_messages = 0
    
    # Track if model has been initialized
    if "model_initialized" not in st.session_state:
        st.session_state.model_initialized = False


def clear_chat_history():
    """Clear all chat history and reset the conversation."""
    st.session_state.chat_history = []
    st.session_state.total_messages = 0
    st.success("✨ Chat history cleared! Start a new conversation.")


# ============================================================================
# UI COMPONENTS
# ============================================================================
def render_header():
    """Render the main application header."""
    st.markdown("""
    <div class="main-header">
        <h1>🤖 AI Chatbot</h1>
        <p>Powered by Google Gemini • Intelligent Conversations</p>
    </div>
    """, unsafe_allow_html=True)


def render_sidebar():
    """Render the sidebar with controls, information, and statistics."""
    with st.sidebar:
        # Sidebar Header
        st.markdown("""
        <div class="sidebar-header">
            <h2>⚙️ Control Panel</h2>
        </div>
        """, unsafe_allow_html=True)
        
        # --- Clear Chat Button ---
        st.markdown("### 🗑️ Chat Management")
        if st.button("🧹 Clear Chat History", use_container_width=True, type="primary"):
            clear_chat_history()
        
        st.markdown("---")
        
        # --- Chat Statistics ---
        st.markdown("### 📊 Session Statistics")
        
        total_messages = len(st.session_state.chat_history)
        user_messages = sum(
            1 for msg in st.session_state.chat_history if msg["role"] == "user"
        )
        ai_messages = sum(
            1 for msg in st.session_state.chat_history if msg["role"] == "assistant"
        )
        
        # Display stats in columns
        col1, col2 = st.columns(2)
        with col1:
            st.markdown(f"""
            <div class="stats-box">
                <div class="stats-number">{user_messages}</div>
                <div class="stats-label">Your Messages</div>
            </div>
            """, unsafe_allow_html=True)
        with col2:
            st.markdown(f"""
            <div class="stats-box">
                <div class="stats-number">{ai_messages}</div>
                <div class="stats-label">AI Responses</div>
            </div>
            """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        # --- Capabilities Info ---
        st.markdown("### 💡 What I Can Do")
        st.markdown("""
        <div class="info-box">
            <ul>
                <li>💬 Answer questions on any topic</li>
                <li>📝 Help with writing & editing</li>
                <li>💻 Code assistance & debugging</li>
                <li>🧮 Math & science explanations</li>
                <li>🌐 Language translation</li>
                <li>📚 Research & summarization</li>
                <li>🎨 Creative brainstorming</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        # --- Tips Section ---
        st.markdown("### 🎯 Tips for Best Results")
        st.markdown("""
        <div class="info-box">
            <ul>
                <li>Be specific in your questions</li>
                <li>Provide context when needed</li>
                <li>Ask follow-up questions</li>
                <li>Request specific formats</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        # --- Footer ---
        st.markdown("""
        <div class="footer">
            <p>Built with ❤️ using Streamlit & Gemini</p>
            <p>v1.0.0 • © 2024</p>
        </div>
        """, unsafe_allow_html=True)


def render_welcome_message():
    """Display a welcome message when there's no chat history."""
    st.markdown("""
    <div class="welcome-container">
        <div class="emoji">👋</div>
        <h3>Welcome to AI Chatbot!</h3>
        <p>I'm your intelligent AI assistant powered by Google Gemini. 
           Ask me anything — from coding help to creative writing!</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Suggestion chips for quick start
    st.markdown("#### 💡 Try asking me:")
    
    suggestions = [
        "Explain quantum computing in simple terms",
        "Write a Python function to sort a list",
        "Give me 5 tips for better productivity",
        "What are the benefits of meditation?",
    ]
    
    # Create columns for suggestion buttons
    cols = st.columns(2)
    for idx, suggestion in enumerate(suggestions):
        with cols[idx % 2]:
            if st.button(f"💬 {suggestion}", key=f"suggestion_{idx}", use_container_width=True):
                # Set the suggestion as user input by adding to session state
                st.session_state.suggested_input = suggestion
                st.rerun()


def render_chat_history():
    """Display all messages in the chat history."""
    for message in st.session_state.chat_history:
        role = message["role"]
        content = message["content"]
        avatar = "🧑‍💻" if role == "user" else "🤖"
        
        with st.chat_message(role, avatar=avatar):
            st.markdown(content)


def render_error_message(error_text):
    """Display a formatted error message."""
    st.error(f"""
    **Something went wrong!**
    
    {error_text}
    
    If the problem persists, please try:
    1. Refreshing the page
    2. Clearing chat history
    3. Checking your API key
    """)


# ============================================================================
# MAIN APPLICATION
# ============================================================================
def main():
    """
    Main application entry point.
    Orchestrates the entire chatbot interface and interaction flow.
    """
    # --- Apply Custom Styles ---
    apply_custom_css()
    
    # --- Initialize Session State ---
    initialize_session_state()
    
    # --- Initialize Gemini Model ---
    if not st.session_state.model_initialized:
        try:
            st.session_state.model = initialize_gemini_model()
            st.session_state.model_initialized = True
            st.session_state.api_error = None
        except ValueError as ve:
            st.session_state.api_error = str(ve)
        except Exception as e:
            st.session_state.api_error = f"Failed to initialize AI model: {str(e)}"
    
    # --- Render Header ---
    render_header()
    
    # --- Render Sidebar ---
    render_sidebar()
    
    # --- Check for API Errors ---
    if st.session_state.api_error:
        render_error_message(st.session_state.api_error)
        
        # Add retry button
        if st.button("🔄 Retry Connection", type="primary"):
            st.session_state.model_initialized = False
            st.session_state.api_error = None
            st.rerun()
        return
    
    # --- Display Chat History or Welcome Message ---
    if not st.session_state.chat_history:
        render_welcome_message()
    else:
        render_chat_history()
    
    # --- Handle Suggested Input ---
    suggested_input = st.session_state.pop("suggested_input", None)
    
    # --- Chat Input ---
    # Get user input from chat input widget or suggestion
    user_input = st.chat_input(
        placeholder="Type your message here... (e.g., 'Explain machine learning')",
    )
    
    # Use suggested input if no direct input
    if suggested_input and not user_input:
        user_input = suggested_input
    
    # --- Process User Input ---
    if user_input:
        # Validate input - check for empty or whitespace-only input
        cleaned_input = user_input.strip()
        
        if not cleaned_input:
            st.warning("⚠️ Please enter a valid message.")
            return
        
        # Check for extremely long inputs
        if len(cleaned_input) > 10000:
            st.warning(
                "⚠️ Your message is too long. Please keep it under 10,000 characters."
            )
            return
        
        # --- Add User Message to History & Display ---
        st.session_state.chat_history.append({
            "role": "user",
            "content": cleaned_input,
        })
        
        # Display the user message
        with st.chat_message("user", avatar="🧑‍💻"):
            st.markdown(cleaned_input)
        
        # --- Generate AI Response ---
        with st.chat_message("assistant", avatar="🤖"):
            # Create a placeholder for the loading indicator
            message_placeholder = st.empty()
            
            # Show loading animation
            with st.spinner("🧠 Thinking..."):
                try:
                    # Build history without the current message (already added above)
                    history_for_context = st.session_state.chat_history[:-1]
                    
                    # Get response from Gemini
                    response = get_gemini_response(
                        model=st.session_state.model,
                        chat_history=history_for_context,
                        user_message=cleaned_input,
                    )
                    
                    # Display the response with a typing effect simulation
                    message_placeholder.markdown(response)
                    
                    # Add assistant response to chat history
                    st.session_state.chat_history.append({
                        "role": "assistant",
                        "content": response,
                    })
                    
                    # Update message counter
                    st.session_state.total_messages += 1
                    
                except Exception as e:
                    error_msg = str(e)
                    message_placeholder.empty()
                    st.error(f"🚨 {error_msg}")
                    
                    # Remove the user message if response failed
                    if (st.session_state.chat_history 
                            and st.session_state.chat_history[-1]["role"] == "user"):
                        st.session_state.chat_history.pop()


# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================
if __name__ == "__main__":
    main()