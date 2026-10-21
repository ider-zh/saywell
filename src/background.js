import { mergeSettings, publicSettings, validateSettings, BASIC_KEY_IDS, BASIC_ORDER, llmKeyId, llmConfig } from './core/settings.js';
import { siteAllowed, routeAction,translationPair } from './core/language.js';
import { dayKey, recordMetric } from './core/analytics.js';
import { endpointURL, originPattern } from './core/security.js';
import { createBasicProviders } from './providers/basic.js';
import { processLLM } from './providers/llm.js';
import { BasicRouter } from './providers/router.js';
import {validTooltipPosition} from './core/tooltip-position.js';
import {validTooltipSize} from './core/tooltip-size.js';
import {validateSitePreferences,sitePreferencesFor,resolveSiteSettings} from './core/site-preferences.js';
import {exportConfigBackup,parseConfigBackup,configSummary} from './core/config-backup.js';
import {SETUP_ORIGINS,enableFreeSetup} from './core/setup.js';
import {HISTORY_LIMITS,historyLimit,historyResult,mergeHistory,trimHistory} from './core/history.js';

let writeQueue=Promise.resolve();
const basicProviders=createBasicProviders();
function serial(fn) { const result=writeQueue.then(fn); writeQueue=result.catch(()=>{}); return result; }
const ready=Promise.all([
  chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),
  chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
]);
const settings=async()=>mergeSettings((await chrome.storage.local.get('settings')).settings);
const granted=endpoint=>chrome.permissions.contains({origins:[originPattern(endpoint)]});
async function basicAccess(endpoint,id,sender){
  const latest=await settings();
  return Boolean(latest.basic[id]?.consent && latest.basic[id].endpoint===endpoint && (!sender || latest.enabled && await forSite(sender,latest)) && await granted(endpoint));
}
const trusted=sender=>Boolean(sender.url?.startsWith(chrome.runtime.getURL('')));
async function siteAccess(sender,s) {
  if (!sender.tab || !sender.url) return false;
  const u=new URL(sender.url);
  return ['https:','http:'].includes(u.protocol) && s.siteOrigins.some(p=>p === `${u.origin}/*` || p === `${u.protocol}//*/*`) && await chrome.permissions.contains({origins:[`${u.origin}/*`]});
}
const forSite=async(sender,s)=>await siteAccess(sender,s) && siteAllowed(new URL(sender.url).hostname,s);
async function preferencesFor(sender,s){
  if(!await siteAccess(sender,s))return {};
  return sitePreferencesFor((await chrome.storage.local.get('sitePreferences')).sitePreferences,new URL(sender.url).hostname.toLowerCase());
}
async function contentSettings(s,sender){
  const {uiLanguage,tooltipSizes,historyPreferences,historyGeneration}=await chrome.storage.local.get(['uiLanguage','tooltipSizes','historyPreferences','historyGeneration']),preferences=sender?await preferencesFor(sender,s):{};
  const size=sender && tooltipSizes?.[new URL(sender.url).hostname.toLowerCase()];
  return {...publicSettings(resolveSiteSettings(s,preferences)),sitePreferences:preferences,
    globalDefaults:{mode:s.mode,targetLanguage:s.targetLanguage,basicEngine:s.basicEngine,activeLlmId:s.activeLlmId},
    llmChoices:s.llmProfiles.map(({id,name,provider,model,enabled,consent})=>({id,name,provider,model,enabled,consent})),
    tooltipSize:validTooltipSize(size)?size:'small',uiLanguage:['en','zh-CN'].includes(uiLanguage)?uiLanguage:'auto',historyLimit:historyLimit(historyPreferences?.limit),historyGeneration:historyGeneration || 0};
}
async function withKeys(s) {
  const local=await chrome.storage.local.get('keys'), session=await chrome.storage.session.get('keys');
  const keys={...local.keys,...session.keys};
  return {...s,basic:Object.fromEntries(Object.entries(s.basic).map(([id,c])=>[id,{...c,key:keys[id] || ''}])),llm:{...s.llm,key:keys[llmKeyId(s.activeLlmId)] || ''},
    llmProfileKeys:Object.fromEntries(s.llmProfiles.map(p=>[p.id,keys[llmKeyId(p.id)] || '']))};
}
async function registerSites() {
  const s=await settings();
  const existing=await chrome.scripting.getRegisteredContentScripts();
  if (existing.length) await chrome.scripting.unregisterContentScripts({ids:existing.map(x=>x.id)});
  const origins=[];
  for (const p of s.siteOrigins) if (await chrome.permissions.contains({origins:[p]})) origins.push(p);
  if (origins.length) await chrome.scripting.registerContentScripts([{id:'input-coach',js:['content.js'],matches:origins,runAt:'document_idle',allFrames:true,persistAcrossSessions:true}]);
}

