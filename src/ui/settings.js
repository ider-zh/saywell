import {send,$,text,status,toast,el,download,previewNotice,t,initLocale} from './shared.js';
import {mountSetup} from './setup.js';
import {mergeSettings,validateSettings,BASIC_KEY_IDS,BASIC_ORDER,DEFAULTS,llmConfig} from '../core/settings.js';
import {originPattern,endpointURL} from '../core/security.js';
import {builtin} from '../providers/builtin.js';
import {LLM_PROVIDERS} from '../core/llm-providers.js';
import {CONFIG_FILE_LIMIT} from '../core/config-backup.js';
import {HOSTED_AI_ENDPOINT,LEGACY_HOSTED_AI_ENDPOINT} from '../core/hosted-ai.js';
let state={settings:mergeSettings(),hasKeys:{}},s=state.settings;
let editingId=s.activeLlmId,pendingProfileKeys={};
let pendingImport=null,importRevision=0;
let saveTimer,editRevision=0,saveQueue=Promise.resolve(),savePending=0,loaded=false;
const edited=()=>s.llmProfiles.find(p=>p.id===editingId);
await initLocale();
const topFields=['basicEngine','basicFallback','siteMode','mode','targetLanguage','style','debounce','difficulty','maxWords','dailyGoal','autoSuggest','analytics','enabled'];
const KEY_IDS=['llm',...BASIC_KEY_IDS];
const providerName=id=>({googleweb:'Google Translate (web, experimental)',bing:'Microsoft Bing (web, experimental)',microsoft:'Microsoft Edge (experimental)',mymemory:'MyMemory',libre:'LibreTranslate',azure:'Microsoft Azure',google:'Google Cloud'}[id] || id);
const llmFields=['provider','model','endpoint','thinking','thinkingProtocol','temperature','timeout','maxTokens','dailyRequests','enabled'];
const numberFields=['debounce','maxWords','dailyGoal','maxTokens','dailyRequests'];
function getValue(id){const e=$('#'+id);return e.type==='checkbox'?e.checked:e.value;}
function putValue(id,value){const e=$('#'+id);if(e.type==='checkbox')e.checked=Boolean(value);else e.value=value ?? '';}
function render(){
  topFields.forEach(k=>putValue(k,s[k]));
  renderProfileForm();
  for(const id of BASIC_KEY_IDS)putValue(id+'-remember',s.basic[id].rememberKey);
  renderKeyHints();renderLLMProvider();
  putValue('azure-region',s.basic.azure.region);for(const id of ['libre','googleweb','bing'])putValue(id+'-endpoint',s.basic[id].endpoint);putValue('allowlist',s.allowlist.join('\n'));putValue('blocklist',s.blocklist.join('\n'));renderConsent();renderSites();renderSitePolicy();renderOrder();renderDiagnostics();
}
function renderKeyHints(){for(const id of KEY_IDS){const has=id==='llm'?state.hasProfileKeys?.[editingId] ?? (editingId===s.activeLlmId && state.hasKeys.llm):state.hasKeys[id];$('#'+id+'-key').placeholder=t(has?'Key is set · leave blank to keep it':'Enter key (session-only by default)');}}
function renderProfiles(){
  $('#llm-profile').replaceChildren(...s.llmProfiles.map(p=>{const option=el('option',`${p.name==='Default configuration'?t(p.name):p.name}${p.id===s.activeLlmId?' · '+t('Active'):''}`);option.value=p.id;return option;}));
  putValue('llm-profile',editingId);$('#remove-llm-profile').disabled=s.llmProfiles.length===1;
  $('#add-llm-profile').disabled=s.llmProfiles.length>=20;
  text('#active-llm-profile',t('Active configuration: {name}',{name:s.llmProfiles.find(p=>p.id===s.activeLlmId)?.name==='Default configuration'?t('Default configuration'):s.llmProfiles.find(p=>p.id===s.activeLlmId)?.name}));
  $('#activate-llm-profile').disabled=editingId===s.activeLlmId;
}
function renderProfileForm(){
  if(!edited())editingId=s.activeLlmId;
  const p=edited();llmFields.forEach(k=>putValue('llm-'+k,k==='timeout'?p[k]/1000:p[k]));
  putValue('llm-profile-name',p.name);putValue('llm-remember',p.rememberKey);putValue('llm-key',pendingProfileKeys[editingId] || '');renderProfiles();
}
document.addEventListener('input-coach-languagechange',()=>{renderProfiles();renderKeyHints();renderLLMProvider();renderConsent();renderSites();renderSitePolicy();renderOrder();renderDiagnostics();renderImportPreview();});
function renderLLMProvider(){
  const preset=LLM_PROVIDERS[getValue('llm-provider')] || LLM_PROVIDERS.compatible;
  const hosted=getValue('llm-provider')==='saywell';$('#llm-model').readOnly=hosted;
  $('#llm-maxTokens').max=hosted?'800':'8000';if(hosted && Number(getValue('llm-maxTokens'))>800)putValue('llm-maxTokens',800);
  $('#llm-thinkingProtocol').disabled=hosted;
  $('#llm-key').closest('label').classList.toggle('hidden',hosted);$('#llm-remember').closest('label').classList.toggle('hidden',hosted);
  $('#llm-model').removeAttribute('data-i18n-placeholder');
  $('#llm-model').placeholder=preset.example?t('Example: {model}',{model:preset.example}):t('Your model ID');
  const help=$('#llm-provider-help');help.replaceChildren();
  if(preset.help)help.append(el('span',t(preset.help)));
  if(hosted && getValue('llm-endpoint')===LEGACY_HOSTED_AI_ENDPOINT)help.append(el('p',t('This configuration uses the old free AI address. Connect and test will switch it to {endpoint} and request access if needed.',{endpoint:HOSTED_AI_ENDPOINT}),'endpoint-update'));
  for(const[key,label]of [['console','Provider console / models'],['docs','API documentation']])if(preset[key]){
    const link=el('a',t(label));link.href=preset[key];link.target='_blank';link.rel='noopener noreferrer';help.append(document.createTextNode(' '),link);
  }
  help.classList.toggle('hidden',!preset.help);
}
function renderSitePolicy(){
  const blacklist=getValue('siteMode')==='blacklist';$('#allowlist').disabled=blacklist;
  text('#site-policy-help',blacklist?'Blacklist mode is the default: run on granted websites except blocked hosts. Grant all-website access once to avoid enabling sites individually.':'Whitelist mode: only listed hosts can translate or count input. An empty whitelist enables no websites. Blacklist rules still take priority.');
  text('#all-sites',blacklist?'Enable blacklist mode on all websites':'Grant access on all websites');$('#all-sites').classList.toggle('primary',blacklist);
}
$('#siteMode').addEventListener('change',renderSitePolicy);
function renderConsent(){for(const id of [...BASIC_ORDER,'llm']){
  const cfg=id==='llm'?edited():s.basic[id];
  text('#'+id+'-state',!cfg.consent?'Service not connected':id==='llm' && !cfg.enabled?'Service paused':'Service enabled');
  $(`[data-revoke="${id}"]`).classList.toggle('hidden',!cfg.consent);
}}
function renderOrder(){
  $('#basic-order').replaceChildren();s.basicOrder.forEach((id,index)=>{
    const row=el('li'),name=el('span',`${index+1}. ${t(providerName(id))} · ${t(s.basic[id].consent?'Service enabled':'Service not connected')}`);
    const up=el('button',t('Move up')),down=el('button',t('Move down'));up.type=down.type='button';up.disabled=index===0;down.disabled=index===s.basicOrder.length-1;
    up.setAttribute('aria-label',t('Move {provider} up',{provider:t(providerName(id))}));down.setAttribute('aria-label',t('Move {provider} down',{provider:t(providerName(id))}));
    const move=offset=>{const order=[...s.basicOrder];[order[index],order[index+offset]]=[order[index+offset],order[index]];s.basicOrder=order;renderOrder();scheduleSave();};
    up.addEventListener('click',()=>move(-1));down.addEventListener('click',()=>move(1));row.append(name,up,down);$('#basic-order').append(row);
  });
}
function renderDiagnostics(){
  const area=$('#basic-diagnostics');area.replaceChildren();
  if(!state.basicStatus){area.append(el('p',t('No engine test yet. Test fallback to check connectivity.'),'help'));return;}
  const labels={success:'Available',permission:'Host permission missing',cooldown:'Cooling down',auth:'Check credentials / authorization',rate:'Rate limited',quota:'Quota exhausted',length:'Input exceeds provider limit',unavailable:'Not available',network:'Network error',timeout:'Request timed out',request:'Request rejected',server:'Server error',response:'Invalid response'};
  for(const attempt of state.basicStatus.attempts || [])area.append(el('p',`${t(attempt.engine)} · ${t(labels[attempt.status] || 'Not available')}`,'help'));
  if(state.basicStatus.engine)area.append(el('p',t('Result engine: {engine}',{engine:t(state.basicStatus.engine)}),'help'));
}
function collect(){
  for(const k of topFields)s[k]=numberFields.includes(k)?Number(getValue(k)):getValue(k);
  const profile=edited();profile.name=getValue('llm-profile-name').trim();
  for(const k of llmFields){let value=getValue('llm-'+k);if(numberFields.includes(k))value=Number(value);if(k==='temperature')value=value===''?null:Number(value);if(k==='timeout')value=Number(value)*1000;profile[k]=value;}
  for(const id of ['libre','googleweb','bing'])s.basic[id].endpoint=getValue(id+'-endpoint').trim();profile.endpoint=profile.endpoint.trim();
  s.basic.azure.region=getValue('azure-region').trim().toLowerCase();
  for(const id of KEY_IDS)(id==='llm'?profile:s.basic[id]).rememberKey=getValue(id+'-remember');
  if(getValue('llm-key'))pendingProfileKeys[editingId]=getValue('llm-key');else delete pendingProfileKeys[editingId];
  s.llm=llmConfig(s.llmProfiles.find(p=>p.id===s.activeLlmId));
  for(const k of ['allowlist','blocklist'])s[k]=getValue(k).split(/[\n,]+/).map(v=>v.trim().toLowerCase()).filter(Boolean);
  for(const host of [...s.allowlist,...s.blocklist])if(!/^(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host))throw new Error('Host rules must be hostnames, optionally starting with *., without URLs or paths.');
  return s;
}
function save({auto=false}={}){
  clearTimeout(saveTimer);
  if(pendingImport)throw new Error('Finish or cancel configuration import before saving preferences.');
  for(const id of persistedFields){const field=$('#'+id);if(field && !(auto?field.checkValidity():field.reportValidity()))throw new Error('Check the highlighted setting.');}
  const snapshot=structuredClone(validateSettings(collect())),profileKeys={...pendingProfileKeys},revision=editRevision,profileId=editingId;
  const keys={};for(const id of BASIC_KEY_IDS)if(getValue(id+'-key'))keys[id]=getValue(id+'-key');
  savePending++;
  const operation=saveQueue.catch(()=>{}).then(async()=>{
    await send('save-settings',{settings:snapshot,keys,profileKeys});
    const latest=await send('state');
    if(revision===editRevision){
      for(const id of Object.keys(keys))if(getValue(id+'-key')===keys[id])putValue(id+'-key','');
      for(const[id,key]of Object.entries(profileKeys))if(pendingProfileKeys[id]===key){delete pendingProfileKeys[id];if(editingId===id && getValue('llm-key')===key)putValue('llm-key','');}
    }
    state={...state,...latest};
    // Acknowledgement must never replace newer edits or move the typing cursor.
    if(revision===editRevision && !pendingImport){
      if(!auto && editingId===profileId){s=latest.settings;render();}else{renderKeyHints();renderProfiles();renderConsent();renderOrder();}
      status('Preferences saved.');toast('Preferences saved.');
    }
  }).finally(()=>{savePending--;});saveQueue=operation;return operation;
}
function scheduleSave(){
  editRevision++;clearTimeout(saveTimer);if(!loaded || pendingImport)return;
  status('Saving changes…');saveTimer=setTimeout(()=>{
    try{Promise.resolve(save({auto:true})).catch(saveFailure);}catch(error){saveFailure(error);}
  },650);
}
function saveFailure(error){status(error.message,true);toast('Changes could not be saved. Check the setting and try again.',true);}
const persistedFields=new Set([...topFields,...llmFields.map(k=>'llm-'+k),'llm-profile-name','llm-key','llm-remember','azure-region','allowlist','blocklist',...BASIC_KEY_IDS.flatMap(id=>[id+'-key',id+'-remember']),...['libre','googleweb','bing'].map(id=>id+'-endpoint')]);
for(const event of ['input','change'])$('#settings-form').addEventListener(event,e=>{if(persistedFields.has(e.target.id))scheduleSave();});
document.addEventListener('input-coach-languagesaved',()=>toast('Preferences saved.'));
function task(fn){return async e=>{const b=e?.currentTarget;try{if(b)b.disabled=true;await fn(e);}catch(error){status(error.message,true);}finally{if(b){b.disabled=false;if(['activate-llm-profile','remove-llm-profile'].includes(b.id))renderProfiles();}}};}
$('#settings-form').addEventListener('submit',task(async e=>{e.preventDefault();await save();}));
for(const key of ['llm','libre','googleweb','bing'])$('#'+key+'-endpoint').addEventListener('input',()=>{(key==='llm'?edited():s.basic[key]).consent=false;if(key==='llm'){state.hasProfileKeys={...state.hasProfileKeys,[editingId]:false};renderKeyHints();}renderConsent();});
$('#llm-provider').addEventListener('change',()=>{
  const kind=getValue('llm-provider');
  putValue('llm-endpoint',LLM_PROVIDERS[kind].endpoint);putValue('llm-model',LLM_PROVIDERS[kind].model || '');putValue('llm-key','');delete pendingProfileKeys[editingId];edited().consent=false;state.hasProfileKeys={...state.hasProfileKeys,[editingId]:false};renderKeyHints();renderConsent();renderLLMProvider();
});

