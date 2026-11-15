# Space Apps deep judging review — Lunario

Review date: 15 November 2026 (Europe/London). Five independent criterion deep-dives against the shared local/global rubric (1–5, equally weighted). Not official judge scores.

Official rubric: https://www.spaceappschallenge.org/resources/judging-awards-guide/#judging-criteria

## Executive verdict

| Criterion | Deep score | Prior shallow | Confidence | Change |
| --- | ---: | ---: | --- | --- |
| Impact | **4** | 4 | high | held |
| Creativity | **4** | 5 | high | revised down |
| Validity | **4** | 4 | high | held |
| Relevance | **5** | 5 | high | held |
| Presentation | **3** | 3 | medium | held (projected **5** if demo rehearsed + Pages Dashboard live) |
| **Average** | **4.0** | 4.2 | — | Creativity correction |

**Bottom line:** Competitive entry. Relevance is the lock. Presentation is the controllable swing — merge the live Dashboard embed ([PR #4](https://github.com/Rian-beep/Lunario/pull/4)), preload the ~81 MB bundle, rehearse one 90s spine.

---

## Impact — 4/5

**Verdict:** Real south-pole site×date power/comms problem with planner, educator, and public workflows that can change decisions in minutes — but helped users and adoption remain unproven.

**Supports 4:** CLPS/south-pole framing; Shackleton week example; first-class Replan; Public/Educator/Planner; tool-gap vs QuickMap/Moon Trek/Horizons; shippable offline workbench.

**Blocks 5:** No cold-user studies, classroom trials, or planner adoption evidence; preliminary screening ≠ operational authority; catalog/load friction.

**Raise before demo:** 3–5 cold sessions; one printable classroom pack dry-run; named mission + “under two minutes” timing claim.

**Pitch:** “When a lunar south-pole launch slips a week, power and Earth contact can collapse—Lunario lets planners, teachers, and the public compare real horizon Sun/Earth windows side by side and replan in minutes, not a QuickMap-and-Horizons scavenger hunt.”

---

## Creativity — 4/5 (was 5)

**Verdict:** Highly inventive *integration and epistemic product design* — not a groundbreaking never-attempted concept. Prior 5 overclaimed.

**Novel (ranked):** evidence-state mission authority; held-hardware delay replan; teaching from the same evaluator; non-mutating engineering evidence envelopes; multi-audience modes on one scenario identity.

**Incremental:** maps/globe/imagery path; Horizons+LOLA spine; comparison tray; brand polish; flight bounce/breakup as pedagogy.

**Demo risk:** Leading with globe/loader/lander bounce reads as “fancy NASA viewer.” Lead with fail→replan→conditional restore.

---

## Validity — 4/5

**Verdict:** Scientifically grounded, analytically verified site×date resource-screening and teaching workbench that works for its stated purpose — not ready for real-world *operational* implementation (score-of-5 bar).

**Grounding:** Horizons DE441; airless geometry; LOLA horizons; power/comms screening with honest unknowns; large analytic + journey test matrices; science gate still marks terrain/frame incomplete.

**Must say aloud:** Preliminary screening/education tool; not landing approval or DSN booking; contact physics illustrative; catalog bounds apply.

---

## Relevance — 5/5

**Verdict:** Near 1:1 challenge implementation. JPL Horizons + LOLA are the computational core.

Every challenge objective maps to executable UI/lib evidence (site comparison, dates, Sun/Earth vs horizon, power/comms, multi-viz, temporal dynamics, skill levels, NASA data).

**Weakest link (not a miss):** Comms = geometric Earth contact + Planner radio assumptions, not booked DSN passes. About’s DONKI flare language is ahead of the product — peripheral.

---

## Presentation — 3/5 now · projected 5/5

**Verdict:** About + mode guides + brand already tell challenge→solution→stakes. Judging-day score is capped by placeholder live Dashboard, unrehearsed delivery, and ~81 MB cold-load risk.

**Projected 5 requires:** Pages index embeds navigator (PR #4); preload; one practiced spine (not About week *and* DEMO.md contingency mid-talk).

### 90-second spine

1. 0–10s — Challenge (light + Earth-view; slips)
2. 10–20s — Gap (data exists, not fast comparison)
3. 20–35s — Open preloaded Dashboard → Public → site + horizon
4. 35–55s — Scrub timeline · “one week can decide a landing”
5. 55–75s — Replan +7 · same stay · energy/contact change
6. 75–90s — Educator *or* Planner beat · close

### Pre-demo checklist

- [ ] Merge/deploy PR #4 so Pages is not placeholder
- [ ] Preload Dashboard or standalone navigator (~81,164,024 bytes)
- [ ] Start Public; stage one site/date pair only
- [ ] Path: site → timeline → horizon → Replan +7 → one depth beat
- [ ] Honest limits line ready; no unshown flare/ops claims

---

## Challenge objectives (Relevance matrix summary)

| Objective | Status |
| --- | --- |
| Site selection & comparison | Met |
| Date/time flexibility | Met |
| Sun & Earth vs horizon | Met |
| Power & communication | Met (geometric + Planner assumptions) |
| Multiple visualizations | Met |
| Temporal dynamics | Met |
| Skill-level access | Met |
| NASA data core | Met (Horizons + LOLA load-bearing) |
