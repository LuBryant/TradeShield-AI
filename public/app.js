// TradeShield AI-pricing dashboard — orchestration + rendering.
//
// One spine, end to end: pick a trade case + payout speed (FE-7/FE-1) → the AI
// pricing engine returns a PricingQuote → we render the Exporter quote (FE-1/2),
// the AI Pricing Console waterfall (FE-5), the Investor offering + risk factors
// + subscribe (FE-3/4/8/10), the on-chain RiskPricingOracle anchoring (FE-9),
// and the smart-contract lifecycle (FE-6), with an in-transit risk injection
// that shows the AI reprice or pause. Every number comes from the live engine.

import * as api from './api.js';
import * as f from './format.js';

// ---- tiny DOM helpers ------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// In-transit risk event used by the "Simulate risk" button — pushes most cases
// from clean → reprice, and an already-stressed case → pause.
const INJECT_EVENTS = [
  { category: 'macro', type: 'severe_weather', region: 'East China Sea', severity: 'warning',
    description: 'Typhoon-season system threatens the discharge window.' },
  { category: 'shipment', type: 'route_deviation', severity: 'warning',
    description: 'Vessel reroutes around a security advisory zone; longer transit.' }
];

// ---- state -----------------------------------------------------------------
const state = {
  cases: [],
  caseId: null,
  caseData: null,
  comparison: null,
  speed: 'BALANCED',
  injected: false,
  subscriptionUsd: null
};

function selectedQuote() {
  const quotes = state.comparison?.quotes ?? [];
  return quotes.find((q) => q.payout_speed === state.speed) ?? quotes[0] ?? null;
}

// ===========================================================================
// Boot
// ===========================================================================
async function boot() {
  wireStaticHandlers();
  loadJudgeQA();
  try {
    state.cases = await api.getCases();
  } catch (e) {
    toast('Failed to load cases: ' + e.message, true);
    return;
  }
  renderScenarioSelector();
  renderSpeedSelector();
  await selectCase(state.cases[0]?.case_id);
}

// ===========================================================================
// Selection handlers
// ===========================================================================
async function selectCase(caseId) {
  const entry = state.cases.find((c) => c.case_id === caseId);
  if (!entry) return;
  state.caseId = caseId;
  state.caseData = entry.case;
  state.injected = false;
  state.subscriptionUsd = null;
  highlightScenario();
  setBusy(true);
  try {
    state.comparison = await api.compareSpeeds(entry.case);
    // Default to the AI's recommended speed for this case.
    state.speed = state.comparison.recommended_payout_speed
      ?? state.comparison.quotes?.[0]?.payout_speed ?? 'BALANCED';
    highlightSpeed();
    await refresh({ resetSubscription: true });
  } catch (e) {
    toast('Pricing failed: ' + e.message, true);
  } finally {
    setBusy(false);
  }
}

async function selectSpeed(speed) {
  if (!state.comparison?.quotes?.some((q) => q.payout_speed === speed)) return;
  state.speed = speed;
  state.injected = false;
  highlightSpeed();
  await refresh({ resetSubscription: true });
}

// Re-render everything that depends on (case, speed). `resetSubscription` reseeds
// the subscribe input to a full raise of the current quote.
async function refresh({ resetSubscription = false } = {}) {
  const quote = selectedQuote();
  if (!quote) return;
  if (resetSubscription) {
    state.subscriptionUsd = Math.round(quote.expected_cash_to_exporter_usd || quote.requested_cash_usd || 0);
  }
  renderDealStrip(quote);
  renderHeroPrice(quote);
  renderWaterfall(quote);
  renderExporterCards();
  renderInvestor(quote);
  renderRiskDims(quote);
  renderSubscribe(quote);
  await Promise.all([renderTimeline(), renderOracle(quote)]);
}

