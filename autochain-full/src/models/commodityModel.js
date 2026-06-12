/**
 * src/models/commodityModel.js
 *
 * AutoChain AI — Commodity Intelligence Engine
 *
 * Covers:
 *   1. Real-time commodity price feed (simulated; prod = Bloomberg / LME API)
 *   2. 30-day price forecasting using exponential smoothing + trend
 *   3. Material substitution recommendation matrix
 *   4. Hedging signal generation
 *   5. Category spend analytics
 */

'use strict';

// ── Commodity master data ─────────────────────────────────────────────────────
const COMMODITIES = {
  lithium: {
    name: 'Lithium Carbonate', unit: 'USD/t', symbol: 'Li',
    currentPrice: 23400, weekAgo: 20500, monthAgo: 16800,
    supplyRegion: 'Chile/Australia', riskLevel: 'Critical',
    automotiveUse: 'EV Battery (NMC/NCA chemistry)',
    priceDrivers: ['Chinese EV demand surge', 'Chilean water rights restrictions', 'New mine delays'],
    hedgingAvailable: true
  },
  cobalt: {
    name: 'Cobalt Metal', unit: 'USD/t', symbol: 'Co',
    currentPrice: 34100, weekAgo: 31900, monthAgo: 29500,
    supplyRegion: 'DRC (73% global)', riskLevel: 'High',
    automotiveUse: 'EV Battery cathode (NMC/LCO)',
    priceDrivers: ['DRC export levy +15%', 'Artisanal mining policy', 'EV demand pull'],
    hedgingAvailable: true
  },
  copper: {
    name: 'Copper (Grade A)', unit: 'USD/t', symbol: 'Cu',
    currentPrice: 8920, weekAgo: 9110, monthAgo: 9350,
    supplyRegion: 'Chile/Peru/USA', riskLevel: 'Low',
    automotiveUse: 'Wiring harness, Motors, Connectors',
    priceDrivers: ['Oversupply from Peru ramp-up', 'Weak China manufacturing data'],
    hedgingAvailable: true
  },
  steel_hrc: {
    name: 'Steel HRC', unit: 'USD/t', symbol: 'Fe',
    currentPrice: 620, weekAgo: 618, monthAgo: 615,
    supplyRegion: 'China/India/Korea', riskLevel: 'Low',
    automotiveUse: 'Body panels, Chassis, Structural',
    priceDrivers: ['Steady auto demand', 'Chinese export pressure'],
    hedgingAvailable: false
  },
  aluminum: {
    name: 'Aluminum', unit: 'USD/t', symbol: 'Al',
    currentPrice: 2380, weekAgo: 2290, monthAgo: 2200,
    supplyRegion: 'China/Russia/Canada', riskLevel: 'Medium',
    automotiveUse: 'Lightweight body, EV battery housing',
    priceDrivers: ['Energy cost pressure in Europe', 'Russia sanctions impact'],
    hedgingAvailable: true
  },
  nickel: {
    name: 'Nickel', unit: 'USD/t', symbol: 'Ni',
    currentPrice: 18200, weekAgo: 17400, monthAgo: 16800,
    supplyRegion: 'Indonesia/Philippines', riskLevel: 'Medium',
    automotiveUse: 'EV Battery (NMC811), Stainless steel',
    priceDrivers: ['Indonesia ore export restrictions', 'NMC811 EV battery demand'],
    hedgingAvailable: true
  },
  palladium: {
    name: 'Palladium', unit: 'USD/oz', symbol: 'Pd',
    currentPrice: 1040, weekAgo: 1010, monthAgo: 1080,
    supplyRegion: 'Russia (40%) / South Africa',  riskLevel: 'High',
    automotiveUse: 'Catalytic converter (ICE)',
    priceDrivers: ['Russian supply overhang', 'ICE decline long-term'],
    hedgingAvailable: true
  },
  rare_earth: {
    name: 'Neodymium Oxide', unit: 'USD/kg', symbol: 'Nd',
    currentPrice: 78, weekAgo: 73, monthAgo: 65,
    supplyRegion: 'China (85% global)', riskLevel: 'Critical',
    automotiveUse: 'Permanent magnet motors (EV)',
    priceDrivers: ['China export quota tightening', 'EV motor demand growth'],
    hedgingAvailable: false
  }
};

