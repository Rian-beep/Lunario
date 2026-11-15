import {POLAR_BODY_GLSL} from '@/lib/lunar-projection';
import * as T from "three";
import {acquireMoonAtlas} from "@/lib/moon-atlas-texture";
import {LUNAR_LINEAR_LUMINANCE_GLSL} from "@/lib/lunar-appearance";
import type { ImageryData, ImagePatch } from "@/lib/imagery";
import type { MapMeta } from "@/lib/catalog";
import { latLonToProjected } from "@/lib/astro";

export function imageUv(patch: ImagePatch, xM: number, yM: number) {
  return { u: (xM - patch.x0) / (patch.width * patch.stepM), v: 1 - (patch.y0 - yM) / (patch.height * patch.stepM) };
}

export function createSurfaceMaterial(
  imagery: ImageryData | null | undefined,
  map: MapMeta,
  latDeg: number,
  lonDeg: number,
  maxAnisotropy: number,
  onFailure: () => void,
) {
  const textures = new Set<T.Texture>();
  const retired = new WeakSet<T.Texture>();
  const retire = (texture: T.Texture) => {
    textures.delete(texture);
    if (!retired.has(texture)) { retired.add(texture); texture.dispose(); }
    texture.image = null;
  };
  let disposed = false;
  let releaseAtlas: (() => void) | undefined;
  const blank = new T.DataTexture(new Uint8Array([154, 151, 145, 255]), 1, 1);
  blank.colorSpace = T.SRGBColorSpace;
  blank.needsUpdate = true;
  textures.add(blank);
  const uniforms = {
    atlasAppearance: { value: 1 },
    globalImage: { value: blank as T.Texture },
    polarImage: { value: blank as T.Texture },
    regionalImage: { value: blank as T.Texture },
    detailImage: { value: blank as T.Texture },
    hasGlobal: { value: 0 }, hasPolar: { value: 0 }, hasRegional: { value: 0 }, hasDetail: { value: 0 },
    polarBoundsM: { value: new T.Vector4() },
    regionalBoundsM: { value: new T.Vector4() },
    detailBoundsM: { value: new T.Vector4() },
  };
  const load = (url: string, slot: "globalImage" | "polarImage" | "regionalImage" | "detailImage", flag: "hasGlobal" | "hasPolar" | "hasRegional" | "hasDetail") => {
    const texture = new T.TextureLoader().load(url, (loaded) => {
      if (disposed) { retire(loaded); return; }
      uniforms[slot].value = loaded;
      uniforms[flag].value = 1;
    }, undefined, () => { retire(texture); if (!disposed) onFailure(); });
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(8, maxAnisotropy);
    textures.add(texture);
  };
  const bounds = (patch: ImagePatch) => new T.Vector4(patch.x0, patch.y0, patch.width * patch.stepM, patch.height * patch.stepM);
  type SiteTexture = {
    state: "queued" | "loading" | "ready";
    texture?: T.Texture;
    pending: Promise<void>;
    resolve: () => void;
    reject: (reason: unknown) => void;
  };
  // Three cached patches, except while bound/preparing patches need protection.
  const siteTextures = new Map<string, SiteTexture>();
  let preparingUrls = new Set<string>();
  let activeLoads = 0;
  const trimSiteTextures = () => {
    for (const [url, entry] of siteTextures) {
      if (siteTextures.size <= 3) break;
      if (entry.state !== "ready" || preparingUrls.has(url) ||
        entry.texture === uniforms.detailImage.value || entry.texture === uniforms.regionalImage.value) continue;
      siteTextures.delete(url);
      if (entry.texture) retire(entry.texture);
      entry.texture = undefined;
    }
  };
  const siteTexture = (url: string) => {
    let entry = siteTextures.get(url);
    if (entry) {
      siteTextures.delete(url);
      siteTextures.set(url, entry);
    } else {
      let resolve!: () => void, reject!: (reason: unknown) => void;
      const pending = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
      entry = { state: "queued", pending, resolve, reject };
      siteTextures.set(url, entry);
    }
    return entry.pending;
  };
  const pumpSiteTextures = () => {
    if (disposed) return;
    for (const [url, entry] of siteTextures) {
      if (activeLoads >= 2) break;
      if (entry.state !== "queued") continue;
      entry.state = "loading";
      activeLoads++;
      const failed = (error: unknown) => {
        activeLoads--;
        siteTextures.delete(url);
        if (entry.texture) retire(entry.texture);
        entry.texture = undefined;
        entry.reject(error);
        trimSiteTextures();
        pumpSiteTextures();
      };
      try {
        // TextureLoader has no abort API: keep in-flight loads deduplicated and
        // bounded, dropping obsolete queued destinations before starting more.
        entry.texture = new T.TextureLoader().load(url, loaded => {
          activeLoads--;
          if (disposed) { retire(loaded); return; }
          entry.state = "ready";
          entry.resolve();
          trimSiteTextures();
          pumpSiteTextures();
        }, undefined, failed);
        entry.texture.colorSpace = T.SRGBColorSpace;
        entry.texture.anisotropy = Math.min(8, maxAnisotropy);
      } catch (error) { failed(error); }
    }
  };
  let siteGeneration = 0;
  const prepareSite = async (latitude: number, longitude: number) => {
    if (disposed) return () => {};
    const generation = ++siteGeneration;
    const projected = latLonToProjected(latitude, longitude);
    const containing = (imagery?.patches ?? []).filter(patch => {
      const uv = imageUv(patch, projected.x, projected.y);
      return uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1;
    }).sort((a, b) => a.stepM - b.stepM);
    const detail = containing[0], regional = containing.find(p => p !== detail);
    preparingUrls = new Set([detail?.url, regional?.url].filter((url): url is string => url !== undefined));
    for (const [url, entry] of siteTextures) {
      if (entry.state !== "queued" || preparingUrls.has(url)) continue;
      siteTextures.delete(url);
      entry.reject(new DOMException("Superseded", "AbortError"));
    }
    const pending = Promise.all([detail ? siteTexture(detail.url) : null, regional ? siteTexture(regional.url) : null]);
    trimSiteTextures();
    pumpSiteTextures();
    try { await pending; }
    catch (error) {
      if (disposed || generation !== siteGeneration) return () => {};
      preparingUrls.clear();
      trimSiteTextures();
      throw error;
    }
    let applied = false;
    return () => {
      if (disposed || generation !== siteGeneration || applied) return;
      applied = true;
      const detailTexture = detail ? siteTextures.get(detail.url)?.texture : undefined;
      const regionalTexture = regional ? siteTextures.get(regional.url)?.texture : undefined;
      uniforms.hasDetail.value = detailTexture ? 1 : 0; uniforms.hasRegional.value = regionalTexture ? 1 : 0;
      // The shader samples both slots even when their flags are zero.
      uniforms.detailImage.value = detailTexture ?? blank;
      uniforms.regionalImage.value = regionalTexture ?? blank;
      if (detail && detailTexture) uniforms.detailBoundsM.value.copy(bounds(detail));
      if (regional && regionalTexture) uniforms.regionalBoundsM.value.copy(bounds(regional));
      preparingUrls.clear();
      trimSiteTextures();
    };
  };
  if (imagery) {
    const atlas = acquireMoonAtlas(imagery.global.url, maxAnisotropy);
    releaseAtlas = atlas.release;
    void atlas.ready.then(texture => { if (!disposed) { uniforms.globalImage.value = texture; uniforms.hasGlobal.value = 1; } }).catch(() => { if (!disposed) onFailure(); });
    load(imagery.overview.url, "polarImage", "hasPolar");
    uniforms.polarBoundsM.value.copy(bounds(imagery.overview));
    void prepareSite(latDeg, lonDeg).then(apply => apply()).catch(() => { if (!disposed) onFailure(); });
  } else {
    // Existing bundled hillshade is a fallback visual with historical lighting.
    load(map.url, "polarImage", "hasPolar");
    uniforms.polarBoundsM.value.set(map.tieX + map.centerOffset * map.scaleM,
      map.tieY - map.centerOffset * map.scaleM, map.width * map.scaleM, map.height * map.scaleM);
  }
  const material = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
      attribute vec3 bodyDirection;
      attribute float demCoverage;
      varying vec3 vBodyDirection;
      varying float vDemCoverage;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vBodyDirection = bodyDirection;
        vDemCoverage = demCoverage;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      uniform float atlasAppearance;
      uniform sampler2D globalImage, polarImage, regionalImage, detailImage;
      uniform float hasGlobal, hasPolar, hasRegional, hasDetail;
      uniform vec4 polarBoundsM, regionalBoundsM, detailBoundsM;
      varying vec3 vBodyDirection;
      varying float vDemCoverage;
      vec2 projectedUv(vec2 xyM, vec4 boundsM) {
        return vec2((xyM.x-boundsM.x)/max(1.0,boundsM.z), 1.0-(boundsM.y-xyM.y)/max(1.0,boundsM.w));
      }
      float edgeFade(vec2 uv) {
        return smoothstep(0.0, 0.035, min(min(uv.x, uv.y), min(1.0-uv.x, 1.0-uv.y)));
      }`)
      .replace("#include <map_fragment>", `
        vec3 body = normalize(vBodyDirection);
        float longitude = atan(body.y, body.x);
        float latitude = atan(body.z, length(body.xy));
        vec2 globalUv = vec2(longitude / (2.0 * PI) + 0.5, latitude / PI + 0.5);
        vec3 regolith = mix(vec3(0.48), texture2D(globalImage, globalUv).rgb, hasGlobal);
        vec2 xyM = ${POLAR_BODY_GLSL};
        vec2 polarUv = projectedUv(xyM, polarBoundsM);
        vec2 detailUv = projectedUv(xyM, detailBoundsM);
        vec2 regionalUv = projectedUv(xyM, regionalBoundsM);
        regolith = mix(regolith, texture2D(polarImage, clamp(polarUv, 0.0, 1.0)).rgb, hasPolar * edgeFade(polarUv));
        regolith = mix(regolith, texture2D(regionalImage, clamp(regionalUv, 0.0, 1.0)).rgb, hasRegional * edgeFade(regionalUv));
        regolith = mix(regolith, texture2D(detailImage, clamp(detailUv, 0.0, 1.0)).rgb, hasDetail * edgeFade(detailUv));
        // Source RGB is decoded to linear light before the shared luminance policy.
        regolith = vec3(dot(regolith, ${LUNAR_LINEAR_LUMINANCE_GLSL}));
        diffuseColor.rgb *= regolith;
      `).replace("#include <opaque_fragment>", "if (atlasAppearance > 0.5) outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>");
  };
  material.toneMapped = false;
  return { material, prepareSite, setAtlasAppearance(enabled:boolean) { uniforms.atlasAppearance.value=enabled?1:0; if(material.toneMapped===enabled){material.toneMapped=!enabled;material.needsUpdate=true;} }, dispose() {
    if (disposed) return;
    disposed = true;
    preparingUrls.clear();
    for (const entry of siteTextures.values()) {
      if (entry.texture) retire(entry.texture);
      entry.texture = undefined;
      if (entry.state !== "ready") entry.reject(new DOMException("Disposed", "AbortError"));
    }
    siteTextures.clear();
    for (const slot of [uniforms.globalImage, uniforms.polarImage, uniforms.detailImage, uniforms.regionalImage]) slot.value = blank;
    textures.forEach(retire);
    releaseAtlas?.();
    material.dispose();
  } };
}
