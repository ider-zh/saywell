import { countChars, countChinese, countEnglish, insertedSpan } from './language.js';
export const METRICS = ['typed','chinese','english','pasted','ai','suggestions','accepted'];
export const emptyMetrics = () => Object.fromEntries(METRICS.map(k => [k,0]));
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function typingDelta(before, after, inputType, data) {
  const d = emptyMetrics();
  if (inputType?.startsWith('delete') || /history|format/i.test(inputType || '')) return d;
  const diff = insertedSpan(before, after);
  const added = typeof data === 'string' ? data : diff.text;
  if (!added) return d;
  if (/paste|drop/i.test(inputType || '')) { d.pasted = countChars(added); return d; }
  // Autocomplete/replacement is not provably independent writing.
  if (/replacement/i.test(inputType || '')) return d;
  d.typed = countChars(added); d.chinese = countChinese(added);
  // Count new word starts; a word built one key at a time is counted once.
  d.english = Math.max(0, countEnglish(diff.before + added) - countEnglish(diff.before));
  return d;
}
export function addMetrics(target, delta) {
  for (const k of METRICS) target[k] = (target[k] || 0) + Math.max(0, Math.min(100000, Math.floor(Number(delta[k]) || 0)));
  return target;
}
export function recordMetric(store, day, host, delta) {
  const entry = store[day] ||= { ...emptyMetrics(), sites: {} };
  addMetrics(entry, delta);
  // Hostnames are external strings, including potential object-property names.
  if(!Object.hasOwn(entry.sites,host))Object.defineProperty(entry.sites,host,{value:emptyMetrics(),enumerable:true,writable:true,configurable:true});
  addMetrics(entry.sites[host], delta);
  // Keep one year of aggregate days; no draft content is stored.
  for (const old of Object.keys(store).sort().slice(0, Math.max(0,Object.keys(store).length-366))) delete store[old];
  return store;
}
export function history(store, days, now = new Date()) {
  return Array.from({length: days}, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate()-days+i+1);
    const day = dayKey(date); return { day, ...emptyMetrics(), ...store[day] };
  });
}
