# Saywell Chrome Web Store submission text

Status: prepared for publisher verification. Do not submit or publish automatically.

## Listing

Name: Saywell

Summary: Translate and polish Chinese/English in website input fields, with sentence practice and vocabulary tools.

Description:

Saywell helps you express yourself in Chinese and English where you type. Pause to see a translation or polish, then explicitly Apply or copy the suggestion. Your draft is never replaced automatically.

- One permission action enables developer-sponsored AI without registration or an API key. Shared daily allocation is limited and may change or end.
- Use browser-local machine translation when supported, or separately connect MyMemory, LibreTranslate, Google Cloud, Azure and your own AI configurations. Third-party services may require credentials or payment.
- Connected MT and AI can run concurrently. Optional fallback uses only already authorized MT providers.
- Switch English/Chinese UI and target language, control websites, pause suggestions and reposition the tooltip.
- Retype a suggestion inside the tooltip and compare characters locally, without sending the practice attempt.
- Search, clear, export or resize rolling history, initially 100 records in the current browser session. A password-protected local vault can retain history, vocabulary and statistics across restarts.
- API keys default to restricted session memory. Remembering credentials requires an unlocked encrypted vault.

Data handling: once authorized, typing pauses can send the entire current editor draft to connected providers. MT/AI may receive it simultaneously, and consented fallback can involve multiple providers. Default free AI uses Cloudflare Workers AI. Browser-local translation does not upload text. Sensitive text in ordinary fields cannot be reliably identified; pause or block sensitive sites. Local history contains source/results; local statistics contain numeric aggregates and hostnames, with separate controls. There are no ads, telemetry server or cloud history sync.

Chinese/English only. Local MT depends on browser/model availability. Complex editors may offer Copy instead of Apply. Browser internal pages, extension stores and other restricted pages are unsupported. Unlimited or permanent free service is not promised.

Single purpose: assist Chinese/English writing in website input fields through translation, polishing and directly related sentence/vocabulary practice.

## Permission justifications

storage: Store provider/site preferences and restricted in-memory session credentials. Private history, vocabulary and numeric/hostname statistics are encrypted in session memory by default. Optional persistent data and remembered credentials use a password-protected AES-GCM vault; plaintext keys/passwords are not persisted. Configuration exports exclude credentials and private records.

scripting: Register and inject the locally packaged content script only into user-authorized HTTP(S) sites to detect eligible input, display suggestions and handle explicit Apply. No remote script is loaded or executed.

activeTab: Identify the current tab following the toolbar/shortcut interaction to let the user authorize that site, manage its exclusion/pause state and trigger a manual suggestion. No browser history API is used.

Optional host permissions https://*/* and http://*/*: Automatic writing assistance must work on user-chosen sites across navigation, rather than only during the temporary activeTab grant. Users can grant all HTTP(S) sites through disclosed onboarding or choose individual sites. Dynamic custom provider origins also require host access; requests require separate provider consent. Remote provider URLs require HTTPS except explicitly configured loopback HTTP. The extension does not request cookies/history/webRequest access or read entire page bodies for profiling.

Remote code: No. All extension logic is included in the ZIP. Translation/AI services return validated text data, never instructions executed as extension code. Retired experimental web translation providers are disabled in this release.

## Privacy practices

Public policy: https://github.com/ider-zh/saywell/blob/main/docs/privacy-policy.en.md

Chinese policy: https://github.com/ider-zh/saywell/blob/main/docs/privacy-policy.zh-CN.md

Support: https://github.com/ider-zh/saywell/issues

Publish the policy files to main and verify logged-out access before submitting. Do not use the bundled chrome-extension:// policy URL as the public dashboard URL.

Review the current dashboard definitions and disclose Website content, Personal communications, User activity, Web history (recorded hostnames) and Authentication information (user-configured API credentials) as applicable. Local-only handling also counts. Review any additional personal-data classifications applicable to editor text. Do not select no user data. Certify no sale/unrelated use/credit use only after verifying consistency with the actual release and policy.

## Reviewer instructions

No account is needed. Install, select Agree and enable Saywell and approve browser website permissions. On an ordinary HTTPS page with a textarea, enter the synthetic sentence “我们可以把这段说明写得更清楚。” and pause. A translation/polish should appear; wording varies. The original draft remains until Apply is clicked. Explore local sentence practice, per-site settings, pause and Settings. View the privacy policy using the footer link.

The shared free AI service has a daily allocation and an explicit quota/reset notice. Local MT needs browser support/prepared models; custom services require separate connection. Submit while the primary free workflow is available, and provide a short current recording if needed. Mocked automated tests do not establish live remaining allocation or availability.

Optional persistence: Settings → Local data & privacy → Local vault. Use a 12–256-character test password, confirm it and create a vault. Lock/unlock demonstrates protected storage. Restart requires unlock; keyless free translation remains usable. Never provide real personal data or keys for review.

Use the 128px icon, 440×280 promo and 1280×800 screenshots listed in the Chinese preparation file. Publisher registration, verified contact/2-Step Verification, identity/trader requirements, model/provider terms and the final live smoke test require owner verification. No store submission has been performed.
