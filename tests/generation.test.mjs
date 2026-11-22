import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const now = new Date("2026-11-21T04:00:00.000Z");
const lifecycle = { now, apiKey: "fake-test-credential", retryDelayMs: 0, log: () => {} };
const url = "https://www.microsoft.com/en-us/research/publication/thompson-sampling-efficient/";
const sourceTitle = "Thompson Sampling for Contextual Bandits";
const claim = "微软研究院的研究比较了 Thompson Sampling 在上下文老虎机问题中的表现。";
const lesson = `# 每日认知模型 #71：汤普森采样（Thompson Sampling）

## 定义

汤普森采样从每个选项的后验分布抽取一个参数，然后选择抽样值最大的选项。

## 直觉与数学

伯努利收益可以用 Beta 分布来表示不确定性。成功和失败分别更新两个参数。\n\n例如 \\(\\operatorname{Beta}(2,1)\\)。

## 真实案例

${claim} [原始论文](${url})

## 工作和生活应用

工作中可设计低风险试验。生活中可在已知选项与新尝试之间分配时间。

## 与旧模型的连接

Day 70 的 ε-greedy 用固定概率探索，Day 66 的 贝叶斯更新 则解释如何累积证据。

## 常见误区

样本过少时不要将抽样值当作真实概率。

## 小练习

两个备选实验的 Beta 初始分布相同。连续观察一次成功后应如何更新参数？

## 答案解析

增加观察成功的选项的第一个参数，同时保留探索其他选项的机会。

## 参考资料

- [${sourceTitle}](${url})：论文用于核实研究开展的情境。
`;

const chosen = {
  day: 71,
  chineseName: "汤普森采样",
  englishName: "Thompson Sampling",
  module: "统计学与决策科学",
  discipline: "机器学习",
  novelty: "对每个选项抽取后验参数，实现对不确定性的概率匹配",
  connectionDays: [70, 66],
};
const research = {
  ...chosen,
  evidence: [{ id: "paper", url, title: sourceTitle, summary: "论文报告了上下文老虎机算法的研究设置。" }],
};
const draft = {
  markdown: lesson,
  claims: [{ id: "study", statement: claim, evidenceIds: ["paper"] }],
};
const critique = {
  approved: true,
  distinctTopic: true,
  connectionsAccurate: true,
  completeAndAccurate: true,
  allCriticalClaimsListed: true,
  findings: [],
  claims: [{ id: "study", supported: true, supportingUrls: [url] }],
};

async function generate(options) {
  const { generateCourse } = await import("../scripts/generate-course.mjs");
  return generateCourse(options);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "daily-course-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "data"));
  await mkdir(join(root, "content", "lessons"), { recursive: true });
  const index = await Promise.all(Array.from({ length: 70 }, async (_, offset) => {
    const day = offset + 1;
    const chineseName = day === 70 ? "ε-greedy" : day === 66 ? "贝叶斯更新" : `历史模型 ${day}`;
    const englishName = day === 70 ? "Epsilon-Greedy" : day === 66 ? "Bayesian Update" : `Historical Model ${day}`;
    const title = `每日认知模型 #${day}：${chineseName}`;
    const path = `content/lessons/day-${String(day).padStart(3, "0")}.md`;
    const markdown = `# ${title}\n\nDay ${day} 的课程原文。\n`;
    await writeFile(join(root, path), markdown);
    return {
      day, title, chineseName, englishName, path, module: "统计学", discipline: "统计学",
      sha256: createHash("sha256").update(markdown).digest("hex"),
      source: "history", messageId: `test-${day}`, publishedOn: "2026-11-20", sources: [],
    };
  }));
  const indexPath = join(root, "data", "lesson-index.json");
  const original = `${JSON.stringify(index, null, 2)}\n`;
  await writeFile(indexPath, original);
  return { root, indexPath, original };
}

function answer(result, searchUrls = [], openedUrls = []) {
  return Response.json({
    id: "resp_test", status: "completed",
    output: [
      ...searchUrls.map((source) => ({
        type: "web_search_call", id: "ws_test", status: "completed",
        action: { type: "search", query: "primary source", sources: [{ type: "url", url: source }] },
      })),
      ...openedUrls.map((source) => ({
        type: "web_search_call", id: "ws_open", status: "completed", action: { type: "open_page", url: source },
      })),
      { type: "message", id: "msg_test", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(result), annotations: [] }] },
    ],
    usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180 },
  });
}