async function setupStatus(){
  const {setup,settings:raw}=await chrome.storage.local.get(['setup','settings']);
  const s=mergeSettings(raw),required=Boolean(setup?.required || !raw);
  const missing=[];for(const origin of s.siteOrigins)if(!await chrome.permissions.contains({origins:[origin]}))missing.push(origin);
  for(const config of [...s.llmProfiles,...Object.values(s.basic)])if(config.consent && config.endpoint && !await granted(config.endpoint))missing.push(originPattern(config.endpoint));
  return {needed:required || missing.length>0,initial:required,missing};
}
let badgeQueue=Promise.resolve();
function updateSetupBadge(){
  badgeQueue=badgeQueue.catch(()=>{}).then(async()=>{
    const {needed}=await setupStatus();
    const {uiLanguage}=await chrome.storage.local.get('uiLanguage');
    const zh=uiLanguage==='zh-CN' || (!uiLanguage || uiLanguage==='auto') && chrome.i18n?.getUILanguage().startsWith('zh');
    await chrome.action.setBadgeText({text:needed?'!':''});
    await chrome.action.setBadgeBackgroundColor({color:'#aa4d25'});
    await chrome.action.setTitle({title:needed?(zh?'Saywell · 需要网页授权，点击继续':'Saywell · Website permission needed — click to continue'):'Saywell'});
  });return badgeQueue;
}
async function activateOpenTabs(){
  for(const tab of await chrome.tabs.query({})){
    if(!tab.id || !/^https?:\/\//.test(tab.url || ''))continue;
    try{await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:['content.js']});}catch{/* Browser-restricted tabs remain unavailable. */}
  }
}

async function metric(sender,delta,day) {
  return serial(async()=>{
    const s=await settings();
    if (!s.analytics || !await forSite(sender,s)) return;
    const today=dayKey();
    // Delayed flushes may refer to yesterday, but cannot insert arbitrary date keys.
    const yesterday=dayKey(new Date(Date.now()-86400000));
    const date=[today,yesterday].includes(day) ? day : today;
    const analytics=(await chrome.storage.local.get('analytics')).analytics || {};
    recordMetric(analytics,date,new URL(sender.url).hostname,delta);
    await chrome.storage.local.set({analytics});
  });
}

