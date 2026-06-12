/**
 * src/routes/copilotRoutes.js
 */
'use strict';
const express = require('express');
const router  = express.Router();
const { generateResponse } = require('../models/copilotEngine');

// POST /api/copilot/ask  { query: "..." }
router.post('/ask', (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }
    const result = generateResponse(query.trim());
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/copilot/intents  — list available intents (helpful for UI)
router.get('/intents', (req, res) => {
  res.json({
    success: true,
    suggestions: [
      'What are the top supply chain risks this week?',
      'Find alternate semiconductor suppliers',
      'Explain cobalt supply risk and what to do',
      'Show Line B Cpk issue and recommendation',
      'How can I reduce energy costs on Plant-1?',
      'Extract meeting action items',
      'What is the lithium price forecast?',
      'Show material substitution options',
      'Inventory days of supply critical parts',
      'Port congestion and rerouting options'
    ]
  });
});

module.exports = router;
