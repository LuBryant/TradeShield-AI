<div align="center">

# 🛡️ TradeShield Agent

### AI 动态定价的 eBL-backed RWA 折价发行协议

**The AI prices the deal. The chain enforces it.**

出口商质押电子提单 → AI 读取货物 / 路线 / 单据 / 实时宏观风险 → 给出可解释、可审计的 RWA 发行价
→ *风险越高，价格越低，投资者潜在收益越高* → 决策上链锚定。

<sub>ETHBeijing 2026 · AI Agent × Blockchain · Trade-Finance Risk & Pricing</sub>

</div>

---

## ✨ 这是什么

国际贸易里，货已装船、钱还没回来。出口商想**提前、快速**拿到现金；投资者想要**有抵押、有收益**的短久期资产。TradeShield 把两端接起来：

1. 出口商把**电子提单（eBL）** 质押进智能合约，它代表在途货物的物权。
2. **AI Pricing & Risk Agent** 给这批货估值，再把「出口商想多快拿钱」和「这笔交易有多大风险」折算成一个 **RWA 发行折价**（例如 1 个 RWA 卖 $0.85，目标兑付 $1.00）。
3. 投资者按折价认购、出资；出口商拿到现金。
4. 运输途中风险升级时，AI 在链上**改价 / 暂停 / 清算**，并把每次决策连同证据哈希写进 `RiskPricingOracle`。

> 一句话 pitch：**AI dynamically prices eBL-backed RWA.**

### 🧠 创新点：把"折价"建立在可验证的贸易利润上

大多数 RWA 协议的定价是"拍脑袋的 LTV + 固定利率"。TradeShield 的定价**有经济学根基且可解释**：

```text
gross_profit  P = invoice_value − cost_of_goods          ← 出口商可验证的毛利
financing_cost  = share × P                              ← 投资者赚到的折价，就是出口商的融资成本
issue_price     = cash / (cash + share × P)              ← 发行价（对 $1.00 目标兑付的折价）
```

其中 `share`（让出多少比例的毛利）由两部分组成：

| 杠杆 | 作用 | 取值 |
|---|---|---|
| **到账速度** `payout_speed` | 越急 → 让出越多毛利 → 价越低 | FAST `0.50` · BALANCED `0.33` · LOW_COST `0.20` |
| **贸易风险** `risk` | 战争/天气/港口/保险/价格波动 → 加点 → 价更低 | 由 `scoreRisk` 打分（bps） |
| **质押覆盖** `collateral` | AI 验证的货值给价格设**地板**，兑付敞口不超过安全覆盖 | 价格只能被它**抬高** |

所以同一笔货：**要得越急、风险越大 → 发行价越低 → 投资者的 implied gross yield 越高**。这正是评委需要一眼看懂的东西。`$1.00` 是**目标兑付价（target redemption），不是保本承诺**。

---

## 🏗️ 系统架构

```text
            ┌─────────────────────────────────────────────────────────────┐
            │            前端 Dashboard  (public/ · 零依赖 SPA)             │
            │  场景选择 · 出口商报价 · AI 定价瀑布 · 投资者认购 · 合约时间线  │
            └───────────────▲───────────────────────────────▲─────────────┘
                            │ fetch (同一份 PricingQuote)     │
            ┌───────────────┴───────────────────────────────┴─────────────┐
            │                   API 服务  (src/app/server.js)               │
            │  /api/pricing/quote · /api/offering/simulate · /api/oracle/…  │
            └───────────────▲───────────────────────────────▲─────────────┘
                            │                                │
        ┌───────────────────┴────────┐          ┌────────────┴───────────────┐
        │   AI 定价引擎 (src/core)     │          │  MCP / RAG / Skill (src/…)  │
        │  pricingEngine · scoreRisk  │          │  5 个工具 · 风险情报检索     │
        │  offeringSimulator · oracle │          │  评委 Q&A 助手               │
        └───────────────────┬─────────┘          └─────────────────────────────┘
                            │ quote_hash / evidence_hash
            ┌───────────────┴───────────────────────────────────────────────┐
            │        Solidity 合约  (hardhat/)                                │
            │  RiskPricingOracle · RWAOfferingPool · EBLRegistry · RWAToken   │
            └───────────────────────────────────────────────────────────────┘
```