// ===========================================================================
// Top controls
// ===========================================================================
function renderScenarioSelector() {
  const box = $('#scenario-select');
  clear(box);
  for (const c of state.cases) {
    box.append(el('button', {
      class: 'seg-btn', role: 'tab', 'data-case': c.case_id,
      title: c.label, onclick: () => selectCase(c.case_id)
    },
      el('span', { class: 'seg-main', text: shortLabel(c) }),
      c.risk_hint ? el('span', { class: `seg-hint tone-${f.riskTone(c.risk_hint)}`, text: c.risk_hint }) : null
    ));
  }
}

function shortLabel(c) {
  // "Clean copper · Singapore → Shanghai" -> "Clean copper"
  return (c.label || c.case_id).split('·')[0].trim();
}

function renderSpeedSelector() {
  const box = $('#speed-select');
  clear(box);
  for (const speed of ['FAST', 'BALANCED', 'LOW_COST']) {
    const meta = f.SPEED_META[speed];
    box.append(el('button', {
      class: 'seg-btn', role: 'tab', 'data-speed': speed,
      onclick: () => selectSpeed(speed)
    },
      el('span', { class: 'seg-main', text: meta.label }),
      el('span', { class: 'seg-hint', text: meta.sub })
    ));
  }
}

function highlightScenario() {
  document.querySelectorAll('#scenario-select .seg-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.case === state.caseId));
}
function highlightSpeed() {
  const rec = state.comparison?.recommended_payout_speed;
  document.querySelectorAll('#speed-select .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.speed === state.speed);
    b.classList.toggle('recommended', b.dataset.speed === rec);
  });
}

// ===========================================================================
// Hero + deal strip
// ===========================================================================
function renderDealStrip(quote) {
  const bl = state.caseData?.bill_of_lading ?? {};
  const strip = $('#deal-strip');
  clear(strip);
  const pills = [
    ['Route', bl.port_of_loading && bl.port_of_discharge ? `${bl.port_of_loading} → ${bl.port_of_discharge}` : '—'],
    ['Cargo', bl.cargo ? `${bl.cargo}${bl.quantity_mt ? ` · ${f.int(bl.quantity_mt)} MT` : ''}` : '—'],
    ['eBL', bl.bl_id ? `${bl.bl_id}${bl.ebl_platform ? ` · ${bl.ebl_platform}` : ''}` : '—'],
    ['Declared value', bl.declared_value_usd ? f.usd(bl.declared_value_usd) : '—'],
    ['AI-verified collateral', f.usd(quote.ai_verified_collateral_value_usd)]
  ];
  for (const [k, v] of pills) {
    strip.append(el('span', { class: 'deal-pill' },
      el('span', { class: 'deal-pill-k', text: k }),
      el('span', { class: 'deal-pill-v', text: v })));
  }
}

function renderHeroPrice(quote) {
  const act = f.actionMeta(quote.pricing_action);
  const box = $('#hero-price');
  clear(box);
  box.append(
    el('span', { class: 'metric-label', text: 'AI issue price / RWA token' }),
    el('div', { class: 'hero-price-val' },
      el('span', { class: 'currency', text: '$' }),
      el('span', { id: 'hero-price-num', text: f.price(quote.final_issue_price_usd) })
    ),
    el('div', { class: 'hero-price-meta' },
      el('span', { class: `badge tone-${act.tone}`, text: `${act.icon} ${act.label}` }),
      el('span', { class: 'hero-yield', html: `<strong>${f.bpsToPct(quote.implied_gross_yield_bps)}</strong> implied gross upside` })
    ),
    el('div', { class: 'hero-target', html: `redeems toward <strong>$1.00</strong> · ${f.SPEED_META[quote.payout_speed].label} payout` })
  );
}

