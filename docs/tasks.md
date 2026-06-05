# TradeShield Agent MVP 任务拆分

任务状态：`Todo` / `In Progress` / `Review` / `Done` / `Blocked`

每个任务都必须有 Owner 和可验证方式。没有验证方式的任务不要认领。  
当前主线：**AI 动态定价的 eBL-backed RWA 折价发行协议**。

## 1. 本轮开发优先级

| Priority | 目标 | 说明 |
|---|---|---|
| P0 | 跑通 AI 定价主链路 | 出口商选择到账速度，AI 给出 RWA 发行价，投资者看到折价和风险 |
| P0 | 固定 PricingQuote schema | 让 AI、后端、前端、合约都围绕同一份结构化输出 |
| P0 | 完成 Investor RWA Offering 页面 | 评委必须看到“风险越高，价格越低，潜在收益越高” |
| P1 | 合约 mock / 最小 Solidity | RWAOfferingPool + RiskPricingOracle（**WEB3-1~9 Done**；WEB3-10~11 待做） |
| P1 | 多场景回归 | fast / balanced / high-risk repricing |
| P2 | MCP / RAG / Skill | 作为 Agent 能力加分项，不阻塞主 demo |

## 2. Product / Business / PM

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| PM-1 | 固定一句话 pitch：AI dynamically prices eBL-backed RWA | Unassigned | Todo | README / pitch 更新 | - |
| PM-2 | 明确 RWA 折价发行模型：0.80 / 0.90 / 1.00 target redemption | Unassigned | Todo | docs/PRD.md 已体现 | - |
| PM-3 | 准备 3 分钟 demo 脚本：出口商融资 -> AI 定价 -> 投资者认购 -> 风险改价 | Unassigned | Todo | script 文档或 README 更新 | - |
| PM-4 | 准备合规 Q&A：target redemption 不是保本承诺 | Unassigned | Todo | docs/PRD.md / pitch 更新 | - |
| PM-5 | 准备 investor-facing 文案：折价、风险、潜在收益、非保本 | Unassigned | Todo | 前端文案 review | - |
| PM-6 | 设计 3 个演示场景：快速到账、慢速到账、高风险降价/暂停 | Unassigned | Todo | `npm run scenarios` | - |
| PM-7 | 录制最终备份 demo 视频 | Unassigned | Todo | 视频链接 | - |

## 3. Agent / AI

AI 的目标不是“写一段解释”，而是产出可被后端、前端和合约使用的 **PricingQuote**。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| AI-1 | 固定 `PricingQuote` JSON schema | Unassigned | Todo | `npm run test` | - |
| AI-2 | 实现 base issue price：根据 `payout_speed` 输出 0.80 / 0.86 / 0.90 等基础价格 | Unassigned | Todo | pricing unit test | - |
| AI-3 | 实现 urgency discount：出口商越急，发行价越低 | Unassigned | Todo | scenario test | - |
| AI-4 | 实现 risk discount：天气、战争、港口、保险、价格波动影响发行价 | Unassigned | Todo | `npm run scenarios` | - |
| AI-5 | 实现 collateral coverage guardrail：防止 100 万货物发行过高目标兑付敞口 | Unassigned | Todo | pricing invariant test | - |
| AI-6 | 实现 investor explanation generator：解释为什么价格是 0.80 / 0.90 | Unassigned | Todo | `npm run demo` 输出包含 explanation | - |
| AI-7 | 实现 evidence graph mock：列出每个折扣对应的证据 | Unassigned | Todo | schema test | - |
| AI-8 | 实现 document consistency checker：eBL / invoice / insurance 字段一致性 | Unassigned | Todo | fixture test | - |
| AI-9 | 接入 Qwen / DeepSeek 可选 provider，必须有 deterministic fallback | Unassigned | Todo | provider fallback test | - |
| AI-10 | 生成 high-risk scenario：战争 / 严重天气 / 保险缺口导致降价或暂停 | Unassigned | Todo | `npm run scenarios` | - |
| AI-11 | 建立 RAG 风险情报知识库：项目文档 + mock macro risk feed | Unassigned | Todo | retrieval eval | - |
| AI-12 | 做 Judge Q&A assistant：解释 AI 定价、非保本、合约动作 | Unassigned | Todo | 彩排通过 | - |

## 4. Backend / Integration

