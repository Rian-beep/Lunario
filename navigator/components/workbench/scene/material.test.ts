import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import type { MapMeta } from '@/lib/catalog';
import { createSurfaceMaterial } from './material';
import { LUNAR_LINEAR_LUMINANCE_GLSL } from '@/lib/lunar-appearance';
import { latLonToProjected } from '@/lib/astro';
import type { ImageryData, ImagePatch } from '@/lib/imagery';
import { setImmediate } from 'node:timers/promises';

test('Moon atlas shader uses shared linear grayscale and bypasses view-dependent lighting/exposure by default', async () => {
  const original = T.TextureLoader.prototype.load;
  T.TextureLoader.prototype.load = function (_url, onLoad) {
    const texture = new T.Texture<HTMLImageElement>(); queueMicrotask(() => onLoad?.(texture)); return texture;
  };
  try {
    const surface = createSurfaceMaterial(null, { url: 'fixture', tieX: 0, tieY: 0, centerOffset: 0, scaleM: 1, width: 1, height: 1 } as MapMeta, -89, 0, 1, () => assert.fail('fixture load failed'));
    await Promise.resolve();
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>\n#include <opaque_fragment>' } as Parameters<T.Material['onBeforeCompile']>[0];
    surface.material.onBeforeCompile(shader, {} as T.WebGLRenderer);
    assert.equal(surface.material.toneMapped, false);
    assert.ok(shader.fragmentShader.includes(`dot(regolith, ${LUNAR_LINEAR_LUMINANCE_GLSL})`));
    assert.ok(shader.fragmentShader.includes('outgoingLight = diffuseColor.rgb'));
    assert.ok(!shader.fragmentShader.includes('regolith * vec3(0.69'));
    assert.equal(shader.uniforms.atlasAppearance.value, 1);
    surface.setAtlasAppearance(false);
    assert.equal(shader.uniforms.atlasAppearance.value, 0);
    assert.equal(surface.material.toneMapped, true);
    surface.setAtlasAppearance(true);
    assert.equal(surface.material.toneMapped, false);
    surface.dispose();
  } finally { T.TextureLoader.prototype.load = original; }
});

const fixtureMap = { url: 'fixture', tieX: 0, tieY: 0, centerOffset: 0, scaleM: 1, width: 1, height: 1 } as MapMeta;

function patchAt(site: number, regional = false): ImagePatch {
  const { x, y } = latLonToProjected(-89, site * 45);
  return { id: `${site}-${regional ? 'regional' : 'detail'}`, url: `${site}-${regional ? 'regional' : 'detail'}`,
    x0: x - 500, y0: y + 500, width: 1, height: 1, stepM: 1000, sourcePixelM: regional ? 100 : 1 };
}

async function withTextures(regional: boolean, run: (fixture: Awaited<ReturnType<typeof textureFixture>>) => Promise<void>) {
  const original = T.TextureLoader.prototype.load;
  const fixture = await textureFixture(regional);
  try { await run(fixture); }
  finally { fixture.surface.dispose(); T.TextureLoader.prototype.load = original; }
}

async function textureFixture(regional: boolean) {
  const requests: { url: string; texture: T.Texture; disposals: number; settled: boolean; finish: () => void; fail: () => void }[] = [];
  T.TextureLoader.prototype.load = function (url, onLoad, _onProgress, onError) {
    const texture = new T.Texture<HTMLImageElement>();
    const request = { url, texture, disposals: 0, settled: false,
      finish() {
        assert.equal(request.settled, false);
        request.settled = true;
        texture.image = { width: 16, height: 16 } as HTMLImageElement;
        onLoad?.(texture);
      },
      fail() {
        assert.equal(request.settled, false);
        request.settled = true;
        onError?.(new Error('fixture texture failure'));
      } };
    texture.addEventListener('dispose', () => { request.disposals++; });
    requests.push(request);
    if (url === 'global' || url === 'overview') queueMicrotask(request.finish);
    return texture;
  };
  const imagery: ImageryData = { retrievedUtc: '', source: '', sourceUrl: '', polarEndpoint: '', globalEndpoint: '', frame: '', note: '',
    global: { url: 'global', width: 1, height: 1 }, overview: { ...patchAt(0), url: 'overview' },
    patches: Array.from({ length: 8 }, (_, site) => regional ? [patchAt(site), patchAt(site, true)] : [patchAt(site)]).flat() };
  // Start outside the fixture patches so tests control every patch request.
  const surface = createSurfaceMaterial(imagery, fixtureMap, -80, 0, 16, () => assert.fail('unexpected initial load failure'));
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>' } as Parameters<T.Material['onBeforeCompile']>[0];
  surface.material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  await setImmediate();
  const request = (site: number, region = false) => {
    const result = requests.filter(r => r.url === patchAt(site, region).url).at(-1);
    assert.ok(result, `missing request for site ${site}`);
    return result;
  };
  const prepare = (site: number) => surface.prepareSite(-89, site * 45);
  const bind = async (site: number) => {
    const pending = prepare(site);
    for (const r of requests.filter(r => !r.settled)) r.finish();
    (await pending)();
  };
  return { surface, uniforms: shader.uniforms, requests, request, prepare, bind };
}

