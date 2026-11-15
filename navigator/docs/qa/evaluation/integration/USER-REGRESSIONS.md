# User-reported regressions during final evaluation

## Dark Data & math readability

The science framework used `--mission-ink` for reading text. Dark mode intentionally keeps that token almost black for outlines and orange title strips, so body copy and the Hide framework control became almost invisible on dark cards.

The component now uses semantic foreground/card colors for reading surfaces and controls, keeps dark ink on its orange header, and uses paired secondary/foreground colors on expanded disclosures. Icon placement and authored Moon imagery are unchanged.

`tests/science-framework/contrast.test.ts` checks computed foreground and actual ancestor backgrounds for visible headings, body text, variables, links, native math, disclosure summaries and buttons in all three audiences and both themes. Every checked normal-text pair must reach 4.5:1. A counterfactual old ink-on-dark style reproduces the reported defect. This is computed-color coverage for this component, not a whole-platform accessibility certification.

Focused result: eight science framework tests pass, including the browser contrast regression. Final generated web/offline acceptance is recorded separately.

## Unexpected camera switching

User screenshot shows Lander selected while the camera displays the whole Moon. A dedicated isolated Clevo camera workstream is tracing interruption and focus state against the actual runtime. No pass is asserted before its fix and integrated browser replay.
