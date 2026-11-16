import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { KubeYamlParser } from '../core/parser.js';
import { KubeAuditor } from '../core/auditor.js';
import { KubeHardener } from '../core/hardener.js';
import { KubeAuditReport } from '../core/types.js';

export class KubeSmithStudio {
  private port: number;
  private targetDir: string;

  constructor(port = 5454, targetDir = process.cwd()) {
    this.port = port;
    this.targetDir = targetDir;
  }

  public start(): http.Server {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // API: Scan & Audit Manifests
      if (url.pathname === '/api/audit' && req.method === 'GET') {
        const reports = this.scanManifests();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reports, targetDir: this.targetDir }));
        return;
      }

      // API: Harden Manifest
      if (url.pathname === '/api/harden' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            let contentToHarden = data.content;
            if (!contentToHarden && data.filePath && fs.existsSync(data.filePath)) {
              contentToHarden = fs.readFileSync(data.filePath, 'utf-8');
            }
            if (!contentToHarden) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No content or valid filePath provided' }));
              return;
            }

            const result = KubeHardener.harden(contentToHarden);
            if (data.save && data.filePath) {
              fs.writeFileSync(data.filePath, result.hardenedYaml, 'utf-8');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...result, saved: Boolean(data.save) }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Web Studio HTML
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderHtml());
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    server.listen(this.port, () => {
      console.log(`\n⚡ KubeSmith Studio live at: \x1b[36mhttp://localhost:${this.port}\x1b[0m`);
    });

    return server;
  }

  public scanManifests(): KubeAuditReport[] {
    const reports: KubeAuditReport[] = [];
    const candidates: string[] = [];

    const searchDirs = ['.', 'k8s', 'manifests', 'deploy', 'helm', 'examples'];
    for (const dir of searchDirs) {
      const fullDir = path.join(this.targetDir, dir);
      if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
        const files = fs.readdirSync(fullDir);
        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            candidates.push(path.join(fullDir, file));
          }
        }
      }
    }

    for (const file of candidates) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const report = KubeAuditor.audit(content, file);
          reports.push(report);
        } catch (e) {
          // ignore parsing error
        }
      }
    }

    return reports;
  }

  private renderHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KubeSmith Studio — Kubernetes Security, PSS & Topology Inspector</title>
  <style>
    :root {
      --bg: #070a12;
      --card-bg: #0d121f;
      --card-subtle: #131929;
      --border: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --cyan: #38bdf8;
      --cyan-glow: rgba(56, 189, 248, 0.2);
      --emerald: #10b981;
      --amber: #f59e0b;
      --rose: #f43f5e;
      --purple: #a855f7;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
      padding: 24px;
      min-height: 100vh;
    }

    /* Top Bar */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-badge {
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      color: #fff;
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 16px;
      box-shadow: 0 0 15px var(--cyan-glow);
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 13px;
      color: var(--text-muted);
    }
    .top-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .file-select {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      cursor: pointer;
    }
    .file-select:focus { border-color: var(--cyan); }
    .btn {
      background: var(--card-subtle);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
    }
    .btn:hover { background: #1e293b; border-color: var(--cyan); }
    .btn-primary {
      background: #0284c7;
      border-color: #38bdf8;
      color: #fff;
      box-shadow: 0 0 15px var(--cyan-glow);
    }
    .btn-primary:hover { background: #0369a1; }
    .btn-success { background: #059669; border-color: #34d399; color: #fff; }

    /* Bento Grid (Pattern #12) & Hero Score */
    .hero-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    .score-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .gauge-wrapper {
      position: relative;
      width: 140px;
      height: 140px;
      margin-bottom: 12px;
    }
    .gauge-svg {
      transform: rotate(-90deg);
      width: 140px;
      height: 140px;
    }
    .gauge-bg {
      fill: none;
      stroke: var(--card-subtle);
      stroke-width: 10;
    }
    .gauge-bar {
      fill: none;
      stroke-width: 10;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.8s ease, stroke 0.4s ease;
    }
    .gauge-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -1px;
    }
    .grade-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .stat-box {
      background: var(--card-subtle);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 26px;
      font-weight: 800;
      margin-top: 6px;
    }
    .stat-desc {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* Tabs Bar */
    .nav-tabs {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }
    .tab-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s ease;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active {
      color: var(--cyan);
      border-bottom-color: var(--cyan);
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .search-box { flex: 1; }
    .search-input {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 16px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }
    .search-input:focus { border-color: var(--cyan); }
    .pill-group { display: flex; gap: 6px; }
    .pill {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pill:hover, .pill.active {
      background: #1e293b;
      color: var(--text);
      border-color: var(--cyan);
    }

    /* Split Layout */
    .split-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .code-editor {
      background: #030712;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      font-family: "Geist Mono", monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    .code-header {
      background: #090e1a;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .code-body {
      padding: 16px 0;
      max-height: 520px;
      overflow-y: auto;
    }
    .code-line {
      display: flex;
      padding: 1px 16px;
      transition: background 0.1s ease;
    }
    .code-line:hover { background: rgba(255, 255, 255, 0.04); }
    .line-no {
      width: 40px;
      color: #4b5563;
      user-select: none;
      text-align: right;
      padding-right: 16px;
    }
    .line-text { flex: 1; white-space: pre; }
    .line-has-finding {
      background: rgba(244, 63, 94, 0.12);
      border-left: 3px solid var(--rose);
    }

    /* Findings Column */
    .findings-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 570px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .finding-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
      border-left: 4px solid var(--border);
      transition: transform 0.15s ease;
    }
    .finding-card:hover { transform: translateX(2px); }
    .finding-card.severity-CRITICAL { border-left-color: var(--rose); }
    .finding-card.severity-HIGH { border-left-color: var(--amber); }
    .finding-card.severity-MEDIUM { border-left-color: var(--cyan); }
    .finding-card.severity-LOW { border-left-color: var(--purple); }

    .finding-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .rule-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .badge-CRITICAL { background: rgba(244, 63, 94, 0.2); color: #fda4af; }
    .badge-HIGH { background: rgba(245, 158, 11, 0.2); color: #fde68a; }
    .badge-MEDIUM { background: rgba(56, 189, 248, 0.2); color: #bae6fd; }
    .badge-LOW { background: rgba(168, 85, 247, 0.2); color: #e9d5ff; }

    .finding-title { font-size: 14px; font-weight: 700; color: var(--text); }
    .finding-msg { font-size: 13px; color: var(--text-muted); margin: 6px 0; }
    .fix-box {
      background: #030712;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 8px 12px;
      font-family: monospace;
      font-size: 12px;
      color: #38bdf8;
      margin-top: 6px;
      white-space: pre-wrap;
    }

    /* Diff View */
    .diff-wrapper {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .diff-panel {
      background: #030712;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      font-family: monospace;
      font-size: 12px;
      max-height: 500px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    /* Footer */
    .footer-bar {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-muted);
    }
    .kbd {
      background: var(--card-subtle);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 2px 6px;
      font-family: monospace;
      font-size: 11px;
      color: var(--text);
    }
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0284c7;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      display: none;
      z-index: 1000;
    }
  </style>
</head>
<body>

  <!-- Top Bar -->
  <div class="top-bar">
    <div class="brand">
      <div class="logo-badge">☸️ KS</div>
      <div>
        <div class="brand-title">KubeSmith Studio</div>
        <div class="brand-sub">Kubernetes Pod Security Standards & Topology Inspector</div>
      </div>
    </div>
    <div class="top-actions">
      <select id="fileDropdown" class="file-select" onchange="onFileChange()"></select>
      <button class="btn btn-primary" onclick="hardenCurrentFile()">⚡ 1-Click Auto-Harden</button>
      <button class="btn" onclick="exportReport()">📥 Export Report</button>
      <button class="btn" onclick="loadData()">↻ Refresh</button>
    </div>
  </div>

  <!-- Hero Score & Metrics (Bento Grid) -->
  <div class="hero-grid">
    <div class="card score-card">
      <div class="gauge-wrapper">
        <svg class="gauge-svg" viewBox="0 0 100 100">
          <circle class="gauge-bg" cx="50" cy="50" r="42" />
          <circle id="scoreBar" class="gauge-bar" cx="50" cy="50" r="42" stroke="#38bdf8" stroke-dasharray="264" stroke-dashoffset="264" />
        </svg>
        <div id="scoreNumber" class="gauge-text">0%</div>
      </div>
      <div id="gradeBadge" class="grade-badge badge-HIGH">Grade -</div>
      <div id="targetFileName" style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">Loading...</div>
    </div>

    <div class="metrics-grid">
      <div class="stat-box">
        <div class="stat-label">Total Resources</div>
        <div id="statResources" class="stat-value">0</div>
        <div class="stat-desc">Parsed K8s manifests</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Containers</div>
        <div id="statContainers" class="stat-value">0</div>
        <div class="stat-desc">Workload container specs</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">PSS Security Breaches</div>
        <div id="statCritical" class="stat-value" style="color: var(--rose);">0</div>
        <div class="stat-desc">Critical & High findings</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Routing Status</div>
        <div id="statRouting" class="stat-value" style="font-size: 16px; color: var(--emerald);">Connected</div>
        <div class="stat-desc">Service-to-Pod selector link</div>
      </div>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="nav-tabs">
    <button id="tabBtn1" class="tab-btn active" onclick="switchTab('source')">📄 Manifest & Diagnostics</button>
    <button id="tabBtn2" class="tab-btn" onclick="switchTab('topology')">🕸️ Resource Topology</button>
    <button id="tabBtn3" class="tab-btn" onclick="switchTab('diff')">⚖️ Auto-Hardener Diff</button>
    <button id="tabBtn4" class="tab-btn" onclick="switchTab('export')">📦 Markdown Report</button>
  </div>

  <!-- Tab 1: Manifest & Findings -->
  <div id="viewSource">
    <div class="filter-bar">
      <div class="search-box">
        <input type="text" id="searchInput" class="search-input" placeholder="Search rules (e.g. SEC-001, root, memory limits, selector)..." oninput="applyFilters()" />
      </div>
      <div class="pill-group">
        <button class="pill active" onclick="setSeverityFilter('ALL', this)">All</button>
        <button class="pill" onclick="setSeverityFilter('CRITICAL', this)">Critical</button>
        <button class="pill" onclick="setSeverityFilter('HIGH', this)">High</button>
        <button class="pill" onclick="setSeverityFilter('MEDIUM', this)">Medium</button>
        <button class="pill" onclick="setSeverityFilter('LOW', this)">Low</button>
      </div>
    </div>

    <div class="split-layout">
      <!-- Left: Code -->
      <div class="code-editor">
        <div class="code-header">
          <span id="codeHeaderTitle">Manifest YAML</span>
          <span>Read-only Inspector</span>
        </div>
        <div id="codeBody" class="code-body"></div>
      </div>

      <!-- Right: Findings List -->
      <div id="findingsList" class="findings-column"></div>
    </div>
  </div>

  <!-- Tab 2: Topology -->
  <div id="viewTopology" style="display: none;">
    <div class="card">
      <h3 style="font-size: 16px; margin-bottom: 12px; font-weight: 700;">Service & Workload Routing Topology</h3>
      <div id="topologyNodesContainer" style="margin-bottom: 20px;"></div>
      <h4 style="font-size: 14px; margin-bottom: 8px; color: var(--text-muted);">Mermaid.js Flowchart Representation:</h4>
      <pre id="mermaidText" class="diff-panel"></pre>
    </div>
  </div>

  <!-- Tab 3: Side-by-Side Diff -->
  <div id="viewDiff" style="display: none;">
    <div class="card" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700;">Automated PSS Hardening Diff</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Inspect automated non-root execution, resource limits, capabilities dropping, and probes.</p>
        </div>
        <button class="btn btn-success" onclick="saveHardenedToDisk()">💾 Save Changes to Disk</button>
      </div>
    </div>
    <div class="diff-wrapper">
      <div>
        <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">CURRENT MANIFEST</div>
        <div id="diffOriginal" class="diff-panel"></div>
      </div>
      <div>
        <div style="font-size: 12px; font-weight: 700; color: var(--emerald); margin-bottom: 8px;">HARDENED REPLACEMENT</div>
        <div id="diffHardened" class="diff-panel"></div>
      </div>
    </div>
  </div>

  <!-- Tab 4: Markdown Export -->
  <div id="viewExport" style="display: none;">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 16px; font-weight: 700;">Generated CI & Security Audit Report</h3>
        <button class="btn" onclick="copyMarkdownReport()">📋 Copy Markdown</button>
      </div>
      <pre id="exportMarkdownText" class="diff-panel" style="max-height: 520px;"></pre>
    </div>
  </div>

  <!-- Footer Shortcuts -->
  <div class="footer-bar">
    <div>
      Keyboard Shortcuts:
      <span class="kbd">/</span> Search &bull;
      <span class="kbd">1-4</span> Switch Tabs &bull;
      <span class="kbd">H</span> Harden &bull;
      <span class="kbd">R</span> Reload
    </div>
    <div>KubeSmith • Author: <a href="https://jatinsh.netlify.app/" target="_blank" style="color: var(--cyan); text-decoration: none;">Jatin Sharma</a> (@raghav1924)</div>
  </div>

  <div id="toast">Notice message</div>

  <script>
    let currentReports = [];
    let selectedIdx = 0;
    let activeSeverity = 'ALL';

    async function loadData() {
      try {
        const res = await fetch('/api/audit');
        const data = await res.json();
        currentReports = data.reports || [];
        populateDropdown();
        renderActiveReport();
        showToast('Manifests synchronized successfully');
      } catch (err) {
        showToast('Error connecting to KubeSmith server');
      }
    }

    function populateDropdown() {
      const select = document.getElementById('fileDropdown');
      select.innerHTML = '';
      currentReports.forEach((r, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = \`\${r.fileName} (\${r.score}%) [\${r.grade}]\`;
        select.appendChild(opt);
      });
      select.value = selectedIdx;
    }

    function onFileChange() {
      selectedIdx = parseInt(document.getElementById('fileDropdown').value, 10) || 0;
      renderActiveReport();
    }

    function renderActiveReport() {
      const r = currentReports[selectedIdx];
      if (!r) return;

      document.getElementById('targetFileName').textContent = r.fileName;
      document.getElementById('codeHeaderTitle').textContent = r.fileName;

      // Update Gauge
      const score = r.score;
      document.getElementById('scoreNumber').textContent = score + '%';
      const offset = 264 - (264 * (score / 100));
      const bar = document.getElementById('scoreBar');
      bar.style.strokeDashoffset = offset;

      let color = '#38bdf8';
      let badgeClass = 'badge-MEDIUM';
      if (score >= 90) { color = '#10b981'; badgeClass = 'badge-CRITICAL'; }
      else if (score >= 75) { color = '#38bdf8'; badgeClass = 'badge-MEDIUM'; }
      else if (score >= 50) { color = '#f59e0b'; badgeClass = 'badge-HIGH'; }
      else { color = '#f43f5e'; badgeClass = 'badge-CRITICAL'; }

      bar.style.stroke = color;
      const gradeBadge = document.getElementById('gradeBadge');
      gradeBadge.textContent = 'Grade ' + r.grade;
      gradeBadge.className = 'grade-badge ' + badgeClass;

      // Stats
      document.getElementById('statResources').textContent = r.stats.totalResources;
      document.getElementById('statContainers').textContent = r.stats.totalContainers;
      document.getElementById('statCritical').textContent = (r.stats.criticalCount + r.stats.highCount);
      const isRoutingOk = r.topology.unconnectedServices.length === 0;
      const routingEl = document.getElementById('statRouting');
      routingEl.textContent = isRoutingOk ? 'Healthy' : 'Disconnected (' + r.topology.unconnectedServices.length + ')';
      routingEl.style.color = isRoutingOk ? 'var(--emerald)' : 'var(--rose)';

      renderCodeAndFindings(r);
      renderTopologyView(r);
      prepareDiff(r);
      renderExportMarkdown(r);
    }

    function renderCodeAndFindings(r) {
      const raw = r.rawContent || '';
      const lines = raw.split('\\n');
      const findingLines = new Set();
      r.findings.forEach(f => findingLines.add(f.line));

      const codeContainer = document.getElementById('codeBody');
      codeContainer.innerHTML = '';
      lines.forEach((lineText, idx) => {
        const lineNo = idx + 1;
        const lineEl = document.createElement('div');
        lineEl.className = 'code-line' + (findingLines.has(lineNo) ? ' line-has-finding' : '');
        lineEl.innerHTML = \`<span class="line-no">\${lineNo}</span><span class="line-text">\${escapeHtml(lineText)}</span>\`;
        codeContainer.appendChild(lineEl);
      });

      applyFilters();
    }

    function applyFilters() {
      const r = currentReports[selectedIdx];
      if (!r) return;

      const query = (document.getElementById('searchInput').value || '').toLowerCase();
      const container = document.getElementById('findingsList');
      container.innerHTML = '';

      const filtered = r.findings.filter(f => {
        if (activeSeverity !== 'ALL' && f.severity !== activeSeverity) return false;
        if (query) {
          const matchId = f.id.toLowerCase().includes(query);
          const matchTitle = f.title.toLowerCase().includes(query);
          const matchMsg = f.message.toLowerCase().includes(query);
          return matchId || matchTitle || matchMsg;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; padding: 20px; text-align: center;">No findings matching current filter.</div>';
        return;
      }

      filtered.forEach(f => {
        const card = document.createElement('div');
        card.className = \`finding-card severity-\${f.severity}\`;
        card.innerHTML = \`
          <div class="finding-top">
            <span class="rule-tag badge-\${f.severity}">\${f.severity} &bull; \${f.id}</span>
            <span style="font-size: 12px; color: var(--text-muted);">Line \${f.line}</span>
          </div>
          <div class="finding-title">\${f.title}</div>
          <div class="finding-msg">\${f.message}</div>
          \${f.autoFixSnippet ? \`<div class="fix-box">\${escapeHtml(f.autoFixSnippet)}</div>\` : ''}
        \`;
        container.appendChild(card);
      });
    }

    function setSeverityFilter(sev, el) {
      activeSeverity = sev;
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      applyFilters();
    }

    function renderTopologyView(r) {
      const container = document.getElementById('topologyNodesContainer');
      container.innerHTML = '';

      r.topology.nodes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.marginBottom = '10px';
        if (n.isOrphaned) {
          div.style.borderColor = 'var(--rose)';
        }
        div.innerHTML = \`
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>\${n.kind}: \${n.name}</strong>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #1e293b;">
              \${n.isOrphaned ? '⚠️ DISCONNECTED (No matching workload)' : 'Active Routing'}
            </span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Namespace: \${n.namespace} &bull; Targets: \${n.connectedTo.length > 0 ? n.connectedTo.join(', ') : 'None'}
          </div>
        \`;
        container.appendChild(div);
      });

      document.getElementById('mermaidText').textContent = r.topology.mermaid || 'flowchart TD;';
    }

    async function prepareDiff(r) {
      document.getElementById('diffOriginal').textContent = r.rawContent || '';
      try {
        const res = await fetch('/api/harden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: r.rawContent, filePath: r.filePath, save: false })
        });
        const data = await res.json();
        document.getElementById('diffHardened').textContent = data.hardenedYaml;
      } catch (e) {
        document.getElementById('diffHardened').textContent = 'Error computing hardened diff';
      }
    }

    async function hardenCurrentFile() {
      const r = currentReports[selectedIdx];
      if (!r) return;
      try {
        const res = await fetch('/api/harden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: r.filePath, save: true })
        });
        const data = await res.json();
        showToast('Hardened & saved ' + r.fileName + ' (' + data.appliedFixes.length + ' fixes applied)');
        loadData();
      } catch (e) {
        showToast('Error applying hardening fixes');
      }
    }

    async function saveHardenedToDisk() {
      await hardenCurrentFile();
    }

    function renderExportMarkdown(r) {
      const md = [
        \`# KubeSmith Audit Report: \${r.fileName}\`,
        \`- Health Score: \${r.score}/100 [Grade \${r.grade}]\`,
        \`- Total Resources: \${r.stats.totalResources} | Containers: \${r.stats.totalContainers}\`,
        \`- Critical: \${r.stats.criticalCount} | High: \${r.stats.highCount} | Medium: \${r.stats.mediumCount}\`,
        '',
        '## Identified Findings',
        ...r.findings.map(f => \`- [\${f.severity}] \${f.id}: \${f.title} (Line \${f.line})\\n  \${f.message}\\n  Remediation: \${f.remediation}\`),
        '',
        'Generated by KubeSmith (https://github.com/raghav1924/kubesmith)'
      ].join('\\n');

      document.getElementById('exportMarkdownText').textContent = md;
    }

    function copyMarkdownReport() {
      const text = document.getElementById('exportMarkdownText').textContent;
      navigator.clipboard.writeText(text);
      showToast('Markdown report copied to clipboard');
    }

    function exportReport() {
      switchTab('export');
      copyMarkdownReport();
    }

    function switchTab(tab) {
      document.getElementById('viewSource').style.display = tab === 'source' ? 'block' : 'none';
      document.getElementById('viewTopology').style.display = tab === 'topology' ? 'block' : 'none';
      document.getElementById('viewDiff').style.display = tab === 'diff' ? 'block' : 'none';
      document.getElementById('viewExport').style.display = tab === 'export' ? 'block' : 'none';

      document.getElementById('tabBtn1').className = 'tab-btn' + (tab === 'source' ? ' active' : '');
      document.getElementById('tabBtn2').className = 'tab-btn' + (tab === 'topology' ? ' active' : '');
      document.getElementById('tabBtn3').className = 'tab-btn' + (tab === 'diff' ? ' active' : '');
      document.getElementById('tabBtn4').className = 'tab-btn' + (tab === 'export' ? ' active' : '');
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3000);
    }

    function escapeHtml(str) {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      } else if (e.key === '1') switchTab('source');
      else if (e.key === '2') switchTab('topology');
      else if (e.key === '3') switchTab('diff');
      else if (e.key === '4') switchTab('export');
      else if (e.key.toLowerCase() === 'h') hardenCurrentFile();
      else if (e.key.toLowerCase() === 'r') loadData();
    });

    window.onload = loadData;
  </script>
</body>
</html>`;
  }
}

export function startStudioServer(port = 5454, targetDir = process.cwd()): http.Server {
  const studio = new KubeSmithStudio(port, targetDir);
  return studio.start();
}
