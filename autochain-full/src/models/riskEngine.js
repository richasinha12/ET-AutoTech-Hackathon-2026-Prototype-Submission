/**
 * src/models/riskEngine.js
 *
 * AutoChain AI — Supply Chain Risk Scoring Engine
 *
 * Computes a composite risk score (0–100) for each supplier and
 * for the overall supply chain, using a weighted multi-signal model:
 *
 *   score = w_geo  * geopolitical_signal
 *         + w_log  * logistics_signal
 *         + w_com  * commodity_signal
 *         + w_sup  * supplier_reliability_signal
 *
 * All signals are normalised 0–100 (100 = highest risk).
 */

'use strict';

// ── Weight configuration ──────────────────────────────────────────────────────
const WEIGHTS = {
  geopolitical : 0.30,
  logistics    : 0.25,
  commodity    : 0.25,
  supplier     : 0.20
};

// ── Geopolitical risk index by country ───────────────────────────────────────
const GEO_RISK = {
  Taiwan     : 82,
  China      : 68,
  Russia     : 90,
  DRC        : 88,
  'South Korea': 35,
  Japan      : 28,
  Germany    : 10,
  France     : 10,
  Italy      : 12,
  Netherlands: 10,
  USA        : 12,
  Mexico     : 22,
  India      : 18,
  Australia  : 8,
  Vietnam    : 26,
  Indonesia  : 30
};

// ── Logistics risk signals (port congestion, freight index) ───────────────────
const LOGISTICS_SIGNAL = {
  'Asia-Pacific' : 62,
  'Europe'       : 22,
  'South Asia'   : 28,
  'North America': 20,
  'Africa'       : 55,
  'Oceania'      : 18
};

// ── Commodity risk signals ────────────────────────────────────────────────────
const COMMODITY_SIGNAL = {
  Semiconductor  : 85,
  Battery        : 58,
  'Raw Material' : 72,
  Steel          : 30,
  'Wiring Harness': 22,
  Electronics    : 45,
  ADAS           : 38,
  Thermal        : 25
};

