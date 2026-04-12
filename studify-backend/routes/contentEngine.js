const express = require('express');
const router = express.Router();
const { auth, verifyAdmin } = require('../middleware/auth');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Auto-download DejaVu Sans (full Unicode support) on first run ──
const FONTS_DIR = path.join(__dirname, '../fonts');
const DEJAVU_PATH = path.join(FONTS_DIR, 'DejaVuSans.ttf');
const DEJAVU_BOLD_PATH = path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf');

async function ensureFonts() {
  if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });
  const downloads = [
    { url: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf', dest: DEJAVU_PATH },
    { url: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf', dest: DEJAVU_BOLD_PATH }
  ];
  for (const { url, dest } of downloads) {
    if (!fs.existsSync(dest)) {
      try {
        console.log(`⬇️  Downloading font: ${path.basename(dest)}`);
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        fs.writeFileSync(dest, Buffer.from(res.data));
        console.log(`✅ Font saved: ${path.basename(dest)}`);
      } catch (e) {
        console.warn(`⚠️  Could not download font ${path.basename(dest)}: ${e.message}`);
      }
    }
  }
}
ensureFonts();

// Supabase client for PDF storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'materials';

// Auto-create bucket if it doesn't exist
async function ensureBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets && buckets.find(b => b.name === SUPABASE_BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(SUPABASE_BUCKET, { public: true });
      console.log(`✅ Supabase bucket '${SUPABASE_BUCKET}' created`);
    }
  } catch (e) {
    console.log('Supabase bucket check:', e.message);
  }
}
ensureBucket();

// ═══════════════════════════════════════════════════════════════════════
// AI TEAM SYSTEM — 3 Parallel Teams of Equal Efficiency
// ═══════════════════════════════════════════════════════════════════════

// Provider factory — call once per team so each team has its own usage counters
function makeProvider(name, type, endpoint, key, model, limit, quality, accountId = null) {
  const enabled = !!(key && key !== 'undefined' && key.length > 5);
  if (!enabled) console.warn(`⚠  Provider ${name} disabled — no API key`);
  return { name, type, endpoint, key, model, usage: 0, limit, enabled, quality, accountId };
}

// ── Shared provider config shortcuts ──
const OR = 'https://openrouter.ai/api/v1/chat/completions';
const GRQ = 'https://api.groq.com/openai/v1/chat/completions';
const CER = 'https://api.cerebras.ai/v1/chat/completions';
const HF = 'https://api-inference.huggingface.co/models/';
const GH = 'https://models.inference.ai.azure.com/chat/completions';
const DSK = 'https://api.deepseek.com/v1/chat/completions';
const GEM = 'https://generativelanguage.googleapis.com/v1beta/models/';
const FW = 'https://api.fireworks.ai/inference/v1/chat/completions';
const MST = 'https://api.mistral.ai/v1/chat/completions';

class AITeam {
  constructor(name, providers) {
    this.name = name;
    this.providers = providers;
    this.idx = 0;
  }

  getProvider() {
    // Prefer tier1, fall back to tier2
    const t1 = this.providers.filter(p => p.enabled && p.usage < p.limit && p.quality === 'tier1');
    const t2 = this.providers.filter(p => p.enabled && p.usage < p.limit && p.quality === 'tier2');
    const pool = t1.length > 0 ? t1 : t2;
    if (!pool.length) return null;
    const p = pool[this.idx % pool.length];
    this.idx++;
    return p;
  }

  resetUsage() {
    this.providers.forEach(p => { p.usage = 0; });
    this.idx = 0;
  }