// ── Exponential smoothing forecast parameters ─────────────────────────────────
const FORECAST_PARAMS = {
  lithium   : { alpha: 0.3, trend: +180,  volatility: 0.04 },
  cobalt    : { alpha: 0.3, trend: +120,  volatility: 0.035 },
  copper    : { alpha: 0.4, trend: -20,   volatility: 0.025 },
  steel_hrc : { alpha: 0.5, trend: +2,    volatility: 0.01 },
  aluminum  : { alpha: 0.3, trend: +30,   volatility: 0.02 },
  nickel    : { alpha: 0.3, trend: +150,  volatility: 0.03 },
  palladium : { alpha: 0.4, trend: -15,   volatility: 0.04 },
  rare_earth: { alpha: 0.2, trend: +2.5,  volatility: 0.05 }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1.  getCommodityPrices()
// ─────────────────────────────────────────────────────────────────────────────
function getCommodityPrices () {
  return Object.entries(COMMODITIES).map(([key, c]) => {
    const pctChange = ((c.currentPrice - c.weekAgo) / c.weekAgo * 100).toFixed(1);
    const direction = pctChange > 0 ? 'up' : pctChange < 0 ? 'down' : 'flat';
    return {
      id           : key,
      ...c,
      weeklyChange : parseFloat(pctChange),
      direction,
      monthlyChange: ((c.currentPrice - c.monthAgo) / c.monthAgo * 100).toFixed(1)
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  forecastCommodityPrice(commodityId, days)
//     Exponential smoothing + linear trend + Monte Carlo noise band
// ─────────────────────────────────────────────────────────────────────────────
function forecastCommodityPrice (commodityId, days = 30) {
  const c = COMMODITIES[commodityId];
  const p = FORECAST_PARAMS[commodityId];
  if (!c || !p) return null;

  const seed = c.currentPrice;
  const result = [];

  let smoothed = seed;
  for (let d = 1; d <= days; d++) {
    const trend   = p.trend * (d / 30);
    const noise   = (Math.random() - 0.48) * seed * p.volatility;
    const point   = Math.round(smoothed + trend + noise);
    smoothed      = p.alpha * point + (1 - p.alpha) * smoothed;
    const band    = Math.round(seed * p.volatility * d * 0.5);
    result.push({
      day    : d,
      date   : dayOffset(d),
      price  : Math.max(0, point),
      lower95: Math.max(0, point - band),
      upper95: point + band
    });
  }

  const endPrice   = result[days - 1].price;
  const changePct  = ((endPrice - seed) / seed * 100).toFixed(1);
  const outlook    = changePct > 5 ? 'Bearish (cost pressure)' :
                     changePct < -5 ? 'Bullish (cost relief)' : 'Neutral';

  return { commodityId, name: c.name, unit: c.unit, currentPrice: seed, outlook, changePct, forecast: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  getMaterialSubstitutions()
//     Matrix of current → alternate materials with cost/risk/feasibility
// ─────────────────────────────────────────────────────────────────────────────
const SUBSTITUTION_MATRIX = [
  {
    current       : 'Cobalt (LCO/NMC Battery)',
    substitute    : 'LFP (LiFePO₄)',
    application   : 'EV Battery — Standard Range',
    costDeltaPct  : -22,
    riskDeltaLevel: 'Critical → Low',
    energyDensity : '-18% (range reduction)',
    feasibility   : 'High',
    oems          : ['BYD', 'Tesla (SR)', 'CATL'],
    caveat        : 'Slight energy density trade-off. Ideal for city/fleet vehicles.',
    aiConfidence  : 95
  },
  {
    current       : 'Neodymium Magnet (Pure)',
    substitute    : 'Nd-Fe-B + Ferrite Composite',
    application   : 'EV Traction Motor',
    costDeltaPct  : -35,
    riskDeltaLevel: 'Critical → Medium',
    energyDensity : '-8% motor efficiency',
    feasibility   : 'Medium',
    oems          : ['Renault', 'Volkswagen'],
    caveat        : 'Requires motor redesign. 9-month qualification cycle.',
    aiConfidence  : 78
  },
  {
    current       : 'TSMC 7nm MCU (Taiwan)',
    substitute    : 'STMicro SPC58 / Infineon AURIX (EU)',
    application   : 'Body Control Module / ADAS ECU',
    costDeltaPct  : +8,
    riskDeltaLevel: 'Critical → Low',
    energyDensity : 'N/A',
    feasibility   : 'High',
    oems          : ['Stellantis', 'BMW'],
    caveat        : 'Software re-qualification needed (~3 months). Cost premium acceptable given risk reduction.',
    aiConfidence  : 90
  },
  {
    current       : 'Palladium Catalyst (ICE)',
    substitute    : 'Pd-Ru Alloy (50/50)',
    application   : 'Catalytic Converter',
    costDeltaPct  : +4,
    riskDeltaLevel: 'High → Low',
    energyDensity : 'N/A',
    feasibility   : 'High',
    oems          : ['Toyota', 'Honda'],
    caveat        : 'Drop-in replacement. Marginal cost increase offset by supply security.',
    aiConfidence  : 88
  },
  {
    current       : 'Copper Wiring (Standard)',
    substitute    : 'Aluminium Wiring (automotive grade)',
    application   : 'High-Voltage Battery Cables',
    costDeltaPct  : -28,
    riskDeltaLevel: 'Low → Low',
    energyDensity : '+40% cross-section needed',
    feasibility   : 'Medium',
    oems          : ['GM', 'Ford'],
    caveat        : 'Larger wire gauge increases weight slightly. Suitable for HV traction cable runs.',
    aiConfidence  : 72
  },
  {
    current       : 'Nickel NMC811 Cell',
    substitute    : 'LMFP (Li-Mn-Fe-Phosphate)',
    application   : 'EV Battery — Long Range',
    costDeltaPct  : -12,
    riskDeltaLevel: 'Medium → Low',
    energyDensity : '-5%',
    feasibility   : 'Medium',
    oems          : ['CATL', 'BYD'],
    caveat        : 'Emerging chemistry. Qualification cycle ~12 months. Strong long-term potential.',
    aiConfidence  : 68
  }
];

function getMaterialSubstitutions (currentMaterial) {
  if (currentMaterial) {
    return SUBSTITUTION_MATRIX.filter(s =>
      s.current.toLowerCase().includes(currentMaterial.toLowerCase())
    );
  }
  return SUBSTITUTION_MATRIX;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  getHedgingSignals()
//     Returns forward-contract recommendations for commodities with
//     upward price risk
// ─────────────────────────────────────────────────────────────────────────────
function getHedgingSignals () {
  return Object.entries(COMMODITIES)
    .filter(([, c]) => c.hedgingAvailable && (c.riskLevel === 'High' || c.riskLevel === 'Critical'))
    .map(([id, c]) => {
      const p      = FORECAST_PARAMS[id];
      const exp30d = Math.round(c.currentPrice + p.trend);
      const upside = ((exp30d - c.currentPrice) / c.currentPrice * 100).toFixed(1);
      return {
        commodity     : c.name,
        currentPrice  : c.currentPrice,
        unit          : c.unit,
        expected30d   : exp30d,
        upsideRisk    : parseFloat(upside),
        recommendation: upside > 3 ? 'HEDGE: Forward contract 60–90 days at current price' : 'MONITOR: Spot purchase acceptable',
        hedgeVolume   : 'Consult treasury team for volume calc based on 90-day BOM requirement'
      };
    });
}

// ── Helper ────────────────────────────────────────────────────────────────────
function dayOffset (n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  getCommodityPrices,
  forecastCommodityPrice,
  getMaterialSubstitutions,
  getHedgingSignals,
  COMMODITIES
};
