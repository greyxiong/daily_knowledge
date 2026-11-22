import { randomBytes } from "node:crypto";
import katex from "katex";

export function mathTemplates(source, markdown, escape, issues, { generated }) {
  const namespace = `LessonMarker${randomBytes(12).toString("hex")}`;
  const markerPattern = new RegExp(`${namespace}(\\d+)End`, "g");
  const entries = [];
  let count = 0;

  function reserve(raw, html = escape(raw), rendered = false) {
    const key = `${namespace}${entries.length}End`;
    entries.push({ raw, html, rendered });
    return key;
  }

  const lines = source.split("\n");
  const code = markdown.parse(source, {}).filter(({ type }) => type === "fence" || (generated && type === "code_block"));
  for (const { map: [start, end] } of code.reverse()) {
    const raw = lines.slice(start, end).join("\n");
    lines.splice(start, end - start, reserve(raw));
  }
  let working = lines.join("\n");
  working = working.replace(/(?<![`{])(`+)(?!`)[^\n]*?(?<!`)\1(?!`)/gu, (raw) => reserve(raw));
  const codeCount = entries.length;

  const closing = new Map([["\\(", "\\)"], ["\\[", "\\]"], ["$$", "$$"]]);
  const delimiters = [...working.matchAll(/\\[()[\]]|\$\$/gu)].filter(({ index }) => {
    let preceding = index;
    while (working[preceding - 1] === "\\") preceding -= 1;
    return (index - preceding) % 2 === 0;
  });
  let cursor = 0;
  let result = "";
  for (let index = 0; index < delimiters.length; index += 1) {
    const current = delimiters[index];
    const [opening] = current;
    const next = delimiters[index + 1];
    result += working.slice(cursor, current.index);
    cursor = current.index + opening.length;

    if (!next || closing.get(opening) !== next[0]) {
      issues.push({ type: "math", message: "An unmatched formula delimiter was preserved as text." });
      result += reserve(opening);
      continue;
    }

    const expression = working.slice(cursor, next.index);
    cursor = next.index + next[0].length;
    const raw = working.slice(current.index, cursor);
    index += 1;
    if (generated && !expression.trim()) {
      issues.push({ type: "math", message: "A generated formula is empty." });
      result += reserve(raw);
      continue;
    }
    try {
      const html = katex.renderToString(expression, {
        displayMode: opening !== "\\(", throwOnError: true, trust: false,
        strict: "ignore", output: "htmlAndMathml",
      });
      result += reserve(raw, html, true);
    } catch {
      issues.push({ type: "math", message: "Original formula could not be rendered; exact formula shown." });
      result += reserve(raw, `<code class="math-fallback">${escape(expression)}</code>`);
    }
  }
  result += working.slice(cursor);

  return {
    source: result,
    restoreCode(value) {
      return value.replace(markerPattern, (key, rawIndex) =>
        Number(rawIndex) < codeCount ? entries[Number(rawIndex)].raw : key);
    },
    restoreAttribute(value) {
      return value.replace(markerPattern, (key, rawIndex) => entries[Number(rawIndex)]?.raw ?? key);
    },
    renderText(value) {
      return value.replace(markerPattern, (key, rawIndex) => {
        const entry = entries[Number(rawIndex)];
        if (!entry) return key;
        if (entry.rendered) count += 1;
        return entry.html;
      });
    },
    count: () => count,
  };
}