  getStatus() {
    return this.providers.map(p => ({
      name: p.name,
      usage: p.usage,
      limit: p.limit,
      remaining: p.limit - p.usage,
      enabled: p.enabled,
      exhausted: p.usage >= p.limit,
      quality: p.quality
    }));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEAM ALPHA ⚡ — Powerhouse: DeepSeek reasoning + Cerebras speed + GPT-4o
// Cloudflare Workers AI helper (accountId baked in)
function makeCFProvider(name, model, limit, quality) {
  const key = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const enabled = !!(key && key !== 'undefined' && key.length > 5 && accountId);
  if (!enabled) console.warn(`⚠  CF Provider ${name} disabled — set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID`);
  return { name, type: 'cloudflare', endpoint: null, key, model, usage: 0, limit, enabled, quality, accountId };
}

// Each provider is a fresh object so usage counters are independent per team
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const teamAlpha = new AITeam('Alpha ⚡', [
  makeProvider('α-groq-llama3.3-70b', 'groq', GRQ, process.env.GROQ_API_KEY, 'llama-3.3-70b-versatile', 500, 'tier1'),
  makeProvider('α-groq-llama3.1-70b', 'groq', GRQ, process.env.GROQ_API_KEY, 'llama-3.1-70b-versatile', 500, 'tier1'),
  makeProvider('α-cerebras-llama3.1-70b', 'cerebras', CER, process.env.CEREBRAS_API_KEY, 'llama-3.1-70b', 1000, 'tier1'),
  makeProvider('α-openrouter-deepseek-v3', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'deepseek/deepseek-chat-v3-0324', 1000, 'tier1'),
  makeProvider('α-openrouter-llama4-maverick', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'meta-llama/llama-4-maverick', 1000, 'tier1'),
  makeProvider('α-github-gpt-4o', 'github', GH, process.env.GITHUB_TOKEN, 'gpt-4o', 50, 'tier1'),
  makeProvider('α-gemini-2.5-flash', 'gemini', GEM, process.env.GEMINI_API_KEY, 'gemini-2.5-flash', 250, 'tier1'),
  makeProvider('α-openrouter-llama4-scout', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'meta-llama/llama-4-scout', 1000, 'tier1'),
  makeProvider('α-or-gemini-flash-exp', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'google/gemini-2.0-flash-exp', 1000, 'tier1'),
  makeProvider('α-or-nemotron-70b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'nvidia/llama-3.1-nemotron-70b-instruct', 1000, 'tier1'),
  makeProvider('α-or-mistral-7b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'mistralai/mistral-7b-instruct:free', 1000, 'tier2'),
  makeProvider('α-or-qwen3-8b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'qwen/qwen3-8b:free', 1000, 'tier2'),
  makeProvider('α-or-deepseek-r1-distill', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'deepseek/deepseek-r1-distill-llama-70b', 1000, 'tier1'),
  makeCFProvider('α-cf-llama3.3-70b', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 200, 'tier1'),
  makeProvider('α-groq-llama3.1-8b', 'groq', GRQ, process.env.GROQ_API_KEY, 'llama-3.1-8b-instant', 500, 'tier2'),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEAM BETA 🧠 — Intelligence: Kimi + Qwen + Grok + Cerebras Qwen
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const teamBeta = new AITeam('Beta 🧠', [
  makeProvider('β-cerebras-llama3.1-8b', 'cerebras', CER, process.env.CEREBRAS_API_KEY, 'llama3.1-8b', 1000, 'tier1'),
  makeProvider('β-groq-llama3.3-70b', 'groq', GRQ, process.env.GROQ_API_KEY, 'llama-3.3-70b-versatile', 500, 'tier1'),
  makeProvider('β-openrouter-kimi-k2', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'moonshotai/kimi-k2', 1000, 'tier1'),
  makeProvider('β-openrouter-deepseek-v3', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'deepseek/deepseek-chat-v3-0324', 1000, 'tier1'),
  makeProvider('β-github-gpt-4o-mini', 'github', GH, process.env.GITHUB_TOKEN, 'gpt-4o-mini', 50, 'tier1'),
  makeProvider('β-gemini-2.0-flash', 'gemini', GEM, process.env.GEMINI_API_KEY, 'gemini-2.0-flash', 500, 'tier1'),
  makeProvider('β-openrouter-llama4-maverick', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'meta-llama/llama-4-maverick', 1000, 'tier1'),
  makeProvider('β-mistral-large', 'mistral', MST, process.env.MISTRAL_API_KEY, 'mistral-large-latest', 100, 'tier1'),
  makeProvider('β-openrouter-phi4', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'microsoft/phi-4:free', 1000, 'tier2'),
  makeProvider('β-or-gemma3-12b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'google/gemma-3-12b-it:free', 1000, 'tier2'),
  makeProvider('β-or-mistral-small-24b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'mistralai/mistral-small-3.2-24b-instruct', 1000, 'tier1'),
  makeCFProvider('β-cf-llama3.1-70b', '@cf/meta/llama-3.1-70b-instruct', 200, 'tier1'),
  makeProvider('β-groq-llama3.1-8b', 'groq', GRQ, process.env.GROQ_API_KEY, 'llama-3.1-8b-instant', 500, 'tier2'),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEAM GAMMA 🔥 — Diversity: DeepSeek V3 + Llama4-Scout + GPT-OSS + Mistral
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const teamGamma = new AITeam('Gamma 🔥', [
  makeProvider('γ-groq-llama3.3-70b', 'groq', GRQ, process.env.GROQ_API_KEY, 'llama-3.3-70b-versatile', 500, 'tier1'),
  makeProvider('γ-cerebras-llama3.1-70b', 'cerebras', CER, process.env.CEREBRAS_API_KEY, 'llama-3.1-70b', 1000, 'tier1'),
  makeProvider('γ-openrouter-deepseek-v3', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'deepseek/deepseek-chat-v3-0324', 1000, 'tier1'),
  makeProvider('γ-openrouter-llama4-scout', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'meta-llama/llama-4-scout', 1000, 'tier1'),
  makeProvider('γ-github-deepseek-v3', 'github', GH, process.env.GITHUB_TOKEN, 'deepseek-v3-0324', 150, 'tier1'),
  makeProvider('γ-gemini-1.5-flash', 'gemini', GEM, process.env.GEMINI_API_KEY, 'gemini-2.0-flash-lite', 500, 'tier1'),
  makeProvider('γ-mistral-small', 'mistral', MST, process.env.MISTRAL_API_KEY, 'mistral-small-latest', 100, 'tier1'),
  makeProvider('γ-or-qwen2.5-72b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'qwen/qwen-2.5-72b-instruct', 1000, 'tier1'),
  makeProvider('γ-or-gemma3-27b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'google/gemma-3-27b-it:free', 1000, 'tier1'),
  makeProvider('γ-or-qwen3-14b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'qwen/qwen3-14b', 1000, 'tier1'),
  makeProvider('γ-or-glm4-9b', 'openrouter', OR, process.env.OPENROUTER_API_KEY, 'thudm/glm-4-9b-chat:free', 1000, 'tier2'),
  makeCFProvider('γ-cf-mistral-7b', '@cf/mistral/mistral-7b-instruct-v0.2-lora', 200, 'tier1'),
  makeProvider('γ-fireworks-llama70b', 'fireworks', FW, process.env.FIREWORKS_API_KEY, 'accounts/fireworks/models/llama-v3p1-70b-instruct', 100, 'tier2'),
  makeProvider('γ-groq-llama3.1-8b', 'groq', GRQ, process.env.GROQ_API_KEY, 'llama-3.1-8b-instant', 500, 'tier2'),
]);

// All 3 teams
const allTeams = [teamAlpha, teamBeta, teamGamma];
// Content Engine State - TOPIC-BASED GENERATION
let contentEngine = {
  running: false,
  collected: [],
  currentTopic: null,
  topicComplete: false,
  totalGenerated: 0,
  paused: false,
  startedAt: null,
  error: null,
  coverage: {
    formulas: [],
    topics: [],
    difficulty_distribution: { Easy: 0, Medium: 0, Hard: 0 }
  }
};

// POST /api/content-engine/start
router.post('/start', auth, verifyAdmin, async (req, res) => {
  try {
    const { category, subcategory, topicType } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    if (contentEngine.running && !contentEngine.paused) {
      return res.status(400).json({ success: false, message: 'Content engine already running' });
    }

    if (contentEngine.paused) {
      contentEngine.paused = false;
      contentEngine.error = null;
      return res.json({ success: true, message: 'Content engine resumed', progress: contentEngine.totalGenerated });
    }

    // Start new topic-based collection
    contentEngine.running = true;
    contentEngine.collected = [];
    contentEngine.currentTopic = { category, subcategory, topicType: topicType || 'complete' };
    contentEngine.topicComplete = false;
    contentEngine.totalGenerated = 0;
    contentEngine.paused = false;
    contentEngine.startedAt = new Date();
    contentEngine.error = null;
    contentEngine.coverage = {
      formulas: [],
      topics: [],
      difficulty_distribution: { Easy: 0, Medium: 0, Hard: 0 }
    };

    res.json({
      success: true,
      message: `Starting ${topicType || 'complete'} content generation for ${subcategory}`,
      topic: contentEngine.currentTopic
    });

    startCollection().catch(err => {
      console.error('Content engine error:', err);
      contentEngine.error = err.message;
      contentEngine.running = false;
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/content-engine/stop
router.post('/stop', auth, verifyAdmin, async (req, res) => {
  contentEngine.paused = true;
  res.json({
    success: true,
    message: 'Content engine paused',
    progress: contentEngine.totalGenerated,
    collected: contentEngine.collected.length,
    coverage: contentEngine.coverage
  });
});

// POST /api/content-engine/reset
router.post('/reset', auth, verifyAdmin, async (req, res) => {
  contentEngine.running = false;
  contentEngine.collected = [];
  contentEngine.currentTopic = null;
  contentEngine.topicComplete = false;
  contentEngine.totalGenerated = 0;
  contentEngine.paused = false;
  contentEngine.error = null;
  contentEngine.coverage = {
    formulas: [],
    topics: [],
    difficulty_distribution: { Easy: 0, Medium: 0, Hard: 0 }
  };

  // Reset all 3 team usage counters
  allTeams.forEach(t => t.resetUsage());

  res.json({ success: true, message: 'Content engine reset (all 3 teams reset)' });
});

// GET /api/content-engine/status
router.get('/status', auth, verifyAdmin, async (req, res) => {
  res.json({
    success: true,
    running: contentEngine.running,
    paused: contentEngine.paused,
    currentTopic: contentEngine.currentTopic,
    topicComplete: contentEngine.topicComplete,
    totalGenerated: contentEngine.totalGenerated,
    collected: contentEngine.collected.length,
    startedAt: contentEngine.startedAt,
    error: contentEngine.error,
    coverage: contentEngine.coverage,
    teams: {
      alpha: { name: teamAlpha.name, providers: teamAlpha.getStatus() },
      beta: { name: teamBeta.name, providers: teamBeta.getStatus() },
      gamma: { name: teamGamma.name, providers: teamGamma.getStatus() }
    }
  });
});

// GET /api/content-engine/preview
router.get('/preview', auth, verifyAdmin, async (req, res) => {
  res.json({
    success: true,
    items: contentEngine.collected,
    total: contentEngine.collected.length
  });
});

// GET /api/content-engine/test-providers — test one call per team, return results
router.get('/test-providers', auth, verifyAdmin, async (req, res) => {
  const results = [];
  for (const team of allTeams) {
    const provider = team.getProvider();
    if (!provider) { results.push({ team: team.name, status: 'no_provider' }); continue; }
    try {
      const text = await callAI(provider, 'Say "OK" and nothing else.');
      results.push({ team: team.name, provider: provider.name, status: 'ok', response: text.substring(0, 80) });
    } catch (err) {
      results.push({ team: team.name, provider: provider.name, status: 'error', error: err.message });
    }
  }
  res.json({ success: true, results });
});

// DELETE /api/content-engine/item/:index
router.delete('/item/:index', auth, verifyAdmin, async (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= contentEngine.collected.length) {
    return res.status(400).json({ success: false, message: 'Invalid index' });
  }

  contentEngine.collected.splice(index, 1);
  res.json({ success: true, message: 'Item removed from queue' });
});

// DELETE /api/content-engine/clear
router.delete('/clear', auth, verifyAdmin, async (req, res) => {
  contentEngine.collected = [];
  res.json({ success: true, message: 'Queue cleared' });
});

// POST /api/content-engine/preview-pdf-stream
router.post('/preview-pdf-stream', auth, verifyAdmin, async (req, res) => {
  try {
    const item = req.body;
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=preview.pdf');

    doc.pipe(res);
    renderPdfContent(doc, item);
    doc.end();
  } catch (err) {
    console.error('PDF Preview Error:', err);
    res.status(500).send('Error generating preview');
  }
});

// POST /api/content-engine/approve
router.post('/approve', auth, verifyAdmin, async (req, res) => {
  try {
    const { items } = req.body;
    const Material = require('../models/Material');

    let published = 0;
    for (const item of items) {
      if (!item.approved) continue;

      // Generate watermarked PDF
      const pdfPath = await generateWatermarkedPDF(item);

      const affordablePrice = item.difficulty === 'Easy' ? 5 : item.difficulty === 'Hard' ? 15 : 9;
      await Material.create({
        title: item.title,
        examCategory: item.category,
        subcategory: item.subcategory,
        examLabel: item.category,
        pricePerDay: affordablePrice,
        pdfUrl: pdfPath,
        description: item.content ? item.content.substring(0, 500) : `${item.category} - ${item.subcategory} study material`,
        difficulty: item.difficulty || 'Medium',
        pages: item.pages || 3,
        author: 'ScholarStock AI',
        isActive: true
      });
      published++;
    }

    res.json({ success: true, message: `${published} items published`, published });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper function to render PDF content (extracted from generateWatermarkedPDF)
function renderPdfContent(doc, item) {
  // ── Font setup: DejaVu for full Unicode, fallback to Helvetica ──
  let bodyFont = 'Helvetica';
  let boldFont = 'Helvetica-Bold';

  if (fs.existsSync(DEJAVU_PATH)) {
    try {
      doc.registerFont('DejaVu', DEJAVU_PATH);
      bodyFont = 'DejaVu';
    } catch (e) { /* fallback */ }
  }
  if (fs.existsSync(DEJAVU_BOLD_PATH)) {
    try {
      doc.registerFont('DejaVuBold', DEJAVU_BOLD_PATH);
      boldFont = 'DejaVuBold';
    } catch (e) { boldFont = bodyFont; }
  } else {
    boldFont = bodyFont;
  }

  const W = doc.page.width;
  const H = doc.page.height;
  const L = 50; // left margin
  const R = W - 50; // right edge
  const CW = R - L; // content width

  // ── Helper: add a new page with border + mini-header ──
  function newPage(title) {
    doc.addPage();
    doc.rect(20, 20, W - 40, H - 40).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.rect(0, 0, W, 50).fill('#0f172a');
    doc.fontSize(10).fillColor('#94a3b8').font(bodyFont)
      .text(`ScholarStock  •  ${item.category}  •  ${item.subcategory}  •  ${title}`, L, 18, { width: CW, align: 'center' });
    doc.y = 70;
  }

  // ── Helper: section heading ──
  function sectionHeading(text, color = '#3b82f6') {
    if (doc.y > H - 120) newPage(text);
    doc.moveDown(0.5);
    doc.fontSize(13).fillColor(color).font(boldFont).text(text.toUpperCase(), L, doc.y);
    doc.moveTo(L, doc.y + 2).lineTo(R, doc.y + 2).strokeColor(color).lineWidth(1).stroke();
    doc.moveDown(0.8);
  }

  // ── Helper: body text ──
  function bodyText(text, opts = {}) {
    doc.fontSize(10.5).fillColor('#334155').font(bodyFont)
      .text(text, L, doc.y, { width: CW, align: 'justify', lineGap: 3, paragraphGap: 6, ...opts });
  }

  // ── Helper: numbered list ──
  function numberedList(lines, color = '#1e293b') {
    lines.forEach((line, i) => {
      if (doc.y > H - 80) newPage('continued');
      doc.fontSize(10).fillColor(color).font(bodyFont)
        .text(`${i + 1}.  ${line}`, L + 10, doc.y, { width: CW - 10, lineGap: 2, paragraphGap: 5 });
    });
  }

  // ══════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════
  doc.rect(20, 20, W - 40, H - 40).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  doc.rect(0, 0, W, 80).fill('#0f172a');
  doc.fontSize(26).fillColor('#60a5fa').font(boldFont).text('ScholarStock', L, 25);
  doc.fontSize(10).fillColor('#94a3b8').font(bodyFont).text('ULTIMATE PREP SERIES', L, 52);
  doc.rect(W - 200, 25, 150, 30).fill('#1e293b');
  doc.fontSize(11).fillColor('#ffffff').font(boldFont)
    .text(`${item.category} EXAM`, W - 200, 34, { align: 'center', width: 150 });

  doc.y = 110;
  doc.fontSize(22).fillColor('#1e293b').font(boldFont).text(item.title, { align: 'center', width: CW + L });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor('#64748b').font(bodyFont)
    .text(`Topic: ${item.subcategory}  |  Difficulty: ${item.difficulty || 'Medium'}`, { align: 'center', width: CW + L });
  doc.moveDown(1.5);
  doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor('#3b82f6').lineWidth(2).stroke();
  doc.moveDown(1.5);

  // ── 1. Theory ──
  if (item.theory) {
    sectionHeading('Concept Overview', '#0f172a');
    bodyText(item.theory);
    doc.moveDown(1);
  }

  // ── 2. Formulas ──
  if (item.formulas && item.formulas.length > 0) {
    sectionHeading('Key Formulas & Constants', '#3b82f6');
    const startY = doc.y;
    const boxH = item.formulas.length * 22 + 16;
    doc.rect(L, startY, CW, boxH).fill('#f8fafc');
    doc.rect(L, startY, 4, boxH).fill('#3b82f6');
    item.formulas.forEach((f, i) => {
      doc.fontSize(10).fillColor('#1e293b').font(boldFont)
        .text(`${i + 1}. `, L + 10, startY + 10 + i * 22, { continued: true })
        .font(bodyFont).text(f);
    });
    doc.y = startY + boxH + 10;
    doc.moveDown(1);
  }

  // ── 3. Solved Examples ──
  if (item.solvedExamples && item.solvedExamples.length > 0) {
    newPage('Solved Examples');
    sectionHeading('Solved Examples', '#0f172a');
    item.solvedExamples.forEach((ex, i) => {
      if (doc.y > H - 120) newPage('Solved Examples');
      doc.fontSize(10.5).fillColor('#1e293b').font(boldFont)
        .text(`Example ${i + 1}: `, L, doc.y, { continued: true })
        .font(bodyFont).fillColor('#334155').text(ex.question, { width: CW });
      doc.moveDown(0.4);
      doc.fontSize(10.5).fillColor('#059669').font(boldFont)
        .text('Solution: ', L + 10, doc.y, { continued: true })
        .font(bodyFont).fillColor('#334155').text(ex.solution, { width: CW - 10 });
      doc.moveDown(1.2);
    });
  }

  // ── 4. MCQs ──
  if (item.mcqs && item.mcqs.length > 0) {
    newPage('Practice MCQs');
    doc.fontSize(14).fillColor('#60a5fa').font(boldFont).text('PRACTICE QUESTIONS (MCQs)', L, doc.y);
    doc.moveDown(1);
    item.mcqs.forEach((mcq, i) => {
      if (doc.y > H - 140) newPage('Practice MCQs');
      doc.fontSize(10.5).fillColor('#1e293b').font(boldFont)
        .text(`Q${i + 1}. `, L, doc.y, { continued: true })
        .font(bodyFont).text(mcq.q, { width: CW });
      doc.moveDown(0.4);
      const optY = doc.y;
      mcq.options.forEach((opt, idx) => {
        const xPos = idx % 2 === 0 ? L + 10 : W / 2 + 10;
        const yPos = optY + Math.floor(idx / 2) * 18;
        doc.fontSize(9.5).fillColor('#475569').font(bodyFont).text(opt, xPos, yPos, { width: CW / 2 - 20 });
      });
      doc.y = optY + Math.ceil(mcq.options.length / 2) * 18 + 6;
      doc.fontSize(9.5).fillColor('#059669').font(boldFont)
        .text('Answer: ', L + 10, doc.y, { continued: true })
        .font(bodyFont).text(mcq.answer);
      if (mcq.explanation) {
        doc.fontSize(9).fillColor('#64748b').font(bodyFont)
          .text(`Explanation: ${mcq.explanation}`, L + 10, doc.y, { width: CW - 10 });
      }
      doc.moveDown(1.2);
    });
  }

  // ── 5. Syllabus Map ──
  if (item.syllabusMap) {
    newPage('Syllabus Map');
    sectionHeading('Syllabus Map & Weightage', '#8b5cf6');
    bodyText(item.syllabusMap);
    doc.moveDown(1);
  }

  // ── 6. Deep Dive ──
  if (item.deepDive) {
    newPage('Deep Dive');
    sectionHeading('Advanced Deep Dive', '#0f172a');
    bodyText(item.deepDive);
    doc.moveDown(1);
  }

  // ── 7. Memory Tricks ──
  if (item.memoryTricks) {
    newPage('Memory Tricks');
    sectionHeading('Memory Tricks & Mnemonics', '#10b981');
    const tricks = item.memoryTricks.split('\n').map(l => l.replace(/^\d+[\.\):\-]\s*/, '').trim()).filter(Boolean);
    numberedList(tricks, '#1e293b');
    doc.moveDown(1);
  }

  // ── 8. Common Mistakes ──
  if (item.commonMistakes) {
    newPage('Common Mistakes');
    sectionHeading('Common Mistakes to Avoid', '#ef4444');
    const mistakes = item.commonMistakes.split('\n').map(l => l.replace(/^\d+[\.\):\-]\s*/, '').trim()).filter(Boolean);
    numberedList(mistakes, '#7f1d1d');
    doc.moveDown(1);
  }

  // ── 9. Previous Year Questions ──
  if (item.prevYearQuestions) {
    newPage('Previous Year Questions');
    sectionHeading('Previous Year Questions', '#eab308');
    bodyText(item.prevYearQuestions);
    doc.moveDown(1);
  }

  // ── Watermark on all pages ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.opacity(0.04);
    doc.fontSize(55).fillColor('#3b82f6').font(boldFont);
    for (let y = 100; y < H; y += 240) {
      for (let x = -50; x < W; x += 320) {
        doc.save();
        doc.translate(x, y).rotate(-35);
        doc.text('ScholarStock', 0, 0);
        doc.restore();
      }
    }
    doc.restore();
    // Footer
    const footerY = H - 38;
    doc.rect(0, footerY - 8, W, 46).fill('#0f172a');
    doc.fontSize(8.5).fillColor('#94a3b8').font(bodyFont)
      .text(`© ScholarStock  •  PREMIUM SERIES  •  Page ${i + 1} of ${range.count}`, L, footerY, { align: 'center', width: CW });
  }
}

// Generate a watermarked PDF and upload to Supabase Storage
function generateWatermarkedPDF(item) {
  return new Promise(async (resolve, reject) => {
    const filename = `generated/${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, buffer, { contentType: 'application/pdf', upsert: false });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
        resolve(urlData.publicUrl);
      } catch (err) { reject(err); }
    });

    renderPdfContent(doc, item);
    doc.end();
  });
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COLLECTION LOOP — 3 teams work in parallel each cycle, producing 3 PDFs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function startCollection() {
  const { category, subcategory } = contentEngine.currentTopic;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Content Engine: 3-Team Parallel Mode`);
  console.log(`  Topic: ${category} > ${subcategory}`);
  console.log(`${'═'.repeat(60)}\n`);

  let cycleNum = 0;
  let consecutiveFailures = 0;
  const maxCycleFailures = 5;

  while (contentEngine.running && !contentEngine.topicComplete) {
    if (contentEngine.paused) {
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    cycleNum++;
    const batchIndex = contentEngine.totalGenerated;
    console.log(`\n┌─ Cycle #${cycleNum} | Starting 3 teams in parallel ─┐`);

    try {
      // All 3 teams run their full 10-stage pipeline simultaneously
      const [resultA, resultB, resultC] = await Promise.all([
        runTeamPipeline(teamAlpha, batchIndex + 1),
        runTeamPipeline(teamBeta, batchIndex + 2),
        runTeamPipeline(teamGamma, batchIndex + 3)
      ]);

      // Collect all 3 results
      for (const result of [resultA, resultB, resultC]) {
        if (result) {
          contentEngine.collected.push(result);
          contentEngine.totalGenerated++;
          if (result.formulas) contentEngine.coverage.formulas.push(...result.formulas);
          if (result.topicsCovered) contentEngine.coverage.topics.push(...result.topicsCovered);
          if (result.difficulty) contentEngine.coverage.difficulty_distribution[result.difficulty]++;
        }
      }

      consecutiveFailures = 0;
      console.log(`└─ Cycle #${cycleNum} complete | Total collected: ${contentEngine.totalGenerated} ─┘\n`);

      if (contentEngine.collected.length >= 500) {
        contentEngine.topicComplete = true;
        console.log('Content engine: Maximum 500 items reached!');
        break;
      }

    } catch (err) {
      console.error(`Cycle #${cycleNum} error: ${err.message}`);
      consecutiveFailures++;
      if (consecutiveFailures >= maxCycleFailures) {
        contentEngine.error = `Too many cycle failures: ${err.message}`;
        contentEngine.running = false;
        break;
      }
    }

    // Brief pause between cycles to respect rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  if (contentEngine.running && !contentEngine.paused) {
    console.log('Content engine: Collection complete!');
    contentEngine.running = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MULTI-STAGE PIPELINE — Each AI does ONE focused job, outputs plain text
// ═══════════════════════════════════════════════════════════════════════

// ── Low-level helper: call a single AI provider, return plain text ──
async function callAI(provider, prompt) {
  const headers = {
    'Authorization': `Bearer ${provider.key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://scholarstock.com',
    'X-Title': 'ScholarStock Content Engine'
  };
  const timeout = 90000;

  let response;
  switch (provider.type) {
    case 'openrouter':
    case 'cerebras':
    case 'github':
    case 'together':
    case 'deepseek':
    case 'fireworks':
    case 'groq':
    case 'mistral': {
      response = await axios.post(provider.endpoint, {
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.7
      }, { headers, timeout });
      return response.data.choices[0].message.content || '';
    }

    case 'huggingface': {
      response = await axios.post(`${provider.endpoint}${provider.model}`, {
        inputs: prompt,
        parameters: { max_new_tokens: 2048, temperature: 0.7 }
      }, { headers, timeout });
      return response.data[0]?.generated_text || '';
    }

    case 'gemini': {
      response = await axios.post(
        `${provider.endpoint}${provider.model}:generateContent?key=${provider.key}`,
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4096, temperature: 0.7 } },
        { timeout }
      );
      return response.data.candidates[0].content.parts[0].text || '';
    }

    case 'ai21': {
      response = await axios.post(`${provider.endpoint}${provider.model}/complete`, {
        prompt, maxTokens: 4096, temperature: 0.7
      }, { headers, timeout });
      return response.data.completions[0].data.text || '';
    }

    case 'cloudflare': {
      // Cloudflare Workers AI — uses account ID in URL, Bearer token auth
      response = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${provider.accountId}/ai/run/${provider.model}`,
        { messages: [{ role: 'user', content: prompt }], max_tokens: 2048 },
        { headers: { 'Authorization': `Bearer ${provider.key}`, 'Content-Type': 'application/json' }, timeout }
      );
      return response.data.result?.response || '';
    }

    default:
      throw new Error(`Unknown provider type: ${provider.type}`);
  }
}

// ── Mid-level helper: retry within a specific team ──
async function callAIWithRetry(team, prompt, maxRetries = 3) {
  let lastErr = 'No providers available';
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const provider = team.getProvider();
    if (!provider) throw new Error(`[${team.name}] All providers exhausted`);

    // Skip providers with no API key configured
    if (!provider.key || provider.key === 'undefined') {
      console.warn(`  [${team.name}] ⚠ ${provider.name} — no API key, skipping`);
      provider.enabled = false;
      continue;
    }

    try {
      console.log(`  [${team.name}] → ${provider.name} (attempt ${attempt}/${maxRetries})`);
      const text = await callAI(provider, prompt);
      provider.usage++;
      if (text && text.trim().length > 20) return text.trim();
      throw new Error('Response too short or empty');
    } catch (err) {
      lastErr = err.message;
      console.warn(`  [${team.name}] ✗ ${provider.name} failed: ${err.message}`);
    }
  }
  throw new Error(`[${team.name}] All retries failed. Last error: ${lastErr}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 1 — RESEARCH
// Goal: Get a structured list of key concepts for the topic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageResearch(team, category, topicLabel) {
  const prompt =
    `You are a world-class exam content researcher for the ${category} exam.

List the 10 most important concepts, subtopics, and key facts about "${topicLabel}" that appear in the ${category} exam.

OUTPUT RULES:
- Numbered list only. One concept per line.
- Plain text. No JSON. No markdown. No LaTeX backslashes.
- Use Unicode symbols if helpful (θ, π, ², √, ∞, Σ, Δ).
- Be specific to the ${category} syllabus.

1. `;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 2 — THEORY
// Goal: 3 clear paragraphs of conceptual explanation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageTheory(team, category, topicLabel, researchPoints) {
  const prompt =
    `You are an expert textbook author writing premium study material for the ${category} exam.

Key research points for "${topicLabel}":
${researchPoints}

Write a clear, in-depth conceptual explanation of "${topicLabel}" for ${category} students.

OUTPUT RULES:
- Exactly 3 well-structured paragraphs of flowing prose.
- Plain text only. No bullet points. No headings. No JSON. No LaTeX backslashes.
- Use Unicode symbols where needed (θ, π, ², √, Σ, Δ, ±, ≤, ≥, ≈).
- Begin directly with the explanation. No preamble like "Here is the theory:".`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 3 — FORMULAS
// Goal: A clean numbered list of key formulas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageFormulas(team, category, topicLabel) {
  const prompt =
    `You are an expert at ${category} exam preparation.

List all key formulas for "${topicLabel}" used in the ${category} exam.

OUTPUT FORMAT — numbered list, one formula per line:
1. [Formula Name]: [expression]
2. [Formula Name]: [expression]
...

CRITICAL RULES:
- Use UNICODE SYMBOLS ONLY: θ, π, α, β, λ, μ, ², ³, √, ∞, Σ, Δ, ±, ≤, ≥, ≈
- Write fractions as (a/b), e.g.: KE = (1/2)mv²
- ABSOLUTELY NO LaTeX backslashes (no \\frac, \\cos, \\theta, \\sqrt, \\alpha)
- Plain text only. No JSON. No markdown.

1. `;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 4 — SOLVED EXAMPLES
// Goal: 3 step-by-step solved problems in a parseable plain-text format
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageSolvedExamples(team, category, topicLabel) {
  const prompt =
    `You are an expert ${category} exam tutor.

Create 3 original, detailed step-by-step solved problems about "${topicLabel}" for the ${category} exam.

OUTPUT — use this EXACT format with no deviations:

PROBLEM 1: [state the problem clearly with specific numbers]
SOLUTION: [step-by-step solution, explain every step]
---
PROBLEM 2: [state the problem]
SOLUTION: [step-by-step solution]
---
PROBLEM 3: [state the problem]
SOLUTION: [step-by-step solution]

CRITICAL RULES:
- Use UNICODE SYMBOLS ONLY (θ, π, ², √). NO LaTeX backslashes.
- Change all numbers from standard textbook problems to make them original.
- Plain text only. No JSON. No markdown. Start with "PROBLEM 1:".`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 5 — MCQs
// Goal: 8 MCQs in a parseable plain-text format
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageMCQs(team, category, topicLabel) {
  const prompt =
    `You are an expert ${category} exam question setter.

Generate 8 original MCQ practice questions about "${topicLabel}" for the ${category} exam.

OUTPUT — use this EXACT format for EVERY question:

Q1: [question text]
A) [option]
B) [option]
C) [option]
D) [option]
ANSWER: [A or B or C or D]
EXPLANATION: [concise explanation of why the answer is correct]
---
Q2: [question text]
A) [option]
B) [option]
C) [option]
D) [option]
ANSWER: [A or B or C or D]
EXPLANATION: [explanation]
---

CRITICAL RULES:
- Use UNICODE SYMBOLS ONLY. NO LaTeX backslashes.
- Vary difficulty: 3 Easy, 3 Medium, 2 Hard.
- Each question must be clearly distinct and original.
- Plain text only. No JSON. No markdown. Start with "Q1:".`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 6 — SYLLABUS MAP
// Goal: Show which subtopics appear in the exam and their weightage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageSyllabusMap(team, category, topicLabel) {
  const prompt =
    `You are an expert ${category} exam analyst.

Create a syllabus map for "${topicLabel}" in the ${category} exam.

OUTPUT FORMAT:
1. [Subtopic Name] — [Weightage: High/Medium/Low] — [Typical marks: X marks]
2. [Subtopic Name] — [Weightage: High/Medium/Low] — [Typical marks: X marks]
...
NOTES: [1-2 lines on which subtopics appear most frequently]

RULES:
- Plain text only. No JSON. No markdown. List 6-10 subtopics.
- Be specific to the actual ${category} exam pattern.`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 7 — DEEP DIVE
// Goal: Advanced theory, edge cases, and common misconceptions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageDeepDive(team, category, topicLabel, theoryText) {
  const prompt =
    `You are an expert ${category} exam teacher who specialises in advanced understanding.

Core theory already covered for "${topicLabel}":
${theoryText.substring(0, 400)}...

Now write an advanced deep-dive covering:
- 2 non-obvious concepts or edge cases
- 2 frequent misconceptions students have and why they are wrong
- 1 real-world application or physical intuition for this topic

RULES:
- Plain text, flowing prose. 3-4 paragraphs.
- No JSON. No LaTeX backslashes. Use Unicode symbols (θ, π, ², √, Δ, Σ).
- Begin directly. No preamble.`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 8 — MEMORY TRICKS & MNEMONICS
// Goal: Quick recall aids for exam conditions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageMemoryTricks(team, category, topicLabel) {
  const prompt =
    `You are a ${category} exam coaching expert who specialises in memory techniques.

Provide 6-8 memory tricks, mnemonics, and rapid recall tips for "${topicLabel}" in the ${category} exam.

OUTPUT FORMAT — numbered list:
1. [Trick name]: [explanation and how to use it]
2. [Trick name]: [explanation]
...

RULES:
- Be creative and genuinely useful. Acronyms, visual hooks, pattern tricks all count.
- Plain text only. No JSON. No markdown. Each trick on one line.
- Use Unicode math symbols where needed (θ, π, ², √). No LaTeX.`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 9 — COMMON MISTAKES
// Goal: Top errors students make and how to avoid them
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageCommonMistakes(team, category, topicLabel) {
  const prompt =
    `You are an expert ${category} exam examiner who has graded thousands of papers.

List the 8 most common mistakes students make in "${topicLabel}" during the ${category} exam.

OUTPUT FORMAT — numbered list:
1. MISTAKE: [what the student does wrong] | FIX: [how to avoid it]
2. MISTAKE: [mistake] | FIX: [fix]
...

RULES:
- Be specific and actionable. These should be real exam errors.
- Plain text only. No JSON. No markdown. Use Unicode symbols if needed. No LaTeX.`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 10 — PREVIOUS YEAR QUESTIONS
// Goal: 5 past-exam-style questions with model answers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stagePrevYearQuestions(team, category, topicLabel) {
  const prompt =
    `You are an expert ${category} exam historian with access to past papers.

Generate 5 previous-year-style questions on "${topicLabel}" for the ${category} exam.
Each question should mirror the style, difficulty, and format of real ${category} past papers.

OUTPUT — use this EXACT format:

PYQ 1: [question text with specific numbers]
ANSWER: [concise model answer or key steps]
MARKS: [typical marks, e.g. 4 marks]
---
PYQ 2: [question text]
ANSWER: [model answer]
MARKS: [marks]
---

CRITICAL RULES:
- Use UNICODE SYMBOLS ONLY (θ, π, ², √, Σ, Δ). NO LaTeX backslashes.
- Make questions feel authentic to the ${category} exam standard.
- Plain text only. No JSON. No markdown. Start with "PYQ 1:".`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ASSEMBLY PARSERS — Pure code, zero AI, zero JSON risk
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseFormulas(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => line.replace(/^\d+[\.\):\-]\s*/, '').trim())
    .filter(line => line.length > 4 && (line.includes(':') || line.includes('=') || line.includes('(')));
}

function parseSolvedExamples(text) {
  if (!text) return [];
  const examples = [];
  const blocks = text.split(/---+/).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const probMatch = block.match(/PROBLEM\s*\d+:\s*([\s\S]*?)(?=SOLUTION:)/i);
    const solMatch = block.match(/SOLUTION:\s*([\s\S]*)/i);
    if (probMatch && solMatch) {
      examples.push({
        question: probMatch[1].trim(),
        solution: solMatch[1].trim()
      });
    }
  }
  return examples;
}

function parseMCQs(text) {
  if (!text) return [];
  const mcqs = [];
  const blocks = text.split(/---+/).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const qMatch = block.match(/Q\d+:\s*([\s\S]*?)(?=\nA\))/i);
    const aMatch = block.match(/^A\)\s*(.+)/im);
    const bMatch = block.match(/^B\)\s*(.+)/im);
    const cMatch = block.match(/^C\)\s*(.+)/im);
    const dMatch = block.match(/^D\)\s*(.+)/im);
    const ansMatch = block.match(/ANSWER:\s*([A-D])/i);
    const expMatch = block.match(/EXPLANATION:\s*([\s\S]*?)(?=---|$)/i);

    if (qMatch && ansMatch) {
      mcqs.push({
        q: qMatch[1].trim(),
        options: [
          `A) ${aMatch ? aMatch[1].trim() : 'Option A'}`,
          `B) ${bMatch ? bMatch[1].trim() : 'Option B'}`,
          `C) ${cMatch ? cMatch[1].trim() : 'Option C'}`,
          `D) ${dMatch ? dMatch[1].trim() : 'Option D'}`
        ],
        answer: ansMatch[1].trim(),
        explanation: expMatch ? expMatch[1].trim() : ''
      });
    }
  }
  return mcqs;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEAM PIPELINE — one team's full 10-stage run, isolated to its own providers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function runTeamPipeline(team, index) {
  const { category, subcategory, topicType } = contentEngine.currentTopic;
  const topicLabel = subcategory || `All ${category} topics`;
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const difficulty = difficulties[index % 3];

  console.log(`[Pipeline #${index}] [${team.name}] ${category} > ${topicLabel} | ${difficulty}`);

  try {
    // Stage 1: Research
    console.log(`[${team.name}] Stage 1/10: Research...`);
    const researchText = await stageResearch(team, category, topicLabel);
    console.log(`[${team.name}] Stage 1 done (${researchText.length} chars)`);

    // Stage 2: Theory
    console.log(`[${team.name}] Stage 2/10: Theory...`);
    const theoryText = await stageTheory(team, category, topicLabel, researchText);
    console.log(`[${team.name}] Stage 2 done (${theoryText.length} chars)`);

    // Stage 3: Formulas
    let formulas = [];
    if (topicType !== 'questions') {
      console.log(`[${team.name}] Stage 3/10: Formulas...`);
      const formulasText = await stageFormulas(team, category, topicLabel);
      formulas = parseFormulas(formulasText);
      console.log(`[${team.name}] Stage 3 done (${formulas.length} formulas)`);
    } else {
      console.log(`[${team.name}] Stage 3/10: Formulas skipped (question-only mode)`);
    }

    // Stage 4: Solved Examples
    console.log(`[${team.name}] Stage 4/10: Solved Examples...`);
    const examplesText = await stageSolvedExamples(team, category, topicLabel);
    const solvedExamples = parseSolvedExamples(examplesText);
    console.log(`[${team.name}] Stage 4 done (${solvedExamples.length} examples)`);

    // Stage 5: MCQs
    console.log(`[${team.name}] Stage 5/10: MCQs...`);
    const mcqsText = await stageMCQs(team, category, topicLabel);
    const mcqs = parseMCQs(mcqsText);
    console.log(`[${team.name}] Stage 5 done (${mcqs.length} MCQs)`);

    // Stage 6: Syllabus Map
    console.log(`[${team.name}] Stage 6/10: Syllabus Map...`);
    const syllabusMap = await stageSyllabusMap(team, category, topicLabel);
    console.log(`[${team.name}] Stage 6 done (${syllabusMap.length} chars)`);

    // Stage 7: Deep Dive
    console.log(`[${team.name}] Stage 7/10: Deep Dive...`);
    const deepDive = await stageDeepDive(team, category, topicLabel, theoryText);
    console.log(`[${team.name}] Stage 7 done (${deepDive.length} chars)`);

    // Stage 8: Memory Tricks
    console.log(`[${team.name}] Stage 8/10: Memory Tricks...`);
    const memoryTricks = await stageMemoryTricks(team, category, topicLabel);
    console.log(`[${team.name}] Stage 8 done (${memoryTricks.length} chars)`);

    // Stage 9: Common Mistakes
    console.log(`[${team.name}] Stage 9/10: Common Mistakes...`);
    const commonMistakes = await stageCommonMistakes(team, category, topicLabel);
    console.log(`[${team.name}] Stage 9 done (${commonMistakes.length} chars)`);

    // Stage 10: Previous Year Questions
    console.log(`[${team.name}] Stage 10/10: Previous Year Questions...`);
    const prevYearQuestions = await stagePrevYearQuestions(team, category, topicLabel);
    console.log(`[${team.name}] Stage 10 done (${prevYearQuestions.length} chars)`);

    const result = {
      title: `${category} - ${topicLabel}: Master Class Sheet ${index}`,
      category,
      subcategory: topicLabel,
      difficulty,
      theory: theoryText,
      formulas,
      solvedExamples,
      mcqs,
      syllabusMap,
      deepDive,
      memoryTricks,
      commonMistakes,
      prevYearQuestions,
      topicsCovered: [topicLabel],
      topicComplete: false,
      references: [`Official ${category} Prep Guide`, 'ScholarStock AI Content Engine'],
      suggestedPrice: difficulty === 'Easy' ? 5 : difficulty === 'Hard' ? 15 : 9,
      pages: 10,
      approved: false,
      fileUrl: null
    };

    console.log(`[Pipeline #${index}] Complete — all 10 stages done`);
    return result;

  } catch (err) {
    console.error(`[Pipeline #${index}] FAILED: ${err.message}`);
    const { category: cat, subcategory: sub } = contentEngine.currentTopic || {};
    return {
      title: `${cat || 'Exam'} - ${sub || 'Topic'} (Pipeline Error #${index})`,
      category: cat || 'Unknown',
      subcategory: sub || 'Unknown',
      difficulty,
      theory: `Pipeline generation failed: ${err.message}. Please retry.`,
      formulas: [],
      solvedExamples: [],
      mcqs: [],
      syllabusMap: '',
      deepDive: '',
      memoryTricks: '',
      commonMistakes: '',
      prevYearQuestions: '',
      topicsCovered: [],
      topicComplete: false,
      suggestedPrice: 9,
      pages: 1,
      approved: false,
      fileUrl: null
    };
  }
}

module.exports = router;
