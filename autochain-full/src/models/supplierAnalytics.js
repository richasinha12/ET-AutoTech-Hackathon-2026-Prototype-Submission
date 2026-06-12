/**
 * src/models/supplierAnalytics.js
 *
 * AutoChain AI — Supplier Analytics Engine
 *
 * Generates:
 *  1. Composite supplier scorecard (quality, delivery, cost, risk, ESG)
 *  2. Supplier comparison table
 *  3. Payment terms analytics
 *  4. Spend concentration heatmap data
 */

'use strict';

const { SUPPLIERS } = require('../data/supplierDatabase');
const { computeSupplierRisk } = require('./riskEngine');
const { round } = require('../utils/helpers');

// ── Scorecard weights ────────────────────────────────────────────────────────
const SCORECARD_WEIGHTS = {
  quality       : 0.30,
  delivery      : 0.25,
  cost          : 0.20,
  riskMitigation: 0.15,
  esg           : 0.10
};

// ── Simulated scorecard data per supplier ────────────────────────────────────
// (In production: pull from ERP audit records + QMS + logistics tracker)
const SCORECARD_DATA = {
  SUP001: { quality: 78, delivery: 72, cost: 95, esg: 70 },  // TSMC
  SUP002: { quality: 94, delivery: 93, cost: 78, esg: 88 },  // STMicro
  SUP003: { quality: 95, delivery: 92, cost: 80, esg: 90 },  // Infineon
  SUP004: { quality: 93, delivery: 91, cost: 79, esg: 87 },  // NXP
  SUP010: { quality: 87, delivery: 82, cost: 98, esg: 65 },  // CATL
  SUP011: { quality: 80, delivery: 84, cost: 96, esg: 78 },  // Tata Chem
  SUP012: { quality: 90, delivery: 88, cost: 76, esg: 82 },  // Samsung SDI
  SUP020: { quality: 92, delivery: 93, cost: 97, esg: 85 },  // Tata Steel
  SUP021: { quality: 88, delivery: 85, cost: 92, esg: 80 },  // POSCO
  SUP030: { quality: 65, delivery: 68, cost: 99, esg: 40 },  // Glencore DRC
  SUP031: { quality: 83, delivery: 82, cost: 70, esg: 78 },  // Glencore AU
  SUP032: { quality: 80, delivery: 79, cost: 68, esg: 82 },  // MP Materials
  SUP040: { quality: 96, delivery: 97, cost: 98, esg: 88 },  // Aptiv
  SUP041: { quality: 91, delivery: 90, cost: 99, esg: 84 },  // Motherson
  SUP050: { quality: 93, delivery: 91, cost: 80, esg: 89 },  // Valeo
  SUP051: { quality: 97, delivery: 97, cost: 92, esg: 90 },  // Bosch India
  SUP060: { quality: 89, delivery: 81, cost: 78, esg: 85 },  // Denso
  SUP061: { quality: 88, delivery: 89, cost: 97, esg: 83 },  // Subros
};

