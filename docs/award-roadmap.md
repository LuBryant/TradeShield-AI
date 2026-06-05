# TradeShield Agent 拿奖路线与能力规划

这份文档回答一个问题：如果 TradeShield-Agent-Starter 不只是准备仓库，而是要在黑客松里冲奖，下一步应该补哪些任务、给 AI 什么能力、合约做到什么程度，以及 Harness 如何保证所有人没有跑偏。

**命名与接口以 `docs/PRD.md` v0.2 和 `docs/tasks.md` 为准。** 合约四件套：`EBLRegistry`、`RWAToken`、`RWAOfferingPool`、`RiskPricingOracle`。

## 1. 最有竞争力的项目定位

推荐主叙事：

> TradeShield Agent 是一个 **AI 动态定价的 eBL-backed RWA 贸易融资协议**：出口商将电子提单质押到合约，AI Pricing & Risk Agent 根据到账速度、货物估值和运输/宏观风险给出 RWA 折价发行价格；`RiskPricingOracle` 把定价与风险信号上链，`RWAOfferingPool` 据此开放认购、改价、暂停或清算。

不要把项目讲成“又一个 RWA 融资 dApp”。评委更想看到：

1. AI 不是装饰，而是决定 **issue price、risk discount、发行额度约束** 的核心金融功能。
2. 合约不是摆设，而是用 `PricingQuote` / `RiskReport` 改变真实发行池状态机。
3. eBL 不是泛泛提法，而是作为可转让单据 / 货权凭证的核心 collateral primitive。
4. 项目知道合规边界：permissioned pool、合格投资者、不做公开募资、不承诺收益；`target redemption value` 不是保本承诺。

## 2. 必须新增的任务

### P0：拿奖主链路

| ID | 任务 | 产物 | 验证 |
|---|---|---|---|
| P0-1 | 固定 TradeCase / RiskReport / PricingQuote / Workflow schema | `src/core/schema.js` | `npm run check` |
| P0-2 | 增加多场景 fixtures（fast / balanced / high-risk repricing） | `data/scenarios/*.json` | `npm run scenarios` |
| P0-3 | 打通 scenario harness API | `/api/scenarios` | `npm run smoke` |
| P0-4 | 实现 Solidity 最小合约集 | `EBLRegistry` / `RWAOfferingPool` / `RiskPricingOracle`（`RWAToken` 可简化） | `hardhat test` |
| P0-5 | `evidence_hash` / `quote_hash` 写入 `RiskPricingOracle` | `PricingUpdated` event + ABI | `hardhat test` |
| P0-6 | 前端展示“AI 定价触发链上状态变化” | timeline + transaction/event | 手动演示 |

### P1：AI Agent 能力

| ID | 任务 | 说明 | 验证 |
|---|---|---|---|
| AI-A | Document consistency checker | eBL、invoice、insurance、financing request 字段一致性检查 | fixture test |
| AI-B | Pricing explanation generator | LLM 只生成投资者可读解释，不决定价格 | schema test |
| AI-C | Pricing policy guardrail | `PricingQuote` 必须符合 JSON schema，失败回退 deterministic engine | provider fallback test |
| AI-D | RAG evidence retriever | 从团队文档、规则、合约 ABI、demo case 中检索依据 | retrieval eval |
| AI-E | Judge Q&A assistant | 回答合规、eBL、定价模型、合约状态机问题 | demo rehearsal |

### P2：MCP / Skill

建议做一个轻量 MCP server，而不是为了“用了 MCP”而做。MCP 工具应该服务于 demo 主链路：

| Tool | 输入 | 输出 | 用途 |
|---|---|---|---|
| `get_trade_case` | `case_id` | TradeCase JSON | 让 Agent 获取标准 case |
| `verify_document_bundle` | TradeCase | consistency findings | 单据一致性检查 |
| `generate_pricing_quote` | TradeCase + payout_speed | PricingQuote | 统一 AI 定价结果 |
| `calculate_risk` | TradeCase | RiskReport | 统一风险结果（Harness 现有链路） |
| `simulate_offering` | TradeCase / PricingQuote | offering workflow result | 展示 RWA 发行、认购、改价 |
| `simulate_workflow` | TradeCase | workflow result | 展示链上状态变化 |
| `push_pricing_to_oracle` | PricingQuote | tx hash / mock receipt | 连接 `RiskPricingOracle` |
| `retrieve_trade_policy` | query | cited snippets | RAG 依据检索 |

