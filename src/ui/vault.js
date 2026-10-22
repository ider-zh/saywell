import {send,el,t,toast,status} from './shared.js';
export function mountVault(container,onChange){
  const box=el('section',undefined,'local-vault'),heading=el('h3'),description=el('p',undefined,'help'),state=el('p',undefined,'help'),migration=el('p',undefined,'help'),label=el('label',undefined,'field'),caption=el('span'),password=el('input'),confirmLabel=el('label',undefined,'field'),confirmCaption=el('span'),confirmPassword=el('input'),actions=el('div',undefined,'actions');
  box.id='local-vault';password.id='vault-password';password.type='password';password.autocomplete='new-password';password.maxLength=256;
  confirmPassword.id='vault-confirm-password';confirmPassword.type='password';confirmPassword.autocomplete='new-password';confirmPassword.maxLength=256;
  label.append(caption,password);confirmLabel.append(confirmCaption,confirmPassword);
  const buttons={};for(const [id,message]of Object.entries({create:'Create encrypted vault',unlock:'Unlock vault',lock:'Lock vault',erase:'Delete vault and private data'})){
    const button=el('button',t(message),id==='erase'?'quiet danger':'quiet');button.id='vault-'+id;button.type='button';button.dataset.label=message;buttons[id]=button;actions.append(button);
  }
  const warning=el('p',undefined,'help hidden'),confirmErase=el('button',undefined,'quiet danger hidden');confirmErase.id='vault-confirm-erase';confirmErase.type='button';
  box.append(heading,description,state,migration,label,confirmLabel,actions,warning,confirmErase);const title=container.querySelector('.section-title');if(title)title.after(box);else container.prepend(box);
  let info={sessionOnly:true},busy=false;
  function render(){
    heading.textContent=t('Local vault');description.textContent=t('Translation works without a vault password. Session history, vocabulary and statistics are kept in browser memory. Create a password-protected vault to retain them after restart. Forgotten passwords cannot be recovered.');
    state.textContent=t(info.error?'Vault unavailable. You can delete private data to start again.':info.locked?'Vault locked. Private recording is paused; free translation still works.':info.configured?'Vault unlocked. Private records and remembered keys are encrypted on this device.':'Session only. Private records disappear when this browser session ends.');
    migration.textContent=t('Existing plaintext records were moved into this session. Create a vault before closing the browser to retain them.');migration.classList.toggle('hidden',!info.migrated || info.configured);
    caption.textContent=t(info.configured?'Vault password':'New vault password (12–256 characters)');confirmCaption.textContent=t('Confirm vault password');label.classList.toggle('hidden',info.configured && !info.locked);confirmLabel.classList.toggle('hidden',info.configured);
    password.autocomplete=info.configured?'current-password':'new-password';
    for(const[id,button]of Object.entries(buttons)){button.textContent=t(button.dataset.label);button.disabled=busy;button.classList.toggle('hidden',id==='create'?info.configured:id==='unlock'?!info.locked:id==='lock'?!info.configured || info.locked:false);}
    confirmErase.textContent=t('Confirm delete private data');warning.textContent=t('This deletes encrypted history, vocabulary, statistics and remembered keys. Export anything you need while unlocked. Website and provider settings remain.');
  }
  const refresh=async()=>{if(!globalThis.chrome?.runtime?.id)return;try{info=await send('vault-status');}catch(error){info={configured:true,locked:true,error:true};status(error.message,true);}render();};
  async function run(action){
    if(busy)return;busy=true;render();
    try{
      if(action==='create' && password.value!==confirmPassword.value)throw new Error('Vault passwords do not match.');
      await send('vault-'+action,{...(['create','unlock'].includes(action)?{password:password.value}:{}),...(action==='erase'?{confirm:true}:{})});
      password.value='';confirmPassword.value='';warning.classList.add('hidden');confirmErase.classList.add('hidden');await refresh();await onChange?.();toast('Vault updated.');
    }catch(error){status(error.message,true);toast(error.message,true);}
    finally{password.value='';confirmPassword.value='';busy=false;render();}
  }
  for(const id of ['create','unlock','lock'])buttons[id].addEventListener('click',()=>run(id));
  buttons.erase.addEventListener('click',()=>{warning.classList.remove('hidden');confirmErase.classList.remove('hidden');});confirmErase.addEventListener('click',()=>run('erase'));
  for(const input of [password,confirmPassword])input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();run(info.configured?'unlock':'create');}});
  if(globalThis.chrome?.runtime?.id)chrome.storage.onChanged.addListener(changes=>{const item=changes.saywellPrivateSession;if(changes.saywellVault || item && item.oldValue?.key!==item.newValue?.key)refresh().catch(error=>status(error.message,true));});
  const lifecycle=el('p',t('Browser restart or extension reload, update or disable clears session-only records and locks the vault.'),'help');lifecycle.dataset.i18n='Browser restart or extension reload, update or disable clears session-only records and locks the vault.';description.after(lifecycle);
  document.addEventListener('input-coach-languagechange',render);render();refresh().catch(error=>status(error.message,true));return refresh;
}
