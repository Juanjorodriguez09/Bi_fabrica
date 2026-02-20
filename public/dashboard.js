/**
 * MiComercio Analytics - Dashboard JavaScript
 * v4.0.0 PRO - Dark Mode, PDF/CSV Export, Alerts, Goals, Annotations
 */

(function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const API_BASE = '/api/v1/dashboard';
  const REALTIME_INTERVAL = 30000;
  const REALTIME_DETAILED_INTERVAL = 15000;

  // Dynamic colors that update with theme (MiComercio Brand)
  let COLORS = {
    primary: '#0077B6',
    secondary: '#FC3A54',
    navy: '#03045E',
    gray: '#6c757d',
    success: '#FC6E50',
    cyan: '#00B4D8',
    coral: '#FC6E50',
    chart: ['#0077B6', '#03045E', '#00B4D8', '#FC6E50', '#FC3A54', '#AC1C54', '#261C3C', '#0096C7']
  };

  const COLORS_DARK = {
    primary: '#38A3D6',
    secondary: '#FC5A6E',
    navy: '#8ECAE6',
    gray: '#A0A8B0',
    success: '#FC8E78',
    cyan: '#48D1E8',
    coral: '#FC8E78',
    chart: ['#38A3D6', '#8ECAE6', '#48D1E8', '#FC8E78', '#FC5A6E', '#D06090', '#9CA3AF', '#5CC4E0']
  };

  const SECTION_TITLES = {
    resumen: 'Resumen',
    realtime: 'Tiempo Real',
    sources: 'Fuentes de Trafico',
    utms: 'Campanas UTM',
    pages: 'Paginas',
    sections: 'Secciones Web',
    events: 'Eventos',
    clicks: 'Clicks',
    location: 'Ubicacion',
    devices: 'Dispositivos',
    browsers: 'Navegadores',
    conversiones: 'Conversiones',
    ecommerce: 'E-commerce',
    settings: 'Configuracion'
  };

  // ============================================
  // State
  // ============================================
  let state = {
    siteId: null,
    startDate: null,
    endDate: null,
    currentSection: 'resumen',
    charts: {},
    trendData: null,
    realtimeInterval: null,
    realtimeCountdown: 15,
    compareEnabled: false,
    compareData: null,
    theme: 'light',
    filters: {
      device: null,
      browser: null,
      country: null,
      source: null,
      utmCampaign: null
    },
    annotations: [],
    alerts: [],
    alertsConfig: {
      bounceEnabled: false,
      bounceThreshold: 60,
      visitorsEnabled: false,
      visitorsThreshold: 100,
      durationEnabled: false,
      durationThreshold: 30,
      trafficDropEnabled: false,
      trafficDropThreshold: 30
    },
    goals: {
      pageviews: null,
      sessions: null,
      visitors: null,
      bounce: null
    }
  };

  // Dashboard configuration (persisted in localStorage)
  let dashboardConfig = {
    sidebar: {
      collapsed: false
    },
    resumen: {
      showTrend: true,
      showEvents: true,
      showDevices: true,
      showBrowsers: true,
      showScroll: true,
      showPages: true,
      showClicks: true,
      showReferrers: true,
      showUtms: true,
      showHeatmap: true
    }
  };

  // ============================================
  // DOM Elements
  // ============================================
  const elements = {
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    btnCollapseSidebar: document.getElementById('btn-collapse-sidebar'),
    btnMenuMobile: document.getElementById('btn-menu-mobile'),
    headerTitle: document.getElementById('header-title'),
    mainContent: document.getElementById('main-content'),
    // Filters
    siteSelect: document.getElementById('site-select'),
    dateRange: document.getElementById('date-range'),
    customDates: document.getElementById('custom-dates'),
    startDate: document.getElementById('start-date'),
    endDate: document.getElementById('end-date'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnExport: document.getElementById('btn-export'),
    btnToggleFilters: document.getElementById('btn-toggle-filters'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    advancedFilters: document.getElementById('advanced-filters'),
    realtimeCount: document.getElementById('realtime-count'),
    realtimeNavBadge: document.getElementById('realtime-nav-badge'),
    // Advanced filters
    compareToggle: document.getElementById('compare-toggle'),
    filterDevice: document.getElementById('filter-device'),
    filterBrowser: document.getElementById('filter-browser'),
    filterCountry: document.getElementById('filter-country'),
    filterSource: document.getElementById('filter-source'),
    filterUtmCampaign: document.getElementById('filter-utm-campaign'),
    // Chart filters
    filterTrendMetric: document.getElementById('filter-trend-metric'),
    filterTrendType: document.getElementById('filter-trend-type'),
    filterEventsType: document.getElementById('filter-events-type'),
    filterDevicesType: document.getElementById('filter-devices-type'),
    filterBrowsersType: document.getElementById('filter-browsers-type'),
    filterScrollType: document.getElementById('filter-scroll-type'),
    filterSourcesType: document.getElementById('filter-sources-type'),
    // Table filters
    filterPagesLimit: document.getElementById('filter-pages-limit'),
    filterClicksLimit: document.getElementById('filter-clicks-limit'),
    filterReferrersLimit: document.getElementById('filter-referrers-limit'),
    filterUtmsLimit: document.getElementById('filter-utms-limit'),
    // Realtime
    realtimeMinutes: document.getElementById('realtime-minutes'),
    realtimeCountdown: document.getElementById('realtime-countdown'),
    realtimeCounterValue: document.getElementById('realtime-counter-value'),
    // Settings
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnResetSettings: document.getElementById('btn-reset-settings')
  };

  // Store data for re-rendering and export
  let chartData = {
    events: null,
    devices: null,
    browsers: null,
    scroll: null,
    sources: null,
    heatmap: null
  };

  let exportData = {
    summary: null,
    pages: null,
    clicks: null,
    referrers: null,
    utms: null,
    trend: null
  };

  // ============================================
  // Utilities
  // ============================================
  function formatNumber(num) {
    if (num == null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('es-ES');
  }

  function formatDuration(seconds) {
    if (seconds < 60) return seconds + 's';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + 'm ' + secs + 's';
  }

  function truncateText(text, maxLength = 30) {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return truncateText(url, 25);
    }
  }

  function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return seconds + 's';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return mins + 'm';
    const hours = Math.floor(mins / 60);
    return hours + 'h';
  }

  function getDateRange(range) {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start;

    switch (range) {
      case 'today':
        start = end;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = yesterday.toISOString().split('T')[0];
        break;
      case '7days':
        const week = new Date(today);
        week.setDate(week.getDate() - 7);
        start = week.toISOString().split('T')[0];
        break;
      case '30days':
        const month = new Date(today);
        month.setDate(month.getDate() - 30);
        start = month.toISOString().split('T')[0];
        break;
      case '90days':
        const quarter = new Date(today);
        quarter.setDate(quarter.getDate() - 90);
        start = quarter.toISOString().split('T')[0];
        break;
      case 'custom':
        start = elements.startDate.value;
        return { startDate: start, endDate: elements.endDate.value };
      default:
        const def = new Date(today);
        def.setDate(def.getDate() - 7);
        start = def.toISOString().split('T')[0];
    }

    return { startDate: start, endDate: end };
  }

  async function fetchAPI(endpoint, params = {}) {
    const url = new URL(API_BASE + endpoint, window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'API Error');
      return data.data;
    } catch (error) {
      console.error('API Error:', endpoint, error);
      throw error;
    }
  }

  function showLoading(id, show = true) {
    const el = document.getElementById('loading-' + id);
    if (el) el.style.display = show ? 'block' : 'none';
  }

  // ============================================
  // Sidebar Navigation
  // ============================================
  function initSidebar() {
    // Load saved state
    loadConfig();

    if (dashboardConfig.sidebar.collapsed) {
      elements.sidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
    }

    // Collapse toggle
    elements.btnCollapseSidebar?.addEventListener('click', toggleSidebar);

    // Mobile menu
    elements.btnMenuMobile?.addEventListener('click', () => {
      elements.sidebar.classList.toggle('mobile-open');
    });

    // Navigation links
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        navigateToSection(section);

        // Close mobile menu
        elements.sidebar.classList.remove('mobile-open');
      });
    });

    // Submenu toggles
    document.querySelectorAll('.nav-parent[data-toggle]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const submenuId = link.dataset.toggle;
        const navItem = link.closest('.nav-item');
        navItem.classList.toggle('open');
      });
    });

    // Add tooltips for collapsed state
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
      const text = link.querySelector('.nav-text');
      if (text) {
        link.setAttribute('data-tooltip', text.textContent);
      }
    });
  }

  function toggleSidebar() {
    const collapsed = elements.sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    dashboardConfig.sidebar.collapsed = collapsed;
    saveConfig();
  }

  function navigateToSection(section) {
    // Update active link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.section === section) {
        link.classList.add('active');
      }
    });

    // Expand parent submenu if needed
    const activeLink = document.querySelector(`.nav-link[data-section="${section}"]`);
    if (activeLink) {
      const parentSubmenu = activeLink.closest('.nav-submenu');
      if (parentSubmenu) {
        parentSubmenu.closest('.nav-item').classList.add('open');
      }
    }

    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => {
      s.style.display = 'none';
    });

    // Show target section
    const targetSection = document.getElementById('section-' + section);
    if (targetSection) {
      targetSection.style.display = 'block';
    }

    // Update header title
    if (elements.headerTitle) {
      elements.headerTitle.textContent = SECTION_TITLES[section] || section;
    }

    state.currentSection = section;

    // Load section-specific data
    loadSectionData(section);

    // Handle realtime interval
    if (section === 'realtime') {
      startRealtimeInterval();
    } else {
      stopRealtimeInterval();
    }
  }

  function loadSectionData(section) {
    switch (section) {
      case 'resumen':
        loadAllData();
        break;
      case 'realtime':
        loadRealtimeDetailed();
        break;
      case 'sources':
        loadSources();
        break;
      case 'utms':
        loadUtmsDetail();
        break;
      case 'pages':
        loadPagesDetail();
        break;
      case 'sections':
        loadSectionsReport();
        break;
      case 'events':
        loadEventsDetail();
        break;
      case 'clicks':
        loadClicksDetail();
        break;
      case 'location':
        loadLocation();
        break;
      case 'devices':
        loadDevicesDetail();
        break;
      case 'browsers':
        loadBrowsersDetail();
        break;
      case 'conversiones':
        loadConversiones();
        break;
      case 'ecommerce':
        loadEcommerce();
        break;
      case 'settings':
        loadSettingsUI();
        break;
    }
  }

  // ============================================
  // Configuration (localStorage)
  // ============================================
  function loadConfig() {
    try {
      const saved = localStorage.getItem('micomercio_dashboard_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        dashboardConfig = { ...dashboardConfig, ...parsed };
      }
    } catch (e) {
      console.log('Error loading config:', e);
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem('micomercio_dashboard_config', JSON.stringify(dashboardConfig));
    } catch (e) {
      console.log('Error saving config:', e);
    }
  }

  function loadSettingsUI() {
    // Set checkbox states from config
    const configMap = {
      'config-show-trend': 'showTrend',
      'config-show-events': 'showEvents',
      'config-show-devices': 'showDevices',
      'config-show-browsers': 'showBrowsers',
      'config-show-scroll': 'showScroll',
      'config-show-pages': 'showPages',
      'config-show-clicks': 'showClicks',
      'config-show-referrers': 'showReferrers',
      'config-show-utms': 'showUtms',
      'config-show-heatmap': 'showHeatmap'
    };

    Object.entries(configMap).forEach(([id, key]) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.checked = dashboardConfig.resumen[key] !== false;
      }
    });
  }

  function saveSettings() {
    const configMap = {
      'config-show-trend': 'showTrend',
      'config-show-events': 'showEvents',
      'config-show-devices': 'showDevices',
      'config-show-browsers': 'showBrowsers',
      'config-show-scroll': 'showScroll',
      'config-show-pages': 'showPages',
      'config-show-clicks': 'showClicks',
      'config-show-referrers': 'showReferrers',
      'config-show-utms': 'showUtms',
      'config-show-heatmap': 'showHeatmap'
    };

    Object.entries(configMap).forEach(([id, key]) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        dashboardConfig.resumen[key] = checkbox.checked;
      }
    });

    saveConfig();
    applyResumenConfig();
    alert('Configuracion guardada');
  }

  function resetSettings() {
    dashboardConfig.resumen = {
      showTrend: true,
      showEvents: true,
      showDevices: true,
      showBrowsers: true,
      showScroll: true,
      showPages: true,
      showClicks: true,
      showReferrers: true,
      showUtms: true,
      showHeatmap: true
    };
    saveConfig();
    loadSettingsUI();
    applyResumenConfig();
    alert('Configuracion restablecida');
  }

  function applyResumenConfig() {
    const sectionMap = {
      'trend': 'showTrend',
      'events-chart': 'showEvents',
      'devices-chart': 'showDevices',
      'browsers-chart': 'showBrowsers',
      'scroll-chart': 'showScroll',
      'pages-table': 'showPages',
      'clicks-table': 'showClicks',
      'referrers-table': 'showReferrers',
      'utms-table': 'showUtms',
      'heatmap-chart': 'showHeatmap'
    };

    Object.entries(sectionMap).forEach(([sectionId, configKey]) => {
      const card = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (card) {
        card.style.display = dashboardConfig.resumen[configKey] !== false ? '' : 'none';
      }
    });
  }

  // ============================================
  // Toggle Table for Charts
  // ============================================
  function initToggleTables() {
    document.querySelectorAll('.btn-toggle-table').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card collapse
        const chartId = btn.dataset.chart;
        const tableContainer = document.getElementById('table-chart-' + chartId);

        if (tableContainer) {
          const isVisible = tableContainer.style.display !== 'none';
          tableContainer.style.display = isVisible ? 'none' : 'block';
          btn.classList.toggle('active', !isVisible);

          // Populate table if showing
          if (!isVisible) {
            populateChartTable(chartId);
          }
        }
      });
    });
  }

  // ============================================
  // Collapsible Cards
  // ============================================
  function initCollapsibleCards() {
    document.querySelectorAll('.card.collapsible .card-header[data-collapse-toggle]').forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't collapse if clicking on action buttons or selects
        if (e.target.closest('.card-actions') || e.target.closest('.card-filters')) {
          return;
        }

        const card = header.closest('.card');
        card.classList.toggle('collapsed');

        // Save state to localStorage
        const sectionId = card.dataset.sectionId;
        if (sectionId) {
          saveCardCollapseState(sectionId, card.classList.contains('collapsed'));
        }
      });
    });

    // Restore saved states
    restoreCardCollapseStates();
  }

  function saveCardCollapseState(sectionId, collapsed) {
    try {
      const states = JSON.parse(localStorage.getItem('micomercio_card_states') || '{}');
      states[sectionId] = collapsed;
      localStorage.setItem('micomercio_card_states', JSON.stringify(states));
    } catch (e) {
      console.log('Error saving card state:', e);
    }
  }

  function restoreCardCollapseStates() {
    try {
      const states = JSON.parse(localStorage.getItem('micomercio_card_states') || '{}');
      Object.entries(states).forEach(([sectionId, collapsed]) => {
        if (collapsed) {
          const card = document.querySelector(`[data-section-id="${sectionId}"]`);
          if (card) {
            card.classList.add('collapsed');
          }
        }
      });
    } catch (e) {
      console.log('Error restoring card states:', e);
    }
  }

  function populateChartTable(chartId) {
    const tableContainer = document.getElementById('table-chart-' + chartId);
    if (!tableContainer) return;

    const tbody = tableContainer.querySelector('tbody');
    if (!tbody) return;

    let data = [];
    let rowRenderer = () => '';

    switch (chartId) {
      case 'trend':
        data = state.trendData || [];
        rowRenderer = row => `
          <td>${row.date}</td>
          <td class="num">${formatNumber(row.pageviews)}</td>
          <td class="num">${formatNumber(row.sessions)}</td>
          <td class="num">${formatNumber(row.visitors)}</td>
        `;
        break;

      case 'events':
        data = chartData.events || [];
        rowRenderer = row => `
          <td>${row.type}</td>
          <td class="num">${formatNumber(row.count)}</td>
        `;
        break;

      case 'devices':
        data = chartData.devices || [];
        rowRenderer = row => `
          <td>${row.label}</td>
          <td class="num">${formatNumber(row.value)}</td>
        `;
        break;

      case 'browsers':
        data = chartData.browsers || [];
        rowRenderer = row => `
          <td>${row.label}</td>
          <td class="num">${formatNumber(row.value)}</td>
        `;
        break;

      case 'scroll':
        data = chartData.scroll || [];
        rowRenderer = row => `
          <td>${row.depth}%</td>
          <td class="num">${formatNumber(row.visitors)}</td>
        `;
        break;

      case 'sources':
        data = chartData.sources || [];
        const total = data.reduce((sum, s) => sum + s.sessions, 0);
        rowRenderer = row => `
          <td>${row.source}</td>
          <td>${row.medium}</td>
          <td class="num">${formatNumber(row.sessions)}</td>
          <td class="num">${row.percentage}%</td>
        `;
        break;
    }

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><p>Sin datos</p></td></tr>';
    } else {
      tbody.innerHTML = data.map(row => `<tr>${rowRenderer(row)}</tr>`).join('');
    }
  }

  // ============================================
  // Data Loading
  // ============================================
  async function loadSites() {
    try {
      const sites = await fetchAPI('/sites');
      if (sites.length === 0) {
        elements.siteSelect.innerHTML = '<option value="">Sin sitios</option>';
        return;
      }
      elements.siteSelect.innerHTML = sites.map(site =>
        `<option value="${site.id}">${site.domain}</option>`
      ).join('');

      state.siteId = sites[0].id;
      loadAllData();
      loadFilterOptions();
    } catch (error) {
      elements.siteSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
  }

  async function loadFilterOptions() {
    const dates = getDateRange(elements.dateRange?.value || '7days');

    // Cargar opciones de navegadores
    try {
      const browsers = await fetchAPI('/browsers', {
        siteId: state.siteId,
        startDate: dates.startDate,
        endDate: dates.endDate
      });

      if (elements.filterBrowser && browsers.length > 0) {
        elements.filterBrowser.innerHTML = '<option value="">Todos</option>' +
          browsers.map(b => `<option value="${b.browser}">${b.browser}</option>`).join('');
      }
    } catch (e) {
      console.log('Error loading browser options:', e);
    }

    // Cargar opciones de países
    try {
      const countries = await fetchAPI('/countries', {
        siteId: state.siteId,
        startDate: dates.startDate,
        endDate: dates.endDate
      });

      if (elements.filterCountry && countries.length > 0) {
        elements.filterCountry.innerHTML = '<option value="">Todos</option>' +
          countries.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
      }
    } catch (e) {
      console.log('Error loading country options:', e);
    }

    // Cargar opciones de campanas UTM
    try {
      const utms = await fetchAPI('/utms', {
        siteId: state.siteId,
        startDate: dates.startDate,
        endDate: dates.endDate,
        limit: 20
      });

      if (elements.filterUtmCampaign && utms.length > 0) {
        const campaigns = [...new Set(utms.map(u => u.campaign).filter(c => c))];
        elements.filterUtmCampaign.innerHTML = '<option value="">Todas</option>' +
          campaigns.map(c => `<option value="${c}">${c}</option>`).join('');
      }
    } catch (e) {
      console.log('Error loading UTM options:', e);
    }
  }

  async function loadSummary() {
    try {
      const data = await fetchAPI('/summary', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        ...state.filters
      });

      exportData.summary = data;

      document.getElementById('metric-pageviews').textContent = formatNumber(data.pageviews);
      document.getElementById('metric-sessions').textContent = formatNumber(data.sessions);
      document.getElementById('metric-visitors').textContent = formatNumber(data.uniqueVisitors);
      document.getElementById('metric-bounce').textContent = data.bounceRate + '%';
      document.getElementById('metric-duration').textContent = formatDuration(data.avgSessionDuration);
      document.getElementById('metric-pages-session').textContent = data.avgPagesPerSession;
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }

  async function loadTrend() {
    showLoading('trend');
    try {
      const data = await fetchAPI('/trend/daily', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        ...state.filters
      });

      state.trendData = data;
      exportData.trend = data;
      const metric = elements.filterTrendMetric?.value || 'all';
      const chartType = elements.filterTrendType?.value || 'line';
      renderTrendChart(data, metric, chartType);
    } catch (error) {
      console.error('Error loading trend:', error);
    }
    showLoading('trend', false);
  }

  async function loadEvents() {
    showLoading('events');
    try {
      const data = await fetchAPI('/events', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      chartData.events = data;
      exportData.events = data;
      const chartType = elements.filterEventsType?.value || 'doughnut';
      renderEventsChart(data, chartType);
    } catch (error) {
      console.error('Error loading events:', error);
    }
    showLoading('events', false);
  }

  async function loadPages(limit) {
    showLoading('pages');
    try {
      const data = await fetchAPI('/pages', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        limit: limit || elements.filterPagesLimit?.value || 10,
        ...state.filters
      });

      exportData.pages = data;

      renderTable('table-pages', data, row => {
        const displayText = row.title || row.path || '-';
        return `
          <td title="${row.path}"><span class="text-truncate">${truncateText(displayText, 25)}</span></td>
          <td class="num">${formatNumber(row.views)}</td>
          <td class="num">${formatNumber(row.uniqueVisitors)}</td>
        `;
      });
    } catch (error) {
      console.error('Error loading pages:', error);
    }
    showLoading('pages', false);
  }

  async function loadClicks(limit) {
    showLoading('clicks');
    try {
      const data = await fetchAPI('/clicks', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        limit: limit || elements.filterClicksLimit?.value || 10
      });

      exportData.clicks = data;

      renderTable('table-clicks', data, row => {
        const displayText = row.elementText || row.elementId || 'Sin ID';
        return `
          <td title="${row.elementId || ''}"><span class="text-truncate">${truncateText(displayText, 25)}</span></td>
          <td class="num">${formatNumber(row.clicks)}</td>
        `;
      });
    } catch (error) {
      console.error('Error loading clicks:', error);
    }
    showLoading('clicks', false);
  }

  async function loadReferrers(limit) {
    showLoading('referrers');
    try {
      const data = await fetchAPI('/referrers', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        limit: limit || elements.filterReferrersLimit?.value || 10
      });

      exportData.referrers = data;

      renderTable('table-referrers', data, row => `
        <td title="${row.referrer}"><span class="text-truncate">${getHostname(row.referrer)}</span></td>
        <td class="num">${formatNumber(row.sessions)}</td>
      `);
    } catch (error) {
      console.error('Error loading referrers:', error);
    }
    showLoading('referrers', false);
  }

  async function loadUtms(limit) {
    showLoading('utms');
    try {
      const data = await fetchAPI('/utms', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        limit: limit || elements.filterUtmsLimit?.value || 5
      });

      exportData.utms = data;

      renderTable('table-utms', data, row => {
        const displayText = row.campaign ? `${row.source} / ${row.campaign}` : row.source;
        return `
          <td title="${displayText}"><span class="text-truncate">${truncateText(displayText, 20)}</span></td>
          <td class="num">${formatNumber(row.sessions)}</td>
        `;
      });
    } catch (error) {
      console.error('Error loading UTMs:', error);
    }
    showLoading('utms', false);
  }

  async function loadDevices() {
    showLoading('devices');
    try {
      const data = await fetchAPI('/devices', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      chartData.devices = data.map(d => ({
        label: d.device || 'Desconocido',
        value: d.sessions
      }));
      const chartType = elements.filterDevicesType?.value || 'pie';
      renderDistributionChart('chart-devices', 'devices', chartData.devices, chartType);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
    showLoading('devices', false);
  }

  async function loadBrowsers() {
    showLoading('browsers');
    try {
      const data = await fetchAPI('/browsers', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      chartData.browsers = data.map(b => ({
        label: b.browser || 'Desconocido',
        value: b.sessions
      }));
      const chartType = elements.filterBrowsersType?.value || 'doughnut';
      renderDistributionChart('chart-browsers', 'browsers', chartData.browsers, chartType);
    } catch (error) {
      console.error('Error loading browsers:', error);
    }
    showLoading('browsers', false);
  }

  async function loadScroll() {
    showLoading('scroll');
    try {
      const data = await fetchAPI('/scroll', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      chartData.scroll = data;
      const chartType = elements.filterScrollType?.value || 'bar';
      renderScrollChart(data, chartType);
    } catch (error) {
      console.error('Error loading scroll:', error);
    }
    showLoading('scroll', false);
  }

  async function loadHeatmap() {
    showLoading('heatmap');
    try {
      const data = await fetchAPI('/heatmap', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      chartData.heatmap = data;
      const metric = document.getElementById('filter-heatmap-metric')?.value || 'pageviews';
      renderHeatmap(data, metric);
    } catch (error) {
      console.error('Error loading heatmap:', error);
    }
    showLoading('heatmap', false);
  }

  function renderHeatmap(data, metric = 'pageviews') {
    const container = document.getElementById('heatmap-container');
    if (!container || !data || !data.heatmap) return;

    const maxValue = metric === 'pageviews' ? data.maxPageviews : data.maxVisitors;

    // Build HTML
    let html = '<div class="heatmap-grid">';

    // Header row with hours
    html += '<div class="heatmap-header">';
    for (let h = 0; h < 24; h++) {
      html += `<div class="heatmap-hour-label">${h}</div>`;
    }
    html += '</div>';

    // Data rows
    data.heatmap.forEach(day => {
      html += '<div class="heatmap-row-data">';
      html += `<div class="heatmap-day-label">${day.dayName}</div>`;
      html += '<div class="heatmap-cells">';

      day.hours.forEach(hourData => {
        const value = metric === 'pageviews' ? hourData.pageviews : hourData.visitors;
        const intensity = maxValue > 0 ? Math.round((value / maxValue) * 10) : 0;
        const tooltipText = `${day.dayName} ${hourData.hour}:00 - ${formatNumber(value)} ${metric === 'pageviews' ? 'pageviews' : 'visitantes'}`;

        html += `<div class="heatmap-cell" data-intensity="${intensity}" title="${tooltipText}">`;
        html += value > 0 ? (value > 999 ? Math.round(value / 1000) + 'k' : value) : '';
        html += `<span class="heatmap-tooltip">${tooltipText}</span>`;
        html += '</div>';
      });

      html += '</div></div>';
    });

    html += '</div>';

    // Legend
    html += '<div class="heatmap-legend">';
    html += '<span class="heatmap-legend-label">Menos</span>';
    html += '<div class="heatmap-legend-scale">';
    for (let i = 0; i <= 10; i++) {
      const colors = ['#DDDDDD', '#CAF0F8', '#90E0EF', '#48CAE4', '#00B4D8', '#0096C7', '#0077B6', '#005f92', '#03045E', '#FC6E50', '#FC3A54'];
      html += `<div class="heatmap-legend-item" style="background: ${colors[i]}"></div>`;
    }
    html += '</div>';
    html += '<span class="heatmap-legend-label">Mas</span>';
    html += '</div>';

    container.innerHTML = html;
  }

  async function loadRealtime() {
    if (!state.siteId) return;

    try {
      const data = await fetchAPI('/realtime', { siteId: state.siteId });
      const count = data.activeVisitors;

      if (elements.realtimeCount) {
        elements.realtimeCount.textContent = count;
      }
      if (elements.realtimeNavBadge) {
        elements.realtimeNavBadge.textContent = count;
      }
    } catch (error) {
      console.error('Error loading realtime:', error);
    }
  }

  // Section-specific loaders
  async function loadSources() {
    showLoading('sources');
    try {
      const data = await fetchAPI('/sources', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      chartData.sources = data;
      const chartType = elements.filterSourcesType?.value || 'pie';
      renderSourcesChart(data, chartType);

      // Render detail table
      renderTable('table-sources-detail', data, row => `
        <td>${row.source}</td>
        <td>${row.medium}</td>
        <td class="num">${formatNumber(row.sessions)}</td>
        <td class="num">${row.percentage}%</td>
      `);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
    showLoading('sources', false);
  }

  async function loadUtmsDetail() {
    showLoading('utms-detail');
    try {
      const limit = document.getElementById('filter-utms-detail-limit')?.value || 25;
      const data = await fetchAPI('/utms', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        limit
      });

      renderTable('table-utms-detail', data, row => `
        <td>${row.source || '-'}</td>
        <td>${row.medium || '-'}</td>
        <td>${row.campaign || '-'}</td>
        <td class="num">${formatNumber(row.sessions)}</td>
      `);
    } catch (error) {
      console.error('Error loading UTMs detail:', error);
    }
    showLoading('utms-detail', false);
  }

  async function loadPagesDetail() {
    showLoading('pages-detail');
    try {
      const limit = document.getElementById('filter-pages-detail-limit')?.value || 50;
      const data = await fetchAPI('/pages', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        limit,
        ...state.filters
      });

      renderTable('table-pages-detail', data, row => `
        <td title="${row.path}"><span class="text-truncate">${truncateText(row.path, 40)}</span></td>
        <td><span class="text-truncate">${truncateText(row.title, 30)}</span></td>
        <td class="num">${formatNumber(row.views)}</td>
        <td class="num">${formatNumber(row.uniqueVisitors)}</td>
      `);
    } catch (error) {
      console.error('Error loading pages detail:', error);
    }
    showLoading('pages-detail', false);
  }

  async function loadEventsDetail() {
    showLoading('events-detail');
    try {
      const data = await fetchAPI('/events', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      const total = data.reduce((sum, e) => sum + e.count, 0);

      // Render chart
      const chartType = document.getElementById('filter-events-detail-type')?.value || 'doughnut';
      renderEventsChart(data, chartType, 'chart-events-detail', 'eventsDetail');

      // Render table
      renderTable('table-events-detail', data, row => `
        <td>${row.type}</td>
        <td class="num">${formatNumber(row.count)}</td>
        <td class="num">${total > 0 ? Math.round((row.count / total) * 100) : 0}%</td>
      `);
    } catch (error) {
      console.error('Error loading events detail:', error);
    }
    showLoading('events-detail', false);
  }

  async function loadClicksDetail() {
    showLoading('clicks-detail');
    try {
      const limit = document.getElementById('filter-clicks-detail-limit')?.value || 50;
      const data = await fetchAPI('/clicks', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate,
        limit
      });

      renderTable('table-clicks-detail', data, row => `
        <td>${row.elementId || '-'}</td>
        <td><span class="text-truncate">${truncateText(row.elementText, 30)}</span></td>
        <td>${row.elementTag || '-'}</td>
        <td class="num">${formatNumber(row.clicks)}</td>
      `);
    } catch (error) {
      console.error('Error loading clicks detail:', error);
    }
    showLoading('clicks-detail', false);
  }

  // ============================================
  // Conversiones Section
  // ============================================
  async function loadConversiones() {
    showLoading('conversiones');
    showLoading('conversions-trend');
    try {
      const [data, trend] = await Promise.all([
        fetchAPI('/conversions', {
          siteId: state.siteId,
          startDate: state.startDate,
          endDate: state.endDate
        }),
        fetchAPI('/conversions/trend', {
          siteId: state.siteId,
          startDate: state.startDate,
          endDate: state.endDate
        })
      ]);

      // Summary cards
      document.getElementById('metric-form-submits').textContent = formatNumber(data.formSubmits);
      document.getElementById('metric-form-rate').textContent = data.formRate > 0 ? '(' + data.formRate + '% tasa)' : '';
      document.getElementById('metric-whatsapp-clicks').textContent = formatNumber(data.whatsappClicks);
      document.getElementById('metric-total-conversions').textContent = formatNumber(data.totalConversions);

      // Top forms table
      renderTable('table-conversions-forms', data.topForms, row => `
        <td>${row.formId || '-'}</td>
        <td class="num">${formatNumber(row.submits)}</td>
        <td class="num">${formatNumber(row.starts)}</td>
        <td class="num">${row.rate}%</td>
      `);

      // Top phones table
      renderTable('table-conversions-phones', data.topPhones, row => `
        <td>${row.phoneNumber || '-'}</td>
        <td class="num">${formatNumber(row.clicks)}</td>
      `);

      // Trend chart
      renderConversionsTrendChart(trend);
    } catch (error) {
      console.error('Error loading conversiones:', error);
    }
    showLoading('conversiones', false);
    showLoading('conversions-trend', false);
  }

  function renderConversionsTrendChart(data) {
    const ctx = document.getElementById('chart-conversions-trend');
    if (!ctx) return;

    if (state.charts.conversionsTrend) state.charts.conversionsTrend.destroy();

    const labels = data.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    });

    state.charts.conversionsTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Formularios',
            data: data.map(d => d.formSubmits),
            borderColor: COLORS.success,
            backgroundColor: COLORS.success + '20',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: COLORS.success
          },
          {
            label: 'WhatsApp',
            data: data.map(d => d.whatsappClicks),
            borderColor: '#25D366',
            backgroundColor: '#25D36620',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#25D366'
          },
          {
            label: 'Total',
            data: data.map(d => d.total),
            borderColor: COLORS.primary,
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          datalabels: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // ============================================
  // E-commerce Section
  // ============================================
  async function loadEcommerce() {
    showLoading('ecommerce');
    try {
      const [funnel, products] = await Promise.all([
        fetchAPI('/ecommerce/funnel', {
          siteId: state.siteId,
          startDate: state.startDate,
          endDate: state.endDate
        }),
        fetchAPI('/ecommerce/products', {
          siteId: state.siteId,
          startDate: state.startDate,
          endDate: state.endDate
        })
      ]);

      // Render funnel
      renderEcommerceFunnel(funnel);

      // Revenue cards
      document.getElementById('metric-revenue').textContent = '$' + formatNumber(Math.round(funnel.revenue));
      document.getElementById('metric-avg-ticket').textContent = '$' + formatNumber(funnel.avgTicket);

      // Products tables
      renderTable('table-products-viewed', products.mostViewed, row => `
        <td title="${row.productId}"><span class="text-truncate">${truncateText(row.productName, 35)}</span></td>
        <td class="num">${formatNumber(row.views)}</td>
      `);

      renderTable('table-products-added', products.mostAdded, row => `
        <td title="${row.productId}"><span class="text-truncate">${truncateText(row.productName, 35)}</span></td>
        <td class="num">${formatNumber(row.adds)}</td>
      `);
    } catch (error) {
      console.error('Error loading ecommerce:', error);
    }
    showLoading('ecommerce', false);
  }

  function renderEcommerceFunnel(data) {
    const container = document.getElementById('ecommerce-funnel');
    if (!container) return;

    const steps = [
      { label: 'Ver Producto', key: 'viewProduct', color: COLORS.primary },
      { label: 'Agregar al Carrito', key: 'addToCart', color: COLORS.navy },
      { label: 'Iniciar Checkout', key: 'beginCheckout', color: '#17a2b8' },
      { label: 'Compra', key: 'purchase', color: COLORS.success }
    ];

    const maxVal = Math.max(...steps.map(s => data[s.key]), 1);
    let html = '';

    steps.forEach((step, i) => {
      const count = data[step.key];
      const height = Math.max(Math.round((count / maxVal) * 80), 30);

      html += `
        <div class="funnel-step">
          <div class="funnel-step-bar" style="background: ${step.color}; height: ${height}px;">
            ${formatNumber(count)}
          </div>
          <span class="funnel-step-label">${step.label}</span>
        </div>
      `;

      if (i < steps.length - 1) {
        const nextCount = data[steps[i + 1].key];
        const dropPct = count > 0 ? Math.round((1 - nextCount / count) * 100) : 0;
        html += `
          <div class="funnel-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span class="funnel-drop">-${dropPct}%</span>
          </div>
        `;
      }
    });

    container.innerHTML = html;
  }

  async function loadLocation() {
    showLoading('countries');
    showLoading('cities');
    try {
      const data = await fetchAPI('/location', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      // Countries table
      renderTable('table-countries', data.countries, row => `
        <td>${row.name}</td>
        <td class="num">${formatNumber(row.visitors || row.sessions)}</td>
        <td class="num">${row.percentage}%</td>
      `);

      // Cities table (con region y country name)
      renderTable('table-cities', data.cities, row => `
        <td>${row.city}</td>
        <td>${row.region || '-'}</td>
        <td>${row.countryName || row.countryCode}</td>
        <td class="num">${formatNumber(row.visitors || row.sessions)}</td>
      `);
    } catch (error) {
      console.error('Error loading location:', error);
      renderTable('table-countries', [], () => '');
      renderTable('table-cities', [], () => '');
    }
    showLoading('countries', false);
    showLoading('cities', false);
  }

  // ============================================
  // Reporte de Secciones Web
  // ============================================

  async function loadSectionsReport() {
    showLoading('sections-report');
    try {
      const data = await fetchAPI('/sections', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      renderTable('table-sections-report', data, row => `
        <td>${row.pagePath}</td>
        <td class="num">${formatNumber(row.views)}</td>
        <td class="num">${formatNumber(row.uniqueVisitors)}</td>
        <td class="num">${row.percentage}%</td>
      `);
    } catch (error) {
      console.error('Error loading sections report:', error);
      renderTable('table-sections-report', [], () => '');
    }
    showLoading('sections-report', false);
  }

  async function loadDevicesDetail() {
    try {
      const data = await fetchAPI('/devices', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      const total = data.reduce((sum, d) => sum + d.sessions, 0);

      const chartType = document.getElementById('filter-devices-detail-type')?.value || 'pie';
      const chartData = data.map(d => ({
        label: d.device || 'Desconocido',
        value: d.sessions
      }));
      renderDistributionChart('chart-devices-detail', 'devicesDetail', chartData, chartType);

      renderTable('table-devices-detail', data, row => `
        <td>${row.device || 'Desconocido'}</td>
        <td class="num">${formatNumber(row.sessions)}</td>
        <td class="num">${total > 0 ? Math.round((row.sessions / total) * 100) : 0}%</td>
      `);
    } catch (error) {
      console.error('Error loading devices detail:', error);
    }
  }

  async function loadBrowsersDetail() {
    try {
      const data = await fetchAPI('/browsers', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      const total = data.reduce((sum, b) => sum + b.sessions, 0);

      const chartType = document.getElementById('filter-browsers-detail-type')?.value || 'doughnut';
      const chartDataArr = data.map(b => ({
        label: b.browser || 'Desconocido',
        value: b.sessions
      }));
      renderDistributionChart('chart-browsers-detail', 'browsersDetail', chartDataArr, chartType);

      renderTable('table-browsers-detail', data, row => `
        <td>${row.browser || 'Desconocido'}</td>
        <td class="num">${formatNumber(row.sessions)}</td>
        <td class="num">${total > 0 ? Math.round((row.sessions / total) * 100) : 0}%</td>
      `);
    } catch (error) {
      console.error('Error loading browsers detail:', error);
    }
  }

  // ============================================
  // Realtime Detailed
  // ============================================
  async function loadRealtimeDetailed() {
    if (!state.siteId) return;

    try {
      const minutes = elements.realtimeMinutes?.value || 30;
      const data = await fetchAPI('/realtime/detailed', {
        siteId: state.siteId,
        minutes
      });

      // Update counter
      if (elements.realtimeCounterValue) {
        elements.realtimeCounterValue.textContent = data.activeVisitors;
      }

      // Update trend chart
      renderRealtimeTrendChart(data.trend);

      // Update pages table
      renderTable('table-realtime-pages', data.recentPages, row => `
        <td><span class="text-truncate">${truncateText(row.path, 30)}</span></td>
        <td class="num">${row.visitors}</td>
      `);

      // Update events table
      renderTable('table-realtime-events', data.recentEvents, row => `
        <td>${row.type}</td>
        <td><span class="text-truncate">${truncateText(row.page, 25)}</span></td>
        <td class="num">${timeAgo(row.occurredAt)}</td>
      `);

      // Update device list
      const deviceList = document.getElementById('realtime-device-list');
      if (deviceList) {
        const devices = data.byDevice || {};
        deviceList.innerHTML = Object.entries(devices).map(([device, count]) => `
          <div class="realtime-device-item">
            <span class="realtime-device-name">${device || 'Desconocido'}</span>
            <span class="realtime-device-count">${count}</span>
          </div>
        `).join('') || '<p class="empty-state">Sin datos</p>';
      }

      // Update sources table
      renderTable('table-realtime-sources', data.bySources || [], row => `
        <td>${row.source}</td>
        <td>${row.medium}</td>
        <td class="num">${row.sessions}</td>
      `);

    } catch (error) {
      console.error('Error loading realtime detailed:', error);
    }
  }

  function startRealtimeInterval() {
    stopRealtimeInterval();

    state.realtimeCountdown = 15;
    updateCountdown();

    state.realtimeInterval = setInterval(() => {
      state.realtimeCountdown--;
      updateCountdown();

      if (state.realtimeCountdown <= 0) {
        state.realtimeCountdown = 15;
        loadRealtimeDetailed();
      }
    }, 1000);
  }

  function stopRealtimeInterval() {
    if (state.realtimeInterval) {
      clearInterval(state.realtimeInterval);
      state.realtimeInterval = null;
    }
  }

  function updateCountdown() {
    if (elements.realtimeCountdown) {
      elements.realtimeCountdown.textContent = state.realtimeCountdown;
    }
  }

  function renderRealtimeTrendChart(data) {
    const ctx = document.getElementById('chart-realtime-trend');
    if (!ctx) return;

    if (state.charts.realtimeTrend) state.charts.realtimeTrend.destroy();

    const labels = data.map(d => {
      const date = new Date(d.minute);
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    });

    state.charts.realtimeTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Visitantes',
          data: data.map(d => d.visitors),
          borderColor: COLORS.success,
          backgroundColor: COLORS.success + '30',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: COLORS.success
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ' Visitantes: ' + ctx.raw
            }
          },
          datalabels: {
            display: function(context) {
              const value = context.dataset.data[context.dataIndex];
              const max = Math.max(...context.dataset.data);
              return value > 0 && (value === max || context.dataIndex === context.dataset.data.length - 1);
            },
            color: COLORS.success,
            font: { weight: 'bold', size: 11 },
            anchor: 'end',
            align: 'top',
            offset: 4
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f0f0f0' },
            ticks: { stepSize: 1 }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  function getAdvancedFilters() {
    const filters = {};

    const device = elements.filterDevice?.value;
    const browser = elements.filterBrowser?.value;
    const country = elements.filterCountry?.value;
    const source = elements.filterSource?.value;
    const utmCampaign = elements.filterUtmCampaign?.value;

    if (device) filters.device = device;
    if (browser) filters.browser = browser;
    if (country) filters.country = country;
    if (source) filters.source = source;
    if (utmCampaign) filters.utmCampaign = utmCampaign;

    return filters;
  }

  // Populate country filter from API
  async function loadCountryFilter() {
    try {
      const countries = await fetchAPI('/countries', {
        siteId: state.siteId,
        startDate: state.startDate,
        endDate: state.endDate
      });

      if (elements.filterCountry && countries.length > 0) {
        elements.filterCountry.innerHTML = '<option value="">Todos</option>' +
          countries.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
      }
    } catch (e) {
      console.log('Error loading country filter:', e);
    }
  }

  function loadAllData() {
    const dates = getDateRange(elements.dateRange.value);
    state.startDate = dates.startDate;
    state.endDate = dates.endDate;

    state.filters = getAdvancedFilters();
    updateFiltersIndicator();

    elements.btnRefresh?.classList.add('loading');

    // Apply config visibility
    applyResumenConfig();

    Promise.all([
      loadSummary(),
      loadTrend(),
      loadEvents(),
      loadPages(),
      loadClicks(),
      loadReferrers(),
      loadUtms(),
      loadDevices(),
      loadBrowsers(),
      loadScroll(),
      loadHeatmap(),
      loadRealtime()
    ]).then(() => {
      // Update goals progress
      updateGoalsProgress();

      // Check alerts
      if (exportData.summary) {
        checkAlerts(exportData.summary, null);
      }
    }).finally(() => {
      elements.btnRefresh?.classList.remove('loading');
    });
  }

  // ============================================
  // Chart Rendering with Datalabels
  // ============================================

  // Common datalabels config for showing values
  function getDataLabelsConfig(showLabels = true, isBar = false, isPie = false, datasetIndex = 0) {
    if (!showLabels) {
      return { display: false };
    }

    if (isPie) {
      return {
        display: function(context) {
          const value = context.dataset.data[context.dataIndex];
          return value > 0;
        },
        color: '#fff',
        font: { weight: 'bold', size: 11 },
        anchor: 'center',
        align: 'center',
        formatter: function(value) {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
          if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
          return value;
        }
      };
    }

    if (isBar) {
      return {
        display: function(context) {
          const value = context.dataset.data[context.dataIndex];
          return value > 0;
        },
        color: '#fff',
        font: { weight: 'bold', size: 10 },
        anchor: 'center',
        align: 'center',
        formatter: function(value) {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
          if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
          return value;
        }
      };
    }

    // Line/Area charts: show labels only on first, last, and max points
    // Each dataset gets a fixed alignment direction so they never overlap
    const alignByIndex = [
      { primary: 'top'   },   // Pageviews: arriba
      { primary: 'right' },   // Sesiones: derecha
      { primary: 'left'  }    // Visitantes: izquierda
    ];

    const dsIdx = datasetIndex % 3;

    return {
      display: function(context) {
        const data = context.dataset.data;
        const idx = context.dataIndex;
        const value = data[idx];
        if (value == null || value <= 0) return false;

        const dataLen = data.length;
        const isFirst = idx === 0;
        const isLast = idx === dataLen - 1;
        const maxVal = Math.max(...data);
        const isMax = value === maxVal && data.indexOf(maxVal) === idx;

        return isFirst || isLast || isMax;
      },
      color: function(context) {
        return context.dataset.borderColor || COLORS.navy;
      },
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderColor: function(context) {
        return context.dataset.borderColor || COLORS.navy;
      },
      borderWidth: 1,
      borderRadius: 4,
      padding: { top: 3, bottom: 3, left: 5, right: 5 },
      font: { weight: 'bold', size: 11 },
      anchor: function(context) {
        // For the "top" dataset, anchor at start so label goes above
        // For "bottom", anchor at start so label goes below
        return 'center';
      },
      align: alignByIndex[dsIdx].primary,
      offset: 12,
      formatter: function(value) {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value;
      },
      clamp: true
    };
  }

  function renderTrendChart(data, metric = 'all', chartType = 'line') {
    const ctx = document.getElementById('chart-trend');
    if (!ctx) return;

    if (state.charts.trend) state.charts.trend.destroy();

    const labels = data.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
    });

    const datasets = [];
    const isArea = chartType === 'area';
    const isBar = chartType === 'bar';
    const showSingleMetric = metric !== 'all';

    if (metric === 'all' || metric === 'pageviews') {
      datasets.push({
        label: 'Pageviews',
        data: data.map(d => d.pageviews),
        borderColor: COLORS.primary,
        backgroundColor: isBar ? COLORS.primary : (isArea ? COLORS.primary + '40' : COLORS.primary + '10'),
        fill: isArea || metric === 'pageviews',
        tension: 0.4,
        borderWidth: isBar ? 0 : 3,
        pointRadius: isBar ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: COLORS.primary,
        borderRadius: isBar ? 6 : 0,
        datalabels: getDataLabelsConfig(true, isBar, false, 0)
      });

      // Add compare line if enabled
      if (state.compareEnabled && state.compareData?.previousTrend && !isBar) {
        datasets.push({
          label: 'Pageviews (Anterior)',
          data: state.compareData.previousTrend.map(d => d.pageviews),
          borderColor: COLORS.primary,
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          datalabels: { display: false }
        });
      }
    }

    if (metric === 'all' || metric === 'sessions') {
      datasets.push({
        label: 'Sesiones',
        data: data.map(d => d.sessions),
        borderColor: COLORS.navy,
        backgroundColor: isBar ? COLORS.navy : (isArea ? COLORS.navy + '40' : 'transparent'),
        fill: isArea || metric === 'sessions',
        tension: 0.4,
        borderWidth: isBar ? 0 : 3,
        pointRadius: isBar ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: COLORS.navy,
        borderRadius: isBar ? 6 : 0,
        datalabels: getDataLabelsConfig(true, isBar, false, 1)
      });
    }

    if (metric === 'all' || metric === 'visitors') {
      datasets.push({
        label: 'Visitantes',
        data: data.map(d => d.visitors),
        borderColor: COLORS.success,
        backgroundColor: isBar ? COLORS.success : (isArea ? COLORS.success + '40' : 'transparent'),
        fill: isArea || metric === 'visitors',
        tension: 0.4,
        borderWidth: isBar ? 0 : 3,
        pointRadius: isBar ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: COLORS.success,
        borderRadius: isBar ? 6 : 0,
        datalabels: getDataLabelsConfig(true, isBar, false, 2)
      });
    }

    // Prepare annotation lines for Chart.js
    const annotationLines = {};
    state.annotations.forEach((ann, idx) => {
      const dateIdx = data.findIndex(d => d.date === ann.date);
      if (dateIdx !== -1) {
        annotationLines[`line${idx}`] = {
          type: 'line',
          xMin: dateIdx,
          xMax: dateIdx,
          borderColor: ann.color,
          borderWidth: 2,
          borderDash: [4, 4],
          label: {
            display: true,
            content: ann.text.substring(0, 20),
            position: 'start',
            backgroundColor: ann.color,
            color: '#fff',
            font: { size: 10 }
          }
        };
      }
    });

    state.charts.trend = new Chart(ctx, {
      type: isBar ? 'bar' : 'line',
      data: { labels, datasets },
      plugins: [ChartDataLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        animation: { duration: 400 },
        interaction: { intersect: false, mode: 'index' },
        layout: {
          padding: {
            top: 30,
            bottom: 10,
            right: 20
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            align: 'center',
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 12, weight: '500' },
              boxWidth: 8,
              boxHeight: 8,
              filter: function(item) {
                // Hide compare datasets from legend
                return !item.text.includes('(Anterior)');
              }
            }
          },
          tooltip: {
            backgroundColor: COLORS.navy,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return ' ' + context.dataset.label + ': ' + formatNumber(context.raw);
              },
              afterBody: function(context) {
                // Show annotation if exists for this date
                const idx = context[0].dataIndex;
                const date = data[idx]?.date;
                const ann = state.annotations.find(a => a.date === date);
                if (ann) {
                  return ['\n📝 ' + ann.text];
                }
                return [];
              }
            }
          },
          datalabels: {} // Config per dataset
        },
        scales: {
          y: {
            beginAtZero: true,
            grace: '15%',
            grid: { color: state.theme === 'dark' ? '#3A4250' : '#f0f0f0', drawBorder: false },
            ticks: {
              font: { size: 11 },
              callback: function(value) { return formatNumber(value); }
            }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }

  function renderEventsChart(data, chartType = 'pie', canvasId = 'chart-events', chartKey = 'events') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (state.charts[chartKey]) state.charts[chartKey].destroy();

    const eventLabels = {
      'pageview': 'Pageviews',
      'click': 'Clicks',
      'scroll': 'Scroll',
      'form_start': 'Formularios',
      'form_submit': 'Envios',
      'time_on_page': 'Tiempo',
      'outbound_click': 'Links externos',
      'file_download': 'Descargas'
    };

    const labels = data.map(e => eventLabels[e.type] || e.type);
    const values = data.map(e => e.count);
    const isBar = chartType === 'bar';
    const isLine = chartType === 'line';
    const isPie = chartType === 'pie';

    const chartConfig = {
      type: isLine ? 'line' : (isBar ? 'bar' : 'pie'),
      data: {
        labels,
        datasets: [{
          label: 'Eventos',
          data: values,
          backgroundColor: isLine ? COLORS.primary + '30' : COLORS.chart.slice(0, data.length),
          borderColor: isLine ? COLORS.primary : COLORS.chart.slice(0, data.length),
          borderWidth: isLine ? 3 : 0,
          borderRadius: isBar ? 6 : 0,
          fill: isLine,
          tension: 0.4,
          pointRadius: isLine ? 5 : 0,
          pointBackgroundColor: COLORS.primary
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'x',
        animation: { duration: 300 },
        plugins: {
          legend: {
            display: isPie,
            position: 'right',
            labels: { padding: 10, usePointStyle: true, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + formatNumber(ctx.raw)
            }
          },
          datalabels: isPie ? {
            display: true,
            color: '#fff',
            font: { weight: 'bold', size: 11 },
            formatter: (value, ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return percentage > 5 ? percentage + '%' : '';
            }
          } : getDataLabelsConfig(true, isBar)
        },
        scales: (isBar || isLine) ? {
          y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { callback: v => formatNumber(v) } },
          x: { grid: { display: false } }
        } : {}
      }
    };

    state.charts[chartKey] = new Chart(ctx, chartConfig);
  }

  function renderDistributionChart(canvasId, chartKey, data, chartType = 'pie') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (state.charts[chartKey]) state.charts[chartKey].destroy();

    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);
    const isBar = chartType === 'bar';
    const isLine = chartType === 'line';
    const isPie = chartType === 'pie';

    state.charts[chartKey] = new Chart(ctx, {
      type: isLine ? 'line' : (isBar ? 'bar' : 'pie'),
      data: {
        labels,
        datasets: [{
          label: 'Sesiones',
          data: values,
          backgroundColor: isLine ? COLORS.primary + '30' : COLORS.chart.slice(0, data.length),
          borderColor: isLine ? COLORS.primary : COLORS.chart.slice(0, data.length),
          borderWidth: isLine ? 3 : 0,
          borderRadius: isBar ? 6 : 0,
          fill: isLine,
          tension: 0.4,
          pointRadius: isLine ? 5 : 0,
          pointBackgroundColor: COLORS.primary
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'x',
        animation: { duration: 300 },
        plugins: {
          legend: {
            display: isPie,
            position: 'bottom',
            labels: { boxWidth: 12, padding: 8, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + (isPie ? ctx.label + ': ' : '') + formatNumber(ctx.raw)
            }
          },
          datalabels: isPie ? {
            display: true,
            color: '#fff',
            font: { weight: 'bold', size: 11 },
            formatter: (value, ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return percentage > 5 ? percentage + '%' : '';
            }
          } : getDataLabelsConfig(true, isBar)
        },
        scales: (isBar || isLine) ? {
          y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { callback: v => formatNumber(v) } },
          x: { grid: { display: false } }
        } : {}
      }
    });
  }

  function renderScrollChart(data, chartType = 'bar') {
    const ctx = document.getElementById('chart-scroll');
    if (!ctx) return;

    if (state.charts.scroll) state.charts.scroll.destroy();

    const isLine = chartType === 'line';

    state.charts.scroll = new Chart(ctx, {
      type: chartType,
      data: {
        labels: data.map(s => s.depth + '%'),
        datasets: [{
          label: 'Visitantes',
          data: data.map(s => s.visitors),
          backgroundColor: isLine ? COLORS.primary + '30' : COLORS.primary,
          borderColor: COLORS.primary,
          borderWidth: isLine ? 3 : 0,
          borderRadius: isLine ? 0 : 6,
          fill: isLine,
          tension: 0.4,
          pointRadius: isLine ? 4 : 0,
          pointBackgroundColor: COLORS.primary
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ' Visitantes: ' + formatNumber(ctx.raw)
            }
          },
          datalabels: {
            display: function(context) {
              const value = context.dataset.data[context.dataIndex];
              return value > 0;
            },
            color: isLine ? COLORS.primary : '#fff',
            font: { weight: 'bold', size: 10 },
            anchor: isLine ? 'end' : 'center',
            align: isLine ? 'top' : 'center',
            formatter: (value) => {
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value;
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { callback: v => formatNumber(v) } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderSourcesChart(data, chartType = 'pie') {
    const ctx = document.getElementById('chart-sources');
    if (!ctx) return;

    if (state.charts.sources) state.charts.sources.destroy();

    const labels = data.map(s => s.source);
    const values = data.map(s => s.sessions);
    const isBar = chartType === 'bar';
    const isLine = chartType === 'line';
    const isPie = chartType === 'pie';

    state.charts.sources = new Chart(ctx, {
      type: isLine ? 'line' : (isBar ? 'bar' : 'pie'),
      data: {
        labels,
        datasets: [{
          label: 'Sesiones',
          data: values,
          backgroundColor: isLine ? COLORS.primary + '30' : COLORS.chart.slice(0, data.length),
          borderColor: isLine ? COLORS.primary : COLORS.chart.slice(0, data.length),
          borderWidth: isLine ? 3 : 0,
          borderRadius: isBar ? 6 : 0,
          fill: isLine,
          tension: 0.4,
          pointRadius: isLine ? 5 : 0,
          pointBackgroundColor: COLORS.primary
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'x',
        animation: { duration: 300 },
        plugins: {
          legend: {
            display: isPie,
            position: 'right',
            labels: { padding: 10, usePointStyle: true, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + formatNumber(ctx.raw)
            }
          },
          datalabels: isPie ? {
            display: true,
            color: '#fff',
            font: { weight: 'bold', size: 11 },
            formatter: (value, ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return percentage > 5 ? percentage + '%' : '';
            }
          } : getDataLabelsConfig(true, isBar)
        },
        scales: (isBar || isLine) ? {
          y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { callback: v => formatNumber(v) } },
          x: { grid: { display: false } }
        } : {}
      }
    });
  }

  function renderTable(tableId, data, rowRenderer) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><p>Sin datos para este periodo</p></td></tr>';
      return;
    }

    tbody.innerHTML = data.map(row => `<tr>${rowRenderer(row)}</tr>`).join('');
  }

  // ============================================
  // Event Handlers
  // ============================================
  function setupEventListeners() {
    // Global filters
    elements.siteSelect?.addEventListener('change', (e) => {
      state.siteId = parseInt(e.target.value);
      if (state.siteId) {
        loadFilterOptions();
        loadSectionData(state.currentSection);
      }
    });

    elements.dateRange?.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        elements.customDates.style.display = 'flex';
        const today = new Date().toISOString().split('T')[0];
        elements.endDate.value = today;
        const week = new Date();
        week.setDate(week.getDate() - 7);
        elements.startDate.value = week.toISOString().split('T')[0];
      } else {
        elements.customDates.style.display = 'none';
        loadSectionData(state.currentSection);
      }
    });

    elements.startDate?.addEventListener('change', () => loadSectionData(state.currentSection));
    elements.endDate?.addEventListener('change', () => loadSectionData(state.currentSection));
    elements.btnRefresh?.addEventListener('click', () => loadSectionData(state.currentSection));

    // Section filters - Trend chart
    function updateTrendChart() {
      if (state.trendData) {
        const metric = elements.filterTrendMetric?.value || 'all';
        const chartType = elements.filterTrendType?.value || 'line';
        renderTrendChart(state.trendData, metric, chartType);
      }
    }

    elements.filterTrendMetric?.addEventListener('change', updateTrendChart);
    elements.filterTrendType?.addEventListener('change', updateTrendChart);

    elements.filterPagesLimit?.addEventListener('change', (e) => loadPages(parseInt(e.target.value)));
    elements.filterClicksLimit?.addEventListener('change', (e) => loadClicks(parseInt(e.target.value)));
    elements.filterReferrersLimit?.addEventListener('change', (e) => loadReferrers(parseInt(e.target.value)));
    elements.filterUtmsLimit?.addEventListener('change', (e) => loadUtms(parseInt(e.target.value)));

    // Chart type filters
    elements.filterEventsType?.addEventListener('change', (e) => {
      if (chartData.events) renderEventsChart(chartData.events, e.target.value);
    });

    elements.filterDevicesType?.addEventListener('change', (e) => {
      if (chartData.devices) renderDistributionChart('chart-devices', 'devices', chartData.devices, e.target.value);
    });

    elements.filterBrowsersType?.addEventListener('change', (e) => {
      if (chartData.browsers) renderDistributionChart('chart-browsers', 'browsers', chartData.browsers, e.target.value);
    });

    elements.filterScrollType?.addEventListener('change', (e) => {
      if (chartData.scroll) renderScrollChart(chartData.scroll, e.target.value);
    });

    elements.filterSourcesType?.addEventListener('change', (e) => {
      if (chartData.sources) renderSourcesChart(chartData.sources, e.target.value);
    });

    // Heatmap metric filter
    document.getElementById('filter-heatmap-metric')?.addEventListener('change', (e) => {
      if (chartData.heatmap) renderHeatmap(chartData.heatmap, e.target.value);
    });

    // Advanced filters
    elements.filterDevice?.addEventListener('change', () => loadSectionData(state.currentSection));
    elements.filterBrowser?.addEventListener('change', () => loadSectionData(state.currentSection));
    elements.filterCountry?.addEventListener('change', () => loadSectionData(state.currentSection));
    elements.filterSource?.addEventListener('change', () => loadSectionData(state.currentSection));
    elements.filterUtmCampaign?.addEventListener('change', () => loadSectionData(state.currentSection));

    // Realtime minutes filter
    elements.realtimeMinutes?.addEventListener('change', loadRealtimeDetailed);

    // Detail section filters
    document.getElementById('filter-utms-detail-limit')?.addEventListener('change', loadUtmsDetail);
    document.getElementById('filter-pages-detail-limit')?.addEventListener('change', loadPagesDetail);
    document.getElementById('filter-clicks-detail-limit')?.addEventListener('change', loadClicksDetail);
    document.getElementById('filter-events-detail-type')?.addEventListener('change', loadEventsDetail);
    document.getElementById('filter-devices-detail-type')?.addEventListener('change', loadDevicesDetail);
    document.getElementById('filter-browsers-detail-type')?.addEventListener('change', loadBrowsersDetail);

    // Settings
    elements.btnSaveSettings?.addEventListener('click', saveSettings);
    elements.btnResetSettings?.addEventListener('click', resetSettings);
  }

  // ============================================
  // Export Functions
  // ============================================
  function exportToExcel() {
    const siteName = elements.siteSelect.options[elements.siteSelect.selectedIndex]?.text || 'site';
    const dateStr = `${state.startDate}_${state.endDate}`;
    const filename = `MiComercio_Analytics_${siteName}_${dateStr}.xls`;

    const styles = `
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        .header { background: #03045E; color: white; font-size: 18px; font-weight: bold; padding: 15px; }
        .subheader { background: #0077B6; color: white; font-size: 14px; padding: 10px; }
        .info { background: #F8F9FA; padding: 8px; font-size: 12px; }
        .section-title { background: #03045E; color: white; font-size: 14px; font-weight: bold; padding: 10px; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 25px; }
        th { background: #0077B6; color: white; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #ddd; }
        td { padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .num { text-align: right; }
        .metric-value { font-size: 24px; font-weight: bold; color: #03045E; }
        .metric-label { color: #6c757d; font-size: 11px; }
        .summary-table td { border: none; padding: 5px 15px; }
        .summary-table { background: #F8F9FA; }
      </style>
    `;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Analytics</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        ${styles}
      </head>
      <body>
    `;

    html += `
      <div class="header">MICOMERCIO ANALYTICS - REPORTE</div>
      <table class="info-table">
        <tr class="info"><td><strong>Sitio:</strong> ${siteName}</td></tr>
        <tr class="info"><td><strong>Periodo:</strong> ${state.startDate} a ${state.endDate}</td></tr>
        <tr class="info"><td><strong>Generado:</strong> ${new Date().toLocaleString('es-ES')}</td></tr>
      </table>
      <br>
    `;

    if (exportData.summary) {
      html += `
        <div class="section-title">RESUMEN GENERAL</div>
        <table class="summary-table">
          <tr>
            <td><span class="metric-value">${formatNumber(exportData.summary.pageviews)}</span><br><span class="metric-label">PAGEVIEWS</span></td>
            <td><span class="metric-value">${formatNumber(exportData.summary.sessions)}</span><br><span class="metric-label">SESIONES</span></td>
            <td><span class="metric-value">${formatNumber(exportData.summary.uniqueVisitors)}</span><br><span class="metric-label">VISITANTES</span></td>
            <td><span class="metric-value">${exportData.summary.bounceRate}%</span><br><span class="metric-label">REBOTE</span></td>
            <td><span class="metric-value">${formatDuration(exportData.summary.avgSessionDuration)}</span><br><span class="metric-label">DURACION</span></td>
            <td><span class="metric-value">${exportData.summary.avgPagesPerSession}</span><br><span class="metric-label">PAGS/SESION</span></td>
          </tr>
        </table>
      `;
    }

    if (exportData.trend && exportData.trend.length > 0) {
      html += `
        <div class="section-title">TENDENCIA DIARIA</div>
        <table>
          <tr><th>Fecha</th><th class="num">Pageviews</th><th class="num">Sesiones</th><th class="num">Visitantes</th></tr>
      `;
      exportData.trend.forEach(row => {
        html += `<tr><td>${row.date}</td><td class="num">${row.pageviews}</td><td class="num">${row.sessions}</td><td class="num">${row.visitors}</td></tr>`;
      });
      html += '</table>';
    }

    if (exportData.pages && exportData.pages.length > 0) {
      html += `
        <div class="section-title">TOP PAGINAS</div>
        <table>
          <tr><th>Pagina</th><th>Titulo</th><th class="num">Vistas</th><th class="num">Visitantes</th></tr>
      `;
      exportData.pages.forEach(row => {
        html += `<tr><td>${row.path || ''}</td><td>${row.title || ''}</td><td class="num">${row.views}</td><td class="num">${row.uniqueVisitors}</td></tr>`;
      });
      html += '</table>';
    }

    if (exportData.clicks && exportData.clicks.length > 0) {
      html += `
        <div class="section-title">TOP CLICKS</div>
        <table>
          <tr><th>Elemento ID</th><th>Texto</th><th>Tag</th><th class="num">Clicks</th></tr>
      `;
      exportData.clicks.forEach(row => {
        html += `<tr><td>${row.elementId || ''}</td><td>${row.elementText || ''}</td><td>${row.elementTag || ''}</td><td class="num">${row.clicks}</td></tr>`;
      });
      html += '</table>';
    }

    if (exportData.referrers && exportData.referrers.length > 0) {
      html += `
        <div class="section-title">FUENTES DE TRAFICO</div>
        <table>
          <tr><th>Referrer</th><th class="num">Sesiones</th></tr>
      `;
      exportData.referrers.forEach(row => {
        html += `<tr><td>${row.referrer}</td><td class="num">${row.sessions}</td></tr>`;
      });
      html += '</table>';
    }

    if (exportData.utms && exportData.utms.length > 0) {
      html += `
        <div class="section-title">CAMPANAS UTM</div>
        <table>
          <tr><th>Source</th><th>Medium</th><th>Campaign</th><th class="num">Sesiones</th></tr>
      `;
      exportData.utms.forEach(row => {
        html += `<tr><td>${row.source || ''}</td><td>${row.medium || ''}</td><td>${row.campaign || ''}</td><td class="num">${row.sessions}</td></tr>`;
      });
      html += '</table>';
    }

    html += '</body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function toggleAdvancedFilters() {
    const isVisible = elements.advancedFilters.style.display !== 'none';
    elements.advancedFilters.style.display = isVisible ? 'none' : 'flex';
    elements.btnToggleFilters?.classList.toggle('active', !isVisible);
  }

  function clearAdvancedFilters() {
    if (elements.filterDevice) elements.filterDevice.value = '';
    if (elements.filterBrowser) elements.filterBrowser.value = '';
    if (elements.filterCountry) elements.filterCountry.value = '';
    if (elements.filterSource) elements.filterSource.value = '';
    if (elements.filterUtmCampaign) elements.filterUtmCampaign.value = '';

    state.filters = {
      device: null,
      browser: null,
      country: null,
      source: null,
      utmCampaign: null
    };

    updateFiltersIndicator();
    loadSectionData(state.currentSection);
  }

  function updateFiltersIndicator() {
    const hasActiveFilters = Object.values(state.filters).some(v => v);
    if (elements.btnToggleFilters) {
      const span = elements.btnToggleFilters.querySelector('span');
      if (hasActiveFilters) {
        elements.btnToggleFilters.classList.add('active');
        if (span) span.textContent = 'Filtros activos';
      } else {
        if (span) span.textContent = 'Filtros';
      }
    }
  }

  // ============================================
  // Dark Mode
  // ============================================
  function initTheme() {
    const savedTheme = localStorage.getItem('micomercio_theme') || 'light';
    setTheme(savedTheme);

    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
    });
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('micomercio_theme', theme);

    // Update colors
    COLORS = theme === 'dark' ? { ...COLORS_DARK } : {
      primary: '#0077B6',
      secondary: '#FC3A54',
      navy: '#03045E',
      gray: '#6c757d',
      success: '#FC6E50',
      cyan: '#00B4D8',
      coral: '#FC6E50',
      chart: ['#0077B6', '#03045E', '#00B4D8', '#FC6E50', '#FC3A54', '#AC1C54', '#261C3C', '#0096C7']
    };

    // Update theme toggle icons
    const iconSun = document.querySelector('.icon-sun');
    const iconMoon = document.querySelector('.icon-moon');
    if (iconSun && iconMoon) {
      iconSun.style.display = theme === 'dark' ? 'none' : 'block';
      iconMoon.style.display = theme === 'dark' ? 'block' : 'none';
    }

    // Re-render charts with new colors
    if (state.trendData) {
      const metric = elements.filterTrendMetric?.value || 'all';
      const chartType = elements.filterTrendType?.value || 'line';
      renderTrendChart(state.trendData, metric, chartType);
    }
  }

  // ============================================
  // Export Functions (PDF, CSV, Excel)
  // ============================================
  function initExportDropdown() {
    const btnExport = document.getElementById('btn-export');
    const dropdown = document.getElementById('export-dropdown');

    btnExport?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
      if (dropdown) dropdown.style.display = 'none';
    });

    document.querySelectorAll('.export-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        if (format === 'excel') exportToExcel();
        else if (format === 'csv') exportToCSV();
        else if (format === 'pdf') exportToPDF();
        dropdown.style.display = 'none';
      });
    });
  }

  function exportToCSV() {
    const siteName = elements.siteSelect.options[elements.siteSelect.selectedIndex]?.text || 'site';
    const dateStr = `${state.startDate}_${state.endDate}`;
    const filename = `MiComercio_Analytics_${siteName}_${dateStr}.csv`;

    // BOM for Excel UTF-8 compatibility
    let csv = '\uFEFF';

    // Header
    csv += `MICOMERCIO ANALYTICS - REPORTE\n`;
    csv += `Sitio:,${siteName}\n`;
    csv += `Periodo:,${state.startDate} a ${state.endDate}\n`;
    csv += `Generado:,${new Date().toLocaleString('es-ES')}\n`;
    csv += `\n`;

    // Summary
    if (exportData.summary) {
      csv += `=== RESUMEN GENERAL ===\n`;
      csv += `Metrica,Valor\n`;
      csv += `Pageviews,${exportData.summary.pageviews}\n`;
      csv += `Sesiones,${exportData.summary.sessions}\n`;
      csv += `Visitantes Unicos,${exportData.summary.uniqueVisitors}\n`;
      csv += `Visitantes Nuevos,${exportData.summary.newVisitors || 0}\n`;
      csv += `Visitantes Recurrentes,${exportData.summary.returningVisitors || 0}\n`;
      csv += `Tasa de Rebote,${exportData.summary.bounceRate}%\n`;
      csv += `Duracion Promedio,"${formatDuration(exportData.summary.avgSessionDuration)}"\n`;
      csv += `Paginas por Sesion,${exportData.summary.avgPagesPerSession}\n`;
      csv += `\n`;
    }

    // Daily trend
    if (exportData.trend && exportData.trend.length > 0) {
      csv += `=== TENDENCIA DIARIA ===\n`;
      csv += `Fecha,Pageviews,Sesiones,Visitantes\n`;
      exportData.trend.forEach(row => {
        csv += `${row.date},${row.pageviews},${row.sessions},${row.visitors}\n`;
      });
      csv += `\n`;
    }

    // Top pages
    if (exportData.pages && exportData.pages.length > 0) {
      csv += `=== TOP PAGINAS ===\n`;
      csv += `Pagina,Titulo,Vistas,Visitantes Unicos\n`;
      exportData.pages.forEach(row => {
        csv += `"${(row.path || '').replace(/"/g, '""')}","${(row.title || '').replace(/"/g, '""')}",${row.views},${row.uniqueVisitors}\n`;
      });
      csv += `\n`;
    }

    // Top clicks
    if (exportData.clicks && exportData.clicks.length > 0) {
      csv += `=== TOP CLICKS ===\n`;
      csv += `Identificador,Texto,Elemento,Clicks\n`;
      exportData.clicks.forEach(row => {
        csv += `"${(row.elementId || '').replace(/"/g, '""')}","${(row.elementText || '').replace(/"/g, '""')}",${row.elementTag || ''},${row.clicks}\n`;
      });
      csv += `\n`;
    }

    // Traffic sources
    if (exportData.referrers && exportData.referrers.length > 0) {
      csv += `=== FUENTES DE TRAFICO ===\n`;
      csv += `Referrer,Sesiones\n`;
      exportData.referrers.forEach(row => {
        csv += `"${(row.referrer || '').replace(/"/g, '""')}",${row.sessions}\n`;
      });
      csv += `\n`;
    }

    // UTM campaigns
    if (exportData.utms && exportData.utms.length > 0) {
      csv += `=== CAMPANAS UTM ===\n`;
      csv += `Source,Medium,Campaign,Sesiones\n`;
      exportData.utms.forEach(row => {
        csv += `"${row.source || ''}","${row.medium || ''}","${row.campaign || ''}",${row.sessions}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Helper: capture charts and their related tables from cards inside a section
  async function captureSectionContent(container) {
    let html = '';
    const cards = container.querySelectorAll('.card');

    for (const card of cards) {
      if (card.offsetParent === null) continue;

      // Get card title
      const titleEl = card.querySelector('.card-header h3');
      const title = titleEl ? titleEl.textContent.trim() : '';

      // Capture chart canvas (only the canvas itself, clean)
      const canvas = card.querySelector('canvas');
      if (canvas && canvas.width > 0 && canvas.offsetParent !== null) {
        if (title) html += `<div class="pdf-section-title">${title}</div>`;
        try {
          // Capture only the canvas, not the parent with buttons/filters
          const imgData = canvas.toDataURL('image/png');
          html += `<img class="pdf-chart-img" src="${imgData}" alt="${title}">`;
        } catch (e) { /* skip */ }
      }

      // Capture tables with data
      const tables = card.querySelectorAll('table.data-table');
      tables.forEach(table => {
        const tbody = table.querySelector('tbody');
        if (!tbody || tbody.children.length === 0) return;

        // Only add title if we didn't already add it for a chart above
        if (!canvas && title) {
          html += `<div class="pdf-section-title">${title}</div>`;
        }

        // Clone the table content (thead + tbody) cleanly
        html += `<table>`;
        const thead = table.querySelector('thead');
        if (thead) html += `<thead>${thead.innerHTML}</thead>`;
        html += `<tbody>${tbody.innerHTML}</tbody>`;
        html += `</table>`;
      });
    }

    return html;
  }

  async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF || !window.html2canvas) {
      alert('Error: Librerias PDF no cargadas');
      return;
    }

    const siteName = elements.siteSelect.options[elements.siteSelect.selectedIndex]?.text || 'site';
    const dateStr = `${state.startDate}_${state.endDate}`;
    const generatedAt = new Date().toLocaleString('es-ES');
    const currentSection = state.currentSection || 'resumen';
    const sectionTitle = SECTION_TITLES[currentSection] || 'Resumen';

    // Build preview HTML
    let previewHtml = `<div class="pdf-page" id="pdf-render-page">`;

    // Header
    previewHtml += `
      <div class="pdf-header">
        <h1 class="pdf-title">MiComercio Analytics</h1>
        <div class="pdf-subtitle">
          Sitio: <strong>${siteName}</strong><br>
          Seccion: <strong>${sectionTitle}</strong><br>
          Periodo: ${state.startDate} a ${state.endDate}<br>
          Generado: ${generatedAt}
        </div>
      </div>
    `;

    // Summary metrics (always show if available)
    if (exportData.summary) {
      const s = exportData.summary;
      previewHtml += `
        <div class="pdf-section-title">Resumen General</div>
        <div class="pdf-metrics">
          <div class="pdf-metric-card">
            <span class="pdf-metric-value">${formatNumber(s.pageviews)}</span>
            <span class="pdf-metric-label">Pageviews</span>
          </div>
          <div class="pdf-metric-card">
            <span class="pdf-metric-value">${formatNumber(s.sessions)}</span>
            <span class="pdf-metric-label">Sesiones</span>
          </div>
          <div class="pdf-metric-card">
            <span class="pdf-metric-value">${formatNumber(s.uniqueVisitors)}</span>
            <span class="pdf-metric-label">Visitantes</span>
          </div>
          <div class="pdf-metric-card">
            <span class="pdf-metric-value">${s.bounceRate}%</span>
            <span class="pdf-metric-label">Tasa de Rebote</span>
          </div>
          <div class="pdf-metric-card">
            <span class="pdf-metric-value">${formatDuration(s.avgSessionDuration)}</span>
            <span class="pdf-metric-label">Duracion Promedio</span>
          </div>
          <div class="pdf-metric-card">
            <span class="pdf-metric-value">${s.avgPagesPerSession}</span>
            <span class="pdf-metric-label">Pags / Sesion</span>
          </div>
        </div>
      `;
    }

    // Capture the currently visible section content (charts + tables)
    const activeSection = document.getElementById('section-' + currentSection);

    if (activeSection) {
      const sectionContent = await captureSectionContent(activeSection);
      if (sectionContent) {
        previewHtml += sectionContent;
      }
    }

    // For resumen section, also add exportData tables that might not be in visible DOM
    if (currentSection === 'resumen') {
      if (exportData.trend && exportData.trend.length > 0) {
        previewHtml += `<div class="pdf-section-title">Tendencia Diaria</div><table><tr><th>Fecha</th><th class="num">Pageviews</th><th class="num">Sesiones</th><th class="num">Visitantes</th></tr>`;
        exportData.trend.forEach(row => {
          previewHtml += `<tr><td>${row.date}</td><td class="num">${row.pageviews}</td><td class="num">${row.sessions}</td><td class="num">${row.visitors}</td></tr>`;
        });
        previewHtml += `</table>`;
      }

      if (exportData.pages && exportData.pages.length > 0) {
        previewHtml += `<div class="pdf-section-title">Top Paginas</div><table><tr><th>Pagina</th><th>Titulo</th><th class="num">Vistas</th><th class="num">Visitantes</th></tr>`;
        exportData.pages.forEach(row => {
          previewHtml += `<tr><td>${row.path || ''}</td><td>${row.title || ''}</td><td class="num">${row.views}</td><td class="num">${row.uniqueVisitors}</td></tr>`;
        });
        previewHtml += `</table>`;
      }

      if (exportData.clicks && exportData.clicks.length > 0) {
        previewHtml += `<div class="pdf-section-title">Top Clicks</div><table><tr><th>Identificador</th><th>Texto</th><th>Elemento</th><th class="num">Clicks</th></tr>`;
        exportData.clicks.forEach(row => {
          previewHtml += `<tr><td>${row.elementId || ''}</td><td>${row.elementText || ''}</td><td>${row.elementTag || ''}</td><td class="num">${row.clicks}</td></tr>`;
        });
        previewHtml += `</table>`;
      }

      if (exportData.referrers && exportData.referrers.length > 0) {
        previewHtml += `<div class="pdf-section-title">Fuentes de Trafico</div><table><tr><th>Referrer</th><th class="num">Sesiones</th></tr>`;
        exportData.referrers.forEach(row => {
          previewHtml += `<tr><td>${row.referrer}</td><td class="num">${row.sessions}</td></tr>`;
        });
        previewHtml += `</table>`;
      }

      if (exportData.utms && exportData.utms.length > 0) {
        previewHtml += `<div class="pdf-section-title">Campanas UTM</div><table><tr><th>Source</th><th>Medium</th><th>Campaign</th><th class="num">Sesiones</th></tr>`;
        exportData.utms.forEach(row => {
          previewHtml += `<tr><td>${row.source || ''}</td><td>${row.medium || ''}</td><td>${row.campaign || ''}</td><td class="num">${row.sessions}</td></tr>`;
        });
        previewHtml += `</table>`;
      }
    }

    // Footer
    previewHtml += `<div class="pdf-footer">MiComercio Analytics &bull; ${sectionTitle} &bull; Reporte generado el ${generatedAt}</div>`;
    previewHtml += `</div>`;

    // Show preview modal
    const modal = document.getElementById('modal-pdf-preview');
    const previewContainer = document.getElementById('pdf-preview-content');
    previewContainer.innerHTML = previewHtml;
    modal.style.display = 'flex';

    // Close modal handlers
    modal.querySelector('[data-close-modal]').onclick = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    // Download button
    document.getElementById('btn-pdf-download').onclick = async () => {
      const renderPage = document.getElementById('pdf-render-page');
      const btnDownload = document.getElementById('btn-pdf-download');
      btnDownload.textContent = 'Generando...';
      btnDownload.disabled = true;

      try {
        const canvas = await html2canvas(renderPage, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: renderPage.scrollWidth,
          height: renderPage.scrollHeight
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const usableWidth = pageWidth - margin * 2;

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = usableWidth / imgWidth;
        const scaledHeight = imgHeight * ratio;

        // Multi-page support
        let yOffset = 0;
        const usableHeight = pageHeight - margin * 2;

        while (yOffset < scaledHeight) {
          if (yOffset > 0) pdf.addPage();

          const sourceY = (yOffset / ratio);
          const sourceH = Math.min(usableHeight / ratio, imgHeight - sourceY);
          const destH = sourceH * ratio;

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sourceH;
          const pCtx = pageCanvas.getContext('2d');
          pCtx.drawImage(canvas, 0, sourceY, imgWidth, sourceH, 0, 0, imgWidth, sourceH);

          const pageImgData = pageCanvas.toDataURL('image/png');
          pdf.addImage(pageImgData, 'PNG', margin, margin, usableWidth, destH);

          yOffset += usableHeight;
        }

        pdf.save(`MiComercio_Analytics_${siteName}_${sectionTitle}_${dateStr}.pdf`);
      } catch (e) {
        console.error('Error generating PDF:', e);
        alert('Error al generar el PDF');
      } finally {
        btnDownload.textContent = 'Descargar PDF';
        btnDownload.disabled = false;
      }
    };
  }

  // ============================================
  // Annotations System
  // ============================================
  function initAnnotations() {
    loadAnnotations();

    document.getElementById('btn-add-annotation')?.addEventListener('click', () => {
      document.getElementById('annotation-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('annotation-text').value = '';
      document.getElementById('modal-annotation').style.display = 'flex';
    });

    document.getElementById('btn-annotations')?.addEventListener('click', () => {
      renderAnnotationsList();
      document.getElementById('modal-annotations-list').style.display = 'flex';
    });

    document.getElementById('btn-save-annotation')?.addEventListener('click', saveAnnotation);
    document.getElementById('btn-new-annotation')?.addEventListener('click', () => {
      document.getElementById('modal-annotations-list').style.display = 'none';
      document.getElementById('annotation-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('annotation-text').value = '';
      document.getElementById('modal-annotation').style.display = 'flex';
    });

    // Close modals
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.closeModal;
        document.getElementById(modalId).style.display = 'none';
      });
    });
  }

  function loadAnnotations() {
    try {
      const saved = localStorage.getItem('micomercio_annotations');
      state.annotations = saved ? JSON.parse(saved) : [];
    } catch (e) {
      state.annotations = [];
    }
  }

  function saveAnnotation() {
    const date = document.getElementById('annotation-date').value;
    const text = document.getElementById('annotation-text').value;
    const color = document.getElementById('annotation-color').value;

    if (!date || !text) {
      alert('Por favor completa todos los campos');
      return;
    }

    state.annotations.push({ id: Date.now(), date, text, color });
    localStorage.setItem('micomercio_annotations', JSON.stringify(state.annotations));
    document.getElementById('modal-annotation').style.display = 'none';

    // Refresh chart
    if (state.trendData) {
      const metric = elements.filterTrendMetric?.value || 'all';
      const chartType = elements.filterTrendType?.value || 'line';
      renderTrendChart(state.trendData, metric, chartType);
    }
  }

  function renderAnnotationsList() {
    const container = document.getElementById('annotations-list-container');
    if (!container) return;

    if (state.annotations.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay anotaciones</p>';
      return;
    }

    container.innerHTML = state.annotations.map(a => `
      <div class="annotation-item" style="border-left-color: ${a.color}">
        <div class="annotation-item-content">
          <div class="annotation-item-date">${a.date}</div>
          <div class="annotation-item-text">${a.text}</div>
        </div>
        <button class="annotation-item-delete" data-id="${a.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.annotation-item-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        state.annotations = state.annotations.filter(a => a.id !== id);
        localStorage.setItem('micomercio_annotations', JSON.stringify(state.annotations));
        renderAnnotationsList();
      });
    });
  }

  // ============================================
  // Alerts System
  // ============================================
  function initAlerts() {
    loadAlertsConfig();

    document.getElementById('btn-alerts')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('alerts-dropdown');
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-alerts-settings')?.addEventListener('click', () => {
      document.getElementById('alerts-dropdown').style.display = 'none';
      navigateToSection('settings');
    });

    document.addEventListener('click', () => {
      document.getElementById('alerts-dropdown').style.display = 'none';
    });

    document.getElementById('btn-save-alerts')?.addEventListener('click', saveAlertsConfig);
    document.getElementById('btn-test-alerts')?.addEventListener('click', testAlerts);
  }

  function loadAlertsConfig() {
    try {
      const saved = localStorage.getItem('micomercio_alerts_config');
      if (saved) state.alertsConfig = JSON.parse(saved);
    } catch (e) {}

    // Populate form
    document.getElementById('alert-bounce-enabled').checked = state.alertsConfig.bounceEnabled;
    document.getElementById('alert-bounce-threshold').value = state.alertsConfig.bounceThreshold;
    document.getElementById('alert-visitors-enabled').checked = state.alertsConfig.visitorsEnabled;
    document.getElementById('alert-visitors-threshold').value = state.alertsConfig.visitorsThreshold;
    document.getElementById('alert-duration-enabled').checked = state.alertsConfig.durationEnabled;
    document.getElementById('alert-duration-threshold').value = state.alertsConfig.durationThreshold;
    document.getElementById('alert-traffic-drop-enabled').checked = state.alertsConfig.trafficDropEnabled;
    document.getElementById('alert-traffic-drop-threshold').value = state.alertsConfig.trafficDropThreshold;
  }

  function saveAlertsConfig() {
    state.alertsConfig = {
      bounceEnabled: document.getElementById('alert-bounce-enabled').checked,
      bounceThreshold: parseInt(document.getElementById('alert-bounce-threshold').value) || 60,
      visitorsEnabled: document.getElementById('alert-visitors-enabled').checked,
      visitorsThreshold: parseInt(document.getElementById('alert-visitors-threshold').value) || 100,
      durationEnabled: document.getElementById('alert-duration-enabled').checked,
      durationThreshold: parseInt(document.getElementById('alert-duration-threshold').value) || 30,
      trafficDropEnabled: document.getElementById('alert-traffic-drop-enabled').checked,
      trafficDropThreshold: parseInt(document.getElementById('alert-traffic-drop-threshold').value) || 30
    };
    localStorage.setItem('micomercio_alerts_config', JSON.stringify(state.alertsConfig));
    alert('Configuracion de alertas guardada');
  }

  function checkAlerts(summary, compareData) {
    state.alerts = [];

    if (state.alertsConfig.bounceEnabled && summary.bounceRate > state.alertsConfig.bounceThreshold) {
      state.alerts.push({
        type: 'warning',
        title: 'Bounce Rate Alto',
        message: `El bounce rate (${summary.bounceRate}%) supera el umbral de ${state.alertsConfig.bounceThreshold}%`
      });
    }

    if (state.alertsConfig.visitorsEnabled && summary.uniqueVisitors < state.alertsConfig.visitorsThreshold) {
      state.alerts.push({
        type: 'warning',
        title: 'Pocos Visitantes',
        message: `Solo ${summary.uniqueVisitors} visitantes, menor al umbral de ${state.alertsConfig.visitorsThreshold}`
      });
    }

    if (state.alertsConfig.durationEnabled && summary.avgSessionDuration < state.alertsConfig.durationThreshold) {
      state.alerts.push({
        type: 'warning',
        title: 'Duracion Baja',
        message: `Duracion promedio de ${summary.avgSessionDuration}s, menor a ${state.alertsConfig.durationThreshold}s`
      });
    }

    if (state.alertsConfig.trafficDropEnabled && compareData?.previous) {
      const drop = ((compareData.previous.pageviews - summary.pageviews) / compareData.previous.pageviews) * 100;
      if (drop > state.alertsConfig.trafficDropThreshold) {
        state.alerts.push({
          type: 'error',
          title: 'Caida de Trafico',
          message: `El trafico cayo ${drop.toFixed(1)}% vs periodo anterior`
        });
      }
    }

    updateAlertsUI();
  }

  function updateAlertsUI() {
    const badge = document.getElementById('alerts-badge');
    const list = document.getElementById('alerts-list');

    if (badge) {
      badge.style.display = state.alerts.length > 0 ? 'block' : 'none';
      badge.textContent = state.alerts.length;
    }

    if (list) {
      if (state.alerts.length === 0) {
        list.innerHTML = '<p class="alerts-empty">No hay alertas activas</p>';
      } else {
        list.innerHTML = state.alerts.map(a => `
          <div class="alert-item">
            <div class="alert-icon ${a.type}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div class="alert-content">
              <div class="alert-title">${a.title}</div>
              <div class="alert-message">${a.message}</div>
              <div class="alert-time">Ahora</div>
            </div>
          </div>
        `).join('');
      }
    }
  }

  function testAlerts() {
    state.alerts = [
      { type: 'warning', title: 'Alerta de Prueba', message: 'Esta es una alerta de prueba' },
      { type: 'error', title: 'Error de Prueba', message: 'Esta es otra alerta de prueba' }
    ];
    updateAlertsUI();
    alert('Alertas de prueba generadas');
  }

  // ============================================
  // Goals System
  // ============================================
  function initGoals() {
    // Load saved goals from localStorage
    const savedGoals = localStorage.getItem('micomercio_goals');
    if (savedGoals) {
      try {
        state.goals = JSON.parse(savedGoals);
      } catch (e) {
        console.log('Error loading goals:', e);
      }
    }
  }

  function updateGoalsProgress() {
    if (!state.goals || !exportData.summary) return;
  }

  // ============================================
  // Initialize
  // ============================================
  function init() {
    initTheme();
    initSidebar();
    initToggleTables();
    initCollapsibleCards();
    initExportDropdown();
    initAnnotations();
    initAlerts();
    initGoals();
    setupEventListeners();
    loadSites();
    setInterval(loadRealtime, REALTIME_INTERVAL);

    // Toggle filters
    elements.btnToggleFilters?.addEventListener('click', toggleAdvancedFilters);
    elements.btnClearFilters?.addEventListener('click', clearAdvancedFilters);

    // Apply initial config
    applyResumenConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
