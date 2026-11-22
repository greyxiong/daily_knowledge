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

默认使用已登录 Codex 的订阅额度，由本机定时任务在北京时间 12:00 启动。电脑须开机联网、应用运行且订阅有可用额度。详见 [订阅任务规范](automation/subscription-course-prompt.md) 与 [自动化说明](docs/automation.md)。无需 API Key，不自动购买额度，也不自动切换到 API 计费。调度、生成和构建可能延迟，不保证整点已上线。

GitHub 的 API 生成工作流仅保留为手动备选，已取消定时触发。只有用户明确选择 API 时才需要 `OPENAI_API_KEY`。默认订阅流程由 Codex 真实浏览来源并独立审阅，`scripts/publish-reviewed-course.mjs` 校验审核包、公式、引用、编号及日期，保存课程时不调用模型 API。

流程：完整课程索引 → 课程地图与近期原文 → 来源研究 → 结构化草稿 → 独立复核与公式检查 → 追加一课 → 构建 → 推送 → 核对原 Vercel 项目的对应提交状态。所有检查通过前不写入已发布课程。

默认订阅方式不产生 OpenAI API 账单，会使用现有 ChatGPT/Codex 订阅额度，受其限额影响。公开仓库标准 GitHub Actions 计算通常免费；Vercel Hobby 免费额度内可为 $0。额外预览与重试会消耗订阅额度。参考 https://learn.chatgpt.com/docs/pricing 、https://docs.github.com/en/billing/concepts/product-billing/github-actions 、https://vercel.com/docs/plans/hobby 。
