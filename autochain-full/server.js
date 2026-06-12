/**
 * AutoChain AI — Pure Node.js HTTP Server (no external dependencies)
 * ET AutoTech Hackathon 2026
 *
 * Run:  node server.js
 * Open: http://localhost:3000
 *
 * NOTE: If running locally with npm available:
 *   npm install express cors && node server.js
 * The express version is identical — just replace the http handler below
 * with the express routes in src/routes/.
 */

'use strict';

const http = require('http');
const path = require('path');
const fs   = require('fs');
const url  = require('url');

// ── Load all models (no external deps needed) ─────────────────────────────────
const riskEngine    = require('./src/models/riskEngine');
const mfgModel      = require('./src/models/manufacturingModel');
const commodityModel= require('./src/models/commodityModel');
const inventoryModel= require('./src/models/inventoryModel');
const copilotEngine = require('./src/models/copilotEngine');
const { SUPPLIERS } = require('./src/data/supplierDatabase');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css',   '.json': 'application/json',
  '.png': 'image/png',  '.svg': 'image/svg+xml'
};

// ── JSON helpers ──────────────────────────────────────────────────────────────
function ok(res, data)   { json(res, 200, { success: true,  ...data }); }
function err(res, msg)   { json(res, 500, { success: false, error: msg }); }
function notFound(res)   { json(res, 404, { success: false, error: 'Not found' }); }
function json(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

// ── Request router ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST' });
    return res.end();
  }

  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query    = parsed.query;

  try {
    // ── Static files ────────────────────────────────────────────────────────
    if (!pathname.startsWith('/api')) {
      const filePath = path.join(__dirname, 'public',
        pathname === '/' ? 'index.html' : pathname);
      const ext = path.extname(filePath);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        return res.end(fs.readFileSync(filePath));
      }
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    }

    // ── Health ──────────────────────────────────────────────────────────────
    if (pathname === '/api/health') {
      return ok(res, { version: '1.0.0', uptime: process.uptime(), time: new Date().toISOString() });
    }

    // ── Risk ────────────────────────────────────────────────────────────────
    if (pathname === '/api/risk/score') {
      const score = riskEngine.computeOverallRisk(SUPPLIERS);
      const level = riskEngine.scoreToLevel(score);
      const byCategory = {};
      SUPPLIERS.forEach(s => {
        if (!byCategory[s.category]) byCategory[s.category] = [];
        byCategory[s.category].push(riskEngine.computeSupplierRisk(s).score);
      });
      const categoryScores = Object.entries(byCategory).map(([cat, arr]) => ({
        category: cat,
        avgScore: Math.round(arr.reduce((a,b)=>a+b,0)/arr.length),
        level: riskEngine.scoreToLevel(Math.round(arr.reduce((a,b)=>a+b,0)/arr.length))
      })).sort((a,b)=>b.avgScore-a.avgScore);
      return ok(res, { score, level, categoryScores, timestamp: new Date().toISOString() });
    }

    if (pathname === '/api/risk/alerts') {
      const alerts = riskEngine.generateAlerts(SUPPLIERS);
      const filtered = query.level ? alerts.filter(a=>a.level===query.level) : alerts;
      return ok(res, { count: filtered.length, alerts: filtered });
    }

    if (pathname === '/api/risk/forecast') {
      const days = parseInt(query.days) || 30;
      return ok(res, { horizon: days, forecast: riskEngine.forecastDisruptions(null, days) });
    }

    if (pathname === '/api/risk/alternate' && req.method === 'POST') {
      const body = await readBody(req);
      const { category = 'Semiconductor', currentSupplierId } = body;
      const alts = riskEngine.recommendAlternateSources(category, currentSupplierId, SUPPLIERS);
      return ok(res, { category, count: alts.length, alternates: alts });
    }

    const supMatch = pathname.match(/^\/api\/risk\/supplier\/(\w+)$/);
    if (supMatch) {
      const sup = SUPPLIERS.find(s => s.id === supMatch[1]);
      if (!sup) return notFound(res);
      return ok(res, { supplier: sup, risk: riskEngine.computeSupplierRisk(sup) });
    }

    // ── Suppliers ───────────────────────────────────────────────────────────
    if (pathname === '/api/suppliers' && req.method === 'GET') {
      let list = SUPPLIERS.map(s => ({ ...s, risk: riskEngine.computeSupplierRisk(s) }));
      if (query.category) list = list.filter(s=>s.category.toLowerCase().includes(query.category.toLowerCase()));
      if (query.country)  list = list.filter(s=>s.country.toLowerCase().includes(query.country.toLowerCase()));
      return ok(res, { count: list.length, suppliers: list });
    }

    if (pathname === '/api/suppliers/alternate' && req.method === 'POST') {
      const body = await readBody(req);
      const alts = riskEngine.recommendAlternateSources(body.category || 'Semiconductor', body.currentSupplierId, SUPPLIERS);
      return ok(res, { alternates: alts });
    }

    const supIdMatch = pathname.match(/^\/api\/suppliers\/(\w+)$/);
    if (supIdMatch) {
      const sup = SUPPLIERS.find(s => s.id === supIdMatch[1]);
      if (!sup) return notFound(res);
      return ok(res, { supplier: { ...sup, risk: riskEngine.computeSupplierRisk(sup) } });
    }

    // ── Manufacturing ───────────────────────────────────────────────────────
    if (pathname === '/api/manufacturing/oee')
      return ok(res, { data: mfgModel.getAllOEE() });

    const oeeLineMatch = pathname.match(/^\/api\/manufacturing\/oee\/(\w+)$/);
    if (oeeLineMatch) {
      const d = mfgModel.computeOEE(oeeLineMatch[1].toUpperCase());
      return d ? ok(res, { data: d }) : notFound(res);
    }

    if (pathname === '/api/manufacturing/cpk')
      return ok(res, { data: mfgModel.getAllCpk() });

    const cpkLineMatch = pathname.match(/^\/api\/manufacturing\/cpk\/(\w+)$/);
    if (cpkLineMatch) {
      const d = mfgModel.computeCpk(cpkLineMatch[1].toUpperCase());
      return d ? ok(res, { data: d }) : notFound(res);
    }

    if (pathname === '/api/manufacturing/defects')
      return ok(res, { data: mfgModel.getDefectStats() });

    if (pathname === '/api/manufacturing/energy')
      return ok(res, { data: mfgModel.getEnergyForecast() });

    if (pathname === '/api/manufacturing/energy/predict' && req.method === 'POST') {
      const body = await readBody(req);
      const d = mfgModel.predictEnergy(body);
      return d ? ok(res, { data: d }) : err(res, 'Invalid plant');
    }

    if (pathname === '/api/manufacturing/lines')
      return ok(res, { data: mfgModel.PRODUCTION_LINES });

    // ── Commodities ─────────────────────────────────────────────────────────
    if (pathname === '/api/commodities')
      return ok(res, { data: commodityModel.getCommodityPrices() });

    const commForecast = pathname.match(/^\/api\/commodities\/forecast\/(\w+)$/);
    if (commForecast) {
      const d = commodityModel.forecastCommodityPrice(commForecast[1], parseInt(query.days)||30);
      return d ? ok(res, { data: d }) : notFound(res);
    }

    if (pathname === '/api/commodities/substitutions')
      return ok(res, { data: commodityModel.getMaterialSubstitutions(query.material) });

    if (pathname === '/api/commodities/hedging')
      return ok(res, { data: commodityModel.getHedgingSignals() });

    // ── Inventory ───────────────────────────────────────────────────────────
    if (pathname === '/api/inventory')
      return ok(res, { data: inventoryModel.getInventoryDashboard() });

    if (pathname === '/api/inventory/reorder') {
      const recs = inventoryModel.getReorderRecommendations();
      const filtered = query.urgency ? recs.filter(r=>r.urgency===query.urgency.toUpperCase()) : recs;
      return ok(res, { count: filtered.length, data: filtered });
    }

    const invForecast = pathname.match(/^\/api\/inventory\/forecast\/(.+)$/);
    if (invForecast) {
      const part = inventoryModel.PARTS.find(p => p.partNo === decodeURIComponent(invForecast[1]));
      if (!part) return notFound(res);
      return ok(res, { partNo: part.partNo, name: part.name, data: inventoryModel.forecastDemand(part, parseInt(query.days)||14) });
    }

    // ── Copilot ─────────────────────────────────────────────────────────────
    if (pathname === '/api/copilot/ask' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.query?.trim()) return json(res, 400, { success: false, error: 'query is required' });
      const result = copilotEngine.generateResponse(body.query.trim());
      return ok(res, { ...result, timestamp: new Date().toISOString() });
    }

    if (pathname === '/api/copilot/intents') {
      return ok(res, { suggestions: [
        'What are the top supply chain risks this week?',
        'Find alternate semiconductor suppliers',
        'Explain cobalt supply risk',
        'Line B Cpk analysis',
        'Energy cost reduction Plant-1',
        'Extract meeting action items',
        'Material substitution options',
        'Inventory days of supply'
      ]});
    }

    // ── 404 ─────────────────────────────────────────────────────────────────
    notFound(res);

  } catch (e) {
    err(res, e.message);
  }
});

server.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ⛓️  AutoChain AI  —  ET AutoTech Hackathon 2026');
  console.log(`  🚀  Server: http://localhost:${PORT}`);
  console.log('  📋  No external dependencies required');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = server;
