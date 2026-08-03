# 多元思维模型每日课程网站

这是一个自动更新的“多元思维模型”知识网站。课程保存在 `data/courses.json`，页面会自动生成目录、搜索、上一课/下一课、已读状态、练习笔记、阅读进度，并支持手机、桌面和深色模式。

## 本地预览

```bash
npm run dev
```

## 部署到 Vercel

1. 打开你的 Vercel 新建页面：<https://vercel.com/new?teamSlug=xiongjy517-7913s-projects>
2. 选择 GitHub 仓库 `greyxiong/daily_knowledge`。
3. Framework 选择 `Other`。
4. Build Command 使用 `npm run build`。
5. Output Directory 使用 `public`。
6. 点击 Deploy。之后你只需要收藏 Vercel 给出的固定网址。

本项目是纯静态网站，`vercel.json` 会在部署前运行课程校验，并把可发布文件同步到 `public/`。连接 GitHub 后，每次 `main` 分支有新提交，Vercel 会自动发布。

## Secrets 和 API Key

当前方案不使用 OpenAI API，也不会把任何 API key 写入前端代码或提交到 Git。

每日课程生成由 Codex 自动化完成，使用 ChatGPT/Codex 订阅能力。Vercel 只负责静态网站托管，因此网站运行本身不需要 OpenAI API key。

如果以后改成 GitHub Actions 直接调用第三方 API，必须把 key 放在 GitHub Repository Secrets 或 Vercel Environment Variables 中，不能写入 `src/`、`data/`、`.env` 或任何会提交到仓库的文件。

## 每天中午 12:00 自动新增课程

使用 Codex 自动化创建一个每日任务，工作目录指向本仓库，任务提示词使用 `automation/daily-course-prompt.md` 的内容。

建议配置：

- 时间：每天 12:00
- 时区：Asia/Shanghai
- 工作目录：本仓库根目录
- 任务：读取 `prompts/course-system.md` 和 `data/courses.json`，新增下一节课程，校验后提交并推送

自动化会先读取已有课程，自动延续 Day 编号，并避免重复课程。失败时不会提交或发布，已有网站内容保持不变。

## 课程规则

课程写作规则维护在：

```text
prompts/course-system.md
```

每节新课必须包含：

- Day 编号
- 中文和英文模型名
- 所属学科
- 一句话定义
- 直觉解释
- 真实案例
- 工作和生活应用
- 与旧模型的连接
- 常见误区
- 小练习

Day 1-22 来自初始 HTML 文件。如果原内容较简略，本项目保持原样，不主动重写。

## 手动新增一课

手动编辑 `data/courses.json`，在数组末尾追加一个课程对象，然后运行：

```bash
npm run validate
npm run build
```

验证通过后提交并推送到 `main`，Vercel 会自动部署。

## 回滚

两种方式都可以：

- GitHub 回滚：在 GitHub 中 revert 对应 commit，然后推送到 `main`，Vercel 会自动部署回滚后的版本。
- Vercel 回滚：进入项目 Deployments，选择一个历史部署并 Promote to Production。

## 故障排查

- 新课程没有出现：确认 GitHub `main` 是否有新增课程 commit，再检查 Vercel Deployments 是否成功。
- 自动化失败：查看 Codex 自动化运行结果，通常是生成 JSON 不合法、校验失败、网络失败或 Git 推送冲突。
- Vercel 构建失败：在 Vercel 日志里查看 `npm run validate` 或 `npm run build` 的错误。
- 编号重复：运行 `npm run validate`，修复 `data/courses.json` 中重复或不连续的 Day。
- 页面能打开但内容不更新：刷新浏览器缓存，或确认访问的是 Production 域名而不是旧预览地址。
