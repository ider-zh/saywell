import {writeFile,mkdir} from 'node:fs/promises';
import {zlibSync} from 'fflate';
import {mark,markSVG} from '../src/brand/mark.js';

function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return (crc^0xffffffff)>>>0;}
function chunk(type,body){const t=Buffer.from(type),b=Buffer.alloc(body.length+12);b.writeUInt32BE(body.length);t.copy(b,4);Buffer.from(body).copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,body.length+8)),body.length+8);return b;}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const background=rgb(mark.background),foreground=rgb(mark.foreground);
// Flatten cubic curves only for rasterization; the vector export retains exact curves.
const points=[mark.start];let start=mark.start;
for(const[a,b,end]of mark.curves){
  for(let i=1;i<=24;i++){const t=i/24,u=1-t;points.push([0,1].map(axis=>u*u*u*start[axis]+3*u*u*t*a[axis]+3*u*t*t*b[axis]+t*t*t*end[axis]));}
  start=end;
}
const segments=points.slice(1).map((end,i)=>{const a=points[i],dx=end[0]-a[0],dy=end[1]-a[1];return {x:a[0],y:a[1],dx,dy,length:dx*dx+dy*dy};});
function onStroke(x,y){
  for(const s of segments){const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(y-s.y)*s.dy)/s.length)),dx=x-s.x-t*s.dx,dy=y-s.y-t*s.dy;if(dx*dx+dy*dy<=mark.stroke*mark.stroke/4)return true;}
  return false;
}
function inTail(x,y){
  const sides=mark.tail.map((a,i)=>{const b=mark.tail[(i+1)%3];return (x-b[0])*(a[1]-b[1])-(a[0]-b[0])*(y-b[1]);});
  return sides.every(n=>n>=0) || sides.every(n=>n<=0);
}
function inTile(x,y){const dx=Math.max(Math.abs(x-32)-(32-mark.radius),0),dy=Math.max(Math.abs(y-32)-(32-mark.radius),0);return dx*dx+dy*dy<=mark.radius*mark.radius;}
export function markPNG(size){
  const pixels=Buffer.alloc((size*4+1)*size),samples=4,total=samples*samples,scale=mark.size/size;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let opaque=0,ink=0;
    for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
      const px=(x+(sx+.5)/samples)*scale,py=(y+(sy+.5)/samples)*scale;
      if(!inTile(px,py))continue;opaque++;
      if(px>=14 && px<=48 && py>=10 && py<=54 && (inTail(px,py) || onStroke(px,py)))ink++;
    }
    const i=y*(size*4+1)+1+x*4;
    if(opaque)for(let c=0;c<3;c++)pixels[i+c]=Math.round((foreground[c]*ink+background[c]*(opaque-ink))/opaque);
    pixels[i+3]=Math.round(255*opaque/total);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
export async function buildBrand(directory){
  await mkdir(directory,{recursive:true});
  await writeFile(`${directory}/saywell.svg`,markSVG());
  for(const size of [16,32,48,128,512])await writeFile(`${directory}/${size}.png`,markPNG(size));
}
