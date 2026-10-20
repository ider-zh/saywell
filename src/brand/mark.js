// Saywell's mark: a flowing S ending in a small conversational tail.
// Shared geometry keeps console, isolated tooltip, SVG and PNG exports consistent.
export const mark={
  size:64,radius:17,background:'#285443',foreground:'#f8f3de',stroke:7.5,
  start:[43,20],
  curves:[[[37,14],[22,15],[21,24]],[[20,33],[44,30],[43,40]],[[42,50],[27,50],[21,43]]],
  tail:[[22,41],[18,53],[31,47]]
};
const path=`M ${mark.start.join(' ')} ${mark.curves.map(points=>'C '+points.flat().join(' ')).join(' ')}`;
const shapes=[
  ['rect',{width:mark.size,height:mark.size,rx:mark.radius,fill:mark.background}],
  ['polygon',{points:mark.tail.map(p=>p.join(',')).join(' '),fill:mark.foreground}],
  ['path',{d:path,fill:'none',stroke:mark.foreground,'stroke-width':mark.stroke,'stroke-linecap':'round','stroke-linejoin':'round'}]
];
export function markSVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mark.size} ${mark.size}" fill="none"><title>Saywell</title>${shapes.map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([key,value])=>`${key}="${value}"`).join(' ')}/>`).join('')}</svg>\n`;
}
export function createMark(doc){
  const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${mark.size} ${mark.size}`);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.setAttribute('class','saywell-mark');
  for(const[tag,attrs]of shapes){const child=doc.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))child.setAttribute(key,String(value));svg.append(child);}
  return svg;
}
