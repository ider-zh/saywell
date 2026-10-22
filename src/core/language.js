export const han = /\p{Script=Han}/gu;
export const englishWords = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
export function countChars(text){let count=0;for(let i=0;i<text.length;i++,count++){const code=text.charCodeAt(i),next=text.charCodeAt(i+1);if(code>=0xd800 && code<=0xdbff && next>=0xdc00 && next<=0xdfff)i++;}return count;}
export const countEnglish = text => (text.match(englishWords) || []).length;
export const countChinese = text => (text.match(han) || []).length;

export function classify(text) {
  const zh = countChinese(text), en = (text.match(/[A-Za-z]/g) || []).length;
  if (!zh && !en) return 'other';
  if (!zh) return 'english';
  if (!en || zh >= en * 1.5) return 'chinese';
  return 'mixed';
}

export function translationPair(text,target='en'){
  const language=classify(text);
  return {source:language==='english'?'en':language==='chinese'?'zh':target==='zh'?'en':'zh',target};
}
export function routeAction(text, mode, llmEnabled,target='en') {
  const language = classify(text);
  if (mode !== 'auto') return { language, action: mode, needsLLM: mode !== 'translate' };
  if (language === (target==='zh'?'chinese':'english')) return { language, action: llmEnabled ? 'polish' : 'none', needsLLM: llmEnabled };
  return { language, action: language === 'other' ? 'none' : 'translate', needsLLM: false };
}

export function hostMatches(host,pattern){
  host=host.toLowerCase();pattern=pattern.toLowerCase();
  return host===pattern || (pattern.startsWith('*.') && (host===pattern.slice(2) || host.endsWith('.'+pattern.slice(2))));
}
export const blockedRule=(host,settings)=>settings.blocklist.find(pattern=>hostMatches(host,pattern));
export function siteAllowed(host, settings) {
  const mode=settings.siteMode ?? (settings.allowlist.length?'whitelist':'blacklist');
  return !blockedRule(host,settings) && (mode==='blacklist' || settings.allowlist.some(pattern=>hostMatches(host,pattern)));
}

// Stable prefix/suffix diff: only transient editor snapshots use this. No text is persisted.
export function insertedSpan(before, after) {
  // Native prefix checks/slices avoid allocating two document-sized code-point arrays on every key.
  const high=code=>code>=0xd800 && code<=0xdbff,low=code=>code>=0xdc00 && code<=0xdfff;
  if(after.startsWith(before) && !(high(before.charCodeAt(before.length-1)) && low(after.charCodeAt(before.length))))return {text:after.slice(before.length),before,after:''};
  let left=0,right=0;
  while(left<before.length && left<after.length && before.charCodeAt(left)===after.charCodeAt(left))left++;
  if(left && high(before.charCodeAt(left-1)) && (low(before.charCodeAt(left)) || low(after.charCodeAt(left))))left--;
  while(right<before.length-left && right<after.length-left && before.charCodeAt(before.length-1-right)===after.charCodeAt(after.length-1-right))right++;
  if(right && low(before.charCodeAt(before.length-right)) && (high(before.charCodeAt(before.length-right-1)) || high(after.charCodeAt(after.length-right-1))))right--;
  return {text:after.slice(left,after.length-right),before:before.slice(0,left),after:after.slice(after.length-right)};
}