后端目标：把 AI 定价结果变成稳定 API，并让前端和合约 mock 能复用同一套数据。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| BE-1 | 更新 demo case：加入 `requested_cash_usd`、`payout_speed`、`target_redemption_value_usd` | Unassigned | Todo | `npm run check` | - |
| BE-2 | 增加 `PricingQuote` schema validator | Unassigned | Todo | `npm run test` | - |
| BE-3 | 实现 `/api/pricing/quote` | Unassigned | Todo | `npm run smoke` | - |
| BE-4 | 实现 `/api/offering/simulate`：发行、认购、风险改价、暂停、结算 | Unassigned | Todo | `npm run smoke` | - |
| BE-5 | 增加 scenario fixtures：fast payout / balanced payout / high-risk repricing | Unassigned | Todo | `npm run scenarios` | - |
| BE-6 | 把 PricingQuote 和 RiskReport 合并进 workflow simulation | Unassigned | Todo | `npm run test` | - |
| BE-7 | API 错误输入校验：发行数量过高、价格不合法、target redemption 超抵押覆盖 | Unassigned | Todo | invalid payload test | - |
| BE-8 | 输出 `quote_hash` / `evidence_hash`，供合约 oracle 使用 | Unassigned | Todo | `npm run test` | - |
| BE-9 | 保持原有 `/api/health`、`/api/demo-data`、`/api/risk/analyze`、`/api/workflow/simulate` 可用 | Unassigned | Todo | `npm run smoke` | - |
| BE-10 | 集成最终 demo CLI：打印 RWA price、investor yield、risk factors | Unassigned | Todo | `npm run demo` | - |

## 5. Frontend

前端目标：让评委一眼看到“AI 正在给 RWA 定价”，而不是普通 dashboard。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| FE-1 | Exporter Financing Quote 页面：选择 FAST / BALANCED / LOW_COST | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-2 | Exporter 页面展示：发行价、预计到账、融资成本、推荐发行数量 | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-3 | Investor RWA Offering 页面：展示 issue price、target redemption、implied gross yield | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-4 | Investor 页面展示 AI risk factors：战争、天气、港口、保险、价格波动 | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-5 | AI Pricing Console：base price、urgency discount、risk discount、final price | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-6 | Smart Contract Timeline：Created -> Priced -> Open -> Repriced/Paused/Funded/Redeemed | Unassigned | Todo | `npm run smoke` + 手动验证 | - |
| FE-7 | Scenario selector：一键切换 fast / balanced / high-risk | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-8 | Subscribe mock：投资者输入认购金额，显示获得 RWA 数量 | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-9 | Evidence hash / quote hash 展示 | Unassigned | Todo | 手动访问 `npm run dev` | - |
| FE-10 | 合规提示 UI：target redemption is not guaranteed | Unassigned | Todo | 文案 review | - |

## 6. Web3 / Contract

Web3 目标：把 AI 定价结果写成链上可验证事件，而不是只在前端展示。

**进度摘要（2026-06-05）**

| 范围 | 状态 | 说明 |
|---|---|---|
| WEB3-1 ~ WEB3-4 | Done | 冻结设计见 `docs/contracts.md` |
| WEB3-5 | Done | JS contract mock：`src/core/contractHarness.js` |
| WEB3-6 ~ WEB3-9 | Done | Hardhat 合约 + 测试：`hardhat/`，`hardhat test` 6 passing |
| WEB3-10 ~ WEB3-11 | Todo | 测试网部署 |

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| WEB3-1 | 设计 `EBLRegistry`：mint / pledge / release pledge | Sage | Done | docs/PRD.md 更新 | `docs/contracts.md` §3 + `docs/PRD.md` §9.3 |
| WEB3-2 | 设计 `RWAToken`：代表投资者 RWA 凭证 | Sage | Done | contract interface doc | `docs/contracts.md` §4 |
| WEB3-3 | 设计 `RWAOfferingPool`：createOffering / subscribe / settle / pause | Sage | Done | contract interface doc | `docs/contracts.md` §5 |
| WEB3-4 | 设计 `RiskPricingOracle`：updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash) | Sage | Done | contract interface doc | `docs/contracts.md` §6 |
| WEB3-5 | 实现 JS contract mock：模拟发行、认购、改价、暂停 | Sage | Done | `npm run test` | `src/core/contractHarness.js` + `tests/contractHarness.test.js`，`npm run test` 10 passed，事件已对齐 `docs/contracts.md` |
| WEB3-6 | 建立 Hardhat 合约目录结构 | Sage | Done | `hardhat compile` | `hardhat/`（package.json + hardhat.config.cjs），`hardhat compile` 4 files OK |
| WEB3-7 | 实现最小 Solidity `RiskPricingOracle` 并 emit `PricingUpdated` | Sage | Done | `hardhat test` | `hardhat/contracts/RiskPricingOracle.sol`，`hardhat test` 6 passing |
| WEB3-8 | 实现最小 Solidity `RWAOfferingPool` | Sage | Done | `hardhat test` | `hardhat/contracts/RWAOfferingPool.sol`（+ EBLRegistry/RWAToken），`hardhat test` 6 passing |
| WEB3-9 | 把 `quote_hash` / `evidence_hash` 写入合约事件 | Sage | Done | contract event test | `PricingUpdated` + `OfferingRepriced` 含 evidence/quote hash，`latestQuoteHash/latestEvidenceHash` 持久化，测试已验证 |
| WEB3-10 | 部署到 Sepolia 或 Base Sepolia 测试网 | Sage | Todo | 部署地址 + tx hash | - |
| WEB3-11 | 前端展示合约地址和 PricingUpdated event | Sage | Todo | 手动演示 | - |

