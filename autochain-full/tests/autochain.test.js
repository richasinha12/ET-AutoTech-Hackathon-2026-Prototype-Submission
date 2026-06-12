/**
 * tests/autochain.test.js
 *
 * AutoChain AI — Unit & Integration Tests
 * Run: node tests/autochain.test.js
 *
 * No external test framework needed — pure Node.js assertions.
 */

'use strict';

const assert = require('assert');

// ── Modules under test ────────────────────────────────────────────────────────
const {
  computeSupplierRisk, computeOverallRisk, generateAlerts,
  forecastDisruptions, recommendAlternateSources, scoreToLevel
} = require('../src/models/riskEngine');

const {
  computeOEE, computeCpk, predictEnergy, getDefectStats, forecastProduction
} = require('../src/models/manufacturingModel');

const {
  getCommodityPrices, forecastCommodityPrice,
  getMaterialSubstitutions, getHedgingSignals
} = require('../src/models/commodityModel');

const {
  getInventoryDashboard, forecastDemand, PARTS
} = require('../src/models/inventoryModel');

const { generateResponse, parseIntent } = require('../src/models/copilotEngine');

const { SUPPLIERS } = require('../src/data/supplierDatabase');

const {
  round, clamp, weightedMovingAverage, linearTrend, expSmooth
} = require('../src/utils/helpers');

// ── Simple test runner ────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  AutoChain AI — Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ── 1. UTILITY HELPERS ────────────────────────────────────────────────────────
console.log('📐 Utils');

test('round() — 2 decimal places', () => {
  assert.strictEqual(round(3.14159), 3.14);
  assert.strictEqual(round(2.005, 2), 2.01);
});

test('clamp() — within bounds', () => {
  assert.strictEqual(clamp(50, 0, 100), 50);
  assert.strictEqual(clamp(-5, 0, 100), 0);
  assert.strictEqual(clamp(150, 0, 100), 100);
});

test('weightedMovingAverage() — recent values weighted higher', () => {
  const vals = [10, 20, 30];
  const wma  = weightedMovingAverage(vals);
  // weights 1,2,3 → (10*1 + 20*2 + 30*3) / 6 = 140/6 ≈ 23.33
  assert.ok(wma > 20, `Expected wma > 20, got ${wma}`);
});

test('linearTrend() — positive slope for rising series', () => {
  const slope = linearTrend([10, 20, 30, 40, 50]);
  assert.ok(slope > 0, `Expected positive slope, got ${slope}`);
});

test('expSmooth() — returns value in range', () => {
  const s = expSmooth([60, 65, 70, 75], 0.3);
  assert.ok(s >= 60 && s <= 80, `Unexpected smoothed value: ${s}`);
});

// ── 2. RISK ENGINE ────────────────────────────────────────────────────────────
console.log('\n🎯 Risk Engine');

test('scoreToLevel() — correct thresholds', () => {
  assert.strictEqual(scoreToLevel(80), 'Critical');
  assert.strictEqual(scoreToLevel(60), 'High');
  assert.strictEqual(scoreToLevel(40), 'Medium');
  assert.strictEqual(scoreToLevel(20), 'Low');
});

test('computeSupplierRisk() — returns valid structure for TSMC', () => {
  const tsmc = SUPPLIERS.find(s => s.id === 'SUP001');
  const risk = computeSupplierRisk(tsmc);
  assert.ok(risk.score >= 0 && risk.score <= 100, `Score out of range: ${risk.score}`);
  assert.ok(['Critical','High','Medium','Low'].includes(risk.level));
  assert.ok(risk.breakdown.geopolitical >= 0);
  assert.ok(typeof risk.recommendation === 'string');
});

test('computeSupplierRisk() — low-risk supplier has lower score than TSMC', () => {
  const tsmc  = SUPPLIERS.find(s => s.id === 'SUP001');
  const bosch = SUPPLIERS.find(s => s.id === 'SUP051');
  assert.ok(
    computeSupplierRisk(tsmc).score > computeSupplierRisk(bosch).score,
    'TSMC should have higher risk than Bosch India'
  );
});

