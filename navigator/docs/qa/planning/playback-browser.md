# Environmental playback browser verification

The dedicated verifier runs against an integrator-built preview or standalone file:

```
node scripts/verify-playback-flows.mjs --base-url http://127.0.0.1:4317 --output /tmp/solarreach-playback-http
node scripts/verify-playback-flows.mjs --file /absolute/path/solarreach-navigator.html --offline --output /tmp/solarreach-playback-offline
```

It uses installed playwright-core and a new headless Chrome process with isolated contexts. It does not start/build a server, attach to a user profile, install dependencies, alter OS settings or change application source. Output contains report.json and per-check screenshots.

Each ordinary 6 h/s and 24 h/s run returns the Mission time slider to the same start of the default 336-hour hourly stay. It records actual browser performance.now timestamps at the UI Play/Pause events, slider aria-valuenow, displayed UTC and SVG mission cursor x coordinates. Expected progress is selected rate times measured real elapsed seconds; nominal waits only choose the observation window. A bounded tolerance accommodates one-hour slider quantization and render publication latency. Both measured rates and both resource-cursor velocities must have a 24/6 ratio within 15% of four. A held graph hover must not freeze the canonical cursor.

Further checks cover continuous piecewise rate changes, graph click selecting an epoch and pausing playback, mission-input edits not starting playback, elevation and horizon body markers following the same clock, and compact event-card output. A CPU-throttled context with two bounded 350 ms main-thread stalls tests elapsed-time anchoring rather than a capped frame increment; its observed RAF gaps are recorded and must establish a real stall. This is a regression fixture, not a device-performance claim. A fresh reduced-motion context verifies actual elapsed rate and approximately 1 Hz publication behavior independently; reduced motion must not lower the physical playback rate.

Flight playback has its own units and controls and is outside this environmental UI verifier. Screen-reader interpretation, every speed/end-boundary combination, all source datasets and a general accessibility/conformance claim are also outside these checks.

Execution on the rebuilt playback preview and immutable standalone snapshot passed all 10 checks on each target. HTTP evidence: `/tmp/solarreach-playback-http-verified/report.json`; offline evidence: `/tmp/solarreach-playback-offline/report.json` (target `/tmp/solarreach-extended-preview.html`). Both recorded zero page/HTTP errors; the offline run made zero HTTP requests.

HTTP measured 5.97984 h/s at the 6 h/s setting (11.3922 h over 1.9051 s) and 23.94666 h/s at the 24 h/s setting (45.2520 h over 1.8897 s). The normalized rate ratio was 4.00456; both resource cursor ratios matched it. Offline ratio was 4.00036 for rate and both cursors. CPU-stall RAF gaps were actually measured at 350 ms (HTTP) and 350.1 ms (offline), while elapsed progress still met the anchored-rate checks. Reduced-motion runs measured 23.94650 h/s and 23.94588 h/s, with their publication intervals checked separately.

The initial browser fixture exposed a Base UI detail: Mission time names the group, while its native range input has implicit slider role and explicit aria-valuenow but native min/max attributes. The verifier now reads that actual DOM control, using the named group for keyboard targeting. An unnamed slider itself was reported to the integrator for explicit label wiring; this timing verification does not claim that later label change was retested. Earlier locator failures are not counted as clock failures or passes.

Captured screenshots include the resource plots, analysis cursor/markers, graph selection, paused form changes and compact Public event cards. The two scopes remain distinct: passing elapsed-rate/cursor assertions does not establish all chart or screen-reader accessibility behavior.
