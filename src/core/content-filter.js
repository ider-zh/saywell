// Automatic requests need prose worth translating. Keep this conservative:
// ambiguous words and mixed sentences stay eligible; manual requests bypass it.
const numeric=/^[\d\s.,，、;；:：/\\+−–—\-()%％‰°=<>≤≥×÷*\[\]{}\p{Sc}]+$/u;
const digits=/\d/;
const label=/^(?:id|uuid|guid|uid|sku|sn|no|order)[:：#]$/i;
const currency=/^(?:USD|CNY|RMB|EUR|JPY|GBP|HKD|CAD|AUD)$/;
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const hash=/^(?:[\da-f]{16,128}|0x[\da-f]{2,128})$/i;
const prefixedId=/^(?:id|uuid|guid|uid|sku|sn|no|order)(?:\d[\w.:-]*|[-_:#][\w.:-]+)$/i;
const upperId=/^(?:[A-Z]{1,12}\d[A-Z\d-]*|[A-Z]{1,12}[-:][A-Z\d:-]{1,64})$/;
const underscoreId=/^[A-Za-z][A-Za-z\d_]{0,63}_[A-Za-z\d_]{1,64}$/;
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;

function domain(host){
  if(host.length>253)return false;
  const parts=host.replace(/\.$/,'').split('.');
  return parts.length>1 && /^[a-z]{2,63}$/i.test(parts.at(-1)) && parts.every(part=>/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(part));
}
function address(value){
  if(/^[^\s@]{1,64}@[^\s@]{1,253}$/.test(value))return domain(value.slice(value.lastIndexOf('@')+1));
  if(/^https?:\/\/\S+$/i.test(value)){
    try{return Boolean(new URL(value).hostname);}catch{return false;}
  }
  if(/^[\da-f:[\].]{2,45}$/i.test(value) && value.includes(':')){
    try{return Boolean(new URL(`http://${value.startsWith('[')?value:`[${value}]`}/`).hostname);}catch{return false;}
  }
  // A bare domain may include a port or path. URL parsing is local only.
  if(!/^[a-z\d][a-z\d.-]*\.[a-z]{2,63}(?::\d{1,5})?(?:[/?#]\S*)?$/i.test(value))return false;
  try{return domain(new URL(`https://${value}`).hostname);}catch{return false;}
}
function dataAtom(value){
  if(numeric.test(value) && digits.test(value) || timestamp.test(value))return true;
  if(uuid.test(value) || hash.test(value) || address(value))return true;
  return digits.test(value) && (prefixedId.test(value) || upperId.test(value) || underscoreId.test(value));
}
export function shouldSkipAutomaticContent(text){
  if(typeof text!=='string' || !text.trim() || text.length>6000)return false;
  const value=text.trim().normalize('NFKC');
  if(dataAtom(value))return true;
  let meaningful=0;
  // Stop at the first prose token instead of allocating a token array per key.
  for(const [item]of value.matchAll(/[^\s,，;；、]+/gu)){
    if(label.test(item) || currency.test(item))continue;
    if(!dataAtom(item))return false;
    meaningful++;
  }
  return meaningful>0;
}
