const dashboardService = require('../services/dashboard.service');

/**
 * Dashboard Controller
 * Maneja los endpoints del dashboard de analytics
 */

// Helper para parsear fechas
function parseDateRange(req) {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 7);

  const startDate = req.query.startDate || defaultStart.toISOString().split('T')[0];
  const endDate = req.query.endDate || today.toISOString().split('T')[0];

  return { startDate, endDate };
}

// Helper para parsear filtros avanzados
function parseAdvancedFilters(req) {
  const filters = {};

  if (req.query.device) filters.device = req.query.device;
  if (req.query.browser) filters.browser = req.query.browser;
  if (req.query.country) filters.country = req.query.country;
  if (req.query.source) filters.source = req.query.source;
  if (req.query.utmCampaign) filters.utmCampaign = req.query.utmCampaign;

  return filters;
}

// GET /api/v1/dashboard/sites
async function getSites(req, res, next) {
  try {
    const sites = await dashboardService.getSites();
    res.json({ success: true, data: sites });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/summary
async function getSummary(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const filters = parseAdvancedFilters(req);
    const data = await dashboardService.getSummary(siteId, startDate, endDate, filters);

    res.json({ success: true, data, filters: { siteId, startDate, endDate, ...filters } });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/events
async function getEventsByType(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getEventsByType(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/pages
async function getTopPages(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const limit = parseInt(req.query.limit) || 10;
    const filters = parseAdvancedFilters(req);
    const data = await dashboardService.getTopPages(siteId, startDate, endDate, limit, filters);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/clicks
async function getTopClicks(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const limit = parseInt(req.query.limit) || 10;
    const data = await dashboardService.getTopClicks(siteId, startDate, endDate, limit);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/referrers
async function getTopReferrers(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const limit = parseInt(req.query.limit) || 10;
    const data = await dashboardService.getTopReferrers(siteId, startDate, endDate, limit);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/utms
async function getTopUtms(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const limit = parseInt(req.query.limit) || 10;
    const data = await dashboardService.getTopUtms(siteId, startDate, endDate, limit);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/scroll
async function getScrollDistribution(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getScrollDistribution(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/devices
async function getDeviceDistribution(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getDeviceDistribution(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/browsers
async function getBrowserDistribution(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getBrowserDistribution(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/trend/daily
async function getDailyTrend(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const filters = parseAdvancedFilters(req);
    const data = await dashboardService.getDailyTrend(siteId, startDate, endDate, filters);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/trend/hourly
async function getHourlyTrend(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const date = req.query.date || new Date().toISOString().split('T')[0];
    const data = await dashboardService.getHourlyTrend(siteId, date);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/realtime
async function getRealtimeVisitors(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const data = await dashboardService.getRealtimeVisitors(siteId);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/sources
async function getTrafficSources(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getTrafficSources(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/location
async function getLocationData(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getLocationData(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/realtime/detailed
async function getRealtimeDetailed(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const minutes = parseInt(req.query.minutes) || 30;
    const data = await dashboardService.getRealtimeDetailed(siteId, minutes);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/countries
async function getCountryList(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getCountryList(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/heatmap
async function getHeatmap(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getHeatmapData(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/summary/compare
async function getSummaryCompare(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const filters = parseAdvancedFilters(req);
    const data = await dashboardService.getSummaryCompare(siteId, startDate, endDate, filters);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/metrics/advanced
async function getAdvancedMetrics(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const filters = parseAdvancedFilters(req);
    const data = await dashboardService.getAdvancedMetrics(siteId, startDate, endDate, filters);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/dashboard/funnel
async function getFunnel(req, res, next) {
  try {
    const siteId = parseInt(req.query.siteId);
    if (!siteId) {
      return res.status(400).json({ success: false, error: 'siteId is required' });
    }

    const { startDate, endDate } = parseDateRange(req);
    const data = await dashboardService.getFunnelData(siteId, startDate, endDate);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSites,
  getSummary,
  getEventsByType,
  getTopPages,
  getTopClicks,
  getTopReferrers,
  getTopUtms,
  getScrollDistribution,
  getDeviceDistribution,
  getBrowserDistribution,
  getDailyTrend,
  getHourlyTrend,
  getRealtimeVisitors,
  getTrafficSources,
  getLocationData,
  getRealtimeDetailed,
  getCountryList,
  getHeatmap,
  getSummaryCompare,
  getAdvancedMetrics,
  getFunnel
};
