const express = require('express');
const router = express.Router();
const { auth, verifyAdmin } = require('../middleware/auth');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const DraftMaterial = require('../models/DraftMaterial');

// ── Environment Sanitization Helper ──
const getEnv = (key) => {
  const val = process.env[key];
  if (!val || val === 'undefined') return '';
  return val.replace(/['"]/g, '').trim();
};

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

// ── Supabase client for PDF storage ──
const SUPABASE_BUCKET = getEnv('SUPABASE_BUCKET') || 'materials';
const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_KEY') || getEnv('SUPABASE_ANON_KEY');

// Auto-create bucket if it doesn't exist (if supabase is available)
async function ensureBucket() {
  if (!supabase) return;
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

// Helper for Cloudflare Workers AI
function makeCFProvider(name, model, limit, quality) {
  const cfKey = getEnv('CLOUDFLARE_API_KEY') || getEnv('CF_API_KEY') || getEnv('CLOUDFLARE_API_TOKEN') || getEnv('CLOUDFLARE_TOKEN');
  const cfAccount = getEnv('CLOUDFLARE_ACCOUNT_ID') || getEnv('CF_ACCOUNT_ID');

  return makeProvider(
    name, 
    'cloudflare', 
    null, 
    cfKey, 
    model, 
    limit, 
    quality, 
    cfAccount
  );
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
// TEAM ALPHA ⚡ — Powerhouse: Advanced/Hard Specialist (DeepSeek R1 + GPT-4o)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const teamAlpha = new AITeam('Alpha ⚡', [
  makeProvider('α-groq-llama3.3-70b', 'groq', GRQ, getEnv('GROQ_API_KEY'), 'llama-3.3-70b-versatile', 500, 'tier1'),
  makeProvider('α-cerebras-llama3.1-8b', 'cerebras', CER, getEnv('CEREBRAS_API_KEY'), 'llama3.1-8b', 1000, 'tier1'),
  makeProvider('α-openrouter-deepseek-v3', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'deepseek/deepseek-chat', 1000, 'tier1'),
  makeProvider('α-openrouter-llama3.3', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'meta-llama/llama-3.3-70b-instruct', 1000, 'tier1'),
  makeProvider('α-github-gpt-4o', 'github', GH, getEnv('GITHUB_TOKEN'), 'gpt-4o', 50, 'tier1'),
  makeProvider('α-gemini-2.0-flash', 'gemini', GEM, getEnv('GEMINI_API_KEY'), 'gemini-2.0-flash', 250, 'tier1'),
  makeProvider('α-openrouter-phi4', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'microsoft/phi-4', 1000, 'tier1'),
  makeProvider('α-or-deepseek-r1-distill', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'deepseek/deepseek-r1-distill-llama-70b', 1000, 'tier1'),
  makeCFProvider('α-cf-llama3.3-70b', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 200, 'tier1'),
]);
teamAlpha.role = 'Advanced Theory Specialist';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEAM BETA 🧠 — Intelligence: MCQ/Practice Specialist (Kimi + Qwen + Cerebras)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const teamBeta = new AITeam('Beta 🧠', [
  makeProvider('β-cerebras-llama3.1-8b', 'cerebras', CER, getEnv('CEREBRAS_API_KEY'), 'llama3.1-8b', 1000, 'tier1'),
  makeProvider('β-groq-llama3.3-70b', 'groq', GRQ, getEnv('GROQ_API_KEY'), 'llama-3.3-70b-versatile', 500, 'tier1'),
  makeProvider('β-openrouter-deepseek-chat', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'deepseek/deepseek-chat', 1000, 'tier1'),
  makeProvider('β-github-gpt-4o-mini', 'github', GH, getEnv('GITHUB_TOKEN'), 'gpt-4o-mini', 50, 'tier1'),
  makeProvider('β-gemini-2.0-flash', 'gemini', GEM, getEnv('GEMINI_API_KEY'), 'gemini-2.0-flash', 500, 'tier1'),
  makeProvider('β-openrouter-llama3.1-70b', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'meta-llama/llama-3.1-70b-instruct', 1000, 'tier1'),
  makeProvider('β-mistral-large', 'mistral', MST, getEnv('MISTRAL_API_KEY'), 'mistral-large-latest', 100, 'tier1'),
  makeProvider('β-openrouter-mistral-7b', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'mistralai/mistral-7b-instruct', 1000, 'tier2'),
  makeCFProvider('β-cf-llama3.1-70b', '@cf/meta/llama-3.1-70b-instruct', 200, 'tier1'),
  makeProvider('β-groq-llama3.1-8b', 'groq', GRQ, getEnv('GROQ_API_KEY'), 'llama-3.1-8b-instant', 500, 'tier2'),
]);
teamBeta.role = 'Mass MCQ & Application Specialist';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEAM GAMMA 🔥 — Diversity: Foundation & Notes Specialist (Gemini + Qwen + Llama)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const teamGamma = new AITeam('Gamma 🔥', [
  makeProvider('γ-groq-llama3.3-70b', 'groq', GRQ, getEnv('GROQ_API_KEY'), 'llama-3.3-70b-versatile', 500, 'tier1'),
  makeProvider('γ-cerebras-llama3.1-70b', 'cerebras', CER, getEnv('CEREBRAS_API_KEY'), 'llama3.1-70b', 1000, 'tier1'),
  makeProvider('γ-openrouter-deepseek-v3', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'deepseek/deepseek-chat', 1000, 'tier1'),
  makeProvider('γ-openrouter-llama3.1-405b', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'meta-llama/llama-3.1-405b-instruct', 1000, 'tier1'),
  makeProvider('γ-github-deepseek-v3', 'github', GH, getEnv('GITHUB_TOKEN'), 'deepseek-v3', 150, 'tier1'),
  makeProvider('γ-gemini-2.0-flash', 'gemini', GEM, getEnv('GEMINI_API_KEY'), 'gemini-2.0-flash', 500, 'tier1'),
  makeProvider('γ-mistral-small', 'mistral', MST, getEnv('MISTRAL_API_KEY'), 'mistral-small-latest', 100, 'tier1'),
  makeProvider('γ-or-qwen2.5-72b', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'qwen/qwen-2.5-72b-instruct', 1000, 'tier1'),
  makeProvider('γ-or-gemma2-27b', 'openrouter', OR, getEnv('OPENROUTER_API_KEY'), 'google/gemma-2-27b-it', 1000, 'tier1'),
  makeCFProvider('γ-cf-mistral-7b', '@cf/mistral/mistral-7b-instruct-v0.2-lora', 200, 'tier1'),
  makeProvider('γ-fireworks-llama70b', 'fireworks', FW, getEnv('FIREWORKS_API_KEY'), 'accounts/fireworks/models/llama-v3p1-70b-instruct', 100, 'tier2'),
  makeProvider('γ-groq-llama3.1-8b', 'groq', GRQ, getEnv('GROQ_API_KEY'), 'llama-3.1-8b-instant', 500, 'tier2'),
]);
teamGamma.role = 'Foundation & Exam Research Specialist';

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

    // Auto-Reset all 3 team usage counters for a fresh topic start
    allTeams.forEach(t => t.resetUsage());

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

// GET /api/content-engine/drafts - NEW: Retrieve persisted drafts from MongoDB
router.get('/drafts', auth, verifyAdmin, async (req, res) => {
  try {
    const drafts = await DraftMaterial.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
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
      .text(text, L, doc.y, { width: CW, align: 'left', lineGap: 5, paragraphGap: 10, ...opts });
  }

  // ── Helper: numbered list ──
  function numberedList(lines, color = '#1e293b') {
    lines.forEach((line, i) => {
      if (doc.y > H - 80) newPage('continued');
      doc.fontSize(10).fillColor(color).font(bodyFont)
        .text(`${i + 1}.  ${line}`, L + 10, doc.y, { width: CW - 20, lineGap: 4, paragraphGap: 8 });
      doc.moveDown(0.2);
    });
  }

  // ══════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════
  doc.rect(20, 20, W - 40, H - 40).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
  doc.rect(0, 0, W, 100).fill('#0f172a');
  
  // Left: Brand
  doc.fontSize(28).fillColor('#60a5fa').font(boldFont).text('ScholarStock', L, 28);
  doc.fontSize(9).fillColor('#94a3b8').font(bodyFont).text('INTELLIGENT CONTENT ENGINE', L, 60);

  // Center-Right: Exam Badge (Pill Style)
  const badgeW = 180;
  const badgeX = W - badgeW - 50;
  doc.roundedRect(badgeX, 32, badgeW, 36, 18).fill('#1e293b');
  doc.fontSize(12).fillColor('#ffffff').font(boldFont)
    .text(`${item.category} EXAM`, badgeX, 43, { align: 'center', width: badgeW });

  doc.y = 140;
  doc.fontSize(24).fillColor('#1e293b').font(boldFont).text(item.title, { align: 'center', width: CW + L });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#64748b').font(bodyFont)
    .text(`Topic: ${item.subcategory}   •   Difficulty: ${item.difficulty || 'Medium'}`, { align: 'center', width: CW + L });
  doc.moveDown(2);
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
    item.formulas.forEach((f, i) => {
      if (doc.y > H - 60) newPage('Key Formulas');
      const startY = doc.y;
      doc.fontSize(10.5).fillColor('#1e293b').font(boldFont).text(`${i + 1}. `, L + 10, startY, { continued: true })
        .font(bodyFont).text(f, { lineGap: 4 });
      doc.moveDown(0.5);
    });
    doc.moveDown(1);
  }

  // ── 3. Solved Examples ──
  if (item.solvedExamples && item.solvedExamples.length > 0) {
    newPage('Solved Examples');
    sectionHeading('Solved Examples', '#0f172a');
    item.solvedExamples.forEach((ex, i) => {
      if (doc.y > H - 150) newPage('Solved Examples');
      doc.fontSize(11).fillColor('#1e293b').font(boldFont).text(`Example ${i + 1}: `, L, doc.y);
      doc.moveDown(0.2);
      doc.fontSize(10.5).fillColor('#334155').font(bodyFont).text(ex.question, { width: CW, lineGap: 3 });
      doc.moveDown(0.6);
      doc.fontSize(10.5).fillColor('#059669').font(boldFont).text('Solution:');
      doc.moveDown(0.2);
      doc.fontSize(10.5).fillColor('#334155').font(bodyFont).text(ex.solution, { width: CW - 10, lineGap: 3, indent: 10 });
      doc.moveDown(1.5);
    });
  }

  // ── 4. MCQs ──
  if (item.mcqs && item.mcqs.length > 0) {
    newPage('Practice MCQs');
    sectionHeading('Practice Questions (MCQs)', '#60a5fa');
    item.mcqs.forEach((mcq, i) => {
      if (doc.y > H - 180) newPage('Practice MCQs');
      doc.fontSize(11).fillColor('#1e293b').font(boldFont).text(`Q${i + 1}. `, L, doc.y, { continued: true })
        .font(bodyFont).text(mcq.q, { width: CW, lineGap: 3 });
      doc.moveDown(0.5);
      
      mcq.options.forEach((opt) => {
        if (doc.y > H - 60) newPage('Practice MCQs');
        doc.fontSize(10).fillColor('#475569').font(bodyFont).text(opt, L + 20, doc.y, { width: CW - 30, lineGap: 2 });
        doc.moveDown(0.2);
      });
      
      doc.moveDown(0.5);
      if (doc.y > H - 80) newPage('Practice MCQs');
      doc.fontSize(10).fillColor('#059669').font(boldFont).text('Correct Answer: ', L + 20, doc.y, { continued: true })
        .font(bodyFont).text(mcq.answer);
      
      if (mcq.explanation) {
        doc.moveDown(0.3);
        doc.fontSize(9.5).fillColor('#64748b').font(bodyFont)
          .text(`Explanation: ${mcq.explanation}`, L + 20, doc.y, { width: CW - 30, lineGap: 2, align: 'left' });
      }
      doc.moveDown(1.8);
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
  if (item.prevYearQuestions && item.prevYearQuestions.length > 0) {
    newPage('Previous Year Questions');
    sectionHeading('Previous Year Questions', '#eab308');
    item.prevYearQuestions.forEach((pyq, i) => {
      if (doc.y > H - 150) newPage('Previous Year Questions');
      doc.fontSize(11).fillColor('#1e293b').font(boldFont).text(`Question ${i + 1}: `, L, doc.y);
      doc.moveDown(0.2);
      doc.fontSize(10.5).fillColor('#334155').font(bodyFont).text(pyq.question, { width: CW, lineGap: 3 });
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#64748b').font(bodyFont).text(`[Weightage: ${pyq.marks}]`, L, doc.y);
      doc.moveDown(0.4);
      doc.fontSize(10.5).fillColor('#059669').font(boldFont).text('Model Answer:');
      doc.moveDown(0.2);
      doc.fontSize(10.5).fillColor('#334155').font(bodyFont).text(pyq.answer, { width: CW - 10, lineGap: 3, indent: 10 });
      doc.moveDown(1.5);
    });
  }

  // ── 11. AI DIAGRAMS & VISUALS ──
  if (item.diagramDescription) {
    newPage('Visual Aids');
    sectionHeading('Visual Diagrams & Structural Flow', '#ec4899');
    doc.rect(L, doc.y, CW, 120).fill('#fdf2f8');
    doc.fontSize(10).fillColor('#be185d').font(boldFont).text('AI-GENERATED VISUAL PROMPT:', L + 15, doc.y + 15);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#334155').font(bodyFont).text(item.diagramDescription, L + 15, doc.y, { width: CW - 30, lineGap: 3 });
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#9d174d').font(bodyFont).text('[Interactive diagram rendering available in ScholarStock Web App]', { align: 'center', width: CW });
    doc.y += 40;
  }

  // ── 12. QUALITY AUDIT REPORT ──
  if (item.auditReport) {
    newPage('Audit Report');
    sectionHeading('ScholarStock Quality Assurance', '#475569');
    doc.rect(L, doc.y, CW, 150).fill('#f8fafc').strokeColor('#cbd5e1').stroke();
    doc.fontSize(11).fillColor('#1e293b').font(boldFont).text('ELITE-GRADE AUDIT LOG:', L + 15, doc.y + 15);
    doc.moveDown(0.8);
    doc.fontSize(10).fillColor('#475569').font(bodyFont).text(item.auditReport, L + 15, doc.y, { width: CW - 30, lineGap: 4 });
    doc.moveDown(2);
  }

  // ── Final Mastery Checklist ──
  if (item.category && item.subcategory) {
    if (doc.y > H - 200) newPage('Checklist');
    sectionHeading('Final Mastery Checklist', '#059669');
    doc.fontSize(10).fillColor('#475569').font(bodyFont).text('Ensure you have mastered these sub-topics before the exam:', L, doc.y);
    doc.moveDown(1);
    const subtopics = (item.topicsCovered || [item.subcategory]).slice(0, 1).concat(['Critical Formula Recall', 'Edge Case Analysis', 'Time Paradox Questions', 'Historical Year Trends']);
    subtopics.forEach(st => {
      doc.rect(L, doc.y, 12, 12).strokeColor('#cbd5e1').stroke();
      doc.fontSize(10.5).fillColor('#1e293b').font(bodyFont).text(st, L + 20, doc.y - 2, { width: CW - 20 });
      doc.moveDown(0.8);
    });
    doc.moveDown(1);
    doc.fontSize(9).fillColor('#64748b').font(bodyFont).text('Note: This document is an elite-grade study resource. Sharing outside the ScholarStock network is strictly prohibited.', { align: 'center', width: CW });
  }

  // ── Watermark on all pages ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    
    // Check if this is a truly empty page (happens occasionally with auto-pagination)
    // If it's a blank page after the content, we don't want to watermark it (or we might want to delete it)
    // For now, let's just ensure we draw the border and footer correctly
    
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
    
    // Re-ensure Border on every page in case auto-pagination missed it
    doc.rect(20, 20, W - 40, H - 40).strokeColor('#f1f5f9').lineWidth(0.5).stroke();

    // Footer
    const footerY = H - 38;
    doc.rect(0, footerY - 8, W, 46).fill('#0f172a');
    doc.fontSize(8.5).fillColor('#94a3b8').font(bodyFont)
      .text(`© ScholarStock  •  ${item.isError ? 'DEBUG REPORT' : 'PREMIUM SERIES'}  •  Page ${i + 1} of ${range.count}`, L, footerY, { align: 'center', width: CW });
  }

  // ── 0. Error Layout (If isError is true, override the rest) ──
  if (item.isError) {
    doc.switchToPage(0);
    // Clear page content (or just draw over)
    doc.rect(50, 150, CW, H - 300).fill('#fffaf0');
    doc.rect(50, 150, 5, H - 300).fill('#dc2626');
    
    doc.y = 180;
    doc.fontSize(20).fillColor('#dc2626').font(boldFont).text('PIPELINE FAILURE REPORT', L + 20, doc.y);
    doc.moveDown(1);
    
    const info = item.debugInfo || {};
    
    const labelStyle = { font: boldFont, size: 11, color: '#475569' };
    const valStyle = { font: bodyFont, size: 11, color: '#1e293b' };

    function row(label, val) {
      doc.fontSize(labelStyle.size).fillColor(labelStyle.color).font(labelStyle.font).text(`${label}: `, { continued: true });
      doc.fontSize(valStyle.size).fillColor(valStyle.color).font(valStyle.font).text(val || 'N/A');
      doc.moveDown(0.5);
    }

    row('FAILED TEAM', info.team);
    row('FAILED STAGE', info.stage);
    row('TIMESTAMP', new Date().toLocaleString());
    doc.moveDown(1);
    
    doc.fontSize(12).fillColor('#dc2626').font(boldFont).text('TECHNICAL ERROR LOG:');
    doc.rect(L + 20, doc.y + 5, CW - 40, 150).fill('#fef2f2');
    doc.fontSize(10).fillColor('#991b1b').font(bodyFont).text(item.theory || 'Unknown error', L + 30, doc.y + 15, { width: CW - 60 });
    
    doc.y = 520;
    doc.fontSize(10).fillColor('#475569').font(bodyFont).text('SYSTEM RECOMMENDATION:', L + 20, doc.y);
    const recs = [
      'Check if the API keys for this team are still valid.',
      'One or more providers in this team might be hitting rate limits.',
      'The model might have flagged the content as unsafe (Gemini/DeepSeek safety filters).',
      'The request timed out (currently set to 90 seconds).'
    ];
    recs.forEach((r, i) => {
      doc.text(`• ${r}`, L + 30, doc.y + 5, { width: CW - 60 });
      doc.moveDown(0.2);
    });

    return; // Stop rendering the rest of the PDF
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
        // Ensure bucket exists before upload
        try {
          await supabase.storage.createBucket(SUPABASE_BUCKET, { public: true });
        } catch (e) { /* bucket already exists, ignore */ }
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
      // All 3 teams run their full 10-stage pipeline with staggered starts to avoid rate limiting
      const resultA = await runTeamPipeline(teamAlpha, batchIndex + 1);
      
      console.log(`[Engine] Staggering team Beta start (4s)...`);
      await new Promise(r => setTimeout(r, 4000));
      const resultB = await runTeamPipeline(teamBeta, batchIndex + 2);
      
      console.log(`[Engine] Staggering team Gamma start (4s)...`);
      await new Promise(r => setTimeout(r, 4000));
      const resultC = await runTeamPipeline(teamGamma, batchIndex + 3);

      // Collect all 3 results
      let successInCycle = 0;
      for (const result of [resultA, resultB, resultC]) {
        if (result && !result.isError) {
          successInCycle++;
          contentEngine.collected.push(result);
          contentEngine.totalGenerated++;
          
          // PERSISTENCE: Save to MongoDB Drafts immediately
          try {
            await DraftMaterial.create(result);
            console.log(`  [Storage] Draft saved for #${contentEngine.totalGenerated}`);
          } catch (e) {
            console.error(`  [Storage] Failed to save draft: ${e.message}`);
          }

          if (result.formulas) contentEngine.coverage.formulas.push(...result.formulas);
          if (result.topicsCovered) contentEngine.coverage.topics.push(...result.topicsCovered);
          if (result.difficulty) contentEngine.coverage.difficulty_distribution[result.difficulty]++;
        } else if (result && result.isError) {
          console.warn(`  [Engine] Team ${result.debugInfo?.team || 'Unknown'} reported failure at stage: ${result.debugInfo?.stage || 'Unknown'}`);
        }
      }

      if (successInCycle > 0) {
        consecutiveFailures = 0;
        console.log(`└─ Cycle #${cycleNum} complete | Successfully added: ${successInCycle} | Total: ${contentEngine.totalGenerated} ─┘\n`);
      } else {
        consecutiveFailures++;
        console.warn(`└─ Cycle #${cycleNum} FAILED | All 3 teams returned errors. Failures: ${consecutiveFailures}/${maxCycleFailures} ─┘\n`);
        if (consecutiveFailures >= maxCycleFailures) {
          contentEngine.error = `Stalled: 5 consecutive cycles failed to produce any content. Check API keys and logs.`;
          contentEngine.running = false;
          break;
        }
      }

      if (contentEngine.collected.length >= 500) {
        contentEngine.topicComplete = true;
        console.log('Content engine: Maximum 500 items reached!');
        break;
      }

    } catch (err) {
      console.error(`Cycle #${cycleNum} CRITICAL error: ${err.message}`);
      consecutiveFailures++;
      if (consecutiveFailures >= maxCycleFailures) {
        contentEngine.error = `Aborted: Too many critical cycle errors: ${err.message}`;
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
    case 'openrouter': {
      try {
        response = await axios.post(provider.endpoint, {
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.7
        }, { headers, timeout });
        return response.data.choices[0].message.content || '';
      } catch (err) {
        // OpenRouter returns 402 for RATE LIMITS now (not actual payment required)
        if (err.response?.status === 402 || err.response?.status === 429) {
          provider.usage++;
          throw new Error(`OpenRouter rate limited, will try next provider`);
        }
        throw err;
      }
    }

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
async function callAIWithRetry(team, prompt, maxRetries = 8) {
  let lastErr = 'No providers available';
  
  // To avoid teams hitting the same provider simultaneously, we can start with a random offset
  if (team.idx === 0) team.idx = Math.floor(Math.random() * team.providers.length);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const provider = team.getProvider();
    if (!provider) throw new Error(`[${team.name}] All providers exhausted`);

    try {
      console.log(`  [${team.name}] → ${provider.name} (attempt ${attempt}/${maxRetries})`);
      const text = await callAI(provider, prompt);
      provider.usage++;
      if (text && text.trim().length > 20) return text.trim();
      throw new Error('Response too short or empty');
    } catch (err) {
      lastErr = `${provider.name} → ${err.message}`;
      console.warn(`  [${team.name}] ✗ ${provider.name} failed: ${err.message}`);
      
      // If we are rate limited or hit a 404/400, wait briefly before trying the next provider in the team
      if (err.response?.status === 404) {
        console.warn(`  [${team.name}] Model NOT FOUND (404) for ${provider.name}. Disabling provider.`);
        provider.enabled = false;
      }

      if (err.response?.status === 429 || err.response?.status === 402) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw new Error(`[${team.name}] All ${maxRetries} retries failed. Last error: ${lastErr}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 1 — RESEARCH
// Goal: Get a structured list of key concepts for the topic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageResearch(team, category, topicLabel) {
  const isHighComplexity = ['JEE', 'NEET', 'GATE', 'UPSC', 'IIT'].includes(category.toUpperCase());
  const count = isHighComplexity ? 40 : 20;

  const prompt =
    `You are a Senior Academic Researcher specializing in the ${category} exam curriculum.
    
Your goal is to provide a COMPREHENSIVE RESEARCH DOSSIER for the topic: "${topicLabel}".

List the ${count} most critical concepts, hidden nuances, high-yield facts, and common examiners' favorite "trap" areas.
Since this is for ${category}, ensure the level of depth matches the exam's rigor. 

OUTPUT RULES:
- Numbered list only. One breakthrough concept per line.
- Plain text. No JSON. No markdown. NO LaTeX.
- Focus on concepts that actually appear in the most recent ${category} papers.
- Be extremely detailed and specific. Avoid generic statements.

1. `;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 2 — THEORY
// Goal: 3 clear paragraphs of conceptual explanation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageTheory(team, category, topicLabel, researchPoints) {
  const isHighComplexity = ['JEE', 'NEET', 'GATE', 'UPSC', 'IIT'].includes(category.toUpperCase());
  const lengthGuide = isHighComplexity ? "at least 25-30 exhaustive, dense paragraphs" : "at least 15-20 dense paragraphs";

  const prompt =
    `You are the [${team.role}] writing an EXTENDED master-class textbook.
    
Write an exhaustive, high-level conceptual theory for "${topicLabel}". 
${team.name === 'Alpha ⚡' ? 'FOCUS: Focus on heavy derivation, first-principles logic, and rigorous edge cases.' : ''}
${team.name === 'Beta 🧠' ? 'FOCUS: Use clear, actionable language, many bullet points, and relate concepts to common exam patterns.' : ''}
${team.name === 'Gamma 🔥' ? 'FOCUS: Focus on the historical context, foundational basics, and how this relates to other syllabus topics.' : ''}

[DEMANDED SECTIONS]:
1. THEORETICAL FOUNDATION: Explain the first principles and historical evolution.
2. CORE CONCEPTS: Exhaustive detail on every sub-topic listed in research.
3. MATHEMATICAL DERIVATIONS: Provide thorough step-by-step proofs for all primary formulas.
4. LOGICAL FALLACIES & PARADOXES: Discuss common conceptual traps and edge cases.
5. ADVANCED INTEGRATION: How this topic connects to other areas of the ${category} syllabus.

Key points to integrate:
${researchPoints}

OUTPUT RULES:
- Provide ${lengthGuide} of flowing prose. Depth is the absolute priority.
- Explain from first principles to advanced elite application.
- Plain text only. No bullets/headings. NO LaTeX.
- Use Unicode (θ, π, ², ³, √, Σ, Δ, ±, ≤, ≥, ≈, λ, μ, α, β, γ, Ω).
- START DIRECTLY. NO preambles.`;
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
  const isHighComplexity = ['JEE', 'NEET', 'GATE', 'UPSC', 'IIT'].includes(category.toUpperCase());
  const count = isHighComplexity ? 15 : 8;

  const prompt =
    `You are the [${team.role}] writing solved examples for a masterclass.

Create ${count} EXTENDED step-by-step solved problems about "${topicLabel}".
Each problem should have a clear "PROBLEM" statement and a "SOLUTION" that shows every logical and mathematical step.
${team.name === 'Alpha ⚡' ? 'FOCUS: Include at least 2 "Bonus Challenge" problems that go beyond the syllabus.' : ''}
${team.name === 'Beta 🧠' ? 'FOCUS: Focus on the fastest "calculator-free" methods and elimination logic.' : ''}

OUTPUT FORMAT:
PROBLEM 1: [text]
SOLUTION: [detailed steps]
---
`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE 5 — MULTIPLE CHOICE QUESTIONS (MCQs)
// Goal: 20-25 questions per part (total 40-50) with tricky options
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function stageMCQs(team, category, topicLabel, part = 1) {
  const isHighComplexity = ['JEE', 'NEET', 'GATE', 'UPSC', 'IIT'].includes(category.toUpperCase());
  const count = isHighComplexity ? 25 : 20;

  const prompt =
    `You are the [${team.role}] setting a high-stakes exam paper.

Generate ${count} ELITE-QUALITY MCQs (Part ${part}) for "${topicLabel}".
${team.name === 'Alpha ⚡' ? 'FOCUS: Create "multi-concept" questions that require integrating multiple topics to solve.' : ''}
${team.name === 'Beta 🧠' ? 'FOCUS: Focus on tricky distractors (wrong options) and common pitfalls.' : ''}
${team.name === 'Gamma 🔥' ? 'FOCUS: Ensure standard exam phrasing and perfect syllabus weightage.' : ''}

OUTPUT FORMAT:
Q1: [Question text]
A) [Option]
B) [Option]
C) [Option]
D) [Option]
ANSWER: [A/B/C/D]
EXPLANATION: [Brief reason why]
---
`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

async function runTeamPipeline(team, index) {
  const { category, subcategory, topicType } = contentEngine.currentTopic;
  const topicLabel = subcategory || `All ${category} topics`;
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const difficulty = difficulties[index % 3];

  await new Promise(r => setTimeout(r, Math.random() * 5000));

  console.log(`[Pipeline #${index}] [${team.name}] Role: ${team.role} | ${difficulty}`);
  let currentStage = "Starting";

  try {
    currentStage = "1/12 Research";
    console.log(`[${team.name}] Stage ${currentStage}...`);
    const researchText = await stageResearch(team, category, topicLabel);

    currentStage = "2/12 Theory Notes";
    let theoryText = '';
    if (topicType !== 'questions') {
      console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
      theoryText = await stageTheory(team, category, topicLabel, researchText);
    } else {
      theoryText = `Comprehensive Question Bank for ${topicLabel}. Detail Theory Notes and Master Sheets are available in our Premium Theory Pack.`;
    }

    currentStage = "3/12 Formulas";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    let formulas = [];
    if (topicType !== 'questions') {
      const formulasText = await stageFormulas(team, category, topicLabel);
      formulas = parseFormulas(formulasText);
    }

    currentStage = "4/12 Solved Examples";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    let solvedExamples = [];
    const examplesText = await stageSolvedExamples(team, category, topicLabel);
    solvedExamples = parseSolvedExamples(examplesText);

    currentStage = "5/12 MCQs";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    let mcqs = [];
    if (topicType !== 'notes') {
      const mcqs1Text = await stageMCQs(team, category, topicLabel, 1);
      mcqs = parseMCQs(mcqs1Text);
      const mcqs2Text = await stageMCQs(team, category, topicLabel, 2);
      mcqs.push(...parseMCQs(mcqs2Text));
    }

    currentStage = "6/12 Syllabus Map";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    const syllabusMap = (topicType !== 'questions') ? await stageSyllabusMap(team, category, topicLabel) : '';

    currentStage = "7/12 Deep Dive";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    const deepDive = (topicType !== 'questions') ? await stageDeepDive(team, category, topicLabel, theoryText) : '';

    currentStage = "8/12 Memory Tricks";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    const memoryTricks = (topicType !== 'questions') ? await stageMemoryTricks(team, category, topicLabel) : '';

    currentStage = "9/12 Common Mistakes";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    const commonMistakes = (topicType !== 'questions') ? await stageCommonMistakes(team, category, topicLabel) : '';

    currentStage = "10/12 PYQs";
    console.log(`  [${team.name}] [${difficulty}] Stage ${currentStage}...`);
    let prevYearQuestions = [];
    if (topicType !== 'notes') {
      const pyqText = await stagePrevYearQuestions(team, category, topicLabel);
      prevYearQuestions = parsePYQs(pyqText);
    }

    const typeSuffix = {
      questions: ' (Question Bank)',
      notes: ' (Theory Notes)',
      complete: ' (Complete Pack)'
    }[topicType] || ' (Study Material)';

    const partialResult = {
      title: `${category} - ${topicLabel}${typeSuffix} #${index}`,
      category, subcategory: topicLabel, difficulty,
      theory: theoryText, formulas, solvedExamples, mcqs, syllabusMap, deepDive, memoryTricks, commonMistakes, prevYearQuestions,
      topicsCovered: [topicLabel]
    };

    currentStage = "11/12 QA Audit";
    console.log(`[${team.name}] Running Stage 11: Auditor...`);
    const auditReport = await stageAuditor(team, partialResult);

    currentStage = "12/12 Diagram Design";
    console.log(`[${team.name}] Running Stage 12: Diagram Design...`);
    const diagramDescription = await stageDiagram(team, partialResult);

    const result = {
      ...partialResult,
      auditReport,
      diagramDescription,
      suggestedPrice: difficulty === 'Easy' ? 5 : difficulty === 'Hard' ? 15 : 9,
      pages: Math.max(25, 18 + Math.floor((theoryText.length * 1.5 + mcqs.length * 400 + solvedExamples.length * 600 + prevYearQuestions.length * 600) / 1000)),
      approved: false,
      batchId: contentEngine.startedAt.getTime().toString()
    };

    console.log(`[Pipeline #${index}] Complete — all 12 stages done`);
    return result;

  } catch (err) {
    console.error(`[Pipeline #${index}] [${team.name}] FAILED at Stage ${currentStage}: ${err.message}`);
    const { category: cat, subcategory: sub } = contentEngine.currentTopic || {};
    return {
      isError: true,
      debugInfo: { team: team.name, stage: currentStage, timestamp: new Date().toISOString(), index },
      title: `${cat || 'Exam'} - ${sub || 'Topic'} (FAILED: ${currentStage})`,
      category: cat || 'Unknown', subcategory: sub || 'Unknown', difficulty,
      theory: `Pipeline generation failed at stage [${currentStage}] on [${team.name}]: ${err.message}`,
      formulas: [], solvedExamples: [], mcqs: [], syllabusMap: '', deepDive: '', memoryTricks: '', commonMistakes: '', prevYearQuestions: [],
      topicsCovered: [], topicComplete: false, suggestedPrice: 9, pages: 1, approved: false
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAGE HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function stagePrevYearQuestions(team, category, topicLabel) {
  const isHighComplexity = ['JEE', 'NEET', 'GATE', 'UPSC', 'IIT'].includes(category.toUpperCase());
  const count = isHighComplexity ? 20 : 10;
  const prompt = `Generate ${count} past-exam-style questions for ${category} on "${topicLabel}". Format: PYQ X: [Q] \n ANSWER: [A] \n MARKS: [M] \n ---`;
  return await callAIWithRetry(team, prompt);
}

async function stageAuditor(team, result) {
  const prompt = `Review this ${result.category} content for ${result.subcategory}. Accuracy & Depth check. Suggest 3 improvements.`;
  return await callAIWithRetry(team, prompt);
}

async function stageDiagram(team, result) {
  const prompt = `Generate a detailed Scientific Diagram description or ASCII structural art for ${result.subcategory}.`;
  return await callAIWithRetry(team, prompt);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARSERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNIVERSAL PARSER — Robust JSON & Text Recovery
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function universalParser(text, type = 'text') {
  if (!text) return type === 'json' ? {} : '';
  
  // 1. Clean Markdown
  let clean = text.replace(/```(?:json|html|text|latex)?/gi, '').replace(/```/g, '').trim();
  
  // 2. Remove AI Preamble (e.g. "Here is the content:")
  // If we expect JSON, try to find the first '{' and last '}'
  if (type === 'json') {
    try {
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        clean = clean.substring(start, end + 1);
      }
      return JSON.parse(clean);
    } catch (e) {
      console.warn('UniversalParser: JSON parse failed, falling back to regex extraction');
    }
  }

  // 3. Text cleanup (Remove control characters)
  return clean.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
}

function parseFormulas(text) {
  const clean = universalParser(text);
  if (!clean) return [];
  return clean.split('\n').map(l => l.trim()).filter(l => l.includes('=') || l.includes(':'));
}

function parseSolvedExamples(text) {
  const clean = universalParser(text);
  if (!clean) return [];
  const examples = [];
  const blocks = clean.split(/---+/).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const probMatch = block.match(/PROBLEM\s*\d*:\s*([\s\S]*?)(?=SOLUTION:)/i);
    const solMatch = block.match(/SOLUTION:\s*([\s\S]*)/i);
    if (probMatch && solMatch) examples.push({ question: probMatch[1].trim(), solution: solMatch[1].trim() });
    else if (block.includes('PROBLEM') && block.includes('SOLUTION')) {
      // Fallback for non-numbered or messy blocks
      const parts = block.split(/SOLUTION:/i);
      examples.push({ question: parts[0].replace(/PROBLEM\s*\d*:/i, '').trim(), solution: parts[1].trim() });
    }
  }
  return examples;
}

function parseMCQs(text) {
  const clean = universalParser(text);
  if (!clean) return [];
  const mcqs = [];
  const blocks = clean.split(/---+/).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const qMatch = block.match(/Q\d*:\s*([\s\S]*?)(?=\nA\))/i);
    const options = block.match(/^[A-D]\)\s*(.*)/gm);
    const ansMatch = block.match(/ANSWER:\s*([A-D])/i);
    const expMatch = block.match(/EXPLANATION:\s*([\s\S]*)/i);
    if ((qMatch || block.startsWith('Q')) && ansMatch) {
      mcqs.push({
        q: qMatch ? qMatch[1].trim() : block.split('\nA)')[0].replace(/Q\d*:/i, '').trim(),
        options: options || ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'],
        answer: ansMatch[1].trim(),
        explanation: expMatch ? expMatch[1].trim() : ''
      });
    }
  }
  return mcqs;
}

function parsePYQs(text) {
  const clean = universalParser(text);
  if (!clean) return [];
  const pyqs = [];
  const blocks = clean.split(/---+/).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const qMatch = block.match(/PYQ\s*\d*:\s*([\s\S]*?)(?=ANSWER:)/i);
    const ansMatch = block.match(/ANSWER:\s*([\s\S]*?)(?=MARKS:|$)/i);
    const marksMatch = block.match(/MARKS:\s*(.*)/i);
    if (qMatch && ansMatch) pyqs.push({ question: qMatch[1].trim(), answer: ansMatch[1].trim(), marks: marksMatch ? marksMatch[0].trim() : 'N/A' });
  }
  return pyqs;
}

module.exports = router;
