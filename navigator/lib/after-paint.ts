export type PaintScheduler = {
  frame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  task: (callback: () => void) => ReturnType<typeof setTimeout>;
  cancelTask: (id: ReturnType<typeof setTimeout>) => void;
};
/** Let an interaction paint before expensive WebGL setup. Never run stale mounts. */
export function afterPaint(callback: () => void, scheduler: PaintScheduler = {
  frame: fn => requestAnimationFrame(fn), cancelFrame: id => cancelAnimationFrame(id),
  task: fn => setTimeout(fn, 0), cancelTask: id => clearTimeout(id),
}): () => boolean {
  let pending = true;
  let task: ReturnType<typeof setTimeout> | undefined;
  const frame = scheduler.frame(() => {
    if (pending) task = scheduler.task(() => {if (pending) {pending = false; callback();}});
  });
  return () => {
    if (!pending) return false;
    pending = false;
    scheduler.cancelFrame(frame);
    if (task !== undefined) scheduler.cancelTask(task);
    return true;
  };
}
