import {llmConfig} from './settings.js';

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value && typeof value==='object' && !Array.isArray(value);
const changed=()=>{throw new Error('Settings changed in another window. Reload Settings and try again.');};
function merge(base,local,current){
  if(equal(base,local))return structuredClone(current);
  if(object(base) && object(local) && object(current))return Object.fromEntries([...new Set([...Object.keys(base),...Object.keys(local),...Object.keys(current)])].map(key=>[key,merge(base[key],local[key],current[key])]));
  return structuredClone(local);
}
const identity=config=>config && JSON.stringify([config.provider,config.endpoint]);
function provider(base,local,current){
  const result=merge(base,local,current);
  if(![identity(local),identity(current)].includes(identity(result)))changed();
  const independent=['id','name','enabled'];
  if(identity(local)!==identity(base)){for(const key of Object.keys(local))if(!independent.includes(key))result[key]=structuredClone(local[key]);}
  else if(identity(current)!==identity(base)){
    if(Object.keys(local).some(key=>!independent.includes(key) && !equal(local[key],base[key])))changed();
    result.consent=current.consent;
  }
  return result;
}
export function mergeSettingsEdits(base,local,current){
  const next=merge(base,local,current);
  for(const field of ['allowlist','blocklist','siteOrigins']){
    const removed=new Set(base[field].filter(value=>!local[field].includes(value)));
    next[field]=[...new Set([...current[field].filter(value=>!removed.has(value)),...local[field].filter(value=>!base[field].includes(value))])];
  }
  next.basic=Object.fromEntries(Object.entries(local.basic).map(([id,config])=>[id,provider(base.basic[id],config,current.basic[id])]));
  next.llmProfiles=[];
  for(const profile of local.llmProfiles){
    const before=base.llmProfiles.find(item=>item.id===profile.id),now=current.llmProfiles.find(item=>item.id===profile.id);
    if(!before){if(now && !equal(now,profile))changed();next.llmProfiles.push(structuredClone(profile));}
    else if(!now){if(!equal(before,profile))changed();}
    else next.llmProfiles.push(provider(before,profile,now));
  }
  for(const profile of current.llmProfiles)if(!base.llmProfiles.some(item=>item.id===profile.id) && !local.llmProfiles.some(item=>item.id===profile.id))next.llmProfiles.push(structuredClone(profile));
  const active=next.llmProfiles.find(profile=>profile.id===next.activeLlmId);if(!active)changed();
  next.llm=llmConfig(active);return next;
}