function api({ evidence = research, text = draft, review = critique, researchUrls = [url], reviewUrls = [url], openedUrls = reviewUrls } = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (endpoint, options) => {
      assert.equal(endpoint, "https://api.openai.com/v1/responses");
      assert.equal(options.headers.Authorization, "Bearer fake-test-credential");
      const request = JSON.parse(options.body);
      assert.equal(request.store, false);
      assert.equal(request.model, "gpt-6.2-sol");
      assert.ok(request.text.format.strict);
      assert.ok(Buffer.byteLength(options.body) <= 350_000);
      calls.push(request);
      switch (request.text.format.name) {
        case "course_research":
          assert.equal(request.tools[0].type, "web_search");
          assert.equal(request.max_tool_calls, 5);
          return answer(evidence, researchUrls);
        case "course_draft":
          assert.equal(request.tools, undefined);
          return answer(text);
        case "course_critique":
          assert.equal(request.tools[0].type, "web_search");
          assert.equal(request.max_tool_calls, 5);
          return answer(review, reviewUrls, openedUrls);
        default:
          assert.fail("Unexpected API request");
      }
    },
  };
}

async function assertUntouched({ root, indexPath, original }) {
  assert.equal(await readFile(indexPath, "utf8"), original);
  assert.equal((await readdir(join(root, "content", "lessons"))).length, 70);
  assert.deepEqual(await readdir(join(root, "data")), ["lesson-index.json"]);
}

test("requires a key and verifies the historical baseline before using the API", async (t) => {
  const files = await fixture(t);
  const service = api();
  const options = { ...lifecycle, root: files.root, fetch: service.fetch };
  await assert.rejects(generate({ ...options, apiKey: "" }), { code: "MISSING_API_KEY" });
  await rm(join(files.root, "content", "lessons", "day-015.md"));
  await assert.rejects(generate(options), { code: "INVALID_INDEX" });
  assert.equal(service.calls.length, 0);
});

test("enforces Shanghai noon and refuses a future date", async (t) => {
  const files = await fixture(t);
  const service = api();
  const options = { ...lifecycle, root: files.root, fetch: service.fetch };
  await assert.rejects(generate({ ...options, now: new Date("2026-11-21T03:59:59Z") }), { code: "TOO_EARLY" });
  await assert.rejects(generate({ ...options, date: "2026-11-22", allowEarly: true }), { code: "INVALID_DATE" });
  assert.equal(service.calls.length, 0);
  await assertUntouched(files);
});

test("a verified dry-run preserves the lesson and index, then real publication consumes the date once", async (t) => {
  const files = await fixture(t);
  const service = api();
  const options = { ...lifecycle, root: files.root, fetch: service.fetch };
  const preview = await generate({ ...options, dryRun: true });
  assert.equal(preview.status, "dry-run");
  assert.equal(await readFile(join(files.root, preview.path), "utf8"), lesson);
  await assertUntouched(files);
  const result = await generate(options);
  assert.deepEqual(result, { status: "published", day: 71, date: "2026-11-21", path: "content/lessons/day-071.md" });
  assert.equal(await readFile(join(files.root, result.path), "utf8"), lesson);
  const records = JSON.parse(await readFile(files.indexPath, "utf8"));
  assert.deepEqual(records.slice(0, 70), JSON.parse(files.original));
  assert.deepEqual(records[70], {
    day: 71, title: "汤普森采样（Thompson Sampling）", chineseName: chosen.chineseName,
    englishName: chosen.englishName, module: chosen.module, discipline: chosen.discipline, path: result.path,
    sha256: createHash("sha256").update(lesson).digest("hex"), source: "generated",
    publishedOn: "2026-11-21", sources: [{ title: sourceTitle, url }],
  });
  assert.deepEqual(await generate(options), { ...result, status: "existing" });
  assert.equal(service.calls.length, 6);
  const requestText = JSON.stringify(service.calls[0].input);
  assert.match(requestText, /Historical Model 1/);
  assert.match(requestText, /Day 70 的课程原文/);
  assert.doesNotMatch(requestText, /test-70|Day 1 的课程原文/);
});

test("manual backfill gives a missing date the next sequential day", async (t) => {
  const files = await fixture(t);
  const service = api();
  const result = await generate({ ...lifecycle, root: files.root, fetch: service.fetch, date: "2026-11-19" });
  assert.equal(result.day, 71);
  assert.equal(result.date, "2026-11-19");
});

test("network outages retry at most three times without logging the raw error", async (t) => {
  const files = await fixture(t);
  let attempts = 0;
  const logs = [];
  await assert.rejects(generate({
    ...lifecycle, root: files.root, log: (event) => logs.push(event),
    fetch: async () => {
      attempts += 1;
      throw new Error("request leaked fake-test-credential");
    },
  }), { code: "API_UNAVAILABLE" });
  assert.equal(attempts, 3);
  assert.doesNotMatch(JSON.stringify(logs), /credential|request leaked/);
  await assertUntouched(files);
});

