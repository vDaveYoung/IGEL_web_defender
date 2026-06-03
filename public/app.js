const MISSIONS = [
  {
    id: "healthcare",
    emoji: "🏥",
    name: "Save the Hospital",
    assets: ["EMR", "Nurse Stations", "Radiology", "Monitoring", "Pharmacy"],
    boss: "Ransomware Surgeon",
  },
  {
    id: "finance",
    emoji: "🏦",
    name: "Protect the Bank",
    assets: ["Trading", "Teller", "Loans", "ATM", "Fraud Ops"],
    boss: "Market Manipulator",
  },
  {
    id: "government",
    emoji: "🏛",
    name: "Secure the Agency",
    assets: ["Citizen Services", "Records", "Tax", "Workstations", "Comms"],
    boss: "Adaptive Persistent Threat",
  },
  {
    id: "military",
    emoji: "🪖",
    name: "Defend the Base",
    assets: ["Command", "Intel", "Secure Comms", "Ops", "Logistics"],
    boss: "Red Team General",
  },
  {
    id: "legal",
    emoji: "⚖️",
    name: "Protect the Law Firm",
    assets: ["Client Data", "Case Files", "Discovery", "Partners", "Dockets"],
    boss: "Litigation Leaker",
  },
];

const CAPABILITIES = [
  { id: "immutable", label: "Immutable Fortress", cooldown: 14 },
  { id: "ums", label: "UMS Command Center", cooldown: 18 },
  { id: "portal", label: "App Portal Deployment", cooldown: 16 },
  { id: "adaptive", label: "Adaptive Secure Desktop", cooldown: 15 },
  { id: "rollback", label: "Disaster Recovery Rollback", cooldown: 22 },
];

const THREAT_TYPES = [
  { name: "Malware Bot", speed: 1.25, hp: 1 },
  { name: "Credential Thief", speed: 1.6, hp: 1 },
  { name: "Rogue USB Goblin", speed: 1.35, hp: 2 },
  { name: "Shadow IT Phantom", speed: 1.5, hp: 2 },
  { name: "Patch Lag Monster", speed: 1.2, hp: 3 },
  { name: "Data Exfiltration Drone", speed: 1.9, hp: 1 },
];

const ROUND_SECONDS = 75;
const BOSS_SPAWN_SECOND = 55;

const screens = {
  lead: document.getElementById("lead-screen"),
  mission: document.getElementById("mission-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
};

const leadForm = document.getElementById("lead-form");
const missionGrid = document.getElementById("mission-grid");
const summaryNode = document.getElementById("summary");
const leaderboardNode = document.getElementById("leaderboard");
const capabilitiesNode = document.getElementById("capabilities");

const timerNode = document.getElementById("timer");
const scoreNode = document.getElementById("score");
const threatsNode = document.getElementById("threats");
const savedNode = document.getElementById("saved");

const playAgainBtn = document.getElementById("play-again");
const boardTabs = [...document.querySelectorAll(".board-tab")];

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let lead = null;
let mission = null;
let running = false;
let rafId = null;
let lastTick = 0;

const state = {
  timeLeft: ROUND_SECONDS,
  score: 0,
  threatsStopped: 0,
  endpointsSaved: 5,
  bossDefeated: false,
  bestCapability: "Immutable Fortress",
  capabilityUse: {},
  capabilityReadyAt: {},
  player: { x: canvas.width / 2, y: canvas.height / 2, angle: 0 },
  bullets: [],
  threats: [],
  assets: [],
  globalShieldUntil: 0,
  slowUntil: 0,
  hardenUntil: 0,
  spawnTick: 0,
  bossSpawned: false,
};

function showScreen(key) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[key].classList.add("active");
}

function buildMissions() {
  missionGrid.innerHTML = "";
  for (const m of MISSIONS) {
    const btn = document.createElement("button");
    btn.className = "mission-card";
    btn.innerHTML = `<h4>${m.emoji} ${m.name}</h4><p>Boss: ${m.boss}</p>`;
    btn.addEventListener("click", () => startMission(m.id));
    missionGrid.appendChild(btn);
  }
}

function missionById(id) {
  return MISSIONS.find((m) => m.id === id);
}

