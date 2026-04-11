const express = require('express');
const router = express.Router();
const { auth, verifyAdmin } = require('../middleware/auth');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

// AI Provider Pool - HIGH QUALITY MODELS ONLY (Tier 1 & 2)
class AIProviderPool {
  constructor() {
    this.providers = [
      // ==================== OPENROUTER (FREE High-Quality Models) ====================
      // Verified free models as of 2026 (50 req/day free, 1000/day with $10 balance)
      { 
        name: 'openrouter-llama3.3-70b', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-qwen3-32b', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'qwen/qwen3-32b:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-qwen3-235b', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'qwen/qwen3-235b-a22b:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-deepseek-r1', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'deepseek/deepseek-r1:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-deepseek-v3', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'deepseek/deepseek-chat-v3-0324:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-llama4-scout', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-4-scout:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-llama4-maverick', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-4-maverick:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-gpt-oss-120b', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'openai/gpt-oss-120b:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-kimi-k2', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'moonshotai/kimi-k2:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-mistral-small', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'mistralai/mistral-small-3.1-24b-instruct:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-gemma3-27b', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'google/gemma-3-27b-it:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      { 
        name: 'openrouter-nemotron3-super', 
        type: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: 'nvidia/nemotron-3-nano-super:free',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== GROQ (Fast - Active for Content Engine) ====================
      {
        name: 'groq-llama3.3-70b',
        type: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'groq-llama3.1-8b',
        type: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: 'llama-3.1-8b-instant',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier2'
      },
      // ==================== CEREBRAS (Ultra Fast - Active for Content Engine) ====================
      {
        name: 'cerebras-llama3.3-70b',
        type: 'cerebras',
        endpoint: 'https://api.cerebras.ai/v1/chat/completions',
        key: process.env.CEREBRAS_API_KEY,
        model: 'llama3.3-70b',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'cerebras-qwen3-32b',
        type: 'cerebras',
        endpoint: 'https://api.cerebras.ai/v1/chat/completions',
        key: process.env.CEREBRAS_API_KEY,
        model: 'qwen3-32b',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== HUGGINGFACE (High-Quality Models) ====================
      {
        name: 'huggingface-llama70b',
        type: 'huggingface',
        endpoint: 'https://api-inference.huggingface.co/models/',
        key: process.env.HUGGINGFACE_API_KEY,
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'huggingface-mixtral8x7b',
        type: 'huggingface',
        endpoint: 'https://api-inference.huggingface.co/models/',
        key: process.env.HUGGINGFACE_API_KEY,
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'huggingface-qwen72b',
        type: 'huggingface',
        endpoint: 'https://api-inference.huggingface.co/models/',
        key: process.env.HUGGINGFACE_API_KEY,
        model: 'Qwen/Qwen2.5-72B-Instruct',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'huggingface-mistral-large',
        type: 'huggingface',
        endpoint: 'https://api-inference.huggingface.co/models/',
        key: process.env.HUGGINGFACE_API_KEY,
        model: 'mistralai/Mistral-Large-Instruct-2407',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'huggingface-codellama70b',
        type: 'huggingface',
        endpoint: 'https://api-inference.huggingface.co/models/',
        key: process.env.HUGGINGFACE_API_KEY,
        model: 'codellama/CodeLlama-70b-Instruct-hf',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier2'
      },
      
      // ==================== CEREBRAS (FREE - Ultra Fast) ====================
      // Verified 2026: 1M tokens/day, 30 RPM
      {
        name: 'cerebras-llama3.3-70b',
        type: 'cerebras',
        endpoint: 'https://api.cerebras.ai/v1/chat/completions',
        key: process.env.CEREBRAS_API_KEY,
        model: 'llama3.3-70b',
        usage: 0,
        limit: 1000, // 1M tokens/day
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'cerebras-qwen3-32b',
        type: 'cerebras',
        endpoint: 'https://api.cerebras.ai/v1/chat/completions',
        key: process.env.CEREBRAS_API_KEY,
        model: 'qwen3-32b',
        usage: 0,
        limit: 1000,
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== GITHUB MODELS (FREE) ====================
      // Verified 2026: 50-150 req/day depending on model
      {
        name: 'github-gpt-4o',
        type: 'github',
        endpoint: 'https://models.inference.ai.azure.com/chat/completions',
        key: process.env.GITHUB_TOKEN,
        model: 'gpt-4o',
        usage: 0,
        limit: 50, // 10 RPM, 50 req/day
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'github-grok-3',
        type: 'github',
        endpoint: 'https://models.inference.ai.azure.com/chat/completions',
        key: process.env.GITHUB_TOKEN,
        model: 'grok-3',
        usage: 0,
        limit: 50,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'github-deepseek-r1',
        type: 'github',
        endpoint: 'https://models.inference.ai.azure.com/chat/completions',
        key: process.env.GITHUB_TOKEN,
        model: 'deepseek-r1',
        usage: 0,
        limit: 150, // 15 RPM, 150 req/day
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== NVIDIA NIM (FREE) ====================
      // Verified 2026: 1000 credits free
      {
        name: 'nvidia-deepseek-r1',
        type: 'nvidia',
        endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
        key: process.env.NVIDIA_API_KEY,
        model: 'deepseek-ai/deepseek-r1',
        usage: 0,
        limit: 100, // 40 RPM, 1000 credits
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'nvidia-kimi-k2.5',
        type: 'nvidia',
        endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
        key: process.env.NVIDIA_API_KEY,
        model: 'moonshotai/kimi-k2-instruct',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== SAMBANOVA (FREE) ====================
      // Verified 2026: $5 credits + free tier
      {
        name: 'sambanova-llama3.3-70b',
        type: 'sambanova',
        endpoint: 'https://api.sambanova.ai/v1/chat/completions',
        key: process.env.SAMBANOVA_API_KEY,
        model: 'Meta-Llama-3.3-70B-Instruct',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'sambanova-qwen2.5-72b',
        type: 'sambanova',
        endpoint: 'https://api.sambanova.ai/v1/chat/completions',
        key: process.env.SAMBANOVA_API_KEY,
        model: 'Qwen2.5-72B-Instruct',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== DEEPSEEK DIRECT (FREE/VERY CHEAP) ====================
      // Verified 2026: 5M tokens free, then very cheap
      {
        name: 'deepseek-chat-v3',
        type: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        key: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        usage: 0,
        limit: 500, // 5M tokens free
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'deepseek-reasoner-r1',
        type: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        key: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-reasoner',
        usage: 0,
        limit: 500,
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== INDIVIDUAL APIs (High-Quality) ====================
      // Arranged from MOST generous free tier to least
      // NOTE: Gemini 2.5 Pro free tier was REMOVED in Dec 2025
      {
        name: 'gemini-2.5-flash-lite',
        type: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
        key: process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash-lite',
        usage: 0,
        limit: 1000, // MOST GENEROUS: 15 RPM, 1000 RPD
        enabled: true,
        quality: 'tier2' // Slightly less capable but very fast
      },
      {
        name: 'gemini-2.5-flash',
        type: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
        key: process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash',
        usage: 0,
        limit: 250, // 10 RPM, 250 RPD (best balance)
        enabled: true,
        quality: 'tier1' // Best quality with free tier
      },
      {
        name: 'deepseek-chat',
        type: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        key: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'deepseek-coder',
        type: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        key: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-coder',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier2'
      },
      
      // ==================== FIREWORKS AI (High-Quality) ====================
      {
        name: 'fireworks-llama70b',
        type: 'fireworks',
        endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
        key: process.env.FIREWORKS_API_KEY,
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'fireworks-mixtral8x22b',
        type: 'fireworks',
        endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
        key: process.env.FIREWORKS_API_KEY,
        model: 'accounts/fireworks/models/mixtral-8x22b-instruct',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'fireworks-qwen72b',
        type: 'fireworks',
        endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
        key: process.env.FIREWORKS_API_KEY,
        model: 'accounts/fireworks/models/qwen2p5-72b-instruct',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      
      // ==================== GROQ (Free Tier - Fast) ====================
      {
        name: 'groq-llama70b',
        type: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: 'llama-3.1-70b-versatile',
        usage: 0,
        limit: 30, // Free tier RPM
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'groq-llama8b',
        type: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: 'llama-3.1-8b-instant',
        usage: 0,
        limit: 30,
        enabled: true,
        quality: 'tier2'
      },
      
      // ==================== OTHER HIGH-QUALITY PROVIDERS ====================
      {
        name: 'mistral-large',
        type: 'mistral',
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        key: process.env.MISTRAL_API_KEY,
        model: 'mistral-large-latest',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'mistral-medium',
        type: 'mistral',
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        key: process.env.MISTRAL_API_KEY,
        model: 'mistral-medium-latest',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier1'
      },
      {
        name: 'ai21-jamba',
        type: 'ai21',
        endpoint: 'https://api.ai21.com/studio/v1/',
        key: process.env.AI21_API_KEY,
        model: 'jamba-instruct',
        usage: 0,
        limit: 100,
        enabled: true,
        quality: 'tier2'
      }
    ];
    
    this.currentIndex = 0;
  }
  
  getAvailableProvider() {
    // Priority: Tier 1 first, then Tier 2
    const tier1Providers = this.providers.filter(p => 
      p.enabled && p.usage < p.limit && p.quality === 'tier1'
    );
    
    const tier2Providers = this.providers.filter(p => 
      p.enabled && p.usage < p.limit && p.quality === 'tier2'
    );
    
    const available = tier1Providers.length > 0 ? tier1Providers : tier2Providers;
    
    if (available.length === 0) return null;
    
    const provider = available[this.currentIndex % available.length];
    this.currentIndex++;
    return provider;
  }
  
  getAllProvidersStatus() {
    return this.providers.map(p => ({
      name: p.name,
      usage: p.usage,
      limit: p.limit,
      remaining: p.limit - p.usage,
      enabled: p.enabled,
      exhausted: p.usage >= p.limit
    }));
  }
}

const aiPool = new AIProviderPool();

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
  
  // Reset AI provider usage
  aiPool.providers.forEach(p => p.usage = 0);
  
  res.json({ success: true, message: 'Content engine reset' });
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
    providers: aiPool.getAllProvidersStatus()
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
  // Load Unicode-compatible font if available
  let bodyFont = 'Helvetica';
  let boldFont = 'Helvetica-Bold';
  let italicFont = 'Helvetica-Oblique';
  
  const fontPaths = [
    path.join(__dirname, '../fonts/UnicodeFont.ttf'),
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/segoeui.ttf'
  ];

  for (const p of fontPaths) {
    if (fs.existsSync(p)) {
      try {
        doc.registerFont('MainFont', p);
        bodyFont = 'MainFont';
        const boldPath = p.replace('.ttf', 'bd.ttf');
        if (fs.existsSync(boldPath)) {
          doc.registerFont('MainFontBold', boldPath);
          boldFont = 'MainFontBold';
        } else {
          boldFont = 'MainFont';
        }
        break;
      } catch (e) {}
    }
  }

  // Page Border
  doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

  // ── HEADER ──
  doc.rect(0, 0, doc.page.width, 80).fill('#0f172a');
  
  // Logo area
  doc.fontSize(26).fillColor('#60a5fa').font(boldFont).text('ScholarStock', 50, 25);
  doc.fontSize(10).fillColor('#94a3b8').font(bodyFont).text('ULTIMATE PREP SERIES', 50, 52);
  
  // Category badge
  doc.rect(doc.page.width - 200, 25, 150, 30, 5).fill('#1e293b');
  doc.fontSize(11).fillColor('#ffffff').font(boldFont).text(`${item.category} EXAM`, doc.page.width - 200, 34, { align: 'center', width: 150 });

  doc.moveDown(4);

  // ── TITLE & SUBTITLE ──
  doc.fontSize(22).fillColor('#1e293b').font(boldFont).text(item.title, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#64748b').font(italicFont).text(`Topic: ${item.subcategory}  |  Difficulty: ${item.difficulty || 'Medium'}`, { align: 'center' });

  doc.moveDown(1.5);
  
  // Divider
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#3b82f6').lineWidth(2).stroke();
  doc.moveDown(1.5);

  // ── THEORY SECTION ──
  if (item.theory) {
    doc.fontSize(14).fillColor('#0f172a').font(boldFont).text('📘 CONCEPT OVERVIEW');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#334155').font(bodyFont).text(item.theory, { align: 'justify', lineGap: 5, paragraphGap: 10 });
    doc.moveDown(1.5);
  }

  // ── FORMULAS SECTION ──
  if (item.formulas && item.formulas.length > 0) {
    doc.fontSize(14).fillColor('#3b82f6').font(boldFont).text('📐 KEY FORMULAS & CONSTANTS');
    doc.moveDown(0.5);
    
    const startY = doc.y;
    const boxWidth = doc.page.width - 100;
    const boxHeight = (item.formulas.length * 25) + 15;
    
    doc.rect(50, startY, boxWidth, boxHeight).fill('#f8fafc');
    doc.rect(50, startY, 4, boxHeight).fill('#3b82f6'); // Left accent
    
    doc.fillColor('#1e293b');
    item.formulas.forEach((f, i) => {
      doc.fontSize(11).font(boldFont).text(`${i + 1}. `, 70, startY + 10 + (i * 25), { continued: true })
         .font(bodyFont).text(f);
    });
    
    doc.y = startY + boxHeight;
    doc.moveDown(2);
  }

  // ── SOLVED EXAMPLES ──
  if (item.solvedExamples && item.solvedExamples.length > 0) {
    if (doc.y > doc.page.height - 200) doc.addPage();
    
    doc.fontSize(14).fillColor('#0f172a').font(boldFont).text('📝 SOLVED EXAMPLES');
    doc.moveDown(1);
    
    item.solvedExamples.forEach((ex, i) => {
      if (doc.y > doc.page.height - 150) doc.addPage();
      
      const exY = doc.y;
      doc.rect(50, exY, doc.page.width - 100, 1).fill('#e2e8f0'); // Divider
      doc.moveDown(0.8);
      
      doc.fontSize(11).fillColor('#1e293b').font(boldFont).text(`Example ${i + 1}: `, { continued: true })
         .font(bodyFont).text(ex.question);
      
      doc.moveDown(0.5);
      
      doc.fontSize(11).fillColor('#059669').font(boldFont).text('Solution: ', { continued: true })
         .font(bodyFont).fillColor('#334155').text(ex.solution);
      
      doc.moveDown(1.5);
    });
  }

  // ── MCQS SECTION ──
  if (item.mcqs && item.mcqs.length > 0) {
    doc.addPage();
    // Re-render Page Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    
    // MCQ Header
    doc.rect(0, 0, doc.page.width, 80).fill('#0f172a');
    doc.fontSize(22).fillColor('#60a5fa').font(boldFont).text('ScholarStock', 50, 25);
    doc.fontSize(14).fillColor('#ffffff').font(boldFont).text('PRACTICE QUESTIONS (MCQs)', 50, 95);
    doc.moveDown(2);

    item.mcqs.forEach((mcq, i) => {
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      }
      
      doc.fontSize(11).fillColor('#1e293b').font(boldFont).text(`Q${i + 1}. `, { continued: true })
         .font(bodyFont).text(mcq.q);
      
      doc.moveDown(0.5);
      
      // Options Grid
      const optY = doc.y;
      mcq.options.forEach((opt, idx) => {
        const xPos = idx % 2 === 0 ? 70 : doc.page.width / 2 + 10;
        const yPos = optY + Math.floor(idx / 2) * 20;
        
        doc.fontSize(10).fillColor('#475569').font(bodyFont).text(opt, xPos, yPos);
      });
      
      doc.y = optY + Math.ceil(mcq.options.length / 2) * 20 + 10;
      
      doc.fontSize(10).fillColor('#059669').font(boldFont).text('Correct Answer: ', { continued: true })
         .font(bodyFont).text(mcq.answer);
         
      if (mcq.explanation) {
        doc.fontSize(10).fillColor('#64748b').font(italicFont).text(`Explanation: ${mcq.explanation}`, { indent: 20 });
      }
      
      doc.moveDown(1.5);
    });
  }

  // ── WATERMARK ──
  doc.save();
  doc.opacity(0.04);
  doc.fontSize(60).fillColor('#3b82f6').font(boldFont);
  for (let y = 100; y < doc.page.height; y += 250) {
    for (let x = -50; x < doc.page.width; x += 350) {
      doc.save();
      doc.translate(x, y).rotate(-35);
      doc.text('ScholarStock', 0, 0);
      doc.restore();
    }
  }
  doc.restore();

  // ── FOOTER ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 40;
    doc.rect(0, footerY - 10, doc.page.width, 50).fill('#0f172a');
    doc.fontSize(9).fillColor('#94a3b8').font(bodyFont).text(`© ScholarStock • PREMIUM SERIES • Page ${i + 1} of ${range.count}`, 50, footerY, { align: 'center', width: doc.page.width - 100 });
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

// Background collection - TOPIC-BASED
async function startCollection() {
  console.log('Content engine: Starting topic-based collection...');
  console.log(`Topic: ${contentEngine.currentTopic.category} > ${contentEngine.currentTopic.subcategory}`);
  
  let consecutiveFailures = 0;
  const maxFailures = 10;
  
  while (contentEngine.running && !contentEngine.topicComplete) {
    // Check if paused
    if (contentEngine.paused) {
      console.log('Content engine: Paused');
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    
    try {
      const provider = aiPool.getAvailableProvider();
      
      if (!provider) {
        console.log('Content engine: All providers exhausted');
        contentEngine.error = 'All AI providers have reached their limits';
        contentEngine.running = false;
        break;
      }
      
      const content = await generateContent(provider, contentEngine.totalGenerated + 1);
      
      if (content) {
        contentEngine.collected.push(content);
        contentEngine.totalGenerated++;
        provider.usage++;
        consecutiveFailures = 0;
        
        // Update coverage tracking
        if (content.formulas) {
          contentEngine.coverage.formulas.push(...content.formulas);
        }
        if (content.topicsCovered) {
          contentEngine.coverage.topics.push(...content.topicsCovered);
        }
        if (content.difficulty) {
          contentEngine.coverage.difficulty_distribution[content.difficulty]++;
        }
        
        console.log(`Content engine: ${contentEngine.totalGenerated} items collected`);
        
        // Check if topic is complete
        if (content.topicComplete || contentEngine.collected.length >= 500) {
          contentEngine.topicComplete = true;
          console.log('Content engine: Topic coverage complete!');
          break;
        }
      } else {
        consecutiveFailures++;
        if (consecutiveFailures >= maxFailures) {
          console.log('Content engine: Too many consecutive failures, stopping');
          contentEngine.error = 'Generation quality degraded';
          contentEngine.running = false;
          break;
        }
      }
    } catch (err) {
      console.error(`Content generation error: ${err.message}`);
      consecutiveFailures++;
    }
    
    // Delay to avoid rate limits (5 seconds between requests)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  if (contentEngine.running && !contentEngine.paused) {
    console.log('Content engine: Collection complete!');
    contentEngine.running = false;
  }
}

// Generate content using specific provider - TOPIC-COVERAGE FOCUSED
async function generateContent(provider, index) {
  const { category, subcategory, topicType } = contentEngine.currentTopic;
  const topicLabel = subcategory || `All ${category} topics`;
  
  const prompt = `You are an ELITE exam content creator for the ${category} exam. 
  Your task is to generate ULTIMATELY PROFESSIONAL study material that looks like it came from a top-tier textbook.

  STRICT RESEARCH & TRANSFORMATION RULE:
  - Step 1: Research the highest-quality exam questions for ${category}.
  - Step 2: PARAPHRASE entirely. Reword the context and logic.
  - Step 3: CHANGE ALL NUMBERS and variables.
  - Step 4: Ensure the content is legally distinct and original.

  STRICT SYMBOL & NOTATION RULE:
  - DO NOT USE LaTeX NOTATION (no backslashes like \\frac, \\cos, \\theta).
  - USE ACTUAL UNICODE SYMBOLS ONLY (e.g., θ, γ, α, β, λ, μ, π, Σ, Δ, ±, ≈, ≠, ≤, ≥, √, ∞, ², ³, ⁴).
  - Write formulas clearly: (1/2)mv², √(x² + y²), cos θ.
  - The text must be perfectly readable in a standard PDF without any special rendering engine.

  STRICT JSON FORMATTING RULE:
  - You MUST return a VALID JSON object ONLY.
  - NO markdown formatting (no \`\`\`json blocks).
  - NO text before or after the JSON.
  - Escape all special characters properly.
  - Double-check that all braces and quotes are balanced.

CONTENT TYPE: ${topicType === 'formulas' ? 'FORMULA BANK' : 
               topicType === 'questions' ? 'PRACTICE QUESTION PAPER' : 
               'COMPLETE PRACTICE SHEET'}

STRICT REQUIREMENTS:
- Theory: 2-3 paragraphs of clear, deep concept explanation.
- MCQs: 8-12 high-quality questions with 4 options and detailed explanations.
- Solved Examples: 3-5 step-by-step problems with professional walkthroughs.
- Formulas: Comprehensive list of key equations.

JSON STRUCTURE:
{
  "title": "${category} - ${topicLabel}: Master Class Sheet ${index}",
  "category": "${category}",
  "subcategory": "${topicLabel}",
  "difficulty": "Easy|Medium|Hard",
  "theory": "...",
  "formulas": ["..."],
  "solvedExamples": [{"question": "...", "solution": "..."}],
  "mcqs": [{"q": "...", "options": ["A) ", "B) ", "C) ", "D) "], "answer": "A|B|C|D", "explanation": "..."}],
  "topicsCovered": ["..."],
  "topicComplete": false,
  "references": ["Official ${category} Prep Guide"],
  "suggestedPrice": 9,
  "pages": 4
}
`;

  try {
    let response;
    switch (provider.type) {
      case 'openrouter':
      case 'cerebras':
      case 'github':
      case 'nvidia':
      case 'sambanova': {
        response = await axios.post(provider.endpoint, {
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${provider.key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://scholarstock.com',
            'X-Title': 'ScholarStock Content Engine'
          }
        });
        const contentText = response.data.choices[0].message.content;
        return parseContent(contentText, index);
      }
        
      case 'huggingface': {
        response = await axios.post(`${provider.endpoint}${provider.model}`, {
          inputs: prompt,
          parameters: { max_new_tokens: 2000, temperature: 0.7 }
        }, {
          headers: {
            'Authorization': `Bearer ${provider.key}`,
            'Content-Type': 'application/json'
          }
        });
        return parseContent(response.data[0]?.generated_text || '', index);
      }
        
      case 'together':
      case 'deepseek':
      case 'fireworks':
      case 'groq':
      case 'mistral': {
        response = await axios.post(provider.endpoint, {
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${provider.key}`,
            'Content-Type': 'application/json'
          }
        });
        return parseContent(response.data.choices[0].message.content, index);
      }
        
      case 'gemini': {
        response = await axios.post(`${provider.endpoint}${provider.model}:generateContent?key=${provider.key}`, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 }
        });
        return parseContent(response.data.candidates[0].content.parts[0].text, index);
      }
        
      case 'ai21': {
        response = await axios.post(`${provider.endpoint}${provider.model}/complete`, {
          prompt: prompt,
          maxTokens: 2000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${provider.key}`,
            'Content-Type': 'application/json'
          }
        });
        return parseContent(response.data.completions[0].data.text, index);
      }
        
      default:
        throw new Error(`Unknown provider type: ${provider.type}`);
    }
  } catch (err) {
    console.error(`${provider.name} error:`, err.message);
    // Return null to retry with next provider
    return null;
  }
}

// Parse AI response into structured content - TOPIC COVERAGE
function parseContent(content, index) {
  try {
    // Extract JSON from response - handle markdown and noise
    let jsonStr = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.log('Direct parse failed, trying to clean JSON...');
      // Remove trailing commas and other common JSON noise
      const cleaned = jsonStr
        .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
        .replace(/([^\\])\\"/g, '$1"') // fix escaped quotes
        .replace(/\\n/g, ' ');         // remove newlines inside strings
      data = JSON.parse(cleaned);
    }
    
    // Post-processing: Clean up common LaTeX if AI ignored instructions
    const latexMap = {
      // Greek Lowercase
      '\\\\theta': 'θ', '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ',
      '\\\\delta': 'δ', '\\\\epsilon': 'ε', '\\\\zeta': 'ζ', '\\\\eta': 'η',
      '\\\\iota': 'ι', '\\\\kappa': 'κ', '\\\\lambda': 'λ', '\\\\mu': 'μ',
      '\\\\nu': 'ν', '\\\\xi': 'ξ', '\\\\pi': 'π', '\\\\rho': 'ρ',
      '\\\\sigma': 'σ', '\\\\tau': 'τ', '\\\\upsilon': 'υ', '\\\\phi': 'φ',
      '\\\\chi': 'χ', '\\\\psi': 'ψ', '\\\\omega': 'ω',
      // Greek Uppercase
      '\\\\Delta': 'Δ', '\\\\Gamma': 'Γ', '\\\\Theta': 'Θ', '\\\\Lambda': 'Λ',
      '\\\\Pi': 'Π', '\\\\Sigma': 'Σ', '\\\\Phi': 'Φ', '\\\\Psi': 'Ψ', '\\\\Omega': 'Ω',
      // Math Operators & Symbols
      '\\\\sqrt': '√', '\\\\approx': '≈', '\\\\neq': '≠', '\\\\le': '≤', '\\\\ge': '≥',
      '\\\\pm': '±', '\\\\times': '×', '\\\\div': '÷', '\\\\cdot': '·',
      '\\\\degree': '°', '\\\\infty': '∞', '\\\\partial': '∂', '\\\\nabla': '∇',
      '\\\\in': '∈', '\\\\notin': '∉', '\\\\subset': '⊂', '\\\\supset': '⊃',
      '\\\\cup': '∪', '\\\\cap': '∩', '\\\\forall': '∀', '\\\\exists': '∃',
      '\\\\implies': '⇒', '\\\\iff': '⇔', '\\\\to': '→', '\\\\angle': '∠',
      '\\\\perp': '⊥', '\\\\parallel': '∥', '\\\\cong': '≅', '\\\\sim': '∼',
      '\\\\propto': '∝', '\\\\hbar': 'ħ',
      // Functions
      '\\\\cos': 'cos', '\\\\sin': 'sin', '\\\\tan': 'tan', '\\\\sec': 'sec',
      '\\\\csc': 'csc', '\\\\cot': 'cot', '\\\\arcsin': 'arcsin', '\\\\arccos': 'arccos',
      '\\\\arctan': 'arctan', '\\\\log': 'log', '\\\\ln': 'ln', '\\\\exp': 'exp',
      '\\\\lim': 'lim', '\\\\max': 'max', '\\\\min': 'min',
      // Brackets & Layout
      '\\\\(': '', '\\\\)': '', '\\\\[': '', '\\\\]': '',
      '\\\\{': '{', '\\\\}': '}', '\\\\text': '', '\\\\mathbf': '', '\\\\mathrm': '',
      '\\\\frac': '/', '\\\\cdot': '·', '\\\\ast': '*', '\\\\star': '*',
      '\\\\hat': '', '\\\\bar': '', '\\\\tilde': '', '\\\\vec': ''
    };

    const clean = (str) => {
      if (typeof str !== 'string') return str;
      let s = str;
      
      // Handle \frac{a}{b} -> (a/b)
      s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
      
      // Apply the map
      Object.entries(latexMap).forEach(([key, val]) => {
        s = s.replace(new RegExp(key, 'g'), val);
      });
      
      // Handle simple superscripts x^2 -> x²
      const superMap = { '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹', 'n':'ⁿ', 'x':'ˣ' };
      s = s.replace(/\^([0-9nx])/g, (m, p1) => superMap[p1] || m);
      s = s.replace(/\^\{([0-9nx]+)\}/g, (m, p1) => {
        return p1.split('').map(c => superMap[c] || c).join('');
      });
      
      // Handle simple subscripts x_2 -> x₂
      const subMap = { '0':'₀', '1':'₁', '2':'₂', '3':'₃', '4':'₄', '5':'₅', '6':'₆', '7':'₇', '8':'₈', '9':'₉' };
      s = s.replace(/_([0-9])/g, (m, p1) => subMap[p1] || m);
      s = s.replace(/_\{([0-9]+)\}/g, (m, p1) => {
        return p1.split('').map(c => subMap[c] || c).join('');
      });

      return s;
    };

    return {
      title: data.title || `Content Sheet ${index}`,
      category: data.category || 'JEE',
      subcategory: data.subcategory || 'Physics',
      difficulty: data.difficulty || 'Medium',
      theory: clean(data.theory || ''),
      formulas: (data.formulas || []).map(clean),
      solvedExamples: (data.solvedExamples || []).map(ex => ({
        question: clean(ex.question || ''),
        solution: clean(ex.solution || '')
      })),
      mcqs: (data.mcqs || []).map(mcq => ({
        q: clean(mcq.q || ''),
        options: (mcq.options || []).map(clean),
        answer: mcq.answer || '',
        explanation: clean(mcq.explanation || '')
      })),
      topicsCovered: data.topicsCovered || [],
      topicComplete: data.topicComplete || false,
      references: data.references || [],
      suggestedPrice: data.suggestedPrice || 9,
      pages: data.pages || 3,
      approved: false,
      fileUrl: null,
      rawContent: content
    };
  } catch (err) {
    console.error('Final Parse Error:', err.message);
    return createFallbackContent(index);
  }
}

// Fallback content if parsing fails - MAINTAIN QUALITY
function createFallbackContent(index) {
  const { category, subcategory } = contentEngine.currentTopic || { category: 'JEE', subcategory: 'Physics' };
  
  return {
    title: `${category} - ${subcategory} (Parsing Error)`,
    category: category,
    subcategory: subcategory,
    difficulty: 'Medium',
    theory: 'Error parsing AI response. Please check rawContent or retry generation.',
    formulas: [],
    solvedExamples: [],
    mcqs: [],
    topicsCovered: [],
    topicComplete: false,
    suggestedPrice: 9,
    pages: 1,
    approved: false,
    fileUrl: null
  };
}

module.exports = router;