// ─────────────────────────────────────────────────────────────────────────────
// 1.  computeScorecard(supplier)
// ─────────────────────────────────────────────────────────────────────────────
function computeScorecard(supplier) {
  const s    = SCORECARD_DATA[supplier.id] || { quality: 70, delivery: 70, cost: 70, esg: 70 };
  const risk = computeSupplierRisk(supplier);

  // riskMitigation score = inverse of computed risk score
  const riskMitigation = Math.max(0, 100 - risk.score);

  const overall = round(
    SCORECARD_WEIGHTS.quality        * s.quality        +
    SCORECARD_WEIGHTS.delivery       * s.delivery       +
    SCORECARD_WEIGHTS.cost           * s.cost           +
    SCORECARD_WEIGHTS.riskMitigation * riskMitigation   +
    SCORECARD_WEIGHTS.esg            * s.esg
  );

  const grade = overall >= 90 ? 'A+' : overall >= 80 ? 'A' :
                overall >= 70 ? 'B'  : overall >= 60 ? 'C' : 'D';

  return {
    supplierId      : supplier.id,
    supplierName    : supplier.name,
    country         : supplier.country,
    category        : supplier.category,
    scores: {
      quality,
      delivery      : s.delivery,
      cost          : s.cost,
      riskMitigation: round(riskMitigation),
      esg           : s.esg
    },
    overall,
    grade,
    trend           : overall >= 80 ? 'Improving' : overall >= 65 ? 'Stable' : 'Declining',
    tier            : supplier.tier,
    annualSpend     : supplier.annualSpend,
    paymentTerms    : supplier.paymentTerms,
    recommendation  : scorecardRec(overall, s, riskMitigation, supplier)
  };

  function quality() { return s.quality; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  getAllScorecards()
// ─────────────────────────────────────────────────────────────────────────────
function getAllScorecards() {
  return SUPPLIERS
    .map(s => computeScorecard(s))
    .sort((a, b) => b.overall - a.overall);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  getSpendConcentration()
//     Returns spend by country and category for heatmap
// ─────────────────────────────────────────────────────────────────────────────
function getSpendConcentration() {
  const byCountry  = {};
  const byCategory = {};
  let totalSpend   = 0;

  SUPPLIERS.forEach(s => {
    const spend = s.annualSpend || 0;
    totalSpend += spend;
    byCountry[s.country]   = (byCountry[s.country]   || 0) + spend;
    byCategory[s.category] = (byCategory[s.category] || 0) + spend;
  });

  const countries = Object.entries(byCountry).map(([country, spend]) => ({
    country,
    spend,
    sharePct   : round((spend / totalSpend) * 100),
    riskLevel  : getCountryRisk(country)
  })).sort((a, b) => b.spend - a.spend);

  const categories = Object.entries(byCategory).map(([category, spend]) => ({
    category,
    spend,
    sharePct: round((spend / totalSpend) * 100)
  })).sort((a, b) => b.spend - a.spend);

  const topCountryShare = countries[0]?.sharePct || 0;
  const concentrationRisk = topCountryShare > 40 ? 'High' :
                            topCountryShare > 25 ? 'Medium' : 'Low';

  return { totalSpend, countries, categories, concentrationRisk };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  getPaymentTermsAnalysis()
// ─────────────────────────────────────────────────────────────────────────────
function getPaymentTermsAnalysis() {
  const termGroups = {};
  SUPPLIERS.forEach(s => {
    const term = s.paymentTerms || 'Unknown';
    if (!termGroups[term]) termGroups[term] = { count: 0, totalSpend: 0, suppliers: [] };
    termGroups[term].count++;
    termGroups[term].totalSpend += s.annualSpend || 0;
    termGroups[term].suppliers.push(s.name);
  });

  return Object.entries(termGroups).map(([term, data]) => ({
    paymentTerms: term,
    supplierCount: data.count,
    totalSpend   : data.totalSpend,
    suppliers    : data.suppliers
  })).sort((a, b) => b.totalSpend - a.totalSpend);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCountryRisk(country) {
  const HIGH     = ['Taiwan', 'China', 'Russia', 'DRC'];
  const MEDIUM   = ['South Korea', 'Japan', 'Indonesia', 'Vietnam'];
  if (HIGH.includes(country))   return 'High';
  if (MEDIUM.includes(country)) return 'Medium';
  return 'Low';
}

function scorecardRec(overall, s, riskMitigation, supplier) {
  if (overall >= 90)
    return 'Strategic partner. Consider long-term contract and joint development.';
  if (overall >= 80)
    return 'Preferred supplier. Maintain dual-source for critical parts.';
  if (overall >= 65) {
    const weakest = Object.entries({ Quality: s.quality, Delivery: s.delivery, Cost: s.cost, Risk: riskMitigation })
      .sort(([, a], [, b]) => a - b)[0][0];
    return `Acceptable. Improvement plan needed on ${weakest}. Review in 90 days.`;
  }
  return `UNDERPERFORMING. Initiate corrective action plan. Qualify alternate for ${supplier.category}.`;
}

module.exports = {
  computeScorecard,
  getAllScorecards,
  getSpendConcentration,
  getPaymentTermsAnalysis
};
