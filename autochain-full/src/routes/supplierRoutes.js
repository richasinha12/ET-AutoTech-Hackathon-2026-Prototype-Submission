/**
 * src/routes/supplierRoutes.js
 */
'use strict';
const express = require('express');
const router  = express.Router();
const { SUPPLIERS } = require('../data/supplierDatabase');
const { computeSupplierRisk } = require('../models/riskEngine');

// GET /api/suppliers  — full list with computed risk
router.get('/', (req, res) => {
  try {
    const { category, country, minScore, maxScore } = req.query;
    let list = SUPPLIERS.map(s => ({ ...s, risk: computeSupplierRisk(s) }));
    if (category) list = list.filter(s => s.category.toLowerCase().includes(category.toLowerCase()));
    if (country)  list = list.filter(s => s.country.toLowerCase().includes(country.toLowerCase()));
    if (minScore) list = list.filter(s => s.risk.score >= parseInt(minScore));
    if (maxScore) list = list.filter(s => s.risk.score <= parseInt(maxScore));
    res.json({ success: true, count: list.length, suppliers: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/suppliers/:id
router.get('/:id', (req, res) => {
  const sup = SUPPLIERS.find(s => s.id === req.params.id);
  if (!sup) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, supplier: { ...sup, risk: computeSupplierRisk(sup) } });
});

// POST /api/suppliers/alternate  — alternate sourcing
router.post('/alternate', (req, res) => {
  const { category, currentSupplierId } = req.body;
  const { recommendAlternateSources } = require('../models/riskEngine');
  const alts = recommendAlternateSources(category || 'Semiconductor', currentSupplierId, SUPPLIERS);
  res.json({ success: true, alternates: alts });
});

module.exports = router;
