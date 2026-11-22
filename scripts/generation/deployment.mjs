import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { GenerationError } from "./responses.mjs";

const productionOrigin = "https://daily-knowledge-xiongjy517-7913s-projects.vercel.app";
const gitSha = /^[0-9a-f]{40}$/u;
const sha256 = /^[0-9a-f]{64}$/u;
const projectPath = "/xiongjy517-7913s-projects/daily-knowledge/";
const deploymentError = (code) => new GenerationError(code, "deployment");

function projectStatus(status) {
  if (status?.context !== "Vercel") return false;
  try {
    const target = new URL(status.target_url);
    return target.origin === "https://vercel.com" && target.pathname.startsWith(projectPath);
  } catch {
    return false;
  }
}

function validHook(value) {
  try {
    const hook = new URL(value);
    return hook.origin === "https://api.vercel.com" &&
      /^\/v1\/integrations\/deploy\/[^/]+\/[^/]+$/u.test(hook.pathname) &&
      !hook.username && !hook.password && !hook.search && !hook.hash;
  } catch {
    return false;
  }
}

export async function confirmDeployment({
  commit,
  repo,
  token,
  day,
  lessonSha,
  hook,
  protectionBypass,
  fetch = globalThis.fetch,
  attempts = 33,
  hookAfter = 5,
  intervalMs = 15_000,
  log = () => {},
}) {
  if (!gitSha.test(commit) || !/^[\w.-]+\/[\w.-]+$/u.test(repo) || !token ||
      !Number.isSafeInteger(day) || day < 71 || !sha256.test(lessonSha)) {
    throw deploymentError("INVALID_DEPLOYMENT_CONFIGURATION");
  }
  if (hook && !validHook(hook)) throw deploymentError("INVALID_VERCEL_HOOK");
  const base = `https://api.github.com/repos/${repo}`;
  const githubOptions = () => ({
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    redirect: "error",
    signal: AbortSignal.timeout(6_000),
  });

  async function get(path) {
    try {
      const response = await fetch(base + path, githubOptions());
      if (response.ok) return await response.json();
      await response.body?.cancel();
    } catch {
      return undefined;
    }
    return undefined;
  }

  async function readProduction() {
    const url = new URL("/deployment.json", productionOrigin);
    url.searchParams.set("nonce", randomUUID());
    try {
      const response = await fetch(url.href, {
        cache: "no-store", headers: { "Cache-Control": "no-cache",
          ...(protectionBypass ? { "x-vercel-protection-bypass": protectionBypass } : {}) }, redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        const redirect = location ? new URL(location, url) : undefined;
        if ([401, 403].includes(response.status) ||
            (response.status >= 300 && response.status < 400 && redirect?.origin === "https://vercel.com" &&
             /^\/(?:login|sso-api)(?:\/|$)/u.test(redirect.pathname))) {
          throw deploymentError("PRODUCTION_AUTH_REQUIRED");
        }
        return undefined;
      }
      const manifest = await response.json();
      if (gitSha.test(manifest?.commit) && Array.isArray(manifest.lessons)) return manifest;
    } catch (error) {
      if (error instanceof GenerationError) throw error;
      return undefined;
    }
    return undefined;
  }

  const olderAliases = new Set();
  let hookConsidered = false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const combined = await get(`/commits/${commit}/status`);
    const matched = combined?.sha === commit && Array.isArray(combined.statuses)
      ? combined.statuses.find(projectStatus)
      : undefined;
    const production = await readProduction();
    if (production) {
      const servesLesson = production.lessons.some((lesson) => lesson?.day === day && lesson.sha256 === lessonSha);
      if (production.commit === commit) {
        if (!servesLesson) throw deploymentError("PRODUCTION_LESSON_MISMATCH");
        if (matched?.state === "success") return { status: "deployed", commit };
      } else if (!olderAliases.has(production.commit)) {
        const comparison = await get(`/compare/${commit}...${production.commit}`);
        if (comparison?.status === "ahead") {
          if (!servesLesson) throw deploymentError("PRODUCTION_LESSON_MISMATCH");
          return { status: "already-included", commit: production.commit };
        }
        if (comparison?.status) olderAliases.add(production.commit);
      }
    }
    const failed = matched?.state === "error" || matched?.state === "failure";
    if (hook && !hookConsidered && production?.commit !== commit && ((!matched && attempt >= hookAfter) || failed)) {
      hookConsidered = true;
      const main = await get("/git/ref/heads/main");
      if (main?.object?.sha === commit) {
        try {
          const response = await fetch(hook, {
            method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
          });
          await response.body?.cancel();
          if (!response.ok) throw new Error();
        } catch {
          throw deploymentError("VERCEL_HOOK_FAILED");
        }
        log("Vercel accepted a deployment request. Waiting for the commit status.");
      }
    } else if (failed && !hook) {
      throw deploymentError("DEPLOYMENT_FAILED");
    }
    if (attempt < attempts) await sleep(intervalMs);
  }

  throw deploymentError("DEPLOYMENT_UNCONFIRMED");
}

async function main() {
  const [commit, courseDay, lessonSha] = process.argv.slice(2);
  try {
    const result = await confirmDeployment({
      commit, day: Number(courseDay), lessonSha,
      repo: process.env.GITHUB_REPOSITORY,
      token: process.env.GH_TOKEN,
      hook: process.env.VERCEL_DEPLOY_HOOK,
      protectionBypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      log: (message) => console.error(message),
    });
    if (result.status === "already-included") {
      console.log(`The original production site already includes Day ${courseDay} in the newer deployment \`${result.commit}\`.`);
    } else {
      console.log(`The original production site serves Day ${courseDay} from commit \`${commit}\`.`);
    }
  } catch (error) {
    const code = error instanceof GenerationError ? error.code : "DEPLOYMENT_UNCONFIRMED";
    console.error(`::error::${code}. The lesson is on GitHub. Check the Vercel project for this commit before retrying.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
