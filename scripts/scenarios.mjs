import { runHarnessScenarios } from '../src/core/scenarioRunner.js';

const results = await runHarnessScenarios();

console.log('\nTradeShield harness scenarios');
console.log('='.repeat(42));
for (const result of results) {
  console.log(
    [
      result.case_id,
      result.contract_action,
      `state=${result.final_state}`,
      `risk=${result.risk_level}`,
      `hf=${result.health_factor}`
    ].join(' | ')
  );
}

const counts = results.reduce((summary, result) => {
  summary[result.contract_action] = (summary[result.contract_action] ?? 0) + 1;
  return summary;
}, {});

console.log('\nAction coverage');
console.log(JSON.stringify(counts, null, 2));
