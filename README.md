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

## 🎯 核心逻辑链：为什么 RWA 定价非有 AI 不可

> 评委最该问、也最致命的一句话：**“折价发行、目标兑付 1 美元，那投资者不就稳赚？要 AI 干嘛？”** 这一节是对它的正面回答，也是整个项目的论证主线。

```text
① RWA 折价发行：投资者按 $0.80 买入，目标兑付 $1.00
② 陷阱：看起来买低卖高、稳赚 —— 那 AI 风控岂不是摆设？
③ 破解：$1.00 是“目标”不是“保本” —— 会违约，投资者会亏
④ 推论：那 $0.20 折价不是白送的利润，而是“违约风险的价格”
⑤ 谁定这个价：AI —— 在投资者认购【之前】把链下风险折算成发行价
⑥ 为何必须事前定准：钱在 Funded 一刻就打给出口商、货还在海上；
   事后改价保护不了已建仓的投资者 → 折价是唯一的、预付的补偿
⑦ AI 做三件事：保守估值(定额度) · 风险打分→折价(定价格) · 开/改价/暂停(定闸门)
⑧ 终极考验 = 战争：价格预言机见铜价↑以为更安全；AI 知道战争溢价是
   “相关性双刃”(违约↑ / 保险↓ / 回收↓)，于是反向 —— haircut + 暂停
⑨ 收束：普通 DeFi 让市场猜价；TradeShield 让 AI 在下单前把风险定成折价
```

**第 ③ 步的证据 —— `npm run demo:default`（同一笔铜，三种结算）：**

| 结算 | 发生了什么 | 投资者损益 |
|---|---|---|
| ✅ 还款 | 进口商付款，正常赎回 | 0.80 → **1.00**，**+25%** |
| ❌ 尾部违约 | 战争致铜价崩 + 进口商弃货 + 保险战争除外拒赔 | 0.80 → 只回收 **0.698**，**−12.8%（亏损）** |
| 🟡 轻度违约 | 进口商破产但货完好、近市价变现 | 0.80 → **1.00**，被超额抵押兜回 |

→ 投资者**并非稳赚**；那笔折价正是 AI 为“违约尾部”预先收取的保费。**违约 = 进口商不付钱 → 出口商扛不住也违约 → 池子凭质押 eBL 处置货物，按比例回收 < 票面。**

**第 ⑧ 步的证据 —— 战争前 vs 战争危机（定价引擎真实输出）：**

| | 战争前 (warning) | 战争危机 (critical) |
|---|---|---|
| 风险分 | 350bps · MEDIUM | **1410bps · CRITICAL** |
| AI 核验货值 | USD 6,531,250 | **USD 5,141,500（−21%）** |
| AI 动作 | OPEN @0.80 | **PAUSE（拒绝开盘）** |

> **一句话钉死：正因为钱打出去后无法再保护老钱，AI 在认购前那一刻的定价，就是这个项目的全部意义。** 完整的口播脚本见 [`docs/demo-script.md`](./docs/demo-script.md)。

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

## 🛠️ 完整操作手册（每一步详细步骤）

分两条路线：**A. 本地零配置演示**（推荐先跑通，走模拟上链，不需要钱包/密钥/网络）；**B. 部署到 Sepolia 真实上链**（评委现场看真实交易）。

### A. 本地零配置演示（5 步）

1. **装 Node** ≥ 18.18.0：`node -v` 确认。
2. **进入项目根目录**：`cd TradeShield-AI`。
3. **启动服务**：`npm run dev`（Windows 若报 `npm.ps1 禁止运行`，用 `npm.cmd run dev`）。
4. **打开浏览器**：访问 `http://localhost:3000`。
5. **照「界面操作步骤」往下玩**（见下一节）。此时顶栏会显示 `○ 合约未部署 · 当前为模拟上链`，铸造按钮产生**高保真模拟交易**——演示完整、不依赖网络。

### B. 部署到 Sepolia，开启真实上链（8 步）

> 目标：跑完后顶栏变 `● 合约已部署`，界面①点「铸造」会弹 MetaMask 签名、产生**真实 Sepolia 交易**。