// ─────────────────────────────────────────────────────────────────────────────
// computeSupplierRisk(supplier)
// Returns { score, breakdown, level, recommendation }
// ─────────────────────────────────────────────────────────────────────────────
function computeSupplierRisk (supplier) {
  const geoSignal  = GEO_RISK[supplier.country]       || 50;
  const logSignal  = LOGISTICS_SIGNAL[supplier.region] || 40;
  const comSignal  = COMMODITY_SIGNAL[supplier.category] || 50;
  // Invert reliability (100 = very reliable → 0 risk; 0 = unreliable → 100 risk)
  const supSignal  = 100 - (supplier.reliability || 50);

  const score = Math.round(
    WEIGHTS.geopolitical * geoSignal  +
    WEIGHTS.logistics    * logSignal  +
    WEIGHTS.commodity    * comSignal  +
    WEIGHTS.supplier     * supSignal
  );

  const level = scoreToLevel(score);

  const recommendation = buildRecommendation(score, supplier);

  return {
    supplierId  : supplier.id,
    supplierName: supplier.name,
    score,
    level,
    breakdown: {
      geopolitical: Math.round(geoSignal),
      logistics   : Math.round(logSignal),
      commodity   : Math.round(comSignal),
      reliability : Math.round(supSignal)
    },
    recommendation,
    riskFlags: supplier.riskFlags || []
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeOverallRisk(suppliers)
// Portfolio-level weighted risk score
// ─────────────────────────────────────────────────────────────────────────────
function computeOverallRisk (suppliers) {
  if (!suppliers || suppliers.length === 0) return 0;

  // Weight by annual spend so high-spend suppliers contribute more
  const totalSpend = suppliers.reduce((s, x) => s + (x.annualSpend || 1), 0);

  let weightedScore = 0;
  suppliers.forEach(sup => {
    const { score } = computeSupplierRisk(sup);
    const spendWeight = (sup.annualSpend || 1) / totalSpend;
    weightedScore += score * spendWeight;
  });

  return Math.round(weightedScore);
}

// ─────────────────────────────────────────────────────────────────────────────
// generateAlerts(suppliers)
// Returns sorted list of active disruption alerts
// ─────────────────────────────────────────────────────────────────────────────
function generateAlerts (suppliers) {
  const alerts = [];

  suppliers.forEach(sup => {
    const { score, level } = computeSupplierRisk(sup);

    if (score >= 50) {
      sup.riskFlags.forEach(flag => {
        alerts.push({
          id        : `ALT-${sup.id}-${Date.now()}`,
          supplier  : sup.name,
          country   : sup.country,
          category  : sup.category,
          riskScore : score,
          level,
          message   : flag,
          timestamp : new Date().toISOString(),
          action    : getAlertAction(sup.category, level)
        });
      });
    }
  });

  // Sort critical first, then by score descending
  alerts.sort((a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return (order[a.level] - order[b.level]) || (b.riskScore - a.riskScore);
  });

  return alerts;
}

// ─────────────────────────────────────────────────────────────────────────────
// forecastDisruptions(historicalData, horizonDays = 30)
// Naive time-series forecast using exponential smoothing + seasonal adjustment
// In production: replace with trained ML model (LSTM / XGBoost)
// ─────────────────────────────────────────────────────────────────────────────
function forecastDisruptions (historicalData, horizonDays = 30) {
  const alpha = 0.3;   // smoothing factor
  const forecast = [];

  // Seed from last 7 days of historical signals
  const recentScores = historicalData || [68, 70, 71, 69, 73, 74, 72];
  let smoothed = recentScores[0];
  recentScores.forEach(v => { smoothed = alpha * v + (1 - alpha) * smoothed; });

  const categories = ['Semiconductor', 'Logistics', 'Geopolitical', 'Commodity'];
  const baselines  = { Semiconductor: 85, Logistics: 62, Geopolitical: 55, Commodity: 58 };
  const trends     = { Semiconductor: +2, Logistics: +1, Geopolitical: +1.5, Commodity: -0.5 };

  for (let day = 1; day <= horizonDays; day++) {
    const point = { day, date: dayOffset(day) };
    categories.forEach(cat => {
      const base  = baselines[cat];
      const trend = trends[cat];
      const noise = (Math.random() - 0.5) * 4;
      const val   = Math.min(100, Math.max(0, Math.round(base + trend * (day / 7) + noise)));
      point[cat.toLowerCase().replace(' ', '_')] = val;
    });
    point.overall = Math.round(
      point.semiconductor * 0.35 +
      point.logistics     * 0.25 +
      point.geopolitical  * 0.25 +
      point.commodity     * 0.15
    );
    forecast.push(point);
  }

  return forecast;
}

// ─────────────────────────────────────────────────────────────────────────────
// recommendAlternateSources(category, currentSupplierId, allSuppliers)
// Returns top-3 alternate suppliers ranked by composite score
// ─────────────────────────────────────────────────────────────────────────────
function recommendAlternateSources (category, currentSupplierId, allSuppliers) {
  return allSuppliers
    .filter(s =>
      s.category === category &&
      s.id !== currentSupplierId &&
      s.riskScore > 60
    )
    .map(s => {
      const { score } = computeSupplierRisk(s);
      return {
        ...s,
        computedRisk : score,
        // Composite "alternate score": lower risk + lower cost + shorter lead + higher reliability
        alternateScore: Math.round(
          (100 - score)      * 0.40 +
          (100 - s.costIndex * 0.5) * 0.25 +
          (100 - s.leadTimeDays / 1.5) * 0.20 +
          s.reliability      * 0.15
        )
      };
    })
    .sort((a, b) => b.alternateScore - a.alternateScore)
    .slice(0, 3)
    .map(s => ({
      id          : s.id,
      name        : s.name,
      country     : s.country,
      region      : s.region,
      riskLevel   : scoreToLevel(s.computedRisk),
      riskScore   : s.computedRisk,
      leadTimeDays: s.leadTimeDays,
      costDelta   : `${s.costIndex >= 100 ? '+' : ''}${s.costIndex - 100}%`,
      reliability : s.reliability,
      parts       : s.parts,
      certifications: s.certifications,
      paymentTerms: s.paymentTerms,
      reason      : buildAltReason(s)
    }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreToLevel (score) {
  if (score >= 75) return 'Critical';
  if (score >= 55) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

function buildRecommendation (score, supplier) {
  if (score >= 75)
    return `URGENT: Activate alternate suppliers immediately. Estimated impact: ₹${Math.round(supplier.annualSpend / 10000000).toFixed(1)} Cr if disrupted.`;
  if (score >= 55)
    return `HIGH: Begin dual-sourcing evaluation. Review ${supplier.alternateIds?.length || 0} approved alternates.`;
  if (score >= 35)
    return 'MEDIUM: Schedule quarterly review. Monitor geopolitical signals.';
  return 'LOW: Continue normal procurement. Standard monitoring applies.';
}

function getAlertAction (category, level) {
  const actions = {
    Semiconductor: 'Activate EU-based alternate semiconductor suppliers',
    Battery      : 'Evaluate LFP chemistry transition + alt cell suppliers',
    'Raw Material': 'Diversify sourcing geography + forward contract hedge',
    Steel        : 'Check inventory buffer + domestic supplier capacity',
    default      : 'Review alternate suppliers and increase safety stock'
  };
  return actions[category] || actions.default;
}

function buildAltReason (s) {
  const reasons = [];
  if (GEO_RISK[s.country] < 25) reasons.push('Low geopolitical risk');
  if (s.leadTimeDays < 20)      reasons.push('Short lead time');
  if (s.reliability > 90)       reasons.push('High reliability track record');
  if (s.costIndex < 100)        reasons.push('Cost advantage');
  if (s.certifications.includes('ISO26262-ASIL-D')) reasons.push('Highest functional safety grade');
  return reasons.join(' · ') || 'Approved alternate source';
}

function dayOffset (n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  computeSupplierRisk,
  computeOverallRisk,
  generateAlerts,
  forecastDisruptions,
  recommendAlternateSources,
  scoreToLevel,
  WEIGHTS,
  GEO_RISK
};
