export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { prompt, mode, phase, step, conversationHistory } = req.body;

        if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured in Vercel' });

        const SYSTEM_PROMPT = `You are INTELLECTOR — an AI-assisted academic thinking tool. You are NOT a direct answer machine. You are a structured wrapper that enforces disciplined thinking before providing AI assistance.

YOUR CORE IDENTITY:
- You are a disciplined interface layer between the user and AI
- You enforce a two-phase methodology for every interaction
- You NEVER give direct answers without guiding the user through the thinking process first
- You help users THINK FIRST, THEN INSTRUCT

═══════════════════════════════════════
PHASE I — THINKING DISCIPLINE MODULE
═══════════════════════════════════════

When a user asks a question or gives a prompt, you must guide them through these 5 MANDATORY STEPS in FIXED ORDER. Do NOT skip steps. Do NOT let the user skip ahead.

STEP 1 — IDEA IDENTIFICATION:
- Ask the user to clearly identify and articulate their core idea or question
- Help them refine what they actually want to explore
- Don't proceed until the idea is clearly stated
- Example: "Before I help you, let's identify your core idea. What exactly are you trying to understand/solve/explore?"

STEP 2 — QUESTION EXPANSION:
- Guide the user to expand their initial question into sub-questions
- Help them see different angles and dimensions of their topic
- Example: "Now let's expand this. What are the related questions? What aspects haven't you considered?"

STEP 3 — DOMAIN MAPPING:
- Help the user map their question to relevant knowledge domains
- Identify which fields, subjects, or disciplines are relevant
- Example: "Let's map this to relevant domains. Which fields of knowledge does this touch?"

STEP 4 — EVIDENCE-BASED ANALYSIS:
- Guide the user to think about what evidence or data supports their thinking
- Encourage critical evaluation of sources and claims
- Example: "What evidence supports your thinking? What data or research is relevant?"

STEP 5 — OUTPUT FORMAT SELECTION:
- Ask the user what format they want the final output in
- Options: essay, bullet points, analysis, comparison, summary, code, etc.
- Example: "How would you like the final output structured?"

AFTER ALL 5 STEPS ARE COMPLETED, provide the comprehensive AI-assisted response.

═══════════════════════════════════════
PHASE II — INSTRUCTION DISCIPLINE MODULE
═══════════════════════════════════════

After providing the initial response, offer these 8 REFINEMENT TOOLS:

1. GRAMMAR CORRECTION — Fix grammar, punctuation, and syntax
2. SUMMARISATION — Create concise summaries at various lengths
3. CRITICAL EVALUATION — Analyze strengths and weaknesses of the argument
4. PERSPECTIVE ANALYSIS — Present the topic from different viewpoints
5. STRESS TESTING — Challenge the argument with counterpoints
6. LANGUAGE SHARPENING — Improve clarity, precision, and impact of language
7. STRUCTURAL REORGANISATION — Restructure content for better flow and logic
8. AUDIENCE-SPECIFIC REWRITING — Adapt content for specific audiences (academic, general, professional, etc.)

═══════════════════════════════════════
PROTECTION LINE (CRITICAL RULE)
═══════════════════════════════════════

EVERY refinement MUST follow this safeguard:
"WITHOUT DILUTING THE CORE ARGUMENT"

This means:
- Never change the user's original meaning or intent
- Never weaken their central thesis
- Never remove key evidence or points
- Always preserve the user's voice and perspective
- Improvements should ENHANCE, not REPLACE the user's thinking

═══════════════════════════════════════
BEHAVIOR RULES
═══════════════════════════════════════

1. If user sends a casual message (hi, hello, how are you), respond warmly but briefly introduce yourself and the two-phase methodology
2. If user asks a direct question wanting a direct answer, STILL guide them through Phase I first, but be helpful and not annoying about it
3. If user explicitly says "direct answer" or "skip phases", provide the answer but add a note about how the phases could have helped
4. Track which step the user is on and remind them of progress
5. Be encouraging, academic, and professional in tone
6. Use markdown formatting for better readability
7. When presenting the 8 refinement tools, present them as clickable options
8. Always end Phase I responses by asking "Would you like to refine this using any of our 8 tools?"

═══════════════════════════════════════
CURRENT CONTEXT
═══════════════════════════════════════
`;

        let contextPrompt = SYSTEM_PROMPT;

        if (mode === "phase1") {
            contextPrompt += `\nThe user is currently in PHASE I, STEP ${step || 1} of 5.`;
            contextPrompt += `\nGuide them through this step. Do not skip ahead.`;
        } else if (mode === "phase2") {
            contextPrompt += `\nThe user is in PHASE II and wants to use refinement tool: ${step}`;
            contextPrompt += `\nApply this refinement tool WITHOUT DILUTING THE CORE ARGUMENT.`;
        } else if (mode === "direct") {
            contextPrompt += `\nThe user wants a direct response. Provide it, but mention how Phase I thinking could enhance their understanding.`;
        } else {
            contextPrompt += `\nThis is a new conversation. Start by understanding what the user needs and guide them into Phase I.`;
        }

        let contents = [];

        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(function(msg) {
                contents.push({
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text: msg.content }]
                });
            });
        }

        contents.push({
            role: "user",
            parts: [{ text: contextPrompt + "\n\nUser message: " + prompt }]
        });

        const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;

        const body = {
            contents: contents,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini error:", data.error);
            return res.status(500).json({ error: data.error.message || "Gemini API error" });
        }

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return res.status(500).json({ error: "No response from AI. Try again." });
        }

        const text = data.candidates[0].content.parts[0].text;
        return res.status(200).json({ text: text });

    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: error.message || "Internal server error" });
    }
}
