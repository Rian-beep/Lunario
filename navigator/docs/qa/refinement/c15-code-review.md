# C15 bounded chart and contact review

15 November 2026, Clevo isolated QA. Reviewed immutable source
`f7ecd636f36955509e6e24f54c1fe85df2a25ab2` in the read-only
`refine-c15-final-check` checkout against C14
`b2a5925848bc710c25e4d2ba42dc015df286014a`. No application changes.

**No new actionable code finding in the reviewed scope.** This is an independent
bounded review, not human, operational, scientific qualification or release acceptance.

## Inspection, clock and unknown handling

- `science-charts.tsx:145`: a controlled Plot prefers explicit selected sample
  after hover, while the supplied cursor remains the simulation clock. Keyboard
  Home/End and sample buttons use the existing sorted finite source coordinates;
  this makes the real final stored-energy boundary inspectable.
- `science-charts.tsx:197`: blur clears selection and hover only when focus
  leaves the controlled figure. Movement between its SVG, buttons and help keeps
  the selected sample. Uncontrolled horizon inspection retains its prior behavior.
- `navigator.tsx:1150`: resource callbacks stop playback and clamp the raw
  playhead to the configured start/end indices. The end-exclusive integration
  boundary therefore cannot advance the Sun/Earth environmental pose beyond
  its supported final sample.
- `science-charts.tsx:373`: the dashed line uses the supplied simulation cursor
  for both UTC resources and elapsed-seconds flight plots. Sample readouts and
  gradients continue to describe the inspected point, independently of that line.
- Help at lines 457/914 explains both meanings and the final-energy boundary.
  No final Sun/Earth pose, stored-energy value or mission measurement is invented.
  Existing finite filtering, domain clamping, `nearestSample`, `Unknown` readouts,
  empty-series behavior and gradient rejection remain unchanged. No new fallback
  converts missing model data into a successful mission result.

The F11 source commit changes only Navigator, science charts, the battery-boundary
note and the viewport regression. The C14 script-default/report additions between
candidate commits are QA history, not mission changes. The C14 8 px axis gap
remains in `app/globals.css`; C13 native HUD changes predate this diff. No style,
physics or asset override was introduced by this QA lane.

The added real-browser regression checks End, disabled Next, native/ARIA clock
maximum and blur restoration. Root reports C14 RED / C15 GREEN; the named Root
battery logs are not present on this Clevo host, so that differential execution
is attributed to Root, not claimed as an independently rerun browser case here.
The separate visual lane owns fresh full graph, native zoom and responsive proof.

## Actual blob identity and historical scope

Compared actual `git show` bytes at C13
`a93e252f2c9e46395c3644d822a94cf62f30f95d` and C15, then compared C15
working files to those blobs. All **165** checked files match byte for byte:
all tracked `lib/`, `pipeline/`, `public/data/` (55 files), the scene directory
and `scene.tsx`. The penetration regression also matches separately. Source
checkout status was clean before checks. Full Git blob IDs and SHA-256 values
are in `/tmp/refinement-framing-c15-contact/source-identity-before.json`.

| File | Unchanged SHA-256 |
| --- | --- |
| `lib/flight.ts` | `0383c58cad24f5fe7315a75300af31a69db4a97603d82b3a8352cd68ccd63967` |
| `lib/touchdown-physics.ts` | `1fa7810f654676a7a0d2a3cd0ca8c1ee543cf99ff4e9c2b176edd128741caad8` |
| `scene/runtime.ts` | `4292f66e7b7a73f3e9de5631867686d4bb7700cb4f3f066b7f5be5162aac0fdd` |
| `scene/contact-dynamics.ts` | `48d34f0279487a6debd9b0f08a48842fd5b985fe254bbb033154edb048ef398f` |
| Original NASA LM GLB | `379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e` |
| Terrain input | `be7f59a95901f36cda1050538ea75fb1ce51e8b9cf5aebb532073086c0f70c32` |

`evaluateScenario`, mission/resources, astro, planning-model identity `planning-4`,
physical proxies, numerical terrain, original physical assets and all science
inputs are unchanged. No fresh Horizons or build run is claimed by this lane.

C13 full six-case contact evidence, including its four HTTP/file breakup/bounce
cases, remains **C13 evidence carried forward by identical engine/data blobs**.
It is not a C15 rerun. Preserve C13's prominent unresolved parent-tool **143**
after final PASS; it never becomes a normal exit 0. C10 F8, C12 F9, C13 F10 and
C14 F11 RED history remains historical RED. New C15 contact execution is nominal
only; its outcome and process status are recorded in `final-contact.md`.


## Fresh verification outcome

C15 source tests **763/763**, nonincremental typecheck, lint and **314-expression**
math drift check all exited 0. The same source HEAD, clean tracked state and all
165 actual blob/file identities were verified again after execution.

Frozen nominal-only C15 HTTP→disconnected-file contact check: **13/13 scoped
assertions PASS**, normal Node return **0**, enclosing tool return **0**;
173 consecutive completed render frames / 26 contact frames and 18 actual
raster measurements passed. No new contact/contrast blocker was found.
The frozen nominal branch omits canvas orbit/wheel gestures; those remain
explicit C13 carry-forward evidence, not fresh C15 proof. See the appended C15
section in [final-contact.md](final-contact.md) for identities, numeric results,
process capture, historical integrity and all acceptance limits.