// ===========================================================================
// FE-5 AI Pricing Console — waterfall
// ===========================================================================
function renderWaterfall(quote) {
  const wf = $('#waterfall');
  clear(wf);

  const base = quote.base_issue_price_usd;
  const urg = quote.urgency_discount_bps / 10000;
  const risk = quote.risk_discount_bps / 10000;
  const speedPrice = base - urg;          // after urgency
  const indicative = quote.indicative_issue_price_usd;
  const final = quote.final_issue_price_usd;
  const floorNode = (quote.evidence_graph ?? []).find((n) => n.component === 'collateral_floor');
  const floorPrice = floorNode?.price_usd ?? null;
  const lifted = quote.binding_constraint === 'COLLATERAL' && final > indicative + 1e-6;

  // Broken axis: zoom from just below the smallest bar up to the 1.00 target.
  const lo = Math.max(0.4, Math.floor((Math.min(indicative, final, base) - 0.06) * 20) / 20);
  const hi = 1.0;
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

  const cols = [
    { kind: 'target', label: 'Target redemption', value: 1.0, top: 1.0, bottom: lo, note: 'redemption value' },
    { kind: 'base', label: 'Base price', value: base, top: base, bottom: lo, note: 'patient-money anchor' },
    { kind: 'down', label: 'Urgency', value: -urg, top: base, bottom: speedPrice, note: `${f.SPEED_META[quote.payout_speed].label} · −${quote.urgency_discount_bps} bps` },
    { kind: 'down', label: 'Risk', value: -risk, top: speedPrice, bottom: indicative, note: `${quote.risk_level} · −${quote.risk_discount_bps} bps` },
    { kind: 'mid', label: 'Indicative', value: indicative, top: indicative, bottom: lo, note: 'profit-share price' }
  ];
  if (lifted) {
    cols.push({ kind: 'up', label: 'Collateral floor', value: final - indicative, top: final, bottom: indicative, note: 'lifted to safe coverage' });
  }
  cols.push({ kind: 'final', label: 'Final issue price', value: final, top: final, bottom: lo, note: `${f.bpsToPct(quote.implied_gross_yield_bps)} upside to $1.00` });

  // axis + 1.00 reference line. Tracks and labels live in two aligned flex rows
  // so the $1.00 line (absolute in the tracks row) lines up with the bars.
  const chart = el('div', { class: 'wf-chart' });
  const colsRow = el('div', { class: 'wf-cols' });
  const labelsRow = el('div', { class: 'wf-labels' });
  colsRow.append(el('div', { class: 'wf-target-line', style: `bottom:${pos(1.0)}%` },
    el('span', { class: 'wf-axis-tag', text: '$1.00 target' })));

  for (const c of cols) {
    const isDown = c.kind === 'down';
    const isUp = c.kind === 'up';
    const barBottom = pos(Math.min(c.top, c.bottom));
    const barHeight = Math.abs(pos(c.top) - pos(c.bottom));
    const valueText = (isDown || isUp)
      ? `${isDown ? '−' : '+'}${f.price(Math.abs(c.value))}`
      : `$${f.price(c.value)}`;

    const bar = el('div', { class: `wf-bar wf-${c.kind}`, style: `bottom:${barBottom}%; height:${Math.max(barHeight, 0.6)}%` });
    colsRow.append(el('div', { class: `wf-col wf-col-${c.kind}` },
      el('div', { class: 'wf-track' },
        bar,
        el('span', { class: 'wf-val', style: `bottom:${pos(c.top)}%`, text: valueText })
      )
    ));
    labelsRow.append(el('div', { class: `wf-col-label wf-col-${c.kind}` },
      el('span', { class: 'wf-col-name', text: c.label }),
      el('span', { class: 'wf-col-note', text: c.note })
    ));
  }
  chart.append(colsRow, labelsRow);
  wf.append(chart);
  wf.append(el('p', { class: 'wf-axis-foot', text: `axis zoomed to ${f.price(lo)}–1.00 · binding constraint: ${quote.binding_constraint}` }));

  $('#console-explain').textContent = quote.exporter_explanation || '';
}

