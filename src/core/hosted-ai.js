// Public service metadata only. Cloudflare credentials never enter the extension.
export const HOSTED_AI_ENDPOINT='https://saywell.9992099.xyz/v1';
export const LEGACY_HOSTED_AI_ENDPOINT='https://saywell-preview-ai.ider001.workers.dev/v1';
export const HOSTED_AI_MODEL='@cf/qwen/qwen3-30b-a3b-fp8';
export const isBuiltinHostedEndpoint=value=>typeof value==='string' && [HOSTED_AI_ENDPOINT,LEGACY_HOSTED_AI_ENDPOINT].includes(value.replace(/\/+$/,''));