test("incomplete or refused API output cannot be published", async (t) => {
  const files = await fixture(t);
  const fetch = async () => Response.json({
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "private response" }] }],
  });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch }), { code: "API_OUTPUT_REJECTED" });
  await assertUntouched(files);
});

test("an alternate spelling cannot bypass existing-topic name checks", async (t) => {
  const files = await fixture(t);
  const service = api({ evidence: { ...research, englishName: "Ｅｐｓｉｌｏｎ–Ｇｒｅｅｄｙ" } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "DUPLICATE_TOPIC" });
  assert.equal(service.calls.length, 1);
  await assertUntouched(files);
});

test("a fabricated research URL is rejected before drafting", async (t) => {
  const files = await fixture(t);
  const service = api({ researchUrls: ["https://example.org/unrelated"] });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "UNVERIFIED_EVIDENCE" });
  assert.equal(service.calls.length, 1);
  await assertUntouched(files);
});

test("a critical claim unsupported by the rechecked source stops publication", async (t) => {
  const files = await fixture(t);
  const service = api({ review: { ...critique, claims: [{ ...critique.claims[0], supported: false }] } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "REVIEW_REJECTED" });
  await assertUntouched(files);
});

test("a critique that only repeats the draft URL cannot pass without independently retrieving it", async (t) => {
  const files = await fixture(t);
  const service = api({ reviewUrls: ["https://example.org/unrelated"] });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "UNVERIFIED_EVIDENCE" });
  await assertUntouched(files);
});

test("the critique can reject a semantic repeat under different names", async (t) => {
  const files = await fixture(t);
  const service = api({ review: { ...critique, distinctTopic: false } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "REVIEW_REJECTED" });
  await assertUntouched(files);
});

test("an incomplete lesson cannot be published", async (t) => {
  const files = await fixture(t);
  const service = api({ text: { ...draft, markdown: lesson.replace("## 答案解析", "## 另外") } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "INVALID_LESSON" });
  await assertUntouched(files);
});

test("the real renderer stops publication when math contains an unsupported command", async (t) => {
  const files = await fixture(t);
  const markdown = lesson.replace("两个参数。", () => "两个参数。\n\n$$\n\\notarealkaTexcommand\n$$");
  const service = api({ text: { ...draft, markdown } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "RENDER_REJECTED" });
  await assertUntouched(files);
});

test("parallel local publication attempts cannot create two competing lessons", async (t) => {
  const files = await fixture(t);
  const service = api();
  const options = { ...lifecycle, root: files.root, fetch: service.fetch };
  const results = await Promise.allSettled([generate(options), generate(options)]);
  const winner = results.find((result) => result.status === "fulfilled");
  const loser = results.find((result) => result.status === "rejected");
  assert.equal(winner.value.status, "published");
  assert.equal(loser.reason.code, "PUBLICATION_LOCKED");
  assert.equal(service.calls.length, 3);
  assert.equal((await readdir(join(files.root, "content", "lessons"))).length, 71);
});

test("a preexisting unindexed lesson cannot be overwritten on commit failure", async (t) => {
  const files = await fixture(t);
  const service = api();
  const preexisting = join(files.root, "content", "lessons", "day-071.md");
  await writeFile(preexisting, "leave these bytes alone\n");
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "PUBLISH_WRITE_FAILED" });
  assert.equal(await readFile(preexisting, "utf8"), "leave these bytes alone\n");
  assert.equal(await readFile(files.indexPath, "utf8"), files.original);
  assert.deepEqual(await readdir(join(files.root, "data")), ["lesson-index.json"]);
});

test("GPT-6.2 commentary is ignored while its structured final answer is processed", async (t) => {
  const files = await fixture(t);
  const service = api();
  const fetch = async (...args) => {
    const result = await (await service.fetch(...args)).json();
    result.output.unshift({
      type: "message", role: "assistant", status: "completed", phase: "commentary",
      content: [{ type: "output_text", text: "An intermediate progress update.", annotations: [] }],
    });
    result.output.at(-1).phase = "final_answer";
    return Response.json(result);
  };
  const result = await generate({ ...lifecycle, root: files.root, dryRun: true, fetch });
  assert.equal(result.status, "dry-run");
  await assertUntouched(files);
});

test("non-clickable citations inside a code fence cannot support publication", async (t) => {
  const files = await fixture(t);
  const caseWithLiteralCitation = `\`\`\`md\n${claim} [原始论文](${url})\n\`\`\``;
  const markdown = lesson.replace(`${claim} [原始论文](${url})`, caseWithLiteralCitation);
  const service = api({ text: { ...draft, markdown } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "UNVERIFIED_EVIDENCE" });
  await assertUntouched(files);
});

