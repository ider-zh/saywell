import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {zipSync} from 'fflate';
const files={};async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const relative=prefix+e.name;if(e.isDirectory())await walk(`${dir}/${e.name}`,relative+'/');else files[relative]=new Uint8Array(await readFile(`${dir}/${e.name}`));}}
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8')),pkg=JSON.parse(await readFile('package.json','utf8'));
if(manifest.version!==pkg.version || !/^\d+(?:\.\d+){1,3}$/.test(manifest.version))throw new Error('Package and built manifest versions must match. Run npm run build after updating both versions.');
await walk('dist');
const roots=new Set(['manifest.json','styles.css',...['background','content','dashboard','settings','popup','vocabulary','welcome','history'].map(name=>name+'.js'),...['dashboard','settings','popup','vocabulary','welcome','history','privacy','privacy.en'].map(name=>name+'.html')]);
for(const name of Object.keys(files))if(!roots.has(name) && !/^icons\/(?:16\.png|32\.png|48\.png|128\.png|512\.png|favicon\.ico|saywell\.svg)$/.test(name))throw new Error('Unexpected file in dist; refusing to package: '+name);
await mkdir('release',{recursive:true});const target=`release/saywell-${manifest.version}.zip`;
await writeFile(target,zipSync(files,{level:9}));console.log(`Created ${target} (unpacked Chrome/Edge installation archive, not store-signed)`);