test('patch cache retains three LRU entries and reloads an evicted patch', async () => {
  await withTextures(false, async ({ bind, prepare, requests, request }) => {
    await bind(0); await bind(1); await bind(2);
    (await prepare(0))();
    assert.equal(requests.filter(r => r.url === '0-detail').length, 1);
    await bind(3);
    assert.equal(request(1).disposals, 1, 'least recently used patch retired');
    assert.equal(request(1).texture.image, null, 'decoded image reference removed');
    for (const site of [0, 2, 3]) assert.equal(request(site).disposals, 0);
    (await prepare(2))();
    await bind(1);
    assert.equal(requests.filter(r => r.url === '1-detail').length, 2);
    assert.equal(request(0).disposals, 1);
    assert.equal(requests.filter(r => r.url.includes('-detail') && !r.disposals).length, 3);
  });
});

test('bound slots and both preparing patches survive cache pressure until atomic handoff', async () => {
  await withTextures(true, async ({ bind, prepare, request, uniforms }) => {
    await bind(0);
    const pending = prepare(1);
    request(1).finish();
    await setImmediate();
    assert.equal(uniforms.detailImage.value, request(0).texture);
    assert.equal(uniforms.regionalImage.value, request(0, true).texture);
    request(1, true).finish();
    const apply = await pending;
    for (const site of [0, 1]) for (const region of [false, true]) assert.equal(request(site, region).disposals, 0);
    assert.equal(request(1).texture.colorSpace, T.SRGBColorSpace);
    assert.equal(request(1).texture.anisotropy, 8);
    apply();
    assert.equal(uniforms.detailImage.value, request(1).texture);
    assert.equal(uniforms.regionalImage.value, request(1, true).texture);
    assert.equal(request(0).disposals, 1);
    assert.equal(request(0, true).disposals, 0);
    await bind(2);
    assert.equal(request(0, true).disposals, 1);
    for (const region of [false, true]) assert.equal(request(2, region).disposals, 0);
    apply();
    assert.equal(uniforms.detailImage.value, request(2).texture, 'repeated old apply cannot rebind retired textures');
  });
});

test('leaving patch coverage replaces disabled sampler slots with the blank texture', async () => {
  await withTextures(true, async ({ surface, bind, uniforms, request }) => {
    const blank = uniforms.detailImage.value;
    await bind(0);
    (await surface.prepareSite(-80, 0))();
    assert.equal(uniforms.hasDetail.value, 0);
    assert.equal(uniforms.hasRegional.value, 0);
    assert.equal(uniforms.detailImage.value, blank);
    assert.equal(uniforms.regionalImage.value, blank);
    await bind(1); await bind(2);
    assert.equal(request(0).disposals, 1);
    assert.equal(request(0, true).disposals, 1);
    assert.equal(uniforms.hasGlobal.value, 1);
    assert.equal(uniforms.hasPolar.value, 1);
  });
});

test('rapid destinations keep two patch loads active and only the latest queued pair', async () => {
  await withTextures(true, async ({ prepare, request, requests, uniforms }) => {
    const old = prepare(0);
    const skipped = prepare(1);
    const latest = prepare(2);
    assert.equal(requests.filter(r => !r.settled).length, 2);
    request(0).finish();
    assert.equal(requests.filter(r => !r.settled).length, 2);
    assert.equal(requests.filter(r => r.url.startsWith('1-')).length, 0);
    request(0, true).finish();
    assert.equal(requests.filter(r => !r.settled).length, 2);
    request(2).finish(); request(2, true).finish();
    const [applyOld, applySkipped, applyLatest] = await Promise.all([old, skipped, latest]);
    applyLatest(); applyOld(); applySkipped();
    assert.equal(uniforms.detailImage.value, request(2).texture);
    assert.equal(uniforms.regionalImage.value, request(2, true).texture);
    assert.equal(request(0).disposals, 1);
  });
});

