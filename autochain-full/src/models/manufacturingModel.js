/**
 * src/models/manufacturingModel.js
 *
 * AutoChain AI — Smart Manufacturing Analytics Engine
 *
 * Covers:
 *   1. OEE (Overall Equipment Effectiveness) computation
 *   2. Statistical Process Control — Cp / Cpk
 *   3. Energy consumption prediction (regression model)
 *   4. Computer Vision defect classification (simulated pipeline)
 *   5. Production demand forecasting (simple moving average + trend)
 */

'use strict';

// ── Production Line master data ───────────────────────────────────────────────
const PRODUCTION_LINES = [
  {
    id: 'LINE-A', name: 'Body Welding', plant: 'Plant-1',
    targetUnitsPerHour: 60, shiftHours: 8,
    designCapacity: 500,   // units/shift
    nominalCycleTime: 60,  // seconds/unit
    spec: { usl: 2.5, lsl: -2.5, target: 0 }   // tolerance in mm
  },
  {
    id: 'LINE-B', name: 'Powertrain Assembly', plant: 'Plant-1',
    targetUnitsPerHour: 40, shiftHours: 8,
    designCapacity: 320,
    nominalCycleTime: 90,
    spec: { usl: 5.0, lsl: -5.0, target: 0 }   // torque Nm
  },
  {
    id: 'LINE-C', name: 'Paint Shop', plant: 'Plant-1',
    targetUnitsPerHour: 62, shiftHours: 8,
    designCapacity: 496,
    nominalCycleTime: 58,
    spec: { usl: 5.0, lsl: 3.0, target: 4.0 }  // paint thickness µm
  },
  {
    id: 'LINE-D', name: 'Final Assembly', plant: 'Plant-2',
    targetUnitsPerHour: 50, shiftHours: 8,
    designCapacity: 400,
    nominalCycleTime: 72,
    spec: { usl: 1.5, lsl: -1.5, target: 0 }   // alignment mm
  }
];

