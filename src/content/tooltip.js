import {siteText} from './site-controls.js';
import {createMark} from '../brand/mark.js';
import {llmProviderName} from '../core/llm-providers.js';
import {validTooltipPosition,tooltipBounds,clampTooltip,relativeTooltip,placedTooltip} from '../core/tooltip-position.js';
import {TOOLTIP_SIZES,validTooltipSize} from '../core/tooltip-size.js';
const css=`
:host{all:initial;color-scheme:light;font:14px/1.5 'Segoe UI',sans-serif;color:#203d36;position:fixed;z-index:2147483647;display:block;width:min(410px,calc(100vw - 24px));}
*{box-sizing:border-box} .card{background:#fffef9;border:1px solid #cdd8cd;border-radius:16px;box-shadow:0 12px 45px #163b3426;overflow:hidden;padding:16px;animation:arrive .16s ease-out}
@keyframes arrive{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
header,footer,.row{display:flex;align-items:center;gap:8px}header{justify-content:space-between;margin-bottom:12px}.brand{font-weight:700;letter-spacing:-.3px}.saywell-mark{display:block;width:22px;height:22px;flex:none;margin-right:3px;pointer-events:none}button,select{font:inherit;color:inherit}button{cursor:pointer;background:transparent;border:1px solid #cdd8cd;border-radius:7px;padding:5px 11px}button:hover{background:#f0f4e8}button:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid #46775e;outline-offset:2px}button:disabled{opacity:.5;cursor:default}.close{border:0;padding:2px 6px;font-size:20px;line-height:1}.primary{background:#234f40;color:white;border-color:#234f40}.primary:hover{background:#173e30}.suggestion{font:19px/1.5 Georgia,serif;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 14px;max-height:210px;overflow:auto}.engine{font-size:11px;letter-spacing:.35px;color:#67766b}.llm{color:#936331}.toolbar{margin-bottom:10px}select{background:#f4f6ee;border:1px solid #d8dfd2;border-radius:6px;padding:3px 7px;font-size:12px}footer{border-top:1px solid #e4e7dc;padding-top:12px}.spacer{flex:1}.note{font-size:12px;color:#6a776d;margin-top:9px;white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#8e492f}details{margin:10px 0;font-size:12px}summary{cursor:pointer;color:#557044}details p{white-space:pre-wrap;margin:7px 0} .word{font:inherit;padding:0 1px;border:0;border-radius:0;border-bottom:1px dashed #6b864e}.word:hover{background:#edf2df}.vocab{background:#f2f5e9;border-radius:10px;padding:12px;margin:10px 0}.vocab strong{font-size:15px}.vocab p{font-size:12px;margin:5px 0}.vocab .row{flex-wrap:wrap;margin-top:10px}.vocab label{display:block;font-size:11px;margin-top:9px}.vocab button{font-size:11px;padding:4px 7px}.context{accent-color:#315940}a{color:#315940}.busy{font-size:14px;color:#697c68;padding:12px 0}@media(prefers-reduced-motion:reduce){.card{animation:none}}
`;
const siteCSS='.site-policy{border-top:1px solid #e4e7dc;margin-top:12px;padding-top:10px;font-size:11px;color:#61745d}.site-policy .row{justify-content:space-between;flex-wrap:wrap}.site-policy button{font-size:11px;padding:4px 8px}.site-policy .hostname{overflow-wrap:anywhere;color:#7b8575;margin:3px 0 8px}.site-blocked{background:#f7eee5;border-radius:8px;padding:10px;font-size:12px;margin:8px 0;color:#85553a}';
const compactCSS='.site-policy{margin:6px 0 0;padding-top:6px}.site-policy>summary{font-size:10px;color:#7a8778;line-height:20px}.site-policy>summary::marker{font-size:8px}.site-policy[open]>summary{margin-bottom:8px}.site-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px 10px;margin:9px 0}.site-field{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:10px}.site-field select{width:100%;min-width:0;max-width:100%;min-height:29px;font-size:11px;padding:4px;background:#fffef9;text-overflow:ellipsis}.site-buttons{justify-content:flex-start!important;margin-top:10px}.site-help{font-size:10px;line-height:1.5;color:#7a8778}.site-admin{border-top:1px solid #e4e7dc;padding-top:7px;margin-top:9px;justify-content:flex-start!important}.site-admin button{border-color:transparent;color:#7a8778;padding:2px 0}.site-admin button+button{margin-left:auto}.site-policy .hostname{margin:0;line-height:1.5}';
const dragCSS='.drag-handle{display:flex;align-items:center;gap:5px;flex:1;min-width:0;text-align:left;cursor:grab;touch-action:none;user-select:none;border:0;padding:3px 0}.drag-handle:hover{background:transparent}.grip{font-size:17px;color:#9ca894;letter-spacing:-4px;margin-right:7px}.position-reset{border:0;padding:3px 5px;font-size:17px;color:#7a8778}.position-reset:disabled{visibility:hidden}:host([data-dragging]) .drag-handle{cursor:grabbing}:host([data-dragging]) .card{animation:none}';
const sizeCSS=`:host{--pad:10px;--text:16px;--body:130px;--space:7px;font-size:12px}:host([data-size=medium]){--pad:13px;--text:18px;--body:190px;--space:10px;font-size:13px}:host([data-size=large]){--pad:16px;--text:20px;--body:260px;--space:12px;font-size:14px}.card{padding:var(--pad)}header{margin-bottom:var(--space);gap:5px}.suggestion{font-size:var(--text);max-height:var(--body);margin:6px 0 var(--space)}.toolbar{margin-bottom:var(--space);flex-wrap:wrap;gap:5px}.engine{letter-spacing:0;overflow-wrap:anywhere}footer{padding-top:var(--space);gap:5px}footer button{padding:4px 8px}.tooltip-size{width:74px;min-width:0;font-size:10px;padding:3px;flex:none}.saywell-mark{width:19px;height:19px}.grip{margin-right:3px}.note:empty{display:none}`;
const node=(tag,text,attrs={})=>{const e=document.createElement(tag); if(text!==undefined)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
export class Tooltip {
  constructor({onDismiss,onMode,onApply,onCopy,onWord,onPrepare,onSiteBlocked,onSiteControlStart,onPositionChange,onSitePreferences,onSizeChange}) {
    this.host=document.createElement('input-coach-tip'); this.host.setAttribute('data-input-coach-ignore','');this.host.tabIndex=-1;
    this.shadow=this.host.attachShadow({mode:'open'}); this.handlers={onDismiss,onMode,onApply,onCopy,onWord,onPrepare,onSiteBlocked,onSiteControlStart,onPositionChange,onSitePreferences,onSizeChange};this.setSize('small');
    this.host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();onDismiss();}});
    this.host.addEventListener('pointerdown',()=>{this.pointerActive=true;});
    const release=()=>{if(!this.pointerActive)return;this.pointerActive=false;setTimeout(()=>this.flushQueued(),0);};
    document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);
    this.host.addEventListener('focusout',()=>setTimeout(()=>this.flushQueued(),0));
    this.observer=new ResizeObserver(()=>{
      cancelAnimationFrame(this.positionFrame);
      this.positionFrame=requestAnimationFrame(()=>this.position(this.editor));
    });
    this.observer.observe(this.host);
  }
  discardQueued(){this.queuedView=null;}
  editingSite(){return this.shadow.activeElement?.matches('[data-site-field],.tooltip-size');}
  setSize(size){this.size=validTooltipSize(size)?size:'small';this.host.dataset.size=this.size;if(this.sizeControl)this.sizeControl.value=this.size;this.position(this.editor);}
  flushQueued(){if(!this.pointerActive && !this.editingSite() && this.queuedView && this.host.isConnected){const[editor,view]=this.queuedView;this.queuedView=null;this.show(editor,view);}}
  close(){this.discardQueued();this.cancelDrag();this.pointerActive=false;this.siteOpen=false;this.siteKey=null;this.host.remove();}
  openSiteSettings(){const panel=this.shadow.querySelector('.site-policy');if(panel){panel.open=true;this.siteOpen=true;this.position(this.editor);}}
  restorePosition(position){this.placement=validTooltipPosition(position)?{x:position.x,y:position.y}:null;this.position(this.editor);}
  viewport(){const v=window.visualViewport;return {left:v?.offsetLeft || 0,top:v?.offsetTop || 0,width:v?.width || innerWidth,height:v?.height || innerHeight};}
  bounds(){return tooltipBounds(this.viewport(),this.host.getBoundingClientRect());}
  move(point){const next=clampTooltip(point,this.bounds());this.host.style.left=`${next.left}px`;this.host.style.top=`${next.top}px`;}
  remember(){
    this.resetButton.disabled=!this.placement;
    Promise.resolve(this.handlers.onPositionChange?.(this.placement)).catch(()=>this.status(siteText(this.site || {},'Position could not be saved. It will reset after reloading.')));
  }
  cancelDrag(){
    if(!this.drag)return;
    const drag=this.drag;this.drag=null;this.host.removeAttribute('data-dragging');
    if(drag.handle.hasPointerCapture(drag.id))drag.handle.releasePointerCapture(drag.id);
  }
  makeHandle(header,site){
    const label=text=>siteText(site || {},text);
    const handle=this.button('',()=>{});handle.className='drag-handle brand';
    handle.setAttribute('aria-label',label('Move tooltip'));handle.title=label('Drag to move; arrow keys move, Shift moves faster.');
    handle.append(node('span','⠿',{class:'grip','aria-hidden':'true'}),createMark(document),node('span','Saywell'));
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0 || !event.isPrimary)return;
      // Preserve the editor selection and capture the pointer even outside this small handle.
      event.preventDefault();const rect=this.host.getBoundingClientRect();
      this.drag={id:event.pointerId,handle,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,moved:false};
      handle.setPointerCapture(event.pointerId);this.host.setAttribute('data-dragging','');
    });
    handle.addEventListener('pointermove',event=>{
      const drag=this.drag;if(!drag || event.pointerId!==drag.id)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved && Math.hypot(dx,dy)<3)return;
      drag.moved=true;this.move({left:drag.left+dx,top:drag.top+dy});
    });
    const finish=event=>{
      const drag=this.drag;if(!drag || event.pointerId!==drag.id)return;
      const moved=drag.moved,cancelled=event.type!=='pointerup';this.cancelDrag();
      if(moved && !cancelled){this.placement=relativeTooltip(this.host.getBoundingClientRect(),this.bounds());this.remember();}
      this.position(this.editor);
    };
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
    handle.addEventListener('keydown',event=>{
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(!direction)return;event.preventDefault();event.stopPropagation();
      const rect=this.host.getBoundingClientRect(),step=event.shiftKey?40:10;
      this.placement=relativeTooltip({left:rect.left+direction[0]*step,top:rect.top+direction[1]*step},this.bounds());
      this.position(this.editor);this.remember();
    });
    const reset=this.button('↶',()=>{
      // Keep focus on a stable control before disabling the reset button.
      handle.focus({preventScroll:true});this.placement=null;this.position(this.editor);this.remember();
    });
    reset.className='position-reset';reset.setAttribute('aria-label',label('Reset tooltip position'));reset.title=label('Reset tooltip position');reset.disabled=!this.placement;this.resetButton=reset;
    const size=node('select',undefined,{class:'tooltip-size','aria-label':label('Tooltip size'),title:label('Tooltip size · remembered for this website')});
    for(const[value,text]of [['small','Small'],['medium','Medium'],['large','Large']])size.append(node('option',label(text),{value}));size.value=this.size;this.sizeControl=size;
    size.addEventListener('change',()=>{this.setSize(size.value);Promise.resolve(this.handlers.onSizeChange?.(this.size)).catch(()=>this.status(label('Size could not be saved. It will reset after reloading.')));});
    header.append(handle,size,reset);
  }
  button(label,callback,primary=false){const b=node('button',label,{type:'button'});if(primary)b.className='primary';b.addEventListener('click',callback);return b;}
  siteSettings(site){
    const label=text=>siteText(site,text),policy=node('details',undefined,{class:'site-policy'});
    const key=JSON.stringify([site.host,site.preferences]);
    if(this.siteKey!==key){this.siteKey=key;this.siteDraft={...site.preferences};}
    policy.open=Boolean(site.blocked || this.siteOpen || this.isSitePanel);
    policy.append(node('summary',label('Website settings')),node('div',site.host,{class:'hostname'}));
    if(site.mode==='whitelist')policy.append(node('span',label('Whitelist mode'),{class:'site-help'}));
    policy.addEventListener('toggle',()=>{if(!policy.isConnected)return;this.siteOpen=policy.open;this.position(this.editor);});
    const grid=node('div',undefined,{class:'site-grid'}),draft=this.siteDraft,controls=[];
    const follow=value=>label('Follow global')+(value?` · ${value}`:'');
    const field=(name,title,aria,options,globalLabel)=>{
      const holder=node('label',undefined,{class:'site-field'}),select=node('select',undefined,{'aria-label':label(aria),'data-site-field':name});
      select.append(node('option',follow(globalLabel),{value:'@global'}));
      for(const[value,text]of options)select.append(node('option',text,{value}));
      select.value=Object.hasOwn(draft,name)?draft[name]===null?'@off':draft[name]:'@global';select.disabled=Boolean(site.blocked);
      select.addEventListener('change',()=>{
        if(select.value==='@global')delete draft[name];else draft[name]=select.value==='@off'?null:select.value;
        reset.disabled=!Object.keys(site.preferences).length && !Object.keys(draft).length;
      });
      controls.push(select);holder.append(node('span',label(title)),select);grid.append(holder);
    };
    const modes=['auto','translate','polish','explain'].map(value=>[value,label(value[0].toUpperCase()+value.slice(1))]);
    field('mode','Default action','Website default action',modes,modes.find(([value])=>value===site.defaults.mode)?.[1]);
    field('targetLanguage','Target language','Website target language',[['en',label('English')],['zh',label('Chinese')]],site.defaults.targetLanguage?label(site.defaults.targetLanguage==='zh'?'Chinese':'English'):'');
    const profileLabel=p=>`${p.name} · ${llmProviderName(p.provider)}${p.model?` / ${p.model}`:''}${!p.enabled || !p.consent?` · ${label('Not enabled / authorized')}`:''}`;
    const profiles=site.profiles.map(p=>[p.id,profileLabel(p)]),selected=draft.llmProfileId;
    if(selected && !site.profiles.some(p=>p.id===selected))profiles.push([selected,label('Configuration removed')]);
    field('llmProfileId','LLM configuration','Website LLM configuration',[['@off',label('MT only')],...profiles],site.profiles.find(p=>p.id===site.defaults.activeLlmId)?.name);
    const engines=[['auto',label('On-device first')],['builtin',label('On-device')],['googleweb',label('Google Translate (web)')],['bing',label('Microsoft Bing (web)')],['microsoft',label('Microsoft Edge')],['mymemory','MyMemory'],['libre','LibreTranslate'],['azure',label('Microsoft Azure')],['google','Google Cloud']];
    field('basicEngine','Translation engine','Website translation engine',engines,engines.find(([value])=>value===site.defaults.basicEngine)?.[1]);
    const save=async resetAll=>{
      this.handlers.onSiteControlStart?.();this.shadow.querySelector('.close')?.focus({preventScroll:true});
      for(const control of controls)control.disabled=true;saveButton.disabled=true;reset.disabled=true;
      this.status(label('Saving website settings…'));
      try{await this.handlers.onSitePreferences(resetAll?null:{...draft});this.status(label(resetAll?'Website settings reset to global defaults.':'Website settings saved. Used from the next suggestion.'));}
      catch(error){this.status(error.message);for(const control of controls)control.disabled=Boolean(site.blocked);saveButton.disabled=Boolean(site.blocked);reset.disabled=false;}
    };
    const actions=node('div',undefined,{class:'row site-buttons'}),saveButton=this.button(label('Save for this website'),()=>save(false),true),reset=this.button(label('Reset website settings'),()=>save(true));
    saveButton.disabled=Boolean(site.blocked);reset.disabled=!Object.keys(site.preferences).length;
    actions.append(saveButton,reset);policy.append(grid,node('p',label('Only this hostname. Provider authorization is managed in Settings.'),{class:'site-help'}),actions);
    const admin=node('div',undefined,{class:'row site-admin'});
    admin.append(this.button(label('Manage providers'),()=>chrome.runtime.sendMessage({type:'open-settings'})));
    if(site.mode==='blacklist'){
      if(site.blocked && !site.canRemove){
        policy.append(node('p',siteText(site,'Blocked by rule: {rule}',{rule:site.rule})));
        admin.append(this.button(label('Manage blacklist rule'),()=>chrome.runtime.sendMessage({type:'open-settings'})));
      }else{
        const block=this.button(label(site.blocked?'Remove this site from blacklist':'Add this site to blacklist'),async()=>{
          this.shadow.querySelector('.close')?.focus({preventScroll:true});block.disabled=true;this.status(label('Updating blacklist…'));
          try{await this.handlers.onSiteBlocked(!site.blocked);}catch(error){this.status(error.message);block.disabled=false;}
        });block.addEventListener('pointerdown',()=>this.handlers.onSiteControlStart?.());admin.append(block);
      }
    }
    policy.append(admin);return policy;
  }
  show(editor,view) {
    if((this.pointerActive || this.editingSite()) && this.host.isConnected){this.queuedView=[editor,view];return;}
    this.discardQueued();
    const previousPolicy=this.host.isConnected?this.shadow.querySelector('.site-policy'):null;if(previousPolicy)this.siteOpen=previousPolicy.open;
    const {mode='auto',result,error,busy,localAvailable=false,site,mtResult,pendingLLM,llmError,mtError}=view;
    const hadFocus=document.activeElement===this.host;
    this.site=site;
    this.isSitePanel=Boolean(site && !result && !busy && !error);
    this.shadow.replaceChildren(); const style=node('style',css+siteCSS+compactCSS+dragCSS+sizeCSS);const card=node('section',undefined,{class:'card','aria-label':'Saywell suggestion'});
    const header=node('header');this.makeHandle(header,site);
    const close=this.button('×',this.handlers.onDismiss);close.className='close';close.setAttribute('aria-label','Dismiss suggestion');header.append(close);card.append(header);
    const toolbar=node('div',undefined,{class:'row toolbar'});const select=node('select',undefined,{'aria-label':'Suggestion action'});
    for(const value of ['auto','translate','polish','explain']){const option=node('option',value[0].toUpperCase()+value.slice(1),{value});select.append(option);}select.value=mode;
    select.addEventListener('change',()=>this.handlers.onMode(select.value));toolbar.append(select);
    if(result)toolbar.append(node('span',`${result.category==='llm'?'AI coach':'Basic translation'} · ${result.engine}`,{class:`engine ${result.category==='llm'?'llm':''}`}));
    card.append(toolbar);select.disabled=Boolean(site?.blocked);
    if(site?.blocked)card.append(node('p',siteText(site,'This website is blocked. Translation and local analytics are paused here.'),{class:'site-blocked',role:'status'}));
    if(busy)card.append(node('div','Working on your sentence…',{class:'busy',role:'status'}));
    if(error){card.append(node('p',site?siteText(site,error):error,{class:'note error',role:'status'}));const open=this.button('Open Settings',()=>chrome.runtime.sendMessage({type:'open-settings'}));card.append(open);}
    if(localAvailable){card.append(this.button('Prepare on-device',this.handlers.onPrepare));card.append(node('p','Your browser may download a language model. Text stays on this device.',{class:'note'}));}
    if(result){
      const sentence=node('div',undefined,{class:'suggestion'});this.renderSentence(sentence,result);card.append(sentence);
      if(!result.changed && result.action!=='explain')card.append(node('p','Already sounds natural.',{class:'note'}));
      if(result.explanation){const detail=node('details');detail.append(node('summary',result.action==='explain'?'Meaning & phrasing':'Why this change'),node('p',result.explanation));if(result.action==='explain')detail.open=true;card.append(detail);}
      if(result.alternative){const detail=node('details');detail.append(node('summary','Another way to say it'),node('p',result.alternative));card.append(detail);}
      this.vocabArea=node('div');card.append(this.vocabArea);
      const footer=node('footer');footer.append(this.button('Copy',()=>this.handlers.onCopy(result.text)),node('span',undefined,{class:'spacer'}),this.button('Dismiss',this.handlers.onDismiss));
      const apply=this.button('Apply ↗',()=>this.handlers.onApply(result),true);apply.disabled=!result.canApply || !result.changed || result.action==='explain';footer.append(apply);card.append(footer);
      // Keep the editor's focus/selection until the explicit replacement begins.
      apply.addEventListener('pointerdown',e=>e.preventDefault());
      if(!result.canApply)card.append(node('p','This editor needs Copy. Your text stays in place.',{class:'note'}));
    }
    this.parallelArea=node('div',undefined,{class:'parallel-results'});card.append(this.parallelArea);this.updateParallel({mtResult,pendingLLM,llmError,mtError,site});
    if(site)card.append(this.siteSettings(site));
    this.note=node('div','',{class:'note',role:'status'});card.append(this.note);this.shadow.append(style,card);
    if(!this.host.isConnected)document.documentElement.append(this.host);
    if(hadFocus)this.host.focus({preventScroll:true});
    this.position(editor);
  }
  updateParallel({mtResult,pendingLLM,llmError,mtError,site}){
    if(!this.parallelArea)return;const area=this.parallelArea;area.replaceChildren();
    const label=message=>site?siteText(site,message):message;
    if(pendingLLM)area.append(node('p',label('LLM refinement is still running…'),{class:'note',role:'status'}));
    if(llmError)area.append(node('p',`${label('LLM unavailable; showing MT.')} ${label(llmError)}`,{class:'note',role:'status'}));
    if(mtError && !pendingLLM)area.append(node('p',label('MT unavailable; showing LLM.'),{class:'note'}));
    if(mtResult){
      const detail=node('details',undefined,{class:'mt-result'});detail.append(node('summary',`${label('Machine translation')} · ${mtResult.engine}`),node('p',mtResult.text,{class:'mt-text'}));
      const actions=node('div',undefined,{class:'row'});actions.append(this.button(label('Copy MT'),()=>this.handlers.onCopy(mtResult.text)));
      const apply=this.button(label('Apply MT'),()=>this.handlers.onApply(mtResult));apply.disabled=!mtResult.canApply || !mtResult.changed;apply.addEventListener('pointerdown',e=>e.preventDefault());actions.append(apply);detail.append(actions);area.append(detail);
      detail.addEventListener('toggle',()=>{if(this.editor)this.position(this.editor);});
    }
  }
  renderSentence(container,result){
    const terms=(result.vocabulary || []).map(v=>({...v,pos:result.text.toLowerCase().indexOf(v.word.toLowerCase())})).filter(v=>v.pos>=0).sort((a,b)=>a.pos-b.pos);
    let offset=0;
    for(const item of terms){if(item.pos<offset)continue;container.append(document.createTextNode(result.text.slice(offset,item.pos)));
      const b=this.button(result.text.slice(item.pos,item.pos+item.word.length),()=>this.word(item,result));b.className='word';b.title=`${item.word} · ${item.meaning}`;b.addEventListener('mouseenter',()=>this.word(item,result));container.append(b);offset=item.pos+item.word.length;}
    container.append(document.createTextNode(result.text.slice(offset)));
  }
  word(item,result){
    const box=node('div',undefined,{class:'vocab'});box.append(node('strong',item.word),node('p',`${item.pronunciation || ''} ${item.meaning}`),node('p',item.explanation));
    if(item.example){const detail=node('details');detail.append(node('summary','Show example'),node('p',item.example));box.append(detail);}
    const consent=node('label');const check=node('input',undefined,{type:'checkbox',class:'context'});consent.append(check,document.createTextNode(' Include this sentence when saving (optional)'));box.append(consent);
    const row=node('div',undefined,{class:'row'});
    const save=async known=>{try{await this.handlers.onWord(item,known,check.checked,result.text);this.status(known?'Marked as known.':'Saved for review.');this.shadow.querySelector('.close')?.focus({preventScroll:true});box.remove();}catch(e){this.status(e.message);}};
    row.append(this.button('Known',()=>save(true)),this.button('Save for review',()=>save(false)));box.append(row);this.vocabArea.replaceChildren(box);
  }
  status(text){if(this.note)this.note.textContent=text;}
  position(editor){
    this.editor=editor;
    if(!this.host.isConnected || !editor?.isConnected)return;
    const viewport=this.viewport(),padding=Math.min(12,viewport.width/2,viewport.height/2);
    this.host.style.width=`${Math.min(TOOLTIP_SIZES[this.size],Math.max(1,viewport.width-2*padding))}px`;
    this.host.style.maxHeight=`${Math.max(1,viewport.height-2*padding)}px`;this.host.style.overflowY='auto';
    if(this.drag){this.move(this.host.getBoundingClientRect());return;}
    const bounds=this.bounds();
    if(this.placement){this.move(placedTooltip(this.placement,bounds));return;}
    const rect=editor.getBoundingClientRect(),height=this.host.getBoundingClientRect().height;
    const top=rect.bottom+8+height>viewport.top+viewport.height-padding?rect.top-height-8:rect.bottom+8;
    this.move({left:rect.left,top});
  }
}
