# Daily Cognitive Models implementation plan
User-approved design: restore Day 1–70 unchanged, preserve existing UI/URL, add API generation and daily GitHub→Vercel publishing. Private transcript remains outside repository. Original remote base: 9ad243a088cc3d801ab038077ed2e6ea75667af9. Local baseline: 58b613d.

## Task 1: historical migration and rendering
Read private ../work/chat-copy/每日知识-结构化文本.json locally. Extract only assistant course messages whose first heading matches 每日认知模型 #N. Save exact UTF-8 bodies under content/lessons/day-NNN.md; preserve duplicate Day 1 original under content/versions. Choose last conversation-order version for default. Save public data/lesson-index.json with day,title,chineseName,englishName,module,discipline,path,sha256,source:"history",messageId,publishedOn,sources:[{url,title}]. Do NOT publish chat transcript, personal prompts or raw metadata. Index is ordered by day, complete 1–70. Copying text is not correcting it. Record migration coverage, duplicate versions, unresolved citation and component limitations.

Render Markdown, math and supported custom layout/quiz tags at build time using a conservative sanitization allowlist. Preserve source files unmodified. Reuse existing static index.html frame/navigation/localStorage keys, expose full content and full-text search, render safe links and citations. Generated public/data/courses.json is derived from the index plus content. Preserve #day-N anchor behavior. Hash verification prevents accidental source changes. Add meaningful tests for imports, math errors, safe HTML, cite mapping, quiz correctness and index continuity.

## Task 2: API generation and publishing
Read work/generation-brief.md. Own generation scripts, tests, daily workflow, generation rules and automation docs. Consume the index contract above and renderer interface below. No edits to package.json, index.html, historical importer, renderer or migration files. First test missing/repeat dates, bad output/refusals, duplicate topics, citations, failed validation, concurrency. Then implement. No real API calls without supplied OPENAI_API_KEY. No remote mutations from worker. Report actual API simulation limits.

Renderer contract: scripts/render-course.mjs exports renderCourse(markdown,{sources=[]}={}) => {html, issues: Array<{type,message}>}. Generated output must have no issues; historical issues documented but must not alter source. node:fs and node:crypto only required for index updates; other dependency versions owned by root.

## Task 3: integration/review/deploy
Run tests, verify private data exclusion and exact raw course hashes, desktop/mobile browser checks, generated simulation in temporary checkout and failure scenarios. Independent review. Commit implementation. Recheck remote head before pushing. Publish to existing daily-knowledge project only and observe Vercel result, original URL and course count. API key is currently absent; migration can deploy independently, real API end-to-end activation remains blocked until safe secret setup.

