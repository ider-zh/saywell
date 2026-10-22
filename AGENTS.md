# Saywell development

This repository is a local, Manifest V3 Chrome/Edge extension. Do not push, publish, or provision cloud services without explicit user authorization.

## Agent-led maintenance

- Agents own implementation through verification and delivery. Inspect the existing code and working tree first; preserve unrelated changes. Make routine, reversible implementation choices autonomously. Ask only for material missing requirements, account access or actions outside the user's authorization.
- A report that a feature does not work requires investigation and a concrete fix when possible, not just instructions for the user. Use synthetic reproductions; do not inspect private drafts or credentials to debug.
- State what changed, what was verified and what remains unverified. Never describe an untested implementation, running CI job, uploaded artifact or healthy status endpoint as a successful release or live inference test.
- Keep README.md user-facing and Chinese-first, with matching README.en.md. Installation, usage, privacy and troubleshooting belong there; build/test/architecture/CI/cloud operations belong in DEVELOPMENT.md or docs/. Update both languages when user-visible behavior changes.
- Keep package.json, package-lock.json and manifest.json versions aligned when changing the version. During an authorized release, choose the appropriate next patch/minor/major version from the change unless the user specified it; do not change a version merely to trigger CI. Never republish different bytes under an existing version. A requested release includes version consistency, tested installation ZIP, tag push and verification of the published asset.
- Ordinary branch pushes and pull requests run CI and upload temporary artifacts. A pushed v<version> tag matching both package and manifest versions publishes a GitHub Release only after checks pass. Never move a published tag or overwrite published assets silently. Do not create/push release tags unless a release is authorized.
- GitHub Release, Chrome Web Store draft upload, review submission, store publication and Cloudflare deployment are distinct actions. Authorization for one does not authorize the others. Preserve an explicit "do not submit for review" instruction until the user changes it. The owner explicitly requested automated Chrome Web Store publication on 2026-10-22: use the separate store workflow with scoped short-lived credentials, matching tested version tags and an explicit CWS_ENABLED activation after account setup. Ordinary branch/PR builds must never publish. Cloudflare deployment remains separately authorized.
- When source pushes are authorized, push the completed changes and inspect the CI result. If CI fails, investigate and repair within scope. Keep release write permissions isolated from ordinary build/PR jobs; pin third-party Actions to verified commit SHAs.
- For external setup that needs the owner, give the exact page, required non-secret identifiers and remaining steps. Keep tokens, passwords, service-account keys and refresh tokens out of chat, repository files, logs and downloadable artifacts. Prefer short-lived CI credentials when supported.
- Add regression coverage for meaningful defects and security/performance boundaries. Do not add tests that only duplicate simple text or styling edits. Run the required check/package commands and visually inspect changed UI or release artwork when relevant.

## Product and security boundaries

- Use provider adapters; UI code must not implement provider HTTP calls.
- No remote text processing without provider consent AND granted endpoint host permission. Site access is separately granted. Failover must never broaden consent.
- No credentials in content scripts, logs, exports, or source. Default to browser-session key storage. Persistent keys and private text require the password-protected local vault; never persist its plaintext data key or password. Default private records are session-only.
- Analytics store numeric aggregates and hostnames only. Never store drafts or event text. Saved vocabulary context requires a separate explicit opt-in.
- User-requested local translation history is separate from analytics: default 100 rolling records, bounded storage, source/results only, never provider credentials. Content scripts may append their own granted-site results but cannot read or manage history. Clear/disable must reject late writes. Configuration/practice exports never include history.
- Never replace editor content except in response to Apply. Check the exact source again before applying. Complex rich editors use Copy fallback.
- Treat provider output as untrusted text. No generated HTML, eval, inline scripts, or remote scripts.
- Update docs/technical-validation.md, docs/architecture.md, docs/development-plan.md, and docs/compatibility.md as findings change.
- Run npm run check and npm run package before delivery. Browser tests use synthetic text and mocked remote APIs; never use private user text or real keys.
