import {send,$,text,status,toast,el,download,previewNotice,t,locale,initLocale} from './shared.js';
let data={records:[],limit:100},filtered=[],shown=0,revision=0;
await initLocale();
const actionLabel=value=>t({translate:'Translate',polish:'Polish',explain:'Explain'}[value] || 'Translate');
function entry(row){
  const article=el('article',undefined,'panel history-entry'),header=el('div',undefined,'history-meta');
  header.append(el('time',new Date(row.createdAt).toLocaleString(locale())),el('span',row.hostname),el('span',actionLabel(row.action)),el('span',row.targetLanguage==='zh'?'中文 / Chinese':'English / 英文'));
  const primary=row.results.llm || row.results.mt,columns=el('div',undefined,'history-columns');
  for(const[label,value]of [[t('Source'),row.source],[primary.engine,primary.text]]){const column=el('div');column.append(el('span',label,'eyebrow'),el('p',value,'history-excerpt'));columns.append(column);}
  const details=el('details');details.append(el('summary',t('Full source and all results')),el('h3',t('Source')),el('p',row.source,'history-text'));
  for(const result of Object.values(row.results)){details.append(el('h3',result.engine),el('p',result.text,'history-text'));if(result.explanation)details.append(el('p',result.explanation,'help'));}
  const actions=el('div',undefined,'actions'),copy=el('button',t('Copy result'),'quiet'),remove=el('button',t('Remove'),'quiet');
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(primary.text);toast('Result copied.');}catch{status('Clipboard is unavailable here.',true);}});
  remove.addEventListener('click',async()=>{remove.disabled=true;try{await send('remove-history',{id:row.id});await refresh();toast('History entry removed.');}catch(error){status(error.message,true);remove.disabled=false;}});
  actions.append(copy,remove);article.append(header,columns,details,actions);return article;
}
function more(){
  const next=filtered.slice(shown,shown+25);shown+=next.length;$('#history-list').append(...next.map(entry));$('#history-more').classList.toggle('hidden',shown>=filtered.length);
}
function render(){
  const query=$('#history-search').value.trim().toLocaleLowerCase();
  filtered=data.records.filter(row=>[row.hostname,row.source,actionLabel(row.action),...Object.values(row.results).flatMap(result=>[result.engine,result.text,result.explanation || ''])].join('\n').toLocaleLowerCase().includes(query));
  text('#history-count',t('{shown} of {total} records',{shown:filtered.length,total:data.records.length}));$('#history-limit').value=String(data.limit);
  $('#history-warning').classList.toggle('hidden',!data.writeError);$('#history-export').disabled=!filtered.length;$('#history-clear').disabled=!data.records.length;
  $('#history-empty').classList.toggle('hidden',Boolean(filtered.length));$('#history-list').replaceChildren();shown=0;more();
}
async function refresh(){const current=++revision,result=await send('get-history');if(current===revision){data=result;render();}}
$('#history-search').addEventListener('input',render);$('#history-more').addEventListener('click',more);
new IntersectionObserver(entries=>{if(entries.some(item=>item.isIntersecting) && shown<filtered.length)more();},{rootMargin:'160px'}).observe($('#history-sentinel'));
$('#history-limit').addEventListener('change',async()=>{const select=$('#history-limit');select.disabled=true;try{await send('set-history-limit',{limit:Number(select.value)});await refresh();toast('History preference saved.');}catch(error){select.value=String(data.limit);status(error.message,true);}finally{select.disabled=false;}});
$('#history-clear').addEventListener('click',async()=>{try{await send('clear-history');await refresh();status('History cleared. New translations follow your recording preference.');toast('History cleared.');}catch(error){status(error.message,true);}});
$('#history-export').addEventListener('click',()=>{download('saywell-history.json',{format:'saywell-history',version:1,exportedAt:new Date().toISOString(),records:filtered});toast('History exported.');});
document.addEventListener('input-coach-languagechange',render);
if(!previewNotice()){
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && (changes.translationHistory || changes.historyPreferences) || area==='session' && changes.historyWriteError)refresh().catch(error=>status(error.message,true));});
  refresh().catch(error=>status(error.message,true));
}render();
