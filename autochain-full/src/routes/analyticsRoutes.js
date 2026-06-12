/**
 * src/routes/analyticsRoutes.js
 */
'use strict';
const express = require('express');
const router  = express.Router();
const {
  getAllScorecards,
  computeScorecard,
  getSpendConcentration,
  getPaymentTermsAnalysis
} = require('../models/supplierAnalytics');
const { SUPPLIERS } = require('../data/supplierDatabase');

// GET /api/analytics/scorecards        — all supplier scorecards
router.get('/scorecards', (req, res) => {
  try {
    res.json({ success: true, data: getAllScorecards() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/scorecards/:id    — single scorecard
router.get('/scorecards/:id', (req, res) => {
  try {
    const sup = SUPPLIERS.find(s => s.id === req.params.id);
    if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: computeScorecard(sup) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/spend             — spend concentration
router.get('/spend', (req, res) => {
  try {
    res.json({ success: true, data: getSpendConcentration() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/payment-terms     — payment terms breakdown
router.get('/payment-terms', (req, res) => {
  try {
    res.json({ success: true, data: getPaymentTermsAnalysis() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
