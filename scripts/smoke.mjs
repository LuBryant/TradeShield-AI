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
  assert.ok(scenarios.scenarios.length >= 5);
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'APPROVE_FINANCING'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'TRIGGER_LIQUIDATION'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'FREEZE_POOL'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'CONTINUE_WITH_WARNING'));
  assert.ok(scenarios.scenarios.some((scenario) => scenario.contract_action === 'TRIGGER_MARGIN_CALL'));

  // MCP endpoints
  const mcpTools = await fetch(`${baseUrl}/api/mcp/tools`).then((r) => r.json());
  assert.equal(mcpTools.ok, true);
  assert.equal(mcpTools.tools.length, 5);

  const mcpCall = await fetch(`${baseUrl}/api/mcp/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool: 'get_trade_case', params: { case_id: 'CASE-EBL-2026-0001' } })
  }).then((r) => r.json());
  assert.equal(mcpCall.ok, true);
  assert.equal(mcpCall.result.case_id, 'CASE-EBL-2026-0001');

  // RAG endpoints
  const ragSearch = await fetch(`${baseUrl}/api/rag/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'copper' })
  }).then((r) => r.json());
  assert.equal(ragSearch.ok, true);
  assert.ok(ragSearch.match_count > 0);

  const judgeQA = await fetch(`${baseUrl}/api/rag/judge-qa`).then((r) => r.json());
  assert.equal(judgeQA.ok, true);
  assert.equal(judgeQA.pairs.length, 4);

  // Skill endpoints
  const skillPricing = await fetch(`${baseUrl}/api/skill/pricing-analyst`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ case_id: 'CASE-EBL-2026-0001' })
  }).then((r) => r.json());
  assert.equal(skillPricing.ok, true);
  assert.equal(skillPricing.status, 'ok');

  const skillDemo = await fetch(`${baseUrl}/api/skill/demo-operator`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ case_id: 'CASE-EBL-2026-0001' })
  }).then((r) => r.json());
  assert.equal(skillDemo.ok, true);
  assert.equal(skillDemo.status, 'ok');

  console.log('smoke passed: API health, demo data, workflow, scenarios, MCP, RAG and Skill harness work.');
} finally {
  server.close();
}
