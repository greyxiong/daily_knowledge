import MarkdownIt from "markdown-it";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { evidenceUrl, GenerationError } from "./responses.mjs";

const text = { type: "string" };
const boolean = { type: "boolean" };
const integer = { type: "integer" };
const list = (items) => ({ type: "array", items });
const object = (properties) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

export const schemas = {
  research: object({
    day: integer,
    chineseName: text,
    englishName: text,
    module: text,
    discipline: text,
    novelty: text,
    connectionDays: list(integer),
    evidence: list(object({ id: text, url: text, title: text, summary: text })),
  }),
  draft: object({
    markdown: text,
    claims: list(object({ id: text, statement: text, evidenceIds: list(text) })),
  }),
  critique: object({
    approved: boolean,
    distinctTopic: boolean,
    connectionsAccurate: boolean,
    completeAndAccurate: boolean,
    allCriticalClaimsListed: boolean,
    findings: list(text),
    claims: list(object({ id: text, supported: boolean, supportingUrls: list(text) })),
  }),
};

const markdownParser = new MarkdownIt({ html: false });
const sections = [
  "定义", "直觉与数学", "真实案例", "工作和生活应用", "与旧模型的连接",
  "常见误区", "小练习", "答案解析", "参考资料",
];
const normalize = (name) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const nonempty = (value, max) => typeof value === "string" && Boolean(value.trim()) && value.length <= max;
const singleLine = (value) => nonempty(value, 160) && value === value.trim() && !/[\p{Cc}\[\]<>*`]/u.test(value);
const identifier = (value) => typeof value === "string" && /^[a-z][a-z0-9_-]{0,24}$/u.test(value);
const boundedArray = (value, min, max) => Array.isArray(value) && value.length >= min && value.length <= max;
const allUnique = (values) => new Set(values).size === values.length;

export const teachingRules = await readFile(new URL("../../prompts/course-system.md", import.meta.url), "utf8");

function courseMap(rules) {
  const mapSection = rules.split("## 课程地图")[1] ?? "";
  return [...mapSection.matchAll(/^- ([^|\n]+) \| ([^|\n]+) \| ([^|\n]+) \| ([^|\n]+)$/gmu)]
    .map(([, chineseName, englishName, module, discipline]) => ({ chineseName, englishName, module, discipline }));
}

export function modelIndex(records) {
  return records.map(({ day, title, chineseName, englishName, module, discipline }) => ({
    day, title, chineseName, englishName, module, discipline,
  }));
}

function usedNames(index) {
  return new Set(index.flatMap(({ chineseName, englishName }) => [normalize(chineseName), normalize(englishName)]).filter(Boolean));
}

export function upcomingTopics(index, nextDay) {
  const used = usedNames(index);
  const remaining = courseMap(teachingRules).filter((topic) =>
    !used.has(normalize(topic.chineseName)) && !used.has(normalize(topic.englishName)),
  );
  // Day 70 explicitly promised this topic. Keep it mandatory for Day 71.
  const topics = nextDay === 71 ? remaining.filter((topic) => topic.englishName === "Thompson Sampling") : remaining;
  if (nextDay === 71 && !topics.length) throw new GenerationError("NO_UNUSED_TOPIC", "research");
  return topics;
}

export async function lessonContext(root, records, connectionDays = []) {
  const selected = [...new Set([...records.slice(-2).map(({ day }) => day), ...connectionDays])];
  return Promise.all(selected.map(async (day) => ({
    day,
    markdown: await readFile(join(root, records[day - 1].path), "utf8"),
  })));
}

export function checkResearch(data, searchedUrls, index, topics, day) {
  if (!data || data.day !== day || !["chineseName", "englishName", "module", "discipline"].every((key) => singleLine(data[key])) ||
      !nonempty(data.novelty, 800) || !boundedArray(data.connectionDays, 2, 4) ||
      !allUnique(data.connectionDays) || !data.connectionDays.every((connection) =>
        Number.isInteger(connection) && index[connection - 1] &&
        (index[connection - 1].chineseName || index[connection - 1].englishName))) {
    throw new GenerationError("INVALID_RESEARCH", "research");
  }
  const used = usedNames(index);
  if ([data.chineseName, data.englishName].some((name) => used.has(normalize(name)))) {
    throw new GenerationError("DUPLICATE_TOPIC", "research");
  }
  if (topics.length && !topics.some((topic) => Object.keys(topic).every((key) => topic[key] === data[key]))) {
    throw new GenerationError("UNPLANNED_TOPIC", "research");
  }
  if (!boundedArray(data.evidence, 1, 8) || !data.evidence.every((item) =>
    item && identifier(item.id) && singleLine(item.title) && nonempty(item.summary, 1_200) &&
    searchedUrls.has(evidenceUrl(item.url))) ||
    !allUnique(data.evidence.map(({ id }) => id)) || !allUnique(data.evidence.map(({ url }) => evidenceUrl(url)))) {
    throw new GenerationError("UNVERIFIED_EVIDENCE", "research");
  }
  return data;
}

function splitSections(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  if (lines.shift()?.trimEnd() !== heading) throw new GenerationError("INVALID_LESSON", "draft");
  const byName = new Map();
  let current;
  let fence;
  for (const line of lines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1].startsWith(fence) && !marker[2].trim()) fence = undefined;
    } else if (!fence && /^## /u.test(line)) {
      current = line.slice(3).trim();
      if (byName.has(current)) throw new GenerationError("INVALID_LESSON", "draft");
      byName.set(current, "");
      continue;
    }
    if (!fence && /^# /u.test(line)) throw new GenerationError("INVALID_LESSON", "draft");
    if (current) byName.set(current, `${byName.get(current)}\n${line}`);
  }
  if (fence || JSON.stringify([...byName.keys()]) !== JSON.stringify(sections) ||
      [...byName.values()].some((section) => !section.trim())) throw new GenerationError("INVALID_LESSON", "draft");
  return byName;
}

function citedLinks(markdown) {
  const links = new Set();
  for (const token of markdownParser.parse(markdown, {})) {
    for (const inline of token.children ?? []) {
      const url = inline.type === "link_open" && evidenceUrl(inline.attrGet("href"));
      if (url) links.add(url);
    }
  }
  return links;
}

function adjacentCitationSets(caseTokens, statement) {
  const occurrences = [];
  for (const token of caseTokens) {
    if (token.type !== "inline" || !token.content.includes(statement)) continue;
    const inline = token.children ?? [];
    for (const [index, node] of inline.entries()) {
      if (node.type !== "text" || !node.content.trimEnd().endsWith(statement)) continue;
      const urls = new Set();
      for (let next = index + 1; next < inline.length; next += 1) {
        const adjacent = inline[next];
        if (adjacent.type === "text" && !adjacent.content.trim()) continue;
        if (adjacent.type !== "link_open") break;
        const url = evidenceUrl(adjacent.attrGet("href"));
        if (url) urls.add(url);
        while (next + 1 < inline.length && inline[next + 1].type !== "link_close") next += 1;
        next += 1;
      }
      occurrences.push(urls);
    }
  }
  return occurrences;
}

export function checkDraft(data, research, index, apiKey) {
  if (!data || !nonempty(data.markdown, 42_000) ||
      data.markdown.includes(apiKey) || /<\/?[a-z][^>]*>|!\[|\{@body|/iu.test(data.markdown) ||
      !boundedArray(data.claims, 1, 10) || !data.claims.every((claim) =>
        claim && identifier(claim.id) && nonempty(claim.statement, 800) &&
        boundedArray(claim.evidenceIds, 1, 8) && claim.evidenceIds.every(identifier)) ||
      !allUnique(data.claims.map(({ id }) => id))) {
    throw new GenerationError("INVALID_LESSON", "draft");
  }
  const title = `${research.chineseName}（${research.englishName}）`;
  const parts = splitSections(data.markdown, `# 每日认知模型 #${research.day}：${title}`);
  const links = parts.get("与旧模型的连接");
  const referenced = research.connectionDays.every((day) => {
    const previous = index[day - 1];
    return links.split(/\r?\n/u).some((line) =>
      new RegExp(`\\bDay\\s+${day}\\b`, "iu").test(line) &&
      [previous.chineseName, previous.englishName].filter(Boolean).some((name) => line.includes(name)));
  });
  if (!referenced) throw new GenerationError("INVALID_CONNECTIONS", "draft");

  const caseTokens = markdownParser.parse(parts.get("真实案例"), {});
  const referenceUrls = citedLinks(parts.get("参考资料"));
  const sourceById = new Map(research.evidence.map((item) => [item.id, item]));
  const used = new Map();
  for (const claim of data.claims) {
    const sources = claim.evidenceIds.map((id) => sourceById.get(id));
    const urls = sources.map((source) => evidenceUrl(source?.url));
    const cited = adjacentCitationSets(caseTokens, claim.statement);
    if (!urls.every((url) => url && referenceUrls.has(url)) ||
        !cited.some((nearby) => urls.every((url) => nearby.has(url)))) {
      throw new GenerationError("UNVERIFIED_EVIDENCE", "draft");
    }
    for (const [index, url] of urls.entries()) used.set(url, { url, title: sources[index].title });
  }

  const linkedUrls = citedLinks(data.markdown);
  // Fail closed on bare URLs, and on references that aren't paired with evidence.
  for (const [url] of data.markdown.matchAll(/https?:\/\/[^\s<>")\]]+/giu)) {
    const normalized = evidenceUrl(url);
    if (!used.has(normalized) || !linkedUrls.has(normalized)) throw new GenerationError("UNVERIFIED_EVIDENCE", "draft");
  }
  return { title, sources: [...used.values()], mathSection: parts.get("直觉与数学") };
}

export function checkCritique(data, openedUrls, draft, research) {
  const flags = ["approved", "distinctTopic", "connectionsAccurate", "completeAndAccurate", "allCriticalClaimsListed"];
  const reviews = data?.claims;
  if (!data || !flags.every((flag) => data[flag] === true) ||
      !Array.isArray(data.findings) || data.findings.length !== 0 ||
      !Array.isArray(reviews) || reviews.length !== draft.claims.length ||
      !reviews.every((claim) => claim && identifier(claim.id) && claim.supported === true &&
        boundedArray(claim.supportingUrls, 1, 8)) ||
      !allUnique(reviews.map(({ id }) => id))) {
    throw new GenerationError("REVIEW_REJECTED", "critique");
  }
  const byId = new Map(research.evidence.map((source) => [source.id, evidenceUrl(source.url)]));
  for (const claim of draft.claims) {
    const intended = new Set(claim.evidenceIds.map((id) => byId.get(id)));
    const returned = reviews.find(({ id }) => id === claim.id)?.supportingUrls ?? [];
    const verified = new Set(returned.map(evidenceUrl));
    if (!returned.length ||
        [...verified].some((url) => !intended.has(url) || !openedUrls.has(url)) ||
        [...intended].some((url) => !verified.has(url))) {
      throw new GenerationError("UNVERIFIED_EVIDENCE", "critique");
    }
  }
}
