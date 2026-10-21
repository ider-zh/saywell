import {send,$,text,fmt,status,openPage,previewNotice,t,locale,initLocale} from './shared.js';
import {dayKey} from '../core/analytics.js';
import {siteAllowed,blockedRule} from '../core/language.js';
import {llmProviderName} from '../core/llm-providers.js';
import {mountSetup} from './setup.js';
let state,tab,origin,hasSiteGrant=false;
await initLocale();
const setupHolder=document.createElement('div');$('.popup-header').after(setupHolder);mountSetup(setupHolder,{onComplete:refresh});
function render(){
  if(!state)return;const counts=state.analytics?.[dayKey()] || {};for(const k of ['english','typed','ai'])text('#'+k,fmt(counts[k]));
  $('#target-language-popup').value=state.settings.targetLanguage;
  $('#llm-profile-popup').replaceChildren(...state.settings.llmProfiles.map(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.name==='Default configuration'?t(p.name):p.name;return option;}));$('#llm-profile-popup').value=state.settings.activeLlmId;
  $('#enabled').checked=state.settings.enabled;text('#pause',state.settings.enabled?'Quick pause':'Resume suggestions');text('#engine',state.lastEngine || ({auto:'Auto · on-device first',builtin:'Browser on-device',googleweb:'Google Translate (web, experimental)',bing:'Microsoft Bing (web, experimental)',microsoft:'Microsoft Edge (experimental)',azure:'Microsoft Azure',mymemory:'MyMemory',libre:'LibreTranslate',google:'Google Cloud Translation'}[state.settings.basicEngine]));text('#llm',state.settings.llm.enabled?llmProviderName(state.settings.llm.provider):'Off');
  $('#site-mode-popup').value=state.settings.siteMode;const blacklist=state.settings.siteMode==='blacklist';$('#site-blacklist').classList.toggle('hidden',!blacklist);
  if(origin){
    const host=new URL(tab.url).hostname,rule=blockedRule(host,state.settings),access=hasSiteGrant && state.settings.siteOrigins.some(p=>p===origin || p===new URL(tab.url).protocol+'//*/*');
    const broad=state.settings.siteOrigins.includes('https://*/*') && state.settings.siteOrigins.includes('http://*/*');
    const exists=blacklist?broad && hasSiteGrant:access && siteAllowed(host,state.settings);
    text('#enable-site',blacklist?(exists?'All-website access enabled':'Enable blacklist mode on all websites'):t(exists?'Enabled on {host}':'Enable on {host} ↗',{host}));$('#enable-site').disabled=exists;
    text('#blacklist-status',rule?'On blacklist':'Not on blacklist');text('#toggle-site-blacklist',rule?(rule.toLowerCase()===host.toLowerCase()?'Remove this site from blacklist':'Manage blacklist rule'):'Add this site to blacklist');$('#toggle-site-blacklist').disabled=!access;
  }else $('#toggle-site-blacklist').disabled=true;
}
async function refresh(){state=await send('state');if(origin)hasSiteGrant=await chrome.permissions.contains({origins:[origin]});render();}
async function toggle(value){try{await send('toggle',{enabled:value});await refresh();status(value?'Suggestions resumed.':'Suggestions paused. Local analytics remain active.');}catch(e){status(e.message,true);}}
$('#enabled').addEventListener('change',()=>toggle($('#enabled').checked));$('#pause').addEventListener('click',()=>toggle(!state?.settings.enabled));
$('#settings').addEventListener('click',()=>openPage('settings.html'));$('#dashboard').addEventListener('click',()=>openPage('dashboard.html'));$('#dashboard-brand').addEventListener('click',e=>{e.preventDefault();openPage('dashboard.html');});
$('#history-popup').addEventListener('click',e=>{e.preventDefault();openPage('history.html');});
$('#site-mode-popup').addEventListener('change',async()=>{try{await send('set-site-mode',{mode:$('#site-mode-popup').value});await refresh();status('Website mode saved.');}catch(e){status(e.message,true);}});
$('#target-language-popup').addEventListener('change',async()=>{try{await send('set-target-language',{targetLanguage:$('#target-language-popup').value});await refresh();status('Target language saved.');}catch(e){status(e.message,true);}});
$('#llm-profile-popup').addEventListener('change',async()=>{try{await send('activate-llm-profile',{profileId:$('#llm-profile-popup').value});await refresh();status('Active configuration saved.');}catch(e){status(e.message,true);}});
$('#toggle-site-blacklist').addEventListener('click',async()=>{
  try{const host=new URL(tab.url).hostname,rule=blockedRule(host,state.settings);if(rule && rule.toLowerCase()!==host.toLowerCase()){openPage('settings.html#websites');return;}
    await send('set-site-blocked',{tabId:tab.id,blocked:!rule});await refresh();status(rule?'Website removed from blacklist.':'Website added to blacklist. Translation and local analytics stop here.');
  }catch(e){status(e.message,true);}
});
$('#enable-site').addEventListener('click',async()=>{
  try{if(!origin)throw new Error('Open a normal HTTPS website first.');
    const blacklist=state.settings.siteMode==='blacklist';const origins=blacklist?['https://*/*','http://*/*']:[origin];
    const allowed=await chrome.permissions.request({origins});if(!allowed)throw new Error('Website access was not granted.');
    await send('save-settings',{settings:{...state.settings,siteOrigins:[...new Set([...state.settings.siteOrigins,...origins])],allowlist:blacklist?state.settings.allowlist:[...new Set([...state.settings.allowlist,new URL(tab.url).hostname])]}});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});await refresh();status('Website enabled. Choose a provider in Settings if needed.');
  }catch(e){status(e.message,true);}
});
function renderDate(){text('#date',new Date().toLocaleDateString(locale(),{weekday:'long',month:'short',day:'numeric'}));}
document.addEventListener('input-coach-languagechange',()=>{renderDate();render();});renderDate();
if(!previewNotice()){
  refresh().catch(e=>status(e.message,true));chrome.tabs.query({active:true,currentWindow:true}).then(tabs=>{tab=tabs[0];try{const u=new URL(tab.url);if(!['https:','http:'].includes(u.protocol))throw 0;origin=u.origin+'/*';refresh().catch(()=>{});}catch{$('#enable-site').disabled=true;text('#enable-site','Open a website to get started');}});
}
