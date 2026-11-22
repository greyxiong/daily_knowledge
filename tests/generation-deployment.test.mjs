import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const commit = "9ad243a088cc3d801ab038077ed2e6ea75667af9";
const repo = "greyxiong/daily_knowledge";
const endpoint = `https://api.github.com/repos/${repo}/commits/${commit}/status`;
const project = "https://vercel.com/xiongjy517-7913s-projects/daily-knowledge/";
const oldProject = "https://vercel.com/xiongjy517-7913s-projects/other-site/";
const status = (state, target_url = `${project}deployment`) => ({ context: "Vercel", state, target_url });
const response = (statuses, sha = commit) => Response.json({ statuses, sha });
const hook = "https://api.vercel.com/v1/integrations/deploy/prj_example/hook_example";

async function verify(options) {
  const { confirmDeployment } = await import("../scripts/generation/deployment.mjs");
  return confirmDeployment({ commit, repo, token: "fake-github-token", day: 71, lessonSha, intervalMs: 0, attempts: 3, ...options });
}

test("only exact commit status from the current Vercel project confirms deployment", async () => {
  let count = 0;
  const result = await verify({
    fetch: async (url) => {
      if (url.startsWith(production)) return manifest(commit);
      assert.equal(url, endpoint);
      count += 1;
      if (count === 1) return response([status("success", oldProject)], commit);
      if (count === 2) return response([status("success")], "b".repeat(40));
      return response([status("success")]);
    },
  });
  assert.equal(count, 3);
  assert.deepEqual(result, { status: "deployed", commit });
});

test("a Vercel failure and an unreported deployment both fail verification", async () => {
  await assert.rejects(verify({ fetch: async () => response([status("error")]) }), { code: "DEPLOYMENT_FAILED" });
  await assert.rejects(verify({ fetch: async () => response([]) }), { code: "DEPLOYMENT_UNCONFIRMED" });
});

test("a configured hook cannot deploy a different commit from the branch head", async () => {
  await assert.rejects(verify({
    hook, hookAfter: 1,
    fetch: async (url) => {
      if (url === endpoint) return response([]);
      if (url.startsWith(production)) return new Response(null, {status: 404});
      if (url.endsWith("/git/ref/heads/main")) return Response.json({ object: { sha: "b".repeat(40) } });
      assert.fail("A deploy hook must never receive a different main commit.");
    },
  }), { code: "DEPLOYMENT_UNCONFIRMED" });
});

test("an accepted hook still requires a confirmed GitHub commit status", async () => {
  let hookCalls = 0;
  await assert.rejects(verify({
    hook, hookAfter: 1,
    fetch: async (url, options) => {
      if (url === endpoint) return response([]);
      if (url.startsWith(production)) return new Response(null, {status: 404});
      if (url.endsWith("/git/ref/heads/main")) return Response.json({ object: { sha: commit } });
      assert.equal(url, hook);
      assert.equal(options.method, "POST");
      assert.equal(options.headers, undefined);
      hookCalls += 1;
      return Response.json({ job: { state: "PENDING" } });
    },
  }), { code: "DEPLOYMENT_UNCONFIRMED" });
  assert.equal(hookCalls, 1);
});

const production = "https://daily-knowledge-xiongjy517-7913s-projects.vercel.app";
const lessonSha = "a".repeat(64);
const newer = "b".repeat(40);
const manifest = (sha, lessons = [{ day: 71, sha256: lessonSha }]) => Response.json({ commit: sha, lessons });

test("a protected production alias can be verified with its automation secret", async () => {
  const bypass = "fake-vercel-automation-secret";
  let authenticatedReads = 0;
  const result = await verify({
    protectionBypass: bypass,
    fetch: async (url, options) => {
      if (url === endpoint) {
        assert.equal(options.headers["x-vercel-protection-bypass"], undefined);
        return response([status("success")]);
      }
      assert.equal(new URL(url).origin, production);
      assert.equal(options.redirect, "manual");
      if (options.headers["x-vercel-protection-bypass"] !== bypass) {
        return new Response(null, { status: 401 });
      }
      authenticatedReads += 1;
      return manifest(commit);
    },
  });
  assert.equal(authenticatedReads, 1);
  assert.deepEqual(result, { status: "deployed", commit });
});

