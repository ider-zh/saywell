import {LLM_PROVIDERS} from './llm-providers.js';
import {HOSTED_AI_ENDPOINT,HOSTED_AI_MODEL,isBuiltinHostedEndpoint} from './hosted-ai.js';
export const BASIC_ORDER = ['googleweb','bing','microsoft','mymemory','libre','azure','google'];
const LEGACY_BASIC_ORDER=['microsoft','mymemory','libre','azure','google'];
export const BASIC_KEY_IDS = ['libre','azure','google'];
export const llmKeyId=id=>id==='default'?'llm':`llm:${id}`;
export const llmConfig=profile=>Object.fromEntries(Object.keys(DEFAULTS.llm).map(key=>[key,profile[key] ?? DEFAULTS.llm[key]]));
export const DEFAULTS = Object.freeze({
  enabled: true, autoSuggest: true, analytics: true, basicEngine: 'auto',
  basicFallback: true, basicOrder: BASIC_ORDER,
  mode: 'auto', targetLanguage:'en', style: 'natural', debounce: 1200, difficulty: 'intermediate', maxWords: 3,
  siteMode:'blacklist', siteOrigins: [], allowlist: [], blocklist: [], dailyGoal: 200,
  basic: {
    googleweb:{consent:false,endpoint:'https://translate.googleapis.com'},
    bing:{consent:false,endpoint:'https://cn.bing.com'},
    microsoft: { consent:false, endpoint:'https://edge.microsoft.com' },
    mymemory: { consent: false, endpoint: 'https://api.mymemory.translated.net' },
    libre: { consent: false, endpoint: '', rememberKey: false },
    google: { consent: false, endpoint: 'https://translation.googleapis.com', rememberKey: false },
    azure: { consent:false, endpoint:'https://api.cognitive.microsofttranslator.com', region:'', rememberKey:false }
  },
  llm: { enabled: false, provider: 'compatible', endpoint: '', model: '', consent: false,
    thinking:false,thinkingProtocol:'auto',temperature: null, maxTokens: 800, timeout: 20000, dailyRequests: 0, rememberKey: false }
});

export const isBuiltinLlmProfile=profile=>profile?.provider==='saywell' && isBuiltinHostedEndpoint(profile.endpoint);
export const builtinLlmProfile=(id='default')=>({...DEFAULTS.llm,enabled:true,provider:'saywell',endpoint:HOSTED_AI_ENDPOINT,model:HOSTED_AI_MODEL,id,name:'Default configuration'});

export function mergeSettings(raw = {}) {
  const llm={...DEFAULTS.llm,...(!raw.llm && !raw.llmProfiles?{enabled:true,provider:'saywell',endpoint:LLM_PROVIDERS.saywell.endpoint,model:LLM_PROVIDERS.saywell.model}:{}),...raw.llm};
  const profiles=Array.isArray(raw.llmProfiles) && raw.llmProfiles.length
    ? raw.llmProfiles.map(p=>({...DEFAULTS.llm,...p}))
    : [{...llm,id:'default',name:'Default configuration'}];
  const activeLlmId=raw.activeLlmId ?? profiles[0].id;
  const active=profiles.find(p=>p.id===activeLlmId);
  // Keep the active projection compatible with previous installations and saved-settings clients.
  if(active && raw.llm)Object.assign(active,llm);
  for(const p of profiles)if(isBuiltinLlmProfile(p)){
    // The built-in service follows app metadata. A changed host needs renewed
    // consent and its own browser grant before any input can leave the browser.
    if(p.endpoint.replace(/\/+$/,'')!==HOSTED_AI_ENDPOINT)p.consent=false;
    p.endpoint=HOSTED_AI_ENDPOINT;p.model=HOSTED_AI_MODEL;
  }
  return { ...DEFAULTS, ...raw,
    // Append new engines to an existing complete order, without changing old priorities or consent.
    basicOrder:Array.isArray(raw.basicOrder) && raw.basicOrder.length===LEGACY_BASIC_ORDER.length && new Set(raw.basicOrder).size===LEGACY_BASIC_ORDER.length && raw.basicOrder.every(id=>LEGACY_BASIC_ORDER.includes(id))?[...raw.basicOrder,'googleweb','bing']:raw.basicOrder ?? [...BASIC_ORDER],
    // Preserve existing explicit allowlists; fresh/previous opt-in-only installs default to blacklist mode.
    siteMode:raw.siteMode ?? (raw.allowlist?.length ? 'whitelist' : 'blacklist'),
    basic: Object.fromEntries(Object.entries(DEFAULTS.basic).map(([id, value]) => [id, { ...value, ...raw.basic?.[id] }])),
    llm: active?llmConfig(active):llm, llmProfiles:profiles,activeLlmId
  };
}

