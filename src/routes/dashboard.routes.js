const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

/**
 * Dashboard API Routes
 * Base path: /api/v1/dashboard
 */

// Lista de sitios disponibles
router.get('/sites', dashboardController.getSites);

// Metricas principales
router.get('/summary', dashboardController.getSummary);

// Eventos por tipo
router.get('/events', dashboardController.getEventsByType);

// Top paginas
router.get('/pages', dashboardController.getTopPages);

// Top elementos clickeados
router.get('/clicks', dashboardController.getTopClicks);

// Top referrers
router.get('/referrers', dashboardController.getTopReferrers);

// Top UTMs
router.get('/utms', dashboardController.getTopUtms);

// Distribucion de scroll
router.get('/scroll', dashboardController.getScrollDistribution);

// Distribucion por dispositivo
router.get('/devices', dashboardController.getDeviceDistribution);

// Distribucion por navegador
router.get('/browsers', dashboardController.getBrowserDistribution);

// Tendencia diaria
router.get('/trend/daily', dashboardController.getDailyTrend);

// Tendencia por hora
router.get('/trend/hourly', dashboardController.getHourlyTrend);

// Visitantes en tiempo real
router.get('/realtime', dashboardController.getRealtimeVisitors);

// Tiempo real detallado
router.get('/realtime/detailed', dashboardController.getRealtimeDetailed);

// Fuentes de tráfico clasificadas
router.get('/sources', dashboardController.getTrafficSources);

// Ubicación geográfica
router.get('/location', dashboardController.getLocationData);

// Lista de países para filtro
router.get('/countries', dashboardController.getCountryList);

// Mapa de calor (heatmap) por dia y hora
router.get('/heatmap', dashboardController.getHeatmap);

// Comparacion de periodos
router.get('/summary/compare', dashboardController.getSummaryCompare);

// Metricas avanzadas (Traffic Growth, Quality Score)
router.get('/metrics/advanced', dashboardController.getAdvancedMetrics);

// Embudo de conversion
router.get('/funnel', dashboardController.getFunnel);

module.exports = router;
