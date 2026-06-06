import fs from 'node:fs/promises';
import { simulateWorkflow } from '../src/core/workflow.js';
import { compareSpeeds } from '../src/core/pricingEngine.js';

// --- Part 1: legacy RiskReport workflow (kept for backwards-compatible demo) ---
const data = JSON.parse(await fs.readFile('data/demo-case.json', 'utf8'));
const result = simulateWorkflow(data);

console.log('\nTradeShield Agent mock demo flow (legacy RiskReport engine)');
console.log('='.repeat(58));
for (const [index, step] of result.steps.entries()) {
  console.log(`${index + 1}. [${step.state}] ${step.actor}: ${step.event}`);
}
console.log('\nRisk report');
console.log(JSON.stringify(result.risk_report, null, 2));

// --- Part 2: AI dynamic pricing (new model) -----------------------------------
// Deterministic, offline. Shows how the AI turns payout speed + trade risk +
// exporter profit into an RWA discount issue price for each payout option.
const caseData = JSON.parse(await fs.readFile('data/cases/copper-sg-shanghai.case.json', 'utf8'));
const comparison = compareSpeeds(caseData);
const usd = (n) => 'USD ' + Math.round(n).toLocaleString('en-US');

console.log('\n\nTradeShield AI dynamic pricing — eBL-backed RWA offering');
console.log('='.repeat(58));
const s = comparison.quotes[0];
console.log(`Case        : ${caseData.case_id}`);
console.log(`Collateral  : ${usd(s.ai_verified_collateral_value_usd)} AI-verified  ->  max safe redemption ${usd(s.max_safe_redemption_exposure_usd)}`);
console.log(`Exporter    : profit ${usd(s.exporter_gross_profit_usd)} (margin ${(s.exporter_gross_margin_pct * 100).toFixed(1)}%)  |  requested cash ${usd(s.requested_cash_usd)}`);
console.log(`Trade risk  : ${s.risk_level} (${s.risk_score_bps}bps)`);

console.log('\nPayout speed -> AI issue price (1 RWA = 1.00 USD target redemption, not guaranteed)');
for (const q of comparison.quotes) {
  console.log(
    `  ${q.payout_speed.padEnd(9)} issue ${q.final_issue_price_usd.toFixed(3)}  |  cash now ${usd(q.expected_cash_to_exporter_usd).padEnd(14)}`
    + `  |  financing ${usd(q.financing_cost_usd).padEnd(12)}  |  ${(q.exporter_profit_share_bps / 100).toFixed(1)}% of profit`
    + `  |  ${(q.implied_gross_yield_bps / 100).toFixed(1)}% investor upside  |  ${q.pricing_action}`
  );
}

const rec = comparison.recommended_quote;
console.log(`\nAI recommendation: ${comparison.recommended_payout_speed}`);
console.log('\nInvestor explanation');
console.log('  ' + rec.investor_explanation);
console.log('\nExporter explanation');
console.log('  ' + rec.exporter_explanation);
console.log('\nEvidence hash: ' + rec.evidence_hash);
