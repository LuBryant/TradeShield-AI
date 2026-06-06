// TradeShield View ② — Voyage tracking + live RWA pricing + in-transit events.
//
// A ship moves along the route on a VIRTUAL clock (departure -> ETA). Below it,
// the live RWA price + financing progress + AI risk events (with sources) update
// in real time, and "emergency event" buttons inject in-transit risk that makes
// the AI reprice (or pause) the offering — the price visibly moves. Reprices can
// be anchored on-chain (best effort) when a wallet is connected and a pool exists.
//
// Self-contained: reads the shared store, drives the existing pricing endpoints,
// and (optionally) the web3 reprice. No imports from app.js (no cycles).

import { state, selectedQuote, liveQuote } from './store.js';
import { $, el, clear, toast } from './dom.js';
import * as f from './format.js';
import * as api from './api.js';
import * as web3 from './web3.js';

const PLAY_MS = 60000; // wall-clock ms to play the full voyage (0 -> 100%)

// In-transit event presets shown as buttons. Each accumulates onto the case's
// existing risk so repeated clicks compound the stress (price keeps dropping).
const EVENTS = [
  { key: 'typhoon', label: '🌪 东海台风', tone: 'warn', events: [
    { category: 'macro', type: 'severe_weather', region: 'East China Sea', severity: 'warning',
      description: '台风季系统逼近，威胁卸货窗口。', source: 'mock-weather-feed (typhoon advisory)' }
  ] },
  { key: 'hormuz', label: '⚔ 霍尔木兹冲突升级', tone: 'crit', events: [
    { category: 'macro', type: 'war_risk', region: 'Middle East / Strait of Hormuz', severity: 'critical',
      description: '海峡近乎关闭，金属与能源战争溢价飙升，供应路线受阻。', source: 'mock-geopolitical-feed (GDELT-style)' },
    { category: 'macro', type: 'commodity_volatility', region: 'Global', severity: 'critical',
      description: '大宗价格在供应冲击恐慌中剧烈波动，估值须深度 haircut。', source: 'mock-LME-desk' }
  ] },
  { key: 'deviation', label: '🧭 改道绕行', tone: 'warn', events: [
    { category: 'shipment', type: 'route_deviation', severity: 'warning',
      description: '为避开安全警示区改道绕行，航程延长。', source: 'carrier ops bulletin (demo)' }
  ] },
  { key: 'insurance', label: '🛡 保险拒赔争议', tone: 'crit', events: [
    { category: 'shipment', type: 'insurance_invalid', severity: 'critical',
      description: '承保人援引海湾「战争除外」条款，部分拒赔，抵押覆盖塌陷。', source: 'mock-marine-underwriting-bulletin' }
  ] }
];

// --- module state -----------------------------------------------------------
const clock = { raf: 0, playing: true, progress: 0, last: 0, caseId: null };
let depDate = null, etaDate = null;
let lastShownPrice = null;
const appliedKeys = new Set();
const sweepCache = new Map();      // caseId -> sweep results array
const baselineCache = new Map();   // `${caseId}|${speed}` -> offering
let judgeLoaded = false;
let wired = false;

// ===========================================================================
// Public API (called by app.js)
// ===========================================================================
export function initVoyage() {
  if (wired) return;
  wired = true;
  $('#voyage-play').addEventListener('click', togglePlay);
  $('#voyage-scrub').addEventListener('input', (e) => {
    clock.progress = Number(e.target.value) / 1000;
    updateShip();
    updateFinancing();
  });
  $('#event-reset').addEventListener('click', resetVoyage);
  $('#rag-search-btn').addEventListener('click', runRagSearch);
  $('#rag-query').addEventListener('keydown', (e) => { if (e.key === 'Enter') runRagSearch(); });
}