**第 1 步 · 安装 MetaMask 并开启测试网**
浏览器装 [MetaMask](https://metamask.io) 扩展 → 新建/导入钱包 → 设置里打开「显示测试网络」→ 网络列表能看到 **Sepolia**。

**第 2 步 · 新建一个「只放测试币」的钱包做部署账户**
⚠️ 不要用有真实资产的钱包。MetaMask 里新建一个账户专门用于本 demo。

**第 3 步 · 领 Sepolia 测试币（约 0.05 ETH 足够）**
用第 2 步的地址去水龙头领取，例如：[Google Cloud Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)、[sepoliafaucet.com](https://sepoliafaucet.com)、[Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)。在 MetaMask 看到余额到账即可。

**第 4 步 · 准备 RPC URL**
免费方案任选其一：
- 公共节点（最省事）：`https://ethereum-sepolia-rpc.publicnode.com`
- 或注册 [Alchemy](https://www.alchemy.com) / [Infura](https://infura.io)，新建 Sepolia App，复制 HTTPS endpoint。

**第 5 步 · 导出部署私钥**
MetaMask → 选中第 2 步那个测试账户 → 账户详情 → 导出私钥（形如 `0x` 开头的 64 位十六进制）。**仅用于这个测试钱包**。

**第 6 步 · 在项目根目录创建 `.env`**
新建 `TradeShield-AI/.env`，至少填这两行（其余 LLM key 可留空，定价引擎有确定性 fallback）：
```bash
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DEPLOYER_PRIVATE_KEY=0x你第5步导出的私钥
```
> `.env` 已被 `.gitignore` 忽略，不会被提交。可参考 `.env.example` 里的完整字段说明。

**第 7 步 · 安装合约依赖并部署**
```bash
cd hardhat
npm install                          # 首次需要，安装 hardhat + ethers（约 1 分钟）
npm run deploy:tradeshield:sepolia   # 部署 TradeShieldRWA 到 Sepolia
```
成功输出形如：
```text
TradeShieldRWA deployed at: 0xABC...123
Wrote frontend config -> ...\public\chain-config.json
✅ Done. ... Explorer: https://sepolia.etherscan.io/address/0xABC...123
```
脚本会**自动把合约地址 + ABI 写进 `public/chain-config.json`**，前端无需手改。

**第 8 步 · 连接钱包并铸造真实交易**
```bash
cd ..          # 回到项目根目录
npm run dev    # 启动前端
```
浏览器开 `http://localhost:3000` → 顶栏应显示 `● 合约已部署` → 进入**界面①** → 右上「🦊 连接钱包」（会提示切到 Sepolia，确认即可）→ 输入融资金额 → 点「⛓ 铸造 RWA 上链」→ **MetaMask 弹窗签名** → 交易上链后，结果卡显示 `tx_hash`（可点开 Etherscan）、`poolId`、链上读回的 RWA 余额。

### C. 两个界面的操作步骤

**界面①「提单上链 · 铸造 RWA」**
1. 顶栏选一个**交易案例**（建议从 `Clean copper` 开始）。
2. 看「AI 货值估算 & 航线风险」：AI 核验货值、五维风险分数、每项**数据来源**。
3. 看「AI 定价台」瀑布图：发行价如何从 $1.00 一步步折下来。
4. 在「融资 & 铸造」里选**到账速度**（FAST/BALANCED/LOW_COST），输入**融资金额**，下方实时显示可得 RWA 数量与发行价。
5. 点「⛓ 铸造 RWA 上链」→ 真实交易（已部署）或模拟交易（未部署）。

**界面②「航运追踪 · 实时定价」**
1. 顶栏导航点「② 航运追踪」。
2. 看中间的**船**沿航线移动；把鼠标移到船上，显示当前**虚拟时间 + 所在航段**；可用「⏸暂停 / 拖动条」控制。
3. 下方「实时 RWA 定价」显示当前价、收益率、风险、认购进度。
4. 点「突发事件」按钮（🌪台风 / ⚔霍尔木兹冲突升级 / 🧭改道 / 🛡保险拒赔）→ 观察 **RWA 价格当场下跌、风险飙红、AI 暂停**，时间线出现 Repriced/Paused。
5. 「↺ 重置航程」回到初始定价。

### D. 常见问题排查

| 现象 | 原因 / 解决 |
|---|---|
| 顶栏一直显示「○ 合约未部署」 | 还没跑 B 路线的部署，或 `public/chain-config.json` 里 `contracts.TradeShieldRWA` 为空。重跑第 7 步。 |
| 点连接钱包没反应 | 没装 MetaMask（会提示「铸造将走模拟交易」），装好后刷新页面。 |
| MetaMask 报「insufficient funds」 | 部署账户没有 Sepolia 测试币，回到第 3 步领取。 |
| `deploy` 报 `Missing SEPOLIA_RPC_URL` | `.env` 没建在**项目根目录**或字段名写错，检查第 6 步。 |
| 铸造交易很久不确认 | Sepolia 偶尔拥堵，等待或在 MetaMask 里加速；不影响后续。 |
| 想换合约地址 | 重跑第 7 步部署即可覆盖 `chain-config.json`。 |

---

## 🖥️ 前端演示导览（推荐的看法）

打开 `http://localhost:3000`。顶部**导航栏**在两个主界面间切换，下方共享一个**交易案例 / 电子提单**选择器（4 个真实案例组成风险阶梯：clean copper MEDIUM → 铜·汉堡保险缺口 WARNING → 原油 → **霍尔木兹战争危机 CRITICAL**），所有数字都由定价引擎实时重算。

### 界面 ①：提单上链 · 铸造 RWA

| # | 区块 | 你能看到什么 |
|---|---|---|
| 1 | **AI 货值估算 & 航线风险** | AI 核验的抵押货值 + 五维航线风险（战争/天气/港口/保险/价格波动），按 bps 与严重度上色，并列出每项的**数据来源**（RAG 情报、市场基准、估值方法、单据核验）与总风险分数 |
| 2 | **AI 定价台（瀑布图）** | `$1.00 目标 → base 锚点 → − 急用折价 → − 风险折价 → indicative → 抵押地板 → final` 的逐级分解 |
| 3 | **融资 & 铸造 RWA** | 选到账速度（FAST/BALANCED/LOW_COST 三卡对比）→ 输入**商家融资金额** → 实时算出可得 RWA 数量与发行价 → 点 **「⛓ 铸造 RWA 上链」**：连钱包且合约已部署时铸造**真实 Sepolia 交易**（返回 tx + Etherscan 链接 + 链上读回余额），否则走高保真模拟交易。下方锚定 `quote_hash` / `evidence_hash` |

### 界面 ②：航运追踪 · 实时定价

| # | 区块 | 你能看到什么 |
|---|---|---|
| 1 | **航运进度（虚拟时间）** | 一艘船沿航线移动的进度条，左=出发港/装船日，右=目的港/ETA；**鼠标悬停船**显示当前虚拟时间与所在航段；可播放/暂停、拖动 |
| 2 | **实时 RWA 定价 & 认购进度** | 大号实时发行价（变化时闪动）、隐含收益率、风险等级/分数、随航程增长的认购进度条 |
| 3 | **突发事件模拟（Demo）** | 🌪 台风 / ⚔ 霍尔木兹冲突升级 / 🧭 改道 / 🛡 保险拒赔 等按钮，点击后 AI **实时重定价或暂停**，价格可见变化；下方是合约生命周期时间线 |
| 4 | **AI 风险情报（含来源）& 评委问答** | AI 收集的宏观/地缘风险事件，每条标注信息来源；可搜索 RAG 知识库；右侧评委问答 |

### 🎬 60 秒现场演示动线

```text
界面①：选 "Clean copper" → 看货值/风险来源 → 看瀑布图 → 输入融资额、连钱包、铸造上链（真实 Sepolia tx）
界面②：切到航运追踪 → 船在动、悬停看虚拟时间 → 点「霍尔木兹冲突升级」→ RWA 价格当场下跌、风险飙红、AI 暂停
        → 切 "Hormuz war crisis" 案例对照：开盘即 CRITICAL / PAUSE
```

> 🦊 **真实上链**：在根目录 `.env` 填 `SEPOLIA_RPC_URL` 与 `DEPLOYER_PRIVATE_KEY` 后，`cd hardhat && npm run deploy:tradeshield:sepolia` 会部署 `TradeShieldRWA` 并把地址自动写入 `public/chain-config.json`；之后界面①连接 MetaMask（Sepolia）即可铸造真实交易。未部署时全程走模拟兜底，演示不依赖网络。

---

## ⌨️ 命令行工具

所有命令都**离线可跑**（没有 API Key 时走确定性 fallback）。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动 Web + API 服务（`http://localhost:3000`） |
| `npm run demo` | CLI 主流程演示：打印 RWA 发行价、investor yield、风险因子、链上哈希、AI 叙述（网页坏了的兜底方案） |
| `npm run demo:default` | **投资者会不会亏**演示：同一笔铜跑「还款 / 尾部违约 / 轻度违约」三种结算，逐条打印投资者损益（核心逻辑链第 ③ 步） |
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
- [`docs/demo-script.md`](./docs/demo-script.md) — 视频 Demo 讲稿（口播 + 画面脚本，约 3 分 30 秒）

---

<div align="center"><sub>Built for ETHBeijing 2026 · AI prices the deal, the chain enforces it.</sub></div>
