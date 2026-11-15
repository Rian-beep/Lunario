# Space Apps judging review — Lunario (Grok-critical pass)

Review date: 15 November 2026 (Europe/London). Working scores below follow the **Grok critical pass** (harsher, demo-path focused). Prior internal deep judges averaged ~4.0; Grok’s average is **3.2**. Use Grok as the improvement bar for hitting 5s.

Official rubric: https://www.spaceappschallenge.org/resources/judging-awards-guide/#judging-criteria

## Scorecard

| Criterion | Grok | Prior deep | Working target |
| --- | ---: | ---: | --- |
| Impact | **3** | 4 | 5 via unburying the delay story |
| Creativity | **3** | 4 | 5 via Public plain-language + focused loop |
| Validity | **4** | 4 | 5 via limits honesty + illumination check |
| Relevance | **4** | 5 | 5 via default path = compare sites/dates |
| Presentation | **2** | 3 | 5 via Public-first demo path |
| **Average** | **3.2** | 4.0 | — |

---

## Impact — **3/5** → path to 5

**Why 3:** Best result is excellent (Connecting Ridge 29 Jun 2027: **97.6% sun vs 0% smooth Moon**; slip to 13 Jul → **16.1%** with 9-day dark gap; site-only swap to de Gerlache–Shackleton → **95.5%**) — but it is buried. Public opens in shadow; delay story lives under Planner; power model is a generic lander; only 9 sites have real horizons.

**To hit 5:**
- **Today:** One-click **“Show a delayed landing”** that loads all three cases.
- **Today:** Start the clock in sunlight, not at 11:00 UTC when it says “in shadow”.
- **Today:** One contrast line: *97.6% with real terrain vs 0% on a smooth Moon*.
- **Later:** Real published lander spec; horizons for more sites; non-expert test.

---

## Creativity — **3/5** → path to 5

**Why 3:** Three modes + date-slip energy check improve on Horizons/Moon Trek, but the concept isn’t new. Public still talks like an engineer (“antenna viewing limit”, “assessed requirements”). Lander in the main header steals attention from the idea.

**To hit 5:**
- **Today:** Remove Lander, Lab, and engineering controls from Public.
- **Today:** Plain Public wording (“Earth is above the hills”).
- **Today:** Educator = one loop: predict → change one thing → see the result (not a research form).
- **Later:** “What if we slip a week?” strip across the whole year.

---

## Validity — **4/5** → path to 5

**Why 4 (strongest):** Horizons residuals ~0.005°; LOLA horizons; smooth-Moon baseline on every result; tests back it up.

**Why not 5:** Custom pins borrow nearest grid cell; 40 m data smooths ridges; sunlight = single horizon cut; no thermal / real lander; “Conditional” as best outcome can sound like “never passes.”

**To hit 5:**
- **Today:** State limits in one breath in the demo.
- **Today:** Borrowed-horizon warning at the **top** of the screen.
- **Today:** Do not quote flare, DSN weather, or temperature results.
- **Later:** Check sunlight vs NASA official illumination maps (PGDA 69); exact custom-coordinate horizons.

---

## Relevance — **4/5** → path to 5

**Why 4:** Right challenge; NASA data really drives it. Brief asked for an *intuitive* quick site×date comparer — product is shaped like an engineering workbench. The comparison that answers the brief isn’t the default path; lander isn’t in the brief.

**To hit 5:**
- **Today:** Open with: *“Lunar Landing Site Navigator, using JPL Horizons and LOLA terrain to compare sunlight and Earth view at the south pole.”*
- **Today:** Public main actions = **Pick a site**, **Move the date**, **Compare**; horizon chart one click away.
- **Later:** Optional official illumination-map layer for shortlisting.

---

## Presentation — **2/5** → path to 5

**Why 2 (weakest):** Polished look, weak first minute. Public opens with a big “in shadow” jargon banner; ~16 header controls before the map; Compare starts empty; delay demo hidden in Planner; 3s loader + popup on every reload.

**To hit 5:**
- **Today:** Fix Public first paint (sunlight start, plain banner, fewer header controls).
- **Today:** Surface delay demo + pre-filled Compare (three cases).
- **Today:** Soften every-reload loader/popup friction for demos (or preload + skip once staged).
- **Must:** Live Pages Dashboard embed (not placeholder) + rehearsed 90s spine.

### Demo one-breath limits (Validity)
“Positions match JPL Horizons closely; horizons come from LOLA. Custom pins borrow the nearest prepared cell. We use a single horizon cut, not full disk–terrain integration. Best assessed outcome can stay Conditional when evidence is incomplete — that means honest, not approved to land.”
