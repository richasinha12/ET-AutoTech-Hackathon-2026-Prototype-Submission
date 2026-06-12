/**
 * src/models/inventoryModel.js
 *
 * AutoChain AI — Inventory & Demand Forecasting
 *
 * Features:
 *   1. Days-of-supply calculation per part
 *   2. Demand forecast (weighted moving average + trend)
 *   3. Reorder point and safety stock computation
 *   4. ERP-style auto-reorder recommendations
 */

'use strict';

const { weightedMovingAverage, linearTrend, round, dayOffset } = require('../utils/helpers');

// ── Part master ───────────────────────────────────────────────────────────────
const PARTS = [
  {
    partNo: 'MCU-S32K-001', name: 'NXP S32K MCU', category: 'Semiconductor',
    currentStock: 4800, unitCost: 320, currency: 'USD',
    avgDailyUsage: 800, leadTimeDays: 14, safetyStockDays: 7,
    supplier: 'SUP004', criticalPath: true,
    history7d: [820, 790, 810, 830, 800, 815, 795]
  },
  {
    partNo: 'CELL-NMC-001', name: 'NMC Battery Cell', category: 'Battery',
    currentStock: 43200, unitCost: 8.5, currency: 'USD',
    avgDailyUsage: 2400, leadTimeDays: 35, safetyStockDays: 10,
    supplier: 'SUP010', criticalPath: true,
    history7d: [2350, 2400, 2450, 2380, 2420, 2400, 2430]
  },
  {
    partNo: 'STEEL-HRC-001', name: 'HRC Steel Coil', category: 'Steel',
    currentStock: 840000, unitCost: 0.00062, currency: 'USD',   // per kg
    avgDailyUsage: 20000, leadTimeDays: 10, safetyStockDays: 5,
    supplier: 'SUP020', criticalPath: false,
    history7d: [19800, 20200, 20100, 19900, 20300, 20100, 20050]
  },
  {
    partNo: 'WIRE-CU-001', name: 'Copper Wiring Harness', category: 'Wiring Harness',
    currentStock: 2940, unitCost: 1450, currency: 'INR',
    avgDailyUsage: 140, leadTimeDays: 12, safetyStockDays: 7,
    supplier: 'SUP040', criticalPath: false,
    history7d: [138, 142, 140, 145, 138, 141, 143]
  },
  {
    partNo: 'ECU-BSH-001', name: 'Bosch ECU Module', category: 'Electronics',
    currentStock: 9600, unitCost: 4200, currency: 'INR',
    avgDailyUsage: 320, leadTimeDays: 14, safetyStockDays: 7,
    supplier: 'SUP051', criticalPath: true,
    history7d: [315, 322, 318, 325, 320, 319, 323]
  },
  {
    partNo: 'COBT-GLC-001', name: 'Cobalt Hydroxide', category: 'Raw Material',
    currentStock: 18000, unitCost: 34.1, currency: 'USD',
    avgDailyUsage: 900, leadTimeDays: 60, safetyStockDays: 20,
    supplier: 'SUP030', criticalPath: true,
    history7d: [880, 910, 895, 920, 905, 890, 900]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1.  getDaysOfSupply(part)
// ─────────────────────────────────────────────────────────────────────────────
function getDaysOfSupply(part) {
  const forecastedDailyUsage = round(weightedMovingAverage(part.history7d), 0);
  if (forecastedDailyUsage === 0) return Infinity;
  return round(part.currentStock / forecastedDailyUsage, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  getReorderPoint(part)
//     ROP = (avg daily usage × lead time) + safety stock
// ─────────────────────────────────────────────────────────────────────────────
function getReorderPoint(part) {
  const wma = round(weightedMovingAverage(part.history7d), 0);
  return Math.ceil(wma * part.leadTimeDays + wma * part.safetyStockDays);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  forecastDemand(part, horizon)
//     WMA + linear trend, horizon days forward
// ─────────────────────────────────────────────────────────────────────────────
function forecastDemand(part, horizon = 14) {
  const wma   = weightedMovingAverage(part.history7d);
  const slope = linearTrend(part.history7d);
  return Array.from({ length: horizon }, (_, i) => ({
    day     : i + 1,
    date    : dayOffset(i + 1),
    forecast: Math.max(0, Math.round(wma + slope * (i + 1))),
    lower   : Math.max(0, Math.round(wma + slope * (i + 1) - wma * 0.05)),
    upper   : Math.round(wma + slope * (i + 1) + wma * 0.05)
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  getReorderRecommendations()
//     Returns parts that need immediate or upcoming reorder action
// ─────────────────────────────────────────────────────────────────────────────
function getReorderRecommendations() {
  return PARTS.map(part => {
    const dos    = getDaysOfSupply(part);
    const rop    = getReorderPoint(part);
    const wma    = round(weightedMovingAverage(part.history7d), 0);
    const reorderQty = Math.ceil(wma * (part.leadTimeDays + part.safetyStockDays));
    const reorderValue = round(reorderQty * part.unitCost, 2);

    let urgency, action;
    if (part.currentStock <= rop * 0.5) {
      urgency = 'CRITICAL';
      action  = `Issue emergency PO immediately. Stock below 50% of ROP. Consider air freight (lead ${part.leadTimeDays}d).`;
    } else if (part.currentStock <= rop) {
      urgency = 'HIGH';
      action  = `Issue standard PO now. Stock at or below reorder point.`;
    } else if (dos <= part.leadTimeDays + part.safetyStockDays) {
      urgency = 'MEDIUM';
      action  = `Plan PO within 3 days. Days-of-supply ${dos}d ≤ lead time ${part.leadTimeDays}d + safety ${part.safetyStockDays}d.`;
    } else {
      urgency = 'OK';
      action  = `Stock adequate. Next review at ${Math.round(dos - part.leadTimeDays - part.safetyStockDays)} days.`;
    }

    return {
      partNo      : part.partNo,
      name        : part.name,
      category    : part.category,
      currentStock: part.currentStock,
      daysOfSupply: dos,
      reorderPoint: rop,
      reorderQty,
      reorderValue,
      currency    : part.currency,
      urgency,
      action,
      criticalPath: part.criticalPath,
      supplier    : part.supplier
    };
  }).sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, OK: 3 };
    return order[a.urgency] - order[b.urgency];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  getInventoryDashboard()
//     Summary KPIs for the dashboard
// ─────────────────────────────────────────────────────────────────────────────
function getInventoryDashboard() {
  const recs      = getReorderRecommendations();
  const critical  = recs.filter(r => r.urgency === 'CRITICAL');
  const high      = recs.filter(r => r.urgency === 'HIGH');
  const atRisk    = [...critical, ...high];
  const totalReorderValue = atRisk.reduce((s, r) => s + r.reorderValue, 0);

  return {
    totalParts      : PARTS.length,
    criticalCount   : critical.length,
    highCount       : high.length,
    atRiskCount     : atRisk.length,
    totalReorderValue,
    parts           : recs
  };
}

module.exports = {
  getDaysOfSupply,
  getReorderPoint,
  forecastDemand,
  getReorderRecommendations,
  getInventoryDashboard,
  PARTS
};
