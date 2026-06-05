import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app/server.js';

test('smoke: mock API supports the main demo flow', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
    assert.equal(health.ok, true);

    const demo = await fetch(`${baseUrl}/api/demo-data`).then((response) => response.json());
    assert.equal(demo.bill_of_lading.cargo, 'Copper Cathodes');

    const workflow = await fetch(`${baseUrl}/api/workflow/simulate`, { method: 'POST' }).then((response) => response.json());
    assert.equal(workflow.case_id, 'CASE-EBL-2026-0001');
    assert.ok(workflow.final_state);
    assert.ok(workflow.risk_report.contract_action);

    const scenarios = await fetch(`${baseUrl}/api/scenarios`).then((response) => response.json());
    assert.equal(scenarios.ok, true);
    assert.ok(scenarios.scenarios.length >= 4);
    assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'APPROVE_FINANCING'));
  } finally {
    server.close();
  }
});

test('smoke: invalid case payload is rejected as a client error', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${baseUrl}/api/risk/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ case_id: 'BROKEN' })
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.ok(payload.details.length > 0);
  } finally {
    server.close();
  }
});
