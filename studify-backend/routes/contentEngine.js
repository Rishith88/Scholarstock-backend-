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
        enabled: !!process.env.GROQ_API_KEY,
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
        enabled: !!process.env.GROQ_API_KEY,
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
        enabled: !!process.env.CEREBRAS_API_KEY,
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
        enabled: !!process.env.CEREBRAS_API_KEY,
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
        enabled: !!process.env.HUGGINGFACE_API_KEY,
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
        enabled: !!process.env.HUGGINGFACE_API_KEY,
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
        enabled: !!process.env.HUGGINGFACE_API_KEY,
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
        enabled: !!process.env.HUGGINGFACE_API_KEY,
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
        enabled: !!process.env.HUGGINGFACE_API_KEY,
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
        enabled: !!process.env.CEREBRAS_API_KEY,
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
        enabled: !!process.env.CEREBRAS_API_KEY,
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
        enabled: !!process.env.GITHUB_TOKEN,
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
        enabled: !!process.env.GITHUB_TOKEN,
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
        enabled: !!process.env.GITHUB_TOKEN,
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
        enabled: !!process.env.NVIDIA_API_KEY,
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
        enabled: !!process.env.NVIDIA_API_KEY,
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
        enabled: !!process.env.SAMBANOVA_API_KEY,
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
        enabled: !!process.env.SAMBANOVA_API_KEY,
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
        enabled: !!process.env.DEEPSEEK_API_KEY,
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
        enabled: !!process.env.DEEPSEEK_API_KEY,
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
        enabled: !!process.env.GEMINI_API_KEY,
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
        enabled: !!process.env.GEMINI_API_KEY,
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
        enabled: !!process.env.DEEPSEEK_API_KEY,
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
        enabled: !!process.env.DEEPSEEK_API_KEY,
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
        enabled: !!process.env.FIREWORKS_API_KEY,
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
        enabled: !!process.env.FIREWORKS_API_KEY,
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
        enabled: !!process.env.FIREWORKS_API_KEY,
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
        enabled: !!process.env.GROQ_API_KEY,
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
        enabled: !!process.env.GROQ_API_KEY,
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
        enabled: !!process.env.MISTRAL_API_KEY,
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
        enabled: !!process.env.MISTRAL_API_KEY,
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
        enabled: !!process.env.AI21_API_KEY,
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

