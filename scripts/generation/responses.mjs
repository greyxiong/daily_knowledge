import { setTimeout as sleep } from "node:timers/promises";

const endpoint = "https://api.openai.com/v1/responses";
const searchLimit = 5;
const requestLimit = 350_000;
const responseLimit = 2_000_000;

export class GenerationError extends Error {
  constructor(code, phase) {
    super(code);
    this.code = code;
    this.phase = phase;
  }
}

export function evidenceUrl(value) {
  if (typeof value !== "string" || /[\s()<>"\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port) return url.href;
  } catch {
    return null;
  }
  return null;
}

function usageCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function resultFrom(output, phase, search) {
  if (output.status !== "completed" || !Array.isArray(output.output)) {
    throw new GenerationError("API_OUTPUT_REJECTED", phase);
  }
  const messages = output.output.filter((item) =>
    item?.type === "message" && item.role === "assistant" && item.phase !== "commentary",
  );
  const content = messages.flatMap((message) => Array.isArray(message.content) ? message.content : []);
  const parts = content.filter((part) => part?.type === "output_text");
  if (messages.some((message) => message.status !== "completed") ||
      content.some((part) => part?.type === "refusal") || parts.length !== 1) {
    throw new GenerationError("API_OUTPUT_REJECTED", phase);
  }
  const searches = output.output.filter((item) => item?.type === "web_search_call" && item.status === "completed");
  const sources = new Set(searches.flatMap((item) => {
    const list = item.action?.sources;
    return Array.isArray(list) ? list.map((source) => evidenceUrl(source?.url)).filter(Boolean) : [];
  }));
  const openedUrls = new Set(searches
    .filter(({ action }) => action?.type === "open_page")
    .map(({ action }) => evidenceUrl(action.url))
    .filter(Boolean));
  for (const url of openedUrls) sources.add(url);
  if (search && searches.length > 0) {
    for (const annotation of Array.isArray(parts[0].annotations) ? parts[0].annotations : []) {
      const url = annotation?.type === "url_citation" && evidenceUrl(annotation.url);
      if (url) sources.add(url);
    }
  }
  try {
    return { data: JSON.parse(parts[0].text), sources, openedUrls };
  } catch {
    throw new GenerationError("API_OUTPUT_REJECTED", phase);
  }
}

export function responsesClient({ apiKey, model, fetch, log, retryDelayMs }) {
  return async function request({ phase, schema, instructions, input, maxOutputTokens, search = false }) {
    const body = JSON.stringify({
      model,
      instructions,
      input: JSON.stringify(input),
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_schema", name: `course_${phase}`, strict: true, schema } },
      ...(search && {
        tools: [{ type: "web_search" }],
        max_tool_calls: searchLimit,
        include: ["web_search_call.action.sources"],
      }),
    });
    if (Buffer.byteLength(body) > requestLimit) throw new GenerationError("CONTEXT_LIMIT", phase);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let response;
      let raw;
      let tooLarge = false;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(120_000),
          redirect: "error",
          body,
        });
        if (response.ok) {
          const decoder = new TextDecoder();
          let bytes = 0;
          raw = "";
          for await (const chunk of response.body) {
            bytes += chunk.byteLength;
            if (bytes > responseLimit) {
              tooLarge = true;
              break;
            }
            raw += decoder.decode(chunk, { stream: true });
          }
          raw += decoder.decode();
        } else {
          await response.body?.cancel();
        }
      } catch {
        if (response?.ok) response = undefined;
      }
      if (response?.ok && typeof raw === "string") {
        let parsed;
        try {
          if (tooLarge) throw new Error();
          parsed = JSON.parse(raw);
        } catch {
          throw new GenerationError("API_OUTPUT_REJECTED", phase);
        }
        const usage = parsed?.usage;
        const searchCalls = Array.isArray(parsed?.output)
          ? parsed.output.filter((item) => item?.type === "web_search_call").length
          : null;
        log({
          event: "api_usage", phase, attempt,
          inputTokens: usageCount(usage?.input_tokens),
          outputTokens: usageCount(usage?.output_tokens),
          totalTokens: usageCount(usage?.total_tokens),
          searchCalls,
        });
        if (!parsed || (searchCalls !== null && searchCalls > (search ? searchLimit : 0))) {
          throw new GenerationError("API_OUTPUT_REJECTED", phase);
        }
        return resultFrom(parsed, phase, search);
      }
      const status = Number.isInteger(response?.status) ? response.status : null;
      const retryable = status === null || status === 408 || status === 429 || status >= 500;
      if (!retryable) throw new GenerationError(status === 401 || status === 403 ? "API_ACCESS_DENIED" : "API_REQUEST_REJECTED", phase);
      log({ event: "api_retryable_failure", phase, attempt, httpStatus: status });
      if (attempt < 3) await sleep(retryDelayMs * 2 ** (attempt - 1));
    }
    throw new GenerationError("API_UNAVAILABLE", phase);
  };
}
