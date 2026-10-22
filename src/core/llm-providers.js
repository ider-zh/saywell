import {HOSTED_AI_ENDPOINT,HOSTED_AI_MODEL} from './hosted-ai.js';
// Shared provider identities and connection presets.
export const LLM_PROVIDERS = Object.freeze({
  saywell:{name:'Saywell Free AI',endpoint:HOSTED_AI_ENDPOINT,model:HOSTED_AI_MODEL,example:HOSTED_AI_MODEL,
    help:'Developer-sponsored Cloudflare AI. No account or key is needed. Shared free quota resets daily at 08:00 Shanghai time. Qwen3 30B A3B FP8 is fixed and thinking is off by default. Availability and quota may change; on-device or separately connected machine translation remains available when supported.'},
  compatible:{name:'Custom LLM',endpoint:''},
  openai:{name:'OpenAI',endpoint:'https://api.openai.com/v1'},
  deepseek:{name:'DeepSeek',endpoint:'https://api.deepseek.com'},
  mimo:{name:'Xiaomi MiMo',endpoint:'https://api.xiaomimimo.com/v1',example:'mimo-v2.6-pro',
    console:'https://platform.xiaomimimo.com/',docs:'https://mimo.mi.com/docs/en-US/quick-start/summary/first-api-call',
    help:'Use a MiMo text model from your console. This preset uses the pay-as-you-go API; Token Plan keys need their dedicated base URL. Thinking is configurable and off by default for short writing suggestions.'},
  siliconflow:{name:'SiliconFlow',endpoint:'https://api.siliconflow.cn/v1',example:'deepseek-ai/DeepSeek-V4-Flash',
    console:'https://cloud.siliconflow.cn/me/models',docs:'https://docs.siliconflow.cn/docs/userguide/capabilities/text-generation',
    help:'Copy the full text-chat model ID from SiliconFlow, including its organization and any Pro/ prefix. Thinking is off by default; choose a model that supports this switch. Your own API key is required; pricing and availability depend on the model.'},
  ollama:{name:'Ollama',endpoint:'http://localhost:11434/v1'},
  gemini:{name:'Gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta'}
});
export const llmProviderName = id => LLM_PROVIDERS[id]?.name || id;
