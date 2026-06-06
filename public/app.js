async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

function renderTimeline(steps) {
  const timeline = document.querySelector('#timeline');
  timeline.innerHTML = '';
  for (const step of steps) {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${step.state}</strong> · ${step.actor}<br>${step.event}`;
    timeline.appendChild(item);
  }
}

async function loadCase() {
  const demo = await fetchJson('/api/demo-data');
  document.querySelector('#case-card').textContent = JSON.stringify({
    bl_id: demo.bill_of_lading.bl_id,
    cargo: demo.bill_of_lading.cargo,
    route: `${demo.bill_of_lading.port_of_loading} → ${demo.bill_of_lading.port_of_discharge}`,
    requested_amount: `${demo.financing.requested_amount_usd} ${demo.financing.currency}`
  }, null, 2);
}

async function runDemo() {
  const result = await fetchJson('/api/workflow/simulate', { method: 'POST' });
  document.querySelector('#risk-card').textContent = JSON.stringify(result.risk_report, null, 2);
  renderTimeline(result.steps);
}

document.querySelector('#run-demo').addEventListener('click', runDemo);
loadCase().catch((error) => {
  document.querySelector('#case-card').textContent = error.message;
});

// ==================== MCP Console ====================
let toolsManifest = [];
(async () => {
  try {
    const data = await fetchJson('/api/mcp/tools');
    toolsManifest = data.tools;
    document.querySelector('#mcp-manifest').textContent = JSON.stringify(data, null, 2);
    for (const tool of toolsManifest) {
      const opt = document.createElement('option');
      opt.value = tool.name; opt.textContent = tool.name;
      document.querySelector('#mcp-tool-select').appendChild(opt);
    }
  } catch (e) { document.querySelector('#mcp-manifest').textContent = 'Error: ' + e.message; }
})();

const toolSelect = document.querySelector('#mcp-tool-select');
toolSelect.addEventListener('change', () => {
  const tool = toolsManifest.find(t => t.name === toolSelect.value);
  const paramsDiv = document.querySelector('#mcp-params');
  const callBtn = document.querySelector('#mcp-call-btn');
  paramsDiv.innerHTML = ''; callBtn.disabled = true;
  if (!tool) { paramsDiv.innerHTML = '<p class="hint">Select a tool.</p>'; return; }

  const props = tool.inputSchema.properties || {};
  const html = [];
  for (const [key, schema] of Object.entries(props)) {
    html.push(`<label>${key} <span class="type-hint">(${schema.type})</span></label>`);
    html.push(`<input id="param-${key}" placeholder="${(schema.description || '').slice(0, 50)}" />`);
  }
  paramsDiv.innerHTML = html.join('\n');
  const ci = document.querySelector('#param-case_id'); if (ci && !ci.value) ci.value = 'CASE-EBL-2026-0001';
  const cq = document.querySelector('#param-query'); if (cq && !cq.value) cq.value = 'Red Sea risk';
  callBtn.disabled = false;
});

document.querySelector('#mcp-call-btn').addEventListener('click', async () => {
  const params = {};
  document.querySelectorAll('#mcp-params input').forEach(el => {
    const val = el.value.trim(); if (!val) return;
    params[el.id.replace('param-', '')] = val.startsWith('{') ? (() => { try { return JSON.parse(val); } catch { return val; } })() : val;
  });
  const resultEl = document.querySelector('#mcp-result');
  const statusEl = document.querySelector('#mcp-status');
  resultEl.textContent = 'Calling...';
  try {
    const data = await fetchJson('/api/mcp/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: toolSelect.value, params }) });
    resultEl.textContent = JSON.stringify(data.result || data, null, 2);
    statusEl.textContent = 'OK'; statusEl.className = 'ok';
  } catch (e) { resultEl.textContent = 'Error: ' + e.message; statusEl.textContent = 'FAIL'; statusEl.className = 'fail'; }
});

// ==================== RAG Console ====================
const catLabels = { war_risk: 'War', sanction_risk: 'Sanctions', port_congestion: 'Port', severe_weather: 'Weather', commodity_volatility: 'Commodity', fx_volatility: 'FX', buyer_country_risk: 'Buyer' };
for (const [v, label] of Object.entries(catLabels)) {
  const opt = document.createElement('option'); opt.value = v; opt.textContent = label;
  document.querySelector('#rag-category').appendChild(opt);
}

(async () => {
  try {
    const data = await fetchJson('/api/rag/judge-qa');
    const el = document.querySelector('#judge-qa');
    el.innerHTML = '';
    for (const pair of data.pairs) {
      const d = document.createElement('details');
      d.innerHTML = `<summary><strong>${pair.id}</strong>: ${pair.question}</summary><p>${pair.answer}</p><p class="qa-source">${pair.source}</p>`;
      el.appendChild(d);
    }
  } catch (e) { document.querySelector('#judge-qa').textContent = 'Error: ' + e.message; }
})();

document.querySelector('#rag-search-btn').addEventListener('click', async () => {
  const query = document.querySelector('#rag-query').value.trim(); if (!query) return;
  const el = document.querySelector('#rag-results');
  el.innerHTML = '<p>Searching...</p>';
  try {
    const body = { query }; const cat = document.querySelector('#rag-category').value; if (cat) body.categories = [cat];
    const data = await fetchJson('/api/rag/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (data.matches.length === 0) { el.innerHTML = `<p class="no-results">No results for "${query}".</p>`; return; }
    el.innerHTML = `<p class="results-count">${data.match_count} results:</p>`;
    for (const m of data.matches) {
      const div = document.createElement('div');
      div.className = `rag-entry sev-${m.severity}`;
      div.innerHTML = `<div class="rag-entry-header"><span class="rag-severity sev-${m.severity}">${m.severity}</span><span class="rag-category">${catLabels[m.category] || m.category}</span><span class="rag-score">${m._score || ''}</span></div><h4>${m.title}</h4><p>${m.summary || ''}</p><p class="rag-region">${m.region || ''} · ${m.date || ''}</p>`;
      el.appendChild(div);
    }
  } catch (e) { el.innerHTML = `<p class="error">${e.message}</p>`; }
});

document.querySelector('#rag-query').addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('#rag-search-btn').click(); });
