# 每日课程发布

默认每日课程由本机 Codex 订阅任务执行，规范见 [订阅任务说明](subscription-course-prompt.md)。它在北京时间 12:00 读取课程规则、索引、最近与相关课文，研究、写作、独立审核和发布，不调用 OpenAI API。

保留的 **Daily course (manual API fallback)** 工作流只有手动触发，不自动运行；用户明确选择 API 并配置密钥后才使用。默认订阅任务可在 Scheduled 中手动运行，或在本 chat 指定日期补发、重试。两种方式共用连续编号和单日幂等检查。

密钥设置、成本和故障处理见 [每日课程运维说明](../docs/automation.md)。
