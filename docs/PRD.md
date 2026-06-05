# TradeShield Agent PRD

版本：v0.2 AI Dynamic Pricing RWA  
状态：准备阶段 / Mock Harness / 待接入测试链合约  
目标：48 小时内交付一个稳定、可解释、可演示的 **AI 定价的 eBL-backed RWA 贸易融资协议**。

## 1. 项目一句话描述

**TradeShield Agent 是一个基于电子提单的 AI 动态定价 RWA 贸易融资协议：出口商将代表货权的电子提单质押到合约，系统发行以该批货物价值为支撑的 RWA 凭证；AI Pricing & Risk Agent 根据出口商贷款到账速度、货物估值、运输风险、天气、战争、港口、保险、国际形势和市场价格，动态给出 RWA 折价发行价格、风险提示和链上风控动作。**

更短的 pitch：

> TradeShield turns an electronic bill of lading into a dynamically priced RWA financing pool, where AI prices trade risk before investors buy it.

## 2. 核心商业模型

### 2.1 基本场景

```text
货物真实可验证价值：1,000,000 USD
出口商希望提前拿到现金：约 720,000 - 900,000 USD
质押物：电子提单 eBL
RWA 目标到期兑付价：1 RWA = 1 USD target redemption value
投资者认购价格：由 AI 根据风险和到账速度动态定价，例如 0.80 - 0.95 USD
```

注意：PRD 中的 `1 RWA = 1 USD` 是 **目标到期兑付价 / target redemption value**，不是无条件保本承诺。真实兑付取决于进口商付款、货物处置、保险覆盖和合约清算结果。Demo 不做真实募资，不面向公众投资者。

### 2.2 为什么折价发行

出口商想越快拿钱，就必须给投资者更高折扣：

| 出口商诉求 | 示例发行价 | 投资者潜在收益 | 解释 |
|---|---:|---:|---|
| 很快到账 | 0.80 USD / RWA | 最高 25% gross upside to 1 USD target | 出口商牺牲更多折扣换速度 |
| 正常到账 | 0.90 USD / RWA | 最高 11.1% gross upside to 1 USD target | 折扣较低，融资成本较低 |
| 风险升高 | AI 进一步压低价格或暂停发行 | 收益看似更高，但风险也更高 | 风险折扣由 AI 解释 |

### 2.3 重要定价规则

不能简单写成“货物 100 万、融资 90 万、发行 90 万枚、每枚卖 0.8”。因为：

```text
900,000 RWA * 0.80 = 720,000 USD
```

这意味着出口商实际拿到 72 万，而不是 90 万。

因此协议必须同时计算：

```text
token_supply = target_cash_to_exporter / issue_price
target_redemption_exposure = token_supply * 1 USD
target_redemption_exposure <= AI_verified_collateral_value * redemption_coverage_limit
```

示例：

| 方案 | 发行数量 | 发行价 | 出口商到账 | 目标到期兑付总额 | 是否合理 |
|---|---:|---:|---:|---:|---|
| 快速到账折价 | 900,000 RWA | 0.80 | 720,000 USD | 900,000 USD | 合理，折扣换速度 |
| 慢速到账折价 | 900,000 RWA | 0.90 | 810,000 USD | 900,000 USD | 合理，融资成本低一些 |
| 真正到账 900,000 | 1,000,000 RWA | 0.90 | 900,000 USD | 1,000,000 USD | 需要 AI 确认质押覆盖足够 |
| 真正到账 900,000 | 1,125,000 RWA | 0.80 | 900,000 USD | 1,125,000 USD | 对 100 万货值通常过高，应拒绝或降额 |

这就是 AI 定价真正有价值的地方：它不是只算风险分，而是决定 **当前风险下，出口商最多能融多少钱、投资者应以什么折扣买、合约是否应该暂停发行**。

## 3. 目标用户

