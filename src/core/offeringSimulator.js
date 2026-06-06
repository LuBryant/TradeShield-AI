// RWA offering lifecycle simulator (BE-4).
//
// Drives an eBL-backed RWA offering through its on-chain states using the AI
// PricingQuote, and shows what happens when risk escalates mid-transit: the
// RiskPricingOracle reprices the pool, pauses it, or it settles and redeems.
//
//   Created -> Priced -> Open -> Subscribed -> Funded -> InTransit
//             -> (Repriced | Paused | Frozen) -> Repaid -> Redeemed
//
// Pure / deterministic / offline (built on quoteFromCase).

import { quoteFromCase } from './pricingEngine.js';
import { STATE_BY_PRICING_ACTION } from './pricingSchema.js';

const NON_OPENING_ACTIONS = new Set(['PAUSE_OFFERING', 'FREEZE_POOL', 'TRIGGER_LIQUIDATION']);
const REPRICE_THRESHOLD = 0.005; // >0.5c price drop counts as a reprice event

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

const usd = (n) => 'USD ' + Math.round(n).toLocaleString('en-US');

/** Clone a case and merge in risk events that "arrive" after the offering opens. */
function applyEvents(caseData, events) {
  const merged = structuredClone(caseData);
  merged.macro_risk_events = [...(merged.macro_risk_events ?? [])];
  merged.shipment_events = [...(merged.shipment_events ?? [])];
  for (const event of events) {
    const { category = 'macro', ...rest } = event;
    if (category === 'shipment') merged.shipment_events.push(rest);
    else merged.macro_risk_events.push(rest);
  }
  return merged;
}

/**
 * Simulate the full RWA offering lifecycle for a case.
 * @param {object} caseData
 * @param {object} [opts] { payout_speed, requested_cash_usd, subscription_usd, events }
 *   events: [{ category:'macro'|'shipment', type, severity, region?, description?, ... }]
 * @returns {object} { case_id, final_state, initial_quote, final_quote, subscription, steps }
 */
export function simulateOffering(caseData, opts = {}) {
  const events = opts.events ?? [];
  const quoteOpts = { payout_speed: opts.payout_speed, requested_cash_usd: opts.requested_cash_usd };
  const initialQuote = quoteFromCase(caseData, quoteOpts);

  const steps = [];
  const push = (state, actor, event) => steps.push({ state, actor, event });
  const shortHash = (h) => (typeof h === 'string' ? h.slice(0, 10) : 'n/a');

  push('Created', 'Exporter',
    `Pledge eBL ${initialQuote.bl_id} backing cargo valued at ${usd(initialQuote.ai_verified_collateral_value_usd)}`);
  push('Priced', 'AI Pricing Agent',
    `${initialQuote.pricing_action}: issue ${initialQuote.final_issue_price_usd.toFixed(3)}, supply ${initialQuote.recommended_token_supply.toLocaleString('en-US')}, ${(initialQuote.implied_gross_yield_bps / 100).toFixed(1)}% target upside (quote ${shortHash(initialQuote.quote_hash)})`);

  // AI declines to open the offering at all.
  if (NON_OPENING_ACTIONS.has(initialQuote.pricing_action)) {
    const state = STATE_BY_PRICING_ACTION[initialQuote.pricing_action];
    push(state, 'RiskPricingOracle', `Offering not opened — ${initialQuote.investor_explanation}`);
    return finalize(initialQuote, initialQuote, { requested_usd: 0, raised_usd: 0, tokens: 0 }, state, steps);
  }

  push('Open', 'Contract',
    `RWA offering opens at ${usd(initialQuote.final_issue_price_usd)}/token for ${initialQuote.recommended_token_supply.toLocaleString('en-US')} tokens (1.00 target redemption, not guaranteed)`);

  const subscriptionUsd = Number(opts.subscription_usd ?? initialQuote.expected_cash_to_exporter_usd);
  const tokens = Math.floor(Math.min(subscriptionUsd / initialQuote.final_issue_price_usd, initialQuote.recommended_token_supply));
  const raised = round(tokens * initialQuote.final_issue_price_usd, 2);
  push('Subscribed', 'Investors', `Permissioned investors subscribe ${usd(raised)} for ${tokens.toLocaleString('en-US')} RWA`);
  push('Funded', 'Contract', `${usd(raised)} released to exporter; eBL held as pool collateral`);
  push('InTransit', 'Carrier', 'Cargo in transit; AI Pricing & Risk Agent monitors macro and shipment risk');

  let finalQuote = initialQuote;
  let endState = 'InTransit';

  if (events.length > 0) {
    const reQuote = quoteFromCase(applyEvents(caseData, events), quoteOpts);
    finalQuote = reQuote;
    if (NON_OPENING_ACTIONS.has(reQuote.pricing_action)) {
      endState = STATE_BY_PRICING_ACTION[reQuote.pricing_action];
      push(endState, 'RiskPricingOracle',
        `Risk escalated to ${reQuote.risk_level}: ${reQuote.pricing_action}. New evidence ${shortHash(reQuote.evidence_hash)}`);
    } else if (reQuote.final_issue_price_usd < initialQuote.final_issue_price_usd - REPRICE_THRESHOLD) {
      endState = 'Repriced';
      push('Repriced', 'RiskPricingOracle',
        `Risk up to ${reQuote.risk_level}: reprice ${initialQuote.final_issue_price_usd.toFixed(3)} -> ${reQuote.final_issue_price_usd.toFixed(3)} (evidence ${shortHash(reQuote.evidence_hash)})`);
    } else {
      push('InTransit', 'RiskPricingOracle', `Risk reassessed (${reQuote.risk_level}); price held at ${reQuote.final_issue_price_usd.toFixed(3)}`);
    }
  }

  // Settlement path when the pool is still healthy.
  if (endState === 'InTransit' || endState === 'Repriced') {
    push('Repaid', 'Importer', 'Importer settles the invoice under the L/C; pool receives funds');
    push('Redeemed', 'Investors', `Investors redeem RWA at the 1.00 target; exporter receives the residual after ${usd(finalQuote.financing_cost_usd)} financing cost`);
    endState = 'Redeemed';
  }

  return finalize(initialQuote, finalQuote, { requested_usd: round(subscriptionUsd, 2), raised_usd: raised, tokens }, endState, steps);
}

function finalize(initialQuote, finalQuote, subscription, finalState, steps) {
  return {
    case_id: initialQuote.case_id,
    bl_id: initialQuote.bl_id,
    payout_speed: initialQuote.payout_speed,
    final_state: finalState,
    initial_quote: initialQuote,
    final_quote: finalQuote,
    subscription,
    steps
  };
}