function initAssets() {
  const r = 160;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  state.assets = mission.assets.map((name, idx) => {
    const a = (Math.PI * 2 * idx) / mission.assets.length;
    return {
      name,
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      hp: 3,
      alive: true,
      shield: 0,
    };
  });
}

function resetState() {
  state.timeLeft = ROUND_SECONDS;
  state.score = 0;
  state.threatsStopped = 0;
  state.endpointsSaved = 5;
  state.bossDefeated = false;
  state.bestCapability = "Immutable Fortress";
  state.capabilityUse = {};
  state.capabilityReadyAt = {};
  state.player = { x: canvas.width / 2, y: canvas.height / 2, angle: 0 };
  state.bullets = [];
  state.threats = [];
  state.globalShieldUntil = 0;
  state.slowUntil = 0;
  state.hardenUntil = 0;
  state.spawnTick = 0;
  state.bossSpawned = false;
  for (const cap of CAPABILITIES) {
    state.capabilityUse[cap.id] = 0;
    state.capabilityReadyAt[cap.id] = 0;
  }
}

function spawnThreat(type = null, isBoss = false) {
  const t = type || THREAT_TYPES[Math.floor(Math.random() * THREAT_TYPES.length)];
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) {
    x = Math.random() * canvas.width;
    y = -20;
  } else if (edge === 1) {
    x = canvas.width + 20;
    y = Math.random() * canvas.height;
  } else if (edge === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + 20;
  } else {
    x = -20;
    y = Math.random() * canvas.height;
  }

  state.threats.push({
    name: isBoss ? mission.boss : t.name,
    x,
    y,
    speed: isBoss ? 0.9 : t.speed,
    hp: isBoss ? 20 : t.hp,
    maxHp: isBoss ? 20 : t.hp,
    damage: isBoss ? 2 : 1,
    boss: isBoss,
    hidden: mission.id === "military" && !isBoss,
  });
}

function aimAt(mouseX, mouseY) {
  state.player.angle = Math.atan2(mouseY - state.player.y, mouseX - state.player.x);
}

canvas.addEventListener("mousemove", (e) => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  aimAt((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height));
});

canvas.addEventListener("touchmove", (e) => {
  if (!running || e.touches.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  aimAt((t.clientX - rect.left) * (canvas.width / rect.width), (t.clientY - rect.top) * (canvas.height / rect.height));
}, { passive: true });

function fire() {
  if (!running) return;
  const speed = 7;
  state.bullets.push({
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(state.player.angle) * speed,
    vy: Math.sin(state.player.angle) * speed,
    dmg: 1,
  });
}

canvas.addEventListener("click", fire);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    fire();
  }
});

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function useCapability(id) {
  const now = performance.now() / 1000;
  if ((state.capabilityReadyAt[id] || 0) > now) return;
  const cap = CAPABILITIES.find((c) => c.id === id);
  if (!cap) return;

  state.capabilityReadyAt[id] = now + cap.cooldown;
  state.capabilityUse[id] += 1;

  if (id === "immutable") {
    state.globalShieldUntil = now + 6;
    state.assets.forEach((a) => (a.shield = now + 6));
  } else if (id === "ums") {
    state.threats = state.threats.filter((t) => t.boss);
    state.score += 450;
    state.threatsStopped += 3;
    state.hardenUntil = now + 8;
  } else if (id === "portal") {
    state.assets.forEach((a) => {
      if (a.alive && a.hp < 3) a.hp += 1;
    });
    state.score += 180;
  } else if (id === "adaptive") {
    state.slowUntil = now + 7;
  } else if (id === "rollback") {
    let revived = 0;
    state.assets.forEach((a) => {
      if (!a.alive && revived < 2) {
        a.alive = true;
        a.hp = 2;
        revived += 1;
      }
    });
    state.score += 280 * Math.max(1, revived);
  }
}

function buildCapabilities() {
  capabilitiesNode.innerHTML = "";
  for (const cap of CAPABILITIES) {
    const b = document.createElement("button");
    b.className = "cap-btn";
    b.id = `cap-${cap.id}`;
    b.textContent = cap.label;
    b.addEventListener("click", () => useCapability(cap.id));
    capabilitiesNode.appendChild(b);
  }
}

