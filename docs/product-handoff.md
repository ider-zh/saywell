# Saywell — Updated Development Handoff

## Product Goal

Build a Chrome/Edge browser extension inspired by C2E Instantly, with free basic translation, configurable LLM providers, contextual English polishing, lightweight vocabulary learning, and cross-website typing statistics.

The extension should work naturally while the user types on websites such as ChatGPT, GitHub, Gmail, and search engines.

## 1. Core Product Principles

- Installation should provide useful basic translation without requiring an LLM API key, whenever a supported free translation engine is available.
- Advanced translation and English polishing should be accessible through user-configured LLM providers.
- English-only input must also trigger polishing suggestions when LLM mode is enabled.
- Mixed Chinese-English input should preserve user intent and technical terminology.
- AI suggestions should never replace user text without approval.
- Vocabulary hints should be lightweight, contextual, and nonintrusive.
- Daily typing statistics should remain independent of the translation service.
- Text transmission to external providers requires transparent, user-controlled permissions.

## 2. Translation Engine Architecture

Implement a modular provider system with two provider categories.

### A. Basic Translation Providers

Candidates:

1. Chrome Built-in Translator API
2. MyMemory
3. LibreTranslate (self-hosted or configured endpoint)
4. Google Cloud Translation (user-configured official API)

Investigate C2E Instantly's documented multi-engine behavior as a UX reference, not as proof that every endpoint is officially supported for unrestricted use.

Avoid relying on undocumented Google Translate endpoints for production functionality.

Each provider must implement:

- Translate text
- Report availability
- Declare supported language pairs
- Handle timeout and rate limits
- Normalize responses
- Surface errors without disrupting typing

The free translation path should work without user configuration when a supported no-key provider is available.

Provide automatic failover, but only among providers the user has authorized to receive input text.

Use an adaptive routing policy:

- Prefer eligible on-device translation.
- Use an authorized external basic provider when the local translator is unavailable.
- Respect provider quotas, health, and rate limits.
- Apply a temporary cooldown after repeated provider failures.
- Do not retry blindly after authentication failures or quota exhaustion.
- Display the engine that generated the result.

Do not claim unlimited free translation or guaranteed availability.

### B. Configurable LLM Providers

Support:

- OpenAI-compatible endpoints
- OpenAI
- DeepSeek
- Ollama/local compatible servers
- Other APIs such as Gemini through separate adapters when required

Allow the user to configure:

- Provider
- API Base URL
- API Key
- Model
- Temperature, if supported
- Default writing style
- Request timeout
- Maximum response tokens
- Optional usage or budget limit

Include a Test Connection action.

Do not bundle private provider credentials in the extension.

Store credentials locally with clear disclosure of storage limitations. Prefer minimizing long-term storage of raw keys where practical.

Use least-privilege host permissions, with explicit authorization for configured remote endpoints.

## 3. Language Processing and Routing

Detect three input types:

**Chinese-dominant input**
- Default: basic translation to English
- Optional: LLM translation with natural phrasing

**English-dominant input**
- Default: no basic machine translation
- When LLM is enabled: grammar correction and polishing
- Preserve meaning, tone, proper nouns, numbers, and technical terms

**Mixed Chinese-English input**
- Produce fluent English
- Prefer LLM when configured
- Allow best-effort basic translation if no LLM is configured
- Avoid translating product names, code, acronyms, and technical terms incorrectly

Provide three user-selectable actions:

- Translate
- Polish
- Explain

Support Auto mode to select the appropriate action based on language composition, with manual override.

## 4. English Polishing

Provide these styles:

- Natural (default)
- Concise
- Professional
- Casual

LLM outputs should be short and meaningful.

Avoid rewriting sentences that are already sufficiently natural unless the user explicitly requests an alternative.

Show an explanation only when substantive wording, grammar, or phrasing changed.

Do not introduce facts not present in the source.

## 5. Lightweight Vocabulary Learning

When LLM processing is enabled, identify up to three moderately challenging words or phrases from the suggested English sentence.

The primary purpose is helping the user learn useful vocabulary in real contexts.

### Vocabulary selection

- Default learning difficulty: intermediate.
- User-selectable difficulty: beginner, intermediate, advanced.
- Prefer reusable words, collocations, and natural expressions.
- Avoid trivial vocabulary and unnecessary rare words.
- Do not highlight words solely because they are long.
- Avoid repeatedly explaining vocabulary already marked as learned.

### Vocabulary display

Use subtle underlines or highlights in the suggestion tooltip.

On hover/click, show:

- Word or phrase
- Chinese meaning
- Short contextual explanation
- Optional pronunciation
- One short example, on demand

