import fs from "node:fs";

const file = new URL("../data/courses.json", import.meta.url);
const courses = JSON.parse(fs.readFileSync(file, "utf8"));
const required = [
  "day",
  "module",
  "chineseName",
  "englishName",
  "discipline",
  "definition",
  "intuition",
  "case",
  "application",
  "connections",
  "pitfall",
  "exercise"
];

if (!Array.isArray(courses)) {
  throw new Error("courses.json must be an array.");
}

const seenDays = new Set();
const seenNames = new Set();

courses.forEach((course, index) => {
  for (const key of required) {
    if (!(key in course)) throw new Error(`Course ${index + 1} is missing ${key}.`);
  }
  if (!Number.isInteger(course.day) || course.day < 1) {
    throw new Error(`Course ${index + 1} has an invalid day.`);
  }
  if (seenDays.has(course.day)) throw new Error(`Duplicate day: ${course.day}.`);
  seenDays.add(course.day);

  const nameKey = `${course.chineseName}|${course.englishName}`.toLowerCase();
  if (seenNames.has(nameKey)) throw new Error(`Duplicate course name: ${nameKey}.`);
  seenNames.add(nameKey);
});

const days = courses.map((course) => course.day).sort((a, b) => a - b);
days.forEach((day, index) => {
  if (day !== index + 1) throw new Error(`Days must be continuous. Expected ${index + 1}, got ${day}.`);
});

console.log(`Validated ${courses.length} courses.`);
