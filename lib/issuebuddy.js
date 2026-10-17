// Shared IssueBuddy logic used by the Vercel API routes (api/*.js) and the CLI (cli.js).
// GitHub public REST API for issues + Google Gemma 4 (via the Gemini API) for ranking and plans.
const { gemmaJSON } = require("../api/_gemma");
const LABELS = ["good first issue", "hacktoberfest", "help wanted", "documentation"];
const MAX_ISSUES = 15;

function parseRepo(v) {
  const m = String(v || "").trim().replace(/\.git$/, "").match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)/i);
  return m ? `${m[1]}/${m[2]}` : null;
}
async function gh(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "issuebuddy" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch("https://api.github.com" + path, { headers });
  if (r.status === 403 || r.status === 429) throw new Error("GitHub API rate limit reached (60/hour without GITHUB_TOKEN). Try again later.");
  if (r.status === 404) throw new Error("Repo not found. Check owner/name (it must be public).");
  if (!r.ok) throw new Error(`GitHub error ${r.status}`);
  return r.json();
}
// Open, beginner-friendly issues (deduped, unassigned first, capped at 15).
async function fetchIssues(repo) {
  const lists = await Promise.all(LABELS.map((l) =>
    gh(`/repos/${repo}/issues?state=open&per_page=15&labels=${encodeURIComponent(l)}`)
      .catch((e) => { if (/limit|not found/i.test(e.message)) throw e; return []; })));
  const map = new Map();
  lists.flat().filter((i) => !i.pull_request).forEach((i) => map.set(i.number, {
    number: i.number, title: i.title, url: i.html_url, body: (i.body || "").slice(0, 3000), comments: i.comments,
    assigned: !!(i.assignee || (i.assignees || []).length), labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
  }));
  return [...map.values()].sort((a, b) => a.assigned - b.assigned).slice(0, MAX_ISSUES);
}
async function fetchIssue(repo, number) {
  const i = await gh(`/repos/${repo}/issues/${number}`);
  return { number: i.number, title: i.title, url: i.html_url, body: (i.body || "").slice(0, 3000), comments: i.comments,
    assigned: !!(i.assignee || (i.assignees || []).length), labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)) };
}

// -> { ranked:[{number,score,difficulty,reason}], model }
async function rankIssues({ skills = [], repo = "", issues = [], level = "beginner" }) {
  const list = issues.slice(0, MAX_ISSUES).map((i) => ({
    number: i.number, title: String(i.title || "").slice(0, 200),
    labels: (i.labels || []).slice(0, 8), body: String(i.body || "").slice(0, 250),
  }));
  const lvl = level === "intermediate" ? "an intermediate contributor (prefer Medium issues with real code changes)" : "a first-time beginner contributor (prefer Easy issues)";
  const { data, model } = await gemmaJSON(
    `You help open-source contributors pick issues. The contributor is ${lvl}. Reply ONLY with JSON: {"ranked":[{"number":int,"score":0-100,"difficulty":"Easy"|"Medium"|"Hard","reason":"one short sentence, mention which skill fits"}]}. Include every issue, sorted by score desc (best fit for the contributor's skills and level first). No markdown, no code fences.\n\n` +
    `Contributor skills: ${skills.join(", ") || "any"}\nRepo: ${repo}\nIssues:\n${JSON.stringify(list)}`,
    3000);
  const ranked = (data.ranked || []).filter((r) => list.some((i) => i.number === r.number));
  return { ranked, model };
}

// -> { summary, steps[], files[], tests[], branch, commit, pr_title, pr_body, model }
async function planIssue({ skills = [], repo = "", issue }) {
  const { data, model } = await gemmaJSON(
    "You are a friendly open-source mentor. Create a concrete contribution plan for a beginner. Reply ONLY with JSON: {\"summary\":\"2 sentences\",\"steps\":[\"...\"],\"files\":[\"likely file paths or areas (say 'likely')\"],\"tests\":[\"how to verify\"],\"branch\":\"a real descriptive branch name like docs/vector-w-field\",\"commit\":\"conventional commit message\",\"pr_title\":\"...\",\"pr_body\":\"markdown PR description that includes 'Fixes #N'\"}. Steps must cover: comment on the issue to ask for assignment, fork, clone, create branch, make change, run tests/lint, commit, push, open PR. Keep 7-10 steps, each one line. No markdown fences around the JSON.\n\n" +
    `Repo: ${repo}\nMy skills: ${skills.join(", ") || "any"}\nIssue #${issue.number}: ${String(issue.title).slice(0, 200)}\nLabels: ${(issue.labels || []).join(", ")}\nBody:\n${String(issue.body || "").slice(0, 2500)}`,
    2000);
  return { ...data, model };
}
module.exports = { LABELS, MAX_ISSUES, parseRepo, fetchIssues, fetchIssue, rankIssues, planIssue };
