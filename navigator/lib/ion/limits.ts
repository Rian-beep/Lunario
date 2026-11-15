import { DownloadPriorityQueue, LRUCache, PriorityQueue } from "3d-tiles-renderer/core";
import type { TilesRenderer } from "3d-tiles-renderer";

export const ION_TILE_LIMITS = Object.freeze({ downloads: 4, parses: 1, tiles: 300, bytes: 128 * 1024 * 1024, errorTarget: 2 });

export function configureIonLimits(tiles: TilesRenderer, onFailure: () => void): void {
  const downloads = new DownloadPriorityQueue();
  downloads.maxJobsPerOrigin = ION_TILE_LIMITS.downloads;
  downloads.priorityCallback = tiles.downloadQueue.priorityCallback;
  // One queue origin gives a total limit of four, even if content spans hosts.
  const add = downloads.add.bind(downloads);
  downloads.add = (_url, item, callback, signal) => add(null, item, callback, signal);
  const parses = new PriorityQueue();
  parses.maxJobs = ION_TILE_LIMITS.parses;
  parses.priorityCallback = tiles.parseQueue.priorityCallback;
  const nodes = new PriorityQueue();
  nodes.maxJobs = 1;
  nodes.priorityCallback = tiles.processNodeQueue.priorityCallback;
  // 0.5.4 ignores the promise returned by deferred node jobs. Draining those
  // jobs must not leave unhandled AbortError rejections during teardown.
  const addNode = nodes.add.bind(nodes);
  nodes.add = (item, callback) => {
    const pending = addNode(item, callback);
    void pending.catch(error => { if (!(error instanceof DOMException && error.name === "AbortError")) onFailure(); });
    return pending;
  };
  const cache = new LRUCache();
  cache.minSize = 240;
  cache.maxSize = ION_TILE_LIMITS.tiles;
  cache.minBytesSize = 96 * 1024 * 1024;
  cache.maxBytesSize = ION_TILE_LIMITS.bytes;
  cache.unloadPriorityCallback = tiles.lruCache.unloadPriorityCallback;
  tiles.downloadQueue = downloads;
  tiles.parseQueue = parses;
  tiles.processNodeQueue = nodes;
  tiles.lruCache = cache;
  tiles.errorTarget = ION_TILE_LIMITS.errorTarget;
  // Refine the camera footprint and its neighbours, retaining ancestor fallback.
  // No region/depth override or whole-Moon prefetch is installed.
  tiles.loadSiblings = true;
  tiles.loadAncestors = true;
  tiles.accelerateRaycast = true;
  tiles.maxTilesProcessed = 100;
}
