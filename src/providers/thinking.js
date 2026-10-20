import {ProviderError} from './http.js';

// Provider-specific switches; never confuse hiding reasoning with disabling generation.
export function thinkingOptions(config){
  const enabled=config.thinking===true,model=config.model.toLowerCase();let kind=config.thinkingProtocol || 'auto';
  if(kind==='auto'){
    const provider=config.provider==='compatible'?({
      'api.xiaomimimo.com':'mimo','api.deepseek.com':'deepseek','api.siliconflow.cn':'siliconflow'
    }[new URL(config.endpoint).hostname] || 'compatible'):config.provider;
    kind=['mimo','deepseek'].includes(provider)?'thinking':provider==='siliconflow'?'enable_thinking':provider==='ollama'?'reasoning_effort':
      /^(?:gpt-[56](?:[.-]|$)|o[134](?:-|$))/.test(model)?'reasoning_effort':'auto';
  }
  if(kind==='thinking')return {thinking:{type:enabled?'enabled':'disabled'}};
  if(kind==='enable_thinking')return {enable_thinking:enabled};
  if(kind==='think')return {think:enabled};
  if(kind==='chat_template')return {chat_template_kwargs:{enable_thinking:enabled}};
  if(kind==='reasoning_effort'){
    if(!enabled && (/^o[134](?:-|$)/.test(model) || /^gpt-5(?:-(?:mini|nano|pro|\d{4}.*))?$/.test(model) || /^gpt-6-astra/.test(model)))throw new ProviderError('config','This model cannot disable thinking. Choose a non-reasoning model or enable thinking in this configuration.');
    return {reasoning_effort:enabled?'medium':'none'};
  }
  return {};
}
export function geminiThinking(config){
  const model=config.model.toLowerCase();
  if(config.thinking)return /^gemini-2\.5/.test(model)?{thinkingConfig:{thinkingBudget:-1}}:{};
  if(/^gemini-2\.5.*flash/.test(model))return {thinkingConfig:{thinkingBudget:0}};
  if(/^gemini-(?:3|4)/.test(model) || /^gemini-2\.5.*pro/.test(model))throw new ProviderError('config','This model cannot disable thinking. Choose a non-reasoning model or enable thinking in this configuration.');
  return {};
}