test("a successful source search without a completed page open does not verify the article", async (t) => {
  const files = await fixture(t);
  const service = api({ openedUrls: [] });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "UNVERIFIED_EVIDENCE" });
  await assertUntouched(files);
});

test("a completed open can verify its own URL without a separate search result", async (t) => {
  const files = await fixture(t);
  const service = api({ reviewUrls: [], openedUrls: [url] });
  const result = await generate({ ...lifecycle, root: files.root, dryRun: true, fetch: service.fetch });
  assert.equal(result.status, "dry-run");
});

test("a reference elsewhere in the case cannot support a claim with no adjacent citation", async (t) => {
  const files = await fixture(t);
  const markdown = lesson.replace(`${claim} [原始论文](${url})`, `${claim}\n\n另见 [原始论文](${url})`);
  const service = api({ text: { ...draft, markdown } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "UNVERIFIED_EVIDENCE" });
  await assertUntouched(files);
});

test("the mathematical explanation requires an actual formula in that section", async (t) => {
  const files = await fixture(t);
  const markdown = lesson.replace("例如 \\(\\operatorname{Beta}(2,1)\\)。", "例如查表。");
  const service = api({ text: { ...draft, markdown } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "RENDER_REJECTED" });
  await assertUntouched(files);
});

test("a valid formula does not excuse an unclosed delimiter elsewhere in the generated lesson", async (t) => {
  const files = await fixture(t);
  const markdown = lesson.replace("常见误区\n\n", "常见误区\n\n\\(未闭合。\n\n");
  const service = api({ text: { ...draft, markdown } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "RENDER_REJECTED" });
  await assertUntouched(files);
});

test("after the curated map is exhausted, an independently approved new topic can be published", async (t) => {
  const files = await fixture(t);
  const rules = await readFile(new URL("../prompts/course-system.md", import.meta.url), "utf8");
  const topics = [...rules.matchAll(/^- (.+) \| (.+) \| (.+) \| (.+)$/gmu)];
  assert.ok(topics.length > 0);
  const records = JSON.parse(files.original);
  for (const [offset, [, chineseName, englishName, module, discipline]] of topics.entries()) {
    const day = 71 + offset;
    const path = `content/lessons/day-${String(day).padStart(3,"0")}.md`;
    const title = `${chineseName}（${englishName}）`;
    const markdown = `# 每日认知模型 #${day}：${title}\n\n旧课程。`;
    await writeFile(join(files.root, path), markdown);
    records.push({
      day, title, chineseName, englishName, module, discipline, path,
      sha256: createHash("sha256").update(markdown).digest("hex"),
      source: "generated", publishedOn: new Date(Date.UTC(2026,9,1+offset)).toISOString().slice(0,10), sources: [],
    });
  }
  await writeFile(files.indexPath, JSON.stringify(records));
  const topic = { day: records.length+1, chineseName:"条件概率校验", englishName:"Conditional Calibration" };
  const markdown = lesson.replace("#71：汤普森采样（Thompson Sampling）", `#${topic.day}：条件概率校验（Conditional Calibration）`);
  const service = api({ evidence: { ...research, ...topic }, text: { ...draft, markdown } });
  const result = await generate({ ...lifecycle, root: files.root, fetch: service.fetch });
  assert.equal(result.day,topic.day);
  assert.equal(result.status,"published");
  assert.equal(service.calls.length,3);
});

test("an indented example of TeX in a code block cannot serve as the lesson formula", async (t) => {
  const files = await fixture(t);
  const markdown = lesson.replace(
    "例如 \\(\\operatorname{Beta}(2,1)\\)。",
    () => "    \\(\\operatorname{Beta}(2,1)\\)",
  );
  const service = api({ text: { ...draft, markdown } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "RENDER_REJECTED" });
  await assertUntouched(files);
});

test("empty or whitespace-only formulas cannot satisfy generated math validation", async (t) => {
  const files = await fixture(t);
  for (const blank of ["$$$$", "\\(   \\)", "$$\n \n$$"]) {
    const markdown = lesson.replace("例如 \\(\\operatorname{Beta}(2,1)\\)。", () => blank);
    const service = api({ text: { ...draft, markdown } });
    await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "RENDER_REJECTED" });
    await assertUntouched(files);
  }
  const service = api({ text: { ...draft, markdown: lesson.replace("样本过少", () => "空公式 $$$$。样本过少") } });
  await assert.rejects(generate({ ...lifecycle, root: files.root, fetch: service.fetch }), { code: "RENDER_REJECTED" });
  await assertUntouched(files);
});
