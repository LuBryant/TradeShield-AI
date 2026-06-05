# TradeShield Agent 验收标准

本文定义项目准备阶段和 MVP 开发阶段的验收标准。所有新增功能必须能被至少一个 harness 命令验证。

## 1. 准备阶段验收

| ID | 标准 | 验证命令 | 状态 |
|---|---|---|---|
| A1 | 仓库包含 README | `npm run check` | Required |
| A2 | 仓库包含快速入门背景文档 | `npm run check` | Required |
| A3 | 仓库包含 PRD | `npm run check` | Required |
| A4 | 仓库包含任务拆分 | `npm run check` | Required |
| A5 | 仓库包含 demo seed 数据 | `npm run check` | Required |
| A6 | 仓库包含最小测试框架 | `npm run test` | Required |
| A7 | 仓库包含 smoke test | `npm run smoke` | Required |
| A8 | 空壳应用可以启动 | `npm run dev` | Required |
| A9 | 仓库包含多场景 scenario harness | `npm run scenarios` | Required |

## 2. 主流程验收

| ID | 标准 | 验证命令 | 状态 |
|---|---|---|---|
| F1 | 可以读取电子提单 demo 数据 | `npm run smoke` | Required |
| F2 | 可以生成结构化 RiskReport | `npm run test` | Required |
| F3 | RiskReport 包含 evidence_hash | `npm run test` | Required |
| F4 | RiskReport 包含 contract_action | `npm run smoke` | Required |
| F5 | Workflow final_state 会根据 contract_action 变化 | `npm run test` / `npm run smoke` | Required |
| F6 | CLI demo 可以展示完整状态机 | `npm run demo` | Required |
| F7 | Web 页面可以展示 seed case 和 risk report | 手动访问 `npm run dev` | Required |
| F8 | 低风险、预警、清算三个核心场景都可回归 | `npm run scenarios` | Required |
| F9 | API 可以返回 scenario harness 摘要 | `npm run smoke` | Required |

## 3. 文档验收

| ID | 标准 | 文件 |
|---|---|---|
| D1 | 非国际贸易专业成员能理解提单、贸易融资、eBL、RWA | `docs/background.md` |
| D2 | PRD 包含 12 个指定章节 | `docs/PRD.md` |
| D3 | 明确写出不做什么 | `docs/PRD.md` |
| D4 | 明确写出 48 小时开发计划 | `docs/PRD.md` |
| D5 | 明确写出技术风险和备选方案 | `docs/PRD.md` |
| D6 | README 包含团队协作方式 | `README.md` |
| D7 | 文档包含拿奖路线、AI/MCP/RAG/合约任务规划 | `docs/award-roadmap.md` |

## 4. 黑客松演示验收

演示时必须让评委在 3 分钟内看懂：

1. 用户是谁；
2. 痛点是什么；
3. 电子提单为什么能作为融资抵押物；
4. AI Agent 做了什么；
5. AI 的输出如何改变链上状态；
6. 为什么这是 Security / Risk Agent；
7. 为什么它也有 Public Good 价值。

## 5. 功能冻结标准

进入最后 6 小时时：

- 不再新增功能；
- 只修复会影响演示的 bug；
- `npm run check`、`npm run test`、`npm run smoke` 必须全部通过；
- `npm run scenarios` 必须通过，并覆盖 approve / margin call / liquidation；
- 保留 CLI demo 作为 Web 页面失败时的兜底方案；
- 保留 mock provider 作为 Qwen / DeepSeek API 失败时的兜底方案。

## 6. 每个新增功能的验收模板

新增功能必须在 PR 中填写：

```text
Feature name:
Owner:
Changed files:
How to run:
Verification command:
Expected output:
Fallback plan:
```

没有验证命令的功能不得合并到主分支。
