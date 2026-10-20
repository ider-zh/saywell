export function endpointURL(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter an absolute endpoint URL.'); }
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Use HTTPS, or HTTP on localhost only.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Endpoint URLs cannot contain credentials, query strings, or fragments.');
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}
export const originPattern = endpoint => `${endpointURL(endpoint).origin}/*`;
export function apiURL(endpoint, suffix) {
  const u = endpointURL(endpoint);
  u.pathname = u.pathname.replace(/\/+$/, '') + suffix;
  return u.toString();
}
export function cleanResult(value, source, maxWords = 3, known = []) {
  const limit = (x, n) => typeof x === 'string' ? x.slice(0,n).trim() : '';
  const text = limit(value.text, 12000);
  if (!text) throw new Error('The provider returned an empty suggestion.');
  const unchanged = text === source.trim();
  const seen = new Set(known.map(w => w.toLowerCase()));
  const vocabulary = (Array.isArray(value.vocabulary) ? value.vocabulary : []).filter(v => {
    if (!v || typeof v !== 'object') return false;
    const word = limit(v.word,80).toLowerCase();
    if (!word || seen.has(word)) return false;
    const pos = text.toLowerCase().indexOf(word);
    if (pos < 0 || (/[a-z]/i.test(word[0]) && /[a-z]/i.test(text[pos-1] || '')) || (/[a-z]/i.test(word.at(-1)) && /[a-z]/i.test(text[pos+word.length] || ''))) return false;
    seen.add(word); return true;
  }).slice(0, Math.max(0, Math.min(3,maxWords))).map(v => ({
    word: limit(v.word,80), meaning: limit(v.meaning,160), explanation: limit(v.explanation,240),
    pronunciation: limit(v.pronunciation,100), example: limit(v.example,240)
  }));
  return { text, changed: !unchanged, explanation: unchanged ? '' : limit(value.explanation,600),
    alternative: limit(value.alternative,2000), vocabulary };
}
