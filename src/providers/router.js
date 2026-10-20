import { cleanResult } from '../core/security.js';
import { ProviderError } from './http.js';
import { BASIC_ORDER } from '../core/settings.js';
import {translationPair} from '../core/language.js';

// A single pass through consented candidates; no blind retries.
export class BasicRouter {
  constructor(providers, {now = Date.now, health = {}} = {}) { this.providers=providers; this.now=now; this.health=health; }
  async translate(text, settings, authorized) {
    const pair=translationPair(text,settings.targetLanguage || 'en');
    const order=settings.basicOrder || BASIC_ORDER;
    const ids=settings.basicEngine==='auto'?order:[settings.basicEngine,...(settings.basicFallback ? order.filter(id=>id!==settings.basicEngine):[])];
    const candidates=ids.map(id=>this.providers.find(p=>p.id===id)).filter(p=>p && settings.basic[p.id]?.consent);
    const errors=[];
    const attempts=[];
    for (const p of candidates) {
      const config=settings.basic[p.id];
      if (!(await authorized(config.endpoint,p.id))) {attempts.push({id:p.id,engine:p.name,status:'permission'});continue;}
      const h=this.health[p.id] || {};
      if (h.blocked || h.until > this.now()) { errors.push(`${p.name}: ${h.blocked ? 'check configuration and test in Settings' : 'cooling down'}`);attempts.push({id:p.id,engine:p.name,status:h.blocked?'auth':'cooldown'}); continue; }
      try {
        if (!await p.available(config,pair)) throw new ProviderError('unavailable',`${p.name} is not available for ${pair.source==='zh'?'Chinese':'English'} → ${pair.target==='zh'?'Chinese':'English'}.`);
        const value=cleanResult(await p.translate(text,config,pair,()=>authorized(config.endpoint,p.id)),text,0);
        this.health[p.id]={failures:0};
        attempts.push({id:p.id,engine:p.name,status:'success'});
        return {...value,engine:p.name,providerId:p.id,category:'basic',attempts};
      } catch (e) {
        const failures=(h.failures || 0)+1;
        if(e.code!=='length')this.health[p.id]={failures, blocked:['auth','request'].includes(e.code),until:this.now()+(['quota','rate'].includes(e.code) ? (e.retryAfter || 60000) : failures>=2 ? 60000 : 0)};
        attempts.push({id:p.id,engine:p.name,status:e.code || 'response'});
        errors.push(`${p.name}: ${e.message}`);
      }
    }
    const error=new ProviderError('unavailable',errors.length ? errors.join(' ') : 'No available authorized engine. Open Settings to enable a no-key basic provider or configure your own.');
    error.attempts=attempts;throw error;
  }
}
