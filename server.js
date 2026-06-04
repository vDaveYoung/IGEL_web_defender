import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8833);
const dataDir = path.resolve("data");
const scoreFile = path.join(dataDir, "scores.json");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const VALID_MISSIONS = new Set(["healthcare", "finance", "government", "military", "legal"]);

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(scoreFile);
  } catch {
    await fs.writeFile(scoreFile, "[]", "utf8");
  }
}

async function readScores() {
  await ensureDataFile();
  const raw = await fs.readFile(scoreFile, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeScores(scores) {
  await ensureDataFile();
  await fs.writeFile(scoreFile, JSON.stringify(scores, null, 2), "utf8");
}

function cleanString(value, max = 80) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function numberOr(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true, service: "edge-defender-sector-wars", version: "1.0.0" });
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const mission = cleanString(req.query.mission || "", 30).toLowerCase();
    const scores = await readScores();
    const filtered = mission && VALID_MISSIONS.has(mission)
      ? scores.filter((s) => s.mission === mission)
      : scores;

    const top = filtered
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((s, idx) => ({
        rank: idx + 1,
        name: s.name,
        company: s.company,
        mission: s.mission,
        score: s.score,
        threatsStopped: s.threatsStopped,
        endpointsSaved: s.endpointsSaved,
        createdAt: s.createdAt,
      }));

    res.json({ mission: mission || "all", entries: top });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load leaderboard." });
  }
});

app.post("/api/submit-score", async (req, res) => {
  try {
    const body = req.body || {};
    const mission = cleanString(body.mission || "", 30).toLowerCase();

    if (!VALID_MISSIONS.has(mission)) {
      return res.status(400).json({ error: "Invalid mission." });
    }

    const firstName = cleanString(body.firstName, 40);
    const lastName = cleanString(body.lastName, 40);
    const email = cleanString(body.email, 120).toLowerCase();
    const company = cleanString(body.company, 80);
    const optIn = Boolean(body.optIn);

    if (!firstName || !lastName || !email || !company) {
      return res.status(400).json({ error: "Missing required lead fields." });
    }

    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      phone: cleanString(body.phone, 30),
      company,
      optIn,
      jobRole: cleanString(body.jobRole, 60),
      badgeId: cleanString(body.badgeId, 40),
      badgeRaw: cleanString(body.badgeRaw, 500),
      mission,
      score: Math.max(0, Math.floor(numberOr(body.score))),
      threatsStopped: Math.max(0, Math.floor(numberOr(body.threatsStopped))),
      endpointsSaved: Math.max(0, Math.floor(numberOr(body.endpointsSaved))),
      bestCapability: cleanString(body.bestCapability, 60) || "N/A",
      createdAt: new Date().toISOString(),
    };

    const scores = await readScores();
    scores.push(payload);
    await writeScores(scores);

    res.status(201).json({ ok: true, entry: payload });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to submit score." });
  }
});

app.listen(port, () => {
  console.log(`Edge Defender: Sector Wars running at http://localhost:${port}`);
});
