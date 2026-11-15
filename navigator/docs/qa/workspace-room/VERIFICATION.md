# Workspace room and docked Planner variables

15 November 2026. Extends Rian Lunario main `ad2052f67db54d44f2897f9ec9ddd381f1045bd0`. Hosting and original branding assets are unchanged.

## Delivered interaction

- The wide audience task strip is now a collapsed Mission context & next steps disclosure in the right inspector. It remains available, including its actions and explicit dismiss/restore behavior, without taking header/canvas height.
- Desktop inspectors use available workspace height (12 px top/bottom margins) in normal and widened states. A desktop grid reserves real canvas space for the inspector; the scene is resized instead of being covered by it. Narrow-screen docking retains its existing separate HUD/canvas layout.
- Compare is an independently docked side control. On short/narrow windows it uses the compact control row rather than covering the location card or flight HUD. Its bounds participate in scene occlusion tracking and viewport collision tests.
- Earth ground-station choices are inside one Ground stations disclosure. The existing three station buttons, pin selection, weather data and source/communication descriptions remain reachable. The measured desktop Earth toolbar is 51 px high at1600×1000.
- Planner’s Learn control becomes Var, opening a docked reference with native formulae, expandable symbol/behavior explanations and assumptions/sources. Its initial discipline follows Moon (Sun geometry), Earth (communications) or lander (powered descent) focus. All seven disciplines remain selectable. It never changes mission/flight inputs. Public and Educator retain Learn.
- Panel edges use subtle shadows and thinner borders, with quieter toolbar/tab/disclosure surfaces. Both existing palettes, icons, original loader and imagery are retained. A first visual pass found the old dark disclosure rule overriding the quieter surface colour; the final browser asserts rendered disclosure contrast >=4.5:1.

## Verification

The actual-browser workspace verifier covers production HTTP and a disconnected file: visible first-use Public Play, no wide header banner, Planner Var and contextual topic selection, rendered MathML, full-height normal/wide bounds, canvas edge clear of the inspector, grouped station interaction, light/dark screenshots and contrast, and side Compare clear of HUD/inspector. Comparison opens and explicitly closes. File mode sends zero HTTP requests. See browser.json and scripts/verify-workspace-space.mjs.

The existing native viewport test now includes the independently docked Compare rectangle in all bounds and pairwise collision assertions. It ignores zero-sized hidden toolbar rectangles. The obsolete requirement to align the inspector bottom with the old combined bottom toolbar is replaced with an assertion that the new Compare control is actually included; physical vehicle visibility/scale, visible area, viewport bounds, HUD metric separation, scene/canvas identity, 12 HUD/location states and science-axis focus gates are retained.

Earlier checkpoint: 797/797 source tests and all8 native viewport checks passed before the final desktop-only grid refinement. The final web/file workspace journey also passes with the grid. Final artifact identity and fresh source/native receipts follow below.

No science formulas, assessment constraints, catalog data or renderer materials are changed. Native MathML retains 314 expressions, manifest SHA256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`. Physical/operational qualification and human/device acceptance remain open; this release is a workspace refinement.

## Final release receipt

Source `a9fa073`, offline commit `e3995ec`; production build `.next-room-docked`. HTML **81,169,598 bytes**, SHA256 **f75705f8e651552be500aaf4a9e6331f717970b9cb81489d7d293bb1defa4cfd**.

Fresh final checks: **797/797 source tests**, typecheck, ESLint, production build, standalone build, both actual-browser workspace journeys, and **8/8 native viewport tests** pass. Native200 checks use the final artifact, actual800×496/DPR2 Chrome zoom, all12 HTTP/file HUD/location states, all physical vehicle/scene identity gates, focused axes and inspector scrolling. See native-200.json. The final disconnected workspace browser sends zero HTTP requests.

The full loader/theme/history/three-station/weather verifier also passed web and offline against the preceding UI candidate (before the final desktop-only canvas grid); final workspace journeys verify both palettes, original startup/onboarding, station selection, Var and docking against the release above. Existing scanner findings were reviewed; this change adds no new swallowed errors or placeholder handlers. This does not replace actual-device or human-learning acceptance.
