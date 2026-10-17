// Shared Google Gemma helper (Gemini API, generateContent). Key only from env GEMINI_API_KEY.
// Gemma-only: gemma-4-31b-it and gemma-4-26b-a4b-it are tried in parallel; first valid answer wins.
const MODELS = [process.env.GEMMA_MODEL, "gemma-4-31b-it", "gemma-4-26b-a4b-it"].filter(Boolean)
  .filter((m, i, a) => a.indexOf(m) === i);
const TIMEOUT_MS = 25000;
const ENDPOINT = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

function parseJSON(text) {
  let t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch {}
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s !== -1 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch {} }
  throw new Error("Model returned invalid JSON");
}

// prompt: full instructions + data in a single user turn (Gemma has no system role / JSON mode).
// The Gemini API often answers Gemma calls with a fast 500/503 or stalls, so we "hedge": both Gemma
// models run in parallel lanes, each retrying with a short backoff, and the first valid JSON wins.
const BUDGET_MS = 50000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function callOnce(model, prompt, maxOutputTokens, signal) {
  const t0 = Date.now();
  const r = await fetch(ENDPOINT(model), {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens, thinkingConfig: { thinkingLevel: "minimal" } },
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(r.status === 429 ? "Gemma free-tier rate limit reached, try again in a minute" : (j.error?.message || `Gemma error ${r.status}`)), { status: r.status });
  const text = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  const data = parseJSON(text);
  console.log("[gemma]", model, `${Date.now() - t0}ms`);
  return { data, model };
}
// Free tier is ~16k input tokens/min per model, so retries are capped and 429 stops the lane.
const MAX_TRIES = 3;
async function lane(model, prompt, maxOutputTokens, ctrl, start) {
  let last;
  for (let attempt = 0; attempt < MAX_TRIES && Date.now() - start < BUDGET_MS - 3000 && !ctrl.signal.aborted; attempt++) {
    try { return await callOnce(model, prompt, maxOutputTokens, ctrl.signal); }
    catch (e) {
      last = e;
      if (ctrl.signal.aborted) break;
      console.warn("[gemma]", model, e.status || e.name, String(e.message).split("\n")[0].slice(0, 120));
      if ([400, 401, 403, 429].includes(e.status)) break; // bad request/key or quota: retrying won't help
      await sleep(800 + attempt * 700);
    }
  }
  throw last || new Error("Gemma timed out");
}
async function gemmaJSON(prompt, maxOutputTokens = 1500) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error("Server missing GEMINI_API_KEY"), { status: 500 });
  const ctrl = new AbortController(), start = Date.now();
  const kill = setTimeout(() => ctrl.abort(), BUDGET_MS);
  try { return await Promise.any(MODELS.map((m) => lane(m, prompt, maxOutputTokens, ctrl, start))); }
  catch (e) { const errs = e.errors || [e]; const err = errs.find((x) => x?.status === 429) || errs.find((x) => x?.status && x.status !== 500) || errs.find((x) => x && x.message) || e; throw Object.assign(new Error(err.message || "Gemma error"), { status: 502 }); }
  finally { clearTimeout(kill); ctrl.abort(); }
}
// Map raw model ids to a friendly label for UIs.
const modelLabel = (m) => `Google Gemma 4 (${m})`;
const readBody = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
module.exports = { gemmaJSON, readBody, modelLabel, MODELS };
