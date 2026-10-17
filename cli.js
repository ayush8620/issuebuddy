#!/usr/bin/env node
// IssueBuddy CLI: find + plan a beginner-friendly issue in any public GitHub repo, using Google Gemma 4 (Gemini API).
// Usage: node cli.js <owner/repo> [--level beginner|intermediate] [--skills js,docs] [--plan <issue#>] [--json]
// Env: GEMINI_API_KEY (required), GITHUB_TOKEN (optional, raises the GitHub rate limit). Zero dependencies, Node 18+.
const { parseRepo, fetchIssues, fetchIssue, rankIssues, planIssue } = require("./lib/issuebuddy");

const HELP = `IssueBuddy: find your first PR in 60 seconds (AI by Google Gemma 4, open-weight)

Usage:
  node cli.js <owner/repo> [--level beginner|intermediate] [--skills JavaScript,Docs] [--json]
  node cli.js <owner/repo> --plan <issue#> [--skills ...] [--json]

Options:
  --level   beginner (default) or intermediate
  --skills  comma-separated skills to match (default: any)
  --plan    build a step-by-step contribution plan for one issue
  --json    print machine-readable JSON (for AI agents / scripts)
Env: GEMINI_API_KEY (required), GITHUB_TOKEN (optional)`;

function parseArgs(argv) {
  const o = { level: "beginner", skills: [], json: false, plan: null, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--level") o.level = argv[++i];
    else if (a === "--plan") o.plan = parseInt(String(argv[++i]).replace("#", ""), 10);
    else if (a === "--skills") o.skills = String(argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "-h" || a === "--help") o.help = true;
    else if (!o.repo) o.repo = a;
  }
  return o;
}
const fail = (msg, json) => { json ? console.log(JSON.stringify({ error: msg })) : console.error("Error: " + msg); process.exit(1); };

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.repo) { console.log(HELP); process.exit(o.help ? 0 : 1); }
  const repo = parseRepo(o.repo);
  if (!repo) fail("repo must look like owner/name or a github.com URL", o.json);
  if (!["beginner", "intermediate"].includes(o.level)) fail("--level must be beginner or intermediate", o.json);
  if (o.plan !== null && !Number.isInteger(o.plan)) fail("--plan needs an issue number", o.json);
  if (!process.env.GEMINI_API_KEY) fail("set GEMINI_API_KEY (free key: https://aistudio.google.com/apikey)", o.json);
  const log = (...a) => { if (!o.json) console.error(...a); };

  if (o.plan !== null) {
    log(`Planning ${repo}#${o.plan} with Google Gemma 4…`);
    const issue = await fetchIssue(repo, o.plan);
    const p = await planIssue({ skills: o.skills, repo, issue });
    if (o.json) return console.log(JSON.stringify({ repo, issue: { number: issue.number, title: issue.title, url: issue.url }, plan: p }, null, 2));
    const list = (a) => (a || []).map((x, i) => `  ${i + 1}. ${x}`).join("\n");
    console.log(`\n#${issue.number} ${issue.title}\n${issue.url}\n\n${p.summary}\n\nSteps:\n${list(p.steps)}\n\nFiles likely touched:\n${list(p.files)}\n\nHow to test:\n${list(p.tests)}\n`);
    console.log(`Branch:   git checkout -b ${p.branch}\nCommit:   ${p.commit}\nPR title: ${p.pr_title}\n\nPR body:\n${p.pr_body}\n\n(AI: Google Gemma 4, ${p.model})`);
    return;
  }

  log(`Fetching beginner-friendly issues from ${repo}…`);
  const issues = await fetchIssues(repo);
  if (!issues.length) fail(`no open good-first/help-wanted/docs issues in ${repo}`, o.json);
  log(`Ranking ${issues.length} issues for a ${o.level} with Google Gemma 4…`);
  let ranked = [], model = null;
  try { ({ ranked, model } = await rankIssues({ skills: o.skills, repo, issues, level: o.level })); }
  catch (e) { log(`AI ranking unavailable (${e.message}); showing issues unranked.`); }
  const by = new Map(ranked.map((r) => [r.number, r]));
  const rows = issues.map((i) => ({ number: i.number, title: i.title, url: i.url, labels: i.labels, assigned: i.assigned,
    ...(by.get(i.number) || { score: 0, difficulty: "", reason: "" }) })).sort((a, b) => b.score - a.score);
  if (o.json) return console.log(JSON.stringify({ repo, level: o.level, model, issues: rows }, null, 2));
  console.log("");
  rows.forEach((r) => console.log(`${String(r.score || "-").padStart(3)}  ${(r.difficulty || "?").padEnd(6)} #${r.number} ${r.title}${r.assigned ? " [assigned]" : ""}\n      ${r.reason || ""}\n      ${r.url}`));
  if (rows[0]) console.log(`\nNext: node cli.js ${repo} --plan ${rows[0].number}${model ? `   (AI: Google Gemma 4, ${model})` : ""}`);
}
main().catch((e) => fail(e.message || String(e), process.argv.includes("--json")));