// POST /api/content-engine/preview-pdf-stream
router.post('/preview-pdf-stream', auth, verifyAdmin, async (req, res) => {
  try {
    const item = req.body;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
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

  // ── HEADER ──
  doc.rect(0, 0, doc.page.width, 70).fill('#0f172a');
  doc.fontSize(22).fillColor('#60a5fa').font(boldFont).text('ScholarStock', 50, 20);
  doc.fontSize(10).fillColor('#94a3b8').font(bodyFont).text('Premium Study Materials', 50, 46);
  doc.fontSize(10).fillColor('#ffffff').text(`${item.category} • ${item.subcategory}`, 0, 30, { align: 'right', width: doc.page.width - 50 });

  doc.moveDown(3);

  // ── TITLE ──
  doc.fontSize(18).fillColor('#1e293b').font(boldFont).text(item.title, { align: 'center' });
  doc.moveDown(0.5);

  // ── META ──
  doc.fontSize(10).fillColor('#64748b').font(bodyFont).text(`Difficulty: ${item.difficulty || 'Medium'}  •  Pages: ${item.pages || 3}`, { align: 'center' });

  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(1);

  // ── CONTENT ──
  if (item.theory) {
    doc.fontSize(12).fillColor('#1e293b').font(boldFont).text('Concept Overview', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#334155').font(bodyFont).text(item.theory, { align: 'left', lineGap: 4 });
    doc.moveDown(1);
  }

  // ── FORMULAS ──
  if (item.formulas && item.formulas.length > 0) {
    doc.fontSize(12).fillColor('#3b82f6').font(boldFont).text('Key Formulas & Constants');
    doc.moveDown(0.5);
    doc.rect(50, doc.y, doc.page.width - 100, (item.formulas.length * 20) + 10).fill('#f8fafc');
    doc.fillColor('#1e293b');
    item.formulas.forEach((f, i) => {
      doc.fontSize(10).font(boldFont).text(`${i + 1}. `, 65, doc.y + 5, { continued: true }).font(bodyFont).text(f);
      doc.moveDown(0.5);
    });
    doc.moveDown(1);
  }

  // ── SOLVED EXAMPLES ──
  if (item.solvedExamples && item.solvedExamples.length > 0) {
    doc.fontSize(12).fillColor('#1e293b').font(boldFont).text('Solved Examples');
    doc.moveDown(0.5);
    item.solvedExamples.forEach((ex, i) => {
      doc.fontSize(10).fillColor('#334155').font(boldFont).text(`Example ${i + 1}: `, { continued: true }).font(bodyFont).text(ex.question);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#059669').font(boldFont).text('Solution: ', { continued: true }).font(bodyFont).text(ex.solution);
      doc.moveDown(1);
    });
  }

  // ── MCQS ──
  if (item.mcqs && item.mcqs.length > 0) {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 70).fill('#0f172a');
    doc.fontSize(22).fillColor('#60a5fa').font(boldFont).text('ScholarStock', 50, 20);
    doc.fontSize(12).fillColor('#1e293b').font(boldFont).text('Practice Questions (MCQs)', 50, 90);
    doc.moveDown(1);
    item.mcqs.forEach((mcq, i) => {
      doc.fontSize(10).fillColor('#1e293b').font(boldFont).text(`Q${i + 1}. ${mcq.q}`);
      doc.moveDown(0.3);
      mcq.options.forEach(opt => {
        doc.fontSize(9).fillColor('#475569').font(bodyFont).text(opt, { indent: 20 });
      });
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#059669').font(boldFont).text(`Correct Answer: ${mcq.answer}`, { indent: 20 });
      if (mcq.explanation) {
        doc.fontSize(9).fillColor('#64748b').font(bodyFont).text(`Explanation: ${mcq.explanation}`, { indent: 20 });
      }
      doc.moveDown(1);
    });
  }

  // ── REFERENCES ──
  if (item.references && item.references.length > 0) {
    doc.fontSize(11).fillColor('#64748b').font(boldFont).text('References:');
    doc.fontSize(10).fillColor('#64748b').font(bodyFont).text(item.references.join(', '));
    doc.moveDown(1);
  }

  // ── WATERMARK ──
  doc.save();
  doc.opacity(0.07);
  doc.fontSize(60).fillColor('#3b82f6').font(boldFont);
  for (let y = 100; y < doc.page.height; y += 200) {
    for (let x = -100; x < doc.page.width; x += 350) {
      doc.save();
      doc.translate(x, y).rotate(-35);
      doc.text('ScholarStock', 0, 0);
      doc.restore();
    }
  }
  doc.restore();
  doc.opacity(1);

  // ── FOOTER ──
  const footerY = doc.page.height - 40;
  doc.rect(0, footerY - 10, doc.page.width, 50).fill('#0f172a');
  doc.fontSize(8).fillColor('#94a3b8').font(bodyFont).text('© ScholarStock • scholarstock.com • Unauthorized distribution prohibited', 50, footerY, { align: 'center', width: doc.page.width - 100 });
}

// Generate a watermarked PDF and upload to Supabase Storage
function generateWatermarkedPDF(item) {
  return new Promise((resolve, reject) => {
    const filename = `generated/${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
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
  
  const prompt = `You are an expert exam content creator for the ${category} exam. 
  
  RESEARCH & TRANSFORMATION RULE (CRITICAL):
  - Step 1: Research (mentally or via search) the highest-quality, copyrighted exam questions from official sources, top prep books (like Princeton Review, Barron's, Kaplan for SAT/GRE, or standard NCERT/HC Verma for Indian exams).
  - Step 2: Use these high-quality sources ONLY as "inspiration".
  - Step 3: PARAPHRASE the text entirely. Do not copy sentences. Rewrite the context, the story, and the wording.
  - Step 4: CHANGE ALL NUMBERS. If a source question uses 5kg and 10m/s, YOU must use 12kg and 15m/s or different values entirely.
  - Step 5: Generate a brand new question that tests the SAME concept but is legally distinct and original.
  
  STRICT RELEVANCE RULE: 
  - You MUST generate content specifically for ${category} (${topicLabel}). 
  - DO NOT generate content for unrelated exams like JEE, NEET, or UPSC if the requested category is different (e.g., if SAT is requested, generate SAT content only).
  - The level of difficulty, question style, and syllabus MUST match ${category} standards.

CONTENT TYPE: ${topicType === 'formulas' ? 'FORMULA BANK with derivations and solved examples' : 
               topicType === 'questions' ? 'PRACTICE QUESTION PAPER with MCQs, short answers, and long answers' : 
               'COMPLETE PRACTICE SHEET with theory, formulas, solved examples, and practice MCQs'}

STRICT REQUIREMENTS:
- Write like a real exam preparation book (Standard ${category} prep material style)
- Include 8-12 MCQs with 4 options each (mark correct answer)
- Include 3-5 solved examples with step-by-step solutions
- Include key formulas with units and conditions
- Include important concepts/theory (2-3 paragraphs)
- Use proper scientific and mathematical notation.
- USE ACTUAL UNICODE SYMBOLS for better professional appearance (e.g., θ, γ, α, β, λ, μ, π, Σ, Δ, ±, ≈, ≠, ≤, ≥, √, ∞).
- For powers and subscripts, you can use Unicode superscripts/subscripts if possible (e.g., x², y₃) or standard ^ notation (e.g., x^2).
- Use standard operators: ×, ÷, +, -, =, √().
- Questions should be exam-relevant and varied difficulty
- NO filler content, NO generic text

FORMAT YOUR RESPONSE AS VALID JSON ONLY (no markdown, no extra text):
{
  "title": "${category} - ${topicLabel}: Practice Sheet ${index}",
  "category": "${category}",
  "subcategory": "${topicLabel}",
  "difficulty": "Easy|Medium|Hard",
  "theory": "2-3 paragraphs of clear concept explanation using actual math symbols like θ and √.",
  "formulas": ["F = m × a (Newton's 2nd Law)", "v² = u² + 2as (Kinematics)", "E = mc²"],
  "solvedExamples": [
    {
      "question": "If the angle θ is 30° and force F is 10N...",
      "solution": "Step 1: Calculate component F cos(θ)... Answer: 5√3 N"
    }
  ],
  "mcqs": [
    {
      "q": "What is the value of the constant π approximately?",
      "options": ["A) 3.14", "B) 2.71", "C) 1.41", "D) 1.62"],
      "answer": "A",
      "explanation": "π (pi) is the ratio of circumference to diameter, approximately 3.14159."
    }
  ],
  "topicsCovered": ["Newton's Laws", "Trigonometry in Physics"],
  "topicComplete": false,
  "references": ["Official ${category} Study Guide", "Standard Prep Material"],
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
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createFallbackContent(index);
    }
    
    const data = JSON.parse(jsonMatch[0]);
    
    return {
      title: data.title || `Content Sheet ${index}`,
      category: data.category || 'JEE',
      subcategory: data.subcategory || 'Physics',
      difficulty: data.difficulty || 'Medium',
      theory: data.theory || '',
      formulas: data.formulas || [],
      solvedExamples: data.solvedExamples || [],
      mcqs: data.mcqs || [],
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
    return createFallbackContent(index);
  }
}

// Fallback content if parsing fails - MAINTAIN QUALITY
function createFallbackContent(index) {
  const categories = ['JEE', 'NEET', 'UPSC'];
  const subjects = ['Physics', 'Chemistry', 'Math', 'Biology'];
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const prices = [5, 7, 9, 12, 15, 19, 25, 29];
  
  return {
    title: `Content Sheet ${index}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    subcategory: subjects[Math.floor(Math.random() * subjects.length)],
    difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
    content: '',
    formulas: [],
    topicsCovered: [],
    topicComplete: false,
    suggestedPrice: prices[Math.floor(Math.random() * prices.length)],
    pages: Math.floor(Math.random() * 4) + 2,
    approved: false,
    fileUrl: null
  };
}

module.exports = router;
