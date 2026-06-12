/**
 * config/appConfig.js
 * Central configuration for AutoChain AI
 * All environment-tunable constants live here.
 */

'use strict';

module.exports = {

  // ── Server ────────────────────────────────────────────────────────────────
  server: {
    port    : process.env.PORT    || 3000,
    env     : process.env.NODE_ENV || 'development',
    corsOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000']
  },

  // ── Risk Engine ───────────────────────────────────────────────────────────
  risk: {
    weights: {
      geopolitical : 0.30,
      logistics    : 0.25,
      commodity    : 0.25,
      supplier     : 0.20
    },
    thresholds: {
      critical : 75,
      high     : 55,
      medium   : 35
    },
    alertRefreshMs : 60_000,      // re-evaluate alerts every 60 seconds
    forecastHorizon: 30           // days
  },

  // ── Manufacturing ─────────────────────────────────────────────────────────
  manufacturing: {
    cpk: {
      excellent : 1.67,
      capable   : 1.33,
      marginal  : 1.00
    },
    oee: {
      worldClass : 85,
      acceptable : 70
    },
    energyTariffRupeePerKwh: 7    // ₹7 / kWh industrial tariff
  },

  // ── Commodity ─────────────────────────────────────────────────────────────
  commodity: {
    forecastAlpha      : 0.3,     // exponential smoothing factor
    hedgeThresholdPct  : 3.0,     // recommend hedge if 30d upside > 3 %
    refreshIntervalMs  : 300_000  // price refresh every 5 minutes
  },

  // ── Copilot ───────────────────────────────────────────────────────────────
  copilot: {
    maxHistoryTurns : 20,
    responseDelayMs : 0           // set > 0 to simulate thinking time
  }
};