## 7. MCP / RAG / Skill

这些是加分项，必须服务 AI 定价主链路。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| MCP-1 | 设计 TradeShield MCP tools manifest | Unassigned | Todo | docs 更新 | - |
| MCP-2 | 实现 `get_trade_case` | Unassigned | Todo | MCP tool call test | - |
| MCP-3 | 实现 `generate_pricing_quote` | Unassigned | Todo | MCP tool call test | - |
| MCP-4 | 实现 `simulate_offering` | Unassigned | Todo | MCP tool call test | - |
| MCP-5 | 实现 `push_pricing_to_oracle` mock / real tx | Unassigned | Todo | mock receipt / tx hash | - |
| RAG-1 | 建立风险情报资料：天气、战争、港口、保险、价格 mock feed | Unassigned | Todo | retrieval eval | - |
| RAG-2 | 准备 4 个评委追问检索问题 | Unassigned | Todo | Q&A dry run | - |
| SKILL-1 | 创建 `tradeshield-pricing-analyst` skill | Unassigned | Todo | skill dry run | - |
| SKILL-2 | 创建 `tradeshield-demo-operator` skill | Unassigned | Todo | demo rehearsal | - |

## 8. QA / Integrator

QA 目标：任何新增功能都必须回到同一条主链路，不能散。

| ID | Task | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| QA-1 | 维护 `npm run check` | Unassigned | Todo | `npm run check` | - |
| QA-2 | 维护 `npm run test` | Unassigned | Todo | `npm run test` | - |
| QA-3 | 维护 `npm run smoke` | Unassigned | Todo | `npm run smoke` | - |
| QA-4 | 维护 `npm run scenarios` | Unassigned | Todo | `npm run scenarios` | - |
| QA-5 | 增加 pricing invariant tests：兑付敞口不能超过安全覆盖 | Unassigned | Todo | `npm run test` | - |
| QA-6 | 增加前端手动验收清单 | Unassigned | Todo | checklist 文档 | - |
| QA-7 | 最终演示前跑完整验证矩阵 | Unassigned | Todo | `npm run check && npm run test && npm run smoke && npm run scenarios && npm run demo` | - |
| QA-8 | 准备演示失败兜底：CLI demo、mock provider、contract mock | Unassigned | Todo | README / docs 更新 | contract mock 已完成（`contractHarness.js`）；CLI demo / README 兜底说明待补 |
| QA-9 | 最后 6 小时功能冻结协调 | Unassigned | Todo | 全员确认 | - |

## 9. 推荐并行分工

| 角色 | 负责人建议 | 主要任务 |
|---|---|---|
| PM / Pitch | 1 人 | PM-1 到 PM-7，demo script，合规 Q&A |
| AI | 1-2 人 | AI-1 到 AI-10，pricing model，risk discount，explanation |
| Backend | 1 人 | BE-1 到 BE-10，API，schema，scenario |
| Frontend | 1-2 人 | FE-1 到 FE-10，Exporter + Investor + AI Console |
| Web3 | 1 人 | WEB3-1 到 WEB3-11，合约 mock / Solidity |
| QA / Integrator | 1 人 | QA-1 到 QA-9，最终集成和兜底 |

## 10. 任务认领流程

1. 先拉最新 `main`。
2. 在本文件找到 `Unassigned` 任务。
3. 把 Owner 改成自己。
4. 把 Status 改成 `In Progress`。
5. 开分支开发。
6. 完成后跑验证命令。
7. 提 PR。
8. 合并后把 Status 改成 `Done`，Done Evidence 填 PR 或 commit。

## 11. 分支命名

```text
feature/ai-pricing-quote
feature/backend-pricing-api
feature/frontend-rwa-offering
feature/contract-risk-pricing-oracle
feature/scenario-high-risk-reprice
fix/pricing-invariant
docs/pitch-tokenomics
```

## 12. 合并标准

PR 必须满足：

```text
1. 有明确 Owner
2. 有对应任务 ID
3. 有验证命令
4. 不破坏 demo 主流程
5. 如果涉及 RWA 定价，必须说明 issue price / target redemption / risk discount 的关系
6. 如果涉及投资者收益，必须保留非保本文案
```

主流程相关改动必须跑：

```bash
npm run check
npm run test
npm run smoke
npm run scenarios
npm run demo
```

## 13. 最小可演示闭环

如果时间不够，只保这 8 个任务：

```text
AI-1 PricingQuote schema
AI-2 base issue price
AI-4 risk discount
BE-3 /api/pricing/quote
BE-5 pricing scenarios
FE-1 Exporter Financing Quote
FE-3 Investor RWA Offering
PM-3 3-minute demo script
```

这 8 个完成，项目就能讲清楚“AI 如何定价 RWA”。合约和 MCP/RAG 可以作为加分项继续堆。
