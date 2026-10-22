import {DEFAULTS,mergeSettings,validateSettings,builtinLlmProfile,isBuiltinLlmProfile} from './settings.js';
import {validateSitePreferences} from './site-preferences.js';
import {validTooltipPosition} from './tooltip-position.js';
import {validTooltipSize} from './tooltip-size.js';
import {endpointURL} from './security.js';

export const CONFIG_FILE_LIMIT=1024*1024;
const settingKeys=[...Object.keys(DEFAULTS).filter(key=>key!=='llm'),'llmProfiles','activeLlmId'];
const profileKeys=['id','name',...Object.keys(DEFAULTS.llm).filter(key=>!['consent','rememberKey'].includes(key))];
const basicKeys=id=>Object.keys(DEFAULTS.basic[id]).filter(key=>!['consent','rememberKey'].includes(key));
const plain=value=>Boolean(value && typeof value==='object' && !Array.isArray(value));
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
function fields(value,keys){if(!plain(value) || Object.keys(value).some(key=>!keys.includes(key)))throw new Error('Configuration contains unsupported or sensitive fields.');}
function host(value,wildcard=false){
  if(typeof value!=='string' || value.length>260)throw new Error('Invalid website hostname in configuration.');
  const prefix=wildcard && value.startsWith('*.')?'*.':'',name=value.slice(prefix.length).toLowerCase();
  try{
    const url=new URL(`https://${name}`);
    if(url.hostname!==name || url.port || (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(name) && !/^\[[0-9a-f:]+\]$/.test(name)))throw 0;
  }catch{throw new Error('Invalid website hostname in configuration.');}
  return prefix+name;
}
function hostnameMap(value,limit,validate){
  if(!plain(value) || Object.keys(value).length>limit)throw new Error('Invalid website entries in configuration.');
  const entries=Object.entries(value).map(([key,item])=>[host(key),validate(item)]);
  if(new Set(entries.map(([key])=>key)).size!==entries.length)throw new Error('Invalid website entries in configuration.');
  return Object.fromEntries(entries);
}
function siteScope(value){
  if(['https://*/*','http://*/*'].includes(value))return value;
  try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol) || url.username || url.password || value!==url.origin+'/*')throw 0;return value;}
  catch{throw new Error('Invalid website scopes in configuration.');}
}
export function parseConfigBackup(text){
  if(typeof text!=='string')throw new Error('Choose a Saywell configuration JSON file.');
  if(new TextEncoder().encode(text).length>CONFIG_FILE_LIMIT)throw new Error('Configuration file is too large (maximum 1 MiB).');
  let data;try{data=JSON.parse(text);}catch{throw new Error('Invalid configuration JSON.');}
  if(!plain(data) || data.format!=='saywell-configuration' || ![1,2].includes(data.version))throw new Error('Unsupported configuration file or version.');
  fields(data,['format','version','exportedAt','settings','uiLanguage','sitePreferences','tooltipPositions','tooltipSizes',...(data.version===2?['builtinLlmIds']:[])]);
  if(data.exportedAt!==undefined && (typeof data.exportedAt!=='string' || data.exportedAt.length>64 || !Number.isFinite(Date.parse(data.exportedAt))))throw new Error('Unsupported configuration file or version.');
  const raw=data.settings;fields(raw,settingKeys);
  if(!Array.isArray(raw.llmProfiles) || data.version===1 && !raw.llmProfiles.length || raw.llmProfiles.length>20 || typeof raw.activeLlmId!=='string')throw new Error('Invalid LLM configurations.');
  for(const profile of raw.llmProfiles){fields(profile,profileKeys);if(typeof profile.id!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(profile.id))throw new Error('Invalid LLM configurations.');}
  const references=data.version===2?data.builtinLlmIds:[];
  if(!Array.isArray(references) || references.some(id=>typeof id!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id)) || new Set([...references,...raw.llmProfiles.map(p=>p.id)]).size!==references.length+raw.llmProfiles.length || references.length+raw.llmProfiles.length>20 || !references.length && !raw.llmProfiles.length)throw new Error('Invalid LLM configurations.');
  if(raw.basic!==undefined){fields(raw.basic,Object.keys(DEFAULTS.basic));for(const[id,config]of Object.entries(raw.basic))fields(config,basicKeys(id));}
  const profiles=[...references.map(id=>builtinLlmProfile(id)),...raw.llmProfiles.map(profile=>isBuiltinLlmProfile(profile)?builtinLlmProfile(profile.id):profile)];
  const settings=validateSettings(mergeSettings({...raw,llmProfiles:profiles}));
  for(const key of ['enabled','autoSuggest','analytics'])if(typeof settings[key]!=='boolean')throw new Error('Invalid configuration preference.');
  for(const config of [...settings.llmProfiles,...Object.values(settings.basic)]){
    if(typeof config.endpoint!=='string' || config.endpoint.length>500)throw new Error('Enter an absolute endpoint URL.');
    if(config.endpoint)endpointURL(config.endpoint);
  }
  for(const key of ['allowlist','blocklist'])settings[key]=[...new Set(settings[key].map(value=>host(value,true)))];
  settings.siteOrigins=[...new Set(settings.siteOrigins.map(siteScope))];
  const uiLanguage=data.uiLanguage ?? 'auto';if(!['auto','en','zh-CN'].includes(uiLanguage))throw new Error('Invalid UI language in configuration.');
  const sitePreferences=hostnameMap(data.sitePreferences ?? {},300,value=>validateSitePreferences(value));
  const tooltipPositions=hostnameMap(data.tooltipPositions ?? {},200,value=>{
    fields(value,['x','y']);if(!validTooltipPosition(value))throw new Error('Invalid tooltip position.');return {x:value.x,y:value.y};
  });
  const tooltipSizes=hostnameMap(data.tooltipSizes ?? {},200,value=>{if(!validTooltipSize(value))throw new Error('Invalid tooltip size.');return value;});
  return {settings,uiLanguage,sitePreferences,tooltipPositions,tooltipSizes};
}
export function exportConfigBackup(raw,metadata={}){
  const settings=mergeSettings(raw),portable=pick(settings,settingKeys);
  portable.basic=Object.fromEntries(Object.entries(settings.basic).map(([id,config])=>[id,pick(config,basicKeys(id))]));
  portable.llmProfiles=settings.llmProfiles.filter(profile=>!isBuiltinLlmProfile(profile)).map(profile=>pick(profile,profileKeys));
  const file={format:'saywell-configuration',version:2,exportedAt:new Date().toISOString(),settings:portable,builtinLlmIds:settings.llmProfiles.filter(isBuiltinLlmProfile).map(profile=>profile.id),
    uiLanguage:metadata.uiLanguage || 'auto',sitePreferences:metadata.sitePreferences || {},tooltipPositions:metadata.tooltipPositions || {},tooltipSizes:metadata.tooltipSizes || {}};
  // Enforce the same schema on generated files, without spreading arbitrary storage fields.
  const checked=parseConfigBackup(JSON.stringify(file));
  return {...file,sitePreferences:checked.sitePreferences,tooltipPositions:checked.tooltipPositions,tooltipSizes:checked.tooltipSizes};
}
export function configSummary(data){
  return {profiles:data.settings.llmProfiles.map(profile=>{const {id,name,provider,model}=profile;return {id,name,provider,model,builtin:isBuiltinLlmProfile(profile)};}),activeLlmId:data.settings.activeLlmId,
    mode:data.settings.mode,targetLanguage:data.settings.targetLanguage,siteMode:data.settings.siteMode,
    sites:Object.keys(data.sitePreferences).length,positions:Object.keys(data.tooltipPositions).length,sizes:Object.keys(data.tooltipSizes).length,
    origins:data.settings.siteOrigins,uiLanguage:data.uiLanguage};
}
