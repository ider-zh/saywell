import { routeAction,siteAllowed,countChars,translationPair } from '../core/language.js';
import { dayKey,emptyMetrics,addMetrics,typingDelta } from '../core/analytics.js';
import { builtin } from '../providers/builtin.js';
import { editorFor,readEditor,applyEditor,canApply } from './editor.js';
import { Tooltip } from './tooltip.js';
import {siteInfo} from './site-controls.js';
import {shouldSkipAutomaticContent} from '../core/content-filter.js';

if (!globalThis.__inputCoach) {
  globalThis.__inputCoach=true;
  const send=async message=>{const reply=await chrome.runtime.sendMessage(message);if(!reply?.ok)throw new Error(reply?.error || 'Extension reloaded. Refresh this page.');return reply.data;};
  let settings,active=null,sequence=0,timer,applying=false,changingSite=false,refreshingSettings=false,settingsEpoch=0,mode,lastError='',lastErrorAt=0;
  let snapshots=new WeakMap();const composing=new WeakSet(),compositionStart=new WeakMap();
  let pending={},flushTimer,snoozeTimer,queuedInput=null;
  const access=()=>settings && settings.siteOrigins.some(p=>p===location.origin+'/*' || p===location.protocol+'//*/*');
  const snoozed=()=>settings?.snoozeUntil>Date.now();
  const allowed=()=>access() && siteAllowed(location.hostname,settings) && !snoozed();
  const currentSite=()=>siteInfo(location.hostname,settings,chrome.i18n?.getUILanguage?.() || navigator.language);
  function showSitePanel(focus=false){if(active?.isConnected && access()){tip.show(active,{mode:mode || settings.mode,site:currentSite()});if(focus)tip.host.focus({preventScroll:true});}}
  const tip=new Tooltip({
    onPositionChange:position=>send({type:'set-tooltip-position',position}),
    onSnooze:async(scope,duration)=>{
      changingSite=true;invalidate(false);
      try{const next=await send({type:'set-snooze',scope,duration});settingsEpoch++;acceptSettings(next);}
      finally{changingSite=false;refreshSettings();}
    },
    onSizeChange:async size=>{await send({type:'set-tooltip-size',size});if(settings)settings={...settings,tooltipSize:size};},
    onDismiss:()=>invalidate(), onMode:value=>{mode=value;invalidate();suggest(true);},
    onPrepare:async()=>{try{const promise=builtin.prepare(translationPair(readEditor(active),settings.targetLanguage || 'en'));tip.status('Preparing the local language model…');await promise;suggest(true);}catch(e){tip.status(e.message);}},
    onCopy:async text=>{try{await navigator.clipboard.writeText(text);tip.status('Copied. Paste it into your editor.');}catch{tip.status('Clipboard is unavailable here. Select the suggestion text and copy it.');}},
    onWord:(item,known,includeContext,context)=>send({type:'vocabulary',item,known,includeContext,context:includeContext?context:undefined}),
    onSiteControlStart:()=>invalidate(false),
    onSitePreferences:async preferences=>{
      changingSite=true;invalidate(false);
      try{
        const next=await send({type:'set-site-preferences',preferences});
        settingsEpoch++;invalidate();settings=next;mode=next.mode;showSitePanel(true);tip.openSiteSettings();
      }finally{changingSite=false;refreshSettings();}
    },
    onSiteBlocked:async blocked=>{
      changingSite=true;invalidate(false);
      try{const next=await send({type:'set-site-blocked',blocked});settingsEpoch++;invalidate();settings=next;mode=next.mode;pending={};showSitePanel(true);}
      finally{changingSite=false;refreshSettings();}
    },
    onApply:async result=>{
      if(changingSite || refreshingSettings)return;
      if(!allowed() || !settings.enabled || !active || readEditor(active)!==result.source){invalidate();return;}
      applying=true;tip.discardQueued();const editor=active;sequence++;const applySequence=sequence;let ok=false;
      const valid=()=>applySequence===sequence && !changingSite && !refreshingSettings && allowed() && settings.enabled && active===editor && !composing.has(editor);
      try{ok=await applyEditor(editor,result.source,result.text,valid);}catch{ok=false;}finally{snapshots.set(editor,readEditor(editor));applying=false;}
      // React/editor state may reject a DOM mutation on its next render.
      await new Promise(requestAnimationFrame);
      if(ok && editor.isConnected && readEditor(editor)===result.text){count({ai:countChars(result.text),accepted:1});invalidate();}
      else tip.status('This editor did not accept the replacement. Use Copy instead.');
    }
  });
  function invalidate(close=true){sequence++;clearTimeout(timer);timer=null;queuedInput=null;tip.discardQueued();if(close)tip.close();else tip.hideProgress();}
  function pauseComposition(){sequence++;clearTimeout(timer);timer=null;tip.close(true);tip.pauseProgress();}
  function count(delta){if(!settings?.analytics || !allowed())return;const day=dayKey();addMetrics(pending[day] ||= emptyMetrics(),delta);clearTimeout(flushTimer);flushTimer=setTimeout(flush,1500);}
  function flush(){const batch=pending;pending={};for(const[day,delta]of Object.entries(batch))send({type:'metric',day,delta}).catch(()=>{});}
  function focus(editor){if(active!==editor){invalidate();active=editor;mode=settings?.mode;}if(settings?.analytics && allowed() && !snapshots.has(editor))snapshots.set(editor,readEditor(editor));}
  async function suggest(manual=false){
    clearTimeout(timer);timer=null;if(refreshingSettings)return;queuedInput=null;
    if(changingSite || !settings?.enabled || !access() || snoozed() || !active?.isConnected || composing.has(active)){if(!composing.has(active))tip.hideProgress();return;}
    if(!allowed()){tip.hideProgress();if(manual && settings.siteMode==='blacklist')showSitePanel();return;}
    const editor=active, source=readEditor(editor);if(!source.trim() || source.length>6000 || !manual && shouldSkipAutomaticContent(source)){tip.hideProgress();return;}
    const action=routeAction(source,mode || settings.mode,settings.llmEnabled,settings.targetLanguage || 'en');if(action.action==='none'){tip.hideProgress();return;}
    const id=++sequence;
    // getRandomValues also works on granted HTTP pages, where randomUUID is unavailable.
    const historyRequestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join(''),historyGeneration=settings.historyGeneration || 0,historyEnabled=settings.historyLimit!==0;
    const valid=()=>id===sequence && active===editor && editor.isConnected && !composing.has(editor) && readEditor(editor)===source && settings.enabled && allowed();
    const show=value=>{if(valid())tip.show(editor,{mode:mode || settings.mode,site:currentSite(),...value});};
    // No empty loading card: both lanes start now and publish independently when usable text arrives.
    const pair=translationPair(source,settings.targetLanguage || 'en');
    const useMT=action.action!=='explain' && pair.source!==pair.target,useLLM=!settings.llmNeedsUnlock && !settings.llmNeedsConnection && (settings.llmEnabled || action.needsLLM);
    if(useMT || useLLM)tip.queueProgress(editor,{waiting:true,site:currentSite()});
    const results={},errors={},done={mt:!useMT,llm:!useLLM};let displayed=null,counted=false;
    const publish=async()=>{
      if(!valid())return;
      const primary=results.llm || results.mt;
      if(primary){
        const extra={mtResult:results.llm?results.mt:null,pendingLLM:!done.llm,llmError:errors.llm,mtError:errors.mt,site:currentSite()};
        if(displayed===primary && tip.host.isConnected)tip.updateParallel(extra);
        else{show({result:primary,...extra});displayed=primary;}
        if(!counted){count({suggestions:1});counted=true;}
        send({type:'engine-used',engine:primary.engine}).catch(()=>{});return;
      }
      if(done.mt && done.llm){
        const error=[errors.mt,errors.llm].filter(Boolean).join(' ');
        if(error && (manual || error!==lastError || Date.now()-lastErrorAt>60000)){
          lastError=error;lastErrorAt=Date.now();const localAvailable=await builtin.availability(pair)!=='unavailable';if(valid())show({error,localAvailable});
        }else if(valid())tip.close();
      }
    };
    const run=async(lane,process)=>{
      try{const result=await process();if(valid() && result){
        results[lane]={...result,action:lane==='mt'?'translate':action.action,source,changed:result.text!==source.trim(),canApply:canApply(editor)};
        if(historyEnabled)send({type:'record-history',requestId:historyRequestId,generation:historyGeneration,source,action:action.action,targetLanguage:settings.targetLanguage || 'en',lane,result:{text:result.text,engine:result.engine,explanation:result.explanation}}).catch(()=>{});
      }}
      catch(e){if(valid())errors[lane]=e.message;}
      finally{done[lane]=true;await publish();}
    };
    const jobs=[];
    if(useMT)jobs.push(run('mt',async()=>{
      if(['auto','builtin'].includes(settings.basicEngine)){
        try{return await builtin.translate(source,pair);}catch(e){if(settings.basicEngine==='builtin' && !settings.basicFallback)throw e;}
      }
      if(settings.remoteMTReady===false && useLLM)return null;
      if(valid())return send({type:'suggest',lane:'mt',text:source,mode:mode || settings.mode});
    }));
    if(useLLM)jobs.push(run('llm',()=>send({type:'suggest',lane:'llm',text:source,mode:mode || settings.mode})));
    if(!jobs.length){tip.hideProgress();if(settings.llmNeedsUnlock && action.needsLLM)show({error:'Unlock the vault in Settings to use saved API keys.'});else if(settings.llmNeedsConnection && action.needsLLM)show({error:'Connect the LLM service in Settings before using it.'});return;}
    await Promise.allSettled(jobs);
  }
  function schedule(text){clearTimeout(timer);timer=null;if(!settings?.autoSuggest || !settings.enabled || !allowed())return;
    if(text.trim().length<2 || text.length>6000)return;
    if(shouldSkipAutomaticContent(text))return;
    // A just-enabled lane may arrive after this committed input. Keep its draft
    // even when the previous policy currently routes it to no action.
    queuedInput={editor:active,text};if(refreshingSettings)return;
    const action=routeAction(text,mode || settings.mode,settings.llmEnabled,settings.targetLanguage || 'en');if(action.action==='none')return;
    if(action.action==='translate' && !settings.llmEnabled && action.language===(settings.targetLanguage==='zh'?'chinese':'english'))return;
    // Incomplete sentences get a little more quiet time; never request every keypress.
    const delay=settings.debounce+(/[.!?。！？\n]\s*$/.test(text)?0:600);
    timer=setTimeout(()=>suggest(false),delay);
    tip.queueProgress(active,{action:action.action,site:currentSite()});
  }
  function input(e,settled=false,candidate){
    const editor=candidate || editorFor(e.composedPath()[0]);if(!editor || applying)return;
    // Keep only trusted committed input while the initial policy lookup is pending.
    // acceptSettings schedules it only after website and provider policies arrive.
    if(!settings){
      const composition=compositionStart.get(editor);
      if((composing.has(editor) || e.isComposing) && composition && e.isTrusted)composition.trustedInput=true;
      else if(e.isTrusted && !e.isComposing){focus(editor);queuedInput={editor,text:readEditor(editor)};}
      return;
    }
    if(settings && !settings.analytics && (!settings.enabled || !settings.autoSuggest)){invalidate();return;}
    if(composing.has(editor) || e.isComposing){
      if(!allowed()){invalidate();return;}focus(editor);pauseComposition();const composition=compositionStart.get(editor);if(composition && e.isTrusted)composition.trustedInput=true;return;
    }
    if(!settled && editor.matches('[data-slate-editor]')){invalidate();setTimeout(()=>input(e,true,editor),0);return;}
    if(!allowed()){invalidate();return;}
    focus(editor);
    const before=snapshots.get(editor) ?? '',after=readEditor(editor);
    if(editor.matches('[data-slate-editor]') && before===after)return;
    // Read before removing the card: removing UI first dirties layout and makes innerText flush it.
    // An unchanged deferred Slate event must not cancel the preceding event's suggestion timer.
    invalidate();
    if(settings.analytics && e.isTrusted && before!==after)count(typingDelta(before,after,e.inputType,e.data));
    snapshots.set(editor,after);
    if(e.isTrusted)schedule(after);
  }
  document.addEventListener('focusin',e=>{const editor=editorFor(e.composedPath()[0]);if(editor)focus(editor);},true);
  document.addEventListener('beforeinput',e=>{const editor=editorFor(e.composedPath()[0]);if(allowed() && editor && !composing.has(editor) && !applying){focus(editor);if(settings.analytics || settings.enabled && settings.autoSuggest && editor.matches('[data-slate-editor]'))snapshots.set(editor,readEditor(editor));
    // Slate may prevent native insertion and update its model without dispatching input.
    if(editor.matches('[data-slate-editor]') && (settings.analytics || settings.enabled && settings.autoSuggest)){invalidate();setTimeout(()=>input(e,true,editor),0);}
  }},true);
  document.addEventListener('input',input,true);
  function finishComposition(editor,composition){
    if(compositionStart.get(editor)!==composition)return;
    composing.delete(editor);compositionStart.delete(editor);if(!settings?.analytics && (!settings?.enabled || !settings?.autoSuggest))return;const after=readEditor(editor);
    const trusted=composition.endTrusted || composition.trustedStart && composition.trustedInput;
    if(settings?.analytics && allowed() && after!==composition.before && trusted){
      count(typingDelta(composition.before,after,'insertCompositionText',composition.data || null));
    }
    snapshots.set(editor,after);if(trusted && allowed())schedule(after);
  }
  document.addEventListener('compositionstart',e=>{
    const editor=editorFor(e.composedPath()[0]);if(!editor)return;
    if(!settings){invalidate();composing.add(editor);compositionStart.set(editor,{before:'',trustedStart:e.isTrusted,trustedInput:false});return;}
    if(!allowed())return;
    const previous=compositionStart.get(editor);if(previous?.ended)finishComposition(editor,previous);
    focus(editor);pauseComposition();composing.add(editor);compositionStart.set(editor,{before:settings.analytics?readEditor(editor):'',trustedStart:e.isTrusted,trustedInput:false});
  },true);
  document.addEventListener('compositionend',e=>{
    const editor=editorFor(e.composedPath()[0]);if(!editor)return;
    const composition=compositionStart.get(editor) || {before:snapshots.get(editor) ?? '',trustedStart:false,trustedInput:false};
    Object.assign(composition,{ended:true,endTrusted:e.isTrusted,data:e.data});compositionStart.set(editor,composition);composing.add(editor);
    // Some Chromium/IME paths expose an untrusted end after trusted composition input.
    // Rich editors may commit their model later in the same event turn. Count that
    // final commit once; provisional spellings and cancelled candidates stay excluded.
    queueMicrotask(()=>setTimeout(()=>finishComposition(editor,composition),0));
  },true);
  document.addEventListener('focusout',()=>setTimeout(()=>{
    if(document.activeElement!==tip.host && editorFor(document.activeElement)!==active){invalidate();active=null;}
  },0),true);
  document.addEventListener('keydown',e=>{
    if(e.composedPath().includes(tip.host))return;
    if(e.key==='Escape')invalidate();
    if(e.isTrusted && e.altKey && e.shiftKey && e.code==='KeyE' && !e.isComposing){e.preventDefault();const editor=editorFor(e.composedPath()[0]);if(editor)focus(editor);suggest(true);}
  },true);
  window.addEventListener('scroll',event=>{if((tip.host.isConnected || tip.progressHost?.isConnected) && !event.composedPath().includes(tip.host))tip.requestPosition(active);},{capture:true,passive:true});window.addEventListener('resize',()=>tip.requestPosition(active),{passive:true});
  window.visualViewport?.addEventListener('resize',()=>tip.requestPosition(active),{passive:true});window.visualViewport?.addEventListener('scroll',()=>tip.requestPosition(active),{passive:true});
  window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
  function acceptSettings(next){
    clearTimeout(snoozeTimer);if(next.snoozeUntil>Date.now())snoozeTimer=setTimeout(()=>refreshSettings(),Math.min(2147483647,next.snoozeUntil-Date.now()+40));
    if(JSON.stringify(settings)===JSON.stringify(next))return;
    if(settings && JSON.stringify({...settings,tooltipSize:undefined,historyLimit:undefined,historyGeneration:undefined})===JSON.stringify({...next,tooltipSize:undefined,historyLimit:undefined,historyGeneration:undefined})){settings=next;tip.setSize(next.tooltipSize);return;}
    const visible=tip.host.isConnected,sitePanel=tip.isSitePanel || tip.siteOpen,focused=document.activeElement===tip.host;
    if(settings?.snoozeUntil!==next.snoozeUntil || settings?.analytics!==next.analytics){snapshots=new WeakMap();if(active)snapshots.set(active,readEditor(active));pending={};}
    const queued=queuedInput;invalidate();settings=next;mode=settings.mode;tip.setSize(next.tooltipSize);
    if(!allowed())pending={};
    if(visible && settings.enabled && access() && !snoozed() && (sitePanel || (settings.siteMode==='blacklist' && !allowed())))showSitePanel(focused);
    // A delayed policy refresh must not swallow input typed while it was pending.
    // Only a still-queued, unchanged draft can be rescheduled; completed/cancelled work stays invalidated.
    if(queued && active===queued.editor && active?.isConnected && !composing.has(active) && readEditor(active)===queued.text)schedule(queued.text);
  }
  async function refreshSettings(snapshot){
    if(changingSite)return;
    const epoch=++settingsEpoch;
    if(!snapshot)refreshingSettings=true;
    try{const next=snapshot || await send({type:'public-settings'});if(epoch===settingsEpoch && !changingSite)acceptSettings(next);}
    catch{if(epoch===settingsEpoch)invalidate();}
    finally{if(epoch===settingsEpoch){
      refreshingSettings=false;
      // Identical/metadata-only replies do not invalidate the draft. Resume it
      // only if its original timer was consumed while policy was pending.
      const queued=queuedInput;
      if(!timer && queued && active===queued.editor && active?.isConnected && !composing.has(active) && readEditor(active)===queued.text)schedule(queued.text);
    }}
  }
  chrome.runtime.onMessage.addListener(message=>{
    if(message.type==='manual-suggest' && document.hasFocus())suggest(true);
    if(message.type==='settings-updated')refreshSettings(message.settings);
  });
  const initialEpoch=++settingsEpoch;
  Promise.all([send({type:'public-settings'}),send({type:'get-tooltip-position'}).catch(()=>null)]).then(([s,position])=>{tip.restorePosition(position);if(initialEpoch===settingsEpoch)acceptSettings(s);const editor=editorFor(document.activeElement);if(editor)focus(editor);}).catch(()=>{});
}
