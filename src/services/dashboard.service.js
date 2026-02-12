const prisma = require('../lib/prisma');

/**
 * Dashboard Service
 * Queries optimizadas para el dashboard de analytics
 * Actualizado para schema con snake_case
 */

// ============================================
// Metricas principales (Summary)
// ============================================

async function getSummary(siteId, startDate, endDate, filters = {}) {
  // Usar UTC para evitar problemas de timezone
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  // Construir filtros para sesiones (usando snake_case del schema)
  const sessionWhere = {
    site_id: siteId,
    started_at: { gte: start, lte: end }
  };

  // Aplicar filtros avanzados
  if (filters.browser) sessionWhere.browser = filters.browser;
  if (filters.source) sessionWhere.utm_source = filters.source;
  if (filters.utmCampaign) sessionWhere.utm_campaign = filters.utmCampaign;
  if (filters.device) {
    sessionWhere.visitor = { device_type: filters.device };
  }

  // Filtro por país (requiere join con geo_cache)
  let countryFilter = null;
  if (filters.country) {
    countryFilter = filters.country;
  }

  // Obtener IDs de sesiones filtradas
  const filteredSessions = await prisma.session.findMany({
    where: sessionWhere,
    select: { id: true, visitor_id: true }
  });

  const sessionIds = filteredSessions.map(s => Number(s.id));
  const visitorIds = [...new Set(filteredSessions.map(s => Number(s.visitor_id)))];

  // Si no hay sesiones después del filtro, retornar zeros
  if (sessionIds.length === 0) {
    return {
      pageviews: 0,
      sessions: 0,
      uniqueVisitors: 0,
      newVisitors: 0,
      returningVisitors: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      avgPagesPerSession: 0
    };
  }

  const [
    pageviews,
    newVisitors,
    bounceRate,
    avgSessionDuration,
    avgPageviews
  ] = await Promise.all([
    // Total pageviews para sesiones filtradas
    prisma.event.count({
      where: {
        site_id: siteId,
        event_type: 'pageview',
        occurred_at: { gte: start, lte: end },
        session_id: { in: sessionIds.map(id => BigInt(id)) }
      }
    }),
    // New visitors
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT v.id) as count
      FROM visitor v
      INNER JOIN session s ON s.visitor_id = v.id
      WHERE s.id = ANY(${sessionIds}::bigint[])
        AND v.first_seen_at >= ${start}
        AND v.first_seen_at <= ${end}
    `,
    // Bounce rate
    prisma.$queryRaw`
      SELECT
        COUNT(CASE WHEN pageviews_count = 1 THEN 1 END) as bounced,
        COUNT(*) as total
      FROM session
      WHERE id = ANY(${sessionIds}::bigint[])
    `,
    // Average session duration
    prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM (last_activity_at - started_at))) as avg_seconds
      FROM session
      WHERE id = ANY(${sessionIds}::bigint[])
        AND last_activity_at IS NOT NULL
    `,
    // Average pageviews per session
    prisma.$queryRaw`
      SELECT AVG(pageviews_count) as avg_pageviews
      FROM session
      WHERE id = ANY(${sessionIds}::bigint[])
    `
  ]);

  const uniqueVisitors = visitorIds.length;
  const newVisitorsCount = Number(newVisitors[0]?.count || 0);
  const returningVisitors = uniqueVisitors - newVisitorsCount;

  const bouncedSessions = Number(bounceRate[0]?.bounced || 0);
  const totalSessions = sessionIds.length || 1;
  const bounceRatePercent = totalSessions > 0 ? Math.round((bouncedSessions / totalSessions) * 100) : 0;

  const avgDuration = Number(avgSessionDuration[0]?.avg_seconds || 0);
  const avgPagesPerSession = Number(avgPageviews[0]?.avg_pageviews || 0);

  return {
    pageviews,
    sessions: sessionIds.length,
    uniqueVisitors,
    newVisitors: newVisitorsCount,
    returningVisitors,
    bounceRate: bounceRatePercent,
    avgSessionDuration: Math.round(avgDuration),
    avgPagesPerSession: Math.round(avgPagesPerSession * 10) / 10
  };
}

// ============================================
// Eventos por tipo
// ============================================