**关键设计**：AI 引擎、后端、前端、合约、MCP 工具**围绕同一份 `PricingQuote` 结构化输出**（`src/core/pricingSchema.js`），并由不变量校验（兑付敞口 ≤ 安全覆盖、`base − urgency − risk = indicative`、`final ≥ indicative`）保证可信。

---

## 🚀 快速开始

### 环境要求

- **Node.js ≥ 18.18.0**（`node -v` 检查）
- 一个现代浏览器（Chrome / Edge / Firefox）
- 无需任何外部依赖、无需 API Key —— 离线即可完整演示（内置确定性 fallback）

### 三步跑起来

```bash
# 1) 安装（本项目无外部依赖，这步只是统一启动习惯）
npm install

# 2) 启动 Web + API 服务
npm run dev

# 3) 打开浏览器
#    → http://localhost:3000
```

> Windows PowerShell 如果报 `npm.ps1 禁止运行`，把命令换成 `npm.cmd run dev` 即可。

看到下面这行就成功了：

```text
TradeShield Agent harness running at http://localhost:3000
```

---

## 🖥️ 前端演示导览（推荐的看法）

打开 `http://localhost:3000`，从上到下就是完整的"AI 给 RWA 定价"故事。顶部控制栏可随时切换**交易案例**和**到账速度**，下面所有数字会实时由定价引擎重算。

| # | 区块 | 你能看到什么 |
|---|---|---|
| 🎛 | **顶部场景选择器** | 4 个真实案例组成风险阶梯：clean copper（MEDIUM，正常开盘）→ 铜·汉堡（保险缺口 WARNING）→ 原油 → **霍尔木兹战争危机（CRITICAL，AI 暂停）** |
| 1 | **AI Pricing Console（瀑布图）** | `$1.00 目标 → base 锚点 → − 急用折价 → − 风险折价 → indicative → 抵押地板 → final` 的逐级分解 |
| 2 | **Exporter Financing Quote** | FAST / BALANCED / LOW_COST 三张卡并排：发行价、到账现金、融资成本、让出利润占比、留存净利、发行数量，AI 推荐速度打 ★ |
| 3 | **Investor RWA Offering** | 大号发行价 + `$1.00` 目标兑付 + implied gross yield；**认购框**（输入 USDC → 得到 RWA 数量/成本/目标收益）；**合规非保本提示** |
| 4 | **AI Risk Factors** | 战争 / 天气 / 港口 / 保险 / 价格波动 五维风险，按 bps 与严重度上色，并标注引用的 RAG 情报来源 |
| 5 | **Smart-Contract Lifecycle** | `Created→Priced→Open→Subscribed→Funded→InTransit→…→Redeemed` 时间线；点 **"Simulate in-transit risk"** 注入途中风险，看 AI **实时改价或暂停** |
| 6 | **On-chain Anchoring** | `quote_hash` / `evidence_hash` + `updatePricing(...)` 调用；点 **"Push to RiskPricingOracle"** 触发 `PricingUpdated` 事件回执 |

### 🎬 60 秒现场演示动线

```text
1. 选 "Clean copper"            → 看瀑布图：AI 如何从 $1.00 一步步折到发行价
2. 在顶部切 FAST / LOW_COST     → 价格随"急用程度"实时变化（FAST 更低、收益更高）
3. 看 Investor 区，输入认购金额   → 立刻显示能拿到多少 RWA、目标收益
4. 点 "Simulate in-transit risk" → AI 把价从 0.85 改到 ~0.78，时间线出现 Repriced
5. 切到 "Hormuz war crisis"      → 风险 CRITICAL，AI 直接 PAUSE，认购被禁用
6. 点 "Push to RiskPricingOracle" → 决策连同证据哈希上链（PricingUpdated 事件）
```

