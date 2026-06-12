/**
 * src/utils/helpers.js
 * Shared utility functions for AutoChain AI
 */

'use strict';

/**
 * Round a number to N decimal places (default 2).
 */
function round(n, decimals = 2) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Clamp a value between min and max.
 */
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Return a date string offset from today by `days`.
 * e.g. dayOffset(7) → "2026-06-18"
 */
function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Convert a risk score (0–100) to a human-readable level string.
 */
function scoreToLabel(score) {
  if (score >= 75) return 'Critical';
  if (score >= 55) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

/**
 * Format a number as Indian Rupees  (e.g. 1_50_000 → "₹1,50,000").
 */
function toINR(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

/**
 * Compute a simple weighted moving average over an array of numbers.
 * Most-recent value gets the highest weight.
 */
function weightedMovingAverage(values) {
  if (!values || values.length === 0) return 0;
  const weights = values.map((_, i) => i + 1);
  const wSum    = weights.reduce((a, b) => a + b, 0);
  return values.reduce((acc, v, i) => acc + v * weights[i], 0) / wSum;
}

/**
 * Compute the least-squares linear trend (slope) over an array.
 * Returns slope per period.
 */
function linearTrend(values) {
  const n    = values.length;
  const xBar = (n - 1) / 2;
  const yBar = values.reduce((a, b) => a + b, 0) / n;
  const num  = values.reduce((acc, v, i) => acc + (i - xBar) * (v - yBar), 0);
  const den  = values.reduce((acc, _, i) => acc + Math.pow(i - xBar, 2), 0);
  return den === 0 ? 0 : num / den;
}

/**
 * Generate a random integer between min and max (inclusive).
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Simple exponential smoothing  S_t = α·x_t + (1-α)·S_{t-1}
 */
function expSmooth(values, alpha = 0.3) {
  if (!values.length) return 0;
  return values.reduce((s, v) => alpha * v + (1 - alpha) * s, values[0]);
}

/**
 * Return today's date as "DD Mon YYYY" (India style).
 */
function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

module.exports = {
  round,
  clamp,
  dayOffset,
  scoreToLabel,
  toINR,
  weightedMovingAverage,
  linearTrend,
  randInt,
  expSmooth,
  todayLabel
};
