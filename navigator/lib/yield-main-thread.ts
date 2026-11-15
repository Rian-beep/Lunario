/** Yield bounded preparation work without putting every continuation behind the
 * timer queue. Slow software rendering can starve nested zero-delay timers.
 * These are real tasks: input, cancellation and painting can still run between
 * the existing CPU slices. No simulation step or numerical budget changes.
 */
export function yieldMainThread(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & {scheduler?: {yield?: () => Promise<void>}}).scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();
  if (typeof window !== 'undefined' && typeof MessageChannel !== 'undefined') {
    return new Promise<void>(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close(); channel.port2.close(); resolve();
      };
      channel.port2.postMessage(null);
    });
  }
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

/** Older browsers lack boosted scheduler continuations. Avoid posting dozens of
 * sub-millisecond fixed-batch tasks behind expensive paints: share up to 8 ms of
 * CPU work before the next message task. The first call always yields. Node and
 * browsers with scheduler.yield retain their existing per-call task boundaries.
 */
export function createPreparationYield(): () => Promise<void> {
  let resumedAt = -Infinity;
  return async () => {
    const scheduler = (globalThis as typeof globalThis & {scheduler?: {yield?: () => Promise<void>}}).scheduler;
    if (typeof window === 'undefined' || typeof scheduler?.yield === 'function' || performance.now() - resumedAt >= 8) {
      await yieldMainThread();
      resumedAt = performance.now();
    }
  };
}
