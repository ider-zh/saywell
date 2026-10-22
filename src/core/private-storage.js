// Private payloads never go to disk without a user-password-wrapped data key.
// Session storage is browser memory, restricted to trusted extension contexts.
const FIELDS=['keys','translationHistory','vocabulary','analytics'];
const META='saywellVault',DATA='saywellPrivateData',SESSION='saywellPrivateSession';
const ITERATIONS=600000,encoder=new TextEncoder(),decoder=new TextDecoder();
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const b64=value=>{let text='';for(const byte of value)text+=String.fromCharCode(byte);return btoa(text);};
const un64=(value,max=8*1024*1024)=>{if(typeof value!=='string' || value.length>max || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Encrypted data is invalid.');return Uint8Array.from(atob(value),c=>c.charCodeAt(0));};
const aes=raw=>crypto.subtle.importKey('raw',un64(raw,64),'AES-GCM',false,['encrypt','decrypt']);
async function seal(key,value,purpose){
  const iv=bytes(12),data=encoder.encode(JSON.stringify(value));
  return {v:1,iv:b64(iv),ciphertext:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(purpose)},key,data)))};
}
async function open(key,envelope,purpose){
  if(envelope?.v!==1)throw new Error('Encrypted data is invalid.');
  const iv=un64(envelope.iv,32);if(iv.length!==12)throw new Error('Encrypted data is invalid.');
  try{return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(purpose)},key,un64(envelope.ciphertext))));}
  catch{throw new Error('Encrypted data could not be opened. Unlock the vault or reset private data.');}
}
async function passwordKey(password,salt){
  if(typeof password!=='string' || password.length<12 || password.length>256)throw new Error('Use a vault password of 12–256 characters.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function createPrivateStorage(disk,memory){
  let queue=Promise.resolve();
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const purpose=(id,field)=>`saywell:v1:${id}:${field}`;
  async function context(create=true){
    const meta=(await disk.get(META))[META];let session=(await memory.get(SESSION))[SESSION];
    if(meta && (meta.v!==1 || meta.iterations!==ITERATIONS || typeof meta.id!=='string' || !/^[a-f0-9-]{36}$/.test(meta.id)))throw new Error('Encrypted vault metadata is invalid.');
    if(meta && session?.id!==meta.id)session=null;
    if(!meta && !session && create){session={id:crypto.randomUUID(),key:b64(bytes(32)),records:{}};await memory.set({[SESSION]:session});}
    return {meta,session,key:session?await aes(session.key):null};
  }
  async function migrate(){
    const legacy=await disk.get(FIELDS);if(!Object.keys(legacy).length)return;
    const {meta,session,key}=await context();if(!key)return; // Preserve legacy fields until an explicit unlock can migrate them.
    const records=meta?(await disk.get(DATA))[DATA] || {}:{...session.records};
    for(const field of FIELDS)if(legacy[field]!==undefined){
      if(field==='keys' && !meta){const current=(await memory.get('keys')).keys || {};await memory.set({keys:{...legacy.keys,...current}});}
      else records[field]=await seal(key,legacy[field],purpose(session.id,field));
    }
    if(meta)await disk.set({[DATA]:records});else await memory.set({[SESSION]:{...session,records}});
    // Remove legacy plaintext only after its replacement was successfully written.
    await disk.remove(FIELDS);await memory.set({privateMigrationNotice:true});
    if(!meta && legacy.keys){
      const raw=(await disk.get('settings')).settings;
      if(raw){for(const cfg of [...(raw.llmProfiles || []),raw.llm,...Object.values(raw.basic || {})])if(cfg)cfg.rememberKey=false;await disk.set({settings:raw});}
    }
  }
  async function read(names){
    await migrate();const wanted=typeof names==='string'?[names]:names;
    const plain=wanted.filter(name=>!FIELDS.includes(name));const result=plain.length?await disk.get(plain):{};
    if(!wanted.some(name=>FIELDS.includes(name)))return result;
    const {meta,session,key}=await context();if(!key)return result;
    const records=meta?(await disk.get(DATA))[DATA] || {}:session.records;
    for(const field of wanted)if(FIELDS.includes(field) && records[field])result[field]=await open(key,records[field],purpose(session.id,field));
    return result;
  }
  async function write(values,remove=[]){
    await migrate();const privateFields=Object.keys(values).filter(field=>FIELDS.includes(field)),privateRemove=remove.filter(field=>FIELDS.includes(field));
    if(privateFields.length || privateRemove.length){
      const {meta,session,key}=await context();if(!key)throw new Error('Unlock the vault before changing private data.');
      if(!meta && values.keys && Object.values(values.keys).some(Boolean))throw new Error('Create and unlock a vault before remembering API keys.');
      const records={...(meta?(await disk.get(DATA))[DATA]:session.records)};
      for(const field of privateFields)records[field]=await seal(key,values[field],purpose(session.id,field));
      for(const field of privateRemove)delete records[field];
      if(meta)await disk.set({[DATA]:records});else await memory.set({[SESSION]:{...session,records}});
    }
    const plain=Object.fromEntries(Object.entries(values).filter(([field])=>!FIELDS.includes(field)));
    if(Object.keys(plain).length)await disk.set(plain);
    const plainRemove=remove.filter(field=>!FIELDS.includes(field));if(plainRemove.length)await disk.remove(plainRemove);
  }
  return {
    initialize:()=>serial(async()=>{try{await migrate();}catch{await memory.set({privateStorageError:true});}}),
    get:names=>serial(()=>read(names)),set:values=>serial(()=>write(values)),remove:names=>serial(()=>write({},typeof names==='string'?[names]:names)),
    status:()=>serial(async()=>{await migrate();const {meta,key}=await context(false);return {configured:Boolean(meta),locked:Boolean(meta && !key),sessionOnly:!meta,migrated:Boolean((await memory.get('privateMigrationNotice')).privateMigrationNotice)};}),
    create:password=>serial(async()=>{
      await migrate();const {meta,session,key}=await context();if(meta)throw new Error('A vault already exists. Unlock it instead.');
      const salt=bytes(16),wrapping=await passwordKey(password,salt),wrappedKey=await seal(wrapping,session.key,purpose(session.id,'data-key'));
      const next={v:1,id:session.id,iterations:ITERATIONS,salt:b64(salt),wrappedKey};
      await disk.set({[META]:next,[DATA]:session.records});await memory.set({[SESSION]:{...session,records:{}}});return true;
    }),
    unlock:password=>serial(async()=>{
      const {meta}=await context(false);if(!meta)throw new Error('Create a vault first.');
      const salt=un64(meta.salt,32);if(salt.length!==16)throw new Error('Encrypted vault metadata is invalid.');
      const wrapping=await passwordKey(password,salt);let raw;
      try{raw=await open(wrapping,meta.wrappedKey,purpose(meta.id,'data-key'));await aes(raw);}catch{throw new Error('The password is incorrect or the vault is damaged.');}
      await memory.set({[SESSION]:{id:meta.id,key:raw,records:{}}});await migrate();return true;
    }),
    lock:()=>serial(async()=>{const {meta}=await context(false);if(!meta)throw new Error('Create a vault first.');await memory.remove([SESSION,'keys']);return true;}),
    erase:()=>serial(async()=>{
      await disk.remove([META,DATA,...FIELDS]);await memory.remove([SESSION,'keys','privateMigrationNotice','privateStorageError']);
      const raw=(await disk.get('settings')).settings;
      if(raw){for(const cfg of [...(raw.llmProfiles || []),raw.llm,...Object.values(raw.basic || {})])if(cfg)cfg.rememberKey=false;await disk.set({settings:raw});}
      return true;
    })
  };
}
