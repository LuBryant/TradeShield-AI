# TradeShield Agent 背景入门手册

> 给非国际贸易、非供应链金融背景同学的黑客松补课材料。
> 目标是让团队在 30-60 分钟内理解：为什么电子提单可以成为 RWA 贸易融资的核心资产，为什么 AI Risk Agent 不是装饰，而是这个项目的风险基础设施。
> 更新时间：2026-06-04。本文用于项目设计和学习，不构成法律意见、投资建议、融资建议或合规意见。

---

## 目录

1. [项目一句话](#1-项目一句话)
2. [国际贸易为什么天然需要融资](#2-国际贸易为什么天然需要融资)
3. [中小出口商的真实痛点](#3-中小出口商的真实痛点)
4. [提单是什么，为什么它是本项目核心](#4-提单是什么为什么它是本项目核心)
5. [电子提单 eBL 不是 PDF，而是可控制、可转让的电子权利凭证](#5-电子提单-ebl-不是-pdf而是可控制可转让的电子权利凭证)
6. [传统贸易融资流程和它的问题](#6-传统贸易融资流程和它的问题)
7. [Web3 / RWA 视角下 TradeShield 在做什么](#7-web3--rwa-视角下-tradeshield-在做什么)
8. [Token 到底代表什么，收益从哪里来](#8-token-到底代表什么收益从哪里来)
9. [风险从哪里来：这不是普通 DeFi 抵押借贷](#9-风险从哪里来这不是普通-defi-抵押借贷)
10. [AI Risk Agent 应该做什么](#10-ai-risk-agent-应该做什么)
11. [智能合约状态机和链上动作](#11-智能合约状态机和链上动作)
12. [黑客松 Demo 怎么讲才有说服力](#12-黑客松-demo-怎么讲才有说服力)
13. [合规表达边界](#13-合规表达边界)
14. [产品落地的现实路径](#14-产品落地的现实路径)
15. [评委可能问的问题](#15-评委可能问的问题)
16. [术语表](#16-术语表)
17. [参考资料](#17-参考资料)

---

## 1. 项目一句话

**TradeShield Agent 是一个基于电子提单的 AI + RWA 贸易融资风控协议：出口商把电子提单质押进智能合约，合格投资者向许可型资金池提供流动性，AI Risk Agent 负责审单、估值、监控运输风险，并把风险结论转化为链上可执行动作。**

英文版：

> TradeShield Agent is an AI-powered risk infrastructure for eBL-backed trade finance.

更适合路演的版本：

> We turn electronic bills of lading into verifiable RWA collateral, and use AI agents to convert off-chain trade risks into on-chain risk actions.

一句话拆开看：

| 关键词 | 含义 |
|---|---|
| 电子提单 | 代表海运货物权利的电子贸易文件 |
| RWA | 将现实世界的资产或权利映射到链上 |
| 贸易融资 | 出口商用贸易单据或货物权利提前获得现金流 |
| AI Risk Agent | 把单据、货物、运输、市场、保险等链下信息转成结构化风险信号 |
| 智能合约 | 自动记录质押、融资、还款、预警、冻结、清算等状态 |

项目的本质不是“发一个提单币”，而是：

> **把真实贸易资产的风险变得可验证、可定价、可追踪、可执行。**

---

## 2. 国际贸易为什么天然需要融资

国际贸易和普通本地交易最大的区别是：

```text
货物、买方、卖方、资金、银行、承运人、保险公司，通常不在同一个地方，
也不在同一个时间点完成交割。
```

一个典型出口贸易场景：

1. 中国出口商接到欧洲进口商的订单。
2. 出口商先采购原料、组织生产、订舱、报关、装船。
3. 货物已经离港，但海上运输可能需要 20-45 天。
4. 出口商已经花了钱，却还没有收到进口商货款。
5. 进口商还没收到货，也不愿意提前付全款。
6. 银行、信用证、提单、保险、保理、押汇等机制被引入，用来解决信用和现金流错位。

所以贸易融资解决的不是“企业有没有利润”，而是：

> **利润在未来回款里，但生产、采购、物流和工资的钱今天就要付。**

亚洲开发银行 ADB 的 Global Trade Finance Gap Survey 显示，全球贸易融资缺口仍约为 2.5 万亿美元。这说明真实贸易里并不缺订单和货物，缺的是能被资金方快速理解和承接的风险基础设施。

### 2.1 一个直观时间线

```text
T0 接订单
  出口商要备货、生产、采购、订舱，现金开始流出

T1 装船并取得提单
  出口商已经履约了一大步，但钱还没有回来

T2 海上运输
  船舶延误、港口拥堵、货损、保险到期、商品价格波动都可能发生

T3 到港 / 赎单 / 提货
  进口商付款，提单权利转移，货物被提走

T4 出口商回款
  出口商才能真正补回现金流
```

TradeShield 要切入的是 T1 到 T4 之间的现金流缺口。

---

## 3. 中小出口商的真实痛点

中小出口商不是完全不能做生意，而是会被现金流和信用体系限制住。

| 痛点 | 通俗解释 | 对项目的启发 |
|---|---|---|
| 接不了大订单 | 买方愿意下 500 万美元订单，但出口商只能垫 100 万美元现金 | 真实订单不能自动变成融资能力 |
| 周转慢 | 钱要等进口商付款后才能回来，无法滚动接单 | 需要把“在途货物权利”提前变现 |
| 银行门槛高 | 银行看企业规模、流水、历史信用、抵押物 | 小企业即使贸易真实，也可能获批慢或被拒 |
| 融资成本高 | 银行不批时，只能找更贵的资金 | 透明风控可以降低资金方不确定性溢价 |
| 抗风险弱 | 延误、汇率、商品价格、保险、买方违约都会压垮现金流 | 风险需要动态监控，不是放款时看一次 |

不要把痛点讲成：

> 银行不给钱，所以中小出口商完全做不了生意。

更准确的讲法是：

> **中小出口商已经有真实贸易、真实货物和真实提单，但传统银行无法高效地把这些贸易凭证转化为可融资、可追踪、可处置的资产。**

TradeShield 的价值就在这里：

```text
真实贸易
→ 电子提单
→ 链上质押凭证
→ AI 风险评估
→ 许可型资金池融资
→ 动态风险动作
```

---

## 4. 提单是什么，为什么它是本项目核心

提单，英文 **Bill of Lading**，简称 **B/L**。

你可以把它理解为国际海运中的“超级凭证”。它通常同时承担三类功能：

| 功能 | 通俗解释 | 对 TradeShield 的意义 |
|---|---|---|
| 货物收据 | 承运人确认已经收到或装载这批货 | 证明货物真实存在并进入运输流程 |
| 运输合同证明 | 承运人与托运人之间存在运输安排 | 证明谁负责把货从哪里运到哪里 |
| 提货 / 物权凭证 | 谁控制可转让提单，谁通常可以主张提货权 | 可以被质押、转让、融资、处置 |

### 4.1 为什么不是“货物上链”

现实里的铜、咖啡豆、机械设备不可能真的进入区块链。

能上链的是：

> **代表这批货物相关权利的电子贸易文件。**

所以本项目更准确的说法不是：

```text
把货物上链
```

而是：

```text
把电子提单所代表的货物权利和融资权益映射到链上
```

### 4.2 提单也有边界

为了黑客松容易理解，我们常说“提单代表货物权利”。但真实业务里要注意：

- 不是所有运输单据都是可转让物权凭证；
- 海运提单、海运单、不可转让提单、记名提单在法律效果上可能不同；
- 不同司法辖区对提单“占有”“控制”“背书”“转让”的规则可能不同；
- 真实落地需要法律文件、质押协议、托管安排、承运人或 eBL 平台支持。

黑客松 MVP 可以简化，但路演时要体现你知道这个边界：

> **我们不是声称任何 PDF 都能变成抵押物，而是以符合法律和平台规则的电子提单作为可验证贸易权利凭证。**

---

## 5. 电子提单 eBL 不是 PDF，而是可控制、可转让的电子权利凭证

电子提单，英文 **Electronic Bill of Lading**，简称 **eBL**。

它的价值不是“把纸质提单扫描成 PDF”，而是让贸易文件具备这些能力：

- 唯一性：同一份电子提单不能被无限复制后重复质押；
- 控制权：系统能判断当前谁控制这份电子提单；
- 完整性：关键字段和签发记录不能被随意篡改；
- 可追溯：签发、转让、质押、解除质押都有记录；
- 可互操作：可以和数字身份、智能合约、风控 Agent、资金池结合；
- 可法律识别：在支持电子可转让记录的司法辖区中，电子记录可以承担纸质单据的功能。

### 5.1 eBL 背后的法律趋势

电子提单不是空想，而是国际贸易数字化的重要方向。

| 方向 | 背景 |
|---|---|
| DCSA | 推动成员承运人在 2030 年实现 100% eBL 使用目标 |
| UNCITRAL MLETR | 为电子可转让记录提供示范法框架，覆盖提单、汇票、本票、仓单等 |
| 新加坡 ETA | 2021 年修订 Electronic Transactions Act，采用 MLETR 思路 |
| 英国 ETDA 2023 | 让符合条件的电子贸易文件可以被占有、背书、转让 |
| TradeTrust 等基础设施 | 提供电子贸易文件验证、转让和跨系统互操作的技术实践 |

这给 TradeShield 的叙事提供了现实基础：

> **电子提单已经是数字贸易基础设施的一部分，我们进一步把它连接到 RWA 融资、AI 风控和链上执行。**

### 5.2 eBL 上链时真正要记录什么

链上不一定要保存完整商业文件。更合理的做法是保存：

| 链上字段 | 用途 |
|---|---|
| eBL ID | 标识融资对应哪份电子提单 |
| document hash | 证明文件版本没有被篡改 |
| issuer / carrier | 证明签发方 |
| owner / pledgee | 记录控制权或质押关系 |
| financing amount | 记录融资金额 |
| risk status | 记录 AI Agent 输出的风险状态 |
| evidence hash | 记录风险判断依据的哈希 |

完整文件、商业合同、保险单、承运人记录可以保存在链下或许可系统中，链上只记录可验证摘要和状态。

---

## 6. 传统贸易融资流程和它的问题

一个极简传统流程：

```text
出口商发货
→ 承运人签发提单
→ 出口商把提单、发票、合同、信用证等提交给银行
→ 银行审单并决定是否融资
→ 银行放款给出口商
→ 进口商付款赎单
→ 银行收回款项
→ 进口商提货
```

传统模式不是没有价值，而是对中小企业和新型资金方不够友好。

| 问题 | 解释 |
|---|---|
| 流程慢 | 单据跨境传递和人工审核耗时 |
| 门槛高 | 银行更偏好规模大、历史信用强、材料规范的客户 |
| 信息黑盒 | 资金方难以实时知道货物状态、价格变化、保险有效性 |
| 纸质风险 | 单据可能丢失、伪造、重复质押、难以验证 |
| 动态风控弱 | 放款后风险变化不能及时转成可执行动作 |

TradeShield 的替代思路：

```text
传统：银行人工审单 + 内部风控 + 中心化放款

TradeShield：
电子提单链上质押
+ AI Agent 结构化审单和动态监控
+ permissioned investor pool
+ 智能合约自动执行融资、预警、冻结、清算
```

---

## 7. Web3 / RWA 视角下 TradeShield 在做什么

RWA = **Real World Assets**，现实世界资产。

通俗理解：

> 把现实世界中的资产、现金流或权利，用链上 Token / 凭证 / 状态机表达出来。

常见 RWA 包括：

- 国债 Token；
- 房地产收益权 Token；
- 黄金或大宗商品凭证；
- 应收账款融资凭证；
- 仓单 Token；
- 碳信用；
- 本项目中的电子提单融资份额。

### 7.1 TradeShield 的核心机制

```text
出口商获得电子提单
→ 将电子提单质押进智能合约或登记到 eBL Registry
→ AI Risk Agent 审核单据、估值、运输与保险风险
→ 合约创建融资池
→ 合格投资者向 permissioned pool 提供流动性
→ 达到融资条件后，合约放款给出口商
→ 投资者获得融资份额凭证
→ 运输途中 Agent 持续更新风险
→ 出口商还款，投资者领取本金和收益
→ 若发生重大风险，合约进入预警 / 冻结 / 清算 / 追偿流程
```

### 7.2 和普通 DeFi 抵押借贷的区别

普通 DeFi 常见逻辑：

```text
ETH / BTC / stablecoin 抵押
→ 价格预言机更新
→ 抵押率不足时清算
```

TradeShield 的逻辑：

```text
现实贸易资产
→ 电子提单
→ 单据真实性、货物估值、运输事件、保险覆盖、买方付款风险
→ AI Agent 生成风险信号
→ 智能合约执行状态变化
```

核心差异：

| 普通 DeFi | TradeShield |
|---|---|
| 抵押物多为链上资产 | 抵押物来自真实贸易权利 |
| 价格预言机是关键 | 单据、运输、保险、市场、法律信息共同决定风险 |
| 清算主要看价格 | 风险动作可能来自延误、货损、保险失效、违约 |
| 资产容易自动处置 | 提单和货物处置需要法律、承运人、保险、追偿流程 |

这就是为什么本项目需要 AI Agent。

---

## 8. Token 到底代表什么，收益从哪里来

这是评委和投资人最容易追问的地方。

### 8.1 Token 不是“空气币”

在合规表述中，TradeShield 的 Token 不应该被描述成公开交易的投机币。

更稳妥的定位是：

> **电子提单融资份额凭证。**

它可能代表：

| 权利 | 含义 |
|---|---|
| 融资份额 | 投资者为某笔贸易融资出资的比例 |
| 收益分配权 | 出口商还款后，按比例领取本金和融资收益 |
| 质押物受偿权 | 出口商违约时，对提单或货物处置收益按比例受偿 |
| 链上记账凭证 | 记录谁投了多少钱、对应哪笔贸易、风险状态如何 |

### 8.2 收益从哪里来

收益不是“Token 自己涨出来的”，而是：

> **出口商为了提前获得现金流而支付的融资成本。**

例子：

```text
货物价值：1,000,000 USD
融资金额：700,000 USD
融资期限：45 天
到期还款：720,000 USD
融资成本：20,000 USD
```

对出口商：

```text
提前拿到 700,000 USD
可以采购下一批货、支付供应商、接新订单
20,000 USD 是融资成本
```

对投资者：

```text
提供 700,000 USD 流动性
承担贸易和违约风险
20,000 USD 是时间价值 + 风险补偿
```

### 8.3 为什么要设置 LTV

不能按 100% 货值放款。需要安全垫。

```text
LTV = 融资金额 / 经验证货物价值
```

保守估值公式：

```text
Verified Cargo Value = min(
  declared invoice value,
  quantity × market price,
  insured value
)
```

示例：

```text
发票申报价值：1,000,000 USD
市场价格估算：920,000 USD
保险覆盖金额：900,000 USD

Verified Cargo Value = 900,000 USD

若最大 LTV = 70%
最大融资金额 = 630,000 USD
```

这种设计能防止：

- 出口商虚高申报货值；
- 商品价格下跌后抵押不足；
- 保险覆盖低于货物申报价值；
- 货损或延误导致处置价值下降。

### 8.4 二级转让要谨慎表达

二级转让的合理含义：

> 合格投资者之间，在白名单地址内受限转让融资份额，用于提高流动性。

不应该说：

> 提单 Token 可以全球自由交易，人人可买，像 Meme Coin 一样炒。

更合适的表达：

```text
Token transfer is permissioned, whitelisted, and limited to eligible investors.
```

---

## 9. 风险从哪里来：这不是普通 DeFi 抵押借贷

电子提单 RWA 的核心风险在链下。

### 9.1 单据风险

| 风险 | 示例 |
|---|---|
| 提单伪造 | eBL ID 不存在，签发方不可信 |
| 字段不一致 | 发票数量、提单数量、保险数量不一致 |
| 重复质押 | 同一份 eBL 被拿去多处融资 |
| 权利不清 | 当前控制人不是出口商，或已被质押给其他资金方 |

### 9.2 货物和运输风险

| 风险 | 示例 |
|---|---|
| 延误 | ETA 延后 5 天，影响进口商付款和保险期限 |
| 偏航 | 船舶偏离正常路线 |
| 港口事件 | 罢工、拥堵、扣押、制裁风险 |
| 货损 | 恶劣天气、温控失败、集装箱破损 |
| 保险异常 | 保险金额不足、保险即将到期、风险不在承保范围内 |

### 9.3 市场风险

| 风险 | 示例 |
|---|---|
| 商品价格下跌 | 铜价下跌 12%，抵押物安全垫变薄 |
| 汇率波动 | 出口商成本和回款币种不一致 |
| 利率变化 | 投资者要求的风险补偿上升 |
| 流动性折价 | 出问题时提单或货物不容易快速处置 |

### 9.4 信用和法律风险

| 风险 | 示例 |
|---|---|
| 出口商违约 | 融资后不按约还款 |
| 进口商违约 | 拒收、拖延付款、破产 |
| 承运人纠纷 | 货物交付或提单转让出现争议 |
| 司法辖区不确定 | eBL、质押、Token 权益在当地法律下不确定 |
| 合规风险 | 面向公众募资、承诺收益、无牌销售证券型 Token |

所以，TradeShield 的风控不是“看一个价格”，而是：

```text
单据真实性
+ 货物估值
+ 运输状态
+ 保险覆盖
+ 市场价格
+ 交易对手信用
+ 法律和合规边界
```

---

## 10. AI Risk Agent 应该做什么

黑客松 MVP 不建议做很多 Agent。建议只做一个核心 Agent：

> **Trade Risk Agent：电子提单与货物风险分析 Agent。**

内部可以拆成四个能力模块。

### 10.1 Document Verification：审单

目标：判断贸易文件是否完整、一致、可信。

重点字段：

- Shipper / 出口商；
- Consignee / 进口商；
- Carrier / 承运人；
- Vessel / 船名；
- Port of Loading / 装货港；
- Port of Discharge / 卸货港；
- Cargo Description / 货物描述；
- Quantity / 数量；
- Issue Date / 签发日期；
- ETA / 预计到港；
- Insurance Coverage / 保险金额和期限；
- Document Hash / 文件哈希；
- eBL Registry Status / 电子提单登记状态。

输出示例：

```json
{
  "document_status": "CONSISTENT",
  "missing_fields": [],
  "mismatch_fields": [],
  "duplicate_pledge_risk": false
}
```

### 10.2 Valuation：估值与 LTV

目标：防止虚高估值和过度融资。

Agent 可以比较：

- 发票申报价值；
- 数量 × 市场价格；
- 保险金额；
- 历史交易价格；
- 大宗商品公开报价；
- 价格波动区间。

输出示例：

```json
{
  "declared_value_usd": 8500000,
  "market_value_usd": 7740000,
  "insured_value_usd": 8000000,
  "verified_cargo_value_usd": 7740000,
  "recommended_ltv": 0.68
}
```

### 10.3 Cargo Health：运输健康度

目标：把运输事件转成可理解的健康分数。

```text
Cargo Health Score = 100
- 运输事件扣分
- 延误扣分
- 保险异常扣分
- 市场价格波动扣分
- 重大合规或制裁事件扣分
```

示例规则：

| 事件 | 扣分 |
|---|---:|
| 正常航行 | 0 |
| 延误 3 天 | -5 |
| 恶劣天气 | -10 |
| 航线偏离 | -12 |
| 港口罢工 | -15 |
| 商品价格下跌超过 10% | -15 |
| 部分货损 | -30 |
| 保险失效 | -40 |

### 10.4 Risk Action：输出链上动作

Agent 不应该只生成自然语言报告。它必须输出结构化动作，让合约或 workflow 可以消费。

| Agent 输出 | 链上动作 |
|---|---|
| APPROVE_FINANCING | 允许开启融资池 |
| CONTINUE_WITH_WARNING | 保持运行，但提示风险 |
| TRIGGER_MARGIN_CALL | 要求补充保证金或提前部分还款 |
| FREEZE_POOL | 冻结放款、转让或赎回 |
| TRIGGER_LIQUIDATION | 进入清算 / 处置 / 追偿流程 |

最小结构化报告：

```ts
type RiskReport = {
  risk_level: 'LOW' | 'MEDIUM' | 'WARNING' | 'CRITICAL';
  cargo_health_score: number;
  verified_cargo_value_usd: number;
  adjusted_collateral_value_usd: number;
  health_factor: number;
  recommended_ltv: number;
  contract_action:
    | 'APPROVE_FINANCING'
    | 'CONTINUE_WITH_WARNING'
    | 'TRIGGER_MARGIN_CALL'
    | 'FREEZE_POOL'
    | 'TRIGGER_LIQUIDATION';
  detected_risks: string[];
  explanation: string;
  evidence_hash: string;
};
```

### 10.5 Agent 的关键定位

路演时不要把 Agent 说成：

> 它会聊天、会总结、会写报告。

要说成：

> **它把链下贸易风险转化为链上可执行的结构化风控信号。**

这才是 AI + Web3 的结合点。

---

## 11. 智能合约状态机和链上动作

TradeShield 的链上逻辑可以先用 JS mock，后续再替换成 Solidity 合约。

### 11.1 正常路径

```text
Created
→ Funding
→ Funded
→ InTransit
→ Repaid
→ Redeemed
```

含义：

| 状态 | 含义 |
|---|---|
| Created | 出口商提交 eBL 融资请求 |
| Funding | 资金池开放，合格投资者出资 |
| Funded | 融资目标达成 |
| InTransit | 货物运输中，Agent 持续监控 |
| Repaid | 出口商还款 |
| Redeemed | 投资者领取本金和收益 |

### 11.2 异常路径

```text
Funding → Cancelled → Refunded
InTransit → Warning → Frozen → Default → Liquidation → Compensated
```

含义：

| 状态 | 触发原因 |
|---|---|
| Warning | 延误、价格下跌、保险临近到期等中等风险 |
| Frozen | 风险升高，暂停转让或资金流出 |
| Default | 出口商未按约还款或重大违约 |
| Liquidation | 启动提单、货物、保险或追偿处置 |
| Compensated | 处置或赔付后分配给投资者 |

### 11.3 合约应该记录什么

MVP 中可以先记录：

- eBL metadata hash；
- financing amount；
- funded amount；
- investor shares；
- risk score；
- health factor；
- latest action；
- evidence hash；
- pool state。

真实合约不需要一开始就很复杂。黑客松最重要的是让评委看到：

```text
Agent 发现风险
→ 输出结构化 action
→ workflow / contract state 发生变化
→ 投资者能看到原因和证据哈希
```

---

## 12. 黑客松 Demo 怎么讲才有说服力

推荐 Demo 剧情：

```text
1. 出口商 Shanghai Metals Export Co. 上传电子提单融资请求
2. 货物是 Copper Cathodes，路线 Shanghai → Hamburg
3. AI Risk Agent 检查提单、发票、保险和估值
4. Agent 生成 LOW / MEDIUM 风险报告，合约开启融资池
5. 合格投资者向池子存入 USDC
6. 合约放款给出口商
7. 运输途中出现坏天气、ETA 延误、铜价下跌、保险接近到期
8. Agent 重新计算 Cargo Health、Verified Value、Health Factor
9. 合约状态从 InTransit 进入 Warning / Frozen / Liquidation
10. 投资者界面展示风险原因、扣分项、证据哈希和合约动作
```

评委应该看到四件事：

```text
AI 不是聊天机器人
AI 识别了真实贸易风险
AI 输出了结构化结果
区块链透明执行了风险处置
```

### 12.1 15 秒路演版本

> TradeShield Agent 是一个基于电子提单的 AI + RWA 贸易融资协议。出口商把电子提单质押进智能合约，合格投资者向许可型资金池提供流动性，AI Agent 负责审单、估值、运输健康度监控和风险动作触发。

### 12.2 30 秒路演版本

> 全球贸易融资缺口仍然巨大，中小出口商即使有真实订单和真实货物，也经常因为信用不足或单据审核成本高，无法及时获得融资。TradeShield 把电子提单作为 RWA 抵押物，通过智能合约完成融资和状态管理，通过 AI Agent 审核提单、评估货物价值、监控运输事件，并把链下风险转成链上可执行的预警、冻结或清算动作。我们不是开放众筹平台，而是面向合格投资者和受监管机构的 permissioned trade finance infrastructure。

### 12.3 最强收束句

> **普通 DeFi 清算的是 Token 价格；TradeShield Agent 清算的是现实世界贸易风险。**

---

## 13. 合规表达边界

这个项目最容易被误解成：

```text
面向公众卖一个有收益的提单 Token
```

这会引发证券、基金、放贷、支付、众筹、非法集资、虚拟资产交易等风险。

### 13.1 不建议说

- 全球开放众筹；
- 人人可投；
- 保本保收益；
- 固定年化；
- 低风险高收益；
- 提单 Token 可以自由炒；
- 无需 KYC；
- 面向大陆公众募资；
- 用智能合约绕过监管；
- 真实资金马上可以进来投。

### 13.2 推荐说

- 技术 Demo，不进行真实募资；
- 面向合格投资者；
- permissioned pool；
- 许可型资金池；
- Token 是融资份额凭证；
- 白名单地址之间受限转让；
- KYC / AML / sanctions screening 是真实落地前提；
- 与持牌机构、电子提单平台、贸易金融机构合作；
- 风险定价，不承诺收益；
- 合规司法辖区下的机构级 RWA 贸易融资基础设施。

### 13.3 为什么智能合约不能消除监管风险

法律看的是经济实质，不是技术形式。

```text
纸质合同承诺还本付息
≈ 可能构成融资或投资产品

智能合约承诺还本付息
≈ 仍然可能构成融资或投资产品
```

如果未经许可，向不特定公众募集资金，并通过 Token 承诺投资回报，就可能落入非法集资、证券发行、基金份额销售或虚拟资产监管范围。

安全叙事不是“去监管”，而是：

> **把真实贸易融资资产做成可审计、可解释、可合规接入的技术基础设施。**

---

## 14. 产品落地的现实路径

黑客松阶段不用真的落地金融业务，但要讲清楚现实路径。

### 14.1 推荐阶段

```text
Phase 0：Hackathon
Mock eBL + mock risk data + JS workflow + clear compliance boundary

Phase 1：Pilot
与电子提单平台、贸易金融机构、持牌合作方、合格投资者做小规模试点

Phase 2：Permissioned Protocol
接入真实 eBL registry、KYC、AML、风险预言机、托管和法律文件

Phase 3：Network
连接更多承运人、港口、保险公司、贸易商、资金方和跨境司法辖区
```

### 14.2 哪些地方相对适合叙事

从材料和公开资料看，更稳妥的叙事顺序是：

| 地区 | 适合点 | 风险 |
|---|---|---|
| 新加坡 | eBL 法律基础、贸易金融、资产 Tokenization 生态较强 | 仍需持牌合作、KYC/AML、合格投资者限制 |
| 香港 | 连接中国出口商和国际资本方便，Tokenised securities 监管框架明确 | 电子贸易文件法律改革仍需关注进展 |
| ADGM / 阿布扎比 | Web3、数字资产和电子可转让记录框架友好 | 与东亚出口商场景连接需要设计 |
| 英国 | Electronic Trade Documents Act 2023 提供强法律基础 | 金融产品落地监管成本不低 |
| 韩国 | 有 STO / security token 路径 | 大概率需走证券型监管，早期较重 |

黑客松建议定位：

> **新加坡 / 香港 / ADGM 风格的 permissioned eBL-backed trade finance infrastructure，而不是无牌公开发行的收益型 Token。**

---

## 15. 评委可能问的问题

### Q1：为什么投资者相信这个 Token 有价值？

因为它不是空气币，而是某笔电子提单融资的份额凭证。底层有真实贸易、电子提单、货物、保险和还款安排。AI Agent 会审查单据真实性、估值合理性、运输状态和风险事件。

### Q2：如果出口商不还钱怎么办？

进入 Default / Liquidation 流程。真实落地时可能通过转让或处置提单权利、保险理赔、货物处置、法律追偿来回收资金。Demo 中展示的是状态机和风险触发，不声称已经解决所有真实司法执行问题。

### Q3：数据从哪里来？

Demo 阶段使用 mock 数据。真实落地可接入电子提单平台、承运人、港口、保险公司、AIS 船舶数据、IoT 设备、商品价格源、KYC/AML 服务和 TradeTrust 类基础设施。

### Q4：为什么不用普通 DeFi 预言机？

普通价格预言机只能告诉你 Token 或商品价格，不能判断提单是否真实、保险是否覆盖、船是否延误、货是否损坏、进口商是否可能拒付。电子提单 RWA 需要多源链下风险分析。

### Q5：这是不是非法集资？

我们的 MVP 是技术 Demo，不进行真实募资。产品设计上也不是开放众筹，而是面向合格投资者和受监管机构的许可型资金池，Token 仅作为白名单地址之间受限转让的融资份额凭证，不承诺保本保收益。

### Q6：为什么需要区块链？

区块链不是为了炫技，而是为了：

- 记录 eBL 质押和融资状态；
- 让投资者份额和资金流透明可审计；
- 让 Agent 风险结论变成可执行状态；
- 记录证据哈希，便于追溯；
- 支持白名单份额转让和自动分配。

### Q7：为什么需要 AI？

因为关键风险在链下。AI Agent 负责从单据、运输事件、保险、价格和贸易背景中提取结构化风险信号，并解释为什么合约应该预警、冻结或清算。

---

## 16. 术语表

### 16.1 国际贸易

| 词 | 中文 | 快速理解 |
|---|---|---|
| Exporter | 出口商 | 卖货并发货的人 |
| Importer | 进口商 | 买货并付款的人 |
| Carrier | 承运人 | 船公司或运输方 |
| Shipper | 托运人 | 委托运输的一方，通常是出口商或其代理 |
| Consignee | 收货人 | 目的港提货的人 |
| Bill of Lading / B/L | 提单 | 货物收据、运输合同证明、提货权凭证 |
| eBL | 电子提单 | 电子形式的提单 |
| Letter of Credit / L/C | 信用证 | 银行信用支持的付款工具 |
| Incoterms | 国际贸易术语 | 规定买卖双方费用、风险、保险责任的规则 |

### 16.2 贸易融资

| 词 | 中文 | 快速理解 |
|---|---|---|
| Trade Finance | 贸易融资 | 围绕进出口贸易的融资 |
| Supply Chain Finance | 供应链金融 | 围绕供应链上下游的融资 |
| Collateral | 抵押物 / 质押物 | 借钱时提供的保障 |
| Pledge | 质押 | 把权利凭证交给资金方作为担保 |
| LTV | 贷款价值比 | 融资金额 / 抵押物价值 |
| Default | 违约 | 借款人不还钱或违反关键义务 |
| Recovery | 追偿 | 出问题后追回损失 |
| Factoring | 保理 | 把应收账款转让给金融机构融资 |
| Documentary Collection | 跟单托收 | 银行根据单据协助收款 |

### 16.3 Web3 / RWA

| 词 | 中文 | 快速理解 |
|---|---|---|
| RWA | 现实世界资产上链 | 把现实资产或权益映射为链上凭证 |
| Tokenization | Token 化 | 把资产或权益拆成链上份额 |
| Smart Contract | 智能合约 | 自动执行规则的链上程序 |
| Oracle | 预言机 | 把链下数据传给链上 |
| DeFi | 去中心化金融 | 不依赖传统银行的链上金融系统 |
| Liquidity Pool | 流动性池 / 资金池 | 投资者共同出资的池子 |
| Permissioned Pool | 许可型资金池 | 只有白名单投资者能参与 |
| Whitelisted Transfer | 白名单转让 | Token 只能在合格地址之间流转 |
| Evidence Hash | 证据哈希 | 对链下证据做哈希后上链留痕 |
| Risk Oracle | 风险预言机 | 把 Agent 风险评分和动作推送给合约 |

---

## 17. 参考资料

### 17.1 项目内部材料

- `Materials/web3_trade_finance_consolidated/web3_trade_finance_consolidated.md`
- `Materials/20260602会议.md`
- `docs/PRD.md`
- `data/demo-case.json`

### 17.2 国际贸易与电子提单

- ADB, Global Trade Finance Gap Survey: <https://www.adb.org/publications/adb-global-trade-finance-gap-survey>
- DCSA, 100% eBL by 2030: <https://dcsa.org/100-percent-ebl>
- DCSA, Electronic Bill of Lading Standard: <https://dcsa.org/standards/bill-of-lading>
- UNCITRAL Model Law on Electronic Transferable Records: <https://uncitral.un.org/en/node/775>
- Singapore IMDA, Electronic Transactions Act: <https://www.imda.gov.sg/regulations-and-licensing-listing/electronic-transactions-act-and-regulations>
- Singapore Electronic Transactions (Amendment) Act 2021: <https://sso.agc.gov.sg/Acts-Supp/5-2021>
- UK Electronic Trade Documents Act 2023: <https://www.legislation.gov.uk/ukpga/2023/38/contents>

### 17.3 RWA、Tokenization 与合规边界

- MAS, Project Guardian: <https://www.mas.gov.sg/schemes-and-initiatives/project-guardian>
- MAS, Guide on Tokenisation of Capital Markets Products: <https://www.mas.gov.sg/regulation/guidelines/guide-on-tokenisation-of-cmps>
- Hong Kong SFC, Circular on intermediaries engaging in tokenised securities-related activities: <https://apps.sfc.hk/edistributionWeb/api/circular/list-content?refNo=23EC52&lang=EN>
- 中国政府网，《防范和处置非法集资条例》：<https://app.www.gov.cn/govdata/gov/202102/10/468255/article.html>

---

## 附录：本项目最小心智模型

```text
电子提单 = 代表货物权利的电子贸易文件

RWA = 把这类现实权利映射成链上可记录、可转让、可结算的凭证

贸易融资 = 出口商用未来回款和提单质押，提前获得现金流

AI Risk Agent = 把链下贸易风险转成结构化合约动作

智能合约 = 记录融资、份额、风险状态和处置流程
```

最终要让评委记住：

> **TradeShield Agent 不是把贸易文件变成炒作 Token，而是把电子提单背后的真实贸易风险变成透明、可解释、可执行的链上风控基础设施。**