Skill 不需要很多。建议只做 2 个：

1. `tradeshield-pricing-analyst`：固定审单、估值、定价折扣、风险动作输出流程。
2. `tradeshield-demo-operator`：演示时按剧本运行 scenario、合约交易、Q&A。

### P3：RAG

RAG 的价值不是让 Agent 胡乱查资料，而是让它在评委追问时能引用团队自己的规则和行业背景。

建议知识库只放：

1. `docs/background.md`
2. `docs/PRD.md`
3. `docs/award-roadmap.md`
4. 合约 ABI / NatSpec
5. 定价与风险评分规则说明
6. eBL / MLETR / DCSA / ICC DSI 的精简背景笔记

RAG 评测要小而硬：

| Query | 期望 |
|---|---|
| 为什么 eBL 可以作为融资抵押物？ | 能解释可转让单据 / 货权凭证逻辑 |
| 为什么不能开放二级市场？ | 能解释合规边界 |
| 为什么 AI 输出能触发合约？ | 能指出 `PricingQuote` schema 和 `RiskPricingOracle` |
| 为什么风险越高，RWA 发行价越低？ | 能解释 base price、urgency discount、risk discount |
| `target redemption value` 是不是保本？ | 能说明不是 guaranteed repayment |
| 如果保险快过期怎么办？ | 能映射到风险事件和 `pricing_action` / `contract_action` |

## 3. 最小合约四件套

与 `docs/PRD.md` §9.3 和 `docs/tasks.md` WEB3-1 ~ WEB3-4 对齐。时间不够时，**优先做 `RWAOfferingPool` + `RiskPricingOracle`**，`EBLRegistry` 和 `RWAToken` 可先用 JS mock 或最小接口占位。

### 3.1 EBLRegistry

目的：记录电子提单凭证，不要一开始做复杂 NFT 市场。

最小函数：

```solidity
function mintEBL(bytes32 metadataHash, address holder) external returns (uint256 eblId);
function pledge(uint256 eblId, address pool) external;
function releasePledge(uint256 eblId) external;
function holderOf(uint256 eblId) external view returns (address);
```

### 3.2 RWAToken

目的：代表投资者认购获得的 RWA 份额凭证（permissioned mint，非公开交易代币）。

最小函数：

```solidity
function mint(uint256 poolId, address investor, uint256 amount) external;
function balanceOf(uint256 poolId, address investor) external view returns (uint256);
```

### 3.3 RWAOfferingPool

目的：把 RWA 折价发行池状态机跑通。

最小状态（与 PRD `RWAOfferingState` 对齐）：

```text
Created -> Priced -> Open -> Subscribed -> Funded -> InTransit
  -> Repriced / Paused / Frozen -> Repaid / Redeemed / Liquidation
```

最小函数：

```solidity
function createOffering(
    uint256 eblId,
    uint256 tokenSupply,
    uint256 issuePrice,
    uint256 targetRedemptionValue
) external returns (uint256 poolId);

function subscribe(uint256 poolId, uint256 amount) external;
function pauseOffering(uint256 poolId) external;
function settle(uint256 poolId) external;
```

### 3.4 RiskPricingOracle

目的：让 AI 的 `PricingQuote`（及 Harness 现有 `RiskReport`）变成链上可审计事件。

最小函数：

```solidity
function updatePricing(
    uint256 poolId,
    uint256 issuePrice,
    uint8 riskLevel,
    uint8 action,
    bytes32 evidenceHash,
    bytes32 quoteHash
) external;
```

必须 emit：

```solidity
event PricingUpdated(
    uint256 indexed poolId,
    uint256 issuePrice,
    uint8 riskLevel,
    uint8 action,
    bytes32 evidenceHash,
    bytes32 quoteHash
);
```