// ===========================================================================
// FE-1 / FE-2 Exporter speed cards
// ===========================================================================
function renderExporterCards() {
  const box = $('#speed-cards');
  clear(box);
  const quotes = state.comparison?.quotes ?? [];
  const rec = state.comparison?.recommended_payout_speed;
  for (const q of quotes) {
    const meta = f.SPEED_META[q.payout_speed];
    const act = f.actionMeta(q.pricing_action);
    const isActive = q.payout_speed === state.speed;
    const card = el('button', {
      class: `speed-card${isActive ? ' active' : ''}`, 'data-speed': q.payout_speed,
      onclick: () => selectSpeed(q.payout_speed)
    },
      el('div', { class: 'speed-card-head' },
        el('div', {},
          el('span', { class: 'speed-card-title', text: meta.label }),
          el('span', { class: 'speed-card-sub', text: meta.sub })
        ),
        q.payout_speed === rec ? el('span', { class: 'rec-badge', text: '★ AI pick' }) : null
      ),
      el('div', { class: 'speed-card-price' },
        el('span', { class: 'big', text: `$${f.price(q.final_issue_price_usd)}` }),
        el('span', { class: 'unit', text: '/ token' })
      ),
      el('div', { class: 'speed-card-rows' },
        kvRow('Cash to exporter', f.usd(q.expected_cash_to_exporter_usd)),
        kvRow('Financing cost', f.usd(q.financing_cost_usd), 'cost'),
        kvRow('% of trade profit', f.bpsToPct(q.exporter_profit_share_bps), shareTone(q)),
        kvRow('Net profit kept', f.usd(q.exporter_net_profit_usd), 'gain'),
        kvRow('Token supply', f.int(q.recommended_token_supply))
      ),
      el('div', { class: 'speed-card-foot' },
        el('span', { class: `badge sm tone-${act.tone}`, text: act.label })
      )
    );
    box.append(card);
  }
  $('#exporter-explain').textContent = selectedQuote()?.exporter_explanation || '';
}

function kvRow(k, v, tone) {
  return el('div', { class: 'kvrow' },
    el('span', { class: 'kvrow-k', text: k }),
    el('span', { class: `kvrow-v${tone ? ' ' + tone : ''}`, text: v }));
}
function shareTone(q) {
  const pct = q.exporter_profit_share_bps / 100;
  return pct > 65 ? 'cost' : pct > 50 ? 'warn-text' : '';
}

// ===========================================================================
// FE-3 / FE-4 / FE-8 / FE-10 Investor offering
// ===========================================================================
function renderInvestor(quote) {
  $('#inv-price').textContent = `$${f.price(quote.final_issue_price_usd)}`;
  $('#inv-yield').innerHTML = `<span>${f.bpsToPct(quote.implied_gross_yield_bps)}</span><small>implied gross yield</small>`;
  $('#inv-supply').textContent = f.int(quote.recommended_token_supply);

  const riskEl = $('#inv-risk');
  riskEl.textContent = quote.risk_level;
  riskEl.className = `badge tone-${f.riskTone(quote.risk_level)}`;

  const act = f.actionMeta(quote.pricing_action);
  const actEl = $('#inv-action');
  actEl.textContent = act.label;
  actEl.className = `badge tone-${act.tone}`;

  $('#investor-explain').textContent = quote.investor_explanation || '';
}

function renderRiskDims(quote) {
  const box = $('#risk-dims');
  clear(box);
  const dims = f.rollupRiskDimensions(quote.risk_factors);
  for (const d of dims) {
    const tone = d.active ? f.bpsTone(d.bps) : 'muted';
    const chip = el('div', {
      class: `risk-dim tone-${tone}${d.active ? ' active' : ''}`,
      title: d.factors.join('\n') || 'No signal detected'
    },
      el('span', { class: 'risk-dim-icon', text: d.icon }),
      el('div', { class: 'risk-dim-body' },
        el('span', { class: 'risk-dim-label', text: d.label }),
        el('span', { class: 'risk-dim-bps', text: !d.active ? 'clear' : d.bps > 0 ? `+${d.bps} bps` : 'flagged' })
      )
    );
    box.append(chip);
  }
  $('#risk-total').textContent = `${f.int(quote.risk_score_bps)} bps total · ${quote.risk_level}`;
  $('#risk-total').className = `risk-total tone-${f.riskTone(quote.risk_level)}`;

  const cites = f.intelCitations(quote);
  const citeBox = $('#intel-cites');
  clear(citeBox);
  if (cites.length) {
    citeBox.append(el('span', { class: 'cite-head', text: 'Grounded in RAG intel:' }));
    for (const c of cites) citeBox.append(el('span', { class: 'cite', text: c }));
  }
}