async function getEventsByType(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const events = await prisma.$queryRaw`
    SELECT
      event_type as type,
      COUNT(*) as count
    FROM event
    WHERE site_id = ${siteId}
      AND occurred_at >= ${start}
      AND occurred_at <= ${end}
    GROUP BY event_type
    ORDER BY count DESC
  `;

  return events.map(e => ({
    type: e.type,
    count: Number(e.count)
  }));
}

// ============================================
// Top paginas
// ============================================

async function getTopPages(siteId, startDate, endDate, limit = 10, filters = {}) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  // Aplicar filtros avanzados
  let sessionIds = null;
  if (filters.browser || filters.source || filters.utmCampaign || filters.device) {
    const sessionWhere = {
      site_id: siteId,
      started_at: { gte: start, lte: end }
    };
    if (filters.browser) sessionWhere.browser = filters.browser;
    if (filters.source) sessionWhere.utm_source = filters.source;
    if (filters.utmCampaign) sessionWhere.utm_campaign = filters.utmCampaign;
    if (filters.device) {
      sessionWhere.visitor = { device_type: filters.device };
    }

    const sessions = await prisma.session.findMany({
      where: sessionWhere,
      select: { id: true }
    });
    sessionIds = sessions.map(s => Number(s.id));

    if (sessionIds.length === 0) return [];
  }

  let pages;
  if (sessionIds) {
    pages = await prisma.$queryRaw`
      SELECT
        page_path as path,
        page_title as title,
        COUNT(*) as views,
        COUNT(DISTINCT visitor_id) as unique_visitors
      FROM event
      WHERE site_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${start}
        AND occurred_at <= ${end}
        AND page_path IS NOT NULL
        AND session_id = ANY(${sessionIds}::bigint[])
      GROUP BY page_path, page_title
      ORDER BY views DESC
      LIMIT ${limit}
    `;
  } else {
    pages = await prisma.$queryRaw`
      SELECT
        page_path as path,
        page_title as title,
        COUNT(*) as views,
        COUNT(DISTINCT visitor_id) as unique_visitors
      FROM event
      WHERE site_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${start}
        AND occurred_at <= ${end}
        AND page_path IS NOT NULL
      GROUP BY page_path, page_title
      ORDER BY views DESC
      LIMIT ${limit}
    `;
  }

  return pages.map(p => ({
    path: p.path,
    title: p.title,
    views: Number(p.views),
    uniqueVisitors: Number(p.unique_visitors)
  }));
}

// ============================================
// Top elementos clickeados
// ============================================

async function getTopClicks(siteId, startDate, endDate, limit = 10) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const clicks = await prisma.$queryRaw`
    SELECT
      meta_data->>'elementId' as element_id,
      meta_data->>'elementText' as element_text,
      meta_data->>'elementTag' as element_tag,
      COUNT(*) as clicks
    FROM event
    WHERE site_id = ${siteId}
      AND event_type = 'click'
      AND occurred_at >= ${start}
      AND occurred_at <= ${end}
      AND meta_data->>'elementId' IS NOT NULL
    GROUP BY element_id, element_text, element_tag
    ORDER BY clicks DESC
    LIMIT ${limit}
  `;

  return clicks.map(c => ({
    elementId: c.element_id,
    elementText: c.element_text,
    elementTag: c.element_tag,
    clicks: Number(c.clicks)
  }));
}

// ============================================
// Top referrers
// ============================================

async function getTopReferrers(siteId, startDate, endDate, limit = 10) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const referrers = await prisma.$queryRaw`
    SELECT
      referrer,
      COUNT(*) as sessions
    FROM session
    WHERE site_id = ${siteId}
      AND started_at >= ${start}
      AND started_at <= ${end}
      AND referrer IS NOT NULL
      AND referrer != ''
    GROUP BY referrer
    ORDER BY sessions DESC
    LIMIT ${limit}
  `;

  return referrers.map(r => ({
    referrer: r.referrer,
    sessions: Number(r.sessions)
  }));
}

// ============================================
// Top UTMs
// ============================================

async function getTopUtms(siteId, startDate, endDate, limit = 10) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const utms = await prisma.$queryRaw`
    SELECT
      utm_source as source,
      utm_medium as medium,
      utm_campaign as campaign,
      COUNT(*) as sessions
    FROM session
    WHERE site_id = ${siteId}
      AND started_at >= ${start}
      AND started_at <= ${end}
      AND utm_source IS NOT NULL
    GROUP BY utm_source, utm_medium, utm_campaign
    ORDER BY sessions DESC
    LIMIT ${limit}
  `;

  return utms.map(u => ({
    source: u.source,
    medium: u.medium,
    campaign: u.campaign,
    sessions: Number(u.sessions)
  }));
}