export function renderVoyage() {
  const quote = liveQuote();
  if (!quote || !state.caseData) return;
  const bl = state.caseData.bill_of_lading ?? {};

  // (Re)initialize the clock when the case changes.
  if (clock.caseId !== state.caseId) {
    clock.caseId = state.caseId;
    appliedKeys.clear();
    lastShownPrice = null;
    depDate = f.parseDate(bl.shipped_on_board || bl.issue_date);
    etaDate = f.parseDate(bl.eta);
    clock.progress = initialProgress();
  }

  renderRoute(bl);
  updateShip();
  renderLive(quote);
  renderEventButtons();
  renderCallout();
  $('#event-reset').hidden = !state.voyageInjected;

  // async: lifecycle + risk feed + judge QA
  refreshLifecycle();
  refreshRiskFeed();
  if (!judgeLoaded) { judgeLoaded = true; loadJudgeQA(); }
}

export function startVoyageClock() {
  cancelAnimationFrame(clock.raf);
  clock.last = performance.now();
  const tick = (ts) => {
    const dt = ts - clock.last;
    clock.last = ts;
    if (clock.playing && clock.progress < 1) {
      clock.progress = Math.min(1, clock.progress + dt / PLAY_MS);
      updateShip();
      updateFinancing();
    }
    clock.raf = requestAnimationFrame(tick);
  };
  clock.raf = requestAnimationFrame(tick);
}

export function stopVoyageClock() {
  cancelAnimationFrame(clock.raf);
  clock.raf = 0;
}

// ===========================================================================
// Voyage tracker
// ===========================================================================
function initialProgress() {
  if (!depDate || !etaDate) return 0.15;
  const dates = [...(state.caseData.shipment_events ?? []), ...(state.caseData.macro_risk_events ?? [])]
    .map((e) => +f.parseDate(e.date)).filter(Number.isFinite);
  const now = dates.length ? Math.max(...dates) : (+depDate + (+etaDate - +depDate) * 0.15);
  return Math.max(0.06, Math.min(0.9, f.voyageProgress(depDate, etaDate, now)));
}

function renderRoute(bl) {
  $('#dep-port').textContent = bl.port_of_loading || '—';
  $('#dep-date').textContent = f.fmtDate(depDate);
  $('#arr-port').textContent = bl.port_of_discharge || '—';
  $('#arr-date').textContent = f.fmtDate(etaDate);
  $('#voyage-sub').innerHTML =
    `船舶 <strong>${bl.vessel || '—'}</strong>${bl.voyage_no ? ` · 航次 ${bl.voyage_no}` : ''}` +
    `${bl.carrier ? ` · ${bl.carrier}` : ''} —— 将鼠标移到船上查看当前虚拟时间与航段。`;
}

function updateShip() {
  const p = clock.progress;
  const bl = state.caseData?.bill_of_lading ?? {};
  const leftPct = 2 + p * 96; // keep within the rail ends
  const ship = $('#ship');
  if (ship) ship.style.left = leftPct + '%';
  const fill = $('#rail-progress');
  if (fill) fill.style.width = (p * 100) + '%';

  const when = f.fmtDateTime(f.dateAtProgress(depDate, etaDate, p));
  const where = f.waypointFor(p, bl.port_of_loading || '起运港', bl.port_of_discharge || '目的港');
  const tip = $('#ship-tooltip');
  if (tip) tip.textContent = `${when} · ${where}`;
  const scrub = $('#voyage-scrub');
  if (scrub && document.activeElement !== scrub) scrub.value = String(Math.round(p * 1000));
  const note = $('#voyage-eta-note');
  if (note) note.textContent = p >= 1 ? '已抵达目的港' : `虚拟当前 ${when} · 航程 ${Math.round(p * 100)}%`;
}

function togglePlay() {
  clock.playing = !clock.playing;
  clock.last = performance.now();
  $('#voyage-play').textContent = clock.playing ? '⏸ 暂停' : '▶ 播放';
}

