const express = require('express');
const dashboardRoutes = require('./dashboard.routes');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'dashboard', timestamp: new Date().toISOString() });
});

// Dashboard API
router.use('/api/v1/dashboard', dashboardRoutes);

module.exports = router;
