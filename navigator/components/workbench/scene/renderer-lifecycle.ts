/** Release the browser's finite WebGL context budget on intentional unmount. */
export function releaseRenderer(renderer: {forceContextLoss(): void; dispose(): void}, detachListeners?: () => void) {
  detachListeners?.();
  try { renderer.forceContextLoss(); } finally { renderer.dispose(); }
}
