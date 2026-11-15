# Lunario GitHub Pages — go-live checklist

Live site: **https://rian-beep.github.io/Lunario/**

Pages source: branch **`main`**, path **`/`** (already configured).

## Baseline probe (2026-11-15 UTC)

Recorded against production before the Dashboard embed PR merges.

| URL | HTTP | Size | Notes |
|-----|------|------|-------|
| https://rian-beep.github.io/Lunario/ | **200** | 2,721 bytes | Homepage is still the **placeholder** Dashboard (`Placeholder layout`; no `navigator-frame` / `solarreach-navigator.html`) |
| https://rian-beep.github.io/Lunario/about.html | **200** | 11,510 bytes | About page live |
| https://rian-beep.github.io/Lunario/navigator/public/solarreach-navigator.html | **200** | **81,164,024 bytes (~77.4 MiB / ~81 MB)** | Standalone offline navigator already live |

Expect the homepage to remain a placeholder until Agent A’s Dashboard embed PR merges into `main` and Pages redeploys.

## Acceptance criteria (after embed PR)

Re-run the smoke script after Agent A merges. Go-live is confirmed when **all** of the following are true:

1. **Index** `https://rian-beep.github.io/Lunario/` returns HTTP **200**.
2. Index HTML **does not** contain `Placeholder layout`.
3. Index HTML **does** contain `navigator-frame`.
4. Index HTML **does** reference `solarreach-navigator.html`.
5. **About** `…/about.html` returns HTTP **200**.
6. **Offline navigator** `…/navigator/public/solarreach-navigator.html` returns HTTP **200**.

The smoke script encodes these checks and exits **0** only when they all pass.

## Demo preload advice

The offline navigator bundle is **~78–81 MB** on first load.

- Pre-open the standalone navigator URL (or the Dashboard iframe target) on the demo machine **before** the talk so the browser can cache the large HTML payload.
- Prefer a wired or strong Wi‑Fi link; mobile hotspots may stall the first fetch.
- After the embed lands, a cold Dashboard visit still pulls that same large navigator document into the iframe — budget ~30–90s depending on bandwidth.
- Keep the standalone URL as a fallback if the embed path is slow:  
  https://rian-beep.github.io/Lunario/navigator/public/solarreach-navigator.html

## Smoke command

From the repo root (or any machine with `bash` + `curl`):

```bash
./scripts/verify-pages-dashboard.sh
```

Override the base URL if needed:

```bash
LUNARIO_PAGES_BASE=https://rian-beep.github.io/Lunario ./scripts/verify-pages-dashboard.sh
```

**Today (placeholder homepage):** the script is expected to **FAIL** (exit code `1`) because index still shows `Placeholder layout` and lacks the embed markers. That failure is the pre-merge baseline.

**After Agent A merges + Pages redeploy:** re-run the same command; exit code `0` / `RESULT: PASS` means Dashboard is live.

## Manual quick checks (optional)

1. Open the homepage — confirm the navigator iframe (not “Placeholder layout”).
2. Open About — confirm nav + content load.
3. Open the standalone navigator URL — confirm HTTP 200 and the 3D UI eventually appears.
