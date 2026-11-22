# 多元思维模型每日课程网站

继续维护原站：https://daily-knowledge-xiongjy517-7913s-projects.vercel.app/

## 内容与迁移

- `content/lessons/day-001.md` 至 `day-070.md` 是从原「每日知识」对话恢复的课程原文，未改写。
- `data/lesson-index.json` 是课程索引，记录编号、标题、学科、来源消息、原文 SHA-256 和关联来源链接。
- Day 1 原对话存在两个版本；采用对话顺序中后一个版本，另一个保存在 `content/versions/day-001-v1.md`。
- `data/migration-report.json` 和 `docs/migration.md` 记录覆盖情况和恢复限制。
- 原始聊天、私人问题、芯片专题、账户信息没有进入本仓库。完整私人导出仅在本地处理。

## 本地运行

使用 Node.js 22 或以上：

```bash
npm ci
npm test
npm run build
npm run dev
```

打开 http://localhost:5173 。保留现有界面、`#day-N` 锚点，以及 `mental-model-read`、`mental-model-notes` 浏览器存储键。阅读进度只保存在当前浏览器。

构建时从独立 Markdown 原文生成完整课程数据，渲染公式、安全处理 HTML，复制本地公式字体到 `public/`。部署只使用派生的 `public/`，私有聊天源文件不参与构建。

## 原项目部署

`vercel.json` 仍运行 `npm run build`，输出目录仍是 `public`。GitHub 连接的原 Vercel 项目为 `xiongjy517-7913s-projects/daily-knowledge`。不创建新项目或新网址。当前分支推送后需观察实际 Vercel 部署状态，不能把 Git 推送成功等同于上线成功。

## 每日生成

见 [自动化说明](docs/automation.md)。GitHub 工作流按每天北京时间 12:00 计划启动，也支持手动预览、重试和单日补发。调度、生成和构建可能延迟，不保证整点已上线。

需要在 GitHub 仓库 Actions Secrets 安全设置 `OPENAI_API_KEY`，不要放进聊天、代码、前端或日志。默认模型 `gpt-6.2-sol`，可用仓库变量 `OPENAI_MODEL` 调整。缺少密钥时任务会明确失败，不发布内容。ChatGPT/Codex 订阅本身不保证覆盖这里的 API 消耗。

流程：完整课程索引 → 课程地图与近期原文 → 来源研究 → 结构化草稿 → 独立复核与公式检查 → 追加一课 → 构建 → 推送 → 核对原 Vercel 项目的对应提交状态。所有检查通过前不写入已发布课程。

预计 API 预算 $10–20/月；真实消耗以日志中的 token 和搜索调用数为准。公开仓库标准 GitHub Actions 计算通常免费；Vercel Hobby 免费额度内可为 $0，Pro 基础费 $20/月起，另可能有超额费用。价格查询日期为 2026-11-21，参考 https://developers.openai.com/api/docs/pricing 、https://docs.github.com/en/billing/concepts/product-billing/github-actions 、https://vercel.com/docs/plans 。
