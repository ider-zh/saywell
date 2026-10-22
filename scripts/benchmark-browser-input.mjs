// Isolated Chromium synthetic fixtures, no provider calls. Measures only Saywell's input listeners.
import {chromium} from '@playwright/test';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {createServer} from 'node:http';import path from 'node:path';
const label=process.argv[2] || 'current',fixture='<!doctype html><meta charset="utf-8"><textarea aria-label="Native"></textarea><div contenteditable="true" aria-label="Rich"></div>',server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(fixture);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const rows=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{})});
  for(const kind of ['Native','Rich']){
    const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.addScriptTag({path:path.resolve('tests/browser/mock-runtime.js')});
    await page.evaluate(()=>{window.__coachSetSettings({autoSuggest:false});window.__inputTimings=[];const add=document.addEventListener;document.addEventListener=function(type,fn,options){if(['input','beforeinput'].includes(type)){const original=fn;fn=function(event){const start=performance.now();try{return original.call(this,event);}finally{window.__inputTimings.push({type,ms:performance.now()-start});}};}return add.call(this,type,fn,options);};});
    await page.addScriptTag({path:path.resolve('dist/content.js')});const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const editor=page.getByLabel(kind,{exact:true});await editor.evaluate((element,kind)=>{const text='A synthetic writing sentence. '.repeat(2000);if(kind==='Native')element.value=text;else{const p=document.createElement('p');p.textContent=text;element.append(p);}element.focus();if(kind==='Native')element.setSelectionRange(element.value.length,element.value.length);else{const range=document.createRange();range.selectNodeContents(element);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}},kind);
    await editor.pressSequentially('Hello synthetic input performance.');
    const values=await page.evaluate(()=>window.__inputTimings);for(const type of ['beforeinput','input']){const times=values.filter(value=>value.type===type).map(value=>value.ms).sort((a,b)=>a-b);rows.push({kind,type,events:times.length,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.floor(times.length*.95)],maxMs:Math.max(...times)});}await page.close();
  }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
await mkdir('test-results',{recursive:true});await writeFile(`test-results/browser-input-benchmark-${label}.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify({label,cpuSlowdown:4,rows}));
