import fs from "node:fs";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: node scripts/import-existing.mjs <html-file>");

const html = fs.readFileSync(sourcePath, "utf8");
const articles = [...html.matchAll(/<article class="lesson" id="day-(\d+)"[\s\S]*?<\/article>/g)];

function text(value = "") {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&ldquo;|&rdquo;/g, "\"")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(pattern, body) {
  const match = body.match(pattern);
  return match ? text(match[1]) : "";
}

const courses = articles.map((articleMatch) => {
  const day = Number(articleMatch[1]);
  const body = articleMatch[0];
  const eyebrow = pick(/<p class="eyebrow">([\s\S]*?)<\/p>/, body);
  const module = eyebrow.split("·").slice(1).join("·").trim();
  const heading = body.match(/<h2>([\s\S]*?)<span>([\s\S]*?)<\/span><\/h2>/);
  const gridSections = [...body.matchAll(/<section>\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/section>/g)];

  return {
    day,
    module,
    chineseName: heading ? text(heading[1]) : "",
    englishName: heading ? text(heading[2]) : "",
    discipline: module,
    definition: pick(/<div class="one-line"><strong>一句话：<\/strong>([\s\S]*?)<\/div>/, body),
    intuition: gridSections[0] ? text(gridSections[0][2]) : "",
    case: "",
    application: gridSections[1] ? text(gridSections[1][2]) : "",
    connections: "",
    pitfall: "",
    exercise: pick(/<section class="exercise">\s*<h3>小练习<\/h3>\s*<p>([\s\S]*?)<\/p>/, body),
    importedFromHtml: true
  };
});

fs.writeFileSync(new URL("../data/courses.json", import.meta.url), `${JSON.stringify(courses, null, 2)}\n`);
console.log(`Imported ${courses.length} courses.`);
