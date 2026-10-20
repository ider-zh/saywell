import {resolveLanguage,UI_LANGUAGES} from '../core/locale.js';
import chinese from '../locales/zh-CN.js';
let language='en',preference='auto',browserLanguage='en';
export const locale=()=>language;
export function t(key,params={}) {
  let message=language==='zh-CN' ? chinese[key] ?? key : key;
  if(language==='zh-CN' && message===key){
    const invalid=/^Invalid (\w+)\.$/.exec(key),http=/^Provider returned HTTP (\d+)\. Check configuration\.$/.exec(key);
    if(invalid){message=chinese['Invalid {field}.'];params={field:invalid[1],...params};}
    if(http){message=chinese['Provider returned HTTP {code}. Check configuration.'];params={code:http[1],...params};}
  }
  return message.replace(/\{(\w+)\}/g,(match,key)=>String(params[key] ?? match));
}
export function translateError(message){
  if(language!=='zh-CN')return message;
  // Only application-generated error wrappers are decomposed. Provider success text is never passed here.
  if(/^(MyMemory|LibreTranslate|Google Cloud|Microsoft Azure|Microsoft Edge \(experimental\)): /.test(message))return message.split(/ (?=(?:MyMemory|LibreTranslate|Google Cloud|Microsoft Azure|Microsoft Edge \(experimental\)): )/).map(part=>{
    const match=/^(MyMemory|LibreTranslate|Google Cloud|Microsoft Azure|Microsoft Edge \(experimental\)): (.*)$/.exec(part);
    return match?`${t(match[1])}：${translateError(match[2])}`:part;
  }).join(' ');
  const unavailable=/^(MyMemory|LibreTranslate|Google Cloud|Microsoft Azure|Microsoft Edge \(experimental\)) is not available for Chinese → English\.$/.exec(message);
  return unavailable?t('{provider} is not available for Chinese → English.',{provider:unavailable[1]}):t(message);
}
function applyLanguage(){
  language=resolveLanguage(preference,browserLanguage);document.documentElement.lang=language;
  for(const node of document.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);
  for(const attr of ['placeholder','aria-label','title'])for(const node of document.querySelectorAll(`[data-i18n-${attr}]`))node.setAttribute(attr,t(node.getAttribute(`data-i18n-${attr}`)));
  const control=document.querySelector('#ui-language');if(control)control.value=preference;
  document.dispatchEvent(new CustomEvent('input-coach-languagechange'));
}
export async function initLocale(){
  browserLanguage=globalThis.chrome?.i18n?.getUILanguage?.() || navigator.languages?.[0] || navigator.language || 'en';
  const extension=Boolean(globalThis.chrome?.runtime?.id);
  try{preference=extension ? (await chrome.storage.local.get('uiLanguage')).uiLanguage || 'auto' : localStorage.getItem('input-coach-ui-language') || 'auto';}catch{preference='auto';}
  if(!UI_LANGUAGES.includes(preference))preference='auto';
  const label=document.createElement('label');label.className='locale-control';
  const caption=document.createElement('span');caption.dataset.i18n='UI language';caption.textContent='UI language';
  const select=document.createElement('select');select.id='ui-language';select.dataset.i18nAriaLabel='UI language';
  for(const[value,name]of [['auto','Follow browser / 自动'],['zh-CN','简体中文'],['en','English']]){
    const option=document.createElement('option');option.value=value;option.textContent=name;if(value==='auto')option.dataset.i18n=name;select.append(option);
  }
  label.append(caption,select);
  const header=document.querySelector('.topbar');
  if(header)header.append(label);else document.querySelector('.popup-header,.welcome-card')?.append(label);
  select.addEventListener('change',async()=>{
    const next=select.value;if(!UI_LANGUAGES.includes(next))return;
    // Store separately from provider settings so switching languages never saves a draft form or credentials.
    try{if(extension)await chrome.storage.local.set({uiLanguage:next});else localStorage.setItem('input-coach-ui-language',next);preference=next;applyLanguage();document.dispatchEvent(new CustomEvent('input-coach-languagesaved'));}
    catch{select.value=preference;document.dispatchEvent(new CustomEvent('input-coach-languageerror'));}
  });
  if(extension)chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local' && changes.uiLanguage){preference=UI_LANGUAGES.includes(changes.uiLanguage.newValue)?changes.uiLanguage.newValue:'auto';applyLanguage();}
  });
  else window.addEventListener('storage',e=>{if(e.key==='input-coach-ui-language'){preference=UI_LANGUAGES.includes(e.newValue)?e.newValue:'auto';applyLanguage();}});
  window.addEventListener('languagechange',()=>{browserLanguage=globalThis.chrome?.i18n?.getUILanguage?.() || navigator.languages?.[0] || navigator.language; if(preference==='auto')applyLanguage();});
  applyLanguage();
}