async function handle(message,sender) {
  await ready;
  if (!message || typeof message.type !== 'string') throw new Error('Invalid message.');
  const isUI=trusted(sender), s=await settings();
  if (message.type === 'public-settings') return contentSettings(s,sender);
  if(message.type==='record-history')return serial(async()=>{
    const latest=await settings();if(!latest.enabled || !await forSite(sender,latest))throw new Error('Website is excluded.');
    const data=await chrome.storage.local.get(['translationHistory','historyPreferences','historyGeneration']),limit=historyLimit(data.historyPreferences?.limit);
    if(!limit || message.generation!==(data.historyGeneration || 0))return false;
    if(typeof message.requestId!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(message.requestId) || typeof message.source!=='string' || !message.source.trim() || message.source.length>6000 || !['en','zh'].includes(message.targetLanguage) || !['translate','polish','explain'].includes(message.action) || !['mt','llm'].includes(message.lane))throw new Error('Invalid history entry.');
    const id=`${sender.tab.id}-${sender.frameId || 0}-${message.requestId}`;
    const entry={id,createdAt:new Date().toISOString(),hostname:new URL(sender.url).hostname,source:message.source,targetLanguage:message.targetLanguage,action:message.action};
    const records=mergeHistory(data.translationHistory || [],entry,message.lane,historyResult(message.result),limit);
    try{await chrome.storage.local.set({translationHistory:records});await chrome.storage.session.remove('historyWriteError');}
    catch{await chrome.storage.session.set({historyWriteError:true});return false;}
    return true;
  });
  if(message.type==='set-site-preferences')return serial(async()=>{
    const latest=await settings();
    if(!await siteAccess(sender,latest))throw new Error('Grant website access first.');
    const host=new URL(sender.url).hostname.toLowerCase();
    const preferences=message.preferences===null?{}:validateSitePreferences(message.preferences,latest.llmProfiles);
    const stored=(await chrome.storage.local.get('sitePreferences')).sitePreferences || {};
    const entries=Object.entries(stored).filter(([key])=>key!==host);
    if(Object.keys(preferences).length){
      if(entries.length>=300)throw new Error('Website settings limit reached. Reset an unused website first.');
      entries.push([host,preferences]);
    }
    await chrome.storage.local.set({sitePreferences:Object.fromEntries(entries)});
    return contentSettings(latest,sender);
  });
  if(message.type==='set-tooltip-size')return serial(async()=>{
    if(!await siteAccess(sender,await settings()))throw new Error('Grant website access first.');
    if(!validTooltipSize(message.size))throw new Error('Invalid tooltip size.');
    const host=new URL(sender.url).hostname.toLowerCase(),saved=(await chrome.storage.local.get('tooltipSizes')).tooltipSizes || {};
    const entries=Object.entries(saved).filter(([key,value])=>key!==host && validTooltipSize(value));entries.push([host,message.size]);
    await chrome.storage.local.set({tooltipSizes:Object.fromEntries(entries.slice(-200))});return message.size;
  });
  if(['get-tooltip-position','set-tooltip-position'].includes(message.type))return serial(async()=>{
    if(!await siteAccess(sender,await settings()))throw new Error('Grant website access first.');
    // The browser-provided sender determines the exact hostname, including for blocked-site panels.
    const host=new URL(sender.url).hostname.toLowerCase();
    const saved=(await chrome.storage.local.get('tooltipPositions')).tooltipPositions || {};
    if(message.type==='get-tooltip-position'){
      const value=Object.hasOwn(saved,host)?saved[host]:null;
      return validTooltipPosition(value)?{x:value.x,y:value.y}:null;
    }
    const value=message.position;
    if(value!==null && !validTooltipPosition(value))throw new Error('Invalid tooltip position.');
    const entries=Object.entries(saved).filter(([key,position])=>key!==host && validTooltipPosition(position)).map(([key,position])=>[key,{x:position.x,y:position.y}]);
    if(value!==null)entries.push([host,{x:value.x,y:value.y}]);
    await chrome.storage.local.set({tooltipPositions:Object.fromEntries(entries.slice(-200))});
    return true;
  });
  if(message.type==='set-site-blocked')return serial(async()=>{
    if(typeof message.blocked!=='boolean')throw new Error('Invalid blacklist action.');
    const latest=await settings();let target=sender;
    if(isUI){
      if(!Number.isInteger(message.tabId))throw new Error('Open a website to manage its blacklist status.');
      const tab=await chrome.tabs.get(message.tabId);target={tab,url:tab.url};
    }
    if(!await siteAccess(target,latest))throw new Error('Grant website access first.');
    if(latest.siteMode!=='blacklist')throw new Error('Switch to blacklist mode to use this control.');
    // Content scripts can only change their own exact hostname, never an arbitrary or wildcard rule.
    const host=new URL(target.url).hostname.toLowerCase();
    const blocklist=message.blocked?[...new Set([...latest.blocklist,host])]:latest.blocklist.filter(rule=>rule.toLowerCase()!==host);
    const next=validateSettings({...latest,blocklist});await chrome.storage.local.set({settings:next});return contentSettings(next,target);
  });
  if (message.type === 'open-settings') { await chrome.runtime.openOptionsPage(); return true; }
  if (message.type === 'engine-used') {
    if (await forSite(sender,s) && typeof message.engine === 'string') await chrome.storage.local.set({lastEngine:message.engine.slice(0,60)});
    return true;
  }
  if (message.type === 'metric') { await metric(sender,message.delta || {},message.day); return true; }
  if (message.type === 'suggest') {
    if (!s.enabled || !await forSite(sender,s)) throw new Error('Suggestions are paused or this website is excluded.');
    const text=message.text;
    if (typeof text !== 'string' || !text.trim() || text.length > 6000) throw new Error('Use between 1 and 6,000 characters.');
    const effective=resolveSiteSettings(s,await preferencesFor(sender,s));
    const mode=['auto','translate','polish','explain'].includes(message.mode) ? message.mode : effective.mode;
    const action=routeAction(text,mode,effective.llm.enabled,effective.targetLanguage);
    if (action.action === 'none') return null;
    const config=await withKeys(effective);
    if(message.lane!==undefined && !['mt','llm'].includes(message.lane))throw new Error('Invalid processing lane.');
    if(message.lane==='mt'){
      if(action.action==='explain' || translationPair(text,effective.targetLanguage).source===effective.targetLanguage)return null;
    }else{
      if (effective.llm.enabled && effective.llm.consent) return runLLM(text,config,{...action,targetLanguage:effective.targetLanguage,style:effective.style,difficulty:effective.difficulty,maxWords:effective.maxWords});
      if (message.lane==='llm' || action.needsLLM) throw new Error('Polish and Explain need a connected, enabled LLM service.');
    }
    const health=(await chrome.storage.session.get('health')).health || {};
    const router=new BasicRouter(basicProviders,{health});
    try {
      const result=await router.translate(text,config,(endpoint,id)=>basicAccess(endpoint,id,sender));
      await chrome.storage.session.set({basicStatus:{at:Date.now(),engine:result.engine,attempts:result.attempts}});
      await chrome.storage.local.set({lastEngine:result.engine});return {...result,action:message.lane==='mt'?'translate':action.action};
    }catch(e){await chrome.storage.session.set({basicStatus:{at:Date.now(),attempts:e.attempts || [],error:e.message}});throw e;}
    finally { await chrome.storage.session.set({health:router.health}); }
  }
  if (message.type === 'vocabulary') {
    if (!isUI && !await forSite(sender,s)) throw new Error('Website is excluded.');
    const {word,meaning,explanation,pronunciation,example}=message.item || {};
    if (typeof word !== 'string' || !word.trim() || word.length>80) throw new Error('Invalid vocabulary item.');
    return serial(async()=>{
      const vocabulary=(await chrome.storage.local.get('vocabulary')).vocabulary || [];
      const item={word:word.trim(),meaning:String(meaning || '').slice(0,160),explanation:String(explanation || '').slice(0,240),pronunciation:String(pronunciation || '').slice(0,100),example:String(example || '').slice(0,240),status:message.known ? 'known' : 'saved',date:dayKey()};
      if (message.includeContext === true && typeof message.context === 'string') item.context=message.context.slice(0,2000);
      const filtered=vocabulary.filter(v=>v.word.toLowerCase()!==word.trim().toLowerCase());
      await chrome.storage.local.set({vocabulary:[item,...filtered].slice(0,2000)}); return true;
    });
  }
  if (!isUI) throw new Error('This action is only available from extension pages.');
  if(message.type==='get-history')return serial(async()=>{
    const data=await chrome.storage.local.get(['translationHistory','historyPreferences']);
    return {records:data.translationHistory || [],limit:historyLimit(data.historyPreferences?.limit),writeError:Boolean((await chrome.storage.session.get('historyWriteError')).historyWriteError)};
  });
  if(['clear-history','remove-history','set-history-limit'].includes(message.type))return serial(async()=>{
    const data=await chrome.storage.local.get(['translationHistory','historyPreferences','historyGeneration']);let records=data.translationHistory || [],limit=historyLimit(data.historyPreferences?.limit);
    if(message.type==='set-history-limit'){
      if(!HISTORY_LIMITS.includes(message.limit))throw new Error('Invalid history limit.');limit=message.limit;if(limit)records=trimHistory(records,limit);
    }else if(message.type==='remove-history'){
      if(typeof message.id!=='string' || message.id.length>120)throw new Error('Invalid history entry.');records=records.filter(row=>row.id!==message.id);
    }else records=[];
    await chrome.storage.local.set({translationHistory:records,historyPreferences:{limit},historyGeneration:(data.historyGeneration || 0)+1});await chrome.storage.session.remove('historyWriteError');return true;
  });
  if(message.type==='setup-status')return setupStatus();
  if(message.type==='complete-setup')return serial(async()=>{
    const current=await setupStatus();
    if(current.initial?!await chrome.permissions.contains({origins:SETUP_ORIGINS}):current.missing.length>0)throw new Error('Website permission was not granted.');
    // A retry after revoked permissions restores access without resetting user choices.
    if(current.initial)await chrome.storage.local.set({settings:validateSettings(enableFreeSetup(await settings())),setup:{required:false}});
    await registerSites();await updateSetupBadge();await activateOpenTabs();return true;
  });
  if(message.type==='export-config')return serial(async()=>exportConfigBackup(await settings(),await chrome.storage.local.get(['uiLanguage','sitePreferences','tooltipPositions','tooltipSizes'])));
  if(message.type==='inspect-config'){
    const data=parseConfigBackup(message.text),summary=configSummary(data);
    summary.missingOrigins=(await Promise.all(summary.origins.map(async origin=>await chrome.permissions.contains({origins:[origin]})?null:origin))).filter(Boolean);
    return summary;
  }
  if(message.type==='import-config')return serial(async()=>{
    const data=parseConfigBackup(message.text),previous=await settings(),next=data.settings;
    const requested=[...next.siteOrigins];
    next.siteOrigins=(await Promise.all(requested.map(async origin=>await chrome.permissions.contains({origins:[origin]})?origin:null))).filter(Boolean);
    const local=(await chrome.storage.local.get('keys')).keys || {},session=(await chrome.storage.session.get('keys')).keys || {};
    const nextLocal={...local},nextSession={...session};
    // Preserve only same-identity credentials already on this device, with their existing storage choice.
    for(const id of new Set([...Object.keys(local),...Object.keys(session)]))if(BASIC_KEY_IDS.includes(id) || id==='llm' || id.startsWith('llm:')){delete nextLocal[id];delete nextSession[id];}
    const retain=(id,config,old,same)=>{
      config.consent=false;config.rememberKey=Boolean(same && old.rememberKey);
      const key=same?(session[id] || local[id] || ''):'';
      if(key)(config.rememberKey?nextLocal:nextSession)[id]=key;
    };
    for(const[id,config]of Object.entries(next.basic)){
      config.consent=false;
      if(BASIC_KEY_IDS.includes(id))retain(id,config,previous.basic[id],config.endpoint===previous.basic[id].endpoint);
    }
    for(const profile of next.llmProfiles){const old=previous.llmProfiles.find(p=>p.id===profile.id);retain(llmKeyId(profile.id),profile,old,Boolean(old && old.provider===profile.provider && old.endpoint===profile.endpoint));}
    next.llm=llmConfig(next.llmProfiles.find(p=>p.id===next.activeLlmId));
    await chrome.storage.local.set({settings:next,keys:nextLocal,uiLanguage:data.uiLanguage,sitePreferences:data.sitePreferences,tooltipPositions:data.tooltipPositions,tooltipSizes:data.tooltipSizes});
    await chrome.storage.session.set({keys:nextSession,health:{},llmHealth:{}});await chrome.storage.session.remove('basicStatus');
    await registerSites();return {skippedOrigins:requested.filter(origin=>!next.siteOrigins.includes(origin)).length};
  });
  if (message.type === 'state') {
    const data=await chrome.storage.local.get(['analytics','vocabulary','lastEngine','usage']);
    const keys=await withKeys(s);
    return {...data,...await chrome.storage.session.get('basicStatus'),settings:s,hasProfileKeys:Object.fromEntries(Object.entries(keys.llmProfileKeys).map(([id,key])=>[id,Boolean(key)])),hasKeys:{llm:Boolean(keys.llm.key),...Object.fromEntries(BASIC_KEY_IDS.map(id=>[id,Boolean(keys.basic[id].key)]))}};
  }
  if(message.type==='set-site-mode')return serial(async()=>{
    if(!['blacklist','whitelist'].includes(message.mode))throw new Error('Invalid siteMode.');
    await chrome.storage.local.set({settings:{...await settings(),siteMode:message.mode}});return true;
  });
  if(message.type==='set-target-language')return serial(async()=>{
    if(!['en','zh'].includes(message.targetLanguage))throw new Error('Invalid target language.');
    await chrome.storage.local.set({settings:{...await settings(),targetLanguage:message.targetLanguage}});return true;
  });
  if(message.type==='activate-llm-profile')return serial(async()=>{
    const latest=await settings(),profile=latest.llmProfiles.find(p=>p.id===message.profileId);
    if(!profile)throw new Error('Invalid LLM configuration.');
    await chrome.storage.local.set({settings:{...latest,activeLlmId:profile.id,llm:llmConfig(profile)}});return true;
  });
  if (message.type === 'save-settings') return serial(async()=>{
    const previous=await settings(); const next=validateSettings(mergeSettings(message.settings));
    for (const c of [...next.llmProfiles,...Object.values(next.basic)]) if (c.endpoint) endpointURL(c.endpoint);
    // UI is required to grant a new origin and opt in again before saving changed endpoints.
    for (const c of [...next.llmProfiles,...Object.values(next.basic)]) if (c.consent && (!c.endpoint || !await granted(c.endpoint))) throw new Error('Grant endpoint access before authorizing text transmission.');
    for (const p of next.siteOrigins) {
      if (!/^https?:\/\/[^/]+\/\*$/.test(p) || !await chrome.permissions.contains({origins:[p]})) throw new Error('Grant website access first.');
    }
    const local=(await chrome.storage.local.get('keys')).keys || {}, session=(await chrome.storage.session.get('keys')).keys || {};
    for (const id of BASIC_KEY_IDS) {
      const cfg=next.basic[id];
      const prev=previous.basic[id];
      const supplied=message.keys?.[id];
      const key=typeof supplied === 'string' ? supplied.slice(0,4096) : (cfg.endpoint === prev.endpoint ? session[id] || local[id] || '' : '');
      delete local[id]; delete session[id]; (cfg.rememberKey ? local : session)[id]=key;
    }
    const retained=new Set(next.llmProfiles.map(p=>llmKeyId(p.id)));
    for(const id of new Set([...Object.keys(local),...Object.keys(session)]))if((id==='llm' || id.startsWith('llm:')) && !retained.has(id)){delete local[id];delete session[id];}
    for(const cfg of next.llmProfiles){
      const id=llmKeyId(cfg.id),prev=previous.llmProfiles.find(p=>p.id===cfg.id);
      const supplied=message.profileKeys?.[cfg.id] ?? (cfg.id===next.activeLlmId?message.keys?.llm:undefined);
      const same=prev && cfg.endpoint===prev.endpoint && cfg.provider===prev.provider;
      const key=typeof supplied==='string'?supplied.slice(0,4096):same?session[id] || local[id] || '':'';
      delete local[id];delete session[id];(cfg.rememberKey?local:session)[id]=key;
    }
    await chrome.storage.local.set({settings:next,keys:local}); await chrome.storage.session.set({keys:session,health:{},llmHealth:{}});
    await registerSites(); return true;
  });
  if (message.type === 'toggle') { await serial(async()=>chrome.storage.local.set({settings:{...await settings(),enabled:message.enabled === true}})); return true; }
  if (message.type === 'sync-sites') { await registerSites(); return true; }
  if (message.type === 'test-llm') {
    // Saved configuration only: the displayed test sentence is the sole content sent.
    await chrome.storage.session.set({llmHealth:{}});
    const id=message.profileId ?? s.activeLlmId,profile=s.llmProfiles.find(p=>p.id===id);
    if(!profile)throw new Error('Invalid LLM configuration.');
    const result=await runLLM('This is a connection test.',await withKeys({...s,activeLlmId:id,llm:llmConfig(profile)}),{action:'translate',targetLanguage:s.targetLanguage,style:s.style,difficulty:s.difficulty,maxWords:0});
    return {engine:result.engine,ok:true};
  }
  if (message.type === 'test-basic') {
    const id=message.id;
    if (!['auto',...BASIC_ORDER].includes(id)) throw new Error('Choose an external basic provider.');
    await chrome.storage.session.set({health:{}});
    const router=new BasicRouter(basicProviders);
    try{
      const result=await router.translate(s.targetLanguage==='zh'?'Hello, world.':'你好，世界。',{...await withKeys(s),basicEngine:id,basicFallback:id==='auto'},(endpoint,id)=>basicAccess(endpoint,id));
      await chrome.storage.session.set({basicStatus:{at:Date.now(),engine:result.engine,attempts:result.attempts}});return result;
    }catch(e){await chrome.storage.session.set({basicStatus:{at:Date.now(),attempts:e.attempts || [],error:e.message}});throw e;}
    finally{await chrome.storage.session.set({health:router.health});}
  }
  if (message.type === 'forget-keys') { await chrome.storage.local.remove('keys'); await chrome.storage.session.remove('keys'); return true; }
  if (message.type === 'reset-data') { await serial(()=>chrome.storage.local.remove(['analytics','vocabulary','usage','lastEngine'])); return true; }
  if (message.type === 'remove-word') { await serial(async()=>{const v=(await chrome.storage.local.get('vocabulary')).vocabulary || [];await chrome.storage.local.set({vocabulary:v.filter(x=>x.word!==message.word)});}); return true; }
  throw new Error('Unknown action.');
}

