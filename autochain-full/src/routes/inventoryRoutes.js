/**
 * src/routes/inventoryRoutes.js
 */
'use strict';
const express = require('express');
const router  = express.Router();
const {
  getInventoryDashboard,
  getReorderRecommendations,
  forecastDemand,
  PARTS
} = require('../models/inventoryModel');

// GET /api/inventory            — full dashboard
router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: getInventoryDashboard() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/inventory/reorder    — parts needing reorder
router.get('/reorder', (req, res) => {
  try {
    const recs = getReorderRecommendations();
    const { urgency } = req.query;
    const filtered = urgency ? recs.filter(r => r.urgency === urgency.toUpperCase()) : recs;
    res.json({ success: true, count: filtered.length, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/inventory/forecast/:partNo  — demand forecast for a part
router.get('/forecast/:partNo', (req, res) => {
  try {
    const part = PARTS.find(p => p.partNo === req.params.partNo);
    if (!part) return res.status(404).json({ success: false, error: 'Part not found' });
    const horizon  = parseInt(req.query.days) || 14;
    const forecast = forecastDemand(part, horizon);
    res.json({ success: true, partNo: part.partNo, name: part.name, data: forecast });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
