import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {editorFor,readEditor,applyEditor,canApply} from '../src/content/editor.js';
const dom=new JSDOM('<!doctype html><body><textarea id="draft">hello</textarea><input id="password"><input type="password"><div id="plain" contenteditable="true">hi</div><div class="ProseMirror" contenteditable="true"><p><strong>rich</strong></p></div></body>');
for(const key of ['document','Element','HTMLTextAreaElement','HTMLInputElement','InputEvent'])globalThis[key]=key==='document'?dom.window.document:dom.window[key];
test('controlled field setter emits input and rejects stale or detached drafts',()=>{
  const editor=document.querySelector('#draft');let event;editor.addEventListener('input',e=>{event=e;});assert.equal(applyEditor(editor,'hello','Hello world.'),true);assert.equal(readEditor(editor),'Hello world.');assert.equal(event.bubbles,true);assert.equal(event.inputType,'insertReplacementText');
  assert.equal(applyEditor(editor,'hello','bad'),false);assert.equal(editor.value,'Hello world.');editor.remove();assert.equal(applyEditor(editor,'Hello world.','bad'),false);
});

test('plain paragraph and Draft.js wrappers allow native replacement; formatted/widgets keep Copy',()=>{
  const root=document.createElement('div');root.contentEditable='true';root.className='ProseMirror';document.body.append(root);
  root.innerHTML='<p>Plain text</p><p>Another line<br></p>';assert.equal(canApply(root),true);
  // A structured editor must never fall back to replacing its DOM when native editing is unavailable.
  const before=root.innerHTML;assert.equal(applyEditor(root,readEditor(root),'Changed'),false);assert.equal(root.innerHTML,before);
  root.className='public-DraftEditor-content';root.innerHTML='<div data-contents="true"><div data-block="true" data-editor="example" data-offset-key="a"><div class="public-DraftStyleDefault-block"><span data-offset-key="a"><span data-text="true">Draft text</span></span></div></div></div>';
  assert.equal(canApply(root),true);
  for(const markup of ['<p><a href="/">Link</a></p>','<p><img src="test"></p>','<p><span contenteditable="false">Mention</span></p>','<span data-text="true" style="font-weight:bold">Bold</span>']){root.innerHTML=markup;assert.equal(canApply(root),false);}
  root.remove();
});
test('X Draft text decorators for URLs, hashtags and emoji remain eligible without allowing rich entities',()=>{
  const root=document.createElement('div');root.setAttribute('contenteditable','true');root.className='notranslate public-DraftEditor-content';document.body.append(root);
  const decorated='<div data-contents="true"><div data-block="true" data-editor="fixture" data-offset-key="a"><div class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr" data-offset-key="a"><span data-offset-key="a-0-0"><span data-text="true">Read </span></span><span style="color:rgb(29,155,240)"><span data-offset-key="a-1-0"><span data-text="true">https://example.com</span></span></span><span style="color:rgb(29,155,240)"><span data-offset-key="a-2-0"><span data-text="true"> #Saywell </span></span></span><span style="background-image:url(&quot;https://abs.twimg.com/emoji/v2/svg/1f642.svg&quot;);background-size:1em 1em;padding:0.15em;background-position:center center;background-repeat:no-repeat;-webkit-text-fill-color:transparent"><span style="clip-path:circle(0% at center center)"><span data-offset-key="a-3-0"><span data-text="true">🙂</span></span></span></span></div></div></div>';
  root.innerHTML=decorated;assert.equal(canApply(root),true);const before=root.innerHTML;assert.equal(applyEditor(root,readEditor(root),'My own practice.'),false);assert.equal(root.innerHTML,before,'no destructive DOM fallback when native editing is unavailable');
  for(const extra of ['<span contenteditable="false">@mention</span>','<img src="https://example.com/test.png">','<span style="font-weight:bold"><span data-text="true">Bold</span></span>','<span style="background-image:url(https://example.com/custom.png)"><span data-text="true">Image</span></span>','<span data-entity-key="mention"><span data-text="true">Mention</span></span>']){root.innerHTML=decorated+extra;assert.equal(canApply(root),false,extra);}
  root.remove();
});

test('sensitive fields and rich editors are excluded from unsafe replacement',()=>{
  assert.equal(editorFor(document.querySelector('#password')),null);assert.equal(editorFor(document.querySelector('input[type=password]')),null);
  assert.equal(canApply(document.querySelector('.ProseMirror')),false);assert.equal(canApply(document.querySelector('#plain')),true);
  assert.equal(applyEditor(document.querySelector('.ProseMirror'),'rich','corrupt'),false);
});

test('nested editable targets retain sensitive and hidden editing-root exclusions',()=>{
  const root=document.createElement('div'),nested=document.createElement('span');root.contentEditable='true';nested.setAttribute('contenteditable','true');root.append(nested);document.body.append(root);
  // JSDOM does not implement isContentEditable; Chromium exposes it on this root.
  Object.defineProperty(root,'isContentEditable',{value:true});
  assert.equal(editorFor(nested),root);
  for(const [name,value]of [['id','api-token'],['name','password'],['autocomplete','cc-number'],['aria-label','API key'],['aria-hidden','true']]){
    root.setAttribute(name,value);assert.equal(editorFor(nested),null,`${name} must exclude the returned root`);root.removeAttribute(name);
  }
  nested.id='secret';assert.equal(editorFor(nested),null);nested.removeAttribute('id');assert.equal(editorFor(nested),root);root.remove();
});

test('plain Slate reads model text without placeholders/zero-width markers and rejects formatted leaves',()=>{
  const root=document.createElement('div');root.setAttribute('data-slate-editor','true');root.contentEditable='true';document.body.append(root);
  root.innerHTML='<div data-slate-node="element" style="position:relative"><span data-slate-node="text"><span data-slate-leaf="true" style="padding:5px 0"><span data-slate-placeholder="true" contenteditable="false">Placeholder</span><span data-slate-string="true">Hello</span></span></span></div><div data-slate-node="element"><span data-slate-zero-width="z" data-slate-length="0">\uFEFF<br></span></div><div data-slate-node="element"><span data-slate-string="true">World</span></div>';
  assert.equal(canApply(root),true);assert.equal(readEditor(root),'Hello\n\nWorld');
  root.querySelector('[data-slate-leaf]').style.fontWeight='bold';assert.equal(canApply(root),false);
  root.querySelector('[data-slate-leaf]').style.fontWeight='';root.querySelector('[data-slate-node]').setAttribute('data-slate-void','true');assert.equal(canApply(root),false);root.remove();
});
