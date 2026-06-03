import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8833);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

const CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 12000;
const ANALYZE_TIMEOUT_MS = 25000;

const searchCache = new Map();
const analysisCache = new Map();

function now() {
  return Date.now();
}

function cacheGet(cache, key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(cache, key, value, ttlMs = CACHE_TTL_MS) {
  cache.set(key, { value, expiresAt: now() + ttlMs });
}

function cleanDescription(cve) {
  return (
    cve?.descriptions?.find((item) => item.lang === "en")?.value ||
    "No description available."
  );
}

function extractCvss(cve) {
  const metrics = cve?.metrics || {};
  return (
    metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
    metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ||
    metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore ||
    null
  );
}

function extractCpeMatches(configurations = []) {
  const matches = [];

  function walkNodes(nodes) {
    for (const node of nodes || []) {
      for (const match of node.cpeMatch || []) {
        if (match.criteria) matches.push(match.criteria);
      }
      if (node.children?.length) walkNodes(node.children);
    }
  }

  walkNodes(configurations);
  return matches.slice(0, 200);
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeNvdResults(payload) {
  return (payload.vulnerabilities || []).map((item) => {
    const cve = item.cve;
    return {
      id: cve.id,
      published: cve.published,
      cvss: extractCvss(cve),
      description: cleanDescription(cve),
      cpeMatches: extractCpeMatches(cve.configurations),
    };
  });
}

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true, service: "igel-web-defender", version: "1.0.0" });
});

app.get("/api/search", async (req, res) => {
  const query = String(req.query.query || "").trim();

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter." });
  }

  const cacheKey = query.toLowerCase();
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");

    if (/^CVE-\d{4}-\d+$/i.test(query)) {
      url.searchParams.set("cveId", query.toUpperCase());
    } else {
      url.searchParams.set("keywordSearch", query);
      url.searchParams.set("resultsPerPage", "15");
    }

    const headers = {};
    if (process.env.NVD_API_KEY) {
      headers.apiKey = process.env.NVD_API_KEY;
    }

    const response = await fetchJsonWithTimeout(url, { headers }, SEARCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`NVD request failed: ${response.status}`);
    }

    const payload = await response.json();
    const results = normalizeNvdResults(payload);
    const output = { query, results };

    cacheSet(searchCache, cacheKey, output);
    return res.json(output);
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({ error: "NVD request timed out." });
    }
    return res.status(500).json({ error: error.message || "Search failed." });
  }
});

app.post("/api/analyze-cve", async (req, res) => {
  const body = req.body || {};
  const cveId = String(body.cveId || "").trim().toUpperCase();
  const description = String(body.description || "").trim();
  const cpeMatches = Array.isArray(body.cpeMatches) ? body.cpeMatches.slice(0, 200) : [];
  const published = body.published || null;
  const cvss = typeof body.cvss === "number" ? body.cvss : null;

  if (!cveId || !description) {
    return res.status(400).json({ error: "cveId and description are required." });
  }

  if (!openaiClient) {
    return res.status(503).json({
      error: "OpenAI is not configured. Set OPENAI_API_KEY in .env.",
    });
  }

  const cacheKey = JSON.stringify({ cveId, description, cpeMatches, published, cvss });
  const cached = cacheGet(analysisCache, cacheKey);
  if (cached) return res.json(cached);

  const systemPrompt = `You are a cybersecurity analyst helping summarize CVEs for endpoint teams.

You will receive:
- CVE ID
- official description
- CVSS score if available
- affected CPE strings if available

Evaluate the relevance of the CVE for two operating environments:
1. Windows desktop/server environments
2. IGEL OS, a Linux-based thin client operating system with a read-only root filesystem and centralized management

Return only valid JSON using this schema:
{
  "highLevelExploit": "string",
  "windows": {
    "isVulnerable": true,
    "assessment": "string",
    "mitigation": "string"
  },
  "igel": {
    "isVulnerable": true,
    "assessment": "string",
    "mitigation": "string"
  },
  "confidence": "low|medium|high",
  "disclaimer": "string"
}

Rules:
- Base your answer on the supplied CVE data.
- Do not invent vendor patch IDs.
- If exposure is uncertain, say so.
- Treat IGEL as a Linux-based, read-only thin client OS where persistence may be harder even if session or application-layer exposure exists.
- Keep the exploit summary to one or two plain-English sentences.`;

  try {
    const completionPromise = openaiClient.chat.completions.create({
      model: openaiModel,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({ cveId, description, cpeMatches, published, cvss }),
        },
      ],
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AI analysis timed out.")), ANALYZE_TIMEOUT_MS);
    });

    const response = await Promise.race([completionPromise, timeoutPromise]);
    const raw = response?.choices?.[0]?.message?.content || "{}";
    const analysis = JSON.parse(raw);

    const normalized = {
      highLevelExploit: String(analysis.highLevelExploit || "No summary returned."),
      windows: {
        isVulnerable: Boolean(analysis.windows?.isVulnerable),
        assessment: String(analysis.windows?.assessment || "No assessment returned."),
        mitigation: String(analysis.windows?.mitigation || "No mitigation returned."),
      },
      igel: {
        isVulnerable: Boolean(analysis.igel?.isVulnerable),
        assessment: String(analysis.igel?.assessment || "No assessment returned."),
        mitigation: String(analysis.igel?.mitigation || "No mitigation returned."),
      },
      confidence: ["low", "medium", "high"].includes(analysis.confidence)
        ? analysis.confidence
        : "medium",
      disclaimer: String(
        analysis.disclaimer ||
          "AI-generated assessment is advisory and should be validated against vendor advisories."
      ),
    };

    cacheSet(analysisCache, cacheKey, normalized);
    return res.json(normalized);
  } catch (error) {
    return res.status(500).json({ error: error.message || "AI analysis failed." });
  }
});

app.listen(port, () => {
  console.log(`IGEL Web Defender running at http://localhost:${port}`);
});
