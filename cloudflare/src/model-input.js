import {systemPrompt} from '../../src/providers/llm.js';
function taskInstruction(input){
  return input.action==='explain'?'Explain the source; keep the text field unchanged.':input.action==='translate'?`Translate the source into ${input.targetLanguage==='zh'?'Simplified Chinese':'English'}. The text field must contain the translation, not the source.`:`Polish the source in ${input.targetLanguage==='zh'?'Simplified Chinese':'English'} only if improvement is needed.`;
}

export function taskMessages(input,instruction=taskInstruction(input)){
  return [
    {role:'system',content:systemPrompt(input)+'\nCurrent task: '+instruction},
    {role:'user',content:JSON.stringify({action:input.action,targetLanguage:input.targetLanguage,text:input.text})}
  ];
}

export function modelInput(input,model){
  const instruction=taskInstruction(input);
  if(model==='@cf/zai-org/glm-4.7-flash'){
    return {
      messages:taskMessages(input,instruction),
      max_completion_tokens:input.maxTokens,
      chat_template_kwargs:{enable_thinking:input.thinking},
      stream:false
    };
  }
  const moe=model==='@cf/qwen/qwen3-30b-a3b-fp8';
  if(!moe && model!=='@cf/qwen/qwen3.8-27b')throw new Error('Unsupported sponsored model.');
  const contract=moe?'\nAlways return all four JSON fields: text, explanation, alternative, vocabulary. The explanation must be in Simplified Chinese, never English. '+(input.action==='explain'?'For this Explain task, explanation MUST be nonempty and explain the meaning and phrasing in Chinese.':input.action==='polish'?'Correct grammar and spelling while preserving the intended subject and singular/plural meaning. Include a short Chinese explanation of corrections.':'Preserve numbers exactly as written.') : '';
  const messages=[{role:'system',content:systemPrompt(input)+'\nCurrent task: '+instruction+contract},{role:'user',content:JSON.stringify({action:input.action,targetLanguage:input.targetLanguage,text:input.text})+(moe?(input.thinking?'\n/think':'\n/no_think'):'')}];
  // Cloudflare's Qwen3 reasoning parser needs its native template. Combining JSON mode
  // or enable_thinking=false with this model misplaced the answer in reasoning_content in live probes.
  return moe?{messages,max_tokens:input.maxTokens,temperature:0.2,top_p:0.8,stream:false}:{messages,max_completion_tokens:input.maxTokens,reasoning_effort:'low',chat_template_kwargs:{enable_thinking:input.thinking},response_format:{type:'json_object'},store:false,stream:false};
}
