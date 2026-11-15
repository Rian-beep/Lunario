import {ionHttpStatus,type IonFailure} from "@/lib/ion/diagnostics";
import { TilesRenderer } from "3d-tiles-renderer";
import type { Tile, Tileset } from "3d-tiles-renderer/core";
import { CesiumIonAuthPlugin } from "3d-tiles-renderer/plugins";
import { BufferGeometry, Material, Mesh, Object3D } from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { ION_MOON_ASSET_ID } from "../../../../lib/ion/config";

// 0.5.4 implements these hooks but omits them from its .d.ts files. Keep the
// exact, source-verified signatures here rather than weakening the public API.
type RuntimeHooks = {
  loadRootTileset(): Promise<Tileset>;
  preprocessTileset(json: Tileset, url: string, parent?: Tile | null): void;
  parseTile(buffer: ArrayBuffer, tile: Tile, extension: string, url: string, signal: AbortSignal): Promise<void>;
};
const hooks = TilesRenderer.prototype as typeof TilesRenderer.prototype & RuntimeHooks;
const cancelled = () => new DOMException("Moon tile request stopped.", "AbortError");

/** Prevent upstream diagnostics from logging provider URLs or unsanitized errors. */
export class IonTilesRenderer extends TilesRenderer {
  private parsingScenes = new Map<Tile, Object3D>();
  private parsing = 0;
  private released = false;

  constructor(private fail: (failure?:IonFailure) => void) {
    super();
    this.registerCleanup();
  }

  private registerCleanup() {
    this.registerPlugin({
      name: "ION_STALE_MODEL_CLEANUP",
      processTileModel: (scene: Object3D, tile: Tile) => { this.parsingScenes.set(tile, scene); },
    });
  }

  async loadRootTileset(): Promise<Tileset> {
    try { return await hooks.loadRootTileset.call(this); }
    catch (error) { this.fail({stage:"manifest",status:ionHttpStatus(error)}); throw cancelled(); }
  }

  preprocessTileset(json: Tileset, url: string, parent: Tile | null = null): void {
    try { hooks.preprocessTileset.call(this, json, url, parent); }
    catch (error) { this.fail({stage:"manifest",status:ionHttpStatus(error)}); throw cancelled(); }
  }

  async parseTile(buffer: ArrayBuffer, tile: Tile, extension: string, url: string, signal: AbortSignal): Promise<void> {
    if (this.released || signal.aborted) throw cancelled();
    this.parsing++;
    try { await hooks.parseTile.call(this, buffer, tile, extension, url, signal); }
    catch (error) { if (!signal.aborted) this.fail({stage:"mesh-decode",status:ionHttpStatus(error)}); throw cancelled(); }
    finally {
      const scene = this.parsingScenes.get(tile);
      this.parsingScenes.delete(tile);
      if (signal.aborted && scene) {
        // Upstream closes/disposes late textures, but misses geometry/materials
        // on its aborted-parse branch. They never reached the normal tile cache.
        const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
        scene.traverse(object => {
          if (object instanceof Mesh) {
            geometries.add(object.geometry);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
          }
        });
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
      }
      this.parsing--;
      if (this.released && !this.parsing) this.unregisterPlugin("ION_STALE_MODEL_CLEANUP");
    }
  }

  dispose(): void {
    if (this.released) return;
    this.released = true;
    super.dispose();
    // The base removes plugins before an in-progress loader has finished. Keep
    // just the resource capture hook until those obsolete results settle.
    if (this.parsing) this.registerCleanup();
  }
}

const dracoHooks = DRACOLoader.prototype as typeof DRACOLoader.prototype & { _initDecoder(): Promise<void> };

export class AbortableDracoLoader extends DRACOLoader {
  declare decoderConfig: { type: "js" };

  constructor(url: string, private signal: AbortSignal) {
    super();
    this.setDecoderPath(url).setWorkerLimit(1);
    // r187's deprecated setter only assigns this field and emits a warning.
    this.decoderConfig = { type: "js" };
  }

  async _loadLibrary(url: string, responseType: string): Promise<string | ArrayBuffer> {
    this.signal.throwIfAborted();
    const response = await fetch(url, { signal: this.signal });
    if (!response.ok) throw cancelled();
    const result = await (responseType === "text" ? response.text() : response.arrayBuffer());
    this.signal.throwIfAborted();
    return result;
  }

  async _initDecoder(): Promise<void> {
    this.signal.throwIfAborted();
    await dracoHooks._initDecoder.call(this);
    if (this.signal.aborted) { this.dispose(); throw cancelled(); }
  }
}

export class AbortableIonAuthPlugin extends CesiumIonAuthPlugin {
  declare auth: {
    apiToken: string;
    _bearerToken: string | null;
    refreshToken(options: RequestInit): Promise<object>;
    fetch(url: string, options: RequestInit): Promise<Response>;
  };
  declare tiles: IonTilesRenderer;
  declare _initializeFromAsset: (asset: object) => void;

  constructor(token: string, private signal: AbortSignal, private fail: (failure?:IonFailure) => void) {
    super({
      apiToken: token, assetId: ION_MOON_ASSET_ID,
      autoRefreshToken: false, useRecommendedSettings: false,
      assetTypeHandler: () => { throw new Error("Unsupported Moon tile asset type."); },
    });
  }

  async loadRootTileset(): Promise<Tileset | null> {
    let stage:IonFailure["stage"]="endpoint";
    try {
      this.signal.throwIfAborted();
      // Upstream calls refreshToken() without options, leaving its endpoint
      // request alive after dispose. Pass the lifetime signal explicitly.
      const asset = await this.auth.refreshToken({ signal: this.signal, cache: "no-store" });
      this.signal.throwIfAborted();
      if (!("type" in asset) || asset.type !== "3DTILES" || "externalType" in asset) throw cancelled();
      stage="manifest";
      this._initializeFromAsset(asset);
      const root = await this.tiles.loadRootTileset();
      this.signal.throwIfAborted();
      return root;
    } catch (error) {
      if (!this.signal.aborted) this.fail({stage,status:ionHttpStatus(error)});
      else this.auth._bearerToken = null;
      // The upstream root catch logs errors. Resolve an empty root after our
      // terminal failure instead; no raw URL/error reaches its diagnostics.
      return null;
    }
  }

  async fetchData(url: string, options: RequestInit = {}): Promise<ArrayBuffer | object> {
    const signal = options.signal ? AbortSignal.any([this.signal, options.signal]) : this.signal;
    try {
      signal.throwIfAborted();
      const response = await this.auth.fetch(url, { ...options, signal, cache: "no-store" });
      if (!response.ok) {this.fail({stage:"tile-fetch",status:response.status});throw cancelled();}
      const json = new URL(url).pathname.endsWith(".json") || response.headers.get("content-type")?.includes("json");
      const content = await (json ? response.json() : response.arrayBuffer());
      signal.throwIfAborted();
      return content;
    } catch (error) {
      if (!signal.aborted) this.fail({stage:"tile-fetch",status:ionHttpStatus(error)});
      throw cancelled();
    }
  }

  redactAttribution(value: string): string {
    for (const secret of [this.auth.apiToken, this.auth._bearerToken?.replace(/^Bearer /, "")])
      if (secret) value = value.split(secret).join("[redacted]");
    return value;
  }

  dispose(): void { this.auth.apiToken = ""; this.auth._bearerToken = null; }
}