function updateCapabilityButtons(now) {
  for (const cap of CAPABILITIES) {
    const btn = document.getElementById(`cap-${cap.id}`);
    const readyAt = state.capabilityReadyAt[cap.id] || 0;
    const cd = Math.max(0, Math.ceil(readyAt - now));
    btn.disabled = cd > 0;
    btn.textContent = cd > 0 ? `${cap.label} (${cd}s)` : cap.label;
  }
}

function updateHud() {
  timerNode.textContent = `${Math.max(0, Math.ceil(state.timeLeft))}s`;
  scoreNode.textContent = `Score: ${state.score}`;
  threatsNode.textContent = `Threats Stopped: ${state.threatsStopped}`;
  state.endpointsSaved = state.assets.filter((a) => a.alive).length;
  savedNode.textContent = `Endpoints Saved: ${state.endpointsSaved}`;
}

function step(dt, now) {
  state.timeLeft -= dt;
  state.spawnTick += dt;

  const spawnRate = now < state.hardenUntil ? 1.8 : 1.1;
  if (state.spawnTick > spawnRate) {
    spawnThreat();
    state.spawnTick = 0;
  }

  if (!state.bossSpawned && ROUND_SECONDS - state.timeLeft >= BOSS_SPAWN_SECOND) {
    spawnThreat(null, true);
    state.bossSpawned = true;
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
  }
  state.bullets = state.bullets.filter((b) => b.x > -20 && b.x < canvas.width + 20 && b.y > -20 && b.y < canvas.height + 20);

  for (const threat of state.threats) {
    const liveAssets = state.assets.filter((a) => a.alive);
    if (!liveAssets.length) break;
    let target = liveAssets[0];
    for (const a of liveAssets) {
      if (dist(threat, a) < dist(threat, target)) target = a;
    }

    const slowFactor = now < state.slowUntil ? 0.55 : 1;
    const vx = target.x - threat.x;
    const vy = target.y - threat.y;
    const mag = Math.hypot(vx, vy) || 1;
    threat.x += (vx / mag) * threat.speed * slowFactor;
    threat.y += (vy / mag) * threat.speed * slowFactor;

    if (dist(threat, target) < 14) {
      if (now < state.globalShieldUntil || now < target.shield) {
        threat.hp = 0;
        state.score += 100;
        state.threatsStopped += 1;
      } else {
        target.hp -= threat.damage;
        if (target.hp <= 0) target.alive = false;
        threat.hp = 0;
      }
    }
  }

  for (const bullet of state.bullets) {
    for (const threat of state.threats) {
      if (threat.hp <= 0) continue;
      if (dist(bullet, threat) < 13 + (threat.boss ? 8 : 0)) {
        threat.hp -= bullet.dmg;
        bullet.x = -999;
        if (threat.hp <= 0) {
          state.score += threat.boss ? 1000 : 100;
          state.threatsStopped += 1;
          if (threat.boss) state.bossDefeated = true;
        }
      }
    }
  }

  state.threats = state.threats.filter((t) => t.hp > 0);
  state.bullets = state.bullets.filter((b) => b.x > -100);

  updateCapabilityButtons(now);
  updateHud();

  if (state.timeLeft <= 0 || state.assets.every((a) => !a.alive)) {
    finishRun();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // arena ring
  ctx.strokeStyle = "rgba(77,143,255,0.26)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 190, 0, Math.PI * 2);
  ctx.stroke();

  for (const a of state.assets) {
    ctx.beginPath();
    ctx.fillStyle = a.alive ? "#4df3a6" : "#7b3240";
    ctx.arc(a.x, a.y, 14, 0, Math.PI * 2);
    ctx.fill();

    const hpW = 26;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(a.x - hpW / 2, a.y + 18, hpW, 4);
    ctx.fillStyle = a.alive ? "#6cfbb7" : "#7b3240";
    ctx.fillRect(a.x - hpW / 2, a.y + 18, (Math.max(0, a.hp) / 3) * hpW, 4);
  }

  for (const t of state.threats) {
    const show = !t.hidden || dist(t, state.player) < 130;
    if (!show) continue;
    ctx.beginPath();
    ctx.fillStyle = t.boss ? "#ffbf3c" : "#ff667f";
    ctx.arc(t.x, t.y, t.boss ? 14 : 9, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.fillStyle = "#51e2ff";
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // player turret
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = "#78a8ff";
  ctx.fillRect(-8, -8, 16, 16);
  ctx.fillStyle = "#d8e8ff";
  ctx.fillRect(0, -3, 20, 6);
  ctx.restore();
}

function loop(ts) {
  if (!running) return;
  if (!lastTick) lastTick = ts;
  const dt = Math.min(0.05, (ts - lastTick) / 1000);
  lastTick = ts;
  const now = performance.now() / 1000;

  step(dt, now);
  draw();

  if (running) rafId = requestAnimationFrame(loop);
}

async function submitScore() {
  try {
    await fetch("/api/submit-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...lead,
        mission: mission.id,
        score: state.score,
        threatsStopped: state.threatsStopped,
        endpointsSaved: state.endpointsSaved,
        bestCapability: state.bestCapability,
      }),
    });
  } catch (_err) {
    // non-blocking for conference flow
  }
}

