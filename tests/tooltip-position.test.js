import test from 'node:test';
import assert from 'node:assert/strict';
import {validTooltipPosition,tooltipBounds,clampTooltip,relativeTooltip,placedTooltip,safeTooltipDock} from '../src/core/tooltip-position.js';

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

test('automatic status and tooltip docks stay outside editors and inside resized visual viewports',()=>{
  const viewports=[{left:0,top:0,width:1280,height:900},{left:30,top:80,width:360,height:640},{left:0,top:0,width:320,height:180}];
  for(const viewport of viewports)for(const editor of [{left:45,top:110,right:300,bottom:170},{left:45,top:500,right:300,bottom:620},{left:80,top:0,right:250,bottom:170}]){
    const dock=safeTooltipDock(viewport,editor,{width:310,height:210});if(!dock)continue;
    assert.ok(dock.left>=viewport.left && dock.top>=viewport.top);
    assert.ok(dock.left+dock.width<=viewport.left+viewport.width && dock.top+dock.height<=viewport.top+viewport.height);
    assert.ok(dock.left+dock.width<=editor.left-8 || dock.left>=editor.right+8 || dock.top+dock.height<=editor.top-8 || dock.top>=editor.bottom+8);
  }
  assert.equal(safeTooltipDock({left:0,top:0,width:320,height:180},{left:0,top:0,right:320,bottom:180},{width:310,height:210}),null);
});
