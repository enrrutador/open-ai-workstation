/**
 * COLAB WORKSTATION - API Client
 * Communicates with the Universal Orchestrator backend.
 * Never stores secrets. Never assumes notebook-specific APIs.
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

  setPollInterval(seconds) {
    const s = Math.max(2, Math.min(60, parseInt(seconds, 10) || 5));
    this.pollInterval = s * 1000;
    localStorage.setItem('poll_interval', String(s));
  }

  getPollInterval() {
    return Math.round(this.pollInterval / 1000);
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

  async getStatus() {
    const data = await this._request('GET', '/api/status');
    this._statusCache = data;
    return data;
  }

  async getHealth() {
    return this._request('GET', '/api/health');
  }

  async getNotebooks() {
    return this._request('GET', '/api/notebooks');
  }

  async getNotebook(id) {
    return this._request('GET', `/api/notebooks/${encodeURIComponent(id)}`);
  }

  async startNotebook(id) {
    return this._request('POST', `/api/notebooks/${encodeURIComponent(id)}/start`);
  }

  async stopNotebook(id) {
    return this._request('POST', `/api/notebooks/${encodeURIComponent(id)}/stop`);
  }

  async restartNotebook(id) {
    return this._request('POST', `/api/notebooks/${encodeURIComponent(id)}/restart`);
  }

  async saveNotebook(id) {
    return this._request('POST', `/api/notebooks/${encodeURIComponent(id)}/save`);
  }

  async getNotebookServices(id) {
    return this._request('GET', `/api/notebooks/${encodeURIComponent(id)}/services`);
  }

  async getNotebookLogs(id, lines = 200) {
    return this._request('GET', `/api/notebooks/${encodeURIComponent(id)}/logs?lines=${lines}`);
  }

  async setCredentials(notebookId, credentials) {
    return this._request('POST', `/api/notebooks/${encodeURIComponent(notebookId)}/credentials`, credentials);
  }

  async deleteCredentials(notebookId, name) {
    return this._request('DELETE', `/api/notebooks/${encodeURIComponent(notebookId)}/credentials`, { name });
  }

  async getServices() {
    return this._request('GET', '/api/services');
  }

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

  async execTerminal(command) {
    return this._request('POST', '/api/terminal', { command });
  }

  async analyzeNotebook(file) {
    const form = new FormData();
    form.append('notebook', file);
    return this._request('POST', '/api/notebooks/analyze', form);
  }

  async uploadNotebook(file, name) {
    const form = new FormData();
    form.append('notebook', file);
    if (name) form.append('name', name);
    return this._request('POST', '/api/notebooks', form);
  }
}

window.api = new OrchestratorAPI();