// ============================================
// Distribucion de scroll
// ============================================

async function getScrollDistribution(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const scrolls = await prisma.$queryRaw`
    SELECT
      (meta_data->>'depth')::int as depth,
      COUNT(DISTINCT visitor_id) as visitors
    FROM event
    WHERE site_id = ${siteId}
      AND event_type = 'scroll'
      AND occurred_at >= ${start}
      AND occurred_at <= ${end}
    GROUP BY depth
    ORDER BY depth
  `;

  return scrolls.map(s => ({
    depth: Number(s.depth),
    visitors: Number(s.visitors)
  }));
}

// ============================================
// Distribucion por dispositivo
// ============================================

async function getDeviceDistribution(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const devices = await prisma.$queryRaw`
    SELECT
      v.device_type as device,
      COUNT(DISTINCT s.id) as sessions
    FROM session s
    INNER JOIN visitor v ON v.id = s.visitor_id
    WHERE s.site_id = ${siteId}
      AND s.started_at >= ${start}
      AND s.started_at <= ${end}
    GROUP BY v.device_type
    ORDER BY sessions DESC
  `;

  return devices.map(d => ({
    device: d.device || 'unknown',
    sessions: Number(d.sessions)
  }));
}

// ============================================
// Distribucion por navegador
// ============================================

async function getBrowserDistribution(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const browsers = await prisma.$queryRaw`
    SELECT
      browser,
      COUNT(*) as sessions
    FROM session
    WHERE site_id = ${siteId}
      AND started_at >= ${start}
      AND started_at <= ${end}
    GROUP BY browser
    ORDER BY sessions DESC
  `;

  return browsers.map(b => ({
    browser: b.browser || 'Unknown',
    sessions: Number(b.sessions)
  }));
}

// ============================================
// Tendencia por dia
// ============================================

async function getDailyTrend(siteId, startDate, endDate, filters = {}) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  // Aplicar filtros avanzados obteniendo sesiones filtradas
  let sessionIds = null;
  if (filters.browser || filters.source || filters.utmCampaign || filters.device) {
    const sessionWhere = {
      site_id: siteId,
      started_at: { gte: start, lte: end }
    };
    if (filters.browser) sessionWhere.browser = filters.browser;
    if (filters.source) sessionWhere.utm_source = filters.source;
    if (filters.utmCampaign) sessionWhere.utm_campaign = filters.utmCampaign;
    if (filters.device) {
      sessionWhere.visitor = { device_type: filters.device };
    }

    const sessions = await prisma.session.findMany({
      where: sessionWhere,
      select: { id: true }
    });
    sessionIds = sessions.map(s => Number(s.id));

    if (sessionIds.length === 0) {
      return [];
    }
  }

  let trend;
  if (sessionIds) {
    trend = await prisma.$queryRaw`
      SELECT
        DATE(occurred_at) as date,
        COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT visitor_id) as visitors
      FROM event
      WHERE site_id = ${siteId}
        AND occurred_at >= ${start}
        AND occurred_at <= ${end}
        AND session_id = ANY(${sessionIds}::bigint[])
      GROUP BY DATE(occurred_at)
      ORDER BY date
    `;
  } else {
    trend = await prisma.$queryRaw`
      SELECT
        DATE(occurred_at) as date,
        COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT visitor_id) as visitors
      FROM event
      WHERE site_id = ${siteId}
        AND occurred_at >= ${start}
        AND occurred_at <= ${end}
      GROUP BY DATE(occurred_at)
      ORDER BY date
    `;
  }

  return trend.map(t => ({
    date: t.date.toISOString().split('T')[0],
    pageviews: Number(t.pageviews),
    sessions: Number(t.sessions),
    visitors: Number(t.visitors)
  }));
}

// ============================================
// Tendencia por hora
// ============================================

async function getHourlyTrend(siteId, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const trend = await prisma.$queryRaw`
    SELECT
      EXTRACT(HOUR FROM occurred_at) as hour,
      COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
      COUNT(DISTINCT visitor_id) as visitors
    FROM event
    WHERE site_id = ${siteId}
      AND occurred_at >= ${start}
      AND occurred_at <= ${end}
    GROUP BY hour
    ORDER BY hour
  `;

  const hourlyData = [];
  for (let h = 0; h < 24; h++) {
    const found = trend.find(t => Number(t.hour) === h);
    hourlyData.push({
      hour: h,
      pageviews: found ? Number(found.pageviews) : 0,
      visitors: found ? Number(found.visitors) : 0
    });
  }

  return hourlyData;
}