$('#llm-profile').addEventListener('change',()=>{const next=getValue('llm-profile');collect();editingId=next;renderProfileForm();renderKeyHints();renderLLMProvider();renderConsent();});
$('#llm-profile-name').addEventListener('input',()=>{edited().name=getValue('llm-profile-name');renderProfiles();});
if(globalThis.chrome?.runtime?.id)chrome.storage.onChanged.addListener((changes,area)=>{
  const id=changes.settings?.newValue?.activeLlmId;
  if(!savePending && area==='local' && id && id!==s.activeLlmId && s.llmProfiles.some(p=>p.id===id)){
    s.activeLlmId=id;s.llm=llmConfig(s.llmProfiles.find(p=>p.id===id));renderProfiles();
  }
});
$('#add-llm-profile').addEventListener('click',()=>{if(s.llmProfiles.length>=20)return;collect();const p={...DEFAULTS.llm,id:crypto.randomUUID(),name:t('Configuration {number}',{number:s.llmProfiles.length+1})};s.llmProfiles.push(p);editingId=p.id;renderProfileForm();renderKeyHints();renderLLMProvider();renderConsent();scheduleSave();});
$('#activate-llm-profile').addEventListener('click',task(async()=>{collect();s.activeLlmId=editingId;await save();status('Active configuration saved.');}));
$('#remove-llm-profile').addEventListener('click',task(async()=>{if(s.llmProfiles.length===1)return;collect();s.llmProfiles=s.llmProfiles.filter(p=>p.id!==editingId);delete pendingProfileKeys[editingId];if(s.activeLlmId===editingId)s.activeLlmId=s.llmProfiles[0].id;editingId=s.activeLlmId;renderProfileForm();await save();status('Configuration removed.');}));
async function connectProvider(id){
  if(pendingImport)throw new Error('Finish or cancel configuration import before saving preferences.');
  // Same sponsored service, new hostname: migrate only on this explicit connection
  // gesture, then request its exact host and renew text consent as usual.
  if(id==='llm' && getValue('llm-provider')==='saywell' && getValue('llm-endpoint')===LEGACY_HOSTED_AI_ENDPOINT){putValue('llm-endpoint',HOSTED_AI_ENDPOINT);edited().consent=false;renderConsent();renderLLMProvider();}
  if(!$('#settings-form').reportValidity())throw new Error('Check the highlighted setting.');
  validateSettings(collect());const profileId=editingId,cfg=id==='llm'?edited():s.basic[id];
  if(id==='llm' && (!cfg.endpoint || !cfg.model.trim()))throw new Error('Enter an API base URL and model before connecting.');
  const endpoint=cfg.endpoint,provider=cfg.provider,origin=originPattern(endpoint);
  // This explicit connection click and its adjacent disclosure provide text consent.
  // Request directly within the gesture; Chromium reuses an existing grant without another prompt.
  const allowed=await chrome.permissions.request({origins:[origin]});
  if(!allowed)throw new Error('Endpoint permission was not granted.');
  if(editingId!==profileId || pendingImport)throw new Error('Configuration changed. Connect the selected service again.');
  collect();if(cfg.endpoint!==endpoint || cfg.provider!==provider)throw new Error('Configuration changed. Connect the selected service again.');
  const previous={consent:cfg.consent,enabled:cfg.enabled};cfg.consent=true;
  if(id==='llm')putValue('llm-enabled',true);
  try{await save();}
  catch(error){cfg.consent=previous.consent;if(id==='llm'){cfg.enabled=previous.enabled;putValue('llm-enabled',previous.enabled);}renderConsent();throw error;}
  return profileId;
}
document.querySelectorAll('[data-revoke]').forEach(b=>b.addEventListener('click',task(async()=>{
  if(pendingImport)throw new Error('Finish or cancel configuration import before saving preferences.');
  const id=b.dataset.revoke;(id==='llm'?edited():s.basic[id]).consent=false;if(id==='llm')putValue('llm-enabled',false);await save();status('Service disabled. No new text will be sent to it.');
})));
document.querySelectorAll('[data-test]').forEach(b=>b.addEventListener('click',task(async()=>{
  if(b.dataset.test==='auto')await save();else await connectProvider(b.dataset.test);status('Testing with a synthetic phrase…');
  try{const result=await send('test-basic',{id:b.dataset.test});status(`${t(result.engine)}: ${result.text}`);}
  finally{const latest=await send('state');state.basicStatus=latest.basicStatus;$('#basic-order').closest('details').open=true;renderDiagnostics();}
})));
$('#enable-free').addEventListener('click',task(async()=>{
  if(pendingImport)throw new Error('Finish or cancel configuration import before saving preferences.');
  if(!$('#settings-form').reportValidity())throw new Error('Check the highlighted setting.');collect();
  // The named button and nearby disclosure provide text consent for exactly these four hosts.
  const origins=['https://translate.googleapis.com/*','https://cn.bing.com/*','https://edge.microsoft.com/*','https://api.mymemory.translated.net/*'];
  if(!await chrome.permissions.request({origins}))throw new Error('Endpoint permission was not granted.');
  s.basic.microsoft={...s.basic.microsoft,endpoint:'https://edge.microsoft.com',consent:true};
  s.basic.mymemory={...s.basic.mymemory,endpoint:'https://api.mymemory.translated.net',consent:true};
  s.basic.googleweb={...s.basic.googleweb,endpoint:'https://translate.googleapis.com',consent:true};
  s.basic.bing={...s.basic.bing,endpoint:'https://cn.bing.com',consent:true};
  for(const id of ['googleweb','bing'])putValue(id+'-endpoint',s.basic[id].endpoint);
  putValue('basicEngine','auto');putValue('basicFallback',true);await save();
  status('No-key fallback enabled. Google, Bing, Microsoft Edge and MyMemory may receive your text. No API key or account is needed.');
}));
$('#test-llm').addEventListener('click',task(async()=>{const profileId=await connectProvider('llm');status('Testing with “This is a connection test.”…');const r=await send('test-llm',{profileId});status('Connected to {engine}. Synthetic request completed.',false,{engine:r.engine});}));
$('#prepare-local').addEventListener('click',task(async()=>{const target=getValue('targetLanguage'),promise=builtin.prepare({source:target==='zh'?'en':'zh',target});text('#local-state','Preparing the language model…');await promise;text('#local-state','Model ready in this settings document. Website availability is checked separately.');status('Local model prepared.');}));
$('#forget-keys').addEventListener('click',task(async()=>{await send('forget-keys');pendingProfileKeys={};for(const id of KEY_IDS)putValue(id+'-key','');state.hasKeys={};state.hasProfileKeys={};renderKeyHints();status('All stored keys forgotten.');}));
function renderSites(){
  $('#site-list').replaceChildren();for(const origin of s.siteOrigins){const row=el('li');row.append(el('span',origin));const b=el('button',t('Remove'));b.type='button';b.addEventListener('click',task(async()=>{s.siteOrigins=s.siteOrigins.filter(x=>x!==origin);await save();status('Website input access removed. Existing tabs stop processing this site.');}));row.append(b);$('#site-list').append(row);}
}
$('#add-site').addEventListener('click',task(async()=>{
  const u=new URL(getValue('site-url'));if(!['https:','http:'].includes(u.protocol))throw new Error('Enter an HTTP(S) website URL.');
  const origin=u.origin+'/*';if(!await chrome.permissions.request({origins:[origin]}))throw new Error('Website permission was not granted.');
  if(getValue('siteMode')==='whitelist')putValue('allowlist',[...new Set([...getValue('allowlist').split(/[\n,]+/).map(v=>v.trim().toLowerCase()).filter(Boolean),u.hostname])].join('\n'));
  s.siteOrigins=[...new Set([...s.siteOrigins,origin])];await save();status('Website enabled. Reload its tab once to activate Saywell.');putValue('site-url','');
}));
$('#all-sites').addEventListener('click',task(async()=>{
  const origins=['https://*/*','http://*/*'];if(!await chrome.permissions.request({origins}))throw new Error('Website permission was not granted.');
  s.siteOrigins=origins;await save();status('All-website access granted. The selected list mode still controls processing. Reload existing tabs once.');
}));
function renderImportPreview(){
  document.body.classList.toggle('config-review-open',Boolean(pendingImport));
  const feedback=$('#status');
  if(pendingImport)$('#config-import-preview').insertBefore(feedback,$('#config-import-preview .actions'));else $('.save-bar').prepend(feedback);
  $('#config-import-preview').classList.toggle('hidden',!pendingImport);if(!pendingImport)return;
  const info=pendingImport.summary;
  $('#config-import-file').textContent=pendingImport.name;
  $('#config-import-summary').textContent=t('{profiles} LLM configurations · {sites} website defaults · {positions} positions · {sizes} sizes',{profiles:info.profiles.length,sites:info.sites,positions:info.positions,sizes:info.sizes});
  const action=t({auto:'Auto',translate:'Translate',polish:'Polish',explain:'Explain'}[info.mode]),target=$(`#targetLanguage option[value="${info.targetLanguage}"]`)?.textContent,scope=$(`#siteMode option[value="${info.siteMode}"]`)?.textContent;
  $('#config-import-defaults').textContent=t('Default: {action} · {target} · {scope}',{action,target,scope});
  $('#config-import-profiles').replaceChildren(...info.profiles.map(p=>el('li',`${p.name==='Default configuration'?t(p.name):p.name} · ${LLM_PROVIDERS[p.provider].name}${p.model?` / ${p.model}`:''}${p.id===info.activeLlmId?' · '+t('Active'):''}`)));
  $('#config-import-origins').replaceChildren(...(info.origins.length?info.origins.map(origin=>el('li',origin)):[el('li',t('No website access requested.'))]));
  $('#config-import-access-row').classList.toggle('hidden',!info.missingOrigins.length);
  $('#config-import-permissions').textContent=info.missingOrigins.length?t('{count} website scopes need permission; unchecked scopes will be skipped.',{count:info.missingOrigins.length}):t('Only existing website permissions will be used.');
}
function cancelImport(resume=true){importRevision++;pendingImport=null;$('#config-file').value='';$('#config-import-access').checked=false;renderImportPreview();if(resume)scheduleSave();}
$('#export-config').addEventListener('click',task(async()=>{await save({auto:true});const backup=await send('export-config');download('saywell-configuration.json',backup);status('Exported saved configuration without API keys or practice data.');}));
$('#import-config').addEventListener('click',()=>$('#config-file').click());
$('#config-file').addEventListener('change',async()=>{
  clearTimeout(saveTimer);editRevision++;
  const file=$('#config-file').files[0],revision=++importRevision;pendingImport=null;$('#config-import-access').checked=false;renderImportPreview();if(!file)return;
  try{
    if(file.size>CONFIG_FILE_LIMIT)throw new Error('Configuration file is too large (maximum 1 MiB).');
    const content=await file.text(),summary=await send('inspect-config',{text:content});
    if(revision!==importRevision)return;clearTimeout(saveTimer);editRevision++;pendingImport={text:content,summary,name:file.name};renderImportPreview();status('Review the configuration, then choose Replace configuration.');
  }catch(error){if(revision===importRevision){$('#config-file').value='';status(error.message,true);}}
});
$('#cancel-config-import').addEventListener('click',()=>cancelImport());
$('#confirm-config-import').addEventListener('click',task(async()=>{
  const selected=pendingImport;if(!selected)throw new Error('Review a configuration file first.');
  // The optional permission request stays directly in the user's explicit click gesture.
  if($('#config-import-access').checked && selected.summary.missingOrigins.length && !await chrome.permissions.request({origins:selected.summary.missingOrigins}))throw new Error('Website access was not granted. Nothing was imported.');
  await saveQueue.catch(()=>{});const result=await send('import-config',{text:selected.text});cancelImport(false);
  pendingProfileKeys={};for(const id of KEY_IDS)putValue(id+'-key','');
  state=await send('state');s=state.settings;editingId=s.activeLlmId;render();
  status(result.skippedOrigins?'Configuration imported; {count} website scopes were skipped. Reauthorize providers and refresh website tabs.':'Configuration imported. Reauthorize providers and refresh website tabs.',false,{count:result.skippedOrigins});
}));
$('#export').addEventListener('click',task(async()=>{const data=await send('state');download('saywell-practice.json',{schemaVersion:1,exportedAt:new Date().toISOString(),analytics:data.analytics || {},vocabulary:(data.vocabulary || []).map(({context,...word})=>word)});status('Exported activity and vocabulary without credentials or contexts.');}));
$('#reset').addEventListener('click',()=>{$('#confirm-reset').classList.remove('hidden');status('Reset deletes all local activity and vocabulary. Click Confirm reset to continue.');});
$('#confirm-reset').addEventListener('click',task(async()=>{await send('reset-data');$('#confirm-reset').classList.add('hidden');status('Practice data reset.');}));
const setupHolder=el('div');$('.page-heading').after(setupHolder);
mountSetup(setupHolder,{beforeComplete:async()=>{clearTimeout(saveTimer);editRevision++;await saveQueue.catch(()=>{});},onComplete:async()=>{state=await send('state');s=state.settings;editingId=s.activeLlmId;render();}});
if(!previewNotice())send('state').then(data=>{state=data;s=data.settings;editingId=s.activeLlmId;render();loaded=true;}).catch(e=>status(e.message,true));render();