---

## ⌨️ 命令行工具

所有命令都**离线可跑**（没有 API Key 时走确定性 fallback）。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动 Web + API 服务（`http://localhost:3000`） |
| `npm run demo` | CLI 主流程演示：打印 RWA 发行价、investor yield、风险因子、链上哈希、AI 叙述（网页坏了的兜底方案） |
| `npm run price` | 对 demo case 直接打印一份 PricingQuote |
| `npm run scenarios` | 多场景回归：legacy RiskReport + AI 定价（fast / balanced / 途中改价 reprice / 高风险 pause） |
| `npm run qa` | 评委 Q&A 助手彩排（用真实定价数字 + RAG 引用作答；`-- "你的问题"` 问单题） |
| `npm run mcp` | 演示 MCP 工具链（get_trade_case → search → price → simulate → push oracle） |
| `npm run agent:value` | 跑 AI 货物估值工具（实时铜价 / 历史同类成交价 / 估值，离线有 fallback） |
| `npm run check` | 最低成本自检：文件、脚本、seed 数据、引擎是否完好 |
| `npm run test` | 跑全部单元 / 集成测试（`node --test`，当前 **148 passing**） |
| `npm run smoke` | 启动临时 server，冒烟测试关键 API |

> 演示前一键全验证：
> ```bash
> npm run check && npm run test && npm run smoke && npm run scenarios && npm run demo
> ```

---

## 🔌 API 参考

启动 `npm run dev` 后，所有端点都在 `http://localhost:3000`。POST 的 body 留空时默认使用 `data/demo-case.json`。

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/demo-data` | 返回 demo 案例 |
| GET | `/api/cases` | 结构化案例目录（前端场景选择器用） |
| POST | `/api/pricing/quote` | 生成 PricingQuote；`?compare=true` 返回三档速度 + 推荐 |
| POST | `/api/offering/simulate` | 模拟发行生命周期；`events` 可在途中升级风险 |
| POST | `/api/workflow/pricing-simulate` | 一次返回 PricingQuote + RiskReport + offering |
| POST | `/api/oracle/pricing-update` | 链上 oracle 更新载荷（含 `quote_hash` / `evidence_hash`） |
| POST | `/api/risk/analyze` · `/api/workflow/simulate` | legacy RiskReport / 状态机（保留） |
| GET | `/api/scenarios` · POST `/api/scenarios/run` | 场景回归 |
| GET | `/api/mcp/tools` · POST `/api/mcp/call` | MCP 工具清单 / 调用 |
| POST | `/api/rag/search` · GET `/api/rag/judge-qa` | RAG 检索 / 评委问答 |

**示例：对比三档到账速度**

```bash
curl -s -X POST "http://localhost:3000/api/pricing/quote?compare=true" | less
# → quotes[FAST|BALANCED|LOW_COST] + recommended_payout_speed
```

**示例：在途注入战争风险，看 AI 暂停**

```bash
curl -s -X POST http://localhost:3000/api/offering/simulate \
  -H "Content-Type: application/json" \
  -d '{"payout_speed":"BALANCED","events":[{"category":"macro","type":"war_risk","severity":"critical","region":"Strait of Hormuz"}]}'
# → final_state: "Paused"
```

**换一个案例来定价**：把 `/api/cases` 里的某个 `case` 对象放进 wrapper body 即可 —— 前端正是这样驱动场景选择器的：

```jsonc
// POST /api/pricing/quote
{ "case": { /* /api/cases 里的某个 case 对象 */ }, "compare": true }

