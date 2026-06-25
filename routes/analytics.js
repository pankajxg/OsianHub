const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getAdminKpis, getSuperAdminKpis, getChartData } = require('../controllers/analyticsController');

router.get('/admin-kpis', protect, adminOnly, getAdminKpis);
router.get('/superadmin-kpis', protect, adminOnly, getSuperAdminKpis);
router.get('/charts', protect, adminOnly, getChartData);

module.exports = router;
