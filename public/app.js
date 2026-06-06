// TradeShield dashboard — router + shared controller + View ① (Tokenize / Mint).
//
// Two views share one selected trade case + one live PricingQuote (store.js):
//   View ① "提单上链铸造 RWA" — AI cargo valuation + route risk (with sources &
//           scores), the AI pricing waterfall, and a financing→mint module that
//           tokenizes the eBL into RWA on real Sepolia (or a simulated fallback).
//   View ② "航运追踪 & 实时定价" — lives in voyage.js.
// Every number comes from the live pricing engine via the existing endpoints.

import { state, selectedQuote } from './store.js';
import { $, el, clear, toast, setBusy } from './dom.js';
import * as f from './format.js';
import * as api from './api.js';
import * as web3 from './web3.js';
import { initVoyage, renderVoyage, startVoyageClock, stopVoyageClock } from './voyage.js';

const PAUSED_ACTIONS = new Set(['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION']);

// ===========================================================================
// Boot
// ===========================================================================
async function boot() {
  wireStaticHandlers();
  initVoyage();
  reflectChainStatus();
  refreshWalletUi();

  try {
    state.cases = await api.getCases();
  } catch (e) {
    toast('加载案例失败: ' + e.message, true);
    return;
  }
  renderCaseSelector();
  renderSpeedSelector();
  await selectCase(state.cases[0]?.case_id);
  setView('mint');
}

// ===========================================================================
// Controller — shared selection / routing
// ===========================================================================
async function selectCase(caseId) {
  const entry = state.cases.find((c) => c.case_id === caseId);
  if (!entry) return;
  state.caseId = caseId;
  state.caseData = entry.case;
  state.financingUsd = null;
  state.mint = null;
  state.poolId = null;
  state.voyageInjected = false;
  state.voyageOffering = null;
  state.voyageEvents = [];
  highlightCase();
  setBusy(true);
  try {
    state.comparison = await api.compareSpeeds(entry.case);
    state.speed = state.comparison.recommended_payout_speed
      ?? state.comparison.quotes?.[0]?.payout_speed ?? 'BALANCED';
    highlightSpeed();
    const q = selectedQuote();
    state.financingUsd = Math.round(q?.requested_cash_usd ?? q?.expected_cash_to_exporter_usd ?? 0);
    renderViewMint();
    if (state.view === 'voyage') renderVoyage();
  } catch (e) {
    toast('定价失败: ' + e.message, true);
  } finally {
    setBusy(false);
  }
}

function selectSpeed(speed) {
  if (!state.comparison?.quotes?.some((q) => q.payout_speed === speed)) return;
  state.speed = speed;
  highlightSpeed();
  // a new speed = a new issue price; reset any in-transit reprice on the voyage.
  state.voyageInjected = false;
  state.voyageOffering = null;
  state.voyageEvents = [];
  renderViewMint();
  if (state.view === 'voyage') renderVoyage();
}