test('retargeting an in-flight patch deduplicates it and protects prepared images before apply', async () => {
  await withTextures(true, async ({ prepare, request, requests, uniforms }) => {
    const old = prepare(0);
    const skipped = prepare(1);
    const latest = prepare(0);
    request(0).finish(); request(0, true).finish();
    const [applyOld, applySkipped, applyLatest] = await Promise.all([old, skipped, latest]);
    assert.equal(requests.filter(r => r.url.startsWith('0-')).length, 2);
    assert.equal(requests.filter(r => r.url.startsWith('1-')).length, 0);
    applyOld(); applySkipped();
    assert.equal(uniforms.hasDetail.value, 0);
    applyLatest();
    assert.equal(uniforms.detailImage.value, request(0).texture);
    assert.equal(request(0).disposals, 0);
  });
});

test('failed patch promises are removed for retry without dropping the bound pair', async () => {
  await withTextures(true, async ({ bind, prepare, request, requests, uniforms }) => {
    await bind(0);
    const pending = prepare(1);
    const failed = request(1);
    const rejected = assert.rejects(pending, /fixture texture failure/);
    failed.fail();
    await rejected;
    assert.equal(failed.disposals, 1);
    assert.equal(uniforms.detailImage.value, request(0).texture);
    assert.equal(uniforms.regionalImage.value, request(0, true).texture);
    const retry = prepare(1);
    assert.equal(requests.filter(r => r.url === '1-detail').length, 2);
    assert.equal(requests.filter(r => r.url === '1-regional').length, 1, 'pending sibling reused');
    request(1).finish(); request(1, true).finish();
    (await retry)();
    assert.equal(uniforms.detailImage.value, request(1).texture);
    assert.equal(uniforms.regionalImage.value, request(1, true).texture);
  });
});

test('dispose is idempotent, settles preparations and retires late loads without rebinding', async () => {
  await withTextures(true, async ({ surface, bind, prepare, request, requests, uniforms }) => {
    const placeholder = uniforms.detailImage.value as T.Texture;
    let placeholderDisposals = 0;
    placeholder.addEventListener('dispose', () => { placeholderDisposals++; });
    await bind(0);
    const pending = prepare(1);
    const queued = prepare(2);
    let materialDisposals = 0;
    surface.material.addEventListener('dispose', () => { materialDisposals++; });
    surface.dispose(); surface.dispose();
    assert.equal(materialDisposals, 1);
    request(1).finish(); request(1, true).finish();
    (await pending)(); (await queued)();
    await surface.prepareSite(-89, 0);
    surface.dispose();
    assert.equal(placeholderDisposals, 1);
    assert.equal(uniforms.detailImage.value, placeholder);
    assert.equal(placeholder.image, null);
    assert.equal(requests.filter(r => r.url.startsWith('2-')).length, 0);
    for (const r of requests) {
      assert.equal(r.disposals, 1, `${r.url} retired exactly once`);
      assert.equal(r.texture.image, null, `${r.url} decoded reference cleared`);
    }
  });
});

test('metre-scale surface detail blends into the next finest real NAC patch instead of a coarse WAC jump',async()=>{
 const original=T.TextureLoader.prototype.load,requests:string[]=[];
 T.TextureLoader.prototype.load=function(url,onLoad){requests.push(url);const texture=new T.Texture<HTMLImageElement>();queueMicrotask(()=>onLoad?.(texture));return texture;};
 try{
  const broad={...patchAt(0),url:'nac-broad',stepM:4.18,width:256,height:256};
  const fine={...broad,url:'nac-surface',stepM:2.09,width:512,height:512};
  const wac={...broad,url:'wac',stepM:100,width:1024,height:1024,sourcePixelM:100};
  const imagery:ImageryData={retrievedUtc:'',source:'NASA',sourceUrl:'',polarEndpoint:'',globalEndpoint:'',frame:'',note:'',global:{url:'global',width:1,height:1},overview:{...wac,url:'overview'},patches:[wac,broad,fine]};
  // Recenter all three patches so their differing extents contain the same site.
  const centre=latLonToProjected(-89,0);for(const p of imagery.patches){p.x0=centre.x-p.width*p.stepM/2;p.y0=centre.y+p.height*p.stepM/2;}
  const surface=createSurfaceMaterial(imagery,fixtureMap,-89,0,16,()=>assert.fail('load'));
  await setImmediate();await surface.prepareSite(-89,0).then(apply=>apply());
  assert.ok(requests.includes('nac-surface'));assert.ok(requests.includes('nac-broad'));assert.ok(!requests.includes('wac'));surface.dispose();
 }finally{T.TextureLoader.prototype.load=original;}
});