async function runLLM(text,s,request) {
  if (!s.llm.enabled || !s.llm.consent || !await granted(s.llm.endpoint)) throw new Error('Connect the LLM service in Settings before using it.');
  const healthId=s.activeLlmId,h=((await chrome.storage.session.get('llmHealth')).llmHealth || {})[healthId] || {};
  if (h.blocked || h.until>Date.now()) throw new Error(h.message || 'LLM unavailable or cooling down. Check configuration and use Connect and test in Settings.');
  await serial(async()=>{
    const usage=(await chrome.storage.local.get('usage')).usage || {};
    const day=dayKey(),sameDay=usage.day===day,profiles=sameDay?usage.profiles || {}:{};
    const count=profiles[healthId] ?? (sameDay && healthId==='default' && !usage.profiles?usage.requests || 0:0);
    if (s.llm.dailyRequests && count>=s.llm.dailyRequests) throw new Error('Your local daily LLM request limit is reached.');
    await chrome.storage.local.set({usage:{day,requests:(sameDay?usage.requests || 0:0)+1,profiles:{...profiles,[healthId]:count+1}}});
  });
  const vocabulary=(await chrome.storage.local.get('vocabulary')).vocabulary || [];
  try {
    const result=await processLLM(text,s.llm,{...request,known:vocabulary.filter(v=>v.status==='known').map(v=>v.word)});
    await updateLLMHealth(healthId,{failures:0});
    await chrome.storage.local.set({lastEngine:result.engine});
    return {...result,action:request.action};
  } catch(e) {
    const failures=(h.failures || 0)+1;
    await updateLLMHealth(healthId,{failures,blocked:['auth','request'].includes(e.code),until:Date.now()+(['rate','quota'].includes(e.code) ? e.retryAfter || 60000 : failures>=2 ? 60000 : 0),...(['rate','quota'].includes(e.code)?{message:e.message}: {})});
    throw e;
  }
}