function setView(name) {
  state.view = name;
  document.querySelectorAll('#nav .nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#view-mint').hidden = name !== 'mint';
  $('#view-voyage').hidden = name !== 'voyage';
  if (name === 'voyage') { renderVoyage(); startVoyageClock(); }
  else { stopVoyageClock(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Re-render everything in View ① that depends on (case, speed).
function renderViewMint() {
  const quote = selectedQuote();
  if (!quote) return;
  renderDealStrip(quote);
  renderHeroPrice(quote);
  renderValuation(quote);
  renderWaterfall(quote);
  renderExporterCards();
  renderMintModule(quote);
}

// ===========================================================================
// Selectors (case + speed)
// ===========================================================================
function renderCaseSelector() {
  const box = $('#case-select');
  clear(box);
  for (const c of state.cases) {
    box.append(el('button', {
      class: 'seg-btn', role: 'tab', 'data-case': c.case_id, title: c.label,
      onclick: () => selectCase(c.case_id)
    },
      el('span', { class: 'seg-main', text: shortLabel(c) }),
      c.risk_hint ? el('span', { class: `seg-hint tone-${f.riskTone(c.risk_hint)}`, text: c.risk_hint }) : null
    ));
  }
}
function shortLabel(c) {
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

function highlightCase() {
  document.querySelectorAll('#case-select .seg-btn').forEach((b) =>
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
  const qty = bl.quantity_mt ? `${f.int(bl.quantity_mt)} MT` : (bl.quantity_bbl ? `${f.int(bl.quantity_bbl)} bbl` : '');
  const pills = [
    ['航线', bl.port_of_loading && bl.port_of_discharge ? `${bl.port_of_loading} → ${bl.port_of_discharge}` : '—'],
    ['货物', bl.cargo ? `${bl.cargo}${qty ? ` · ${qty}` : ''}` : '—'],
    ['电子提单', bl.bl_id ? `${bl.bl_id}${bl.ebl_platform ? ` · ${bl.ebl_platform}` : ''}` : '—'],
    ['申报货值', bl.declared_value_usd ? f.usd(bl.declared_value_usd) : '—'],
    ['AI 核验货值', f.usd(quote.ai_verified_collateral_value_usd)]
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
    el('span', { class: 'metric-label', text: 'AI 发行价 / RWA token' }),
    el('div', { class: 'hero-price-val' },
      el('span', { class: 'currency', text: '$' }),
      el('span', { id: 'hero-price-num', text: f.price(quote.final_issue_price_usd) })
    ),
    el('div', { class: 'hero-price-meta' },
      el('span', { class: `badge tone-${act.tone}`, text: `${act.icon} ${act.label}` }),
      el('span', { class: 'hero-yield', html: `<strong>${f.bpsToPct(quote.implied_gross_yield_bps)}</strong> 潜在毛收益` })
    ),
    el('div', { class: 'hero-target', html: `兑付目标 <strong>$1.00</strong> · ${f.SPEED_META[quote.payout_speed].label} 到账` })
  );
}

// ===========================================================================
// View ① — AI cargo valuation + route risk (with sources & scores)
// ===========================================================================
function renderValuation(quote) {
  const caseData = state.caseData ?? {};
  const bl = caseData.bill_of_lading ?? {};
  const ins = caseData.insurance ?? {};
  $('#mint-collateral').textContent = f.usd(quote.ai_verified_collateral_value_usd);

  const rows = $('#collateral-rows');
  clear(rows);
  const kv = (k, v) => el('div', { class: 'cr-row' },
    el('span', { class: 'cr-k', text: k }), el('span', { class: 'cr-v', text: v }));
  rows.append(
    kv('申报货值', bl.declared_value_usd ? f.usd(bl.declared_value_usd) : '—'),
    kv('投保金额', ins.insured_value_usd ? f.usd(ins.insured_value_usd) : '—'),
    kv('安全兑付敞口', f.usd(quote.max_safe_redemption_exposure_usd)),
    kv('建议 token 供给', f.int(quote.recommended_token_supply))
  );

  // risk dimensions (reuse the FE-4 rollup)
  const dimsBox = $('#risk-dims');
  clear(dimsBox);
  for (const d of f.rollupRiskDimensions(quote.risk_factors)) {
    const tone = d.active ? f.bpsTone(d.bps) : 'muted';
    dimsBox.append(el('div', {
      class: `risk-dim tone-${tone}${d.active ? ' active' : ''}`,
      title: d.factors.join('\n') || '未检测到信号'
    },
      el('span', { class: 'risk-dim-icon', text: d.icon }),
      el('div', { class: 'risk-dim-body' },
        el('span', { class: 'risk-dim-label', text: d.label }),
        el('span', { class: 'risk-dim-bps', text: !d.active ? 'clear' : d.bps > 0 ? `+${d.bps} bps` : 'flagged' })
      )
    ));
  }
  const total = $('#risk-total');
  total.textContent = `${f.int(quote.risk_score_bps)} bps · ${quote.risk_level}`;
  total.className = `risk-total tone-${f.riskTone(quote.risk_level)}`;

  const citeBox = $('#intel-cites');
  clear(citeBox);
  const cites = f.intelCitations(quote);
  if (cites.length) {
    citeBox.append(el('span', { class: 'cite-head', text: '风险折价援引 RAG 情报:' }));
    for (const c of cites) citeBox.append(el('span', { class: 'cite', text: c }));
  }

  const srcBox = $('#risk-sources');
  clear(srcBox);
  for (const s of f.riskSources(quote, caseData)) {
    srcBox.append(el('div', { class: 'source-row' },
      el('span', { class: 'source-tag', text: s.tag }),
      el('span', { class: 'source-detail', text: s.detail })));
  }
}

// ===========================================================================
// View ① — AI Pricing Console waterfall (reused from the original)
// ===========================================================================
function renderWaterfall(quote) {
  const wf = $('#waterfall');
  clear(wf);

  const base = quote.base_issue_price_usd;
  const urg = quote.urgency_discount_bps / 10000;
  const risk = quote.risk_discount_bps / 10000;
  const speedPrice = base - urg;
  const indicative = quote.indicative_issue_price_usd;
  const final = quote.final_issue_price_usd;
  const lifted = quote.binding_constraint === 'COLLATERAL' && final > indicative + 1e-6;

  const lo = Math.max(0.4, Math.floor((Math.min(indicative, final, base) - 0.06) * 20) / 20);
  const hi = 1.0;
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

  const cols = [
    { kind: 'target', label: '目标兑付', value: 1.0, top: 1.0, bottom: lo, note: 'redemption value' },
    { kind: 'base', label: 'Base 锚点', value: base, top: base, bottom: lo, note: 'patient-money anchor' },
    { kind: 'down', label: '急用折价', value: -urg, top: base, bottom: speedPrice, note: `${f.SPEED_META[quote.payout_speed].label} · −${quote.urgency_discount_bps} bps` },
    { kind: 'down', label: '风险折价', value: -risk, top: speedPrice, bottom: indicative, note: `${quote.risk_level} · −${quote.risk_discount_bps} bps` },
    { kind: 'mid', label: '指示价', value: indicative, top: indicative, bottom: lo, note: 'profit-share price' }
  ];
  if (lifted) {
    cols.push({ kind: 'up', label: '抵押下限', value: final - indicative, top: final, bottom: indicative, note: 'lifted to safe coverage' });
  }
  cols.push({ kind: 'final', label: '最终发行价', value: final, top: final, bottom: lo, note: `${f.bpsToPct(quote.implied_gross_yield_bps)} 上行至 $1.00` });

  const chart = el('div', { class: 'wf-chart' });
  const colsRow = el('div', { class: 'wf-cols' });
  const labelsRow = el('div', { class: 'wf-labels' });
  colsRow.append(el('div', { class: 'wf-target-line', style: `bottom:${pos(1.0)}%` },
    el('span', { class: 'wf-axis-tag', text: '$1.00 目标' })));

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
      el('div', { class: 'wf-track' }, bar,
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
  wf.append(el('p', { class: 'wf-axis-foot', text: `坐标缩放至 ${f.price(lo)}–1.00 · 绑定约束: ${quote.binding_constraint}` }));
  $('#console-explain').textContent = quote.exporter_explanation || '';
}

// ===========================================================================
// View ① — Exporter speed cards (reused)
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
    box.append(el('button', {
      class: `speed-card${isActive ? ' active' : ''}`, 'data-speed': q.payout_speed,
      onclick: () => selectSpeed(q.payout_speed)
    },
      el('div', { class: 'speed-card-head' },
        el('div', {},
          el('span', { class: 'speed-card-title', text: meta.label }),
          el('span', { class: 'speed-card-sub', text: meta.sub })
        ),
        q.payout_speed === rec ? el('span', { class: 'rec-badge', text: '★ AI 推荐' }) : null
      ),
      el('div', { class: 'speed-card-price' },
        el('span', { class: 'big', text: `$${f.price(q.final_issue_price_usd)}` }),
        el('span', { class: 'unit', text: '/ token' })
      ),
      el('div', { class: 'speed-card-rows' },
        kvRow('到账现金', f.usd(q.expected_cash_to_exporter_usd)),
        kvRow('融资成本', f.usd(q.financing_cost_usd), 'cost'),
        kvRow('占贸易毛利', f.bpsToPct(q.exporter_profit_share_bps), shareTone(q)),
        kvRow('保留净利', f.usd(q.exporter_net_profit_usd), 'gain')
      ),
      el('div', { class: 'speed-card-foot' },
        el('span', { class: `badge sm tone-${act.tone}`, text: act.label })
      )
    ));
  }
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
// View ① — Financing + Mint RWA on-chain
// ===========================================================================
function renderMintModule(quote) {
  $('#quote-hash').textContent = f.shortHash(quote.quote_hash, 14, 8);
  $('#quote-hash').title = quote.quote_hash || '';
  $('#evidence-hash').textContent = f.shortHash(quote.evidence_hash, 14, 8);
  $('#evidence-hash').title = quote.evidence_hash || '';

  const input = $('#mint-financing');
  input.value = state.financingUsd ?? Math.round(quote.requested_cash_usd || 0);
  const paused = PAUSED_ACTIONS.has(quote.pricing_action);
  input.disabled = paused;
  $('#mint-btn').disabled = paused;
  renderMintReadout(quote);

  // Show the last mint result (if any) for this case, else the hint.
  if (!state.mint) {
    $('#mint-result').innerHTML =
      '<p class="muted">输入融资金额并点击「铸造 RWA 上链」。连接钱包且合约已部署时铸造真实 Sepolia 交易，否则走高保真模拟交易。</p>';
  }
}

function renderMintReadout(quote) {
  const box = $('#mint-readout');
  const paused = PAUSED_ACTIONS.has(quote.pricing_action);
  if (paused) {
    box.innerHTML = `<span class="sub-paused">AI 已暂停发行（${f.actionMeta(quote.pricing_action).label}）——当前风险下不开放铸造。</span>`;
    return;
  }
  const financing = Number($('#mint-financing').value) || 0;
  state.financingUsd = financing;
  const tokens = web3.mintedTokensFor(quote, financing);
  const cost = tokens * quote.final_issue_price_usd;
  const redemption = tokens * 1.0;
  clear(box);
  box.append(
    el('div', { class: 'readout-line' }, '铸造后获得 ',
      el('strong', { text: f.int(tokens) }), ` RWA @ $${f.price(quote.final_issue_price_usd)} / token`),
    el('div', { class: 'readout-grid' },
      miniKv('发行价', `$${f.price(quote.final_issue_price_usd)}`),
      miniKv('投入', f.usd(cost)),
      miniKv('目标兑付', f.usd(redemption), 'gain'),
      miniKv('潜在毛收益', f.bpsToPct(quote.implied_gross_yield_bps), 'gain')
    ),
    el('div', { class: 'sub-foot muted', text: '目标兑付非保本——取决于进口商付款与货物结算。' })
  );
}
function miniKv(k, v, tone) {
  return el('div', { class: 'mini-kv' },
    el('span', { class: 'mini-kv-k', text: k }),
    el('span', { class: `mini-kv-v${tone ? ' ' + tone : ''}`, text: v }));
}

async function onMint() {
  const quote = selectedQuote();
  if (!quote || PAUSED_ACTIONS.has(quote.pricing_action)) return;
  const financing = Number($('#mint-financing').value) || 0;
  if (financing <= 0) { toast('请输入大于 0 的融资金额', true); return; }
  state.financingUsd = financing;

  const btn = $('#mint-btn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = '⛓ 铸造中…';

  try {
    const realConfigured = await web3.isRealChainConfigured();
    let res;
    if (realConfigured) {
      // Real Sepolia path: ensure a wallet session, then mint on-chain.
      if (!web3.isWalletConnected()) {
        try { await doConnect(); }
        catch (e) {
          if (e.code === 'NO_WALLET') { res = await fallbackSim(quote, financing, '未检测到钱包'); }
          else throw e;
        }
      }
      if (!res) {
        try {
          res = await web3.mintOnChain(quote, financing);
        } catch (e) {
          if (e.code === 'REJECTED') { toast('已取消铸造', true); return; }
          res = await fallbackSim(quote, financing, '链上调用失败，已回退模拟：' + (e.message || ''));
        }
      }
    } else {
      res = await web3.simulatedMint(state.caseId, quote, financing);
    }

    state.mint = res;
    state.poolId = res.poolId && res.poolId !== 'sim' ? res.poolId : state.poolId;
    renderMintResult(res, quote);
    if (res.mode === 'chain') toast(`✅ 已在 Sepolia 铸造 ${f.int(res.mintedAmount)} RWA`);
    else toast(`已生成模拟铸造交易（${f.int(res.mintedAmount)} RWA）`);
  } catch (e) {
    toast('铸造失败: ' + (e.message || e), true);
  } finally {
    btn.disabled = PAUSED_ACTIONS.has(quote.pricing_action);
    btn.textContent = original;
  }
}

async function fallbackSim(quote, financing, note) {
  if (note) toast(note, true);
  return web3.simulatedMint(state.caseId, quote, financing);
}

function renderMintResult(res, quote) {
  const box = $('#mint-result');
  clear(box);
  const chain = res.mode === 'chain';
  box.append(
    el('div', { class: 'mint-result-head' },
      el('span', { class: `badge ${chain ? 'tone-ok' : 'tone-warn'}`, text: chain ? '⛓ Sepolia 链上' : '🧪 模拟交易' }),
      el('span', { class: 'mint-minted' }, '已铸 ', el('strong', { text: f.int(res.mintedAmount) }), ' RWA')
    ),
    el('div', { class: 'mint-result-rows' },
      mintRow('发行价', `$${f.price(quote.final_issue_price_usd)} / token`),
      mintRow('tx_hash', f.shortHash(res.txHash, 12, 10),
        chain && res.explorerUrl ? res.explorerUrl : null),
      res.poolId ? mintRow('poolId', String(res.poolId)) : null,
      res.blockNumber ? mintRow('block', `#${f.int(res.blockNumber)}`) : null
    )
  );
  if (chain) {
    const balRow = mintRow('链上 RWA 余额', '读取中…');
    box.append(balRow);
    web3.readBalance(res.poolId, res.address)
      .then((bal) => { balRow.querySelector('.mint-row-v').textContent = f.int(bal); })
      .catch(() => { balRow.querySelector('.mint-row-v').textContent = '—'; });
  } else {
    box.append(el('p', { class: 'sub-foot muted', text: '运行 `npm run deploy:tradeshield:sepolia` 并连接钱包后，此处将是真实 Sepolia 交易。' }));
  }
}
function mintRow(k, v, href) {
  return el('div', { class: 'mint-row' },
    el('span', { class: 'mint-row-k', text: k }),
    href
      ? el('a', { class: 'mint-row-v etherscan-link', href, target: '_blank', rel: 'noopener' }, v + ' ↗')
      : el('span', { class: 'mint-row-v', text: v }));
}

// ===========================================================================
// Wallet + chain status
// ===========================================================================
async function reflectChainStatus() {
  const elx = $('#chain-status');
  if (!elx) return;
  const real = await web3.isRealChainConfigured();
  if (real) {
    elx.textContent = '● 合约已部署 · 连接钱包铸造真实 Sepolia 交易';
    elx.className = 'chain-status tone-ok';
  } else {
    elx.textContent = '○ 合约未部署 · 当前为模拟上链（运行 deploy 脚本后切真实链）';
    elx.className = 'chain-status tone-muted';
  }
}

function refreshWalletUi() {
  const btn = $('#wallet-btn');
  if (!btn) return;
  const addr = web3.connectedAddress();
  if (addr) {
    btn.textContent = `🦊 ${addr.slice(0, 6)}…${addr.slice(-4)}`;
    btn.classList.add('connected');
  } else {
    btn.textContent = '🦊 连接钱包';
    btn.classList.remove('connected');
  }
}

async function doConnect() {
  const { address } = await web3.connectWallet();
  state.wallet = { address };
  refreshWalletUi();
  toast('钱包已连接 · Sepolia');
  return address;
}

async function onWalletClick() {
  try {
    await doConnect();
  } catch (e) {
    if (e.code === 'NO_WALLET') toast('未检测到 MetaMask —— 铸造将走模拟交易', true);
    else if (e.code === 'REJECTED') toast('已取消连接', true);
    else toast('连接失败: ' + (e.message || e), true);
  }
}

// ===========================================================================
// Wiring
// ===========================================================================
function wireStaticHandlers() {
  document.querySelectorAll('#nav .nav-tab').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view)));
  $('#wallet-btn').addEventListener('click', onWalletClick);
  $('#mint-btn').addEventListener('click', onMint);
  $('#mint-financing').addEventListener('input', () => {
    const q = selectedQuote();
    if (q && !$('#mint-financing').disabled) renderMintReadout(q);
  });
}

boot();
