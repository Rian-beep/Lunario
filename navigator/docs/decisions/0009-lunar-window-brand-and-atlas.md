# Lunar Window identity and shared Moon atlas

User direction, 14 November 2026: adopt upstream Lunar Window branding and a dark interface while preserving icons and placement. Upstream main d7273fb uses Lunar Window and a plain precomputed-demonstration loading state. No standalone logo/splash asset was found. The new loader reflects real initialization, without a synthetic percentage or delay.

Public labels and exported titles adopt Lunar Window. Existing SolarReach persistence keys, data IDs, decision schemas, downloaded file compatibility, repository history and provenance remain unchanged. The dark theme changes UI surfaces, never NASA image pixels or physical inputs. The orange framed reference informs structural edges; its stock image/watermark is not bundled.

Global terrain and globe share the original NASA 8K atlas. A small reference-counted texture lease prevents a second 128 MiB RGBA allocation for the same atlas in one renderer; each owner releases independently. It does not introduce a persistent browser cache. Offline code aliases the existing embedded data URL rather than duplicating it. Finest available polar surface patches remain independently bounded. Arbitrary custom points do not acquire fictitious metre-scale imagery.

Consequences: old saved work continues to open; global source appearance is consistent; close-up quality still depends on actual NASA coverage. Qualification of terrain/contact and mission feasibility stays separate from rendered detail. Verify web and offline, load failure/retry, ownership/disposal, native math, reduced motion, contrast and physical lander framing before release.
