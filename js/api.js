/**
 * OPEN AI WORKSTATION - API Client
 * Communicates with the Universal Orchestrator backend.
 * Never stores secrets. Never assumes project-specific APIs.
 */

class OrchestratorAPI {
  constructor() {
    this.baseUrl = localStorage.getItem('orchestrator_url') || '';
    this.pollInterval = parseInt(localStorage.getItem('poll_interval') || '5', 10) * 1000;
    this._statusCache = null;
    this._lastError = null;
  }

  setBaseUrl(url) {
    this.baseUrl = (url || '').replace(/\/+$/, '');
    localStorage.setItem('orchestrator_url', this.baseUrl);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  isConfigured() {
    return !!this.baseUrl;
  }

  async _request(method, path, body = null, options = {}) {
    if (!this.baseUrl) {
      throw new Error('Orquestador no configurado');
    }

    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    const config = {
      method,
      headers,
      mode: 'cors',
      credentials: 'omit',
      ...options
    };

    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      config.body = body;
    }

    try {
      const res = await fetch(url, config);
      const contentType = res.headers.get('content-type') || '';
      let data = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        const msg = (data && data.message) || (data && data.error) || `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      this._lastError = null;
      return data;
    } catch (err) {
      this._lastError = err;
      throw err;
    }
  }

  // —— Status ——
  async getStatus() {
    const data = await this._request('GET', '/api/status');
    this._statusCache = data;
    return data;
  }

  // —— Projects ——
  async getProjects() {
    return this._request('GET', '/api/projects');
  }

  async getProject(id) {
    return this._request('GET', `/api/projects/${encodeURIComponent(id)}`);
  }

  async createProject(payload) {
    return this._request('POST', '/api/projects', payload);
  }

  async startProject(id) {
    return this._request('POST', `/api/projects/${encodeURIComponent(id)}/start`);
  }

  async stopProject(id) {
    return this._request('POST', `/api/projects/${encodeURIComponent(id)}/stop`);
  }

  async restartProject(id) {
    return this._request('POST', `/api/projects/${encodeURIComponent(id)}/restart`);
  }

  async saveProject(id) {
    return this._request('POST', `/api/projects/${encodeURIComponent(id)}/save`);
  }

  async getProjectServices(id) {
    return this._request('GET', `/api/projects/${encodeURIComponent(id)}/services`);
  }

  // —— Credentials (never returned in full) ——
  async setCredentials(projectId, credentials) {
    return this._request('POST', `/api/projects/${encodeURIComponent(projectId)}/credentials`, credentials);
  }

  async deleteCredentials(projectId, name) {
    return this._request('DELETE', `/api/projects/${encodeURIComponent(projectId)}/credentials`, { name });
  }

  // —— Services (global) ——
  async getServices() {
    return this._request('GET', '/api/services');
  }

  // —— Files ——
  async getFiles(path = '/') {
    const q = path ? `?path=${encodeURIComponent(path)}` : '';
    return this._request('GET', `/api/files${q}`);
  }

  async uploadFile(path, file) {
    const form = new FormData();
    form.append('file', file);
    form.append('path', path || '/');
    return this._request('POST', '/api/files/upload', form);
  }

  async deleteFile(path) {
    return this._request('DELETE', '/api/files', { path });
  }

  async createFolder(path) {
    return this._request('POST', '/api/files/mkdir', { path });
  }

  // —— Terminal ——
  async execTerminal(command) {
    return this._request('POST', '/api/terminal', { command });
  }

  // —— Notebook analysis / upload ——
  async analyzeNotebook(file) {
    const form = new FormData();
    form.append('notebook', file);
    return this._request('POST', '/api/projects/analyze', form);
  }

  async uploadNotebook(file, name) {
    const form = new FormData();
    form.append('notebook', file);
    if (name) form.append('name', name);
    return this._request('POST', '/api/projects', form);
  }
}

window.api = new OrchestratorAPI();