// POST /api/offering/simulate —— 还能带 payout_speed / subscription_usd / events
{ "case": { /* … */ }, "payout_speed": "FAST", "events": [ /* 途中风险事件 */ ] }
```

---

## 🤖 接入真实 LLM / 实时数据（可选）

**默认全离线**：没有任何 Key 时，AI 估值与叙述走确定性 fallback（按 2026 年 6 月校准的 mock 数据），演示永远能跑。想用真实 LLM / 实时行情，复制 `.env.example` 为 `.env` 并填入：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek（`deepseek-chat`），OpenAI 兼容 |
| `DASHSCOPE_API_KEY` | 通义千问 Qwen（DashScope 兼容模式） |
| `Tencent_API_KEY` | 腾讯云 Hunyuan（锁定 `hy3-preview`，配置后默认优先并自动兜底） |
| `LLM_BASE_URL` / `LLM_API_KEY` | 任意 OpenAI 兼容端点 |
| `ALPHAVANTAGE_API_KEY` / `METALPRICE_API_KEY` | 实时铜价（USD/MT） |
| `COMTRADE_PRIMARY_KEY` | UN Comtrade 历史同类成交价（按 HS code，免费） |

> ⚠️ `.env` 已被 gitignore；任何 `*_API_KEY` 都不要提交到仓库。

---

## ⛓️ 智能合约（Hardhat）

`hardhat/` 下是最小可用的 Solidity 实现，事件已对齐 `docs/contracts.md`。

```bash
cd hardhat
npm install
npx hardhat compile
npx hardhat test          # 6 passing
```

| 合约 | 职责 |
|---|---|
| `RiskPricingOracle.sol` | `updatePricing(poolId, issuePrice, riskLevel, action, evidenceHash)` → emit `PricingUpdated`，持久化 `latestQuoteHash / latestEvidenceHash` |
| `RWAOfferingPool.sol` | `createOffering / subscribe / settle / pause` |
| `EBLRegistry.sol` | eBL `mint / pledge / release` |
| `RWAToken.sol` | 投资者 RWA 凭证 |

后端 `/api/oracle/pricing-update` 产出的载荷字段与 `RiskPricingOracle.updatePricing` 一一对应，前端 "Push to oracle" 即把这份载荷发给（mock）合约。

---

## 🧩 MCP / RAG / Skill（Agent 能力加分项）

- **MCP Server**（`src/mcp/`）：5 个工具 `get_trade_case` / `generate_pricing_quote` / `simulate_offering` / `push_pricing_to_oracle` / `search_knowledge_base`。`generate_pricing_quote` 直接复用 Bowen 的 `quoteFromCase`，与后端 / 前端**输出完全一致的 PricingQuote**。
- **RAG**（`src/rag/` + `data/risk-intel/`）：宏观风险情报知识库（战争 / 制裁 / 港口 / 天气 / 商品波动 / FX），AI 加风险折价时引用其中的条目。
- **Skill**（`src/skill/`）：`pricingAnalyst`（定价分析）与 `demoOperator`（一键演示编排）。
- **Judge Q&A 助手**（`src/agent/judgeAssistant.js`）：`npm run qa`，用真实定价数字 + 情报引用作答，永不与引擎自相矛盾，始终保留"非保本"口径。

---

## 📁 项目结构

```text
TradeShield-AI/
├── README.md              # 本文件：项目介绍 + 使用指南
├── 基础说明.md            # 团队协作 / 新手上手 / Harness 背景（原 README）
├── package.json           # npm scripts
├── .env.example           # 可选的 LLM / 行情 Key
├── data/
│   ├── demo-case.json         # 主 demo 案例（铜·新加坡→汉堡）
│   ├── cases/                 # 结构化案例（clean / war-crisis / 原油）
│   ├── pricing-scenarios/     # AI 定价场景回归
│   ├── scenarios/             # legacy 风险场景回归
│   ├── uploads/               # 拟真 eBL + 商业发票
│   └── risk-intel/feed.json   # RAG 风险情报
├── public/                # 前端（零依赖 ES module SPA）
│   ├── index.html · styles.css
│   ├── app.js                 # 编排 + 渲染
│   ├── api.js                 # 调后端
│   └── format.js              # 纯格式化 / 风险维度归并
├── src/
│   ├── app/server.js          # HTTP + API
│   ├── core/                  # pricingEngine · pricingSchema · offeringSimulator · oracle · pricingWorkflow
│   ├── agent/                 # 估值 tool calling · LLM client · 文档一致性 · 风险情报 · 叙述
│   ├── mcp/  ·  rag/  ·  skill/
│   └── ...
├── hardhat/               # Solidity 合约 + 测试
├── scripts/               # check / demo / smoke / scenarios / price / qa / mcp / agent-valuation
├── tests/                 # node --test（148 passing）
└── docs/                  # PRD · background · contracts · tasks · acceptance · award-roadmap
```

---

## 🎬 3 分钟 Demo 脚本

```text
[0:00] 痛点
   "货已装船、钱要 45 天后才到。出口商要现金，投资者要有抵押的短期收益资产。"

