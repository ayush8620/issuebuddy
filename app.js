// IssueBuddy frontend: GitHub public REST API (browser) + /api/rank + /api/plan (Google Gemma via Gemini API).
const SKILLS = ["JavaScript", "TypeScript", "Python", "React", "CSS", "HTML", "Docs", "Java", "Go", "Rust", "C++", "Testing", "Design/UI"];
const SAMPLES = ["processing/p5.js", "excalidraw/excalidraw", "oppia/oppia"];
const LABELS = ["good first issue", "hacktoberfest", "help wanted", "documentation"];
const $ = (s) => document.querySelector(s);
const state = { skills: new Set(["JavaScript", "Docs"]), repo: "", issues: [] };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const icons = () => { try { window.lucide && lucide.createIcons(); } catch {} };
const ic = (n) => `<i data-lucide="${n}" aria-hidden="true"></i>`;
let notyf = null;
try { if (window.Notyf) notyf = new Notyf({ duration: 3500, position: { x: "right", y: "bottom" }, dismissible: true, ripple: false,
  types: [{ type: "info", background: "#8b5cf6", icon: false }] }); } catch {}
const toast = (msg, type = "success") => { try { notyf && notyf.open({ type, message: msg }); } catch {} };
const celebrate = () => { try { window.confetti && !matchMedia("(prefers-reduced-motion: reduce)").matches && confetti({ particleCount: 90, spread: 70, startVelocity: 35, origin: { y: 0.35 }, zIndex: 10000, colors: ["#ff8a3d", "#8b5cf6", "#22c55e", "#4285f4"] }); } catch {} };
let ticker = null;
function cycleStatus(msgs) {
  clearInterval(ticker); let k = 0; status(msgs[0], false, true);
  ticker = setInterval(() => { k = Math.min(k + 1, msgs.length - 1); status(msgs[k], false, true); if (k === msgs.length - 1) clearInterval(ticker); }, 3500);
}
const stopCycle = () => clearInterval(ticker);
const scoreClass = (n) => (n >= 80 ? "hi" : n >= 50 ? "mid" : "lo");
function closeModal() { if ($("#modal").classList.contains("hidden")) return; $("#modal").classList.add("hidden"); document.body.classList.remove("noscroll"); if (state.lastBtn) state.lastBtn.focus(); }

function renderChips() {
  $("#chips").innerHTML = SKILLS.map((s) => `<button class="chip ${state.skills.has(s) ? "on" : ""}" data-s="${s}" type="button" aria-pressed="${state.skills.has(s)}">${s}</button>`).join("");
}
$("#chips").onclick = (e) => { const s = e.target.closest("[data-s]")?.dataset.s; if (!s) return; state.skills.has(s) ? state.skills.delete(s) : state.skills.add(s); renderChips();
icons(); };
$("#samples").innerHTML = SAMPLES.map((r) => `<button type="button" data-r="${r}" aria-label="Try ${r}">${r}</button>`).join("");
$("#samples").onclick = (e) => { if (e.target.dataset.r) { $("#repo").value = e.target.dataset.r; find(); } };
$("#go").onclick = (e) => { e.preventDefault(); find(); };
$("#repo").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); find(); } };
$("#close").onclick = closeModal;
$("#modal").onclick = (e) => e.target.id === "modal" && closeModal();
document.onkeydown = (e) => e.key === "Escape" && closeModal();

function status(msg, err = false, spin = false) { $("#status").className = "status" + (err ? " err" : ""); $("#status").innerHTML = (spin ? '<span class="spin"></span>' : "") + msg; }
function parseRepo(v) {
  const m = v.trim().replace(/\.git$/, "").match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)/i);
  return m ? `${m[1]}/${m[2]}` : null;
}
async function gh(path) {
  const r = await fetch("https://api.github.com" + path, { headers: { Accept: "application/vnd.github+json" } });
  if (r.status === 403 || r.status === 429) {
    const reset = r.headers.get("x-ratelimit-reset");
    const mins = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : "a few";
    throw new Error(`GitHub's free API limit (60 requests/hour) was reached. Try again in ${mins} min.`);
  }
  if (r.status === 404) throw new Error("Repo not found. Check the owner/name (it must be public).");
  if (!r.ok) throw new Error(`GitHub error ${r.status}`);
  return r.json();
}
async function api(path, body, tries = 3) {
  for (let a = 1; ; a++) {
    let r;
    try {
      r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      if (a < tries) { await new Promise((ok) => setTimeout(ok, 1500 * a)); continue; }
      throw new Error("Network hiccup reaching the AI server. Please check your connection and try again.");
    }
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    if (r.status >= 500 && r.status !== 501 && a < tries) { await new Promise((ok) => setTimeout(ok, 1500 * a)); continue; }
    throw new Error(j.error || (r.status === 504 ? "Gemma took too long to answer. Please try again." : `Server error ${r.status}`));
  }
}

