// ── Data ──

var STEPS = [
  { id: 1, title: "Core Idea", hint: "What is your main idea or problem?" },
  { id: 2, title: "Key Questions", hint: "What questions does this raise?" },
  { id: 3, title: "Domains", hint: "What fields are relevant? (psychology, tech, etc)" },
  { id: 4, title: "Evidence", hint: "What data or examples support this?" },
  { id: 5, title: "Output Format", hint: "Essay, bullets, table, summary?" }
];

var TOOLS = [
  { label: "🎯 Sharpen", prompt: "Make it more precise — without diluting the core argument." },
  { label: "📐 Expand", prompt: "Add more depth — without diluting the core argument." },
  { label: "✂️ Simplify", prompt: "Simpler language — without diluting the core argument." },
  { label: "⚔️ Challenge", prompt: "Add counterarguments — without diluting the core argument." },
  { label: "🔀 Restructure", prompt: "Better organization — without diluting the core argument." },
  { label: "📚 Evidence", prompt: "Add examples and data — without diluting the core argument." },
  { label: "🎙️ Tone", prompt: "More professional tone — without diluting the core argument." },
  { label: "📝 Summarize", prompt: "Compress to key points — without diluting the core argument." }
];

var currentStep = 1;
var inputs = {};
var output = "";

// ── Init ──

window.onload = function () {
  buildRefineButtons();
  renderStep();
};

// ── Step Navigation ──

function renderStep() {
  document.getElementById("stepView").style.display = "flex";
  document.getElementById("outputView").style.display = "none";

  var s = STEPS[currentStep - 1];

  document.getElementById("stepLabel").textContent = "Step " + s.id + " of 5";
  document.getElementById("stepTitle").textContent = s.title;
  document.getElementById("stepHint").textContent = s.hint;

  var input = document.getElementById("stepInput");
  input.value = inputs[currentStep] || "";
  input.focus();

  // Save text on every keystroke
  input.oninput = function () {
    inputs[currentStep] = input.value;
    updateDots();
  };

  // Back button
  document.getElementById("backBtn").disabled = currentStep === 1;

  // Next / Generate button
  var nextBtn = document.getElementById("nextBtn");
  if (currentStep === 5) {
    nextBtn.textContent = "✨ Generate";
    nextBtn.onclick = generate;
  } else {
    nextBtn.textContent = "Continue →";
    nextBtn.onclick = goNext;
  }

  updateDots();
}

function updateDots() {
  for (var i = 1; i <= 5; i++) {
    var dot = document.getElementById("dot" + i);
    dot.className = "dot";
    if (i === currentStep) dot.className = "dot active";
    else if (inputs[i] && inputs[i].trim()) dot.className = "dot completed";

    dot.textContent = (inputs[i] && inputs[i].trim() && i !== currentStep) ? "✓" : i;

    if (i < 5) {
      var line = document.getElementById("line" + i);
      line.className = (inputs[i] && inputs[i].trim()) ? "line done" : "line";
    }
  }
}

function goTo(step) {
  inputs[currentStep] = document.getElementById("stepInput").value;
  currentStep = step;
  renderStep();
}

function goNext() {
  inputs[currentStep] = document.getElementById("stepInput").value;
  if (currentStep < 5) {
    currentStep++;
    renderStep();
  }
}

function goBack() {
  inputs[currentStep] = document.getElementById("stepInput").value;
  if (currentStep > 1) {
    currentStep--;
    renderStep();
  }
}

function resetAll() {
  currentStep = 1;
  inputs = {};
  output = "";
  renderStep();
}

// ── Generate ──

function showLoader(show) {
  document.getElementById("loader").style.display = show ? "flex" : "none";
}

async function generate() {
  inputs[currentStep] = document.getElementById("stepInput").value;

  if (!inputs[1] || !inputs[1].trim()) {
    alert("Step 1 (Core Idea) is required.");
    return;
  }

  showLoader(true);

  try {
    var res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: inputs })
    });
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    output = data.output;
    showOutput();
  } catch (e) {
    alert("Error: " + e.message);
  }

  showLoader(false);
}

// ── Show Output ──

function showOutput() {
  document.getElementById("stepView").style.display = "none";
  document.getElementById("outputView").style.display = "flex";
  document.getElementById("outputContent").innerHTML = markdownToHTML(output);
}

function copyOutput() {
  navigator.clipboard.writeText(output);
  alert("Copied!");
}

// ── Refine ──

function buildRefineButtons() {
  var list = document.getElementById("refineList");
  list.innerHTML = "";

  TOOLS.forEach(function (tool) {
    var btn = document.createElement("button");
    btn.className = "refine-btn";
    btn.textContent = tool.label;
    btn.onclick = function () { refine(tool.label, tool.prompt, btn); };
    list.appendChild(btn);
  });
}

async function refine(label, prompt, btn) {
  // Disable all refine buttons
  var buttons = document.querySelectorAll(".refine-btn");
  buttons.forEach(function (b) { b.disabled = true; });
  btn.textContent = "⏳ Working...";

  showLoader(true);

  try {
    var res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: inputs,
        refinePrompt: prompt,
        currentOutput: output
      })
    });
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    output = data.output;
    showOutput();
  } catch (e) {
    alert("Error: " + e.message);
  }

  showLoader(false);
  btn.textContent = label;
  buttons.forEach(function (b) { b.disabled = false; });
}

// ── Markdown → HTML (simple) ──

function markdownToHTML(text) {
  var lines = text.split("\n");
  var html = "";

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (line.startsWith("## ")) {
      html += "<h2>" + esc(line.slice(3)) + "</h2>";
    } else if (line.startsWith("### ")) {
      html += "<h3>" + esc(line.slice(4)) + "</h3>";
    } else if (line.startsWith("> ")) {
      html += "<blockquote>" + esc(line.slice(2)) + "</blockquote>";
    } else if (line.startsWith("- ")) {
      html += "<li>" + bold(esc(line.slice(2))) + "</li>";
    } else if (line.startsWith("---")) {
      html += "<hr>";
    } else if (line.trim() === "") {
      html += "<br>";
    } else {
      html += "<p>" + bold(esc(line)) + "</p>";
    }
  }

  return html;
}

function esc(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function bold(str) {
  return str.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
