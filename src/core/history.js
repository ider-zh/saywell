export const HISTORY_LIMITS=[0,50,100,200,500,1000];
export const DEFAULT_HISTORY_LIMIT=100;
export const HISTORY_BYTES=3*1024*1024;
export const historyLimit=value=>HISTORY_LIMITS.includes(value)?value:DEFAULT_HISTORY_LIMIT;
export function trimHistory(records,limit){
  const result=[],encoder=new TextEncoder();let bytes=2;
  for(const row of records.slice(0,limit)){
    const size=encoder.encode(JSON.stringify(row)).length+(result.length?1:0);if(bytes+size>HISTORY_BYTES)break;
    result.push(row);bytes+=size;
  }
  return result;
}
export function historyResult(value){
  if(!value || typeof value.text!=='string' || !value.text.trim() || value.text.length>20000 || typeof value.engine!=='string' || value.engine.length>100)throw new Error('Invalid history result.');
  return {text:value.text,engine:value.engine,...(typeof value.explanation==='string' && value.explanation?{explanation:value.explanation.slice(0,2000)}:{})};
}
export function mergeHistory(records,entry,lane,result,limit){
  const existing=records.find(row=>row.id===entry.id);
  if(existing && (existing.source!==entry.source || existing.hostname!==entry.hostname || existing.targetLanguage!==entry.targetLanguage))throw new Error('History request changed.');
  const row=existing?{...existing,results:{...existing.results,[lane]:result}}:{...entry,results:{[lane]:result}};
  return trimHistory(existing?records.map(item=>item.id===row.id?row:item):[row,...records],limit);
}