async function find() {
  const repo = parseRepo($("#repo").value);
  if (!repo) { toast("Enter a repo like owner/name", "error"); $("#repo").focus(); return status("Enter a repo like <b>owner/name</b> or a github.com URL.", true); }
  if ($("#go").disabled) return;
  state.repo = repo; $("#go").disabled = true;
  $("#results").innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  try {
    cycleStatus([`Fetching issues from <b>${esc(repo)}</b>…`, "Collecting good first issues…", "Still fetching from GitHub…"]);
    const lists = await Promise.all(LABELS.map((l) => gh(`/repos/${repo}/issues?state=open&per_page=15&labels=${encodeURIComponent(l)}`).catch((e) => { if (/limit|not found/.test(e.message)) throw e; return []; })));
    const map = new Map();
    lists.flat().filter((i) => !i.pull_request).forEach((i) => map.set(i.number, {
      number: i.number, title: i.title, url: i.html_url, body: (i.body || "").slice(0, 3000), comments: i.comments,
      assigned: !!(i.assignee || (i.assignees || []).length), labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
    }));
    state.issues = [...map.values()].sort((a, b) => a.assigned - b.assigned).slice(0, 15);
    if (!state.issues.length) { $("#results").innerHTML = ""; return status(`No open issues labelled ${LABELS.join(" / ")} in ${esc(repo)}. Try a sample repo.`, true); }
    const sk = esc([...state.skills].join(", ") || "any skill");
    cycleStatus([`Found ${state.issues.length} issues. Ranking with Gemma 4 for <b>${sk}</b>…`, "Gemma 4 is reading each issue…", "Scoring fit for your skills…", "Almost there…"]);
    let ranked = [], rankModel = "";
    try { ({ ranked, model: rankModel } = await api("/api/rank", { skills: [...state.skills], repo, issues: state.issues })); }
    catch (e) { stopCycle(); status(`AI ranking unavailable (${esc(e.message)}). Showing issues unranked.`, true); toast("AI ranking unavailable, showing issues unranked", "error"); }
    stopCycle();
    const byNum = new Map(ranked.map((r) => [r.number, r]));
    const rows = state.issues.map((i) => ({ ...i, ...(byNum.get(i.number) || { score: 0, difficulty: "", reason: "" }) })).sort((a, b) => b.score - a.score);
    render(rows);
    if (ranked.length) { toast(`${rows.length} issues ranked by Gemma 4`); status(`${ic("circle-check")} ${rows.length} issues ranked for you in <b>${esc(repo)}</b> by Google Gemma 4 (<code>${esc(rankModel || "gemma-4")}</code>). Click <b>Plan it</b> on one to start.`); icons(); }
  } catch (e) { stopCycle(); $("#results").innerHTML = ""; status(ic("triangle-alert") + " " + esc(e.message), true); icons(); toast(e.message, "error"); }
  finally { stopCycle(); $("#go").disabled = false; }
}

