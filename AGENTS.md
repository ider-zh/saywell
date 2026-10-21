# Saywell development

This repository is a local, Manifest V3 Chrome/Edge extension. Do not push, publish, or provision cloud services without explicit user authorization.

- Use provider adapters; UI code must not implement provider HTTP calls.
- No remote text processing without provider consent AND granted endpoint host permission. Site access is separately granted. Failover must never broaden consent.
- No credentials in content scripts, logs, exports, or source. Default to browser-session key storage. Local persistent keys are not encrypted.
- Analytics store numeric aggregates and hostnames only. Never store drafts or event text. Saved vocabulary context requires a separate explicit opt-in.
- User-requested local translation history is separate from analytics: default 100 rolling records, bounded storage, source/results only, never provider credentials. Content scripts may append their own granted-site results but cannot read or manage history. Clear/disable must reject late writes. Configuration/practice exports never include history.
- Never replace editor content except in response to Apply. Check the exact source again before applying. Complex rich editors use Copy fallback.
- Treat provider output as untrusted text. No generated HTML, eval, inline scripts, or remote scripts.
- Update docs/technical-validation.md, docs/architecture.md, docs/development-plan.md, and docs/compatibility.md as findings change.
- Run npm run check and npm run package before delivery. Browser tests use synthetic text and mocked remote APIs; never use private user text or real keys.