test("Vercel authentication reports a configuration error without retrying or weakening protection", async () => {
  for (const httpStatus of [401, 403, 307]) {
    let reads = 0;
    await assert.rejects(verify({
      fetch: async (url) => {
        if (url === endpoint) return response([status("success")]);
        assert.equal(new URL(url).origin, production);
        reads += 1;
        return new Response(null, { status: httpStatus,
          headers: { Location: "https://vercel.com/sso-api?url=protected" } });
      },
    }), { code: "PRODUCTION_AUTH_REQUIRED" });
    assert.equal(reads, 1);
  }
});

test("a successful preview status does not prove that the production URL serves the commit", async () => {
  let productionReads = 0;
  await assert.rejects(verify({
    day: 71, lessonSha,
    fetch: async (url, options) => {
      if (url === endpoint) return response([status("success")]);
      if (url.startsWith(production)) {
        const marker = new URL(url);
        assert.equal(marker.origin, production);
        assert.equal(marker.pathname, "/deployment.json");
        assert.ok(marker.searchParams.has("nonce"));
        assert.equal(options.cache, "no-store");
        assert.equal(options.headers?.Authorization, undefined);
        productionReads += 1;
        return new Response(null, { status: 404 });
      }
      assert.fail("Unexpected HTTP destination");
    },
  }), { code: "DEPLOYMENT_UNCONFIRMED" });
  assert.equal(productionReads, 3);
});

test("a superseded publication is already included only when the production index has the exact lesson hash", async () => {
  for (const [hash, included] of [[lessonSha, true], ["c".repeat(64), false]]) {
    const operation = verify({
      day: 71, lessonSha,
      fetch: async (url) => {
        if (url === endpoint) return response([status("success")]);
        if (url.startsWith(production)) return manifest(newer, [{ day: 71, sha256: hash }]);
        if (url.endsWith(`/compare/${commit}...${newer}`)) return Response.json({ status: "ahead" });
        assert.fail("Unexpected HTTP destination");
      },
    });
    if (included) assert.deepEqual(await operation, { status: "already-included", commit: newer });
    else await assert.rejects(operation, { code: "PRODUCTION_LESSON_MISMATCH" });
  }
});

test("recovery verifies the original committed lesson even if a later revision edits it", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "publication-recovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "-q");
  const lessonPath = "day-071.md";
  const original = "Original lesson markdown.\n\n";
  const changed = "Edited lesson markdown.\n";
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  async function commitLesson(body) {
    await writeFile(join(root, lessonPath), body);
    git("add", "--", lessonPath);
    git("-c", "user.email=fixture@example.test", "-c", "user.name=Fixture", "-c", "commit.gpgsign=false",
      "-c", "core.hooksPath=/dev/null", "commit", "-qm", "Publish test lesson");
    return git("rev-parse", "HEAD");
  }
  const originalSha = await commitLesson(original);
  const editedSha = await commitLesson(changed);
  const workflow = await readFile(new URL("../.github/workflows/daily-course.yml", import.meta.url), "utf8");
  const commitStep = workflow.split(/^ {6}- /m).find((step) => /^ {8}id: commit$/m.test(step));
  const script = commitStep.split("\n        run: |\n")[1].replace(/^ {10}/gm, "");
  const output = join(root, "github-output");
  execFileSync("bash", ["-e", "-c", script], {
    cwd: root,
    env: { ...process.env, STATUS: "existing", COURSE_DAY: "71", LESSON_PATH: lessonPath,
      GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: join(root, "github-summary") },
    stdio: "pipe",
  });
  const written = Object.fromEntries((await readFile(output, "utf8")).trimEnd().split("\n").map((line) => line.split("=")));
  assert.equal(written.sha, originalSha);
  assert.equal(written.lesson_hash, hash(original));
  await assert.rejects(verify({
    commit: written.sha, lessonSha: written.lesson_hash,
    fetch: async (url) => {
      if (url.startsWith(production)) return manifest(editedSha, [{ day: 71, sha256: hash(changed) }]);
      if (url.endsWith(`/commits/${originalSha}/status`)) return response([status("success")], originalSha);
      if (url.endsWith(`/compare/${originalSha}...${editedSha}`)) return Response.json({ status: "ahead" });
      assert.fail("Unexpected HTTP destination");
    },
  }), { code: "PRODUCTION_LESSON_MISMATCH" });
});