// ---- FE-8 subscribe mock ---------------------------------------------------
function renderSubscribe(quote) {
  const input = $('#sub-input');
  const btn = $('#sub-btn');
  const paused = ['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION'].includes(quote.pricing_action);
  input.value = state.subscriptionUsd ?? '';
  input.disabled = paused;
  btn.disabled = paused;
  if (paused) {
    $('#sub-result').innerHTML = '<span class="sub-paused">Offering is not open — subscription disabled by the RiskPricingOracle.</span>';
  } else {
    computeSubscription(quote);
  }
}

function computeSubscription(quote) {
  const price = quote.final_issue_price_usd;
  const sub = Number($('#sub-input').value) || 0;
  state.subscriptionUsd = sub;
  const tokens = Math.floor(Math.min(sub / price, quote.recommended_token_supply));
  const cost = tokens * price;
  const redemption = tokens * 1.0;
  const upside = redemption - cost;
  const res = $('#sub-result');
  if (sub <= 0 || tokens <= 0) { res.innerHTML = '<span class="muted">Enter an amount to see the RWA you receive.</span>'; return; }
  res.innerHTML = '';
  res.append(
    el('div', { class: 'sub-line big' }, `You receive `, el('strong', { text: f.int(tokens) }), ` RWA tokens`),
    el('div', { class: 'sub-grid' },
      miniKv('Cost now', f.usd(cost)),
      miniKv('Target redemption', f.usd(redemption), 'gain'),
      miniKv('Target upside', f.usd(upside), 'gain'),
      miniKv('Gross yield', f.bpsToPct(quote.implied_gross_yield_bps), 'gain')
    ),
    el('div', { class: 'sub-foot muted', text: 'Target, not guaranteed — subject to importer payment & settlement.' })
  );
}
function miniKv(k, v, tone) {
  return el('div', { class: 'mini-kv' },
    el('span', { class: 'mini-kv-k', text: k }),
    el('span', { class: `mini-kv-v${tone ? ' ' + tone : ''}`, text: v }));
}

// ===========================================================================
// FE-6 Smart-contract lifecycle
// ===========================================================================
async function renderTimeline() {
  const lifecycleBox = $('#lifecycle');
  const tl = $('#timeline');
  let offering;
  try {
    offering = await api.simulateOffering(state.caseData, {
      payout_speed: state.speed,
      events: state.injected ? INJECT_EVENTS : undefined
    });
  } catch (e) {
    tl.innerHTML = `<li class="error">Lifecycle failed: ${e.message}</li>`;
    return;
  }

  const reached = new Set(offering.steps.map((s) => s.state));
  const endState = offering.final_state;

  // Stepper: canonical states, lit when reached.
  clear(lifecycleBox);
  const seq = f.LIFECYCLE.filter((s) => {
    if (s === 'Repriced') return reached.has('Repriced');
    if (s === 'Paused') return reached.has('Paused') || endState === 'Paused';
    return true;
  });
  seq.forEach((s, i) => {
    const on = reached.has(s) || (s === endState);
    const isEnd = s === endState;
    if (i > 0) lifecycleBox.append(el('span', { class: `lc-link${on ? ' on' : ''}` }));
    lifecycleBox.append(el('div', {
      class: `lc-node tone-${on ? f.stateTone(s) : 'muted'}${on ? ' on' : ''}${isEnd ? ' end' : ''}`
    },
      el('span', { class: 'lc-dot' }),
      el('span', { class: 'lc-name', text: s })
    ));
  });

  // Detailed event log.
  clear(tl);
  for (const step of offering.steps) {
    tl.append(el('li', { class: `tl-item tone-${f.stateTone(step.state)}` },
      el('div', { class: 'tl-marker' }),
      el('div', { class: 'tl-body' },
        el('div', { class: 'tl-head' },
          el('span', { class: `badge sm tone-${f.stateTone(step.state)}`, text: step.state }),
          el('span', { class: 'tl-actor', text: step.actor })
        ),
        el('div', { class: 'tl-event', text: step.event })
      )
    ));
  }

  // Reprice / pause callout when risk was injected.
  const reset = $('#risk-reset-btn');
  reset.hidden = !state.injected;
  const initial = offering.initial_quote, finalQ = offering.final_quote;
  if (state.injected && initial && finalQ) {
    const dropped = finalQ.final_issue_price_usd < initial.final_issue_price_usd;
    const paused = endState === 'Paused' || endState === 'Frozen';
    const msg = paused
      ? `⏸ Risk escalated to ${finalQ.risk_level} in transit — the AI PAUSED the offering. New evidence ${f.shortHash(finalQ.evidence_hash)}.`
      : dropped
        ? `↓ Risk escalated to ${finalQ.risk_level} — AI repriced ${f.price(initial.final_issue_price_usd)} → ${f.price(finalQ.final_issue_price_usd)} (investor upside widened to ${f.bpsToPct(finalQ.implied_gross_yield_bps)}).`
        : `Risk reassessed (${finalQ.risk_level}); price held at ${f.price(finalQ.final_issue_price_usd)}.`;
    lifecycleBox.append(el('div', { class: `lc-callout tone-${paused ? 'crit' : 'warn'}`, text: msg }));
  }
}

