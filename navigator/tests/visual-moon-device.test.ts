import test from 'node:test';import assert from 'node:assert/strict';import {visualMoonDevice} from '../lib/visual-moon-device';import {visualMoonTiers} from '../lib/visual-moon';
test('web high-memory budget permits native8K; unknown memory and offline retain bounded4K',()=>{
 assert.equal(visualMoonTiers(visualMoonDevice(16384,16,8,false)).at(-1)?.width,8192);
 for(const memory of [undefined,NaN,4])assert.equal(visualMoonTiers(visualMoonDevice(16384,16,memory,false)).at(-1)?.width,4096);
 assert.equal(visualMoonTiers(visualMoonDevice(16384,16,8,true)).at(-1)?.width,4096);
 assert.equal(visualMoonTiers(visualMoonDevice(1024,1,8,false)).at(-1)?.width,1024);
});
