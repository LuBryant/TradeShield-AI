# TradeShield Agent 拿奖路线与能力规划

这份文档回答一个问题：如果 TradeShield-Agent-Starter 不只是准备仓库，而是要在黑客松里冲奖，下一步应该补哪些任务、给 AI 什么能力、合约做到什么程度，以及 Harness 如何保证所有人没有跑偏。

## 1. 最有竞争力的项目定位

推荐主叙事：

> TradeShield Agent 是一个 eBL-backed trade finance risk copilot：它把电子提单、保险、市场价格和运输事件转成结构化 RiskReport，再把 RiskReport 推给链上 RiskOracle，使贸易融资池能自动预警、冻结、追加保证金或清算。

不要把项目讲成“又一个 RWA 融资 dApp”。评委更想看到：

1. AI 不是装饰，而是产生可验证、可追责、可上链的风险信号。
2. 合约不是摆设，而是用 RiskReport 改变真实状态机。
3. eBL 不是泛泛提法，而是作为可转让单据 / 货权凭证的核心 collateral primitive。
4. 项目知道合规边界：permissioned pool、合格投资者、不做公开募资、不承诺收益。

## 2. 必须新增的任务

### P0：拿奖主链路

| ID | 任务 | 产物 | 验证 |
|---|---|---|---|
| P0-1 | 固定 TradeCase / RiskReport / Workflow schema | `src/core/schema.js` | `npm run check` |
| P0-2 | 增加多场景 fixtures | `data/scenarios/*.json` | `npm run scenarios` |
| P0-3 | 打通 scenario harness API | `/api/scenarios` | `npm run smoke` |
| P0-4 | 实现 Solidity 三件套接口 | `EBLRegistry` / `RiskOracle` / `TradeFinancePool` | `hardhat test` |
| P0-5 | RiskReport evidence_hash 写入 RiskOracle | contract event + ABI | `hardhat test` |
| P0-6 | 前端展示“AI 触发链上状态变化” | timeline + transaction/event | 手动演示 |

### P1：AI Agent 能力

| ID | 任务 | 说明 | 验证 |
|---|---|---|---|
| AI-A | Document consistency checker | eBL、invoice、insurance、financing request 字段一致性检查 | fixture test |
| AI-B | Risk explanation generator | LLM 只生成解释，不决定分数 | schema test |
| AI-C | Risk policy guardrail | 输出必须符合 JSON schema，失败回退 deterministic engine | provider fallback test |
| AI-D | RAG evidence retriever | 从团队文档、规则、合约 ABI、demo case 中检索依据 | retrieval eval |
| AI-E | Judge Q&A assistant | 回答合规、eBL、风险模型、合约状态机问题 | demo rehearsal |

### P2：MCP / Skill

建议做一个轻量 MCP server，而不是为了“用了 MCP”而做。MCP 工具应该服务于 demo 主链路：

| Tool | 输入 | 输出 | 用途 |
|---|---|---|---|
| `get_trade_case` | `case_id` | TradeCase JSON | 让 Agent 获取标准 case |
| `verify_document_bundle` | TradeCase | consistency findings | 单据一致性检查 |
| `calculate_risk` | TradeCase | RiskReport | 统一风险结果 |
| `simulate_workflow` | TradeCase | workflow result | 展示链上状态变化 |
| `push_risk_to_oracle` | RiskReport | tx hash / mock receipt | 连接合约 |
| `retrieve_trade_policy` | query | cited snippets | RAG 依据检索 |

Skill 不需要很多。建议只做 2 个：

1. `tradeshield-risk-analyst`：固定审单、估值、解释、风险动作输出流程。
2. `tradeshield-demo-operator`：演示时按剧本运行 scenario、合约交易、Q&A。

### P3：RAG

RAG 的价值不是让 Agent 胡乱查资料，而是让它在评委追问时能引用团队自己的规则和行业背景。

建议知识库只放：

1. `docs/background.md`
2. `docs/PRD.md`
3. `docs/award-roadmap.md`
4. 合约 ABI / NatSpec
5. 风险评分规则说明
6. eBL / MLETR / DCSA / ICC DSI 的精简背景笔记

