import {BASIC_ORDER,DEFAULTS,llmConfig} from './settings.js';

// An absent field follows the global preference; null LLM selection means MT only.
export function validateSitePreferences(value,profiles){
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Invalid website settings.');
  const allowed={mode:['auto','translate','polish','explain'],targetLanguage:['en','zh'],basicEngine:['auto','builtin',...BASIC_ORDER]};
  const result={};
  for(const[key,item]of Object.entries(value)){
    if(key==='llmProfileId'){
      if(item!==null && (typeof item!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item) || (profiles && !profiles.some(p=>p.id===item))))throw new Error('Choose an existing LLM configuration.');
    }else if(!Object.hasOwn(allowed,key) || !allowed[key].includes(item))throw new Error('Invalid website settings.');
    result[key]=item;
  }
  return result;
}
export function sitePreferencesFor(map,host){
  try{return Object.hasOwn(map || {},host)?validateSitePreferences(map[host]):{};}catch{return {};}
}
export function resolveSiteSettings(settings,preferences){
  const {mode,targetLanguage,basicEngine,llmProfileId}=preferences;
  const next={...settings,...(mode?{mode}:{}),...(targetLanguage?{targetLanguage}:{}),...(basicEngine?{basicEngine}:{})};
  if(llmProfileId===null)next.llm={...settings.llm,enabled:false};
  else if(llmProfileId!==undefined){
    const profile=settings.llmProfiles.find(p=>p.id===llmProfileId);
    // A deleted site-specific profile must never silently route text to another provider.
    next.activeLlmId=llmProfileId;next.llm=profile?llmConfig(profile):{...DEFAULTS.llm};
  }
  return next;
}