// ===========================================================================
// FE-9 / WEB3 On-chain anchoring
// ===========================================================================
async function renderOracle(quote) {
  $('#quote-hash').textContent = f.shortHash(quote.quote_hash, 14, 8);
  $('#quote-hash').title = quote.quote_hash || '';
  $('#evidence-hash').textContent = f.shortHash(quote.evidence_hash, 14, 8);
  $('#evidence-hash').title = quote.evidence_hash || '';

  // Hide any stale tx from a previous selection.
  $('#tx-card').hidden = true;

  let payload;
  try {
    payload = await api.oracleUpdate(state.caseData, { payout_speed: state.speed });
  } catch (e) {
    $('#oracle-payload').textContent = 'oracle payload failed: ' + e.message;
    return;
  }
  const stateEl = $('#oracle-state');
  stateEl.textContent = payload.offering_state;
  stateEl.className = `badge tone-${f.stateTone(payload.offering_state)}`;

  $('#oracle-payload').textContent = formatOracleCall(payload);
}

function formatOracleCall(p) {
  return [
    'RiskPricingOracle.updatePricing(',
    `  poolId        = "${p.pool_id ?? p.case_id}",`,
    `  issuePrice    = ${f.price(p.issue_price_usd)} USD,`,
    `  riskLevel     = ${p.risk_level} (${p.risk_score_bps} bps),`,
    `  action        = ${p.pricing_action},`,
    `  evidenceHash  = ${f.shortHash(p.evidence_hash, 12, 8)},`,
    `  quoteHash     = ${f.shortHash(p.quote_hash, 12, 8)}`,
    ');',
    '',
    `// RWAOfferingPool.createOffering`,
    `//   supply ${f.int(p.recommended_token_supply)} · target ${f.price(p.target_redemption_value_usd)} · state ${p.offering_state}`
  ].join('\n');
}