[0:30] 出口商侧（顶部选 Clean copper，看 Exporter + 瀑布）
   "出口商质押电子提单。AI 读了货值、单据、宏观风险，按他想要的到账速度，
    从 $1.00 目标兑付价一步步折出发行价 —— 这折价就是他的融资成本，
    而且只让出他可验证毛利的一部分。"

[1:15] 投资者侧（看 Investor + Risk Factors + 认购）
   "投资者花 $0.85 买入、目标 $1.00 赎回，潜在收益一目了然。
    旁边五维风险（战争/天气/港口/保险/价格）解释了为什么是这个价，
    每条都挂着 RAG 情报来源。这是 target，不是保本。"

[2:00] AI 实时风控（点 Simulate in-transit risk / 切 Hormuz war crisis）
   "运输途中霍尔木兹局势升级、铜价剧烈波动 —— AI 立刻改价、甚至暂停发行，
    保护投资者。"

[2:30] 上链（点 Push to RiskPricingOracle）
   "每一次定价决策连同证据哈希写进 RiskPricingOracle，
    可审计、防篡改。AI 定价，链上执行。"
```

---

## ✅ 验证矩阵

| 命令 | 验证什么 | 现状 |
|---|---|---|
| `npm run check` | 文件 / 脚本 / seed / 引擎完好 | ✅ |
| `npm run test` | 单元 + 集成（定价不变量、schema、MCP、合约 mock…） | ✅ 148 passing |
| `npm run smoke` | 关键 API 端到端 | ✅ |
| `npm run scenarios` | fast / balanced / reprice / pause 场景回归 | ✅ |
| `npm run demo` | CLI 主流程兜底演示 | ✅ |

---

## 🔒 合规边界

本项目是黑客松原型，**刻意不做**：真实 KYC、真实跨境支付、真实主网部署、面向公众募资、保本保收益承诺、开放二级市场。`$1.00` 始终是**目标兑付价**，取决于进口商付款、货物结算与保险覆盖。

---

## 📚 更多文档

- [`基础说明.md`](./基础说明.md) — 团队协作规范、新手上手、Harness 背景、领任务 / 开分支 / 提 PR 全流程
- [`docs/PRD.md`](./docs/PRD.md) — 产品需求与定价模型 v0.2
- [`docs/background.md`](./docs/background.md) — eBL / RWA / 贸易融资领域背景
- [`docs/contracts.md`](./docs/contracts.md) — 合约接口冻结设计
- [`docs/tasks.md`](./docs/tasks.md) — 任务拆分与状态
- [`docs/ai-valuation-tooling.md`](./docs/ai-valuation-tooling.md) — AI 估值 tool calling 与所需 API

---

<div align="center"><sub>Built for ETHBeijing 2026 · AI prices the deal, the chain enforces it.</sub></div>