test('computeOverallRisk() — portfolio score 0–100', () => {
  const score = computeOverallRisk(SUPPLIERS);
  assert.ok(score >= 0 && score <= 100, `Score out of range: ${score}`);
});

test('generateAlerts() — returns alerts for suppliers with score >= 50', () => {
  const alerts = generateAlerts(SUPPLIERS);
  alerts.forEach(a => {
    assert.ok(a.riskScore >= 50, `Alert for score ${a.riskScore} should not be generated`);
  });
});

test('forecastDisruptions() — returns correct horizon length', () => {
  const f = forecastDisruptions(null, 14);
  assert.strictEqual(f.length, 14);
  f.forEach(p => {
    assert.ok(p.semiconductor >= 0 && p.semiconductor <= 100);
    assert.ok(typeof p.date === 'string');
  });
});

test('recommendAlternateSources() — top 3 max, excludes current supplier', () => {
  const alts = recommendAlternateSources('Semiconductor', 'SUP001', SUPPLIERS);
  assert.ok(alts.length <= 3);
  assert.ok(alts.every(a => a.id !== 'SUP001'), 'Current supplier should be excluded');
});

// ── 3. MANUFACTURING MODEL ────────────────────────────────────────────────────
console.log('\n🏭 Manufacturing Model');

test('computeOEE() — OEE between 0 and 100 for LINE-A', () => {
  const r = computeOEE('LINE-A');
  assert.ok(r !== null);
  assert.ok(r.oee >= 0 && r.oee <= 100, `OEE out of range: ${r.oee}`);
  assert.ok(['Good','Marginal','Poor'].includes(r.status));
});

test('computeOEE() — OEE = availability × performance × quality', () => {
  const r = computeOEE('LINE-A');
  // OEE stored as percentage; verify it matches A*P*Q / 10000
  const expected = round((r.availability / 100) * (r.performance / 100) * (r.quality / 100) * 100, 1);
  assert.ok(Math.abs(r.oee - expected) < 1, `OEE formula mismatch: ${r.oee} vs ${expected}`);
});

test('computeCpk() — Cpk for LINE-B is below capable threshold (< 1.33)', () => {
  const r = computeCpk('LINE-B');
  assert.ok(r !== null);
  assert.ok(r.cpk < 1.33, `Expected LINE-B Cpk < 1.33, got ${r.cpk}`);
  assert.ok(['Marginal','Incapable'].includes(r.status), `Unexpected status: ${r.status}`);
});

test('computeCpk() — Cp ≥ Cpk always', () => {
  ['LINE-A','LINE-B','LINE-C','LINE-D'].forEach(id => {
    const r = computeCpk(id);
    assert.ok(r.cp >= r.cpk, `Cp (${r.cp}) should be ≥ Cpk (${r.cpk}) for ${id}`);
  });
});

test('predictEnergy() — returns positive values', () => {
  const r = predictEnergy({ plant: 'Plant-1', unitsPlanned: 480, ambientTempC: 32, shiftNumber: 2 });
  assert.ok(r !== null);
  assert.ok(r.predictedKwh > 0);
  assert.ok(r.savingPotentialKwh > 0);
});

test('getDefectStats() — accuracy between 95 and 100', () => {
  const r = getDefectStats();
  assert.ok(r.detectionAccuracy >= 95 && r.detectionAccuracy <= 100,
    `Accuracy out of range: ${r.detectionAccuracy}`);
  assert.ok(r.totalInspected > 0);
  assert.ok(Array.isArray(r.defectBreakdown));
});

test('forecastProduction() — returns correct horizon length', () => {
  const f = forecastProduction([480,485,490,478,488,492,486], 7);
  assert.strictEqual(f.length, 7);
  f.forEach(p => assert.ok(p.forecast > 0));
});

// ── 4. COMMODITY MODEL ────────────────────────────────────────────────────────
console.log('\n📊 Commodity Model');

