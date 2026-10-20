import {send,$,text,fmt,status,chart,el,previewNotice,t,locale,initLocale} from './shared.js';
import {dayKey,history,emptyMetrics} from '../core/analytics.js';
import {mergeSettings} from '../core/settings.js';
let data={analytics:{},settings:mergeSettings()},days=7;
await initLocale();
function render(){
  const today=data.analytics?.[dayKey()] || emptyMetrics(),s=data.settings;
  for(const k of ['english','typed','chinese','ai','accepted','suggestions'])text('#'+k,fmt(today[k]));
  text('#acceptance',today.suggestions?`${Math.round(today.accepted/today.suggestions*100)}%`:'—');
  text('#paste-total',t('Pasted text: {count} characters · kept out of your independent writing.',{count:fmt(today.pasted)}));
  text('#goal-current',fmt(today.english));text('#goal-target',fmt(s.dailyGoal));
  $('#goal-fill').style.width=`${Math.min(100,today.english/s.dailyGoal*100)}%`;
  const progress=$('[role="progressbar"]');progress.setAttribute('aria-valuemax',s.dailyGoal);progress.setAttribute('aria-valuenow',Math.min(s.dailyGoal,today.english));
  text('#goal-note',today.english>=s.dailyGoal?t('Daily intention reached. Every sentence counts.'):t('{count} words to your intention. You have this.',{count:fmt(Math.max(0,s.dailyGoal-today.english))}));
  const rows=history(data.analytics || {},days);chart($('#chart'),rows);const total=rows.reduce((n,d)=>n+d.english,0);
  text('#period-total',t(days===7?'{count} words this week':'{count} words in 30 days',{count:fmt(total)}));$('#chart-empty').classList.toggle('hidden',total>0);
  $('#chart').setAttribute('aria-label',t('{days} days: {count} independently written English words',{days,count:fmt(total)}));
  const entries=Object.entries(today.sites || {}).sort((a,b)=>b[1].typed-a[1].typed);$('#sites').replaceChildren();
  for(const[host,counts]of entries){const row=el('tr'),site=el('td');site.append(el('span',host[0].toUpperCase(),'site-icon'),document.createTextNode(host));row.append(site,el('td',fmt(counts.english)),el('td',fmt(counts.typed)));$('#sites').append(row);}
  $('#sites-empty').classList.toggle('hidden',entries.length>0);$('#setup').classList.toggle('hidden',s.siteOrigins.length>0);
}
function renderDate(){text('#date',new Date().toLocaleDateString(locale(),{weekday:'short',month:'long',day:'numeric'}));}
document.addEventListener('input-coach-languagechange',()=>{renderDate();render();});renderDate();
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});render();}));
if(!previewNotice())send('state').then(s=>{data=s;render();}).catch(e=>status(e.message,true));render();
if(globalThis.chrome?.storage)chrome.storage.onChanged.addListener(()=>send('state').then(s=>{data=s;render();}).catch(()=>{}));