| 用户 | 需求 |
|---|---|
| 中小出口商 | 用电子提单质押，选择“更快到账 / 更低融资成本”的融资方案 |
| 合格投资者 / 机构资金方 | 以折价购买 eBL-backed RWA，看到 AI 风险定价、风险来源和目标回款路径 |
| 贸易融资平台 | 用 AI pricing oracle 将链下贸易风险转成可执行的 RWA 定价和风控信号 |
| 黑客松评委 | 看到 AI 真正决定 RWA 价格，而不是只做聊天解释 |

## 4. 用户痛点

### 痛点 1：出口商需要现金流速度，但传统融资定价慢

出口商有真实货物和提单，但银行审批慢。不同出口商对到账速度的偏好不同：有的人愿意折价更高换速度，有的人愿意等久一点降低融资成本。

### 痛点 2：投资者不知道折价是否合理

RWA 卖 0.80 看起来收益更高，但它可能意味着战争、天气、保险、价格、航线或单据风险很高。投资者需要知道折扣来自哪里。

### 痛点 3：传统 DeFi 价格模型看不到真实贸易风险

普通 DeFi 只会看 token price，无法分析：

- eBL 和货物是否一致；
- 货值是否虚高；
- 保险是否覆盖运输周期；
- 天气、战争、港口拥堵是否影响交付；
- 国际形势是否影响货物处置；
- 折价是否足以补偿风险。

### 痛点 4：AI 如果只做解释，不足以成为核心创新

本项目的 AI 必须承担核心金融功能：**动态定价、风险折扣解释、发行额度约束、链上风险动作建议**。

## 5. Demo 场景

### 5.1 基础融资场景

```text
出口商：Shanghai Metals Export Co.
进口商：Hamburg Industrial GmbH
货物：Copper Cathodes 铜阴极板
货物可验证价值：1,000,000 USD demo case
电子提单：EBL-2026-0001
融资需求：希望尽快获得 720,000 - 900,000 USD
RWA 目标到期兑付价：1 USD / RWA
投资者：permissioned investors
```

### 5.2 出口商选择到账速度

出口商在页面选择：

```text
Fast payout：AI 建议发行价 0.80，融资成本更高，到账更快
Balanced payout：AI 建议发行价 0.86，速度和融资成本折中
Low-cost payout：AI 建议发行价 0.90，融资成本更低，但可能认购更慢
```

### 5.3 AI 实时风险因素

AI Pricing & Risk Agent 持续分析：

```text
1. 货物市场价格变化
2. 天气和自然灾害
3. 战争 / 制裁 / 地缘政治风险
4. 港口拥堵 / 罢工 / 航线偏离
5. 保险到期和保险覆盖缺口
6. eBL / invoice / insurance 单据一致性
7. 进口商信用和付款风险 mock
8. 历史相似贸易案例 mock
```

### 5.4 AI 输出

AI 输出不只是自然语言，而是结构化定价：

```text
AI Verified Collateral Value
Max Safe Redemption Exposure
Recommended Token Supply
Base Issue Price
Urgency Discount
Risk Discount
Final Issue Price
Implied Gross Yield
Risk Level
Contract Action
Evidence Hash
Investor-facing Explanation
```

### 5.5 链上动作

```text
Exporter pledges eBL
→ AI generates pricing quote
→ RWA offering opens at AI issue price
→ Investors subscribe
→ AI monitors risk events
→ RiskPricingOracle updates price / risk action
→ Pool continues, pauses, reprices, freezes, or liquidates
```

## 6. MVP 功能列表

### 6.1 必做功能

| ID | 功能 | 验证方式 |
|---|---|---|
| M1 | Seed eBL-backed RWA financing case | `npm run check` |
| M2 | AI Pricing Quote schema | `npm run test` |
| M3 | 根据到账速度生成 base issue price | `npm run scenarios` |
| M4 | 根据货物、运输、战争、天气、保险风险生成 risk discount | `npm run scenarios` |
| M5 | Investor 页面展示 RWA 折价、目标兑付价、风险提示 | `npm run dev` 手动验证 |
| M6 | Exporter 页面展示不同到账速度下的融资金额 | `npm run dev` 手动验证 |
| M7 | Mock API：risk、pricing、workflow、scenario | `npm run smoke` |
| M8 | Evidence hash / pricing quote hash 可上链 | `npm run test` |

