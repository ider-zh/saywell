export class ProviderError extends Error {
  constructor(code, message, retryAfter = 0) { super(message); this.name = 'ProviderError'; this.code = code; this.retryAfter = retryAfter; }
}
// Bound the decoded text while reading, rather than buffering an arbitrary body first.
export async function readResponseText(response, limit = 200000, signal) {
  if (!response.body) return '';
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const chunks = []; let size = 0, bytes = 0;
  const cancel = () => { reader.cancel().catch(() => {}); };
  const checkAbort = () => { if (signal?.aborted) throw new DOMException('Request aborted.', 'AbortError'); };
  signal?.addEventListener('abort', cancel, {once:true});
  try {
    checkAbort();
    while (true) {
      const {value, done} = await reader.read(); checkAbort();
      // A UTF-16 code unit needs at most three UTF-8 bytes, plus an optional BOM.
      bytes += value?.byteLength || 0;
      if (bytes > limit * 3 + 3) throw new ProviderError('response','Provider response exceeded the size limit.');
      const text = done ? decoder.decode() : decoder.decode(value, {stream:true});
      size += text.length;
      if (size > limit) throw new ProviderError('response','Provider response exceeded the size limit.');
      chunks.push(text);
      if (done) return chunks.join('');
    }
  } catch (error) { cancel(); throw error; }
  finally { signal?.removeEventListener('abort', cancel); reader.releaseLock(); }
}
export async function fetchText(url, options = {}, timeout = 12000, fetcher = fetch, limit = 200000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!response.ok) {
      response.body?.cancel().catch(() => {});
      const raw = response.headers.get('retry-after');
      const retry = raw ? (/^\d+$/.test(raw) ? Number(raw)*1000 : Math.max(0, Date.parse(raw)-Date.now())) : 60000;
      if ([401,403].includes(response.status)) throw new ProviderError('auth','Authentication failed. Check your key and endpoint.');
      if (response.status === 429) throw new ProviderError('rate','Provider rate limit reached. Try later.', Math.min(86400000,retry || 60000));
      throw new ProviderError(response.status >= 500 ? 'server' : 'request',`Provider returned HTTP ${response.status}. Check configuration.`);
    }
    return await readResponseText(response, limit, controller.signal);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(controller.signal.aborted ? 'timeout' : 'network', controller.signal.aborted ? 'Provider request timed out.' : 'Could not reach the provider. Check network access and server configuration.');
  } finally { clearTimeout(timer); }
}
export async function fetchJSON(url, options = {}, timeout = 12000, fetcher = fetch) {
  const text=await fetchText(url,options,timeout,fetcher);
  try{return JSON.parse(text);}catch{throw new ProviderError('response','Provider returned invalid JSON.');}
}
export const jsonPost = body => ({ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
