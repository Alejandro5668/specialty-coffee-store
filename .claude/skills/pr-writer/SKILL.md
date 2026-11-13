---
name: pr-writer
description: "Trigger: pull request, PR, open PR, PR description, commit title. Write the PR title in English and the description in Spanish."
license: Apache-2.0
metadata:
  author: "Alejandro5668"
  version: "1.0"
---

## Activation Contract

Load when drafting a PR title/description or a commit message for this repo.

## Hard Rules

- Title: English, Conventional Commits, imperative, under 72 chars (`feat: add checkout use case`).
- Description: Spanish, short and precise, using `assets/pr-template.md`.
- Never add AI attribution: no `Co-Authored-By`, no "Generated with", no tool names or marks.
- Never mention the payment provider's company name.
- Never push, merge or open the PR without owner approval.

## Decision Gates

| Situation | Action |
|---|---|
| Behavior changed | Mention the README/docs updated in Cambios |
| No criterion applies | Write "Ninguno (chore/docs)" |

## Execution Steps

1. Read `git log main..HEAD --oneline` and `git diff main --stat`.
2. Map changes to boxes in `docs/ACCEPTANCE_CRITERIA.md`.
3. Fill the template; keep each bullet to one line.
4. Run `grep -iE "co-authored|generated with|claude"` on the draft; remove any hit.

## Output Contract

Return the title, then the Spanish description. Nothing else.

## References

- `assets/pr-template.md`
- `CLAUDE.md` (Git and pull requests)
