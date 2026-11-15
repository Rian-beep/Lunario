# Wall-clock anchored playback

`createPlaybackClock({startPosition,endPosition,startWallMs,ratePerSecond,reducedMotion?})` returns:

- `sample(nowWallMs): {position,complete}` for display publication.
- `positionAt(nowWallMs): number` for the exact, unquantized logical position used when reanchoring after speed changes or other playback controls.

Position units are generic. Environmental playback advances catalog sample positions: use `environmentPlaybackRate(hoursPerSecond,catalogStepHours)`. At 0.5 h per sample, 6 h/s means12 positions/s and24 h/s means48 positions/s. Flight playback advances seconds and uses seconds-per-wall-second directly. The library changes no astronomy or energy formulas.

Each clock captures its anchor once. Ordinary position is startPosition + elapsed wall seconds × rate, clamped at the supplied endpoint. There is no incremental delta accumulator and no0.1s frame-time cap. A1.4s stalled frame advances the full1.4s worth of simulation. Sixty frames per second, one frame per second and a delayed next frame produce the same logical result for the same wall timestamp. Background throttling therefore does not secretly slow playback; a caller wanting hidden-tab pause must explicitly pause/reanchor.

Reduced motion publishes only whole1s steps measured from the fixed anchor. Subsecond elapsed time remains part of that anchor, so later frames do not lose the fraction. Completion uses the exact logical position and snaps to the endpoint even if the final interval is shorter than1s. On a rate change, obtain the old clock’s `positionAt(now)` and create a new clock anchored at that position and the same now. This preserves logical time instead of reanchoring at the last quantized display sample. User-initiated rate changes may reveal that pending fraction immediately.

Do not re-create/reanchor the clock after each render or position publication. Reanchor when starting/resuming, changing rate, seeking or replacing bounds. Pause by stopping the caller’s frame loop. Zero/negative rates, reversed ranges, nonfinite inputs and unsupported numeric overflow fail with readable errors. A wall timestamp before the anchor clamps to the start. Sampling an already complete clock keeps the exact endpoint and complete=true. Anchors are copied into the closure; mutating the caller’s input object cannot change the clock.

The parent owns navigator integration and resource-graph cursor wiring. Graph cursor/onCursor must remain controlled by the same published playhead; this module alone does not establish that a chart cursor or DOM playback control works. No navigation, chart, runtime, schema or science source is changed here.

Eight tests check the6h/s versus24h/s fourfold relation over equal wall time; half-hour catalog conversion;60Hz versus1Hz/stalled-frame equivalence; rate-change continuity; reduced-motion fractions and1s publication; exact endpoints including fractional final intervals; invalid/before-anchor inputs; and anchor immutability.

Fresh validation: eight tests passed locally and on isolated Clevo remote Node using existing dependencies. Strict targeted TypeScript checking of the module/test passed. Full project `tsc --noEmit` was also run: the current committed base f37c25b lacks the parent’s still-uncommitted global-context adapter exports/types referenced by its tracked integration test. The exact archived f37c25b baseline produced byte-identical diagnostics to this clock worktree. Parent integration must include those adapters before claiming a clean full project check. No graph/browser behavior is claimed from these pure tests.
