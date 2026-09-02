/**
 * OPEN AI WORKSTATION - Main Application
 * Universal frontend for the Colab Orchestrator.
 * No project-specific hardcoding. Real data only.
 */

(() => {
  'use strict';

  // ─── State ───────────────────────────────────────────────
  const state = {
    connected: false,
    currentView: 'home',
    currentProjectId: null,
    currentPath: '/',
    status: null,
    projects: [],
    services: [],
    activity: [],
    pollTimer: null,
    terminalHistory: [],
  };

  // ─── DOM helpers ─────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function toast(msg, type = 'info', duration = 3200) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    $('#toast-container').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function statusClass(s) {
    if (!s) return 'offline';
    const v = String(s).toLowerCase();
    if (['connected', 'online', 'running', 'ejecutando', 'active', 'ok', 'ready'].includes(v)) return 'online';
    if (['starting', 'iniciando', 'restarting', 'reiniciando', 'loading', 'connecting'].includes(v)) return 'warning';
    if (['error', 'failed', 'offline', 'disconnected', 'stopped', 'detenido'].includes(v)) return 'error';
    if (['warning', 'degraded'].includes(v)) return 'warning';
    return 'offline';
  }

  function statusLabel(s) {
    if (s == null || s === '') return 'No disponible';
    return String(s);
  }

  // ─── Screens & Navigation ────────────────────────────────
  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    const el = $(`#${id}`);
    if (el) el.classList.add('active');
  }

  function setView(view) {
    state.currentView = view;
    $$('.view').forEach(v => v.classList.remove('active'));
    const target = $(`#view-${view}`);
    if (target) target.classList.add('active');

    $$('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    const titles = {
      home: 'Inicio', notebooks: 'Cuadernos', load: 'Cargar', services: 'Servicios',
      terminal: 'Terminal', files: 'Archivos', settings: 'Configuración', project: 'Proyecto', more: 'Más'
    };
    const titleEl = $('#view-title');
    if (titleEl) titleEl.textContent = titles[view] || view;

    $('#more-menu')?.classList.add('hidden');

    if (view === 'home') renderHome();
    if (view === 'notebooks') renderNotebooks();
    if (view === 'services') renderServices();
    if (view === 'files') renderFiles();
    if (view === 'settings') renderSettings();
    if (view === 'terminal') focusTerminal();
  }

  // ─── Connection ──────────────────────────────────────────
  async function connect(url) {
    if (!url) { toast('Ingresá la URL del orquestador', 'error'); return; }
    const form = $('#connect-form');
    const connecting = $('#connecting-state');
    form?.classList.add('hidden');
    connecting?.classList.remove('hidden');
    try {
      api.setBaseUrl(url);
      const status = await api.getStatus();
      state.connected = true;
      state.status = status;
      showScreen('screen-main');
      setView('home');
      startPolling();
      toast('Conectado al orquestador', 'success');
      refreshAll();
    } catch (err) {
      state.connected = false;
      form?.classList.remove('hidden');
      connecting?.classList.add('hidden');
      toast(`No se pudo conectar: ${err.message}`, 'error');
    }
  }

  function disconnect() {
    stopPolling();
    state.connected = false;
    state.status = null;
    state.projects = [];
    state.services = [];
    api.setBaseUrl('');
    showScreen('screen-splash');
    $('#connect-form')?.classList.remove('hidden');
    $('#connecting-state')?.classList.add('hidden');
    toast('Desconectado', 'info');
  }

  // ─── Polling ─────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    const interval = (parseInt(localStorage.getItem('poll_interval') || '5', 10) || 5) * 1000;
    state.pollTimer = setInterval(refreshAll, interval);
  }

  function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  async function refreshAll() {
    if (!api.isConfigured()) return;
    try {
      const [status, projects, services] = await Promise.allSettled([
        api.getStatus(),
        api.getProjects(),
        api.getServices().catch(() => null)
      ]);
      if (status.status === 'fulfilled') {
        state.status = status.value;
        updateGlobalStatus(status.value);
      }
      if (projects.status === 'fulfilled') {
        state.projects = Array.isArray(projects.value) ? projects.value : (projects.value?.projects || []);
      }
      if (services.status === 'fulfilled' && services.value) {
        state.services = Array.isArray(services.value) ? services.value : (services.value?.services || []);
      }
      if (state.currentView === 'home') renderHome();
      if (state.currentView === 'notebooks') renderNotebooks();
      if (state.currentView === 'services') renderServices();
      if (state.currentView === 'project' && state.currentProjectId) openProject(state.currentProjectId, true);
    } catch (e) {}
  }

  function updateGlobalStatus(status) {
    if (!status) return;
    const map = {
      colab: status.colab ?? status.colab_status ?? status.runtime,
      drive: status.drive ?? status.drive_status ?? status.google_drive,
      orchestrator: status.orchestrator ?? status.orchestrator_status ?? status.status ?? 'connected'
    };
    $$('.status-pill').forEach(pill => {
      const key = pill.dataset.service;
      const val = map[key];
      const cls = statusClass(val);
      pill.classList.remove('online', 'offline', 'warning', 'error');
      pill.classList.add(cls);
      const dot = pill.querySelector('.dot');
      if (dot) dot.className = `dot ${cls}`;
    });
    $$('#home-status-row .status-card').forEach(card => {
      const key = card.dataset.service;
      const val = map[key];
      const cls = statusClass(val);
      const dot = card.querySelector('.status-dot');
      const valueEl = card.querySelector('.status-value');
      if (dot) dot.className = `status-dot ${cls}`;
      if (valueEl) valueEl.textContent = statusLabel(val);
    });
    const side = $('#sidebar-status');
    if (side) {
      const ok = statusClass(map.orchestrator) === 'online';
      side.innerHTML = `<span class="status-dot ${ok ? 'online' : 'offline'}"></span><span>${ok ? 'Conectado' : 'Desconectado'}</span>`;
    }
  }

  // ─── Renderers (simplified core for repo - full logic in local) ───
  function renderHome() {
    const notebooks = state.projects.length;
    const running = state.projects.filter(p => ['running','ejecutando','active'].includes((p.status||'').toLowerCase())).length;
    const services = state.services.length || state.projects.reduce((a,p) => a + (p.services_count||0), 0);
    $('#stat-notebooks').textContent = notebooks || '—';
    $('#stat-running').textContent = running || '—';
    $('#stat-services').textContent = services || '—';
    const list = $('#activity-list');
    if (!state.activity.length) list.innerHTML = '<div class="empty-state">Sin actividad reciente</div>';
    else list.innerHTML = state.activity.slice(0,10).map(a => `<div class="activity-item"><span class="activity-time">${escapeHtml(a.time||'')}</span><span class="activity-text">${escapeHtml(a.message||'')}</span></div>`).join('');
    updateGlobalStatus(state.status);
  }

  function renderNotebooks() {
    const list = $('#notebooks-list');
    if (!state.projects.length) { list.innerHTML = '<div class="empty-state">No hay cuadernos cargados</div>'; return; }
    list.innerHTML = state.projects.map(p => {
      const status = (p.status || 'unknown').toLowerCase();
      const statusCls = statusClass(status);
      const isRunning = ['running','ejecutando','active'].includes(status);
      return `<article class="project-card" data-id="${escapeHtml(p.id)}">
        <div class="card-header"><h4 class="card-title">${escapeHtml(p.name||p.id||'Sin nombre')}</h4>
        <span class="status-badge ${statusCls}"><span class="status-dot ${statusCls}"></span>${escapeHtml((p.status||'No disponible').toUpperCase())}</span></div>
        ${isRunning ? `<div class="card-metrics"><span>CPU ${p.cpu!=null?p.cpu+'%':'—'}</span><span>RAM ${p.ram!=null?p.ram:'—'}</span></div>` : ''}
        <div class="card-actions">${isRunning
          ? `<button class="btn btn-sm btn-danger" data-action="stop" data-id="${escapeHtml(p.id)}">Detener</button><button class="btn btn-sm btn-secondary" data-action="open" data-id="${escapeHtml(p.id)}">Abrir</button>`
          : `<button class="btn btn-sm btn-primary" data-action="start" data-id="${escapeHtml(p.id)}">Ejecutar</button><button class="btn btn-sm btn-secondary" data-action="open" data-id="${escapeHtml(p.id)}">Configurar</button>`}</div></article>`;
    }).join('');
  }

  function renderServices() {
    const list = $('#services-list');
    const items = state.services.length ? state.services : state.projects.flatMap(p => (p.services||[]).map(s => ({...s, project: p.name})));
    if (!items.length) { list.innerHTML = '<div class="empty-state">No hay servicios activos</div>'; return; }
    list.innerHTML = items.map(s => {
      const statusCls = statusClass(s.status || 'active');
      const url = s.url || s.public_url || '';
      return `<article class="service-card"><div class="card-header"><h4 class="card-title"><span class="status-dot ${statusCls}"></span>${escapeHtml(s.name||'Servicio')}</h4>${s.project?`<span class="card-meta">${escapeHtml(s.project)}</span>`:''}</div>
        <div class="card-body"><span class="mono">Puerto ${s.port!=null?s.port:'—'}</span>${url?`<span class="service-url mono">${escapeHtml(url)}</span>`:''}</div>
        <div class="card-actions">${url?`<a class="btn btn-sm btn-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir</a>`:''}</div></article>`;
    }).join('');
  }

  async function renderFiles() {
    const list = $('#files-list');
    list.innerHTML = '<div class="empty-state">Cargando...</div>';
    try {
      const data = await api.getFiles(state.currentPath);
      const items = Array.isArray(data) ? data : (data?.files || data?.entries || []);
      const pathBar = $('#path-bar');
      const parts = state.currentPath.split('/').filter(Boolean);
      let acc = '';
      pathBar.innerHTML = `<button class="path-item" data-path="/">workspace</button>` + parts.map(p => { acc += '/' + p; return `<span class="path-sep">/</span><button class="path-item" data-path="${escapeHtml(acc)}">${escapeHtml(p)}</button>`; }).join('');
      if (!items.length) { list.innerHTML = '<div class="empty-state">Carpeta vacía</div>'; return; }
      list.innerHTML = items.map(f => {
        const isDir = f.type === 'dir' || f.type === 'directory' || f.is_dir;
        return `<div class="file-item ${isDir?'is-dir':''}" data-path="${escapeHtml(f.path||f.name)}" data-type="${isDir?'dir':'file'}">
          <span class="file-icon">${isDir?'📁':'📄'}</span><span class="file-name">${escapeHtml(f.name||f.path)}</span>
          <span class="file-meta">${f.size!=null?formatSize(f.size):''}</span>
          <button class="btn btn-xs btn-ghost file-delete" data-path="${escapeHtml(f.path||f.name)}" title="Eliminar">✕</button></div>`;
      }).join('');
    } catch (err) {
      list.innerHTML = `<div class="empty-state">No disponible<br><small>${escapeHtml(err.message)}</small></div>`;
    }
  }

  function formatSize(bytes) {
    if (bytes == null) return '';
    const u = ['B','KB','MB','GB']; let i=0, n=Number(bytes);
    while (n>=1024 && i<u.length-1) { n/=1024; i++; }
    return `${n.toFixed(i?1:0)} ${u[i]}`;
  }

  function renderSettings() {
    const urlInput = $('#setting-orchestrator-url');
    if (urlInput) urlInput.value = api.getBaseUrl() || '';
    const pollInput = $('#setting-poll-interval');
    if (pollInput) pollInput.value = localStorage.getItem('poll_interval') || '5';
  }

  async function openProject(id, silent = false) {
    state.currentProjectId = id;
    setView('project');
    const container = $('#project-detail');
    container.innerHTML = '<div class="empty-state">Cargando...</div>';
    try {
      const p = await api.getProject(id);
      const statusCls = statusClass((p.status||'').toLowerCase());
      container.innerHTML = `
        <div class="detail-header"><h2>${escapeHtml(p.name||id)}</h2>
        <span class="status-badge ${statusCls}"><span class="status-dot ${statusCls}"></span>${(p.status||'No disponible').toUpperCase()}</span></div>
        <div class="detail-grid">
          <div class="detail-item"><span class="label">Notebook</span><span class="value mono">${escapeHtml(p.notebook||p.filename||'No disponible')}</span></div>
          <div class="detail-item"><span class="label">Runtime</span><span class="value">${escapeHtml(p.runtime||'Google Colab')}</span></div>
          <div class="detail-item"><span class="label">CPU</span><span class="value">${p.cpu!=null?p.cpu+'%':'No disponible'}</span></div>
          <div class="detail-item"><span class="label">RAM</span><span class="value">${p.ram!=null?p.ram:'No disponible'}</span></div>
          <div class="detail-item"><span class="label">GPU</span><span class="value">${p.gpu!=null?p.gpu:'No disponible'}</span></div>
          <div class="detail-item"><span class="label">Servicios</span><span class="value">${p.services_count!=null?p.services_count+' activos':(p.services?.length??'No disponible')}</span></div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary" data-action="start" data-id="${escapeHtml(id)}">▶ Ejecutar</button>
          <button class="btn btn-secondary" data-action="stop" data-id="${escapeHtml(id)}">■ Detener</button>
          <button class="btn btn-secondary" data-action="restart" data-id="${escapeHtml(id)}">↻ Reiniciar</button>
          <button class="btn btn-secondary" data-action="save" data-id="${escapeHtml(id)}">💾 Guardar</button>
        </div>`;
    } catch (err) {
      if (!silent) toast(err.message, 'error');
      container.innerHTML = `<div class="empty-state">No disponible<br><small>${escapeHtml(err.message)}</small></div>`;
    }
  }

  function focusTerminal() { const input = $('#terminal-input'); if (input) setTimeout(() => input.focus(), 100); }

  async function runTerminalCommand(cmd) {
    if (!cmd.trim()) return;
    const out = $('#terminal-output');
    out.innerHTML += `<div class="term-line"><span class="prompt">$</span> ${escapeHtml(cmd)}</div>`;
    try {
      const res = await api.execTerminal(cmd);
      const text = typeof res === 'string' ? res : (res.output || res.stdout || JSON.stringify(res, null, 2));
      out.innerHTML += `<div class="term-line output">${escapeHtml(text)}</div>`;
    } catch (err) {
      out.innerHTML += `<div class="term-line error">${escapeHtml(err.message)}</div>`;
    }
    out.scrollTop = out.scrollHeight;
  }

  // ─── Event wiring ────────────────────────────────────────
  function bindEvents() {
    $('#btn-connect')?.addEventListener('click', () => connect($('#orchestrator-url')?.value.trim()));
    $('#orchestrator-url')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-connect')?.click(); });

    document.addEventListener('click', e => {
      const navBtn = e.target.closest('[data-view]');
      if (navBtn) {
        const view = navBtn.dataset.view;
        if (view === 'more') { $('#more-menu')?.classList.toggle('hidden'); return; }
        setView(view); return;
      }
      const navAction = e.target.closest('[data-nav]');
      if (navAction) { setView(navAction.dataset.nav); return; }
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) { handleAction(actionBtn.dataset.action, actionBtn.dataset.id, actionBtn); return; }
      const pathBtn = e.target.closest('.path-item');
      if (pathBtn) { state.currentPath = pathBtn.dataset.path || '/'; renderFiles(); return; }
      const fileItem = e.target.closest('.file-item.is-dir');
      if (fileItem && !e.target.closest('.file-delete')) { state.currentPath = fileItem.dataset.path; renderFiles(); return; }
      const delBtn = e.target.closest('.file-delete');
      if (delBtn) { e.stopPropagation(); deleteFile(delBtn.dataset.path); return; }
    });

    $('#btn-back-projects')?.addEventListener('click', () => setView('notebooks'));
    $('#btn-refresh-services')?.addEventListener('click', () => { refreshAll(); toast('Actualizando servicios...', 'info'); });
    $('#terminal-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const cmd = e.target.value; e.target.value = ''; runTerminalCommand(cmd); }
    });
    $('#btn-clear-terminal')?.addEventListener('click', () => { $('#terminal-output').innerHTML = ''; });

    const fileInput = $('#notebook-file');
    const dropZone = $('#drop-zone');
    fileInput?.addEventListener('change', () => { if (fileInput.files?.[0]) handleNotebookFile(fileInput.files[0]); });
    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone?.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); const f = e.dataTransfer?.files?.[0]; if (f) handleNotebookFile(f); });

    $('#btn-save-url')?.addEventListener('click', () => {
      const url = $('#setting-orchestrator-url')?.value.trim();
      if (url) { api.setBaseUrl(url); toast('URL guardada. Reconectando...', 'info'); connect(url); }
    });
    $('#btn-disconnect')?.addEventListener('click', disconnect);
    $('#setting-poll-interval')?.addEventListener('change', e => {
      const v = Math.max(2, Math.min(60, parseInt(e.target.value, 10) || 5));
      localStorage.setItem('poll_interval', String(v));
      if (state.connected) startPolling();
      toast(`Polling: ${v}s`, 'info');
    });

    $('#file-upload')?.addEventListener('change', async e => {
      const files = e.target.files;
      if (!files?.length) return;
      for (const f of files) {
        try { await api.uploadFile(state.currentPath, f); toast(`Subido: ${f.name}`, 'success'); }
        catch (err) { toast(`Error subiendo ${f.name}: ${err.message}`, 'error'); }
      }
      renderFiles(); e.target.value = '';
    });
    $('#btn-new-folder')?.addEventListener('click', async () => {
      const name = prompt('Nombre de la carpeta:');
      if (!name) return;
      const path = state.currentPath.replace(/\/$/, '') + '/' + name;
      try { await api.createFolder(path); toast('Carpeta creada', 'success'); renderFiles(); }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  async function handleAction(action, id, btn) {
    if (!id) return;
    try {
      btn?.classList.add('loading');
      if (action === 'start') { await api.startProject(id); toast('Iniciando proyecto...', 'info'); }
      else if (action === 'stop') { await api.stopProject(id); toast('Deteniendo...', 'info'); }
      else if (action === 'restart') { await api.restartProject(id); toast('Reiniciando...', 'info'); }
      else if (action === 'save') { await api.saveProject(id); toast('Guardado', 'success'); }
      else if (action === 'open' || action === 'configure') { openProject(id); return; }
      await refreshAll();
      if (state.currentView === 'project') openProject(id, true);
    } catch (err) { toast(err.message || 'Error', 'error'); }
    finally { btn?.classList.remove('loading'); }
  }

  async function deleteFile(path) {
    if (!confirm(`¿Eliminar ${path}?`)) return;
    try { await api.deleteFile(path); toast('Eliminado', 'success'); renderFiles(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleNotebookFile(file) {
    if (!file || !file.name.endsWith('.ipynb')) { toast('Solo archivos .ipynb', 'error'); return; }
    const panel = $('#analysis-panel');
    const statusEl = $('#analysis-status');
    const resultEl = $('#analysis-result');
    panel.classList.remove('hidden');
    statusEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
    statusEl.innerHTML = '<div class="spinner"></div><span>Analizando notebook...</span>';
    try {
      let analysis;
      try { analysis = await api.analyzeNotebook(file); }
      catch {
        const text = await file.text();
        const nb = JSON.parse(text);
        const cells = nb.cells || [];
        analysis = { name: file.name.replace(/\.ipynb$/i, ''), valid: true, cells: cells.length, code_cells: cells.filter(c => c.cell_type === 'code').length, apis: [], dependencies: [], services: [], message: 'Análisis local básico' };
      }
      statusEl.classList.add('hidden');
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `<div class="analysis-ok"><p>✓ Notebook válido</p><p>✓ Código detectado</p></div>
        <div class="analysis-block"><label>Nombre</label><input type="text" id="nb-name" value="${escapeHtml(analysis.name || '')}" /></div>
        <button class="btn btn-primary btn-large" id="btn-confirm-upload">Cargar cuaderno</button>`;
      $('#btn-confirm-upload').onclick = async () => {
        const name = $('#nb-name').value.trim() || analysis.name;
        try { await api.uploadNotebook(file, name); toast('Cuaderno cargado', 'success'); panel.classList.add('hidden'); await refreshAll(); setView('notebooks'); }
        catch (err) { toast(`Error al cargar: ${err.message}`, 'error'); }
      };
    } catch (err) { statusEl.innerHTML = `<span class="error">Error: ${escapeHtml(err.message)}</span>`; }
  }

  // ─── Boot ────────────────────────────────────────────────
  function init() {
    bindEvents();
    const savedUrl = api.getBaseUrl();
    if (savedUrl) {
      $('#orchestrator-url').value = savedUrl;
      connect(savedUrl);
    } else {
      showScreen('screen-splash');
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
