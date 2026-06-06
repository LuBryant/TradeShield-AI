// Pure formatting + parsing helpers for the TradeShield pricing dashboard.
// No DOM, no network — just turn PricingQuote numbers into demo-ready strings
// and classify the AI's risk factors into the five investor-facing dimensions.

/** USD with thousands separators, no decimals. 5600000 -> "$5,600,000". */
export function usd(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return '$' + Math.round(Number(value)).toLocaleString('en-US');
}

/** Compact USD for tight chips. 5600000 -> "$5.60M", 6427915 -> "$6.43M". */
export function usdCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Issue price to 3 decimals. 0.8712 -> "0.871". */
export function price(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : '—';
}

/** Integer with thousands separators. 6427915 -> "6,427,915". */
export function int(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
}

/** Basis points -> percent string. 1478 -> "14.8%". */
export function bpsToPct(bps, digits = 1) {
  const n = Number(bps);
  return Number.isFinite(n) ? (n / 100).toFixed(digits) + '%' : '—';
}

/** Fraction -> percent string. 0.129 -> "12.9%". */
export function fracToPct(frac, digits = 1) {
  const n = Number(frac);
  return Number.isFinite(n) ? (n * 100).toFixed(digits) + '%' : '—';
}

/** Shorten a 0x hash for display: 0xabc...def. */
export function shortHash(hash, head = 10, tail = 6) {
  if (typeof hash !== 'string' || !hash.startsWith('0x')) return '—';
  if (hash.length <= head + tail) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

// --- pricing-action presentation -------------------------------------------
const ACTION_META = {
  OPEN_OFFERING: { label: 'OPEN', tone: 'ok', icon: '✓' },
  OPEN_WITH_WARNING: { label: 'OPEN · WARNING', tone: 'warn', icon: '!' },
  REPRICE_DOWN: { label: 'REPRICE DOWN', tone: 'warn', icon: '↓' },
  PAUSE_OFFERING: { label: 'PAUSED', tone: 'crit', icon: '⏸' },
  FREEZE_POOL: { label: 'FROZEN', tone: 'crit', icon: '✕' },
  TRIGGER_LIQUIDATION: { label: 'LIQUIDATION', tone: 'crit', icon: '⚠' }
};
export function actionMeta(action) {
  return ACTION_META[action] ?? { label: action ?? '—', tone: 'muted', icon: '·' };
}

const RISK_TONE = { LOW: 'ok', MEDIUM: 'info', WARNING: 'warn', CRITICAL: 'crit' };
export function riskTone(level) {
  return RISK_TONE[level] ?? 'muted';
}

// --- offering state presentation -------------------------------------------
// Canonical lifecycle order for the contract timeline stepper.
export const LIFECYCLE = [
  'Created', 'Priced', 'Open', 'Subscribed', 'Funded',
  'InTransit', 'Repriced', 'Paused', 'Repaid', 'Redeemed'
];

const STATE_TONE = {
  Created: 'muted', Priced: 'info', Open: 'ok', Subscribed: 'ok', Funded: 'ok',
  InTransit: 'info', Repriced: 'warn', Paused: 'crit', Frozen: 'crit',
  Liquidation: 'crit', Repaid: 'ok', Redeemed: 'ok', Defaulted: 'crit', Cancelled: 'muted'
};
export function stateTone(state) {
  return STATE_TONE[state] ?? 'muted';
}

// --- speed presentation -----------------------------------------------------
export const SPEED_META = {
  FAST: { label: 'FAST', sub: '很快到账', blurb: 'Cash in hours — give up more margin for speed.' },
  BALANCED: { label: 'BALANCED', sub: '正常到账', blurb: 'Standard settlement — a balanced financing cost.' },
  LOW_COST: { label: 'LOW COST', sub: '耐心资本', blurb: 'Patient capital — cheapest financing, slower cash.' }
};

// --- risk-factor parsing & dimension mapping (FE-4) -------------------------
//
// scoreRisk emits factor strings like "war_risk/critical (Strait of Hormuz): +450bps",
// "commodity_price_drop 12%: +144bps", "doc: Insurance covers cargo value: ...".
// We parse each into { key, bps, text } and roll them into five investor-facing
// dimensions plus a Documents bucket.

/** Parse a single factor string into { key, bps, text }. */
export function parseFactor(factor) {
  const text = String(factor);
  const bpsMatch = text.match(/\+(\d+)\s*bps/i);
  const bps = bpsMatch ? Number(bpsMatch[1]) : 0;
  let key;
  if (/^doc:/i.test(text)) key = 'doc';
  else key = (text.split(/[:/\s]/)[0] || 'other').toLowerCase();
  return { key, bps, text };
}

// Each dimension: which factor keys feed it + display metadata.
export const RISK_DIMENSIONS = [
  { id: 'war', label: 'War / Geopolitics', icon: '⚔', keys: ['war_risk', 'sanction_risk'] },
  { id: 'weather', label: 'Weather', icon: '🌪', keys: ['severe_weather', 'bad_weather'] },
  { id: 'port', label: 'Port / Logistics', icon: '⚓', keys: ['port_congestion', 'port_strike', 'delay', 'route_deviation', 'cargo_damage', 'partial_loss'] },
  { id: 'insurance', label: 'Insurance', icon: '🛡', keys: ['insurance_expiry_risk', 'insurance_invalid'] },
  { id: 'price', label: 'Price volatility', icon: '📉', keys: ['commodity_price_drop', 'commodity_volatility', 'fx_volatility'] },
  { id: 'docs', label: 'Documents', icon: '📄', keys: ['doc'] }
];

const KEY_TO_DIM = (() => {
  const map = {};
  for (const dim of RISK_DIMENSIONS) for (const k of dim.keys) map[k] = dim.id;
  return map;
})();

// Route a parsed factor to a dimension. Document-consistency findings ("doc: …")
// are sub-classified by their text so an insurance coverage/expiry gap surfaced
// by the document checker still lights up the Insurance dimension (FE-4).
function dimensionFor(key, text) {
  if (key === 'doc') {
    const t = text.toLowerCase();
    if (t.includes('insur')) return 'insurance';
    return 'docs';
  }
  return KEY_TO_DIM[key] ?? 'docs';
}

/**
 * Roll an array of risk_factors into the dimensions above.
 * @returns {Array<{id,label,icon,bps,active,factors:string[]}>}
 */
export function rollupRiskDimensions(riskFactors = []) {
  const acc = Object.fromEntries(RISK_DIMENSIONS.map((d) => [d.id, { ...d, bps: 0, active: false, factors: [] }]));
  for (const raw of riskFactors) {
    const { key, bps, text } = parseFactor(raw);
    const dim = acc[dimensionFor(key, text)];
    dim.active = true;
    dim.bps += bps;
    dim.factors.push(text);
  }
  return RISK_DIMENSIONS.map((d) => acc[d.id]);
}

/** A short tone for a dimension by its bps weight, for chip coloring. */
export function bpsTone(bps) {
  if (bps <= 0) return 'muted';
  if (bps < 100) return 'info';
  if (bps < 250) return 'warn';
  return 'crit';
}

/** Extract RAG intel ids cited in the risk-discount evidence (e.g. "MRI-...."). */
export function intelCitations(quote) {
  const node = (quote?.evidence_graph ?? []).find((n) => n.component === 'risk_discount');
  const cites = new Set();
  for (const e of node?.evidence ?? []) {
    const m = String(e).match(/^(MRI-[A-Z0-9-]+)\s*\((.+)\)\s*$/);
    if (m) cites.add(`${m[1]} · ${m[2]}`);
  }
  return [...cites];
}
