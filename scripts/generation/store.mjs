import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { GenerationError } from "./responses.mjs";

const formatter = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Shanghai",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
});

export const historicalCount = 70;
export const indexPath = "data/lesson-index.json";
export const lessonPath = (day) => `content/lessons/day-${String(day).padStart(3, "0")}.md`;
export const checksum = (value) => createHash("sha256").update(value).digest("hex");

function isDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function publicationDate(now, date, allowEarly) {
  const { year, month, day, hour } = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${year}-${month}-${day}`;
  const target = date ?? today;
  if (!isDate(target) || target > today) throw new GenerationError("INVALID_DATE", "schedule");
  if (Number(hour) < 12 && target === today && !allowEarly) throw new GenerationError("TOO_EARLY", "schedule");
  return target;
}

export async function readPublication(root) {
  try {
    const file = join(root, indexPath);
    const original = await readFile(file);
    const records = JSON.parse(original);
    if (!Array.isArray(records) || records.length < historicalCount) throw new Error();
    const dates = new Set();
    for (const [offset, record] of records.entries()) {
      const day = offset + 1;
      const historic = day <= historicalCount;
      if (record.day !== day || record.path !== lessonPath(day) ||
          record.source !== (historic ? "history" : "generated") ||
          !isDate(record.publishedOn) || !Array.isArray(record.sources) ||
          !["title", "chineseName", "englishName", "module", "discipline"].every((key) => typeof record[key] === "string") ||
          !record.title.trim() || !record.chineseName.trim() || !record.module.trim() || !record.discipline.trim() ||
          (historic ? typeof record.messageId !== "string" || !record.messageId : "messageId" in record || dates.has(record.publishedOn))) {
        throw new Error();
      }
      if (checksum(await readFile(join(root, record.path))) !== record.sha256) throw new Error();
      if (!historic) dates.add(record.publishedOn);
    }
    return { original, records };
  } catch {
    throw new GenerationError("INVALID_INDEX", "read");
  }
}

export async function withPublicationLock(root, run) {
  const directory = join(root, "data", ".lesson-publication.lock");
  try {
    await mkdir(directory);
  } catch (error) {
    throw new GenerationError(error.code === "EEXIST" ? "PUBLICATION_LOCKED" : "PUBLISH_WRITE_FAILED", "write");
  }
  try {
    return await run();
  } finally {
    await rmdir(directory);
  }
}

async function removeIfPresent(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function publishLesson(root, publication, record, markdown) {
  const index = join(root, indexPath);
  const lesson = join(root, record.path);
  const nonce = randomUUID();
  const stagedIndex = `${index}.${nonce}.tmp`;
  const stagedLesson = `${lesson}.${nonce}.tmp`;
  let lessonLinked = false;
  try {
    await writeFile(stagedIndex, `${JSON.stringify([...publication.records, record], null, 2)}\n`, { flag: "wx", flush: true });
    await writeFile(stagedLesson, markdown, { flag: "wx", flush: true });
    if (!(await readFile(index)).equals(publication.original)) throw new Error();
    await link(stagedLesson, lesson);
    lessonLinked = true;
    await unlink(stagedLesson);
    await rename(stagedIndex, index);
  } catch {
    try {
      if (lessonLinked) await removeIfPresent(lesson);
      await removeIfPresent(stagedLesson);
      await removeIfPresent(stagedIndex);
    } catch {
      throw new GenerationError("PUBLISH_ROLLBACK_FAILED", "write");
    }
    throw new GenerationError("PUBLISH_WRITE_FAILED", "write");
  }
}

export async function writePreview(root, day, date, markdown) {
  const work = join(root, "work");
  const directory = join(work, "daily-course-dry-run");
  const file = join(directory, `${date}-day-${day}.md`);
  const staged = `${file}.${randomUUID()}.tmp`;
  try {
    for (const path of [work, directory]) {
      try {
        await mkdir(path);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      if (!(await lstat(path)).isDirectory()) throw new Error();
    }
    if (await realpath(directory) !== join(await realpath(root), "work", "daily-course-dry-run")) throw new Error();
    await writeFile(staged, markdown, { flag: "wx", flush: true });
    await rename(staged, file);
  } catch {
    await removeIfPresent(staged).catch(() => {});
    throw new GenerationError("PREVIEW_WRITE_FAILED", "write");
  }
  return relative(root, file);
}
