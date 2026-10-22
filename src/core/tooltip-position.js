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
// Choose a viewport region outside the editor. If none fits even a small status
// indicator, hide it rather than covering the user's typing surface.
export function safeTooltipDock(viewport,editor,size){
  const padding=Math.min(12,viewport.width/2,viewport.height/2),gap=8;
  const left=viewport.left+padding,top=viewport.top+padding,right=viewport.left+viewport.width-padding,bottom=viewport.top+viewport.height-padding;
  const width=Math.min(size.width,Math.max(0,right-left)),height=Math.min(size.height,Math.max(0,bottom-top));
  const x=Math.max(left,Math.min(editor.left,right-width)),y=Math.max(top,Math.min(editor.top,bottom-height));
  const regions=[
    {left:x,top:Math.max(top,editor.bottom+gap),width,height:bottom-Math.max(top,editor.bottom+gap),side:'below'},
    {left:x,top,width,height:Math.min(bottom,editor.top-gap)-top,side:'above'},
    {left:Math.max(left,editor.right+gap),top:y,width:right-Math.max(left,editor.right+gap),height,side:'right'},
    {left,top:y,width:Math.min(right,editor.left-gap)-left,height,side:'left'}
  ].filter(region=>region.width>=24 && region.height>=24);
  const region=regions.find(region=>region.width>=width && region.height>=height) || regions.sort((a,b)=>Math.min(b.width,width)*Math.min(b.height,height)-Math.min(a.width,width)*Math.min(a.height,height))[0];
  if(!region)return null;
  const result={...region,width:Math.min(width,region.width),height:Math.min(height,region.height)};
  if(result.side==='above')result.top=region.top+region.height-result.height;
  if(result.side==='left')result.left=region.left+region.width-result.width;
  return result;
}