test('getCommodityPrices() — returns array with required fields', () => {
  const prices = getCommodityPrices();
  assert.ok(prices.length > 0);
  prices.forEach(p => {
    assert.ok(p.id);
    assert.ok(p.currentPrice > 0);
    assert.ok(typeof p.weeklyChange === 'number');
  });
});

test('forecastCommodityPrice() — forecast length matches horizon', () => {
  const f = forecastCommodityPrice('lithium', 30);
  assert.ok(f !== null);
  assert.strictEqual(f.forecast.length, 30);
  f.forecast.forEach(p => assert.ok(p.price >= 0));
});

test('forecastCommodityPrice() — returns null for unknown commodity', () => {
  const f = forecastCommodityPrice('unobtainium', 30);
  assert.strictEqual(f, null);
});

test('getMaterialSubstitutions() — all entries have required fields', () => {
  const subs = getMaterialSubstitutions();
  assert.ok(subs.length > 0);
  subs.forEach(s => {
    assert.ok(s.current);
    assert.ok(s.substitute);
    assert.ok(typeof s.costDeltaPct === 'number');
    assert.ok(['High','Medium','Low'].includes(s.feasibility));
  });
});

test('getHedgingSignals() — only high-risk commodities included', () => {
  const signals = getHedgingSignals();
  assert.ok(signals.length > 0);
  signals.forEach(s => assert.ok(s.upsideRisk !== undefined));
});

// ── 5. INVENTORY MODEL ────────────────────────────────────────────────────────
console.log('\n📦 Inventory Model');

test('getInventoryDashboard() — critical parts identified', () => {
  const dash = getInventoryDashboard();
  assert.ok(dash.totalParts > 0);
  assert.ok(dash.criticalCount >= 0);
  assert.ok(Array.isArray(dash.parts));
});

test('forecastDemand() — 14-day forecast with correct structure', () => {
  const f = forecastDemand(PARTS[0], 14);
  assert.strictEqual(f.length, 14);
  f.forEach(p => {
    assert.ok(p.forecast >= 0);
    assert.ok(p.lower <= p.forecast);
    assert.ok(p.upper >= p.forecast);
  });
});

test('Reorder urgency sorted CRITICAL → HIGH → MEDIUM → OK', () => {
  const { getReorderRecommendations } = require('../src/models/inventoryModel');
  const recs   = getReorderRecommendations();
  const order  = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, OK: 3 };
  for (let i = 1; i < recs.length; i++) {
    assert.ok(
      order[recs[i].urgency] >= order[recs[i - 1].urgency],
      `Urgency out of order at index ${i}: ${recs[i - 1].urgency} → ${recs[i].urgency}`
    );
  }
});

// ── 6. AI COPILOT ─────────────────────────────────────────────────────────────
console.log('\n🤖 AI Copilot');

test('parseIntent() — detects risk_overview', () => {
  assert.strictEqual(parseIntent('What are the top risks this week?'), 'risk_overview');
});

test('parseIntent() — detects semiconductor_risk', () => {
  assert.strictEqual(parseIntent('TSMC chip shortage impact'), 'semiconductor_risk');
});

test('parseIntent() — detects line_b_issue', () => {
  assert.strictEqual(parseIntent('what is wrong with line b assembly'), 'line_b_issue');
});

test('parseIntent() — detects energy intent', () => {
  assert.strictEqual(parseIntent('How to reduce energy costs?'), 'energy');
});

test('generateResponse() — returns response string and intent', () => {
  const r = generateResponse('What are the top supply risks?');
  assert.ok(typeof r.response === 'string' && r.response.length > 50);
  assert.ok(typeof r.intent === 'string');
});

test('generateResponse() — cobalt briefing contains price data', () => {
  const r = generateResponse('Explain cobalt supply risk');
  assert.ok(r.response.includes('34'), 'Expected cobalt price in response');
});

test('generateResponse() — meeting actions contain action items', () => {
  const r = generateResponse('Extract meeting action items');
  assert.ok(r.response.includes('✅'), 'Expected action items (✅) in response');
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Results: ${passed} passed  |  ${failed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) process.exit(1);