async function updateLLMHealth(id,value){return serial(async()=>{
  const health=(await chrome.storage.session.get('llmHealth')).llmHealth || {};
  await chrome.storage.session.set({llmHealth:{...health,[id]:value}});
});}

chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  handle(message,sender).then(data=>reply({ok:true,data}),error=>reply({ok:false,error:error.message})); return true;
});
chrome.runtime.onInstalled.addListener(details=>{
  return serial(async()=>{
    const {settings:raw}=await chrome.storage.local.get('settings');
    if(!raw)await chrome.storage.local.set({settings:mergeSettings(),setup:{required:true}});
    await registerSites();await updateSetupBadge();
    if(details.reason==='install')await chrome.tabs.create({url:chrome.runtime.getURL('welcome.html')});
  }).catch(()=>{});
});
chrome.runtime.onStartup.addListener(()=>{ registerSites().then(updateSetupBadge).catch(()=>{}); });
chrome.permissions.onRemoved.addListener(()=>{ registerSites().then(updateSetupBadge).catch(()=>{}); });
chrome.permissions.onAdded.addListener(()=>{ updateSetupBadge().catch(()=>{}); });
chrome.storage.onChanged.addListener(async(changes,area)=>{
  if(area==='local' && (changes.settings || changes.setup || changes.uiLanguage))updateSetupBadge().catch(()=>{});
  if(area!=='local' || (!changes.settings && !changes.uiLanguage && !changes.sitePreferences && !changes.tooltipSizes && !changes.historyPreferences && !changes.historyGeneration))return;
  // Every frame fetches its own effective settings, rather than receiving other hosts' preferences.
  for(const tab of await chrome.tabs.query({})) if(tab.id) chrome.tabs.sendMessage(tab.id,{type:'settings-updated'}).catch(()=>{});
});
updateSetupBadge().catch(()=>{});
chrome.commands.onCommand.addListener(async command=>{
  if (command!=='suggest') return;
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if (tab?.id) chrome.tabs.sendMessage(tab.id,{type:'manual-suggest'}).catch(()=>{});
});
