import {resolveLanguage} from '../core/locale.js';
import {blockedRule} from '../core/language.js';
export function siteInfo(host,settings,browserLanguage='en'){
  const rule=blockedRule(host,settings);
  return {host,mode:settings.siteMode || 'blacklist',blocked:Boolean(rule),rule,canRemove:rule?.toLowerCase()===host.toLowerCase(),language:resolveLanguage(settings.uiLanguage,browserLanguage),preferences:settings.sitePreferences || {},defaults:settings.globalDefaults || {},profiles:settings.llmChoices || []};
}
const chinese={
  'Saywell free AI quota is exhausted for today. It resets at 08:00 Shanghai time. MT is still available.':'Saywell 免费 AI 今日额度已耗尽，北京时间 08:00 重置，仍可使用机器翻译。',
  'Saywell free AI preview has ended. Use MT or connect your own LLM provider.':'Saywell 免费 AI 试用已结束，请使用机器翻译或连接自己的大模型服务。',
  'Saywell free AI is busy. MT is still available; try again shortly.':'Saywell 免费 AI 请求繁忙，仍可使用机器翻译，请稍后再试。',
  'Saywell free AI is unavailable. MT is still available; try again later.':'Saywell 免费 AI 暂不可用，仍可使用机器翻译，请稍后再试。',
  'Tooltip size':'浮窗大小','Tooltip size · remembered for this website':'浮窗大小 · 按网站记忆','Small':'小','Medium':'中','Large':'大',
  'Size could not be saved. It will reset after reloading.':'大小保存失败，刷新后将恢复默认。',
  'Google Translate (web)':'Google 翻译（网页版）','Microsoft Bing (web)':'微软必应（网页版）',
  'Website settings':'网站设置','Follow global':'跟随全局','Default action':'默认操作','Target language':'目标语言','LLM configuration':'大模型配置','Translation engine':'机器翻译引擎',
  'Website default action':'此网站默认操作','Website target language':'此网站目标语言','Website LLM configuration':'此网站大模型配置','Website translation engine':'此网站机器翻译引擎',
  'Auto':'自动','Translate':'翻译','Polish':'润色','Explain':'解释','English':'英文 / English','Chinese':'中文 / Chinese',
  'MT only':'仅机器翻译','On-device first':'优先本机翻译','On-device':'本机翻译','Microsoft Edge':'微软 Edge','Microsoft Azure':'微软 Azure',
  'Not enabled / authorized':'未启用或未授权','Configuration removed':'配置已删除',
  'Save for this website':'保存此网站设置','Reset website settings':'恢复全局设置','Manage providers':'管理服务',
  'Only this hostname. Provider authorization is managed in Settings.':'仅对当前域名生效，服务授权请在设置中管理。',
  'Saving website settings…':'正在保存网站设置…','Website settings saved. Used from the next suggestion.':'网站设置已保存，下次建议开始生效。',
  'Website settings reset to global defaults.':'已恢复此网站的全局默认设置。',
  'Move tooltip':'移动翻译浮窗','Drag to move; arrow keys move, Shift moves faster.':'拖动以移动；方向键微调，Shift 加速。','Reset tooltip position':'重置浮窗位置',
  'Position remembered for this website · Click to follow input':'已记住此网站位置 · 点击恢复自动定位','Position follows input':'随输入框自动定位',
  'Position could not be saved. It will reset after reloading.':'位置保存失败，刷新后将恢复默认位置。',
  'LLM refinement is still running…':'大模型仍在翻译与润色…','LLM unavailable; showing MT.':'大模型暂不可用，保留机器翻译结果。','MT unavailable; showing LLM.':'机器翻译暂不可用，显示大模型结果。',
  'Machine translation':'机器翻译','Copy MT':'复制机器翻译','Apply MT':'应用机器翻译',
  'Website options':'网站选项',
  'Blacklist mode':'黑名单模式','Whitelist mode':'白名单模式','Not on blacklist':'未加入黑名单','On blacklist':'已加入黑名单',
  'Add this site to blacklist':'将此网站加入黑名单','Remove this site from blacklist':'将此网站移出黑名单','Manage blacklist rule':'管理黑名单规则',
  'This website is blocked. Translation and local analytics are paused here.':'此网站已加入黑名单，翻译与本地输入统计均已暂停。',
  'Blocked by rule: {rule}':'匹配的黑名单规则：{rule}','Updating blacklist…':'正在更新黑名单…'
};
export function siteText(site,message,params={}){return (site.language==='zh-CN'?chinese[message] || message:message).replace(/\{(\w+)\}/g,(all,key)=>params[key] ?? all);}
