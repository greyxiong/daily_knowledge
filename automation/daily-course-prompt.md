# 每日课程发布

每日课程由 [GitHub Actions 工作流](../.github/workflows/daily-course.yml) 执行。它在北京时间 12:00 调用 OpenAI API，读取 [课程规则和地图](../prompts/course-system.md)、课程索引以及最近和相关课程正文，生成并独立核验一节新课。

在 GitHub 打开 **Actions → Daily course → Run workflow**。选择 `dry-run` 可下载经过验证的 Markdown 预览。选择 `publish` 会在校验和网站构建通过后，将新课推送至 `main`，再等待 Vercel 确认该提交已部署。选择单个历史日期可以补发，课程仍使用下一个连续 Day。

密钥设置、成本和故障处理见 [每日课程运维说明](../docs/automation.md)。
