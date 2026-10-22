import {send,el,t,status} from './shared.js';
import {SETUP_ORIGINS} from '../core/setup.js';

export function mountSetup(container,{welcome=false,beforeComplete=async()=>{},onComplete=async()=>{}}={}){
  const box=el('section',undefined,'setup-notice hidden');box.id='setup-notice';box.setAttribute('aria-labelledby','setup-title');
  const copy=el('div'),title=el('h2'),description=el('p'),disclosure=el('p',undefined,'help'),button=el('button',undefined,'primary');
  title.id='setup-title';button.id='setup-enable';button.type='button';copy.append(title,description,disclosure);box.append(copy,button);container.append(box);
  let info;
  function render(){
    if(!info)return;box.classList.toggle('hidden',!welcome && !info.needed);box.classList.toggle('setup-ready',!info.needed);
    title.textContent=t(info.needed?'Website permission needed':'You’re ready to write.');
    description.classList.toggle('hidden',!welcome && info.initial);
    description.textContent=t(info.initial?'One permission enables free AI translation, polishing and vocabulary tips. Machine translation uses browser-local capabilities when supported. No account or API key needed.':info.needed?'Website access is missing. Restore it to resume Saywell on your enabled websites.':'Start typing on a website. Saywell will offer a translation or polish after a short pause.');
    disclosure.textContent=info.initial?t('After you pause typing, the current input draft may be sent automatically to Saywell Free AI (Cloudflare). Local history keeps 100 recent source texts and results in session memory by default. Local statistics include numeric totals and hostnames. Password fields are excluded, but ordinary fields may contain sensitive text. Pause, block sites or disable recording in Settings. Read the privacy policy below before agreeing.'):'';
    button.textContent=t(info.initial?'Agree and enable Saywell':'Request permission again');button.classList.toggle('hidden',!info.needed);
  }
  const refresh=async()=>{info=await send('setup-status');render();};
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{
      // Native request must run directly in this click, before any asynchronous save.
      if(!await chrome.permissions.request({origins:info.initial?SETUP_ORIGINS:[...new Set(info.missing)]}))throw new Error('Website permission was not granted. Click the permission button to try again.');
      await beforeComplete();await send('complete-setup');await onComplete();await refresh();status('Saywell is ready. AI and machine translation are available on websites.');
    }catch(error){status(error.message,true);await refresh().catch(()=>{});}
    finally{button.disabled=false;}
  });
  document.addEventListener('input-coach-languagechange',render);
  if(globalThis.chrome?.runtime?.id){
    chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && (changes.settings || changes.setup))refresh().catch(()=>{});});
    chrome.permissions.onAdded.addListener(()=>refresh().catch(()=>{}));chrome.permissions.onRemoved.addListener(()=>refresh().catch(()=>{}));
    refresh().catch(error=>status(error.message,true));
  }
  return refresh;
}
