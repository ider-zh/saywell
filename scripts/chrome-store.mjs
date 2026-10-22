import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {unzipSync} from 'fflate';

const HOST='https://chromewebstore.googleapis.com';
export async function chromeStore({publisherId,itemId,token,mode='status',repository,ref,event,version,zip,sha256},{fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  if(repository!=='ider-zh/saywell')throw new Error('Chrome publishing is restricted to the Saywell repository.');
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(publisherId || '') || !/^[a-p]{32}$/.test(itemId || '') || typeof token!=='string' || !token)throw new Error('Configure Chrome publisher, extension ID and short-lived authentication first.');
  if(!['status','publish'].includes(mode))throw new Error('Invalid Chrome operation.');
  if(mode==='publish'){
    if(event!=='push' || ref!==`refs/tags/v${version}` || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version || ''))throw new Error('Only a matching pushed version tag may submit to Chrome Web Store.');
    if(!zip || !/^[a-f0-9]{64}$/.test(sha256 || '') || createHash('sha256').update(zip).digest('hex')!==sha256)throw new Error('The installation ZIP checksum does not match the tested build.');
    const manifest=unzipSync(zip)['manifest.json'];
    if(!manifest || JSON.parse(new TextDecoder().decode(manifest)).version!==version)throw new Error('The installation ZIP manifest does not match the release version.');
  }
  const name=`publishers/${publisherId}/items/${itemId}`;
  async function request(endpoint,{method='GET',body,contentType='application/json'}={}){
    let response;
    try{response=await fetcher(HOST+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':contentType},body});}
    catch{throw new Error('Chrome Web Store request failed. Check connectivity and credentials; no automatic mutation retry was made.');}
    if(!response.ok)throw new Error(`Chrome Web Store returned HTTP ${response.status}. Check the developer dashboard and service-account setup.`);
    let data;try{data=await response.json();}catch{throw new Error('Chrome Web Store returned an invalid response.');}
    if(!data || data.name!==name || data.itemId!==itemId)throw new Error('Chrome Web Store response does not match the configured extension.');
    return data;
  }
  const versions=revision=>(revision?.distributionChannels || []).map(channel=>channel.crxVersion);
  const status=await request(`/v2/${name}:fetchStatus`);
  const summary=data=>({operation:mode,publishedState:data.publishedItemRevisionStatus?.state || 'UNPUBLISHED',submittedState:data.submittedItemRevisionStatus?.state || 'NOT_SUBMITTED',publishedVersions:versions(data.publishedItemRevisionStatus),submittedVersions:versions(data.submittedItemRevisionStatus)});
  if(mode==='status')return summary(status);
  if(status.takenDown || status.warned)throw new Error('Resolve the policy warning or takedown in Chrome Web Store before publishing.');
  if(versions(status.publishedItemRevisionStatus).includes(version))return {...summary(status),result:'already_published'};
  const submitted=status.submittedItemRevisionStatus;
  if(submitted && ['PENDING_REVIEW','STAGED'].includes(submitted.state)){
    if(versions(submitted).includes(version))return {...summary(status),result:submitted.state==='PENDING_REVIEW'?'already_in_review':'already_staged'};
    throw new Error('Another version is awaiting review or staged publication. Resolve it in the dashboard first.');
  }
  const uploaded=await request(`/upload/v2/${name}:upload`,{method:'POST',body:zip,contentType:'application/zip'});
  if(uploaded.crxVersion && uploaded.crxVersion!==version)throw new Error('Chrome accepted an unexpected package version; publication stopped.');
  let uploadState=uploaded.uploadState;
  for(let i=0;['IN_PROGRESS','UPLOAD_IN_PROGRESS'].includes(uploadState) && i<20;i++){
    await pause(3000);uploadState=(await request(`/v2/${name}:fetchStatus`)).lastAsyncUploadState;
  }
  if(uploadState!=='SUCCEEDED')throw new Error('Chrome package upload did not complete successfully; no publish request was sent.');
  const published=await request(`/v2/${name}:publish`,{method:'POST',body:JSON.stringify({publishType:'DEFAULT_PUBLISH',skipReview:false,blockOnWarnings:true})});
  if(!['PENDING_REVIEW','PUBLISHED','PUBLISHED_TO_TESTERS'].includes(published.state))throw new Error('Chrome returned an unexpected submission state. Inspect the dashboard before retrying.');
  return {operation:mode,result:published.state==='PENDING_REVIEW'?'submitted_for_review':'published',state:published.state,version};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const env=process.env,mode=env.CWS_OPERATION || 'status';
    const result=await chromeStore({publisherId:env.CWS_PUBLISHER_ID,itemId:env.CWS_EXTENSION_ID,token:env.CWS_ACCESS_TOKEN,mode,repository:env.GITHUB_REPOSITORY,ref:env.GITHUB_REF,event:env.GITHUB_EVENT_NAME,version:env.RELEASE_VERSION,sha256:env.ZIP_SHA256,zip:mode==='publish'?await readFile(env.CWS_ZIP):undefined});
    console.log(JSON.stringify(result));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
