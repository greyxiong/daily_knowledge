# 每日课程发布

GitHub Actions 的 **Daily course** 工作流在 UTC 04:00 排程，也就是北京时间 12:00。排程是开始时间，生成、审核和部署都需要时间。GitHub 在繁忙时可能延迟或丢弃排程。GitHub 不会自动批量补发缺失日期。 [GitHub Actions 排程](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule)

## 配置 OpenAI 密钥

1. 在 OpenAI API 项目中配置结算并创建一个项目 API 密钥。使用拥有模型和 Responses API 访问权限的项目。 [OpenAI API 密钥](https://platform.openai.com/api-keys)
2. 在 GitHub 的仓库设置进入 **Secrets and variables → Actions → New repository secret**。以 `OPENAI_API_KEY` 保存密钥。保留在密钥管理界面，避免写入仓库、聊天、构建产物或命令参数。缺少密钥时工作流失败，并明确报告 `MISSING_API_KEY`。 [GitHub Actions 密钥](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
3. 默认模型是 `gpt-6.2-sol`。若需要，可在 Actions 的 **Variables** 中设置 `OPENAI_MODEL`。替换模型必须同时支持 Responses API、结构化输出和网页搜索。 [GPT‑6.2 Sol](https://developers.openai.com/api/docs/models/gpt-6.2-sol)
4. 在 Vercel 确认现有项目 `daily-knowledge` 的 Production Branch 是 `main`，并与本仓库相连。默认通过 GitHub 的部署集成发布。只有确认集成需要额外触发时，才在现有项目为 `main` 创建 Deploy Hook，把完整 URL 保存为可选的 Actions Secret `VERCEL_DEPLOY_HOOK`。 [Vercel 的 GitHub 集成](https://vercel.com/docs/git/vercel-for-github) · [Deploy Hooks](https://vercel.com/docs/deploy-hooks)

## 首次运行和补发

- 在 GitHub 打开 **Actions → Daily course → Run workflow**，从 `main` 运行 `dry-run`。成功后，运行页面里的 `daily-course-dry-run` 附件包含一份通过检查的 Markdown。预览会产生 API 费用，课程原文与索引保持原状。任选一天预览时，如果该日已经有已发布课程，运行会返回现有登记。
- 选择 `publish` 发布。日期留空时，使用工作流本次创建时的北京时间日期。重新运行原工作流沿用原日期。同一个日期只会追加一次。
- 在 `date` 中填写一个尚未发布的历史日期，例如 `2026-11-21`，即可补发一节。补课使用下一个未使用的 Day，日期可早于此前发布的 Day。补发按需逐日选择；未来日期会被拒绝。若需要在当天中午前手动试运行或发布，选中 `allow_early`。
- 本地预览使用 `npm run generate -- --dry-run`。在本地环境内安全提供 `OPENAI_API_KEY`，并在中午前按需加 `--allow-early`。预览写在 `work/daily-course-dry-run/`。脚本输出的 `published` 表示本地原文与索引写入成功。GitHub 工作流还会单独验证、推送和确认部署。

## 生成、核验和成本

程序先校验 Day 1–70 的完整记录和全部已登记课程的原文哈希。选题提供整个索引的课程标题、模型名称和学科模块，另外提供最近两节和 2–4 节明确关联的旧课正文。发送给 API 的上下文限于这些公开课程、候选主题和课程规则。完整私人对话与私有信息不参与运行。Day 71 接续 Day 70 的预告讲 Thompson Sampling。[课程地图](../prompts/course-system.md) 中的候选主题优先使用。用尽后，研究阶段根据完整索引和近期课程提出新主题，并由独立审核确认它与旧课连贯、确有新机制。

研究、写作和审核是三个独立的 API 请求。研究和审核各至多调用五次网页搜索工具。写作只使用已搜集的公开来源。审核必须对同一批来源实际执行独立的打开页面操作，并检查原文能否支持关键事实。每条关键事实后紧跟可点击的来源链接。审核还检查选题是否重复、旧课连接与教学内容是否正确完整。数学部分至少有一个能渲染的公式。证据不足、格式错误或渲染校验失败时，运行停止且不会推送。

单个请求上下文上限为 350 KB。研究、写作和审核输出分别限制在 2,500、8,000 和 3,500 tokens。网络异常、请求超时、限流与服务器故障每阶段最多尝试三次。运行日志记录 API 实际返回的 token 数和工具调用数，以及失败阶段或状态。正文、响应正文和密钥不会写入日志。

按每天运行一次估计，API 成本可先按 **每月约 10–20 美元**预算。费用受上下文长度、搜索结果 token、重试和额外预览影响。用 OpenAI 用量面板核对实际费用。 [OpenAI API 定价](https://developers.openai.com/api/docs/pricing)

## 发布状态和失败恢复

工作流串行执行并在开始时更新 `main`。构建通过后，工作流用仓库的 `GITHUB_TOKEN` 推送由 GitHub Actions 机器人创建的提交，仅包含新课原文和索引。该令牌的推送通常不会触发其他 GitHub Actions 工作流，因此本工作流自行运行测试和构建。Vercel 会按项目和仓库权限校验 Git 提交来源。若 Vercel 拒绝机器人的提交，先检查现有项目的 Git 权限与日志，有需要再配置该项目的 Deploy Hook。若远端分支在生成期间更新，普通推送会拒绝覆盖。可重新运行原任务，由工作流重新读取远端状态。 [GitHub 工作流令牌](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow) · [Vercel Git 部署规则](https://vercel.com/docs/git)

推送成功后，工作流同时检查 GitHub 上现有 Vercel 项目的提交状态，以及原生产网址的 `/deployment.json`。生产构建写入提交 SHA 和全部课程的内容哈希。只有 Vercel 回报成功且原网址返回目标提交和课程哈希，工作流才确认本次部署。若重跑旧任务时原网址已部署更新的提交，工作流会核对 GitHub 提交关系和原生产索引的课程哈希。确认该课已包含时，报告它已随更新部署上线。无法核对时，任务失败并标注 GitHub 上的课程仍在。若使用了可选 Hook，工作流只在目标提交仍是 `main` 最新提交时触发它，然后继续确认。 [GitHub 提交状态 API](https://docs.github.com/en/rest/commits/statuses#get-the-combined-status-for-a-specific-reference)

本地脚本以课程目录中的文件和索引作为发布记录。若在本地写入过程中强制终止进程，先确认发布进程已经结束，再检查 `data/.lesson-publication.lock`、未索引的新课及同名临时文件。仅在确认它们属于中断的尝试后移除，再重跑同一个日期。
