# Contributing to IssueBuddy

Thanks for helping beginners find their first PR! 🎉

1. Comment on an issue to get it assigned to you.
2. Fork the repo, then `git checkout -b feat/short-name`.
3. Run `GEMINI_API_KEY=... node server.js` and test at http://localhost:3000.
4. Use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`).
5. Open a PR that describes what changed, includes a screenshot for UI changes, and says `Fixes #N`.

Keep it dependency-free and never commit API keys.

## 🌱 Good first issue ideas
| Idea | Skills | Notes |
|---|---|---|
| Light/dark theme toggle | CSS, JS | Add CSS variables for a light theme and save the choice in `localStorage`. |
| Remember selected skills | JS | Persist `state.skills` and the last repo in `localStorage`. |
| Optional GitHub token field | JS | Send the `Authorization` header to raise the rate limit from 60 to 5000/hr. Keep it in the browser only. |
| Filter by difficulty | JS, CSS | Add Easy/Medium/Hard filter chips above the results. |
| "Copy all" for the plan | JS | One button that copies the full plan as Markdown. |
| Hindi UI translation | Docs, i18n | Move UI strings into a dictionary and add `hi`. |
| More sample repos | Docs | Add repos that currently have open `good first issue` labels (verify them first). |
| Unit tests for `parseRepo` | Testing | Cover URL, `owner/repo` and `.git` inputs. |
