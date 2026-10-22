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
