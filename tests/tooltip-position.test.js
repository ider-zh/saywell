import test from 'node:test';
import assert from 'node:assert/strict';
import {validTooltipPosition,tooltipBounds,clampTooltip,relativeTooltip,placedTooltip} from '../src/core/tooltip-position.js';

test('tooltip placement follows available viewport travel across resize and card growth',()=>{
  const viewport={left:0,top:0,width:1200,height:800};
  const bounds=tooltipBounds(viewport,{width:410,height:260});
  const saved=relativeTooltip({left:700,top:450},bounds);
  assert.deepEqual(placedTooltip(saved,bounds),{left:700,top:450});
  const smaller=tooltipBounds({left:0,top:0,width:500,height:400},{width:410,height:376});
  const point=placedTooltip(saved,smaller);
  assert.ok(point.left>=12 && point.left+410<=488);assert.equal(point.top,12);
  assert.deepEqual(placedTooltip(saved,bounds),{left:700,top:450},'clamping does not overwrite the preferred position');
});
test('tooltip geometry handles visual viewport offsets and no available travel',()=>{
  const bounds=tooltipBounds({left:100,top:200,width:390,height:300},{width:366,height:276});
  assert.deepEqual(clampTooltip({left:-999,top:9999},bounds),{left:112,top:212});
  assert.deepEqual(relativeTooltip({left:112,top:212},bounds),{x:0,y:0});
  assert.deepEqual(placedTooltip({x:1,y:1},bounds),{left:112,top:212});
});
test('only finite normalized numeric tooltip coordinates are accepted',()=>{
  for(const value of [null,{},[],{x:'0.5',y:0},{x:NaN,y:0},{x:Infinity,y:0},{x:0,y:-1},{x:1.01,y:0}])assert.equal(validTooltipPosition(value),false);
  assert.equal(validTooltipPosition({x:0,y:1}),true);
});
