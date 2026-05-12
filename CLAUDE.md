## gstack
Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools directly.
Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`
## Prompting And Scope Discipline

- Keep agent work focused on the requested change and this repository's existing conventions.
- Preserve useful comments, whitespace, examples, and local warnings when editing instructions or code. Do not run broad cleanup or formatting unless it is part of the task.
- Before editing, inspect `git status --short --branch` and relevant project files. After editing, run the smallest meaningful build/test/check when practical.
- Use concise progress updates that state outcomes: what was found, changed, verified, or blocked.
- If a tool, browser, or auth flow is unsafe or unavailable, switch to the current safe path and explain the fallback briefly.