### 3.5 Harness 动作映射

当前 Harness（`src/core/schema.js`）使用 `RiskReport.contract_action`；PRD v0.2 定价链路使用 `PricingQuote.pricing_action`。合约层用 `uint8 action`，JS 层维护映射表，不要两套枚举各写各的：

| Harness `contract_action` | PRD `pricing_action` | 链上语义 |
|---|---|---|
| `APPROVE_FINANCING` | `OPEN_OFFERING` | 开放认购 |
| `CONTINUE_WITH_WARNING` | `OPEN_WITH_WARNING` | 带警告继续 |
| `TRIGGER_MARGIN_CALL` | `REPRICE_DOWN` | 降价 / 追加保证金 |
| `FREEZE_POOL` | `PAUSE_OFFERING` / `FREEZE_POOL` | 暂停或冻结 |
| `TRIGGER_LIQUIDATION` | `TRIGGER_LIQUIDATION` | 进入清算 |

## 4. 测试链部署建议

不要一开始追求复杂多链。优先：

1. 本地 Hardhat：保证合约测试稳定。
2. Sepolia 或 Base Sepolia：部署最小合约集（至少 `RWAOfferingPool` + `RiskPricingOracle`）。
3. 前端只需要展示合约地址、交易 hash、`PricingUpdated` event。

可以借鉴 `crowdfunding-dapp-main` 的结构：

```text
packages/hardhat/contracts
packages/hardhat/deploy
packages/hardhat/test
packages/nextjs/contracts
```

但业务上不要照搬众筹逻辑。TradeShield 的核心不是捐赠/众筹，而是 **eBL 凭证 + permissioned RWA offering pool + AI pricing oracle**。

对应 `docs/tasks.md` 验证命令：

| 阶段 | 命令 |
|---|---|
| JS contract mock（WEB3-5） | `npm run test` |
| Hardhat 脚手架（WEB3-6） | `hardhat compile` |
| Solidity 最小实现（WEB3-7 ~ WEB3-9） | `hardhat test` |
| 测试网部署（WEB3-10） | 部署地址 + tx hash |
| 前端展示（WEB3-11） | `npm run dev` 手动演示 |

## 5. Harness 新规则

每个新增功能必须回答：

1. 它改变哪个 scenario？
2. 它输出哪个 schema（`RiskReport` 还是 `PricingQuote`）？
3. 它是否影响 `contract_action` / `pricing_action`？
4. 它是否需要写入 `RiskPricingOracle`？
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

主流程相关合约改动额外跑：

```bash
hardhat compile
hardhat test
```

## 6. 最终演示结构

3 分钟版本（AI 动态定价 RWA 主线）：

1. 30 秒：出口商拿到 eBL，选择 FAST / BALANCED / LOW_COST 到账速度。
2. 40 秒：AI 输出 `PricingQuote`（base price、urgency discount、risk discount、final issue price）。
3. 40 秒：`RiskPricingOracle` 接收 `evidence_hash` / `quote_hash`，emit `PricingUpdated`。
4. 40 秒：`RWAOfferingPool` 开放认购；风险升高时改价 / 暂停 / 冻结 / 清算。
5. 30 秒：投资者页面展示折价、目标兑付价、潜在收益与 **非保本** 提示。
6. 10 秒：收尾：TradeShield turns eBL-backed trade risk into dynamically priced, on-chain RWA offerings.

备选兜底：若网页或测试网不稳定，用 `npm run demo` + JS contract mock 完成同样叙事。

## 7. 最后的取舍

如果时间只够做三件事，优先顺序是：

1. `PricingQuote` schema + scenario harness 稳定。
2. `RiskPricingOracle` + `RWAOfferingPool` 最小合约能测能部署（或 JS mock 兜底）。
3. 前端展示 AI 定价如何触发链上状态变化。

MCP、Skill、RAG、测试网部署是加分项，但必须服务于这条主链路。不要让它们变成新的不稳定入口。