// ============================================
// Visitantes en tiempo real (ultimos 5 min)
// ============================================

async function getRealtimeVisitors(siteId) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const result = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT visitor_id) as count
    FROM session
    WHERE site_id = ${siteId}
      AND (last_activity_at >= ${fiveMinutesAgo} OR started_at >= ${fiveMinutesAgo})
  `;

  return {
    activeVisitors: Number(result[0]?.count || 0),
    since: fiveMinutesAgo.toISOString()
  };
}

// ============================================
// Lista de sitios disponibles
// ============================================

async function getSites() {
  const sites = await prisma.site_config.findMany({
    where: { is_active: true },
    select: {
      id: true,
      domain: true,
      company_id_ref: true
    },
    orderBy: { domain: 'asc' }
  });

  return sites.map(s => ({
    id: s.id,
    domain: s.domain,
    companyIdRef: s.company_id_ref
  }));
}

// ============================================
// Fuentes de tráfico con clasificación Direct
// ============================================

async function getTrafficSources(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const sources = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN utm_source IS NOT NULL THEN utm_source
        WHEN referrer IS NOT NULL AND referrer != '' THEN 'Referral'
        ELSE 'Direct'
      END as source,
      CASE
        WHEN utm_medium IS NOT NULL THEN utm_medium
        WHEN referrer IS NOT NULL AND referrer != '' THEN 'referral'
        ELSE '(none)'
      END as medium,
      COUNT(*) as sessions
    FROM session
    WHERE site_id = ${siteId}
      AND started_at >= ${start}
      AND started_at <= ${end}
    GROUP BY source, medium
    ORDER BY sessions DESC
  `;

  const total = sources.reduce((sum, s) => sum + Number(s.sessions), 0);

  return sources.map(s => ({
    source: s.source,
    medium: s.medium,
    sessions: Number(s.sessions),
    percentage: total > 0 ? Math.round((Number(s.sessions) / total) * 100) : 0
  }));
}

// ============================================
// Ubicación geográfica (usando geo_cache)
// ============================================

async function getLocationData(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  // Obtener países
  const countries = await prisma.$queryRaw`
    SELECT
      COALESCE(gc.country_code, 'XX') as country_code,
      COALESCE(gc.country_name, 'Desconocido') as country_name,
      COUNT(DISTINCT s.id) as sessions
    FROM session s
    LEFT JOIN geo_cache gc ON gc.ip_address = s.ip_address
    WHERE s.site_id = ${siteId}
      AND s.started_at >= ${start}
      AND s.started_at <= ${end}
    GROUP BY gc.country_code, gc.country_name
    ORDER BY sessions DESC
  `;

  // Obtener ciudades (top 20)
  const cities = await prisma.$queryRaw`
    SELECT
      COALESCE(gc.city, 'Desconocida') as city,
      COALESCE(gc.country_code, 'XX') as country_code,
      COUNT(DISTINCT s.id) as sessions
    FROM session s
    LEFT JOIN geo_cache gc ON gc.ip_address = s.ip_address
    WHERE s.site_id = ${siteId}
      AND s.started_at >= ${start}
      AND s.started_at <= ${end}
    GROUP BY gc.city, gc.country_code
    ORDER BY sessions DESC
    LIMIT 20
  `;

  const totalSessions = countries.reduce((sum, c) => sum + Number(c.sessions), 0);

  return {
    countries: countries.map(c => ({
      code: c.country_code,
      name: c.country_name,
      sessions: Number(c.sessions),
      percentage: totalSessions > 0 ? Math.round((Number(c.sessions) / totalSessions) * 100) : 0
    })),
    cities: cities.map(c => ({
      city: c.city,
      countryCode: c.country_code,
      sessions: Number(c.sessions)
    }))
  };
}

// ============================================
// Tiempo real detallado
// ============================================

