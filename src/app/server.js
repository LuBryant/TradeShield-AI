import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { calculateRisk } from '../core/riskEngine.js';
import { runHarnessScenarios, runScenario } from '../core/scenarioRunner.js';
import { assertRiskReport, assertTradeCase, ValidationError } from '../core/schema.js';
import { simulateWorkflow } from '../core/workflow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');
const dataPath = path.join(rootDir, 'data/demo-case.json');

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return null;
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text === '' ? null : JSON.parse(text);
}

async function loadDemoCase() {
  return JSON.parse(await fs.readFile(dataPath, 'utf8'));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { 'content-type': contentType });
  response.end(text);
}

function sendError(response, error) {
  const isValidationError = error instanceof ValidationError || error instanceof SyntaxError;
  sendJson(response, isValidationError ? 400 : 500, {
    ok: false,
    error: error.message,
    details: error.errors ?? undefined
  });
}

async function serveStatic(urlPath, response) {
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };
    response.writeHead(200, { 'content-type': types[ext] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true, service: 'tradeshield-agent-harness' });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/demo-data') {
        sendJson(response, 200, await loadDemoCase());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/risk/analyze') {
        const body = await readJsonBody(request);
        const caseData = body ?? await loadDemoCase();
        assertTradeCase(caseData);
        const report = calculateRisk(caseData);
        assertRiskReport(report, caseData);
        sendJson(response, 200, report);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/workflow/simulate') {
        const body = await readJsonBody(request);
        sendJson(response, 200, simulateWorkflow(body ?? await loadDemoCase()));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/scenarios') {
        sendJson(response, 200, { ok: true, scenarios: await runHarnessScenarios() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/scenarios/run') {
        const body = await readJsonBody(request);
        sendJson(response, 200, runScenario(body ?? await loadDemoCase()));
        return;
      }

      // ========================
      // MCP / RAG / Skill Endpoints
      // ========================

      // MCP-1: Return tools manifest
      if (request.method === 'GET' && url.pathname === '/api/mcp/tools') {
        const { MCP_TOOLS_MANIFEST } = await import('../mcp/mcpServer.js');
        sendJson(response, 200, { ok: true, protocol: 'tradeshield-mcp-v1', tools: MCP_TOOLS_MANIFEST });
        return;
      }

      // MCP-2~5: Universal tool call dispatcher
      if (request.method === 'POST' && url.pathname === '/api/mcp/call') {
        const body = await readJsonBody(request);
        if (!body || !body.tool) {
          sendJson(response, 400, { ok: false, error: 'Missing "tool" in request body. Available tools: GET /api/mcp/tools' });
          return;
        }
        try {
          const { callTool } = await import('../mcp/mcpServer.js');
          const result = await callTool(body.tool, body.params ?? {});
          sendJson(response, 200, { ok: true, ...result });
        } catch (error) {
          sendJson(response, 400, { ok: false, error: error.message, tool: body.tool });
        }
        return;
      }

      // RAG: Search knowledge base
      if (request.method === 'POST' && url.pathname === '/api/rag/search') {
        const body = await readJsonBody(request);
        if (!body || !body.query) {
          sendJson(response, 400, { ok: false, error: 'Missing "query" in request body' });
          return;
        }
        const { searchKnowledgeBase } = await import('../rag/search.js');
        const results = searchKnowledgeBase(body.query, {
          categories: body.categories,
          limit: body.limit || 10
        });
        sendJson(response, 200, { ok: true, query: body.query, matches: results, match_count: results.length });
        return;
      }

      // RAG-2: Return Judge Q&A pairs
      if (request.method === 'GET' && url.pathname === '/api/rag/judge-qa') {
        const { JUDGE_QA_PAIRS } = await import('../rag/judgeQA.js');
        sendJson(response, 200, { ok: true, pairs: JUDGE_QA_PAIRS });
        return;
      }

      // RAG: Full risk sweep for a case
      if (request.method === 'POST' && url.pathname === '/api/rag/risk-sweep') {
        const body = await readJsonBody(request);
        const caseData = body ?? await loadDemoCase();
        const { fullRiskSweep } = await import('../rag/search.js');
        sendJson(response, 200, { ok: true, ...fullRiskSweep(caseData) });
        return;
      }

      // SKILL-1: Run pricing analyst
      if (request.method === 'POST' && url.pathname === '/api/skill/pricing-analyst') {
        const body = await readJsonBody(request);
        const { runPricingAnalyst } = await import('../skill/pricingAnalyst.js');
        const result = await runPricingAnalyst(body ?? { case_id: 'CASE-EBL-2026-0001' });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      // SKILL-2: Run demo operator
      if (request.method === 'POST' && url.pathname === '/api/skill/demo-operator') {
        const body = await readJsonBody(request);
        const { runDemoOperator } = await import('../skill/demoOperator.js');
        const result = await runDemoOperator(body ?? { case_id: 'CASE-EBL-2026-0001' });
        sendJson(response, 200, { ok: true, ...result });
        return;
      }

      if (request.method === 'GET') {
        await serveStatic(url.pathname, response);
        return;
      }

      sendText(response, 405, 'Method not allowed');
    } catch (error) {
      sendError(response, error);
    }
  });
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntryPoint) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, () => {
    console.log(`TradeShield Agent harness running at http://localhost:${port}`);
  });
}