function render(rows) {
  $("#results").innerHTML = rows.map((i, n) => `
  <article class="issue" style="--d:${Math.min(n, 12) * 60}ms">
    <div class="score ${scoreClass(i.score || 0)}" style="--p:${i.score || 0}" title="Fit score" aria-label="Fit score ${i.score || "not ranked"} out of 100"><span>${i.score ? i.score : "–"}</span></div>
    <div>
      <h3><a href="${esc(i.url)}" target="_blank" rel="noopener">#${i.number} ${esc(i.title)}</a></h3>
      <div class="meta">${i.difficulty ? `<span class="tag diff ${esc(i.difficulty)}">${esc(i.difficulty)}</span>` : ""}${i.assigned ? '<span class="tag Hard">assigned</span>' : ""}${i.labels.slice(0, 4).map((l) => `<span class="tag">${esc(l)}</span>`).join("")}<span class="tag" aria-label="${i.comments} comments">${ic("message-circle")} ${i.comments}</span></div>
      ${i.reason ? `<p class="reason">${esc(i.reason)}</p>` : ""}
      <div class="actions"><button class="primary" data-plan="${i.number}" aria-label="Plan issue #${i.number}">${ic("map")} Plan it</button><a class="btn" href="${esc(i.url)}" target="_blank" rel="noopener" aria-label="Open issue #${i.number} on GitHub">${ic("github")} Open on GitHub ${ic("external-link")}</a></div>
    </div>
  </article>`).join("");
  icons();
}
$("#results").onclick = (e) => { const b = e.target.closest("[data-plan]"); if (b && !b.disabled) plan(+b.dataset.plan, b); };

async function plan(num, btn) {
  const issue = state.issues.find((i) => i.number === num);
  btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>Planning…'; state.lastBtn = btn;
  const msgs = ["Planning…", "Gemma 4 is thinking…", "Writing steps…", "Almost there…"]; let k = 0;
  const pt = setInterval(() => { k = Math.min(k + 1, msgs.length - 1); btn.innerHTML = `<span class="spin"></span>${msgs[k]}`; }, 4000);
  try {
    const p = await api("/api/plan", { skills: [...state.skills], repo: state.repo, issue });
    const li = (a) => (a || []).map((x) => `<li>${esc(x)}</li>`).join("");
    const block = (title, text) => `<div class="copyrow"><h4>${title}</h4><button class="copy" type="button" aria-label="Copy ${title}">${ic("copy")} Copy</button></div><pre>${esc(text)}</pre>`;
    $("#modalBody").innerHTML = `
      <h3 id="planTitle">${ic("map")} Plan for #${issue.number}: ${esc(issue.title)}</h3>
      <p class="reason">${esc(p.summary)}</p>
      <h4>${ic("list-ordered")} Steps</h4><ol>${li(p.steps)}</ol>
      <h4>${ic("file-code")} Files likely touched</h4><ul>${li(p.files)}</ul>
      <h4>${ic("flask-conical")} How to test</h4><ul>${li(p.tests)}</ul>
      ${block("Branch", `git checkout -b ${p.branch || "fix/issue-" + issue.number}`)}
      ${block("Commit message", p.commit || "")}
      ${block("PR title", p.pr_title || "")}
      ${block("PR description", p.pr_body || "")}
      <p class="reason" style="margin-top:14px;font-size:12px">AI-generated by Google Gemma 4 (<code>${esc(p.model || "gemma-4")}</code>) via the Gemini API. Always read the repo's CONTRIBUTING guide and ask to be assigned first.</p>`;
    $("#modalBody").querySelectorAll(".copy").forEach((b) => (b.onclick = async () => {
      const t = b.parentElement.nextElementSibling.textContent;
      const h = b.parentElement.querySelector("h4").textContent;
      try { await navigator.clipboard.writeText(t); b.innerHTML = `${ic("check")} Copied`; toast(`${h} copied`); } catch { b.textContent = "Select & copy"; toast("Couldn't access clipboard. Select the text and copy.", "error"); }
      icons(); setTimeout(() => { b.innerHTML = `${ic("copy")} Copy`; icons(); }, 1500);
    }));
    icons();
    $("#modal").classList.remove("hidden"); document.body.classList.add("noscroll");
    $(".sheet").scrollTop = 0; $("#close").focus();
    celebrate(); toast("Your plan is ready");
  } catch (e) { status(ic("triangle-alert") + " Couldn't build a plan: " + esc(e.message), true); icons(); toast("Couldn't build a plan: " + e.message, "error"); }
  finally { clearInterval(pt); btn.disabled = false; btn.innerHTML = old; icons(); }
}
renderChips();
icons();
