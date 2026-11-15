import test from 'node:test';
import assert from 'node:assert/strict';
import {srgbToLinear,linearToSrgb,neutralizeLunarRgba,LUNAR_LUMINANCE_WEIGHTS,LUNAR_ATLAS_POLICY} from '../lib/lunar-appearance';
test('neutral atlas uses Rec709 linear light and the sRGB transfer breakpoints',()=>{
 assert.ok(Math.abs(LUNAR_LUMINANCE_WEIGHTS.reduce((a,b)=>a+b,0)-1)<1e-12);
 assert.equal(srgbToLinear(0),0);assert.equal(linearToSrgb(0),0);assert.equal(srgbToLinear(1),1);
 assert.ok(Math.abs(srgbToLinear(.04045)-.04045/12.92)<1e-12);
 for(const c of [0,.01,.04045,.1,.5,1])assert.ok(Math.abs(linearToSrgb(srgbToLinear(c))-c)<1e-7);
 assert.equal(LUNAR_ATLAS_POLICY.toneMapped,false);
});
test('primary colours convert from linear luminance rather than encoded-channel grayscale',()=>{
 const pixels=new Uint8ClampedArray([255,0,0,255,0,255,0,128,0,0,255,0]);neutralizeLunarRgba(pixels);
 assert.deepEqual([...pixels],[127,127,127,255,220,220,220,128,76,76,76,0]);
 assert.notEqual(pixels[0],Math.round(.2126*255),'Encoded-channel grayscale would disagree with the 3D linear shader');
});
test('every source gray and alpha remain unchanged with repeat conversion',()=>{
 const pixels=Uint8ClampedArray.from(Array.from({length:256},(_,n)=>[n,n,n,n]).flat());const expected=pixels.slice();neutralizeLunarRgba(pixels);assert.deepEqual(pixels,expected);neutralizeLunarRgba(pixels);assert.deepEqual(pixels,expected);
});
test('coloured source pixels become neutral without changing alpha or pixel count',()=>{
 const pixels=new Uint8ClampedArray([142,121,96,57,10,40,80,255]);neutralizeLunarRgba(pixels);
 for(let i=0;i<pixels.length;i+=4){assert.equal(pixels[i],pixels[i+1]);assert.equal(pixels[i],pixels[i+2]);}
 assert.equal(pixels[3],57);assert.equal(pixels[7],255);assert.equal(pixels.length,8);
 assert.throws(()=>neutralizeLunarRgba(new Uint8ClampedArray(3)));assert.throws(()=>srgbToLinear(NaN));assert.throws(()=>linearToSrgb(-.1));
});