// ===========================================================================
// Live pricing + financing progress
// ===========================================================================
function renderLive(quote) {
  const priceEl = $('#live-price');
  const p = quote.final_issue_price_usd;
  if (lastShownPrice != null && Math.abs(p - lastShownPrice) > 1e-6) {
    const dir = p < lastShownPrice ? 'flash-down' : 'flash-up';
    priceEl.classList.remove('flash-down', 'flash-up');
    void priceEl.offsetWidth; // restart animation
    priceEl.classList.add(dir);
    setTimeout(() => priceEl.classList.remove(dir), 1200);
  }
  priceEl.textContent = `$${f.price(p)}`;
  lastShownPrice = p;

  const act = f.actionMeta(quote.pricing_action);
  const actEl = $('#live-action');
  actEl.textContent = `${act.icon} ${act.label}`;
  actEl.className = `badge tone-${act.tone}`;
  $('#live-yield').innerHTML = `<strong>${f.bpsToPct(quote.implied_gross_yield_bps)}</strong> 潜在毛收益`;

  const riskEl = $('#live-risk');
  riskEl.textContent = quote.risk_level;
  riskEl.className = `badge tone-${f.riskTone(quote.risk_level)}`;
  $('#live-riskbps').textContent = `${f.int(quote.risk_score_bps)} bps`;

  updateFinancing();
}

function updateFinancing() {
  const quote = liveQuote();
  if (!quote) return;
  const paused = ['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION'].includes(quote.pricing_action);
  const target = quote.expected_cash_to_exporter_usd || quote.requested_cash_usd || 0;
  // Subscription fills as the voyage proceeds; a pause caps it where it stands.
  const fill = paused ? Math.min(0.6, 0.12 + clock.progress * 0.4) : Math.min(1, 0.12 + clock.progress * 0.9);
  const raised = Math.round(target * fill);
  const bar = $('#fin-bar');
  if (bar) {
    bar.style.width = (fill * 100) + '%';
    bar.className = `fin-bar${paused ? ' paused' : ''}`;
  }
  const label = $('#fin-label');
  if (label) label.textContent = `${f.usdCompact(raised)} / ${f.usdCompact(target)} · ${Math.round(fill * 100)}%${paused ? ' (已暂停)' : ''}`;
}

// ===========================================================================
// In-transit emergency events
// ===========================================================================
function renderEventButtons() {
  const box = $('#event-btns');
  clear(box);
  for (const ev of EVENTS) {
    const on = appliedKeys.has(ev.key);
    box.append(el('button', {
      class: `event-btn tone-${ev.tone}${on ? ' active' : ''}`,
      onclick: () => toggleEvent(ev.key)
    }, ev.label, on ? el('span', { class: 'event-on', text: '✓' }) : null));
  }
}

async function toggleEvent(key) {
  if (appliedKeys.has(key)) appliedKeys.delete(key); else appliedKeys.add(key);
  state.voyageEvents = [];
  for (const k of appliedKeys) {
    const def = EVENTS.find((e) => e.key === k);
    if (def) state.voyageEvents.push(...def.events);
  }
  state.voyageInjected = state.voyageEvents.length > 0;

  try {
    if (state.voyageInjected) {
      state.voyageOffering = await api.simulateOffering(state.caseData, {
        payout_speed: state.speed,
        events: state.voyageEvents
      });
    } else {
      state.voyageOffering = null;
    }
  } catch (e) {
    toast('重定价失败: ' + e.message, true);
    return;
  }

  renderEventButtons();
  renderLive(liveQuote());
  renderCallout();
  refreshLifecycle();
  refreshRiskFeed();
  $('#event-reset').hidden = !state.voyageInjected;

  // Best-effort on-chain anchoring of the reprice (does not block the UI).
  maybeAnchorReprice();
}

function resetVoyage() {
  appliedKeys.clear();
  state.voyageEvents = [];
  state.voyageInjected = false;
  state.voyageOffering = null;
  renderEventButtons();
  renderLive(liveQuote());
  renderCallout();
  refreshLifecycle();
  refreshRiskFeed();
  $('#event-reset').hidden = true;
}

