// Two speech shapes: the original thought and a warmer, clearer reply.
// Filled silhouettes stay recognizable at toolbar sizes without relying on a letter.
export const mark={size:64,radius:17,background:'#214d3f',foreground:'#fff3d6',accent:'#eea35a'};
export const markShapes=[
  ['rect',{x:0,y:0,width:64,height:64,rx:17,fill:mark.background}],
  ['polygon',{points:'10,30 10,50 29,37',fill:mark.foreground}],
  ['rect',{x:10,y:12,width:35,height:29,rx:10,fill:mark.foreground}],
  ['polygon',{points:'43,40 57,58 57,36',fill:mark.background}],
  ['rect',{x:27,y:27,width:30,height:24,rx:10,fill:mark.background}],
  ['polygon',{points:'43,43 54,54 54,38',fill:mark.accent}],
  ['rect',{x:30,y:30,width:24,height:18,rx:7,fill:mark.accent}]
];
export function markSVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mark.size} ${mark.size}" fill="none"><title>Saywell</title>${markShapes.map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([key,value])=>`${key}="${value}"`).join(' ')}/>`).join('')}</svg>\n`;
}
export function createMark(doc){
  const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${mark.size} ${mark.size}`);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.setAttribute('class','saywell-mark');
  for(const[tag,attrs]of markShapes){const child=doc.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))child.setAttribute(key,String(value));svg.append(child);}
  return svg;
}