RAG 评测要小而硬：

| Query | 期望 |
|---|---|
| 为什么 eBL 可以作为融资抵押物？ | 能解释可转让单据 / 货权凭证逻辑 |
| 为什么不能开放二级市场？ | 能解释合规边界 |
| 为什么 AI 输出能触发合约？ | 能指出 RiskReport schema 和 RiskOracle |
| 如果保险快过期怎么办？ | 能映射到风险事件和 contract_action |

## 3. 最小合约三件套

### 3.1 EBLRegistry

目的：记录电子提单凭证，不要一开始做复杂 NFT 市场。

最小函数：

```solidity
function mintEBL(bytes32 metadataHash, address holder) external returns (uint256 eblId);
function pledge(uint256 eblId, address pool) external;
function releasePledge(uint256 eblId) external;
function holderOf(uint256 eblId) external view returns (address);
```

### 3.2 RiskOracle

目的：让 AI 的 RiskReport 变成链上可审计事件。

最小函数：

```solidity
function updateRisk(
    uint256 poolId,
    uint8 riskLevel,
    uint16 healthFactorBps,
    uint8 action,
    bytes32 evidenceHash
) external;
```

必须 emit：

```solidity
event RiskUpdated(uint256 poolId, uint8 riskLevel, uint16 healthFactorBps, uint8 action, bytes32 evidenceHash);
```

### 3.3 TradeFinancePool

目的：把融资池状态机跑通。

最小状态：

```solidity
Created -> Funding -> Funded -> InTransit -> Warning/Frozen/Liquidation/Repaid
```

最小函数：

```solidity
function createPool(uint256 eblId, uint256 targetAmount, uint64 maturity) external returns (uint256 poolId);
function deposit(uint256 poolId, uint256 amount) external;
function releaseFunds(uint256 poolId) external;
function applyRiskAction(uint256 poolId, uint8 action) external;
function repay(uint256 poolId, uint256 amount) external;
```

## 4. 测试链部署建议

不要一开始追求复杂多链。优先：

1. 本地 Hardhat：保证合约测试稳定。
2. Sepolia 或 Base Sepolia：部署最小三件套。
3. 前端只需要展示合约地址、交易 hash、RiskUpdated event。

可以借鉴 `crowdfunding-dapp-main` 的结构：

```text
packages/hardhat/contracts
packages/hardhat/deploy
packages/hardhat/test
packages/nextjs/contracts
```

但业务上不要照搬众筹逻辑。TradeShield 的核心不是捐赠/众筹，而是“eBL 凭证 + permissioned financing pool + AI risk oracle”。

## 5. Harness 新规则

每个新增功能必须回答：

1. 它改变哪个 scenario？
2. 它输出哪个 schema？
3. 它是否影响 contract_action？
4. 它是否需要写入 RiskOracle？
5. 它的失败兜底是什么？

当前 Harness 命令：

```bash
npm run check
npm run test
npm run smoke
npm run scenarios
npm run demo
```

推荐 PR 验证顺序：

```bash
npm run check
npm run test
npm run smoke
npm run scenarios
```

## 6. 最终演示结构

3 分钟版本：

1. 30 秒：出口商拿到 eBL，但现金流被运输周期卡住。
2. 40 秒：AI 审核 eBL、保险、价格、运输事件，输出 RiskReport。
3. 40 秒：合约接收 evidence_hash，RiskOracle emit event。
4. 40 秒：TradeFinancePool 根据 action 进入 Warning / Liquidation。
5. 30 秒：解释合规边界和未来可接真实 eBL 平台 / AIS / 保险数据。
6. 10 秒：一句话收尾：TradeShield turns trade documents into on-chain risk controls.

## 7. 最后的取舍

如果时间只够做三件事，优先顺序是：

1. RiskReport schema + scenario harness 稳定。
2. RiskOracle + TradeFinancePool 最小合约能测能部署。
3. 前端展示 AI 风险报告如何触发链上状态变化。

MCP、Skill、RAG 是加分项，但必须服务于这条主链路。不要让它们变成新的不稳定入口。
