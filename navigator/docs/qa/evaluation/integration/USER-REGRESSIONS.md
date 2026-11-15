# User-reported regressions during final evaluation

## Dark Data & math readability

The science framework used `--mission-ink` for reading text. Dark mode intentionally keeps that token almost black for outlines and orange title strips, so body copy and the Hide framework control became almost invisible on dark cards.

The component now uses semantic foreground/card colors for reading surfaces and controls, keeps dark ink on its orange header, and uses paired secondary/foreground colors on expanded disclosures. Icon placement and authored Moon imagery are unchanged.

`tests/science-framework/contrast.test.ts` checks computed foreground and actual ancestor backgrounds for visible headings, body text, variables, links, native math, disclosure summaries and buttons in all three audiences and both themes. Every checked normal-text pair must reach 4.5:1. A counterfactual old ink-on-dark style reproduces the reported defect. This is computed-color coverage for this component, not a whole-platform accessibility certification.

Focused result: eight science framework tests pass, including the browser contrast regression. Final generated web/offline acceptance is recorded separately.

## Unexpected camera switching

User screenshot shows Lander selected while the camera displays the whole Moon. The actual runtime reproduced a plain canvas click canceling Lander travel while the camera remained 4,114 km away. It then reported a subpixel vehicle as framed. The repair distinguishes clicks from real drags, resumes the still-selected destination after an interrupted drag, rejects stale site-mode callbacks, and avoids restarting focus from clicks on an already focused vehicle. Held or subpixel views cannot release pending flight playback. Physical spacecraft scale and flight clock are unchanged.

The isolated production-runtime verification passed ten browser groups and 123 focused tests, with nonincremental types and owned lint passing. It covers pending travel, drag/wheel interruption, rapid retargeting, portal controls, site changes, Follow/scrubbing/variable edits, source clock and bounded warmed renderer resources. Final generated web/offline acceptance is recorded separately. Touch emulation and real-device acceptance remain distinct.