### 6.2 加分功能

| ID | 功能 | 说明 |
|---|---|
| O1 | LLM 生成投资者可读风险解释 | 结构化输出必须由 schema guardrail 校验 |
| O2 | AI Evidence Graph | 展示价格为什么从 0.90 被压到 0.80 |
| O3 | RAG 风险情报 | 从团队文档、政策、航运/地缘风险 mock 数据中检索证据 |
| O4 | RiskPricingOracle 合约 | 把 AI quote hash、价格和风险动作写入链上 |
| O5 | RWAOffering 合约 | 支持发行、认购、暂停、改价、结算 |
| O6 | AI Red Team scenario generator | 自动生成欺诈/极端风险场景测试定价 |

## 7. 明确不做什么

MVP 明确不做：

1. 真实公开募资；
2. 面向散户公开销售；
3. 开放二级市场；
4. AMM；
5. 无条件保本保收益承诺；
6. 真实 KYC / AML；
7. 真实跨境支付；
8. 真实战争、天气、AIS、港口 API 生产接入；
9. 真实 OCR 高精度审单；
10. 真实保险理赔；
11. 复杂法律仲裁；
12. 主网部署。

合规表达边界：

```text
1 RWA = 1 USD target redemption value，不是 guaranteed repayment。
投资者收益来自折价认购和贸易回款，不承诺无风险收益。
Demo 使用 permissioned mock investors，不进行真实募资。
```

## 8. 数据模型

### 8.1 TradeCase

```ts
type TradeCase = {
  case_id: string;
  bill_of_lading: BillOfLading;
  insurance: Insurance;
  financing: FinancingRequest;
  market: MarketFeed;
  shipment_events: ShipmentEvent[];
  macro_risk_events?: MacroRiskEvent[];
};
```

### 8.2 FinancingRequest

```ts
type FinancingRequest = {
  requested_cash_usd: number;
  payout_speed: 'FAST' | 'BALANCED' | 'LOW_COST';
  target_redemption_value_usd: 1;
  requested_token_supply?: number;
  max_ltv: number;
  currency: 'USDC' | 'USD';
};
```

### 8.3 MacroRiskEvent

```ts
type MacroRiskEvent = {
  date: string;
  type:
    | 'war_risk'
    | 'sanction_risk'
    | 'port_congestion'
    | 'severe_weather'
    | 'commodity_volatility'
    | 'fx_volatility'
    | 'buyer_country_risk';
  region: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
};
```

### 8.4 PricingQuote

```ts
type PricingQuote = {
  case_id: string;
  bl_id: string;
  target_redemption_value_usd: 1;
  ai_verified_collateral_value_usd: number;
  max_safe_redemption_exposure_usd: number;
  recommended_token_supply: number;
  requested_cash_usd: number;
  base_issue_price_usd: number;
  urgency_discount_bps: number;
  risk_discount_bps: number;
  final_issue_price_usd: number;
  expected_cash_to_exporter_usd: number;
  implied_gross_yield_bps: number;
  risk_level: 'LOW' | 'MEDIUM' | 'WARNING' | 'CRITICAL';
  pricing_action:
    | 'OPEN_OFFERING'
    | 'OPEN_WITH_WARNING'
    | 'REPRICE_DOWN'
    | 'PAUSE_OFFERING'
    | 'FREEZE_POOL'
    | 'TRIGGER_LIQUIDATION';
  risk_factors: string[];
  investor_explanation: string;
  evidence_hash: string;
};
```

### 8.5 RWAOfferingState

```ts
type RWAOfferingState =
  | 'Created'
  | 'Priced'
  | 'Open'
  | 'Subscribed'
  | 'Funded'
  | 'InTransit'
  | 'Repriced'
  | 'Paused'
  | 'Frozen'
  | 'Repaid'
  | 'Redeemed'
  | 'Liquidation'
  | 'Defaulted'
  | 'Cancelled';
```

## 9. API 列表

### 9.1 当前 / 近期 Mock API

