// Runs in eligible Chrome / Microsoft Edge document contexts; feature-detect on every browser.
export const builtin = {
  id:'builtin', name:'Browser on-device', category:'basic', pairs:[['zh','en'],['en','zh']], translators:new Map(),
  async availability(pair={source:'zh',target:'en'}) {
    if (!globalThis.Translator) return 'unavailable';
    try { return await Translator.availability({sourceLanguage:pair.source,targetLanguage:pair.target}); } catch { return 'unavailable'; }
  },
  async prepare(pair={source:'zh',target:'en'}) {
    if (!globalThis.Translator) throw new Error('The on-device Translator API is unavailable in this browser context. Choose an authorized basic provider in Settings.');
    // Called directly by a click/shortcut so user activation is still present.
    const translator=await Translator.create({sourceLanguage:pair.source,targetLanguage:pair.target});
    this.translators.set(`${pair.source}:${pair.target}`,translator);return translator;
  },
  async translate(text,pair={source:'zh',target:'en'}) {
    const key=`${pair.source}:${pair.target}`;
    if (!this.translators.has(key)) {
      if (await this.availability(pair) !== 'available') throw new Error('The local model is not ready. Use Prepare on-device or authorize another engine.');
      await this.prepare(pair);
    }
    const controller=new AbortController();let timer;
    try {
      const textOut=await Promise.race([
        this.translators.get(key).translate(text,{signal:controller.signal}),
        new Promise((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('On-device translation timed out.'));},15000);})
      ]);
      return {text:textOut, engine:this.name, category:'basic', vocabulary:[]};
    }finally{clearTimeout(timer);}
  }
};
