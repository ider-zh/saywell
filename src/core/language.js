export const han = /\p{Script=Han}/gu;
export const englishWords = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
export const countChars = text => [...text].length;
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
  const a = [...before], b = [...after];
  let left = 0, right = 0;
  while (left < a.length && left < b.length && a[left] === b[left]) left++;
  while (right < a.length-left && right < b.length-left && a[a.length-1-right] === b[b.length-1-right]) right++;
  return { text: b.slice(left, b.length-right).join(''), before: a.slice(0,left).join(''), after: b.slice(b.length-right).join('') };
}
