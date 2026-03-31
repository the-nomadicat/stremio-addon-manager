# AGENTS.md

## Repo Notes

- This repository lives under C:\vue.js and should use the 	he-nomadicat GitHub identity on ms-surface-1.
- Leave AGENTS.md repo-focused. Do not add machine-specific secrets or private credentials.

## GitHub Identity Policy

- For repositories under C:\vue.js, perform Git commit and push operations on ms-surface-1, not from a local temporary clone or local HTTPS checkout.
- Never use local temporary clones or local HTTPS pushes for this repository.
- Use the GitHub identity `the-nomadicat` configured on ms-surface-1.
- Keep the origin remote on SSH (git@github.com:owner/repo.git) rather than HTTPS.

## Git Push Safety

- Before committing or pushing, run git fetch origin, git status, and git branch -vv on ms-surface-1.
- If main or the working branch is behind or diverged from origin, reconcile that first. Do not create workaround history on main.
- If git push fails with non-fast-forward, stop and inspect branch history instead of using a local temp clone or local HTTPS push.
- Keep push history simple: commit on ms-surface-1, push from ms-surface-1, and keep the local branch aligned with origin before the next change.

