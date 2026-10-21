# Sponsored model evaluation — 2026-10-21

The owner requested a cheaper, faster MoE model. Before changing the deployed default, direct Workers AI requests tested `@cf/qwen/qwen3-30b-a3b-fp8` against the previous `@cf/qwen/qwen3.8-27b` using synthetic Chinese-to-English, English-to-Chinese, grammar correction, technical translation with vocabulary, Chinese Explain, and already-natural English tasks. No private drafts were sent. Local Wrangler OAuth remained outside the repository and logs.

| Final tested request | Samples | Median elapsed time | Total reported Neurons |
| --- | ---: | ---: | ---: |
| Previous Qwen 3.8 27B | 6 | 2,868 ms | 269.16 |
| Qwen3 30B A3B FP8 | 6 | 1,175.5 ms | 28.57 |

The final candidate requests returned valid suggestion JSON, no nonempty reasoning, correct bidirectional output, `This is a test.`, Chinese explanations, preserved Saywell/Friday/v2.1/3/API, useful vocabulary, and unchanged natural English. The Explain path preserved the source. The candidate used roughly 89.4% fewer reported Neurons in this small task set. These are sequential end-to-end observations including network, queueing and output length, not a controlled throughput benchmark or a quality guarantee across arbitrary input.

Cloudflare's [published pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) lists 4,625 input / 30,475 output Neurons per million tokens for Qwen3 30B A3B, versus 40,909 / 290,909 for Qwen 3.8 27B. Thus the same token counts consume about 89% fewer Neurons. The account stays on Workers Free; lower consumption extends the shared daily allocation and does not introduce a paid plan.

Protocol testing mattered: with the candidate, the tested JSON/template-override combinations produced an empty final content field, with the would-be answer classified as reasoning. The working request uses the model's native chat template, `max_tokens`, temperature 0.2, top_p 0.8 and a final `/no_think` directive (or `/think` when explicitly enabled). JSON is requested in instructions and strictly parsed by the existing Worker; no reasoning field is reused as an answer. The model-specific prompt reinforces Chinese explanations, grammatical agreement, number preservation and the full result schema. [Cloudflare model reference](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/) and [Qwen's documented soft thinking switch](https://qwenlm.github.io/blog/qwen3/) describe the underlying interfaces. This is a tested soft switch, not a claim of server-enforced hard disabling.

`node scripts/probe-cloudflare-candidate.mjs ACCOUNT_ID validate` reruns the six fixed candidate checks; `compare` also benchmarks the previous model. Earlier `template`, `soft`, `soft-text` and `soft-native` modes are diagnostic one-request probes. All consume real free allocation and must only be invoked explicitly. Ordinary automated tests mock AI bindings and never run these probes.
