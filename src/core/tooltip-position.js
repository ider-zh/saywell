// Normalized coordinates describe travel within the visible viewport, not document scroll.
export function validTooltipPosition(value){
  return Boolean(value && typeof value.x==='number' && typeof value.y==='number' &&
    Number.isFinite(value.x) && Number.isFinite(value.y) && value.x>=0 && value.x<=1 && value.y>=0 && value.y<=1);
}
export function tooltipBounds(viewport,size){
  const padding=Math.min(12,viewport.width/2,viewport.height/2);
  const left=viewport.left+padding,top=viewport.top+padding;
  return {left,top,width:Math.max(0,viewport.width-size.width-2*padding),height:Math.max(0,viewport.height-size.height-2*padding)};
}
export function clampTooltip(point,bounds){
  return {left:Math.max(bounds.left,Math.min(point.left,bounds.left+bounds.width)),top:Math.max(bounds.top,Math.min(point.top,bounds.top+bounds.height))};
}
export function relativeTooltip(point,bounds){
  const clamped=clampTooltip(point,bounds);
  return {x:bounds.width?(clamped.left-bounds.left)/bounds.width:0,y:bounds.height?(clamped.top-bounds.top)/bounds.height:0};
}
export function placedTooltip(position,bounds){
  return {left:bounds.left+position.x*bounds.width,top:bounds.top+position.y*bounds.height};
}
