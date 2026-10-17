---
name: issuebuddy
description: Find and plan a beginner-friendly open-source issue in any public GitHub repository. Use when a user wants to make their first (or next) open-source contribution, asks "what issue can I work on in owner/repo", or wants a step-by-step plan, branch name, commit message and PR description for a GitHub issue. Ranks issues with Google Gemma 4 (open-weight) via the Gemini API.
license: MIT
compatibility: Requires Node.js 18+, network access to api.github.com and generativelanguage.googleapis.com, and a GEMINI_API_KEY environment variable. GITHUB_TOKEN is optional.
metadata:
  author: THE-AB-mark
  version: "1.0.0"
---

# IssueBuddy

Helps a contributor pick a good-first issue in a GitHub repo and turns it into a concrete contribution plan.
The bundled zero-dependency CLI (`cli.js` at the IssueBuddy repo root) does the GitHub lookups and calls Google Gemma 4.

## When to use
- The user wants to contribute to open source (e.g. Hacktoberfest) and asks which issue to pick in a repo.
- The user names an issue and wants steps, likely files, tests, a branch name, commit message and PR text.

## Prerequisites
- Node.js 18 or newer.
- `GEMINI_API_KEY` is set (free key: https://aistudio.google.com/apikey). Never print or commit the key.
- Optional `GITHUB_TOKEN`, which raises the GitHub limit from 60 requests/hour. Each search uses 4 requests.

## Setup (once)
Get the CLI by cloning https://github.com/THE-AB-mark/issuebuddy and running the commands from that folder. It has no `npm install` step. You can also run it without cloning: `npx -y github:THE-AB-mark/issuebuddy <owner/repo> ...` (the `issuebuddy` bin).

## Steps
1. Get the repo from the user as `owner/name` (a github.com URL also works). Ask for their skills and level if they're not known.
2. Rank the candidate issues:
   ```bash
   node cli.js <owner/repo> --level beginner --skills JavaScript,Docs --json
   ```
   The output is JSON: `{ repo, level, model, issues: [{ number, title, url, score, difficulty, reason, labels, assigned }] }`, sorted best fit first.
3. Show the user the top 3 to 5 issues with their score, difficulty and reason. Skip any marked `assigned: true` unless the user insists.
4. Once the user picks an issue (or you pick the top one), build the plan:
   ```bash
   node cli.js <owner/repo> --plan <issue-number> --skills JavaScript,Docs --json
   ```
   The output is JSON: `{ issue, plan: { summary, steps, files, tests, branch, commit, pr_title, pr_body, model } }`.
5. Present the plan. Remind the user to comment on the issue and ask to be assigned before starting, and to follow the repo's CONTRIBUTING guide.
6. If the user wants help coding the change, use `plan.branch` for the branch, `plan.commit` for the commit message, and `plan.pr_title` / `plan.pr_body` for the PR.

## Errors
- `{"error": "..."}` with exit code 1: report the message. Rate-limit errors mean you should wait a minute (Gemma free tier) or set `GITHUB_TOKEN` (GitHub).
- If AI ranking fails, the CLI still prints the issues unranked with `score: 0`.
- File paths in `plan.files` are guesses (marked "likely"), so check them in the repo before editing.
