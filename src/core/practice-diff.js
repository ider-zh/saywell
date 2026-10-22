const minor=char=>/[\p{P}\p{S}\s]/u.test(char);
const canonical=char=>char.normalize('NFKC').toLowerCase();
const asciiLetter=char=>char>='A' && char<='Z' || char>='a' && char<='z';
function segments(chars,kinds){const out=[];chars.forEach((char,i)=>{const last=out.at(-1);if(last?.kind===kinds[i])last.text+=char;else out.push({text:char,kind:kinds[i]});});return out;}
export function createPracticeComparer(expected){
  const target=Array.from(expected),normal=target.map(canonical),secondary=target.map(minor);
  return actual=>compare(target,normal,secondary,actual);
}
export function practiceDiff(expected,actual){return createPracticeComparer(expected)(actual);}
function compare(target,normal,secondary,actual){
  const input=Array.from(actual),inormal=input.map(canonical),isecondary=input.map(minor),tk=target.map(()=>'pending'),ik=input.map(()=>'match');let major=0,minorCount=0,start=0;
  // Classify each character once, outside the O(n*m) alignment loop.
  const pairCost=(a,b)=>target[a]===input[b]?0:normal[a]===inormal[b] || secondary[a] && isecondary[b]?1:1000;
  const apply=(a,b)=>{const value=a===null?(isecondary[b]?1:1000):b===null?(secondary[a]?1:1000):pairCost(a,b),kind=value===0?'match':value===1?'minor':'major';if(a!==null)tk[a]=kind;if(b!==null)ik[b]=kind;if(value===1000)major++;if(value===1)minorCount++;};
  while(start<target.length && start<input.length && target[start]===input[start]){tk[start]='match';start++;}
  const n=Math.min(target.length-start,input.length-start+64),m=input.length-start;
  if(input.length<=target.length && input.every((char,i)=>char===target[i] || asciiLetter(char) && asciiLetter(target[i]) && inormal[i]===normal[i])){
    // A correct ASCII prefix with different casing needs no edit-distance matrix.
    for(let i=start;i<input.length;i++)apply(i,i);
  }else if(m && (m+1)*(n+1)<=200000){
    const width=n+1,dp=new Uint32Array((m+1)*width);
    for(let j=1;j<=n;j++)dp[j]=dp[j-1]+(secondary[start+j-1]?1:1000);
    for(let i=1;i<=m;i++){
      const at=start+i-1,insert=isecondary[at]?1:1000,row=i*width,previous=row-width;dp[row]=dp[previous]+insert;
      for(let j=1;j<=n;j++){const targetAt=start+j-1,pair=target[targetAt]===input[at]?0:normal[targetAt]===inormal[at] || secondary[targetAt] && isecondary[at]?1:1000;dp[row+j]=Math.min(dp[previous+j-1]+pair,dp[previous+j]+insert,dp[row+j-1]+(secondary[targetAt]?1:1000));}
    }
    let end=0;for(let j=1;j<=n;j++)if(dp[m*width+j]<=dp[m*width+end])end=j;
    const operations=[];let i=m,j=end;
    while(i || j){const value=dp[i*width+j];
      if(i && j && value===dp[(i-1)*width+j-1]+pairCost(start+j-1,start+i-1)){operations.push([start+j-1,start+i-1]);i--;j--;}
      else if(j && value===dp[i*width+j-1]+(secondary[start+j-1]?1:1000)){operations.push([start+j-1,null]);j--;}
      else{operations.push([null,start+i-1]);i--;}
    }
    operations.reverse().forEach(([x,y])=>apply(x,y));
  }else if(m){
    // Bounded look-ahead keeps long pasted paragraphs responsive instead of allocating a quadratic matrix.
    let i=start,j=start;
    while(i<input.length){if(j>=target.length){apply(null,i++);continue;}
      if(pairCost(j,i)!==1000){apply(j++,i++);continue;}
      if(secondary[j]){apply(j++,null);continue;}if(isecondary[i]){apply(null,i++);continue;}
      let aheadTarget=0,aheadInput=0;
      for(let k=1;k<=16;k++){if(!aheadTarget && j+k<target.length && normal[j+k]===inormal[i])aheadTarget=k;if(!aheadInput && i+k<input.length && normal[j]===inormal[i+k])aheadInput=k;}
      if(aheadTarget && (!aheadInput || aheadTarget<=aheadInput)){for(let k=0;k<aheadTarget;k++)apply(j++,null);}
      else if(aheadInput){for(let k=0;k<aheadInput;k++)apply(null,i++);}
      else apply(j++,i++);
    }
  }
  const remaining=tk.findIndex(kind=>kind==='pending');
  if(input.length && remaining>=0 && secondary.slice(remaining).every(Boolean))for(let j=remaining;j<target.length;j++)apply(j,null);
  return {target:segments(target,tk),input:segments(input,ik),major,minor:minorCount,complete:input.length>0 && !major && !tk.some((kind,i)=>kind==='pending' && !secondary[i])};
}
