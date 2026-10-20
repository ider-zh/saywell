const sensitive = /password|passwd|credit.?card|cc-number|cc-csc|one-time-code|api.?key|secret|token|social.?security/i;
export function editorFor(target) {
  if (!(target instanceof Element)) return null;
  const element=target.closest('textarea,input,[contenteditable]');
  if (!element || element.closest('[data-input-coach-ignore]')) return null;
  if (element.matches('input') && !['text','search',''].includes(element.getAttribute('type') || '')) return null;
  if (element.matches('[contenteditable="false"]') || element.disabled || element.readOnly || element.getAttribute('aria-hidden')==='true') return null;
  if (sensitive.test([element.id,element.getAttribute('name'),element.getAttribute('autocomplete'),element.getAttribute('aria-label')].join(' '))) return null;
  let root=element;
  while (root.parentElement?.isContentEditable) root=root.parentElement;
  return root;
}
export function readEditor(element) {
  if(element.matches('input,textarea'))return element.value;
  if(element.matches('[data-slate-editor]')){
    const text=block=>[...block.querySelectorAll('[data-slate-string],[data-slate-zero-width]')].map(node=>node.hasAttribute('data-slate-zero-width')?node.textContent.replace(/\uFEFF/g,''):node.textContent).join('');
    const blocks=[...element.children].filter(child=>child.getAttribute('data-slate-node')==='element');
    return blocks.length?blocks.map(text).join('\n'):text(element);
  }
  return element.innerText ?? element.textContent ?? '';
}
function plainSlate(element){
  return [...element.querySelectorAll('*')].every(child=>{
    if(child.closest('[data-slate-placeholder]'))return true;
    return ['P','DIV','SPAN','BR'].includes(child.tagName) && !child.hasAttribute('contenteditable') && !child.hasAttribute('data-slate-void') &&
      [...child.attributes].every(a=>['class','dir','data-slate-node','data-slate-leaf','data-slate-string','data-slate-zero-width','data-slate-length'].includes(a.name) ||
        a.name==='style' && Array.from(child.style).every(name=>name==='position' || /^padding(?:-(?:top|right|bottom|left))?$/.test(name)));
  });
}
export function canApply(element) {
  if (!element.isConnected || element.disabled || element.readOnly) return false;
  if (element.matches('input,textarea')) return true;
  if(element.matches('[data-slate-editor]'))return plainSlate(element);
  if (element.closest('[data-lexical-editor],.ql-editor,.cm-editor,.monaco-editor')) return false;
  // Simple paragraphs and line breaks are still plain text, including common ProseMirror composers.
  // Marks, links, widgets and nested editors retain Copy fallback.
  const draft=element.matches('.public-DraftEditor-content') || Boolean(element.closest('.DraftEditor-root'));
  return [...element.querySelectorAll('*')].every(child=>
    (['P','DIV','BR'].includes(child.tagName) || draft && child.tagName==='SPAN' && (child.hasAttribute('data-text') || child.hasAttribute('data-offset-key'))) &&
    !child.hasAttribute('contenteditable') &&
    ![...child.attributes].some(a=>!['class','dir',...(draft?['data-contents','data-block','data-editor','data-offset-key','data-text']:[])].includes(a.name)));
}
export function applyEditor(element,source,text,valid=()=>true) {
  if (!valid() || !canApply(element) || readEditor(element)!==source) return false;
  element.focus({preventScroll:true});
  if(!valid() || readEditor(element)!==source)return false;
  if(element.matches('[data-slate-editor]'))return applySlate(element,source,text,valid);
  if (element.matches('input,textarea')) {
    const prototype=element.matches('textarea') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,text);
    element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText',data:text,composed:true}));
    element.setSelectionRange(text.length,text.length);
  } else {
    const doc=element.ownerDocument,selection=doc.getSelection(); const range=doc.createRange();
    range.selectNodeContents(element); selection.removeAllRanges(); selection.addRange(range);
    const done=typeof doc.execCommand==='function' && doc.execCommand('insertText',false,text);
    if (!done) {
      if(element.children.length || element.closest('.ProseMirror'))return false;
      element.textContent=text;
      element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText',data:text,composed:true}));
    }
    selection.collapse(element,element.childNodes.length);
  }
  return readEditor(element)===text;
}

async function applySlate(element,source,text,valid){
  const doc=element.ownerDocument,win=doc.defaultView,selection=doc.getSelection(),previous=selection.rangeCount?selection.getRangeAt(0).cloneRange():null;
  const range=doc.createRange();range.selectNodeContents(element);selection.removeAllRanges();selection.addRange(range);
  // Slate synchronizes DOM selection with its model on selectionchange before handling paste.
  doc.dispatchEvent(new Event('selectionchange'));
  await new Promise(resolve=>win.setTimeout(resolve,150));
  const selected=selection.rangeCount?selection.getRangeAt(0):null;
  // Slate normalizes equivalent root-boundary selections into text-node boundaries.
  const whole=current=>current && element.contains(current.startContainer) && element.contains(current.endContainer) && current.toString()===range.toString();
  if(!valid() || !canApply(element) || readEditor(element)!==source || !whole(selected))return false;
  const data=new win.DataTransfer();data.setData('text/plain',text);
  // Let the editor's own paste handler update its model; do not replace framework-owned DOM.
  element.dispatchEvent(new win.ClipboardEvent('paste',{bubbles:true,cancelable:true,composed:true,clipboardData:data}));
  await new Promise(win.requestAnimationFrame);
  // Some plain Slate hosts override paste. Native insertText can still feed their input reconciliation.
  const current=selection.rangeCount?selection.getRangeAt(0):null;
  if(valid() && canApply(element) && readEditor(element)===source && whole(current) && typeof doc.execCommand==='function'){
    doc.execCommand('insertText',false,text);await new Promise(win.requestAnimationFrame);
  }
  const accepted=readEditor(element)===text;
  if(!accepted && readEditor(element)===source && previous && element.contains(previous.startContainer)){selection.removeAllRanges();selection.addRange(previous);}
  return accepted;
}
