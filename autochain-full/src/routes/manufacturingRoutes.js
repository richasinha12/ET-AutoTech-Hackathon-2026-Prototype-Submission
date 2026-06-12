/**
 * src/routes/manufacturingRoutes.js
 */
'use strict';
const express = require('express');
const router  = express.Router();
const {
  computeOEE, getAllOEE,
  computeCpk, getAllCpk,
  predictEnergy, getEnergyForecast,
  getDefectStats, forecastProduction,
  PRODUCTION_LINES
} = require('../models/manufacturingModel');

router.get('/oee',        (req, res) => res.json({ success: true, data: getAllOEE() }));
router.get('/oee/:line',  (req, res) => {
  const d = computeOEE(req.params.line.toUpperCase());
  if (!d) return res.status(404).json({ success: false, error: 'Line not found' });
  res.json({ success: true, data: d });
});
router.get('/cpk',        (req, res) => res.json({ success: true, data: getAllCpk() }));
router.get('/cpk/:line',  (req, res) => {
  const d = computeCpk(req.params.line.toUpperCase());
  if (!d) return res.status(404).json({ success: false, error: 'Line not found' });
  res.json({ success: true, data: d });
});
router.get('/defects',    (req, res) => res.json({ success: true, data: getDefectStats() }));
router.get('/energy',     (req, res) => res.json({ success: true, data: getEnergyForecast() }));
router.post('/energy/predict', (req, res) => {
  const result = predictEnergy(req.body);
  if (!result) return res.status(400).json({ success: false, error: 'Invalid plant' });
  res.json({ success: true, data: result });
});
router.get('/lines',      (req, res) => res.json({ success: true, data: PRODUCTION_LINES }));
router.post('/forecast',  (req, res) => {
  const { history = [480,492,475,488,495,482,490], horizon = 7 } = req.body;
  res.json({ success: true, data: forecastProduction(history, horizon) });
});

module.exports = router;
