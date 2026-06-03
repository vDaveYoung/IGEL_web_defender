const form = document.getElementById("search-form");
const queryInput = document.getElementById("query");
const statusNode = document.getElementById("status");
const resultsNode = document.getElementById("results");
const analysisNode = document.getElementById("analysis");

function setStatus(message) {
  statusNode.textContent = message;
}

function formatDate(iso) {
  if (!iso) return "Unknown publish date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function renderResults(results) {
  resultsNode.innerHTML = "";

  if (!results.length) {
    resultsNode.innerHTML = '<p class="empty card">No CVEs found for that query.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-card card";
    button.innerHTML = `
      <div class="result-head">
        <strong>${item.id}</strong>
        <span class="pill">CVSS ${item.cvss ?? "n/a"}</span>
      </div>
      <small>${formatDate(item.published)}</small>
      <p>${item.description}</p>
    `;

    button.addEventListener("click", () => analyzeCve(item));
    fragment.appendChild(button);
  }

  resultsNode.appendChild(fragment);
}

function fillAnalysis(data) {
  document.getElementById("exploit-summary").textContent =
    data.highLevelExploit || "No summary returned.";

  document.getElementById("confidence").textContent =
    `Confidence: ${(data.confidence || "medium").toUpperCase()}`;

  document.getElementById("windows-state").textContent = data.windows?.isVulnerable
    ? "Potentially vulnerable"
    : "Not directly vulnerable";
  document.getElementById("windows-assessment").textContent =
    data.windows?.assessment || "No assessment returned.";
  document.getElementById("windows-mitigation").textContent =
    `Mitigation: ${data.windows?.mitigation || "No mitigation returned."}`;

  document.getElementById("igel-state").textContent = data.igel?.isVulnerable
    ? "Potentially vulnerable"
    : "Not directly vulnerable";
  document.getElementById("igel-assessment").textContent =
    data.igel?.assessment || "No assessment returned.";
  document.getElementById("igel-mitigation").textContent =
    `Mitigation: ${data.igel?.mitigation || "No mitigation returned."}`;

  document.getElementById("disclaimer").textContent =
    data.disclaimer ||
    "AI-generated assessment is advisory and should be validated against vendor advisories.";
}

async function analyzeCve(item) {
  setStatus(`Analyzing ${item.id}...`);
  analysisNode.classList.add("hidden");

  try {
    const response = await fetch("/api/analyze-cve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "AI analysis failed.");
    }

    fillAnalysis(data);
    analysisNode.classList.remove("hidden");
    setStatus(`Analysis ready for ${item.id}.`);
  } catch (error) {
    setStatus(error.message || "AI analysis failed.");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;

  setStatus("Searching NVD...");
  resultsNode.innerHTML = "";
  analysisNode.classList.add("hidden");

  try {
    const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Search failed.");
    }

    renderResults(data.results || []);
    setStatus(`Found ${(data.results || []).length} result(s).`);
  } catch (error) {
    setStatus(error.message || "Search failed.");
  }
});