async function getRealtimeDetailed(siteId, minutes = 30) {
  const since = new Date(Date.now() - minutes * 60 * 1000);

  // Visitantes activos (basado en sesiones con actividad reciente)
  const activeResult = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT visitor_id) as count
    FROM session
    WHERE site_id = ${siteId}
      AND (last_activity_at >= ${since} OR started_at >= ${since})
  `;
  const activeVisitors = Number(activeResult[0]?.count || 0);

  // Sesiones recientes (últimas 10)
  const recentSessions = await prisma.$queryRaw`
    SELECT
      s.id,
      s.started_at,
      s.browser,
      v.device_type,
      s.referrer
    FROM session s
    INNER JOIN visitor v ON v.id = s.visitor_id
    WHERE s.site_id = ${siteId}
      AND s.started_at >= ${since}
    ORDER BY s.started_at DESC
    LIMIT 10
  `;

  // Eventos recientes (últimos 20)
  const recentEvents = await prisma.$queryRaw`
    SELECT
      event_type,
      page_path,
      occurred_at
    FROM event
    WHERE site_id = ${siteId}
      AND occurred_at >= ${since}
    ORDER BY occurred_at DESC
    LIMIT 20
  `;

  // Páginas activas ahora
  const recentPages = await prisma.$queryRaw`
    SELECT
      page_path as path,
      COUNT(DISTINCT visitor_id) as visitors
    FROM event
    WHERE site_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${since}
      AND page_path IS NOT NULL
    GROUP BY page_path
    ORDER BY visitors DESC
    LIMIT 10
  `;

  // Distribución por dispositivo
  const byDevice = await prisma.$queryRaw`
    SELECT
      v.device_type as device,
      COUNT(DISTINCT e.visitor_id) as count
    FROM event e
    INNER JOIN visitor v ON v.id = e.visitor_id
    WHERE e.site_id = ${siteId}
      AND e.occurred_at >= ${since}
    GROUP BY v.device_type
  `;

  // Tendencia por minuto (últimos N minutos)
  const trend = await prisma.$queryRaw`
    SELECT
      date_trunc('minute', occurred_at) as minute,
      COUNT(DISTINCT visitor_id) as visitors
    FROM event
    WHERE site_id = ${siteId}
      AND occurred_at >= ${since}
    GROUP BY minute
    ORDER BY minute
  `;

  // Fuentes de tráfico en tiempo real
  const bySources = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN utm_source IS NOT NULL THEN utm_source
        ELSE 'Direct'
      END as source,
      CASE
        WHEN utm_medium IS NOT NULL THEN utm_medium
        ELSE '(none)'
      END as medium,
      COUNT(*) as sessions
    FROM session
    WHERE site_id = ${siteId}
      AND started_at >= ${since}
    GROUP BY source, medium
    ORDER BY sessions DESC
    LIMIT 10
  `;

  return {
    activeVisitors,
    recentSessions: recentSessions.map(s => ({
      id: Number(s.id),
      startedAt: s.started_at,
      browser: s.browser,
      deviceType: s.device_type,
      referrer: s.referrer
    })),
    recentEvents: recentEvents.map(e => ({
      type: e.event_type,
      page: e.page_path,
      occurredAt: e.occurred_at
    })),
    recentPages: recentPages.map(p => ({
      path: p.path,
      visitors: Number(p.visitors)
    })),
    byDevice: byDevice.reduce((acc, d) => {
      acc[d.device || 'unknown'] = Number(d.count);
      return acc;
    }, {}),
    trend: trend.map(t => ({
      minute: t.minute,
      visitors: Number(t.visitors)
    })),
    bySources: bySources.map(s => ({
      source: s.source,
      medium: s.medium,
      sessions: Number(s.sessions)
    }))
  };
}

// ============================================
// Heatmap: Trafico por dia y hora
// ============================================