async function maybeAnchorReprice() {
  const off = state.voyageOffering;
  if (!off?.final_quote || !state.poolId || state.poolId === 'sim') return;
  if (!web3.isWalletConnected()) return;
  try {
    const label = EVENTS.find((e) => appliedKeys.has(e.key))?.label ?? 'in-transit event';
    const res = await web3.repriceOnChain(state.poolId, off.final_quote, label);
    toast('⛓ 重定价已锚定上链: ' + f.shortHash(res.txHash, 10, 8));
  } catch { /* best effort only */ }
}

function renderCallout() {
  const box = $('#voyage-callout');
  const off = state.voyageOffering;
  if (!state.voyageInjected || !off?.initial_quote || !off?.final_quote) { box.hidden = true; return; }
  const initial = off.initial_quote, finalQ = off.final_quote;
  const paused = off.final_state === 'Paused' || off.final_state === 'Frozen' || off.final_state === 'Liquidation';
  const dropped = finalQ.final_issue_price_usd < initial.final_issue_price_usd;
  box.hidden = false;
  box.className = `lc-callout tone-${paused ? 'crit' : dropped ? 'warn' : 'info'}`;
  box.textContent = paused
    ? `⏸ 在途风险升级至 ${finalQ.risk_level} —— AI 暂停了发行。新证据 ${f.shortHash(finalQ.evidence_hash)}。`
    : dropped
      ? `↓ 风险升至 ${finalQ.risk_level} —— AI 将发行价 ${f.price(initial.final_issue_price_usd)} 重定价至 ${f.price(finalQ.final_issue_price_usd)}（投资者潜在收益扩大至 ${f.bpsToPct(finalQ.implied_gross_yield_bps)}）。`
      : `风险重估为 ${finalQ.risk_level}；价格维持在 ${f.price(finalQ.final_issue_price_usd)}。`;
}

// ===========================================================================
// Lifecycle stepper + timeline
// ===========================================================================
async function getOffering() {
  if (state.voyageInjected && state.voyageOffering) return state.voyageOffering;
  const key = `${state.caseId}|${state.speed}`;
  if (baselineCache.has(key)) return baselineCache.get(key);
  const off = await api.simulateOffering(state.caseData, { payout_speed: state.speed });
  baselineCache.set(key, off);
  return off;
}

async function refreshLifecycle() {
  const tl = $('#timeline');
  const lifecycleBox = $('#lifecycle');
  let offering;
  try { offering = await getOffering(); }
  catch (e) { tl.innerHTML = `<li class="error">生命周期加载失败: ${e.message}</li>`; return; }

  const reached = new Set(offering.steps.map((s) => s.state));
  const endState = offering.final_state;

  clear(lifecycleBox);
  const seq = f.LIFECYCLE.filter((s) => {
    if (s === 'Repriced') return reached.has('Repriced');
    if (s === 'Paused') return reached.has('Paused') || endState === 'Paused';
    return true;
  });
  seq.forEach((s, i) => {
    const on = reached.has(s) || s === endState;
    const isEnd = s === endState;
    if (i > 0) lifecycleBox.append(el('span', { class: `lc-link${on ? ' on' : ''}` }));
    lifecycleBox.append(el('div', {
      class: `lc-node tone-${on ? f.stateTone(s) : 'muted'}${on ? ' on' : ''}${isEnd ? ' end' : ''}`
    },
      el('span', { class: 'lc-dot' }),
      el('span', { class: 'lc-name', text: s })
    ));
  });

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
}

