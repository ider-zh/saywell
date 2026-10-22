import {mergeSettings,llmConfig} from './settings.js';
import {LLM_PROVIDERS} from './llm-providers.js';
export const SETUP_ORIGINS=['https://*/*','http://*/*'];
export const FREE_ENGINES=[];
// Only an explicit, disclosed setup click calls this. Upgrades never reset preferences.
export function enableFreeSetup(raw){
  const s=mergeSettings(raw);
  let profile=s.llmProfiles.find(p=>p.provider==='saywell' && p.endpoint===LLM_PROVIDERS.saywell.endpoint);
  if(!profile){
    if(s.llmProfiles.length>=20)throw new Error('Remove an LLM configuration before enabling free AI.');
    profile={...mergeSettings().llm,id:crypto.randomUUID(),name:'Saywell Free AI'};s.llmProfiles.push(profile);
  }
  Object.assign(profile,{enabled:true,consent:true,thinking:false,model:LLM_PROVIDERS.saywell.model});
  s.activeLlmId=profile.id;s.llm=llmConfig(profile);
  const defaults=mergeSettings();for(const id of FREE_ENGINES)s.basic[id]={...s.basic[id],endpoint:defaults.basic[id].endpoint,consent:true};
  return {...s,enabled:true,autoSuggest:true,basicEngine:'auto',basicFallback:true,maxWords:3,siteOrigins:[...SETUP_ORIGINS],siteMode:'blacklist'};
}