async function getHeatmapData(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  // Obtener datos agrupados por dia de semana y hora
  const data = await prisma.$queryRaw`
    SELECT
      EXTRACT(DOW FROM occurred_at) as day_of_week,
      EXTRACT(HOUR FROM occurred_at) as hour,
      COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
      COUNT(DISTINCT visitor_id) as visitors
    FROM event
    WHERE site_id = ${siteId}
      AND occurred_at >= ${start}
      AND occurred_at <= ${end}
    GROUP BY day_of_week, hour
    ORDER BY day_of_week, hour
  `;

  // Crear matriz 7x24 (dias x horas)
  const heatmap = [];
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

  for (let day = 0; day < 7; day++) {
    const dayData = {
      day: day,
      dayName: dayNames[day],
      hours: []
    };

    for (let hour = 0; hour < 24; hour++) {
      const found = data.find(d => Number(d.day_of_week) === day && Number(d.hour) === hour);
      dayData.hours.push({
        hour: hour,
        pageviews: found ? Number(found.pageviews) : 0,
        visitors: found ? Number(found.visitors) : 0
      });
    }

    heatmap.push(dayData);
  }

  // Calcular el maximo para normalizar colores
  let maxPageviews = 0;
  let maxVisitors = 0;
  data.forEach(d => {
    if (Number(d.pageviews) > maxPageviews) maxPageviews = Number(d.pageviews);
    if (Number(d.visitors) > maxVisitors) maxVisitors = Number(d.visitors);
  });

  return {
    heatmap,
    maxPageviews,
    maxVisitors
  };
}

// ============================================
// Lista de países para filtro
// ============================================

async function getCountryList(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const countries = await prisma.$queryRaw`
    SELECT DISTINCT
      COALESCE(gc.country_code, 'XX') as code,
      COALESCE(gc.country_name, 'Desconocido') as name
    FROM session s
    LEFT JOIN geo_cache gc ON gc.ip_address = s.ip_address
    WHERE s.site_id = ${siteId}
      AND s.started_at >= ${start}
      AND s.started_at <= ${end}
      AND gc.country_code IS NOT NULL
    ORDER BY name
  `;

  return countries.map(c => ({
    code: c.code,
    name: c.name
  }));
}

// ============================================
// Comparacion de Periodos
// ============================================

async function getSummaryCompare(siteId, startDate, endDate, filters = {}) {
  // Calcular periodo anterior con la misma duracion
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);

  const [current, previous] = await Promise.all([
    getSummary(siteId, startDate, endDate, filters),
    getSummary(
      siteId,
      prevStart.toISOString().split('T')[0],
      prevEnd.toISOString().split('T')[0],
      filters
    )
  ]);

  return { current, previous };
}

// ============================================
// Metricas Avanzadas
// ============================================

async function getAdvancedMetrics(siteId, startDate, endDate, filters = {}) {
  const compare = await getSummaryCompare(siteId, startDate, endDate, filters);

  // Traffic Growth
  const trafficGrowth = compare.previous.pageviews > 0
    ? ((compare.current.pageviews - compare.previous.pageviews) / compare.previous.pageviews * 100)
    : 0;

  // Quality Score (0-100)
  const durationScore = Math.min(compare.current.avgSessionDuration / 180, 1) * 33;
  const pagesScore = Math.min(compare.current.avgPagesPerSession / 5, 1) * 33;
  const bounceScore = (1 - compare.current.bounceRate / 100) * 34;
  const qualityScore = Math.round(durationScore + pagesScore + bounceScore);

  return {
    trafficGrowth: Math.round(trafficGrowth * 10) / 10,
    qualityScore,
    current: compare.current,
    previous: compare.previous
  };
}

// ============================================
// Embudo de Conversion
// ============================================

async function getFunnelData(siteId, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  const [visitors, sessions, events] = await Promise.all([
    // Visitantes unicos
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT visitor_id) as count
      FROM event
      WHERE site_id = ${siteId}
        AND occurred_at >= ${start}
        AND occurred_at <= ${end}
    `,
    // Sesiones
    prisma.session.count({
      where: {
        site_id: siteId,
        started_at: { gte: start, lte: end }
      }
    }),
    // Eventos de formulario
    prisma.$queryRaw`
      SELECT
        event_type,
        COUNT(*) as count
      FROM event
      WHERE site_id = ${siteId}
        AND occurred_at >= ${start}
        AND occurred_at <= ${end}
        AND event_type IN ('form_start', 'form_submit')
      GROUP BY event_type
    `
  ]);

  const formStart = events.find(e => e.event_type === 'form_start');
  const formSubmit = events.find(e => e.event_type === 'form_submit');

  return {
    visitors: Number(visitors[0]?.count || 0),
    sessions: sessions,
    formStart: Number(formStart?.count || 0),
    formSubmit: Number(formSubmit?.count || 0)
  };
}

module.exports = {
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
  getSites,
  getTrafficSources,
  getLocationData,
  getRealtimeDetailed,
  getCountryList,
  getHeatmapData,
  getSummaryCompare,
  getAdvancedMetrics,
  getFunnelData
};
