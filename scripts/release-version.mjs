import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function releaseVersion(ref,packageVersion,manifestVersion,lockVersions=[packageVersion]){
  if(typeof packageVersion!=='string' || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(packageVersion) || packageVersion.split('.').some(part=>Number(part)>65535 || String(Number(part))!==part) || packageVersion.split('.').every(part=>Number(part)===0))throw new Error('Use a valid numeric Chrome extension version.');
  if(packageVersion!==manifestVersion)throw new Error('Package and manifest versions must match.');
  if(!lockVersions.length || lockVersions.some(version=>version!==packageVersion))throw new Error('Package lock versions must match the package version.');
  if(ref.startsWith('refs/tags/') && ref!==`refs/tags/v${packageVersion}`)throw new Error('Release tag must be v'+packageVersion+' and match the packaged version.');
  return {version:packageVersion,artifactName:`saywell-${packageVersion}.zip`};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const pkg=JSON.parse(await readFile('package.json','utf8')),manifest=JSON.parse(await readFile('manifest.json','utf8')),lock=JSON.parse(await readFile('package-lock.json','utf8'));
  const metadata=releaseVersion(process.env.GITHUB_REF || '',pkg.version,manifest.version,[lock.version,lock.packages?.['']?.version]);
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`version=${metadata.version}\nartifact_name=${metadata.artifactName}\n`);
  console.log(`Validated Saywell ${metadata.version}`);
}
