import {writeFile,mkdir} from 'node:fs/promises';
import {zlibSync} from 'fflate';
import {mark,markSVG,markShapes} from '../src/brand/mark.js';

function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return (crc^0xffffffff)>>>0;}
function chunk(type,body){const t=Buffer.from(type),b=Buffer.alloc(body.length+12);b.writeUInt32BE(body.length);t.copy(b,4);Buffer.from(body).copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,body.length+8)),body.length+8);return b;}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const layers=markShapes.map(([tag,attrs])=>{
  const color=rgb(attrs.fill);
  if(tag==='rect'){const {x,y,width,height,rx}=attrs;return{color,contains:(px,py)=>{const dx=Math.max(Math.abs(px-x-width/2)-(width/2-rx),0),dy=Math.max(Math.abs(py-y-height/2)-(height/2-rx),0);return px>=x && px<=x+width && py>=y && py<=y+height && dx*dx+dy*dy<=rx*rx;}};}
  const points=attrs.points.split(' ').map(point=>point.split(',').map(Number));
  return{color,contains:(x,y)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}};
});
export function markPNG(size,padding=0){
  const pixels=Buffer.alloc((size*4+1)*size),samples=4,total=samples*samples,scale=mark.size/(size-2*padding);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let opaque=0;const sum=[0,0,0];
    for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
      const px=(x-padding+(sx+.5)/samples)*scale,py=(y-padding+(sy+.5)/samples)*scale;
      if(!layers[0].contains(px,py))continue;opaque++;
      const color=layers.findLast(layer=>layer.contains(px,py)).color;for(let c=0;c<3;c++)sum[c]+=color[c];
    }
    const i=y*(size*4+1)+1+x*4;
    if(opaque)for(let c=0;c<3;c++)pixels[i+c]=Math.round(sum[c]/opaque);
    pixels[i+3]=Math.round(255*opaque/total);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
export async function buildBrand(directory){
  await mkdir(directory,{recursive:true});
  await writeFile(`${directory}/saywell.svg`,markSVG());
  const images=new Map();for(const size of [16,32,48,128,512]){const png=markPNG(size,size===128?16:0);images.set(size,png);await writeFile(`${directory}/${size}.png`,png);}
  const sizes=[16,32,48],header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
  for(const[size,index]of sizes.map((size,index)=>[size,index])){const at=6+index*16,png=images.get(size);header[at]=header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);offset+=png.length;}
  await writeFile(`${directory}/favicon.ico`,Buffer.concat([header,...sizes.map(size=>images.get(size))]));
}
