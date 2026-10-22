import {siteText} from './site-controls.js';
import {createMark} from '../brand/mark.js';
import {llmProviderName} from '../core/llm-providers.js';
import {validTooltipPosition,tooltipBounds,clampTooltip,relativeTooltip,placedTooltip,safeTooltipDock} from '../core/tooltip-position.js';
import {TOOLTIP_SIZES,validTooltipSize} from '../core/tooltip-size.js';
import {createPracticeComparer} from '../core/practice-diff.js';
const css=`
:host{all:initial;color-scheme:light;font:14px/1.5 'Segoe UI',sans-serif;color:#203d36;position:fixed;z-index:2147483647;display:block;width:min(410px,calc(100vw - 24px));}
*{box-sizing:border-box} .card{background:#fffef9;border:1px solid #cdd8cd;border-radius:16px;box-shadow:0 12px 45px #163b3426;overflow:hidden;padding:16px;animation:arrive .16s ease-out}
@keyframes arrive{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
header,footer,.row{display:flex;align-items:center;gap:8px}header{justify-content:space-between;margin-bottom:12px}.brand{font-weight:700;letter-spacing:-.3px}.saywell-mark{display:block;width:22px;height:22px;flex:none;margin-right:3px;pointer-events:none}button,select{font:inherit;color:inherit}button{cursor:pointer;background:transparent;border:1px solid #cdd8cd;border-radius:7px;padding:5px 11px}button:hover{background:#f0f4e8}button:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid #46775e;outline-offset:2px}button:disabled{opacity:.5;cursor:default}.close{border:0;padding:2px 6px;font-size:20px;line-height:1}.primary{background:#234f40;color:white;border-color:#234f40}.primary:hover{background:#173e30}.suggestion{font:19px/1.5 Georgia,serif;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 14px;max-height:210px;overflow:auto}.engine{font-size:11px;letter-spacing:.35px;color:#67766b}.llm{color:#936331}.toolbar{margin-bottom:10px}select{background:#f4f6ee;border:1px solid #d8dfd2;border-radius:6px;padding:3px 7px;font-size:12px}footer{border-top:1px solid #e4e7dc;padding-top:12px}.spacer{flex:1}.note{font-size:12px;color:#6a776d;margin-top:9px;white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#8e492f}details{margin:10px 0;font-size:12px}summary{cursor:pointer;color:#557044}details p{white-space:pre-wrap;margin:7px 0} .word{font:inherit;padding:0 1px;border:0;border-radius:0;border-bottom:1px dashed #6b864e}.word:hover{background:#edf2df}.vocab{background:#f2f5e9;border-radius:10px;padding:12px;margin:10px 0}.vocab strong{font-size:15px}.vocab p{font-size:12px;margin:5px 0}.vocab .row{flex-wrap:wrap;margin-top:10px}.vocab label{display:block;font-size:11px;margin-top:9px}.vocab button{font-size:11px;padding:4px 7px}.context{accent-color:#315940}a{color:#315940}.busy{font-size:14px;color:#697c68;padding:12px 0}@media(prefers-reduced-motion:reduce){.card{animation:none}}
`;
const siteCSS='.site-policy{border-top:1px solid #e4e7dc;margin-top:12px;padding-top:10px;font-size:11px;color:#61745d}.site-policy .row{justify-content:space-between;flex-wrap:wrap}.site-policy button{font-size:11px;padding:4px 8px}.site-policy .hostname{overflow-wrap:anywhere;color:#7b8575;margin:3px 0 8px}.site-blocked{background:#f7eee5;border-radius:8px;padding:10px;font-size:12px;margin:8px 0;color:#85553a}';
const compactCSS='.site-policy{margin:6px 0 0;padding-top:6px}.site-policy>summary{font-size:10px;color:#7a8778;line-height:20px}.site-policy>summary::marker{font-size:8px}.site-policy[open]>summary{margin-bottom:8px}.site-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px 10px;margin:9px 0}.site-field{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:10px}.site-field select{width:100%;min-width:0;max-width:100%;min-height:29px;font-size:11px;padding:4px;background:#fffef9;text-overflow:ellipsis}.site-buttons{justify-content:flex-start!important;margin-top:10px}.site-help{font-size:10px;line-height:1.5;color:#7a8778}.site-admin{border-top:1px solid #e4e7dc;padding-top:7px;margin-top:9px;justify-content:flex-start!important}.site-admin button{border-color:transparent;color:#7a8778;padding:2px 0}.site-admin button+button{margin-left:auto}.site-policy .hostname{margin:0;line-height:1.5}';
const dragCSS='.drag-handle{display:flex;align-items:center;gap:5px;flex:1;min-width:0;text-align:left;cursor:grab;touch-action:none;user-select:none;border:0;padding:3px 0}.drag-handle:hover{background:transparent}.grip{font-size:17px;color:#9ca894;letter-spacing:-4px;margin-right:7px}.position-reset{display:inline-grid;place-items:center;flex:none;width:20px;height:22px;border:0;border-radius:4px;padding:0;color:#557253;background:#eef3e7}.position-reset svg{width:13px;height:13px;transform:rotate(30deg);pointer-events:none}.position-reset:disabled{visibility:hidden}:host([data-dragging]) .drag-handle{cursor:grabbing}:host([data-dragging]) .card{animation:none}';
const sizeCSS=`:host{--pad:10px;--text:16px;--body:130px;--space:7px;font-size:12px}:host([data-size=medium]){--pad:13px;--text:18px;--body:190px;--space:10px;font-size:13px}:host([data-size=large]){--pad:16px;--text:20px;--body:260px;--space:12px;font-size:14px}.card{padding:var(--pad)}header{margin-bottom:var(--space);gap:5px}.suggestion{font-size:var(--text);max-height:var(--body);margin:6px 0 var(--space)}.toolbar{margin-bottom:var(--space);flex-wrap:wrap;gap:5px}.engine{letter-spacing:0;overflow-wrap:anywhere}footer{padding-top:var(--space);gap:5px}footer button{padding:4px 8px}.tooltip-size{width:74px;min-width:0;font-size:10px;padding:3px;flex:none}.saywell-mark{width:19px;height:19px}.grip{margin-right:3px}.note:empty{display:none}`;
const practiceCSS=`.mini-entry{border:0;padding:2px 0;color:#71806c;font-size:10px}.snooze-entry{display:grid;place-items:center;flex:none;width:20px;height:22px;border:0;padding:0;font-size:17px;color:#71806c}.mini-menu{background:#f2f5ec;border-radius:8px;padding:9px;margin-bottom:9px;display:flex;flex-wrap:wrap;gap:7px;align-items:end}.mini-menu[hidden]{display:none}.mini-menu label{display:grid;gap:3px;font-size:10px;flex:1;min-width:80px}.mini-menu select{width:100%;min-width:0;font-size:11px}.mini-menu button{font-size:10px;padding:4px 7px}.practice-panel{margin:8px 0 12px;padding:10px;background:#f4f6ee;border:1px solid #e0e6d6;border-radius:10px}.practice-heading{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600}.practice-heading button{padding:0 4px;border:0;font-size:16px}.practice-target{font:15px/1.5 Georgia,serif;white-space:pre-wrap;overflow-wrap:anywhere;max-height:85px;overflow:auto;margin:7px 0 9px}.practice-editor{position:relative}.practice-editor textarea,.practice-mirror{font:14px/1.6 'Segoe UI',sans-serif;letter-spacing:normal;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;padding:9px;margin:0;box-sizing:border-box}.practice-editor textarea{display:block;position:relative;z-index:1;background:transparent;color:#203d36;caret-color:#234f40;width:100%;height:88px;min-height:65px;max-height:150px;resize:vertical;border:1px solid #c7d2bd;border-radius:7px}.practice-editor textarea:focus{outline:2px solid #718e65;outline-offset:1px}.practice-mirror{position:absolute;top:1px;left:1px;pointer-events:none;overflow:hidden;color:transparent;background:#fffef9;border-radius:6px}.practice-mirror mark{color:transparent}.practice-major{background:#f6d8cf;border-radius:2px;text-decoration:underline;text-decoration-color:#b85d42}.practice-minor{background:#ece9d6;border-radius:2px;text-decoration:underline dotted #aa9d6b}.practice-pending{color:#94a08d;background:transparent}.practice-summary{display:flex;align-items:start;justify-content:space-between;gap:8px;margin-top:7px;font-size:10px;color:#71806c}.practice-summary p{margin:0}.practice-summary button{border:0;padding:0;white-space:nowrap;font-size:10px}.practice-help{margin:5px 0 0;font-size:10px;color:#7b8874}:host([data-practicing]) .suggestion,:host([data-practicing]) .practice-entry{display:none}`;
const node=(tag,text,attrs={})=>{const e=document.createElement(tag); if(text!==undefined)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
const progressCSS=`:host{all:initial;position:fixed;display:block;width:24px;height:24px;z-index:2147483647;pointer-events:none;contain:strict;color:#315f48}svg{display:block;width:24px;height:24px;background:#fffef9;border-radius:50%;box-shadow:0 1px 4px #163b3426}circle{fill:none;stroke-width:2}.track{stroke:#dde5d7}.progress{stroke:currentColor;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;transform:rotate(-90deg);transform-origin:center}:host([data-phase=waiting]) svg{animation:waiting 1s linear infinite}:host([data-phase=waiting]) .progress{stroke-dashoffset:72}@keyframes waiting{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){:host([data-phase=waiting]) svg{animation:none}}`;
// Animate decoration, not button geometry: pointer-down/click must keep the same target.
const revealCSS='.card.from-progress{position:relative;animation:reveal .18s ease-out}.card.from-progress::before{content:"";position:absolute;inset:0;background:#dfead6;pointer-events:none;transform-origin:inherit;animation:unfold .18s ease-out forwards}@keyframes reveal{from{opacity:0}to{opacity:1}}@keyframes unfold{from{opacity:.55;transform:scale(.08)}to{opacity:0;transform:scale(1)}}@media(prefers-reduced-motion:reduce){.card.from-progress{animation:none}.card.from-progress::before{display:none}}';
export class Tooltip {
  constructor({onDismiss,onMode,onApply,onCopy,onWord,onPrepare,onSiteBlocked,onSiteControlStart,onPositionChange,onSitePreferences,onSizeChange,onSnooze}) {
    this.host=document.createElement('input-coach-tip'); this.host.setAttribute('data-input-coach-ignore','');this.host.tabIndex=-1;
    this.shadow=this.host.attachShadow({mode:'open'}); this.handlers={onDismiss,onMode,onApply,onCopy,onWord,onPrepare,onSiteBlocked,onSiteControlStart,onPositionChange,onSitePreferences,onSizeChange,onSnooze};this.setSize('small');
    this.host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(this.practice)this.closePractice();else if(this.snoozeOpen)this.toggleSnooze(false);else onDismiss();}else if(this.practice)e.stopPropagation();});
    this.host.addEventListener('pointerdown',()=>{this.pointerActive=true;});
    const release=()=>{if(!this.pointerActive)return;this.pointerActive=false;setTimeout(()=>this.flushQueued(),0);};
    document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);
    this.host.addEventListener('focusout',()=>setTimeout(()=>this.flushQueued(),0));
    this.observer=new ResizeObserver(()=>this.requestPosition(this.editor));
    this.observer.observe(this.host);
  }
  discardQueued(){this.queuedView=null;}
  queueProgress(editor,{duration=0,action='translate',site,waiting=false}={}){
    this.progressState={editor,duration,action,site,waiting,started:performance.now()};
    // Defer DOM insertion and all geometry out of the editor's input handler.
    if(!this.progressFrame)this.progressFrame=requestAnimationFrame(()=>{this.progressFrame=0;this.renderProgress();});
  }
  hideProgress(){
    cancelAnimationFrame(this.progressFrame);this.progressFrame=0;this.progressState=null;
    this.progressAnimation?.cancel();this.progressAnimation=null;if(this.progressHost?.isConnected)this.progressHost.remove();
  }
  pauseProgress(){
    const state=this.progressState;if(!state || state.paused)return;
    state.paused=true;state.pausedAt=performance.now();this.progressAnimation?.pause();
    if(this.progressHost){this.progressHost.setAttribute('data-paused','');const text=siteText(state.site || {},'Input method composing · paused');this.progressHost.setAttribute('aria-label',text);this.progressHost.title=text;this.progressGlyph.textContent='Ⅱ';}
  }
  renderProgress(){
    const state=this.progressState;if(!state || !state.editor?.isConnected)return this.hideProgress();
    if(!this.progressHost){
      this.progressHost=node('saywell-progress',undefined,{'data-input-coach-ignore':'',role:'status'});
      const shadow=this.progressHost.attachShadow({mode:'open'}),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
      for(const name of ['track','progress']){const circle=document.createElementNS(svg.namespaceURI,'circle');for(const[key,value]of Object.entries({cx:12,cy:12,r:8,pathLength:100,class:name}))circle.setAttribute(key,value);svg.append(circle);if(name==='progress')this.progressCircle=circle;}
      const glyph=document.createElementNS(svg.namespaceURI,'text');for(const[key,value]of Object.entries({x:12,y:14.5,'text-anchor':'middle',fill:'currentColor','font-size':7,'font-family':'system-ui,sans-serif'}))glyph.setAttribute(key,value);svg.append(glyph);this.progressGlyph=glyph;
      shadow.append(node('style',progressCSS+':host([data-paused]) svg{animation-play-state:paused}'),svg);
    }
    const label=state.paused?'Input method composing · paused':state.waiting?'Waiting for MT / LLM…':`Next: ${state.action}`,text=siteText(state.site || {},label);
    this.progressHost.setAttribute('aria-label',text);this.progressHost.title=text;this.progressHost.dataset.phase=state.waiting?'waiting':'countdown';
    this.progressHost.toggleAttribute('data-paused',Boolean(state.paused));
    this.progressGlyph.textContent=state.paused?'Ⅱ':state.waiting?'·':state.action==='translate'?(state.site?.language==='zh-CN'?'译':'T'):state.action==='polish'?(state.site?.language==='zh-CN'?'润':'P'):'?';
    this.progressAnimation?.cancel();this.progressAnimation=null;
    if(!state.waiting && !matchMedia('(prefers-reduced-motion: reduce)').matches){this.progressAnimation=this.progressCircle.animate([{strokeDashoffset:100},{strokeDashoffset:0}],{duration:state.duration,delay:-((state.pausedAt ?? performance.now())-state.started),fill:'forwards'});if(state.paused)this.progressAnimation.pause();}
    if(!this.progressHost.isConnected)document.documentElement.append(this.progressHost);
    this.positionProgress();
  }
  positionProgress(){
    const state=this.progressState;if(!state || !this.progressHost?.isConnected)return;
    if(!state.editor.isConnected)return this.hideProgress();
    const viewport=this.viewport(),rect=state.editor.getBoundingClientRect();
    const dock=safeTooltipDock(viewport,rect,{width:TOOLTIP_SIZES[this.size],height:210});
    let point=dock;
    if(this.placement){const saved=placedTooltip(this.placement,tooltipBounds(viewport,{width:TOOLTIP_SIZES[this.size],height:210}));if(saved.left+24<=rect.left-8 || saved.left>=rect.right+8 || saved.top+24<=rect.top-8 || saved.top>=rect.bottom+8)point=saved;}
    this.progressHost.style.display=point?'block':'none';
    if(point){this.progressHost.style.left=point.left+'px';this.progressHost.style.top=point.top+'px';}
  }
  editingSite(){return this.shadow.activeElement?.matches('[data-site-field],.tooltip-size');}
  setSize(size){this.size=validTooltipSize(size)?size:'small';this.host.dataset.size=this.size;if(this.sizeControl)this.sizeControl.value=this.size;this.position(this.editor);}
  flushQueued(){if(!this.practice && !this.snoozeOpen && !this.pointerActive && !this.editingSite() && this.queuedView && this.host.isConnected){const[editor,view]=this.queuedView;this.queuedView=null;this.show(editor,view);}}
  close(keepProgress=false){if(!keepProgress)this.hideProgress();this.discardQueued();this.cancelDrag();cancelAnimationFrame(this.positionFrame);cancelAnimationFrame(this.practiceFrame);this.positionFrame=0;this.practiceFrame=0;this.pointerActive=false;this.siteOpen=false;this.siteKey=null;this.practice=null;this.snoozeOpen=false;if(this.host.hasAttribute('data-practicing'))this.host.removeAttribute('data-practicing');if(this.host.isConnected)this.host.remove();}
  openSiteSettings(){const panel=this.shadow.querySelector('.site-policy');if(panel){panel.open=true;this.siteOpen=true;this.position(this.editor);}}
  restorePosition(position){this.placement=validTooltipPosition(position)?{x:position.x,y:position.y}:null;this.updatePositionControl();this.position(this.editor);}
  updatePositionControl(){
    const pinned=Boolean(this.placement);this.host.toggleAttribute('data-position-pinned',pinned);
    if(!this.resetButton)return;
    this.resetButton.disabled=!pinned;this.resetButton.setAttribute('aria-pressed',String(pinned));
    this.resetButton.title=siteText(this.site || {},pinned?'Position remembered for this website · Click to follow input':'Position follows input');
  }
  viewport(){const v=window.visualViewport;return {left:v?.offsetLeft || 0,top:v?.offsetTop || 0,width:v?.width || innerWidth,height:v?.height || innerHeight};}
  bounds(){return tooltipBounds(this.viewport(),this.host.getBoundingClientRect());}
  move(point,bounds=this.bounds()){const next=clampTooltip(point,bounds);for(const[key,value]of [['left',next.left+'px'],['top',next.top+'px']])if(this.host.style[key]!==value)this.host.style[key]=value;}
  remember(){
    this.updatePositionControl();
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
    const reset=this.button('',()=>{
      // Keep focus on a stable control before disabling the reset button.
      handle.focus({preventScroll:true});this.placement=null;this.position(this.editor);this.remember();
    });
    const ns='http://www.w3.org/2000/svg',pin=document.createElementNS(ns,'svg'),shape=document.createElementNS(ns,'path');
    pin.setAttribute('viewBox','0 0 24 24');pin.setAttribute('aria-hidden','true');pin.setAttribute('focusable','false');
    for(const[key,value]of Object.entries({d:'M12 17v5M9 3h6l-1 7 4 4v3H6v-3l4-4-1-7Z',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round'}))shape.setAttribute(key,value);
    pin.append(shape);reset.append(pin);reset.className='position-reset';reset.setAttribute('aria-label',label('Reset tooltip position'));this.resetButton=reset;this.updatePositionControl();
    const size=node('select',undefined,{class:'tooltip-size','aria-label':label('Tooltip size'),title:label('Tooltip size · remembered for this website')});
    for(const[value,text]of [['small','Small'],['medium','Medium'],['large','Large']])size.append(node('option',label(text),{value}));size.value=this.size;this.sizeControl=size;
    size.addEventListener('change',()=>{this.setSize(size.value);Promise.resolve(this.handlers.onSizeChange?.(this.size)).catch(()=>this.status(label('Size could not be saved. It will reset after reloading.')));});
    const snooze=this.button('◷',()=>this.toggleSnooze(!this.snoozeOpen));snooze.className='snooze-entry';snooze.setAttribute('aria-label',label('Pause temporarily'));snooze.title=label('Pause temporarily');snooze.setAttribute('aria-expanded','false');this.snoozeButton=snooze;
    header.append(handle,reset,snooze,size);
  }
  toggleSnooze(open){
    this.snoozeOpen=open;this.snoozeMenu.hidden=!open;this.snoozeButton.setAttribute('aria-expanded',String(open));
    if(open)this.snoozeMenu.querySelector('select').focus({preventScroll:true});else{this.snoozeButton.focus({preventScroll:true});this.flushQueued();}this.position(this.editor);
  }
  makeSnooze(){
    const label=message=>siteText(this.site || {},message),menu=node('div',undefined,{class:'mini-menu',hidden:''});
    const field=(title,options)=>{const holder=node('label',label(title)),select=node('select',undefined,{'aria-label':label(title),'data-snooze-field':''});for(const[value,text]of options)select.append(node('option',label(text),{value}));holder.append(select);menu.append(holder);return select;};
    const duration=field('Pause for',[['1h','1 hour'],['4h','4 hours'],['tomorrow','Until tomorrow']]),scope=field('Pause on',[['site','This website'],['all','All websites']]);
    const confirm=this.button(label('Pause'),async()=>{
      this.host.focus({preventScroll:true});for(const control of menu.querySelectorAll('button,select'))control.disabled=true;
      try{await this.handlers.onSnooze(scope.value,duration.value);}catch(error){this.status(error.message);for(const control of menu.querySelectorAll('button,select'))control.disabled=false;}
    });menu.append(confirm);this.snoozeMenu=menu;return menu;
  }
  startPractice(result){
    if(this.practice)return;const practice=this.practice={target:result.text},compare=createPracticeComparer(result.text);this.host.setAttribute('data-practicing','');
    const label=message=>siteText(this.site || {},message),panel=node('section',undefined,{class:'practice-panel','data-input-coach-ignore':'','aria-label':label('Sentence practice')}),heading=node('div',undefined,{class:'practice-heading'});
    const close=this.button('×',()=>this.closePractice());close.setAttribute('aria-label',label('Close practice'));heading.append(node('span',label('Try it yourself')),close);
    const target=node('div',undefined,{class:'practice-target'}),editor=node('div',undefined,{class:'practice-editor'}),mirror=node('div',undefined,{class:'practice-mirror','aria-hidden':'true'}),input=node('textarea',undefined,{'aria-label':label('Retype the suggested sentence'),maxlength:String(Math.max(6000,Math.min(22000,result.text.length+2000))),spellcheck:'false',autocomplete:'off',autocapitalize:'off','data-input-coach-ignore':'',placeholder:label('Retype the sentence here…')});
    const summary=node('div',undefined,{class:'practice-summary'}),feedback=node('p',undefined,{role:'status','aria-live':'polite'}),reset=this.button(label('Start again'),()=>{input.value='';update();input.focus({preventScroll:true});});summary.append(feedback,reset);
    const render=(container,parts)=>{let cursor=container.firstChild;for(const part of parts){const tag=part.kind==='match'?'SPAN':'MARK';let current=cursor;if(!current || current.nodeName!==tag){current=node(tag.toLowerCase());if(cursor)container.replaceChild(current,cursor);else container.append(current);}if(current.className!=='practice-'+part.kind)current.className='practice-'+part.kind;if(current.textContent!==part.text)current.textContent=part.text;cursor=current.nextSibling;}while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}};
    const sync=()=>{mirror.style.width=input.clientWidth+'px';mirror.style.height=input.clientHeight+'px';mirror.scrollTop=input.scrollTop;mirror.scrollLeft=input.scrollLeft;};
    let composing=false;
    const update=()=>{
      if(composing){mirror.textContent=input.value;sync();return;}
      const diff=compare(input.value);render(target,diff.target);render(mirror,diff.input);mirror.append(document.createTextNode('\n'));
      feedback.textContent=!input.value?label('Type at your own pace.'):diff.complete?label(diff.minor?'Words match · only case or punctuation differs.':'Sentence matched.'):siteText(this.site || {},'{major} character changes · {minor} minor changes',{major:diff.major,minor:diff.minor});
      panel.dataset.complete=String(diff.complete);sync();
    };
    const queueUpdate=()=>{if(this.practiceFrame)return;this.practiceFrame=requestAnimationFrame(()=>{this.practiceFrame=0;if(this.practice===practice && this.host.isConnected)update();});};
    input.addEventListener('input',queueUpdate);input.addEventListener('scroll',()=>{mirror.scrollTop=input.scrollTop;mirror.scrollLeft=input.scrollLeft;},{passive:true});input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;queueUpdate();});
    editor.append(mirror,input);panel.append(heading,target,editor,summary,node('p',label('Red: character differences · Dotted: case, spacing or punctuation. Local practice only.'),{class:'practice-help'}));
    this.practiceArea.append(panel);this.practice.input=input;this.practice.sync=sync;update();this.position(this.editor);input.focus({preventScroll:true});this.requestPosition(this.editor);
  }
  closePractice(){
    this.host.focus({preventScroll:true});cancelAnimationFrame(this.practiceFrame);this.practiceFrame=0;this.practice=null;this.host.removeAttribute('data-practicing');this.practiceArea?.replaceChildren();this.flushQueued();this.shadow.querySelector('.practice-entry')?.focus({preventScroll:true});this.position(this.editor);
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
    if((this.practice || this.snoozeOpen || this.pointerActive || this.editingSite()) && this.host.isConnected){this.queuedView=[editor,view];return;}
    const progressPoint=this.progressHost?.isConnected && this.progressHost.style.display!=='none'?{left:parseFloat(this.progressHost.style.left),top:parseFloat(this.progressHost.style.top)}:null;
    this.hideProgress();
    this.discardQueued();
    const previousPolicy=this.host.isConnected?this.shadow.querySelector('.site-policy'):null;if(previousPolicy)this.siteOpen=previousPolicy.open;
    const {mode='auto',result,error,busy,localAvailable=false,site,mtResult,pendingLLM,llmError,mtError}=view;
    const hadFocus=document.activeElement===this.host;
    this.site=site;
    this.isSitePanel=Boolean(site && !result && !busy && !error);
    this.shadow.replaceChildren(); const style=node('style',css+siteCSS+compactCSS+dragCSS+sizeCSS+practiceCSS);const card=node('section',undefined,{class:'card','aria-label':'Saywell suggestion'});
    const header=node('header');this.makeHandle(header,site);
    const close=this.button('×',this.handlers.onDismiss);close.className='close';close.setAttribute('aria-label','Dismiss suggestion');header.append(close);card.append(header,this.makeSnooze());
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
      const practice=this.button(siteText(site || {},'Practice this sentence'),()=>this.startPractice(result));practice.className='mini-entry practice-entry';card.append(practice);this.practiceArea=node('div');card.append(this.practiceArea);
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
    if(progressPoint){style.textContent+=revealCSS;card.classList.add('from-progress');}
    if(!this.host.isConnected)document.documentElement.append(this.host);
    if(hadFocus)this.host.focus({preventScroll:true});
    this.position(editor);
    if(progressPoint){const rect=this.host.getBoundingClientRect();card.style.transformOrigin=`${progressPoint.left-rect.left+12}px ${progressPoint.top-rect.top+12}px`;}
  }
  updateParallel({mtResult,pendingLLM,llmError,mtError,site}){
    if(!this.parallelArea)return;const area=this.parallelArea;area.replaceChildren();
    const label=message=>site?siteText(site,message):message;
    if(pendingLLM)area.append(node('p',label('LLM refinement is still running…'),{class:'note',role:'status'}));
    if(llmError)area.append(node('p',`${label('LLM unavailable; showing MT.')} ${label(llmError)}`,{class:'note',role:'status'}));
    if(mtError && !pendingLLM)area.append(node('p',label('MT unavailable; showing LLM.'),{class:'note'}));
    if(mtResult){
      const detail=node('details',undefined,{class:'mt-result'});detail.append(node('summary',`${label('Machine translation')} · ${mtResult.engine}`),node('p',mtResult.text,{class:'mt-text'}));
      const actions=node('div',undefined,{class:'row'});actions.append(this.button(label('Copy MT'),()=>this.handlers.onCopy(mtResult.text)),this.button(label('Practice MT'),()=>this.startPractice(mtResult)));
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
  requestPosition(editor){
    this.editor=editor;if(this.positionFrame || !(this.host.isConnected || this.progressHost?.isConnected) || !editor?.isConnected)return;
    this.positionFrame=requestAnimationFrame(()=>{this.positionFrame=0;this.positionProgress();if(this.host.isConnected){this.practice?.sync?.();this.position(this.editor);}});
  }
  position(editor){
    this.editor=editor;
    if(!this.host.isConnected || !editor?.isConnected)return;
    const viewport=this.viewport(),padding=Math.min(12,viewport.width/2,viewport.height/2);
    const styles={width:`${Math.min(TOOLTIP_SIZES[this.size],Math.max(1,viewport.width-2*padding))}px`,overflowY:'auto'};
    if(this.placement || this.drag)styles.maxHeight=`${Math.max(1,viewport.height-2*padding)}px`;
    for(const[key,value]of Object.entries(styles))if(this.host.style[key]!==value)this.host.style[key]=value;
    if(this.drag){this.move(this.host.getBoundingClientRect());return;}
    const hostRect=this.host.getBoundingClientRect(),bounds=tooltipBounds(viewport,hostRect);
    if(this.placement){this.move(placedTooltip(this.placement,bounds),bounds);return;}
    const dock=safeTooltipDock(viewport,editor.getBoundingClientRect(),{width:hostRect.width,height:this.shadow.querySelector('.card')?.getBoundingClientRect().height || hostRect.height});
    if(dock){
      for(const[key,value]of [['width',dock.width+'px'],['maxHeight',dock.height+'px']])if(this.host.style[key]!==value)this.host.style[key]=value;
      this.move(dock,tooltipBounds(viewport,dock));
    }else this.move({left:viewport.left+padding,top:viewport.top+padding},bounds);
  }
}
