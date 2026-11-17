// Local, transient spans only. Never persist the source-to-placeholder map.
const tail=/[.,!?;:，。！？；：、]$/u;
function trimEnd(value){
  while(tail.test(value))value=value.slice(0,-1);
  for(const[open,close]of [['(',')'],['[',']'],['{','}']])while(value.endsWith(close) && value.split(close).length>value.split(open).length)value=value.slice(0,-1);
  return value;
}
const patterns=[
  ['PATH',/(["'])((?:[A-Za-z]:[\\/]|\\\\|\/|\.{1,2}\/|~\/)[^\r\n]{1,1800}?)\1/g],
  ['URL',/\bhttps?:\/\/[^\s<>"'`，。！？；、（）【】]+/gi],
  // Left boundaries prevent retrying an unbounded candidate at every character
  // of a long URL/identifier (quadratic scanning even without a matching @ or /).
  ['EMAIL',/(?<![A-Za-z0-9_.%+~-])[A-Za-z0-9_%+~-]+(?:\.[A-Za-z0-9_%+~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}/g],
  ['PATH',/(?<![A-Za-z0-9_])(?:[A-Za-z]:[\\/]|\\\\[A-Za-z0-9_.-]+[\\/]|~\/|\.{1,2}\/|\/)[^\s<>"'`，。！？；、（）【】]+/g],
  ['PATH',/(?<![A-Za-z0-9_./@-])(?:[A-Za-z0-9_.@-]+\/)+[A-Za-z0-9_.@-]+\.[A-Za-z0-9]{1,10}/g],
  ['URL',/(?<![A-Za-z0-9_.-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:com|org|net|edu|gov|io|ai|app|dev|xyz|cn|co|uk|de|fr|jp|us|me|info|online|tech)(?::\d{1,5})?(?:[/?#][^\s<>"'`，。！？；、（）【】]*)?/g],
  ['ID',/\b(?:[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}|[a-fA-F0-9]{16,128}|0x[a-fA-F0-9]{2,128}|(?:ID|id|SKU|sku|UID|uid|order)[_:#-]?\d[\w.-]*|[A-Z]{1,12}-?\d[A-Z\d-]*)\b/g]
];
export function specialSpans(text){
  if(typeof text!=='string' || text.length>20000)return [];
  const candidates=[];
  for(const[kind,pattern]of patterns)for(const match of text.matchAll(pattern)){
    const quoted=Boolean(match[2]),start=match.index+(quoted?1:0),value=quoted?match[2]:trimEnd(match[0]),end=start+value.length;
    if(!value || /[A-Za-z0-9_]/.test(text[start-1] || '') || (kind==='ID' || kind==='URL' && !/^https?:/i.test(value)) && /[A-Za-z0-9_]/.test(text[end] || ''))continue;
    candidates.push({start,end,kind,value});
  }
  candidates.sort((a,b)=>a.start-b.start || b.end-a.end || Number(b.kind==='URL')-Number(a.kind==='URL'));
  const spans=[];let end=0;
  for(const span of candidates)if(span.start>=end){spans.push(span);end=span.end;}
  return spans;
}
export function specialSegments(text,source=text){
  const allowed=new Set(specialSpans(source).map(span=>span.value)),segments=[];let offset=0,count=0;
  for(const span of specialSpans(text)){
    if(!allowed.has(span.value) || count>=128)continue;
    if(span.start>offset)segments.push({text:text.slice(offset,span.start)});
    segments.push({text:span.value,kind:span.kind,index:++count});offset=span.end;
  }
  if(offset<text.length)segments.push({text:text.slice(offset)});
  return segments;
}
export function protectSpecialContent(source){
  const spans=specialSpans(source);
  if(!spans.length)return {text:source,restore:text=>text};
  let nonce;do{nonce=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,'0')).join('');}while(source.includes(`__SWP_${nonce}_`));
  const entries=spans.map((span,i)=>({...span,token:`__SWP_${nonce}_${span.kind}_${i+1}__`}));
  let text='',offset=0;
  for(const entry of entries){text+=source.slice(offset,entry.start)+entry.token;offset=entry.end;}text+=source.slice(offset);
  const invalid=()=>{throw new Error('Protected content was changed.');};
  if(text.length>6000)invalid();
  return {text,restore(value,{complete=false,limit=12000}={}){
    if(typeof value!=='string')invalid();let remaining=value;
    for(const entry of entries){const count=remaining.split(entry.token).length-1;if(complete && count!==1)invalid();remaining=remaining.split(entry.token).join('');}
    if(remaining.includes(`__SWP_${nonce}_`))invalid();
    for(const match of remaining.matchAll(/__SWP_[a-f0-9]{16}_[A-Z]+_\d+__/g))if(!source.includes(match[0]))invalid();
    // Single substitution pass: restored source text is never interpreted as another token.
    const tokens=new Map(entries.map(entry=>[entry.token,entry.value]));
    const restored=value.replace(/__SWP_[a-f0-9]{16}_[A-Z]+_\d+__/g,token=>tokens.get(token) ?? token);
    if(restored.length>limit)invalid();return restored;
  }};
}
