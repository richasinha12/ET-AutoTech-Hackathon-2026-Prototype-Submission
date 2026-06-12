/**
 * src/routes/commodityRoutes.js
 */
'use strict';
const express = require('express');
const router  = express.Router();
const { getCommodityPrices, forecastCommodityPrice,
        getMaterialSubstitutions, getHedgingSignals } = require('../models/commodityModel');

router.get('/',                     (req, res) => res.json({ success: true, data: getCommodityPrices() }));
router.get('/forecast/:id',         (req, res) => {
  const d = forecastCommodityPrice(req.params.id, parseInt(req.query.days) || 30);
  if (!d) return res.status(404).json({ success: false, error: 'Commodity not found' });
  res.json({ success: true, data: d });
});
router.get('/substitutions',        (req, res) => res.json({ success: true, data: getMaterialSubstitutions(req.query.material) }));
router.get('/hedging',              (req, res) => res.json({ success: true, data: getHedgingSignals() }));

module.exports = router;