| Method | Path | 用途 | 验证 |
|---|---|---|---|
| GET | `/api/health` | Harness 健康检查 | smoke |
| GET | `/api/demo-data` | 返回 seed case | smoke |
| POST | `/api/risk/analyze` | 生成 RiskReport | test / smoke |
| POST | `/api/pricing/quote` | 生成 AI PricingQuote | pricing test |
| POST | `/api/offering/simulate` | 模拟 RWA 发行、认购、改价、结算 | smoke |
| GET | `/api/scenarios` | 返回多场景回归摘要 | smoke |

### 9.2 Agent API

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/agent/extract-documents` | 抽取 eBL、invoice、insurance 字段 |
| POST | `/api/agent/verify-documents` | 单据一致性检查 |
| POST | `/api/agent/price-rwa` | 根据速度、货物、宏观风险给出 RWA 定价 |
| POST | `/api/agent/generate-investor-brief` | 生成投资者风险提示 |
| POST | `/api/agent/generate-evidence-graph` | 生成证据图和 hash |

### 9.3 合约接口

WEB3-1 到 WEB3-4 的冻结版接口、事件、权限和状态机定义见 `docs/contracts.md`。本节只保留主流程摘要，后续 JS contract mock 和 Solidity 实现必须以 `docs/contracts.md` 为准。

| Contract | Function | 用途 |
|---|---|---|
| EBLRegistry | `mintEBL(metadataHash, holder)` | 登记电子提单凭证 |
| EBLRegistry | `pledge(eblId, pool)` | 将 eBL 质押给融资池 |
| EBLRegistry | `releasePledge(eblId)` | 结算或取消后解除质押 |
| RWAToken | `mint(poolId, investor, amount)` | 给认购投资者铸造 RWA 凭证 |
| RWAOfferingPool | `createOffering(eblId, tokenSupply, issuePrice, targetRedemptionValue)` | 创建 RWA 发行池 |
| RWAOfferingPool | `subscribe(poolId, amount)` | 投资者认购 |
| RWAOfferingPool | `applyPricingAction(poolId, newIssuePrice, action, evidenceHash, quoteHash)` | 根据 AI 定价动作改价、暂停、冻结或清算 |
| RWAOfferingPool | `pauseOffering(poolId)` | 风险升高时暂停发行 |
| RWAOfferingPool | `settle(poolId)` | 进口商付款后结算 |
| RiskPricingOracle | `updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash, quoteHash)` | AI 定价和风险信号上链，并 emit `PricingUpdated` |

## 10. 页面列表

### 页面 1：Exporter Financing Quote

目的：出口商输入货物、eBL、期望到账速度，看到 AI 给出的融资方案。

字段：

- eBL ID；
- verified cargo value；
- requested cash；
- payout speed selector；
- recommended token supply；
- issue price；
- expected cash to exporter；
- financing cost；
- AI explanation；
- create offering button。

### 页面 2：Investor RWA Offering

目的：投资者看到每个 RWA 的发行价格、目标到期兑付价和 AI 风险分析。

字段：

- issue price；
- target redemption value；
- implied gross yield；
- risk level；
- token supply；
- subscribed amount；
- AI risk factors；
- weather / war / market / insurance alerts；
- evidence hash；
- subscribe button。

### 页面 3：AI Pricing & Risk Console

目的：展示 AI 如何把链下风险转成价格折扣。

字段：

- base issue price；
- urgency discount；
- risk discount；
- final issue price；
- collateral coverage；
- macro risk events；
- evidence graph；
- pricing action。

### 页面 4：Smart Contract Timeline

目的：展示 RWA 从发行、认购、风险改价到结算的链上状态。

状态：

- Created；
- Priced；
- Open；
- Subscribed；
- Funded；
- InTransit；
- Repriced；
- Paused；
- Frozen；
- Repaid；
- Redeemed；
- Liquidation。

## 11. 成功验收标准

### 11.1 技术验收

1. `npm run check` 成功；
2. `npm run test` 成功；
3. `npm run smoke` 成功；
4. `npm run scenarios` 覆盖 fast / balanced / high-risk repricing；
5. pricing quote schema 稳定；
6. 修改风险事件后，AI issue price 会变化；
7. 修改到账速度后，base issue price 会变化；
8. 风险升高时，offering 状态会进入 `Repriced` / `Paused` / `Frozen`；
9. 前端能展示投资者价格、收益、风险提示；
10. 合约 mock 或测试链合约能接收 pricing evidence hash。

### 11.2 产品验收

1. 评委能看懂为什么出口商愿意折价；
2. 评委能看懂为什么投资者愿意认购；
3. 评委能看懂 AI 如何决定 RWA 价格；
4. 投资者页面不只展示“高收益”，也展示风险来源；
5. 明确 `target redemption value` 不是保本承诺；
6. Demo 不依赖真实 API Key；
7. 所有新增功能必须能被 Harness 验证。

## 12. 48 小时开发计划

### 0-6 小时：重新锁定模型

| 时间 | 任务 | Owner |
|---|---|---|
| H0-H1 | 确认 RWA 折价发行模型和合规表达 | PM + Web3 |
| H1-H2 | 固定 PricingQuote schema | AI + Backend |
| H2-H4 | 增加 fast / balanced / high-risk pricing scenarios | QA + Backend |
| H4-H6 | 更新前端页面信息架构 | Frontend + PM |

### 6-18 小时：核心定价链路

| 时间 | 任务 | Owner |
|---|---|---|
| H6-H10 | 实现 AI pricing mock / deterministic fallback | AI |
| H6-H12 | 实现 `/api/pricing/quote` 和 `/api/offering/simulate` | Backend |
| H10-H14 | 实现 Investor RWA Offering 页面 | Frontend |
| H10-H16 | 设计 RWAOfferingPool / RiskPricingOracle 合约 | Web3 |
| H16-H18 | 打通 quote -> offering -> workflow | Integrator |

### 18-30 小时：可演示 MVP

| 时间 | 任务 | Owner |
|---|---|---|
| H18-H22 | 增加战争、天气、港口、保险 mock risk events | AI + Backend |
| H18-H24 | 完成 Exporter Quote 和 Investor Offering 页面 | Frontend |
| H22-H26 | 合约 mock 或最小 Solidity 测试 | Web3 |
| H26-H30 | Smoke / scenarios / demo script | QA + PM |

### 30-42 小时：打磨

| 时间 | 任务 | Owner |
|---|---|---|
| H30-H34 | AI pricing explanation 和 evidence graph 可视化 | AI + Frontend |
| H34-H38 | Pitch 和合规 Q&A | PM |
| H38-H42 | 完整彩排 3 轮 | All |

### 42-48 小时：冻结提交

| 时间 | 任务 | Owner |
|---|---|---|
| H42-H44 | 只修 demo bug | All |
| H44-H46 | 录制备份视频 | PM + Frontend |
| H46-H47 | 最终验证矩阵 | QA |
| H47-H48 | 提交仓库、演示链接、合约地址 | Lead |

## 13. 最大风险和备选方案

### 风险 1：被质疑为保本收益产品

备选方案：

- 所有文案使用 `target redemption value`；
- investor 页面展示 `not guaranteed`；
- 只做 permissioned mock investors；
- 不做真实募资；
- 不开放二级市场。

### 风险 2：AI 定价看起来像拍脑袋

备选方案：

- 定价拆成 base price、urgency discount、risk discount；
- 每个 discount 都要有 evidence；
- final price 由 deterministic policy 校验；
- LLM 只负责解释和风险摘要。

### 风险 3：合约来不及

备选方案：

- 先做 JS contract mock；
- 最小 Solidity 只做 `createOffering`、`subscribe`、`updatePricing`；
- 测试链部署作为加分项，不阻塞主 demo。

### 风险 4：真实战争/天气/港口数据接不进来

备选方案：

- 用 mock macro risk feed；
- PRD 明确未来可接 AIS、weather、news、port、sanction feed；
- Demo 强调 AI risk intelligence 的接口和结构。

### 风险 5：前端信息过载

备选方案：

- Exporter 页面只看到账速度和融资金额；
- Investor 页面只看价格、收益、风险；
- AI Console 页面才展示细节。
