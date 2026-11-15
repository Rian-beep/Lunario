# Preserve the science path and offline workbench

Status: accepted design direction, 14 November 2026.

The supplied SolarReach prototype already has useful Horizons-derived directions and LOLA horizon masks. Replacing that analysis during a visual redesign would introduce an unnecessary second source of scientific truth. Keep `lib/astro.ts` and consume its samples in separate resource/flight models. Fresh observer-table checks validate the decoded browser catalog, rather than reusing historical pipeline assertions.

Use Three.js for a true depth-tested scene and explicitly prepared numerical terrain; do not derive heights from image brightness. Different source resolutions remain visible. The flight model is a documented short-flight 3-DoF preview, not a hidden promise of operational guidance.

Optional supported NASA image services improve online context; bundled source data and renderer preserve the offline file. Reference/educational portals remain identified as such rather than being described as invented APIs.

The user rejected the dark-blue treatment and tiny floating terrain. The current redesign follows warm, clear desktop materials and requires a broad coherent lunar environment with meaningful camera/vehicle scale. It must be visually checked after integrating parallel refinement work.