// ===========================================================================
// AI risk feed (with sources)
// ===========================================================================
async function refreshRiskFeed() {
  const box = $('#risk-feed');
  const items = [];

  // 1) Injected in-transit events first (highlighted).
  for (const e of state.voyageEvents) {
    items.push({
      injected: true, severity: e.severity, category: e.type, region: e.region,
      title: e.description, source: e.source || 'in-transit simulation', date: '刚刚 · 模拟注入'
    });
  }
  // 2) The case's own macro risk events (the international situation).
  for (const e of state.caseData.macro_risk_events ?? []) {
    items.push({
      severity: e.severity, category: e.type, region: e.region,
      title: e.description, date: e.date,
      source: state.caseData.market?.source || 'case macro feed'
    });
  }

  // 3) RAG sweep (sourced intel) — cached per case.
  let sweep = sweepCache.get(state.caseId);
  if (!sweep) {
    try {
      const res = await api.riskSweep(state.caseData);
      sweep = Object.values(res.results ?? {}).flat();
      sweepCache.set(state.caseId, sweep);
    } catch { sweep = []; }
  }
  const seen = new Set();
  for (const m of sweep) {
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    items.push({ severity: m.severity, category: m.category, region: m.region, title: m.title || m.summary, source: m.source, date: m.date });
  }

  clear(box);
  if (!items.length) { box.innerHTML = '<p class="muted">暂无风险情报。</p>'; return; }
  const order = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => (a.injected ? -1 : 0) - (b.injected ? -1 : 0) || (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  for (const it of items.slice(0, 12)) {
    box.append(el('div', { class: `feed-item tone-${sevTone(it.severity)}${it.injected ? ' injected' : ''}` },
      el('div', { class: 'feed-head' },
        el('span', { class: `badge sm tone-${sevTone(it.severity)}`, text: (it.severity || 'info').toUpperCase() }),
        el('span', { class: 'feed-cat', text: (it.category || '').replace(/_/g, ' ') }),
        it.region ? el('span', { class: 'feed-region', text: it.region }) : null,
        it.injected ? el('span', { class: 'feed-new', text: 'NEW' }) : null
      ),
      el('p', { class: 'feed-text', text: it.title || '' }),
      el('div', { class: 'feed-foot' },
        el('span', { class: 'feed-source', text: '来源: ' + (it.source || '—') }),
        it.date ? el('span', { class: 'feed-date', text: it.date }) : null
      )
    ));
  }
}

function sevTone(sev) {
  return { critical: 'crit', warning: 'warn', info: 'info' }[String(sev).toLowerCase()] ?? 'info';
}

// ===========================================================================
// RAG search + Judge Q&A (redistributed into View ②)
// ===========================================================================
async function runRagSearch() {
  const query = $('#rag-query').value.trim();
  if (!query) return;
  const box = $('#rag-results');
  box.innerHTML = '<p class="muted">搜索中…</p>';
  try {
    const data = await api.ragSearch(query);
    clear(box);
    if (!data.matches?.length) { box.innerHTML = `<p class="muted">没有「${query}」的情报。</p>`; return; }
    box.append(el('p', { class: 'results-count', text: `${data.match_count} 条情报命中` }));
    for (const m of data.matches) {
      box.append(el('div', { class: `rag-entry tone-${sevTone(m.severity)}` },
        el('div', { class: 'rag-entry-head' },
          el('span', { class: `badge sm tone-${sevTone(m.severity)}`, text: (m.severity || 'info').toUpperCase() }),
          el('span', { class: 'rag-cat', text: m.category || '' }),
          m._score ? el('span', { class: 'rag-score', text: `score ${m._score}` }) : null
        ),
        el('h4', { text: m.title || m.id || 'intel' }),
        el('p', { text: m.summary || '' }),
        el('p', { class: 'rag-meta', text: [m.source, m.region, m.date].filter(Boolean).join(' · ') })
      ));
    }
  } catch (e) {
    box.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

async function loadJudgeQA() {
  try {
    const pairs = await api.getJudgeQA();
    const box = $('#judge-qa');
    clear(box);
    for (const p of pairs) {
      box.append(el('details', { class: 'qa' },
        el('summary', {}, el('strong', { text: p.id ? p.id + ': ' : '' }), p.question),
        el('p', { class: 'qa-answer', text: p.answer }),
        p.source ? el('p', { class: 'qa-source', text: p.source }) : null
      ));
    }
  } catch (e) {
    $('#judge-qa').textContent = 'Q&A 不可用: ' + e.message;
  }
}