export function publicSettings(raw) {
  const s = mergeSettings(raw);
  return { enabled: s.enabled, autoSuggest: s.autoSuggest, analytics: s.analytics, basicEngine: s.basicEngine,
    basicFallback:s.basicFallback,
    mode: s.mode,targetLanguage:s.targetLanguage, style: s.style, debounce: s.debounce, difficulty: s.difficulty, maxWords: s.maxWords,
    siteMode:s.siteMode,siteOrigins:s.siteOrigins, allowlist: s.allowlist, blocklist: s.blocklist,
    llmEnabled: s.llm.enabled && s.llm.consent,llmNeedsConnection:s.llm.enabled && !s.llm.consent };
}

const enums = { targetLanguage:['en','zh'],siteMode:['blacklist','whitelist'],basicEngine: ['auto','builtin',...BASIC_ORDER], mode: ['auto','translate','polish','explain'],
  style: ['natural','concise','professional','casual'], difficulty: ['beginner','intermediate','advanced'] };
export function validateSettings(s) {
  if(typeof s.basicFallback!=='boolean')throw new Error('Invalid basicFallback.');
  if(!Array.isArray(s.basicOrder) || s.basicOrder.length!==BASIC_ORDER.length || new Set(s.basicOrder).size!==BASIC_ORDER.length || s.basicOrder.some(id=>!BASIC_ORDER.includes(id)))throw new Error('Invalid basicOrder.');
  if(typeof s.basic.azure.region!=='string' || !/^[a-z0-9-]{0,60}$/.test(s.basic.azure.region))throw new Error('Invalid Azure region.');
  for (const [key, values] of Object.entries(enums)) if (!values.includes(s[key])) throw new Error(`Invalid ${key}.`);
  for (const [key, min, max] of [['debounce',400,10000],['maxWords',0,3],['dailyGoal',1,100000]]) {
    if (!Number.isInteger(s[key]) || s[key] < min || s[key] > max) throw new Error(`Invalid ${key}.`);
  }
  if(!Array.isArray(s.llmProfiles) || !s.llmProfiles.length || s.llmProfiles.length>20 || new Set(s.llmProfiles.map(p=>p.id)).size!==s.llmProfiles.length || !s.llmProfiles.some(p=>p.id===s.activeLlmId))throw new Error('Invalid LLM configurations.');
  for(const p of s.llmProfiles){
    if(typeof p.id!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(p.id) || typeof p.name!=='string' || !p.name.trim() || p.name.length>80)throw new Error('Invalid LLM configuration name or ID.');
    if(Object.keys(p).some(k=>!['id','name',...Object.keys(DEFAULTS.llm)].includes(k)))throw new Error('Invalid LLM configuration field.');
    validateLLM(p);
  }
  validateLLM(s.llm);
  for (const key of ['allowlist','blocklist','siteOrigins']) if (!Array.isArray(s[key]) || s[key].length > 300 || s[key].some(x => typeof x !== 'string' || x.length > 260)) throw new Error(`Invalid ${key}.`);
  return s;
}

function validateLLM(c){
  if (!Object.hasOwn(LLM_PROVIDERS,c.provider)) throw new Error('Invalid LLM provider.');
  if(typeof c.endpoint!=='string' || c.endpoint.length>500 || typeof c.model!=='string' || c.model.length>200 || ['enabled','consent','rememberKey','thinking'].some(k=>typeof c[k]!=='boolean'))throw new Error('Invalid LLM configuration.');
  if(!['auto','thinking','enable_thinking','reasoning_effort','think','chat_template'].includes(c.thinkingProtocol))throw new Error('Invalid thinking protocol.');
  if (!Number.isInteger(c.timeout) || c.timeout < 3000 || c.timeout > 60000) throw new Error('Timeout must be 3–60 seconds.');
  if (!Number.isInteger(c.maxTokens) || c.maxTokens < 100 || c.maxTokens > 8000) throw new Error('Response token limit must be 100–8000.');
  if (!Number.isInteger(c.dailyRequests) || c.dailyRequests < 0 || c.dailyRequests > 100000) throw new Error('Invalid daily request limit.');
  if (c.temperature !== null && (!Number.isFinite(c.temperature) || c.temperature < 0 || c.temperature > 2)) throw new Error('Invalid temperature.');
}