Users can mark vocabulary as Known or Save for Review.

Saved words should include their original context only with explicit user consent.

### Basic Engine Mode

Basic machine translation may be combined with a lightweight local dictionary for limited word definitions.

Do not represent dictionary heuristics as LLM-generated grammatical analysis.

## 6. Tooltip Interaction

Implement an unobtrusive floating interface similar to C2E.

Default contents:

- Translation or polished sentence
- Engine indicator
- Mode indicator
- Copy
- Apply
- Dismiss

Advanced contents when available:

- Short explanation
- Optional alternative expression
- Highlighted vocabulary

Requirements:

- Do not block typing.
- Do not trigger while IME composition is active.
- Use debounce and sentence-boundary heuristics.
- Prevent stale suggestions from appearing.
- Allow users to disable automatic suggestions.
- Support a manual keyboard shortcut.
- Do not modify the host editor until Apply.
- Handle controlled React editors and rich-text editors correctly.
- Use Copy as a fallback when safe replacement is not possible.
- Never inject untrusted LLM-generated HTML into the host page.

## 7. Typing Analytics

Retain the previously defined cross-website input statistics.

Collect locally:

- Daily independently typed characters
- Chinese character count
- Independently typed English word count
- Paste volume
- AI-applied text volume
- Per-site totals
- Seven-day and 30-day activity
- AI suggestion acceptance rate

Separate user-written English from machine-generated or applied text.

Do not persist raw input content for analytics.

The dashboard should prioritize simple daily metrics and long-term English practice trends.

## 8. UI Requirements

### Popup
- Today's typing statistics
- Translation enabled/disabled
- Current engine
- Current LLM mode
- Quick Pause button

### Settings
- Basic Engine: Auto / manual choice
- LLM Provider management
- Language mode
- Writing style
- Suggestion debounce
- Vocabulary difficulty
- Maximum highlighted words
- Site allowlist/blocklist
- Privacy and network permissions
- Export/reset data

### Tooltip
- Compact by default
- Expand explanation only when requested
- Display vocabulary definitions without interrupting input
- Visually distinguish basic translation from LLM polishing

## 9. Development Phases

### Phase 0 — Technical Validation
- Evaluate Chrome Built-in Translator API in extension contexts.
- Test MyMemory and LibreTranslate integration.
- Review official API conditions and rate limits.
- Validate editor text replacement.
- Confirm secure, consent-based permission handling.

### Phase 1 — C2E-like Basic MVP
- Cross-site input detection
- Chinese to English translation
- Multiple basic engine adapters
- Authorized automatic fallback
- Floating translation tooltip
- Copy and Apply

### Phase 2 — LLM Integration
- Provider settings
- OpenAI-compatible API
- English grammar correction
- Chinese/English mixed input
- Translate / Polish / Auto routing
- Writing-style selection
- Modification explanations

### Phase 3 — Vocabulary Coach
- Identify slightly challenging words
- Highlight important expressions
- Contextual Chinese explanations
- Difficulty settings
- Optional saved vocabulary

### Phase 4 — Typing Analytics
- Daily typing statistics
- Self-written English versus AI-applied text
- Historical dashboard
- Goals and learning trends

### Phase 5 — Testing and Release
- Site compatibility testing
- Chinese IME regression testing
- Multi-engine failure simulation
- Permission and privacy testing
- API security review
- Performance optimization
- Chrome/Edge installation packages

## 10. Acceptance Criteria

The extension is ready for initial release when:

1. A supported free translation engine can translate Chinese input without LLM configuration.
2. Authorized basic engines can fail over when an engine is unavailable.
3. Users can configure and test their preferred LLM endpoint and model.
4. Existing English sentences can be polished, not merely translated.
5. Mixed Chinese-English text can be converted into natural English.
6. The tooltip can display up to three contextual vocabulary explanations.
7. Users can apply or copy a suggestion without disrupting host editors.
8. Daily typing statistics distinguish independent writing from AI-generated text.
9. Network calls and text collection are governed by explicit permissions.
10. Supported scenarios are covered by reproducible automated tests.

## 11. Agent Execution Instructions

Start with Phase 0 and publish the findings in `docs/technical-validation.md`.

Document which translation providers are reliably available without an API key and which require configuration.

Build the implementation around provider interfaces rather than provider-specific logic in UI components.

Create and maintain `AGENTS.md`, `docs/architecture.md`, `docs/development-plan.md`, and `docs/compatibility.md`.

Develop in milestones, run automated checks, and record known limitations.

Do not create cloud infrastructure without a demonstrated need.

Do not publish or push to remote repositories without explicit authorization.