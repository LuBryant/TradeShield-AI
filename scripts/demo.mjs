import fs from 'node:fs/promises';
import { simulateWorkflow } from '../src/core/workflow.js';

const data = JSON.parse(await fs.readFile('data/demo-case.json', 'utf8'));
const result = simulateWorkflow(data);

console.log('\nTradeShield Agent mock demo flow');
console.log('='.repeat(42));
for (const [index, step] of result.steps.entries()) {
  console.log(`${index + 1}. [${step.state}] ${step.actor}: ${step.event}`);
}
console.log('\nRisk report');
console.log(JSON.stringify(result.risk_report, null, 2));
