/**
 * src/models/copilotEngine.js
 *
 * AutoChain AI — Natural Language Copilot Engine
 *
 * Parses user intent from free-text queries and returns
 * contextually relevant supply chain intelligence responses.
 *
 * In production: connect to LLM (GPT-4 / Claude) with RAG over
 * ERP data, supplier DB, and real-time signals.
 * Here we implement a deterministic intent-router for the demo.
 */

'use strict';

const { computeOverallRisk, generateAlerts, recommendAlternateSources } = require('./riskEngine');
const { getAllOEE, getAllCpk, getDefectStats, predictEnergy }           = require('./manufacturingModel');
const { getCommodityPrices, getHedgingSignals, getMaterialSubstitutions } = require('./commodityModel');
const { SUPPLIERS } = require('../data/supplierDatabase');

// ── Intent taxonomy ───────────────────────────────────────────────────────────
const INTENTS = [
  { name: 'risk_overview',        patterns: ['top risk', 'biggest risk', 'main risk', 'risk summary', 'risk overview', 'risk this week'] },
  { name: 'alternate_sourcing',   patterns: ['alternate', 'alternative', 'backup supplier', 'find supplier', 'replace supplier'] },
  { name: 'semiconductor_risk',   patterns: ['semiconductor', 'chip', 'tsmc', 'mcu', 'microcontroller'] },
  { name: 'cobalt_risk',          patterns: ['cobalt', 'drc', 'battery material', 'cathode'] },
  { name: 'cpk_analysis',         patterns: ['cpk', 'cp ', 'capability', 'process capability', 'sigma', 'tolerance'] },
  { name: 'line_b_issue',         patterns: ['line b', 'powertrain', 'assembly line'] },
  { name: 'oee_overview',         patterns: ['oee', 'efficiency', 'overall equipment', 'throughput'] },
  { name: 'energy',               patterns: ['energy', 'power consumption', 'electricity', 'kwh', 'energy cost'] },
  { name: 'defect_detection',     patterns: ['defect', 'quality', 'vision', 'cv model', 'inspection'] },
  { name: 'commodity_prices',     patterns: ['commodity', 'price', 'lithium', 'copper', 'steel', 'nickel'] },
  { name: 'hedging',              patterns: ['hedge', 'forward contract', 'price risk', 'commodity hedge'] },
  { name: 'substitution',         patterns: ['substitute', 'substitution', 'alternate material', 'replace material', 'lfp', 'material change'] },
  { name: 'meeting_actions',      patterns: ['meeting', 'action item', 'minutes', 'follow up', 'task'] },
  { name: 'inventory',            patterns: ['inventory', 'stock', 'days of supply', 'reorder', 'safety stock'] },
  { name: 'logistics',            patterns: ['logistics', 'shipping', 'port', 'freight', 'congestion', 'delivery'] },
  { name: 'geopolitical',         patterns: ['geopolitical', 'tariff', 'sanction', 'trade war', 'export ban'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// parseIntent(text) → intent name
// ─────────────────────────────────────────────────────────────────────────────
function parseIntent (text) {
  const lower = text.toLowerCase();
  for (const intent of INTENTS) {
    if (intent.patterns.some(p => lower.includes(p))) {
      return intent.name;
    }
  }
  return 'general';
}

// ─────────────────────────────────────────────────────────────────────────────
// generateResponse(userQuery) → { intent, response, data }
// ─────────────────────────────────────────────────────────────────────────────
function generateResponse (userQuery) {
  const intent   = parseIntent(userQuery);
  const handler  = HANDLERS[intent] || HANDLERS.general;
  const result   = handler(userQuery);
  return { intent, ...result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent Handlers
// ─────────────────────────────────────────────────────────────────────────────
const HANDLERS = {

  risk_overview: () => {
    const alerts        = generateAlerts(SUPPLIERS);
    const overallScore  = computeOverallRisk(SUPPLIERS);
    const critical      = alerts.filter(a => a.level === 'Critical');
    const high          = alerts.filter(a => a.level === 'High');

    const topThree = alerts.slice(0, 3);
    const bullets  = topThree.map((a, i) =>
      `${['🔴','🟠','🟡'][i]} ${i+1}. ${a.supplier} (${a.country}) — ${a.message}. Action: ${a.action}`
    ).join('\n');

    return {
      response: `**Supply Chain Risk Briefing — ${today()}**\n\nOverall Risk Score: **${overallScore}/100** (${scoreLabel(overallScore)})\nCritical: ${critical.length} | High: ${high.length} | Total Active: ${alerts.length}\n\n**Top 3 Risks:**\n${bullets}\n\n💡 Recommendation: Prioritise alternate sourcing for semiconductor supply. Est. cost of disruption if unaddressed: ₹3.2 Cr/incident.`,
      data: { overallScore, alertCount: alerts.length, critical: critical.length, topThree }
    };
  },

  alternate_sourcing: (q) => {
    // Detect category from query
    const cat = q.toLowerCase().includes('batter') ? 'Battery'
              : q.toLowerCase().includes('steel')  ? 'Steel'
              : q.toLowerCase().includes('wiring')  ? 'Wiring Harness'
              : 'Semiconductor';  // default

    const alts = recommendAlternateSources(cat, null, SUPPLIERS);
    const bullets = alts.map((s, i) =>
      `${i+1}. **${s.name}** (${s.country}) — Risk: ${s.riskLevel} | Lead: ${s.leadTimeDays}d | Cost: ${s.costDelta} | ${s.reason}`
    ).join('\n');

    return {
      response: `**Alternate ${cat} Suppliers — AI Recommendations**\n\n${bullets}\n\n💡 Tip: Split order between options 1 & 2 for maximum supply security. Review certifications before PO issuance.`,
      data: alts
    };
  },

  semiconductor_risk: () => {
    const alts = recommendAlternateSources('Semiconductor', 'SUP001', SUPPLIERS);
    return {
      response: `**Semiconductor Supply Risk Analysis**\n\n⚠️ TSMC (Taiwan) risk score: 61/100 — CRITICAL\nKey risk drivers: Taiwan-China geopolitical tension, Q3 allocation cut of 22%, single-source dependency.\n\nEstimated production impact if disrupted: **12,000 units/month** (₹3.2 Cr value)\n\n**AI-Recommended Alternates:**\n${alts.map((a,i)=>`${i+1}. ${a.name} (${a.country}) — Lead time: ${a.leadTimeDays} days, Cost delta: ${a.costDelta}`).join('\n')}\n\n✅ Recommended Action: Dual-source between STMicro (Italy) and Infineon (Germany). Target: 60/40 split within 6 weeks.`,
      data: alts
    };
  },

  cobalt_risk: () => {
    const prices = getCommodityPrices();
    const cobalt = prices.find(p => p.id === 'cobalt');
    const subs   = getMaterialSubstitutions('cobalt');
    return {
      response: `**Cobalt Supply Risk Briefing**\n\nCurrent price: $${cobalt.currentPrice.toLocaleString()}/t (↑${cobalt.weeklyChange}% this week)\nSupply concentration: DRC = 73% of global supply\nDRC export levy: +15% effective this month\nBattery cost impact: **~$180/unit** for standard EV pack\n\n**Material Substitution Options:**\n${subs.map(s=>`• ${s.substitute} — Cost: ${s.costDeltaPct}% | Feasibility: ${s.feasibility} | AI confidence: ${s.aiConfidence}%`).join('\n')}\n\n✅ Recommended Action:\n1. Transition standard-range models to LFP chemistry (saves 22% cost, eliminates cobalt dependency)\n2. Hedge 90-day cobalt requirement via forward contract at current price\n3. Qualify Glencore (Australia) as secondary source`,
      data: { price: cobalt, substitutions: subs }
    };
  },

  cpk_analysis: () => {
    const cpks    = getAllCpk();
    const problem = cpks.filter(c => c.cpk < 1.33);
    const good    = cpks.filter(c => c.cpk >= 1.33);
    return {
      response: `**Process Capability Report (Cp / Cpk) — ${today()}**\n\n${cpks.map(c => `${c.lineName}: Cp=${c.cp}, Cpk=${c.cpk} [${c.status}]`).join('\n')}\n\n**Lines requiring attention (Cpk < 1.33):**\n${problem.length ? problem.map(c=>`⚠️ ${c.lineName}: ${c.recommendation}`).join('\n') : 'None — all lines capable.'}\n\n**Best performing:** ${good.sort((a,b)=>b.cpk-a.cpk)[0]?.lineName} (Cpk ${good[0]?.cpk}) — benchmark for others.`,
      data: cpks
    };
  },

  line_b_issue: () => {
    const cpk = getAllCpk().find(c => c.lineId === 'LINE-B');
    const oee = getAllOEE().find(o => o.lineId === 'LINE-B');
    return {
      response: `**Line B — Powertrain Assembly — Detailed Analysis**\n\nOEE: ${oee.oee}% (${oee.status}) | Units today: ${oee.unitsProduced}/${oee.targetUnits} target\nAvailability: ${oee.availability}% | Performance: ${oee.performance}% | Quality: ${oee.quality}%\n\nCpk: **${cpk.cpk}** (${cpk.status}) — Below 1.33 threshold ⚠️\nProcess Mean: ${cpk.processMean} Nm | Sigma: ${cpk.processSigma} Nm\nSpec: USL=${cpk.spec.usl}, LSL=${cpk.spec.lsl}\n\n**Root Cause:** Fixture Q123 calibration drift. Torque variance exceeds spec by ${((cpk.processSigma/2)*100).toFixed(0)}%.\n\n**Recommended Actions:**\n1. Schedule fixture recalibration in next 2-hour maintenance window\n2. Increase SPC sampling from 1/hr → 1/15 min until Cpk stabilises above 1.33\n3. Estimated scrap cost if unresolved: ${oee.scrapCount} units × ₹85,000 = ₹${(oee.scrapCount*85000).toLocaleString('en-IN')}/shift`,
      data: { cpk, oee }
    };
  },

  oee_overview: () => {
    const oees    = getAllOEE();
    const overall = (oees.reduce((s,o)=>s+o.oee,0)/oees.length).toFixed(1);
    return {
      response: `**OEE Dashboard — ${today()}**\n\nOverall Plant OEE: **${overall}%** (World class = 85%)\n\n${oees.map(o=>`${o.lineName}: **${o.oee}%** [${o.status}] — ${o.unitsProduced}/${o.targetUnits} units`).join('\n')}\n\n**Lowest performer:** ${oees.sort((a,b)=>a.oee-b.oee)[0].lineName} — ${oees[0].recommendation}\n\n💡 AI Insight: Fixing Line D bottleneck alone could add ~82 units/shift worth ₹69 lakh additional throughput.`,
      data: oees
    };
  },

  energy: () => {
    const forecast = predictEnergy({ plant: 'Plant-1', unitsPlanned: 480, ambientTempC: 32, shiftNumber: 2 });
    return {
      response: `**Energy Consumption Analysis — Plant-1**\n\nToday (actual): **2,840 kWh** | Per unit: ${forecast.perUnitKwh} kWh\nTarget: 140 kWh/unit | Gap: ${(forecast.perUnitKwh - 140).toFixed(1)} kWh/unit\nPeak demand window: ${forecast.peakLoadWindow}\n\n**AI Prediction (tomorrow):** ${forecast.predictedKwh} kWh\nSaving potential by load-shifting: **${forecast.savingPotentialKwh} kWh = ₹${forecast.savingRupees.toLocaleString('en-IN')}/day**\n\n✅ ${forecast.recommendation}`,
      data: forecast
    };
  },

  defect_detection: () => {
    const stats = getDefectStats();
    return {
      response: `**CV Defect Detection Report — ${stats.date}**\n\nUnits inspected: ${stats.totalInspected.toLocaleString()}\nDefects detected: ${stats.totalDefects} | Rejected: ${stats.totalRejected}\nFalse positives: ${stats.falsePositives} | Accuracy: **${stats.detectionAccuracy}%**\nThroughput: ${stats.throughputPerMin} units/min\n\n**Defect Breakdown:**\n${stats.defectBreakdown.map(d=>`• ${d.type} (${d.severity}): ${d.count} detected, ${d.rejectedCount} rejected [${d.model}]`).join('\n')}\n\n💡 Highest occurrence: ${stats.defectBreakdown.sort((a,b)=>b.count-a.count)[0].type}. Recommend checking upstream fixture condition.`,
      data: stats
    };
  },

  commodity_prices: () => {
    const prices = getCommodityPrices();
    const risky  = prices.filter(p => p.riskLevel === 'High' || p.riskLevel === 'Critical');
    return {
      response: `**Commodity Price Intelligence — ${today()}**\n\n${prices.map(p=>`${p.symbol}: **${p.currentPrice.toLocaleString()} ${p.unit}** (${p.weeklyChange > 0 ? '↑+' : '↓'}${p.weeklyChange}% WoW) [${p.riskLevel}]`).join('\n')}\n\n**High-risk commodities requiring attention:**\n${risky.map(p=>`⚠️ ${p.name}: ${p.priceDrivers.join(', ')}`).join('\n')}`,
      data: prices
    };
  },

  hedging: () => {
    const signals = getHedgingSignals();
    return {
      response: `**Commodity Hedging Signals**\n\n${signals.map(s=>`• **${s.commodity}**: ${s.recommendation}\n  Current: ${s.currentPrice.toLocaleString()} ${s.unit} | 30d estimate: ${s.expected30d.toLocaleString()} (+${s.upsideRisk}%)`).join('\n\n')}\n\n⚠️ Consult treasury team before executing forward contracts. Volumes depend on 90-day BOM requirements.`,
      data: signals
    };
  },

  substitution: () => {
    const subs = getMaterialSubstitutions();
    return {
      response: `**Material Substitution Recommendations**\n\n${subs.map((s,i)=>`${i+1}. **${s.current}** → ${s.substitute}\n   Cost: ${s.costDeltaPct > 0 ? '+' : ''}${s.costDeltaPct}% | Risk: ${s.riskDeltaLevel} | Feasibility: ${s.feasibility} | Confidence: ${s.aiConfidence}%\n   Note: ${s.caveat}`).join('\n\n')}`,
      data: subs
    };
  },

  meeting_actions: () => ({
    response: `**AI-Extracted Action Items — Supply Chain Review (${today()})**\n\nExtracted from meeting transcript using NLP:\n\n✅ [Procurement] Activate STMicroelectronics as alternate semiconductor supplier — Deadline: 3 days\n✅ [Materials] Evaluate LFP battery quote from CATL India + Tata Chemicals — Deadline: 7 days\n✅ [Logistics] Reroute 18 Shanghai shipments via BRI rail — Confirm by EOD today\n✅ [Plant Head] Schedule Line B fixture recalibration in tonight's maintenance window\n✅ [Finance] Execute cobalt forward contract hedge for 90 days at $34,100/t\n✅ [Quality] Deploy additional CV camera on Body Welding Line A exit\n\n📅 Next review: ${nextWeek()} | Attendees: Procurement, Plant, Quality, Finance`,
    data: {}
  }),

  inventory: () => ({
    response: `**Inventory & Days-of-Supply Dashboard**\n\n⚠️ CRITICAL (< 7 days):\n🔴 NXP S32K MCU: 6 days | Reorder Qty: 15,000 units | Lead: 14 days\n\n⚠️ LOW (< 21 days):\n🟠 Battery Cells (NMC): 18 days | Reorder Qty: 8,000 cells\n🟠 Copper Wiring: 21 days | Reorder Qty: 4 tonnes\n\n✅ ADEQUATE:\n🟢 Steel Sheet: 42 days | 🟢 Aluminium: 38 days | 🟢 Wiring Harness: 31 days\n\n💡 AI Recommendation: Immediate PO for S32K MCU. Activate emergency airfreight from NXP Rotterdam. Est. cost: ₹2.4L freight premium vs ₹3.2 Cr production loss.`,
    data: {}
  }),

  logistics: () => ({
    response: `**Logistics & Freight Intelligence**\n\n🔴 Shanghai Port: +8 days delay | 47 shipments affected | Cause: Terminal congestion + labour dispute\n🟠 Suez Canal: Normal | 🟢 Rotterdam: Normal | 🟢 Nhava Sheva (Mumbai): +1 day\n\n**Recommended Rerouting:**\n1. 18 critical-path consignments → BRI Rail (China-Europe): saves 3 days, −12% cost\n2. 6 urgent ECU shipments → Air freight (FedEx/DHL): +8 days faster, +22% cost\n3. 23 non-critical → Wait for port clearance (ETA: 8 days)\n\n💡 Overall freight rate index up 18% YoY. Lock freight contracts for Q3 now.`,
    data: {}
  }),

  geopolitical: () => ({
    response: `**Geopolitical Risk Monitor**\n\n🔴 Taiwan Strait (Score: 82/100): US-China tensions elevated. TSMC capacity under allocation pressure. Activate EU semiconductor alternates.\n🔴 DRC (Score: 88/100): New export levy on cobalt/copper. Seek Australian & US sources.\n🟠 China (Score: 68/100): Rare earth export quota tightening. NEV policy changes.\n🟠 Russia (Score: 90/100): Palladium supply disruption. Already hedged via SA sources.\n🟢 India (Score: 18/100): Stable. PLI scheme benefiting domestic Tier-1 ecosystem.\n\n**Concentration Risk:** 38% of spend in Asia-Pacific. Target: reduce to <25% within 18 months via India/Europe diversification.`,
    data: {}
  }),

  general: (q) => ({
    response: `**AutoChain AI — Supply Chain Intelligence**\n\nI'm analysing your query: "${q}"\n\nCurrent supply chain overview:\n• Overall Risk Score: ${computeOverallRisk(SUPPLIERS)}/100 (Elevated)\n• Active Alerts: ${generateAlerts(SUPPLIERS).length} | Critical: ${generateAlerts(SUPPLIERS).filter(a=>a.level==='Critical').length}\n• Suppliers monitored: ${SUPPLIERS.length} across ${new Set(SUPPLIERS.map(s=>s.country)).size} countries\n\nYou can ask me about:\n• Risk overview ("What are the top risks?")\n• Alternate sourcing ("Find alternate semiconductor suppliers")\n• Manufacturing ("Line B Cpk issue", "OEE summary", "Energy reduction")\n• Commodities ("Cobalt price risk", "Material substitutions")\n• Logistics ("Port delays", "Rerouting options")\n• Meeting actions ("Extract action items")`,
    data: {}
  })
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreLabel (s) {
  return s >= 75 ? 'Critical' : s >= 55 ? 'Elevated' : s >= 35 ? 'Moderate' : 'Low';
}
function today () { return new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }
function nextWeek () {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

module.exports = { generateResponse, parseIntent };
