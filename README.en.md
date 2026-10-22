# Saywell

**[简体中文](README.md) · [English](README.en.md)**

[![Build](https://github.com/ider-zh/saywell/actions/workflows/build.yml/badge.svg)](https://github.com/ider-zh/saywell/actions/workflows/build.yml)

Translation, polishing and vocabulary tips, right where you type.

Saywell is a Chrome and Edge extension that translates Chinese or mixed input into English, supports translation back into Chinese, and helps improve English writing. Machine translation and an LLM run in parallel so you can see a useful result before the slower response arrives.

This is a developer preview installed by loading an unpacked extension. It is not yet published in extension stores. The repository's primary README is [Simplified Chinese](README.md).

## Install: one permission step

1. Open [Build Saywell](https://github.com/ider-zh/saywell/actions/workflows/build.yml), choose the latest successful run and download `saywell-VERSION.zip` under **Artifacts**. Artifact downloads require GitHub sign-in.
2. Extract the ZIP. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. The welcome page opens automatically. Click **Allow and start using Saywell** and approve the browser's website-access request.
5. Type in a regular website input and pause, or press **Alt + Shift + E** to request a suggestion. On macOS, use **Command + Shift + E**.

The initial authorization enables free AI translation, polishing, vocabulary tips and keyless MT together. No account or API key is needed. The disclosure identifies the services that receive input. Existing normal tabs are activated where the browser permits it; refresh website tabs after updating the extension to load its new scripts.

If permission is denied or later revoked, the toolbar shows **!**, with a prominent retry action in Settings and the popup.

You can also [build from source](#build-from-source) and load the local `dist/` folder.

## Everyday use

- **Translation and polish:** Auto follows the input language. The target defaults to English and can be switched to Chinese in the popup or Settings. Same-language input uses the LLM for polishing. Translate, Polish and Explain can also be selected on the card.
- **Parallel results:** MT and the LLM start together. A card appears only when useful text is available. The LLM becomes primary when ready, with MT collapsed underneath. If one lane fails, the other result remains available.
- **Explicit replacement:** Only **Apply** replaces the draft, with another exact-source check immediately beforehand. Saywell never submits forms or sends messages. Unsupported complex editors offer **Copy**.
- **Vocabulary:** English results can highlight up to three useful words or phrases. Review explanations and examples, mark words known or save them. Attaching a source sentence to a vocabulary item requires a separate consent checkbox.
- **Movable card:** Drag its title bar and select Small, Medium or Large. Position and size are remembered per hostname and kept within the viewport after window resizing.
- **Position pin:** A miniature pin appears after manual movement, indicating a remembered position for that site. Click it to unpin and resume automatic positioning beside the input.
- **Temporary pause:** The small clock in the card offers 1 hour, 4 hours or until the next local midnight, for this website or all websites. Suggestions and input statistics pause until expiry; resume early from the extension popup.
- **Sentence practice:** Choose **Practice this sentence** under a result and retype directly in the card. Character differences have red highlights; case, spacing and punctuation use a subtle dotted style. The selected sentence stays fixed until practice closes, including when AI finishes later. Practice never edits the website draft, calls a provider or stores the attempt.
- **Autosave:** Valid Settings edits save after about 650 ms, followed by a completion toast. Invalid values and failed writes keep the current input and show an error.

The console supports Simplified Chinese and English, following the browser language by default. UI language and translation target are independent.

## Website permissions and defaults

**Blacklist mode** is the default: Saywell runs on granted websites except blocked hosts. Open **Website settings** in the card to block the current site, stopping both suggestions and local counting there. Whitelist mode is also available and processes only listed hosts.

Each hostname can override the action, target language, saved LLM profile or MT-only mode, and MT engine. Fields can inherit global defaults. Changes take effect from the next suggestion. Selecting a profile does not grant service consent or change global activation for other sites.

Password, payment and recognizable secret fields are skipped. Protected browser pages and extension stores cannot run the extension.

## Free AI and translation services

### Saywell Free AI

Default API base: `https://saywell.9992099.xyz/v1`. The sponsored Cloudflare service uses `@cf/qwen/qwen3-30b-a3b-fp8`, with non-thinking mode by default and no user API key. Fixed synthetic tasks were tested before switching; see the [model evaluation](docs/model-evaluation.md).

This prerelease service has a shared daily free allocation, resetting at **08:00 Asia/Shanghai**. When exhausted, Saywell shows a notice and pauses repeated AI requests while retaining MT. The service may change or end around release. See [Cloudflare deployment](docs/cloudflare-deployment.md) for operating details.

**Legacy address migration:** Reload the extension, select the Saywell profile using the old workers.dev address, and click **Connect and test** once. It switches to the custom hostname and renews authorization. Other providers and custom addresses are preserved.

### Machine translation

| Engine | Setup |
| --- | --- |
| Google web, Bing web, Microsoft Edge | Bundled keyless adapters; experimental web interfaces subject to network access, rate limits and protocol changes |
| MyMemory | Keyless service with daily/IP and input-length limits |
| Browser on-device translation | Tried first when the browser and language model are available; support is feature-detected |
| LibreTranslate, Microsoft Azure, Google Cloud | Configure your server or credentials |

Reorder fallback, disable it, or stop individual services in Settings. Every remote hop requires existing text consent and current browser host permission; fallback never authorizes another service.

### Bring your own LLM

Adapters support OpenAI-compatible APIs, OpenAI, DeepSeek, Xiaomi MiMo, SiliconFlow, Ollama and Gemini. Save up to 20 profiles, each with its own endpoint, key, thinking settings and request cap. One is globally active, with optional per-site overrides.

Select a provider, enter a model and required credentials, then click **Connect and test** to request endpoint access, authorize text processing and send a fixed synthetic test. Connecting another profile does not activate it globally. Usage and charges follow the chosen provider.

## Configuration backup and privacy

### Local translation history

Open **Translation history** from the sidebar or popup. By default it retains the latest **100 source texts and results**, combining MT and AI responses into one entry. Search source/result text or hostnames, remove individual entries, clear all history, or export the current search results as JSON.

Choose a rolling limit of **50, 100, 200, 500 or 1,000**, or turn recording off. Lowering the limit immediately removes older records; disabling recording retains existing entries until separately cleared. Storage limits can cause earlier eviction. More entries load as you scroll. History stays on this device, excludes provider credentials, and is separate from numeric analytics and configuration backups.

### Configuration backup

Settings → Local data & privacy → **Configuration backup** exports and imports JSON. Export first saves valid pending edits. Backups include global preferences, LLM profiles, website defaults, card positions/sizes and UI language, but **exclude API keys, provider text consent and practice data**.

Import has a review step and replaces configuration after confirmation, retaining activity and vocabulary. Provider consent must be renewed; missing website permissions require an explicit request. Matching local profile identities/endpoints can retain their keys; replaced identities lose theirs.

- Remote processing sends the focused editor text and task settings. Provider data policies apply. Some adapters, including Google web and MyMemory, send text in URL query parameters.
- Keys default to browser-session storage. Optional remembered keys use **unencrypted local storage**. Keys never enter content scripts or exports.
- Local analytics retain numeric totals and hostnames for up to 366 days, without drafts or keystroke logs. English word counts approximate independent word starts. Chinese counts are recorded on IME commit, excluding provisional pinyin and cancelled input.
- Pausing translation leaves analytics running; analytics can be disabled separately. Sensitive content in ordinary textboxes cannot be reliably detected.

## Build from source

Use Node.js **24** and npm:

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
npm run package
```

`npm run check` runs Node tests, builds the extension, then runs Chromium browser tests. Tests use synthetic text and localhost API fixtures. Output is `dist/`, with an installation archive at `release/saywell-VERSION.zip`. Versions in `package.json` and `manifest.json` must match.

For repeated local testing, load this project's `dist` directory once in `chrome://extensions`. After `npm run build`, click Reload on the Saywell card and refresh the test webpage; no repeated ZIP extraction, removal or folder selection is needed. Keep using the same directory to preserve the installation identity. Switching from an older extracted directory may create a new installation: export its configuration first, then import and reconnect permissions/keys. ZIP files are for distribution.

The check also enforces fixed input, practice-diff, scroll and active-process-ring performance budgets. Run `npm run test:performance` for isolated core timing; CI retains measurement JSON alongside browser evidence. See [performance findings and budgets](docs/performance-review.md) for methods and limits.

| Command | Purpose |
| --- | --- |
| `npm run build` | Bundle the extension and generate local logo assets |
| `npm run test` | Run Node tests |
| `npm run test:browser` | Run Chromium extension tests |
| `npm run preview` | Design preview without live input processing or extension settings storage |
| `npm run worker:check` | Validate the Worker bundle without deployment or inference |
| `npm run worker:deploy` | Explicitly deploy the sponsored backend using the operator's Cloudflare login |

Set `INPUT_COACH_BROWSER` to an absolute executable path to use an existing Playwright-compatible Chromium. The extension has no runtime npm dependencies and loads no remote scripts.

## Automatic builds

Every push, pull request, or manual **Run workflow** automatically:

1. Installs Node.js 24, locked npm dependencies and Chromium.
2. Runs the full test suite, builds the extension and validates Worker bundling.
3. Uploads the extension ZIP under the run's **Artifacts**, retained for 14 days.
4. Retains browser reports and screenshots for diagnosis for 7 days.

Workflow: [`.github/workflows/build.yml`](.github/workflows/build.yml). No Cloudflare secret is required. It does not deploy the Worker or publish to an extension store.

## Development status and documentation

This remains a developer preview. Ordinary inputs and selected plain rich-text structures have automated coverage; formatted text, mentions and widgets may require Copy. Authenticated ChatGPT, x.com and Baidu composers, as well as real Windows IME behavior, still need validation in their actual environments.

- [Compatibility and manual checks](docs/compatibility.md)
- [Technical validation](docs/technical-validation.md)
- [Architecture](docs/architecture.md)
- [Milestones](docs/development-plan.md)
- [Cloudflare deployment](docs/cloudflare-deployment.md)
- [Development instructions](AGENTS.md)

The logo pairs cream and warm-orange speech shapes on forest green, representing a thought and its clearer expression. Its shared source is `src/brand/mark.js`; the build produces SVG, multiple PNG sizes and ICO. Icons offer localized hover help. After 180ms of quiet typing, one continuous activity ring spans the remaining input delay and processing wait until the first result arrives.