// ── Simulated sensor readings (in production: stream from IoT / SCADA) ────────
const CURRENT_READINGS = {
  'LINE-A': { availability: 0.95, performance: 0.96, quality: 0.995,
              mean: 0.12, stdDev: 0.58, unitsProduced: 487, scrapCount: 2 },
  'LINE-B': { availability: 0.88, performance: 0.84, quality: 0.990,
              mean: 0.45, stdDev: 1.72, unitsProduced: 312, scrapCount: 8 },
  'LINE-C': { availability: 0.93, performance: 0.96, quality: 0.998,
              mean: 4.05, stdDev: 0.26, unitsProduced: 495, scrapCount: 1 },
  'LINE-D': { availability: 0.82, performance: 0.82, quality: 0.985,
              mean: -0.08, stdDev: 0.31, unitsProduced: 201, scrapCount: 12 }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1.  OEE  =  Availability × Performance × Quality
// ─────────────────────────────────────────────────────────────────────────────
function computeOEE (lineId) {
  const line = PRODUCTION_LINES.find(l => l.id === lineId);
  const r    = CURRENT_READINGS[lineId];
  if (!line || !r) return null;

  const oee = r.availability * r.performance * r.quality;

  return {
    lineId,
    lineName    : line.name,
    oee         : round2(oee * 100),
    availability: round2(r.availability * 100),
    performance : round2(r.performance  * 100),
    quality     : round2(r.quality      * 100),
    unitsProduced: r.unitsProduced,
    targetUnits : line.designCapacity,
    scrapCount  : r.scrapCount,
    status      : oee >= 0.85 ? 'Good' : oee >= 0.70 ? 'Marginal' : 'Poor',
    recommendation: oeeRecommendation(oee, r, line)
  };
}

function getAllOEE () {
  return PRODUCTION_LINES.map(l => computeOEE(l.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  Cp / Cpk  Statistical Process Capability
//
//   Cp  = (USL − LSL) / (6 × σ)            ← potential capability
//   Cpk = min[(USL − μ)/(3σ), (μ − LSL)/(3σ)] ← actual capability
// ─────────────────────────────────────────────────────────────────────────────
function computeCpk (lineId) {
  const line = PRODUCTION_LINES.find(l => l.id === lineId);
  const r    = CURRENT_READINGS[lineId];
  if (!line || !r) return null;

  const { usl, lsl } = line.spec;
  const mu  = r.mean;
  const sig = r.stdDev;

  if (sig === 0) return { lineId, cp: Infinity, cpk: Infinity, status: 'Excellent' };

  const cp   = (usl - lsl) / (6 * sig);
  const cpkU = (usl - mu)  / (3 * sig);
  const cpkL = (mu  - lsl) / (3 * sig);
  const cpk  = Math.min(cpkU, cpkL);

  const status = cpk >= 1.67 ? 'Excellent'
               : cpk >= 1.33 ? 'Capable'
               : cpk >= 1.00 ? 'Marginal'
               : 'Incapable';

  const recommendation = cpkRecommendation(cpk, lineId, mu, sig, line.spec);

  return {
    lineId,
    lineName      : line.name,
    cp  : round2(cp),
    cpk : round2(cpk),
    cpkUpper: round2(cpkU),
    cpkLower: round2(cpkL),
    processMean : round2(mu),
    processSigma: round2(sig),
    spec        : line.spec,
    status,
    recommendation
  };
}

function getAllCpk () {
  return PRODUCTION_LINES.map(l => computeCpk(l.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Energy Consumption Prediction
//     E(t) = β0 + β1*units(t) + β2*temp(t) + β3*shift(t) + ε
//     Coefficients estimated from 12-month historical data.
// ─────────────────────────────────────────────────────────────────────────────
const ENERGY_MODEL = {
  'Plant-1': { beta0: 400, betaUnits: 0.28, betaTemp: 2.1,  betaShift: 120 },
  'Plant-2': { beta0: 350, betaUnits: 0.25, betaTemp: 1.85, betaShift: 100 }
};

function predictEnergy ({ plant, unitsPlanned, ambientTempC, shiftNumber }) {
  const m = ENERGY_MODEL[plant];
  if (!m) return null;

  const predicted = Math.round(
    m.beta0 +
    m.betaUnits * unitsPlanned +
    m.betaTemp  * ambientTempC +
    m.betaShift * shiftNumber
  );

  const baseline      = Math.round(m.beta0 + m.betaUnits * unitsPlanned);
  const peakWindow    = shiftNumber === 2 ? '14:00–17:00' : '06:00–09:00';
  const savingPotential = Math.round(predicted * 0.08);   // ~8% from load-shifting

  return {
    plant,
    predictedKwh    : predicted,
    baselineKwh     : baseline,
    perUnitKwh      : round2(predicted / unitsPlanned),
    peakLoadWindow  : peakWindow,
    savingPotentialKwh: savingPotential,
    savingRupees    : savingPotential * 7,  // ₹7/kWh avg industrial tariff
    recommendation  : `Shift ${Math.round(savingPotential / 50)} heavy-stamping cycles from peak window to off-peak. Est. saving: ₹${(savingPotential * 7).toLocaleString('en-IN')}/day.`
  };
}

function getEnergyForecast () {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return hours.map(h => {
    const isPeak = h >= 14 && h <= 17;
    const base   = 160 + Math.round(Math.random() * 30);
    return {
      hour    : `${String(h).padStart(2,'0')}:00`,
      actual  : isPeak ? base + 60 : base,
      predicted: isPeak ? base + 55 : base - 5,
      target  : 140
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Computer Vision Defect Detection Simulation
//     In production: CNN (e.g., EfficientNet-B3) running on edge GPU.
//     Returns defect classifications with confidence scores.
// ─────────────────────────────────────────────────────────────────────────────
const DEFECT_TYPES = [
  { type: 'Surface Scratch',  severity: 'Minor',    rejectRate: 0.25, model: 'CV-SCRATCH-v3'  },
  { type: 'Weld Spatter',     severity: 'Major',    rejectRate: 0.85, model: 'CV-WELD-v2'     },
  { type: 'Paint Bubble',     severity: 'Minor',    rejectRate: 0.40, model: 'CV-PAINT-v4'    },
  { type: 'Alignment Offset', severity: 'Critical', rejectRate: 1.00, model: 'CV-ALIGN-v2'    },
  { type: 'Corrosion Spot',   severity: 'Major',    rejectRate: 0.90, model: 'CV-CORR-v1'     },
  { type: 'Dimensional Error',severity: 'Critical', rejectRate: 1.00, model: 'CV-DIM-v3'      }
];

function getDefectStats () {
  // Simulated daily stats — in production pull from edge inference logs
  const today = DEFECT_TYPES.map(d => ({
    ...d,
    count          : Math.floor(Math.random() * 12) + 1,
    confidence     : round2(0.97 + Math.random() * 0.025),
    rejectedCount  : 0   // filled below
  })).map(d => ({
    ...d,
    rejectedCount: Math.round(d.count * d.rejectRate)
  }));

  const totalInspected  = 2304;  // units inspected today
  const totalDefects    = today.reduce((s, d) => s + d.count, 0);
  const totalRejected   = today.reduce((s, d) => s + d.rejectedCount, 0);
  const accuracy        = round2(((totalInspected - 3) / totalInspected) * 100);  // 3 false positives

  return {
    date            : new Date().toISOString().slice(0, 10),
    totalInspected,
    totalDefects,
    totalRejected,
    falsePositives  : 3,
    detectionAccuracy: accuracy,
    throughputPerMin: 48,
    defectBreakdown : today
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  Production Demand Forecast (7-day rolling + simple trend)
// ─────────────────────────────────────────────────────────────────────────────
function forecastProduction (historicalUnits, horizon = 7) {
  // Weighted moving average (most recent = highest weight)
  const n      = Math.min(historicalUnits.length, 7);
  const window = historicalUnits.slice(-n);
  const weights = window.map((_, i) => i + 1);
  const wSum   = weights.reduce((a, b) => a + b, 0);
  const wma    = window.reduce((acc, v, i) => acc + v * weights[i], 0) / wSum;

  // Linear trend (least-squares slope on last n points)
  const xBar   = (n - 1) / 2;
  const yBar   = window.reduce((a, b) => a + b, 0) / n;
  const slope  = window.reduce((acc, v, i) => acc + (i - xBar) * (v - yBar), 0) /
                 window.reduce((acc, _, i) => acc + Math.pow(i - xBar, 2), 0);

  return Array.from({ length: horizon }, (_, i) => ({
    day       : i + 1,
    date      : dayOffset(i + 1),
    forecast  : Math.round(wma + slope * (i + 1)),
    lower95   : Math.round(wma + slope * (i + 1) - 25),
    upper95   : Math.round(wma + slope * (i + 1) + 25)
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function round2 (n) { return Math.round(n * 100) / 100; }

function oeeRecommendation (oee, r, line) {
  if (oee >= 0.85) return 'OEE is good. Maintain current parameters.';
  if (r.availability < 0.90)
    return `Availability bottleneck (${round2(r.availability*100)}%). Check unplanned downtime root cause.`;
  if (r.performance < 0.88)
    return `Performance gap (${round2(r.performance*100)}%). Investigate cycle time variance and micro-stops.`;
  if (r.quality < 0.99)
    return `Quality loss (${round2(r.quality*100)}%). Review ${r.scrapCount} scrapped units — initiate 5-Why.`;
  return 'Review combined losses across A/P/Q pillars.';
}

function cpkRecommendation (cpk, lineId, mu, sig, spec) {
  if (cpk >= 1.67) return 'Process is excellent. Continue monitoring.';
  if (cpk >= 1.33) return 'Process is capable. Schedule periodic audit.';
  if (cpk >= 1.00) {
    const bias = Math.abs(mu - spec.target);
    if (bias > sig)
      return `Process is off-centre (μ=${mu}). Re-centre to target ${spec.target} by adjusting fixture.`;
    return `High variation (σ=${sig}). Reduce variance — recalibrate tooling.`;
  }
  return `CRITICAL: Cpk ${round2(cpk)} < 1.0. Immediate process halt and investigation required. Engage quality engineer.`;
}

function dayOffset (n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  computeOEE,
  getAllOEE,
  computeCpk,
  getAllCpk,
  predictEnergy,
  getEnergyForecast,
  getDefectStats,
  forecastProduction,
  PRODUCTION_LINES
};
