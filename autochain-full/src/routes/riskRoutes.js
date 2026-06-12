/**
 * src/routes/riskRoutes.js
 * REST API endpoints for supply chain risk intelligence
 */
'use strict';
const express = require('express');
const router  = express.Router();
const {
  computeOverallRisk,
  computeSupplierRisk,
  generateAlerts,
  forecastDisruptions,
  recommendAlternateSources,
  scoreToLevel
} = require('../models/riskEngine');
const { SUPPLIERS } = require('../data/supplierDatabase');

// GET /api/risk/score  — overall portfolio risk score
router.get('/score', (req, res) => {
  try {
    const score   = computeOverallRisk(SUPPLIERS);
    const level   = scoreToLevel(score);
    const byCategory = {};
    SUPPLIERS.forEach(s => {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(computeSupplierRisk(s).score);
    });
    const categoryScores = Object.entries(byCategory).map(([cat, scores]) => ({
      category: cat,
      avgScore: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length),
      level   : scoreToLevel(Math.round(scores.reduce((a,b)=>a+b,0)/scores.length))
    })).sort((a,b) => b.avgScore - a.avgScore);

    res.json({ success: true, score, level, categoryScores, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/alerts  — live disruption alerts
router.get('/alerts', (req, res) => {
  try {
    const alerts = generateAlerts(SUPPLIERS);
    const { level } = req.query;
    const filtered = level ? alerts.filter(a => a.level === level) : alerts;
    res.json({ success: true, count: filtered.length, alerts: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/forecast  — 30-day disruption forecast
router.get('/forecast', (req, res) => {
  try {
    const days     = parseInt(req.query.days) || 30;
    const forecast = forecastDisruptions(null, days);
    res.json({ success: true, horizon: days, forecast });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/risk/alternate  — find alternate suppliers
// Body: { category, currentSupplierId }
router.post('/alternate', (req, res) => {
  try {
    const { category = 'Semiconductor', currentSupplierId } = req.body;
    const alts = recommendAlternateSources(category, currentSupplierId, SUPPLIERS);
    res.json({ success: true, category, count: alts.length, alternates: alts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/supplier/:id  — single supplier risk detail
router.get('/supplier/:id', (req, res) => {
  try {
    const sup = SUPPLIERS.find(s => s.id === req.params.id);
    if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const risk = computeSupplierRisk(sup);
    res.json({ success: true, supplier: sup, risk });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
