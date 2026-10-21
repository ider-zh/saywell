export const SNOOZE_DURATIONS=['1h','4h','tomorrow'];
export function snoozeDeadline(duration,now=Date.now()){
  if(!SNOOZE_DURATIONS.includes(duration))throw new Error('Invalid pause duration.');
  if(duration==='tomorrow'){const date=new Date(now);date.setHours(24,0,0,0);return date.getTime();}
  return now+(duration==='4h'?4:1)*3600000;
}
export function snoozeStatus(value,host,now=Date.now()){
  const active=until=>Number.isFinite(until) && until>now?until:0;
  const allUntil=active(value?.all),siteUntil=host && Object.hasOwn(value?.sites || {},host)?active(value.sites[host]):0;
  return {allUntil,siteUntil,until:Math.max(allUntil,siteUntil)};
}
export function changeSnooze(value,scope,host,until,now=Date.now()){
  if(!['site','all'].includes(scope) || scope==='site' && !host)throw new Error('Invalid pause scope.');
  const sites=Object.entries(value?.sites || {}).filter(([key,time])=>key!==host && Number.isFinite(time) && time>now);
  if(scope==='site' && until)sites.push([host,until]);
  // Updating all-site pause preserves independent site pauses.
  else if(scope==='all' && host && value?.sites?.[host]>now)sites.push([host,value.sites[host]]);
  return {all:scope==='all'?until:snoozeStatus(value,null,now).allUntil,sites:Object.fromEntries(sites.slice(-200))};
}
