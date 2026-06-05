import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { calculateRisk } from '../src/core/riskEngine.js';
import { runHarnessScenarios } from '../src/core/scenarioRunner.js';
import { assertRiskReport, assertTradeCase } from '../src/core/schema.js';

const requiredFiles = [
  'README.md',
  'docs/background.md',
  'docs/PRD.md',
  'docs/acceptance.md',
  'docs/award-roadmap.md',
  'docs/tasks.md',
  'data/demo-case.json',
  'data/scenarios/low-risk-approved.json',
  'data/scenarios/warning-margin-call.json',
  'data/scenarios/critical-liquidation.json',
  'src/app/server.js',
  'src/core/riskEngine.js',
  'src/core/scenarioRunner.js',
  'src/core/schema.js',
  'tests/riskEngine.test.js',
  'tests/smoke.test.js'
];

for (const file of requiredFiles) {
  await fs.access(file);
}

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
for (const script of ['install', 'dev', 'test', 'check', 'demo', 'smoke', 'scenarios']) {
  assert.ok(pkg.scripts[script], `Missing package script: ${script}`);
}

const data = JSON.parse(await fs.readFile('data/demo-case.json', 'utf8'));
assertTradeCase(data);
const report = calculateRisk(data);
assertRiskReport(report, data);

const scenarioResults = await runHarnessScenarios();
assert.ok(scenarioResults.length >= 4, 'Expected demo case plus at least three scenario fixtures');
assert.ok(scenarioResults.some((scenario) => scenario.contract_action === 'APPROVE_FINANCING'));
assert.ok(scenarioResults.some((scenario) => scenario.contract_action === 'TRIGGER_MARGIN_CALL'));
assert.ok(scenarioResults.some((scenario) => scenario.contract_action === 'TRIGGER_LIQUIDATION'));

console.log('check passed: files, scripts, seed data, schema and scenario harness are valid.');
