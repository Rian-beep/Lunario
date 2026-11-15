# FR01 resolution

The review reproduced an important inherited gap: the station CSPICE reference could drift without invalidating publication. The reference itself, the observer fixtures, resource reference inputs, comparison programs, and their local numerical/default/provenance imports are now bound. The same review also checked adjacent retained primary-source files; those checked archives and the coarse numerical terrain/ice inputs are included in the reviewed dependency boundary. Visual-only assets remain separate.

The binding set expanded from 73 to 151 explicit identities. Existing hashes and numerical values were not restamped or changed. The current 288 resource comparisons and 75-station reference check were rerun successfully. A regression mutates the station azimuth reference by 10 degrees and proves publication refuses it before replacing output. It additionally checks resource-reference drift, comparison-code drift, default-policy dependency drift and numerical global-terrain metadata drift. The original stale-input and rebound-failed-outcome checks remain intact.

Focused result: 296 tests pass; scientific publication remains 42 verified bounded claims / 22 uncertain / 0 failing recorded comparisons. This closes input-integrity coverage at the stated boundary; it does not authenticate external forecasts, establish physical errors or qualify a mission. Independent review confirmation is recorded separately before merge.

## Adjacent producer dependency

The independent follow-up confirmed FR01 closed and identified the older terrain codec as an additional unbound producer dependency. That codec, the JavaScript dependency lock and scientific Python requirement pins are now bound too (155 identities). A 0.1-to-1000 quantization-scale mutation and dependency-lock drift both reject publication. No terrain generator, source elevation or numeric output was changed. The boundary concerns the stated checked inputs/code; it cannot certify arbitrary runtime environments or external provider authenticity.
