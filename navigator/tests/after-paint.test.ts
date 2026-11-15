import {test} from 'node:test';
import assert from 'node:assert/strict';
import {afterPaint,type PaintScheduler} from '../lib/after-paint';
function scheduler(){
 let frame:(()=>void)|undefined,task:(()=>void)|undefined;
 const api:PaintScheduler={frame:fn=>{frame=fn;return 1;},cancelFrame:()=>{frame=undefined;},task:fn=>{task=fn;return 2 as unknown as ReturnType<typeof setTimeout>;},cancelTask:()=>{task=undefined;}};
 return {api,paint:()=>{const fn=frame;frame=undefined;fn?.();},nextTask:()=>{const fn=task;task=undefined;fn?.();}};
}
test('scene construction waits for both a paint opportunity and a later task',()=>{
 const s=scheduler();let mounted=0;const cancel=afterPaint(()=>mounted++,s.api);
 assert.equal(mounted,0);s.paint();assert.equal(mounted,0);s.nextTask();assert.equal(mounted,1);assert.equal(cancel(),false);s.nextTask();assert.equal(mounted,1);
});
test('changing view cancels a pending mount before or after the paint callback',()=>{
 for(const painted of [false,true]){const s=scheduler();let mounted=false;const cancel=afterPaint(()=>mounted=true,s.api);if(painted)s.paint();assert.equal(cancel(),true);assert.equal(cancel(),false);s.paint();s.nextTask();assert.equal(mounted,false);}
});