async function loadLeaderboard(mode = "mission") {
  const qs = mode === "mission" ? `?mission=${mission.id}` : "";
  try {
    const resp = await fetch(`/api/leaderboard${qs}`);
    const data = await resp.json();
    const entries = data.entries || [];

    if (!entries.length) {
      leaderboardNode.innerHTML = '<p class="leaderboard-empty">No scores yet. Be the first defender.</p>';
      return;
    }

    leaderboardNode.innerHTML = entries
      .map(
        (e) =>
          `<div class="leaderboard-row"><strong>#${e.rank}</strong><span>${e.name} · ${e.company}</span><span>${e.mission}</span><strong>${e.score}</strong></div>`
      )
      .join("");
  } catch {
    leaderboardNode.innerHTML = '<p class="leaderboard-empty">Leaderboard unavailable.</p>';
  }
}

function bestCapabilityName() {
  let best = CAPABILITIES[0].id;
  let count = -1;
  for (const cap of CAPABILITIES) {
    const used = state.capabilityUse[cap.id] || 0;
    if (used > count) {
      count = used;
      best = cap.id;
    }
  }
  return CAPABILITIES.find((c) => c.id === best)?.label || "Immutable Fortress";
}

async function finishRun() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);

  if (state.assets.every((a) => a.alive)) {
    state.score += 2000; // perfect defense bonus
  }
  state.score += state.assets.filter((a) => a.alive).length * 250;
  state.bestCapability = bestCapabilityName();

  summaryNode.innerHTML = `
    <p><strong>Sector:</strong> ${mission.name}</p>
    <p><strong>Final Score:</strong> ${state.score}</p>
    <p><strong>Threats Stopped:</strong> ${state.threatsStopped}</p>
    <p><strong>Endpoints Saved:</strong> ${state.assets.filter((a) => a.alive).length}</p>
    <p><strong>Best Capability Used:</strong> ${state.bestCapability}</p>
    <p><strong>Boss Battle:</strong> ${state.bossDefeated ? "Defeated" : "Escaped"}</p>
  `;

  showScreen("result");
  await submitScore();
  await loadLeaderboard("mission");
}

function startMission(id) {
  mission = missionById(id);
  resetState();
  initAssets();
  buildCapabilities();
  updateHud();
  showScreen("game");
  running = true;
  lastTick = 0;
  rafId = requestAnimationFrame(loop);
}

leadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  lead = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    company: document.getElementById("company").value.trim(),
    email: document.getElementById("email").value.trim(),
    jobRole: document.getElementById("jobRole").value.trim(),
    optIn: document.getElementById("optIn").checked,
  };

  if (!lead.firstName || !lead.lastName || !lead.company || !lead.email) return;
  showScreen("mission");
});

playAgainBtn.addEventListener("click", () => {
  showScreen("mission");
});

for (const tab of boardTabs) {
  tab.addEventListener("click", async () => {
    boardTabs.forEach((b) => b.classList.remove("active"));
    tab.classList.add("active");
    await loadLeaderboard(tab.dataset.board);
  });
}

buildMissions();
showScreen("lead");
