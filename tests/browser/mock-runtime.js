// Only injected by Playwright into synthetic fixtures. Not included in dist/.
(()=>{
  const listeners=[];let settings={enabled:true,autoSuggest:true,analytics:true,basicEngine:'mymemory',mode:'auto',targetLanguage:'en',style:'natural',debounce:400,difficulty:'intermediate',maxWords:3,siteMode:'blacklist',siteOrigins:[location.origin+'/*'],allowlist:[],blocklist:[],llmEnabled:false};
  window.__coachRequests=[];window.__coachMetrics=[];window.__coachWords=[];window.__coachDelay=0;
  window.__coachSiteSaves=[];
  const effective=()=>{
    const preferences=JSON.parse(sessionStorage.getItem('coach-site-preferences') || '{}');
    const profiles=settings.llmChoices || [{id:'default',name:'Default configuration',provider:'compatible',model:'fixture',enabled:settings.llmEnabled,consent:true}];
    const {llmProfileId,...overrides}=preferences;
    return {...settings,...overrides,tooltipSize:sessionStorage.getItem('coach-tooltip-size') || 'small',llmEnabled:llmProfileId===null?false:llmProfileId===undefined?settings.llmEnabled:Boolean(profiles.find(p=>p.id===llmProfileId)?.enabled),sitePreferences:preferences,llmChoices:profiles,globalDefaults:{mode:settings.mode,targetLanguage:settings.targetLanguage,basicEngine:settings.basicEngine,activeLlmId:settings.activeLlmId || 'default'}};
  };
  window.__coachSetSettings=patch=>{settings={...settings,...patch};listeners.forEach(fn=>fn({type:'settings-updated',settings:effective()}));};
  window.__coachRefreshSettings=()=>listeners.forEach(fn=>fn({type:'settings-updated'}));
  window.chrome={runtime:{id:'test-fixture',onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:async message=>{
    if(message.type==='public-settings')return{ok:true,data:effective()};
    if(message.type==='set-snooze'){window.__coachSnooze=message;window.__coachSetSettings({snoozeUntil:Date.now()+3600000});return{ok:true,data:effective()};}
    if(message.type==='set-site-preferences'){
      window.__coachSiteSaves.push(message.preferences);sessionStorage.setItem('coach-site-preferences',JSON.stringify(message.preferences || {}));
      return{ok:true,data:effective()};
    }
    if(message.type==='get-tooltip-position')return{ok:true,data:JSON.parse(sessionStorage.getItem('coach-tooltip-position') || 'null')};
    if(message.type==='set-tooltip-size'){sessionStorage.setItem('coach-tooltip-size',message.size);listeners.forEach(fn=>fn({type:'settings-updated',settings:effective()}));return{ok:true,data:message.size};}
    if(message.type==='set-tooltip-position'){sessionStorage.setItem('coach-tooltip-position',JSON.stringify(message.position));return{ok:true,data:true};}
    if(message.type==='set-site-blocked'){
      const host=location.hostname;const blocklist=message.blocked?[...new Set([...settings.blocklist,host])]:settings.blocklist.filter(x=>x!==host);
      window.__coachSetSettings({blocklist});return{ok:true,data:effective()};
    }
    if(message.type==='metric'){window.__coachMetrics.push(message.delta);return{ok:true};}
    if(message.type==='vocabulary'){window.__coachWords.push(message);return{ok:true};}
    if(message.type==='suggest'){
      window.__coachRequests.push(message);const lane=message.lane || (settings.llmEnabled?'llm':'mt'),delay=window.__coachDelays?.[lane] ?? window.__coachDelay;if(delay)await new Promise(r=>setTimeout(r,delay));
      if(window.__coachFailures?.[lane])return{ok:false,error:`${lane} fixture failed.`};
      return{ok:true,data:window.__coachResponses?.[lane] || window.__coachResponse || (lane==='llm'?{text:'We should streamline this process.',explanation:'更简洁自然的表达。',engine:'Test LLM',category:'llm',vocabulary:[{word:'streamline',meaning:'精简；使高效',explanation:'在这里指简化工作流程。',example:'We streamlined our review process.'}]}:{text:'Hello, world.',engine:'MyMemory (fixture)',category:'basic',vocabulary:[]})};
    }return{ok:true};
  }}};
})();
