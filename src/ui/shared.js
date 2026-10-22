import {t,locale,translateError} from './i18n.js';
import {createMark} from '../brand/mark.js';
for(const holder of document.querySelectorAll('.brand-mark')){holder.replaceChildren(createMark(document));const target=holder.closest('.brand') || holder;target.dataset.i18nTitle='Saywell · Translate, polish and practise your writing';}
// Existing localized accessible names also provide native hover help for small controls.
for(const control of document.querySelectorAll('.icon-button[data-i18n-aria-label]'))control.dataset.i18nTitle=control.dataset.i18nAriaLabel;
export {t,locale,initLocale} from './i18n.js';
export async function send(type,extra={}) {
  if(!globalThis.chrome?.runtime?.id)throw new Error('Load the unpacked extension to use this feature.');
  const response=await chrome.runtime.sendMessage({type,...extra});
  if(!response?.ok)throw new Error(response?.error || 'Extension is unavailable.');
  return response.data;
}
export const $=selector=>document.querySelector(selector);
export function text(selector,value){const e=$(selector);if(e)e.textContent=t(String(value));}
export const fmt=value=>Number(value || 0).toLocaleString(locale());
let lastStatus;
let toastTimer;
export function toast(message,error=false){
  let node=$('#save-toast');if(!node){node=el('div',undefined,'save-toast');node.id='save-toast';node.setAttribute('aria-live','polite');document.body.append(node);}
  node.textContent=error?translateError(message):t(message);node.classList.toggle('error',error);node.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),error?6000:2400);
}
export function status(message,error=false,params={}){lastStatus={message,error,params};const e=$('#status');if(e){e.removeAttribute('data-i18n');e.textContent=error?translateError(message):t(message,params);e.classList.toggle('error',error);}}
document.addEventListener('input-coach-languagechange',()=>{if(lastStatus)status(lastStatus.message,lastStatus.error,lastStatus.params);});
document.addEventListener('input-coach-languageerror',()=>status('Language preference could not be saved. Please try again.',true));
export function el(tag,content,className){const e=document.createElement(tag);if(content!==undefined)e.textContent=content;if(className)e.className=className;return e;}
export function openPage(path){if(globalThis.chrome?.runtime?.id)chrome.tabs.create({url:chrome.runtime.getURL(path)});else location.href=path;}
export function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function chart(container,days){
  container.replaceChildren();const max=Math.max(1,...days.map(d=>d.english));
  for(const day of days){const bar=el('div',undefined,'chart-column');bar.title=t('{day}: {count} independent English words',{day:day.day,count:fmt(day.english)});bar.setAttribute('aria-label',bar.title);
    const track=el('div',undefined,'chart-track'),fill=el('div',undefined,'chart-fill');fill.style.height=`${day.english ? Math.max(3,day.english/max*100):0}%`;track.append(fill);
    bar.append(track,el('span',day.day.slice(8),'chart-day'));container.append(bar);}
}
export function previewNotice(){
  if(!globalThis.chrome?.runtime?.id){const key='Design preview · Load the unpacked extension for live settings and activity.';const e=el('p',t(key),'preview-notice');e.dataset.i18n=key;document.body.prepend(e);return true;}return false;
}
