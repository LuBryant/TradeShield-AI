import assert from 'node:assert/strict';
import { createServer } from '../src/app/server.js';

const server = createServer();
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true);

  const demo = await fetch(`${baseUrl}/api/demo-data`).then((r) => r.json());
  assert.equal(demo.bill_of_lading.bl_id, 'EBL-2026-0001');

  const workflow = await fetch(`${baseUrl}/api/workflow/simulate`, { method: 'POST' }).then((r) => r.json());
  assert.ok(workflow.risk_report.evidence_hash.startsWith('0x'));
  assert.ok(workflow.steps.length >= 5);

  const scenarios = await fetch(`${baseUrl}/api/scenarios`).then((r) => r.json());
  assert.equal(scenarios.ok, true);
  assert.ok(scenarios.scenarios.length >= 4);
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'APPROVE_FINANCING'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'TRIGGER_LIQUIDATION'));

  console.log('smoke passed: API health, demo data, workflow and scenario harness work.');
} finally {
  server.close();
}
