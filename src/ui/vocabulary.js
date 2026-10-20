import {send,$,text,status,el,previewNotice,t,initLocale} from './shared.js';
let words=[],filter='saved';
await initLocale();
async function refresh(){const s=await send('state');words=s.vocabulary || [];render();}
function render(){
  const query=$('#search').value.toLowerCase();const visible=words.filter(w=>w.status===filter && `${w.word} ${w.meaning}`.toLowerCase().includes(query));$('#words').replaceChildren();text('#count',t('{count} expressions',{count:words.length}));$('#empty').classList.toggle('hidden',visible.length>0);
  for(const word of visible){const card=el('article',undefined,'panel word-card'),summary=el('div',undefined,'word-summary'),definition=el('div',undefined,'word-definition');
    summary.append(el('span',word.date,'eyebrow'),el('h2',word.word));definition.append(el('p',`${word.pronunciation || ''} ${word.meaning}`,'meaning'),el('p',word.explanation,'help'));card.append(summary,definition);
    const actions=el('div',undefined,'actions');if(word.status!=='known'){const known=el('button',t('Mark as known'));known.addEventListener('click',async()=>{try{await send('vocabulary',{item:word,known:true,includeContext:Boolean(word.context),context:word.context});await refresh();}catch(e){status(e.message,true);}});actions.append(known);}
    const remove=el('button',t('Remove'),'quiet');remove.addEventListener('click',async()=>{try{await send('remove-word',{word:word.word});await refresh();}catch(e){status(e.message,true);}});actions.append(remove);card.append(actions);
    if(word.example || word.context){const detail=el('details');detail.append(el('summary',t(word.context?'Details':'Show example')));if(word.context)detail.append(el('p',word.context,'context'));if(word.example)detail.append(el('p',word.example,'help'));card.append(detail);}
    $('#words').append(card);}
}
document.addEventListener('input-coach-languagechange',render);
$('#search').addEventListener('input',render);document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});render();}));
if(!previewNotice())refresh().catch(e=>status(e.message,true));render();
