# Saywell Privacy Policy

Updated: October 22, 2026

Saywell provides Chinese/English translation, polishing and related language practice in website input fields. It is maintained by GitHub user ider-zh. Project and support: [Saywell on GitHub](https://github.com/ider-zh/saywell) and [issues](https://github.com/ider-zh/saywell/issues). Do not include drafts, keys or sensitive information in public reports.

## Permission and scope

After installation, Saywell explains its processing and asks you to select “Agree and enable Saywell” to request website access. Once authorized, pausing while typing on an allowed website can automatically process the entire current editor draft, rather than only the latest characters, up to 6,000 UTF-16 units. A shortcut also supports manual requests. Saywell does not proactively read the whole page, browser cookies or account logins. It does not submit forms, send messages or automatically replace drafts. Replacement is attempted only after you select Apply.

Password fields and fields with common sensitive identifiers are excluded. Confidential medical, financial, business, personal communication or credential text in ordinary fields cannot be reliably identified. Pause, block sensitive websites or use local processing. You can revoke site access, disable automatic suggestions or use a whitelist. Individual-site permission remains available if you decline all-sites access.

## Remote processing and recipients

One-step setup connects Saywell Free AI, hosted by the developer at https://saywell.9992099.xyz through a Cloudflare Worker and Cloudflare Workers AI running Qwen3 30B A3B FP8. Requests include the current draft, target language, task, style, difficulty and output limits. They do not include your API keys, full website URL, translation history or vocabulary collection. Cloudflare receives the connection IP and necessary network metadata. The Worker temporarily uses a SHA-256 digest of the connecting IP for rate limiting, without writing the IP or text to application logs. Safe error logs contain only random request IDs and error codes. Worker observability is disabled; no content database or content cache is configured.

Cloudflare's [Workers AI data policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/) describes retention and no-training commitments for standard inference, operational metadata and legal/security exceptions. We do not sell drafts, use them for advertising, train models on them or conduct unrelated analysis, and we provide no operational feature for humans to review drafts. Provider processing remains subject to provider terms. These statements do not promise zero retention for every user-selected service.

Machine translation initially tries browser-local capabilities when the browser and prepared language models support them. Experimental legacy Google web, Bing web and Microsoft Edge translation endpoints are disabled in the store build. MyMemory, LibreTranslate, Google Cloud Translation, Microsoft Azure, and OpenAI, DeepSeek, Xiaomi MiMo, SiliconFlow, Gemini, Ollama or compatible services receive text only after you separately configure and connect them. Your selected provider/endpoint is the actual recipient; review its privacy and retention rules first. MyMemory queries put source text in HTTPS URL parameters, which its server or infrastructure may log. It is not a recipient authorized by default setup.

When you connect MT and AI, both may receive a draft concurrently. Enabled MT fallback can send the same draft to another already authorized MT provider. Fallback never authorizes a new service or silently selects another LLM profile. Remote endpoints require HTTPS; user-configured loopback services can use localhost HTTP. Requests omit website cookies and Referer and refuse redirects. Providers also receive necessary connection metadata such as IP addresses.

## Local records and encryption

History defaults to the latest 100 successful source drafts, results, explanations, engine labels, hostnames, timestamps, tasks and target languages. Choose 50, 100, 200, 500, 1,000 records or disable recording; a total byte bound also applies. Keys are never included. History supports search, removal, clear and explicit export. Clear/disable rejects writes from previously pending results.

Practice statistics store numeric aggregates and hostnames for up to 366 recorded dates, without per-keystroke logs or drafts. Switching translation off does not switch analytics off; statistics have a separate control. Temporary pauses and website exclusions also prevent their corresponding records. Vocabulary is saved only on request, and original sentence context requires a separate explicit checkbox. Retyping practice inside the tooltip is transient and is not sent to a provider.

No vault password is required by default: history, vocabulary and statistics use AES-256-GCM ciphertext in browser-session memory, with the decryption key restricted to that session memory. They disappear when the browser session ends or the extension is reloaded, updated or disabled. API keys also default to restricted browser-session memory.

For retention across restarts, optionally create a local vault. A random data key encrypts private records using AES-256-GCM. PBKDF2-HMAC-SHA-256 with a random salt and 600,000 iterations derives a wrapping key from your password. Disk contains ciphertext, salt, random IVs and a wrapped data key, without the password or plaintext data key. Unlock lasts only for the current browser session; extension reload, update or disable also locks it. After restart or manual lock, private recording pauses and saved credentials are unavailable; keyless free AI can still work. Remembering API keys requires a created, unlocked vault. A forgotten password cannot be recovered; you can confirm deletion of the vault and start again.

Legacy plaintext history, vocabulary and statistics are moved to encrypted restricted session storage before their old local fields are removed. Legacy saved keys move to session memory and their remember options are cleared. Create a vault before closing the browser to retain migrated records. Encryption protects locked local data; it does not defend against a compromised operating system, malicious extension code or complete access to an unlocked extension. Older backups or disk snapshots outside the extension cannot be retroactively erased by this migration.

## Preferences, exports and deletion

Language, provider endpoints/models, consent choices, website lists, tooltip positions and other non-key preferences remain in browser-local configuration. They are outside the vault and may include website hostnames you entered. There is no cloud sync or telemetry reporting.

Configuration exports exclude passwords, API keys, vault ciphertext, history and practice content. Built-in AI metadata follows the installed app version; backups retain references only. Practice exports exclude credentials and saved original sentence contexts. History export is a plaintext file you deliberately download and may contain sensitive data. Protect exported files; Saywell cannot delete files you download or share.

Clear history, reset statistics/vocabulary, forget keys, lock/delete the vault or revoke browser permissions using their respective controls. Disabling history does not delete existing records. Session records disappear at session end. Vault records remain until rolling eviction, explicit removal or uninstall; no additional age-based expiration is configured. Uninstall removes browser-managed extension storage. Provider copies remain subject to provider retention, deletion procedures and legal obligations; clearing local records does not retract prior requests.

## Limited Use and updates

Saywell's use of user data complies with the Chrome Web Store User Data Policy, including Limited Use requirements. Data is used only for authorized translation, polishing, associated language practice and necessary security operations. It is not sold or used/transferred for advertising profiles, credit decisions or unrelated purposes.

Shared free AI has a daily allocation and may be rate-limited, changed or ended; unlimited or permanent free access is not promised. Material data-practice changes will be disclosed in the product and renewed consent requested where needed. The latest project-published policy applies. Saywell is not specifically designed or marketed to children below the applicable age of consent.
