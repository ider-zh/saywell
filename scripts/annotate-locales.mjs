// Run after adding static UI copy. Annotates source templates without changing editor/user content.
import {JSDOM} from 'jsdom';
import {readFile,writeFile} from 'node:fs/promises';
import chinese from '../src/locales/zh-CN.js';
for(const page of ['dashboard','settings','vocabulary','popup']){
  const dom=new JSDOM(await readFile(`public/${page}.html`,'utf8'));const doc=dom.window.document;
  const walker=doc.createTreeWalker(doc.documentElement,dom.window.NodeFilter.SHOW_TEXT);const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const text of nodes){
    const parent=text.parentElement,key=text.textContent.trim();
    if(!key || !Object.hasOwn(chinese,key) || parent.closest('[data-i18n],script,style,textarea'))continue;
    if(parent.childNodes.length===1)parent.dataset.i18n=key;
    else{const span=doc.createElement('span');span.dataset.i18n=key;span.textContent=key;
      const prefix=text.textContent.slice(0,text.textContent.indexOf(key)),suffix=text.textContent.slice(text.textContent.indexOf(key)+key.length);
      text.replaceWith(doc.createTextNode(prefix),span,doc.createTextNode(suffix));}
  }
  for(const el of doc.querySelectorAll('*'))for(const attr of ['aria-label','placeholder','title']){
    const key=el.getAttribute(attr);if(key && Object.hasOwn(chinese,key))el.setAttribute(`data-i18n-${attr}`,key);
  }
  await writeFile(`public/${page}.html`,dom.serialize()+'\n');
}
