import {readFile,writeFile} from 'node:fs/promises';
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inline=value=>escape(value).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
export async function buildPrivacy(){
  for(const [language,file,other,label]of [['zh-CN','privacy.html','privacy.en.html','English'],['en','privacy.en.html','privacy.html','简体中文']]){
    const source=await readFile(`docs/privacy-policy.${language==='en'?'en':'zh-CN'}.md`,'utf8');
    const blocks=source.trim().split(/\r?\n\r?\n/).map(block=>block.startsWith('# ')?`<h1>${inline(block.slice(2))}</h1>`:block.startsWith('## ')?`<h2>${inline(block.slice(3))}</h2>`:`<p>${inline(block)}</p>`).join('\n');
    await writeFile(`dist/${file}`,`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saywell · ${language==='en'?'Privacy Policy':'隐私政策'}</title><link rel="icon" href="icons/32.png"><link rel="stylesheet" href="styles.css"></head><body class="privacy-document"><main><nav><a href="settings.html">Saywell</a><a href="${other}">${label}</a></nav>${blocks}</main></body></html>`);
  }
}
