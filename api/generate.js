const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    var body = req.body;
    var inputs = body.inputs || {};
    var refinePrompt = body.refinePrompt || null;
    var currentOutput = body.currentOutput || "";

    var prompt = "";

    if (refinePrompt && currentOutput) {
      prompt =
        "Here is an analysis:\n\n" +
        currentOutput +
        "\n\nInstruction: " +
        refinePrompt +
        "\n\nReturn only the refined output.";
    } else {
      prompt =
        "You are a structured thinking engine. Synthesize these 5 inputs into a clear markdown analysis.\n\n" +
        "1. Core Idea: " + (inputs[1] || "N/A") + "\n" +
        "2. Questions: " + (inputs[2] || "N/A") + "\n" +
        "3. Domains: " + (inputs[3] || "N/A") + "\n" +
        "4. Evidence: " + (inputs[4] || "N/A") + "\n" +
        "5. Format: " + (inputs[5] || "Structured analysis") + "\n\n" +
        "Be specific. Use markdown. No filler phrases.";
    }

    // ── No API key → mock response ──
    var key = process.env.GEMINI_API_KEY;

    if (!key) {
      await new Promise(function (r) { setTimeout(r, 1200); });

      if (refinePrompt) {
        return res.json({
          output:
            currentOutput +
            "\n\n---\n\n> 🔄 **Refined** (mock mode — add GEMINI_API_KEY for real results)\n\nThe analysis has been refined while preserving the core argument."
        });
      }

      return res.json({
        output:
          "## Analysis: " + (inputs[1] || "Your Idea") +
          "\n\n**Mock response** — add your Gemini API key to get real output." +
          "\n\n### Key Points\n- Your idea has been processed through 5 steps\n- Each domain was considered\n- Evidence was weighed" +
          "\n\n### Recommendation\nDesign a small experiment to test the core assumption." +
          "\n\n---\n*Intelletor (mock mode)*"
      });
    }

    // ── Real Gemini call ──
    var genAI = new GoogleGenerativeAI(key);
    var model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    var result = await model.generateContent(prompt);
    var text = result.response.text();

    return res.json({ output: text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
