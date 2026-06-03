const modes = [
  { label: "Event", query: "", title: "Event Top 10" },
  { label: "Healthcare", query: "?mission=healthcare", title: "Healthcare Defenders" },
  { label: "Finance", query: "?mission=finance", title: "Finance Defenders" },
  { label: "Government", query: "?mission=government", title: "Government Defenders" },
  { label: "Military", query: "?mission=military", title: "Military Defenders" },
  { label: "Legal", query: "?mission=legal", title: "Legal Defenders" },
];

let modeIndex = 0;

const modeLabel = document.getElementById("mode-label");
const updatedAt = document.getElementById("updated-at");
const boardTitle = document.getElementById("board-title");
const rows = document.getElementById("rows");
const champion = document.getElementById("champion");
const statusLine = document.getElementById("status-line");

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "--";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderChampion(entry) {
  if (!entry) {
    champion.textContent = "Waiting for first score...";
    return;
  }

  champion.innerHTML = `
    <strong>${escapeHtml(entry.name)}</strong>
    <span>${escapeHtml(entry.company)}</span>
    <span>${escapeHtml(entry.mission)} · ${entry.score}</span>
  `;
}

function renderRows(entries) {
  if (!entries.length) {
    rows.innerHTML = '<p class="empty">No scores yet for this board.</p>';
    return;
  }

  rows.innerHTML = entries
    .slice(0, 10)
    .map(
      (entry) => `
      <div class="row">
        <span class="rank">#${entry.rank}</span>
        <span class="name">${escapeHtml(entry.name)}</span>
        <span class="company">${escapeHtml(entry.company)}</span>
        <span class="score">${entry.score}</span>
      </div>
    `
    )
    .join("");
}

async function loadMode(mode) {
  modeLabel.textContent = `Mode: ${mode.label}`;
  boardTitle.textContent = mode.title;
  statusLine.textContent = `Refreshing ${mode.label} leaderboard...`;

  const response = await fetch(`/api/leaderboard${mode.query}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Leaderboard unavailable");
  }

  const entries = data.entries || [];
  renderRows(entries);
  renderChampion(entries[0]);
  statusLine.textContent = entries.length
    ? `${entries.length} scores loaded for ${mode.label}`
    : `No scores yet for ${mode.label}`;
  updatedAt.textContent = `Updated: ${fmtTime(new Date().toISOString())}`;
}

async function tick() {
  const mode = modes[modeIndex];
  try {
    await loadMode(mode);
  } catch (error) {
    statusLine.textContent = error.message || "Display refresh failed";
  }

  modeIndex = (modeIndex + 1) % modes.length;
}

tick();
setInterval(tick, 10000);
