const minor=char=>/[\p{P}\p{S}\s]/u.test(char);
const canonical=char=>char.normalize('NFKC').toLowerCase();
const pairKind=(a,b)=>a===b?'match':canonical(a)===canonical(b) || minor(a) && minor(b)?'minor':'major';
const cost=char=>minor(char)?1:1000;
function segments(chars,kinds){const out=[];chars.forEach((char,i)=>{const last=out.at(-1);if(last?.kind===kinds[i])last.text+=char;else out.push({text:char,kind:kinds[i]});});return out;}
export function practiceDiff(expected,actual){
  const target=Array.from(expected),input=Array.from(actual),tk=target.map(()=>'pending'),ik=input.map(()=>'match');let major=0,secondary=0,start=0;
  while(start<target.length && start<input.length && target[start]===input[start]){tk[start]='match';start++;}
  const apply=(a,b)=>{const kind=a===null?(minor(input[b])?'minor':'major'):b===null?(minor(target[a])?'minor':'major'):pairKind(target[a],input[b]);if(a!==null)tk[a]=kind;if(b!==null)ik[b]=kind;if(kind==='major')major++;if(kind==='minor')secondary++;};
  const a=target.slice(start),b=input.slice(start),n=Math.min(a.length,b.length+64),m=b.length;
  if(m && (m+1)*(n+1)<=200000){
    const width=n+1,dp=new Uint32Array((m+1)*width);
    for(let j=1;j<=n;j++)dp[j]=dp[j-1]+cost(a[j-1]);
    for(let i=1;i<=m;i++){
      dp[i*width]=dp[(i-1)*width]+cost(b[i-1]);
      for(let j=1;j<=n;j++){const kind=pairKind(a[j-1],b[i-1]);dp[i*width+j]=Math.min(dp[(i-1)*width+j-1]+(kind==='match'?0:kind==='minor'?1:1000),dp[(i-1)*width+j]+cost(b[i-1]),dp[i*width+j-1]+cost(a[j-1]));}
    }
    let end=0;for(let j=1;j<=n;j++)if(dp[m*width+j]<=dp[m*width+end])end=j;
    const operations=[];let i=m,j=end;
    while(i || j){const value=dp[i*width+j],kind=i && j?pairKind(a[j-1],b[i-1]):null;
      if(i && j && value===dp[(i-1)*width+j-1]+(kind==='match'?0:kind==='minor'?1:1000)){operations.push([start+j-1,start+i-1]);i--;j--;}
      else if(j && value===dp[i*width+j-1]+cost(a[j-1])){operations.push([start+j-1,null]);j--;}
      else{operations.push([null,start+i-1]);i--;}
    }
    operations.reverse().forEach(([x,y])=>apply(x,y));
  }else if(m){
    // Bounded look-ahead keeps long pasted paragraphs responsive instead of allocating a quadratic matrix.
    let i=start,j=start;
    while(i<input.length){if(j>=target.length){apply(null,i++);continue;}
      if(pairKind(target[j],input[i])!=='major'){apply(j++,i++);continue;}
      if(minor(target[j])){apply(j++,null);continue;}if(minor(input[i])){apply(null,i++);continue;}
      let aheadTarget=0,aheadInput=0;
      for(let k=1;k<=16;k++){if(!aheadTarget && j+k<target.length && canonical(target[j+k])===canonical(input[i]))aheadTarget=k;if(!aheadInput && i+k<input.length && canonical(input[i+k])===canonical(target[j]))aheadInput=k;}
      if(aheadTarget && (!aheadInput || aheadTarget<=aheadInput)){for(let k=0;k<aheadTarget;k++)apply(j++,null);}
      else if(aheadInput){for(let k=0;k<aheadInput;k++)apply(null,i++);}
      else apply(j++,i++);
    }
  }
  const remaining=tk.findIndex(kind=>kind==='pending');
  if(input.length && remaining>=0 && target.slice(remaining).every(minor))for(let j=remaining;j<target.length;j++)apply(j,null);
  return {target:segments(target,tk),input:segments(input,ik),major,minor:secondary,complete:input.length>0 && !major && !tk.some((kind,i)=>kind==='pending' && !minor(target[i]))};
}