async function pushToOracle() {
  const quote = selectedQuote();
  if (!quote) return;
  const btn = $('#oracle-push-btn');
  btn.disabled = true;
  btn.textContent = '⛓ Submitting…';
  try {
    const res = await api.pushPricingToOracle(state.caseId, quote);
    const tx = res.result ?? res;
    $('#tx-card').hidden = false;
    $('#tx-result').textContent = formatTx(tx);
    toast('PricingUpdated event emitted on-chain (mock).');
  } catch (e) {
    toast('Oracle push failed: ' + e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '⛓ Push to RiskPricingOracle';
  }
}

function formatTx(tx) {
  const a = tx.event_args ?? {};
  return [
    `event:        ${tx.event ?? 'PricingUpdated'}`,
    `status:       ${tx.status ?? '—'} · ${tx.confirmations ?? 0} confs`,
    `tx_hash:      ${f.shortHash(tx.tx_hash, 14, 10)}`,
    `block:        #${f.int(tx.block_number)}`,
    `gas_used:     ${f.int(tx.gas_used)}`,
    `contract:     ${f.shortHash(tx.contract_address, 12, 8)}`,
    '',
    'PricingUpdated {',
    `  poolId:        ${a.poolId ?? '—'}`,
    `  issuePrice:    ${a.issuePrice ?? '—'}`,
    `  riskLevel:     ${a.riskLevel ?? '—'}`,
    `  pricingAction: ${a.pricingAction ?? '—'}`,
    `  evidenceHash:  ${f.shortHash(a.evidenceHash, 12, 8)}`,
    `  quoteHash:     ${f.shortHash(a.quoteHash, 12, 8)}`,
    '}'
  ].join('\n');
}

// ===========================================================================
// RAG intel + Judge Q&A
// ===========================================================================
async function loadJudgeQA() {
  try {
    const pairs = await api.getJudgeQA();
    const box = $('#judge-qa');
    clear(box);
    for (const p of pairs) {
      const d = el('details', { class: 'qa' },
        el('summary', {}, el('strong', { text: (p.id ? p.id + ': ' : '') }), p.question),
        el('p', { class: 'qa-answer', text: p.answer }),
        p.source ? el('p', { class: 'qa-source', text: p.source }) : null
      );
      box.append(d);
    }
  } catch (e) {
    $('#judge-qa').textContent = 'Q&A unavailable: ' + e.message;
  }
}

async function runRagSearch() {
  const query = $('#rag-query').value.trim();
  if (!query) return;
  const box = $('#rag-results');
  box.innerHTML = '<p class="muted">Searching…</p>';
  try {
    const data = await api.ragSearch(query);
    clear(box);
    if (!data.matches?.length) { box.innerHTML = `<p class="muted">No intel for “${query}”.</p>`; return; }
    box.append(el('p', { class: 'results-count', text: `${data.match_count} intel hits` }));
    for (const m of data.matches) {
      box.append(el('div', { class: `rag-entry tone-${f.riskTone((m.severity || '').toUpperCase()) || 'info'}` },
        el('div', { class: 'rag-entry-head' },
          el('span', { class: `badge sm tone-${sevTone(m.severity)}`, text: (m.severity || 'info').toUpperCase() }),
          el('span', { class: 'rag-cat', text: m.category || '' }),
          m._score ? el('span', { class: 'rag-score', text: `score ${m._score}` }) : null
        ),
        el('h4', { text: m.title || m.id || 'intel' }),
        el('p', { text: m.summary || '' }),
        el('p', { class: 'rag-meta', text: [m.region, m.date].filter(Boolean).join(' · ') })
      ));
    }
  } catch (e) {
    box.innerHTML = `<p class="error">${e.message}</p>`;
  }
}
function sevTone(sev) {
  return { critical: 'crit', warning: 'warn', info: 'info' }[String(sev).toLowerCase()] ?? 'info';
}

// ===========================================================================
// Misc UI
// ===========================================================================
function wireStaticHandlers() {
  $('#sub-btn').addEventListener('click', () => { const q = selectedQuote(); if (q) computeSubscription(q); });
  $('#sub-input').addEventListener('input', () => { const q = selectedQuote(); if (q && !$('#sub-input').disabled) computeSubscription(q); });
  $('#risk-inject-btn').addEventListener('click', async () => { state.injected = true; await renderTimeline(); });
  $('#risk-reset-btn').addEventListener('click', async () => { state.injected = false; await renderTimeline(); });
  $('#oracle-push-btn').addEventListener('click', pushToOracle);
  $('#rag-search-btn').addEventListener('click', runRagSearch);
  $('#rag-query').addEventListener('keydown', (e) => { if (e.key === 'Enter') runRagSearch(); });
}

function setBusy(busy) {
  $('#live-pill').classList.toggle('busy', busy);
  document.querySelector('.page')?.classList.toggle('busy', busy);
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show${isError ? ' error' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, 3600);
}

boot();
