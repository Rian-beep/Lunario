# Lunario site shell (GitHub Pages)

Static site, no build step. Two pages share one top bar (logo, Dashboard, About):

- `index.html`: Dashboard. The "Prepare for landing" loader plays first (at least three seconds, on each document load or reload), then reveals the dashboard. The dashboard is a **placeholder layout**: mount the real dashboard inside `<div id="dashboard-root">`.
- `about.html`: project summary, team (Luke Dudley, Rian Banting, with LinkedIn links) and the Lunario banner as the footer (HTML + SVG, so it stays crisp at any width).

```
index.html  about.html  .nojekyll
css/site.css             shared styles
fonts/                   Geist + Geist Mono (SIL OFL), self-hosted
loader/                  loader.css, loader.js, font
assets/                  logos, favicons, manifest, og-image, hero-bg.svg, footer-bg.svg
```

All paths are relative, so it works on a project site (`https://<user>.github.io/<repo>/`) as well as a custom domain.

## Deploy

1. Copy the contents of this folder into the root of your repo (or into a `/docs` folder).
2. Commit and push.
3. On GitHub: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, pick your branch and `/ (root)` (or `/docs`), Save.
4. After a minute the site is live at `https://<user>.github.io/<repo>/`.
5. In both HTML files, replace `<user>/<repo>` in the `og:image` tag with your real address so link previews show the image.

## Loader options

In `index.html`:

```html
<script src="loader/loader.js" data-min-duration="3000"></script>
```

- The entry omits `data-once="session"`, so every document load/reload plays the original animation. The vendor still supports that option for other consumers.
- To wait for your dashboard data, add `data-auto-hide="false"` and call `Lunario.loader.hide()` once the data is in. (When the loader is skipped for the session, `hide()` does nothing, so it is always safe to call.)
- Visitors with "reduce motion" turned on see a short, still version.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

## Team photos

`about.html` shows initials avatars for now. To use photos, save square images as `assets/team/luke.jpg` and `assets/team/rian.jpg` (at least 144x144), then in `about.html` follow the "Photo slot" comment above each avatar: replace the `<svg class="person__avatar">` with the `<img class="person__photo">` line. Photos show in greyscale and turn to colour on hover.


## Integrated lunar navigator workbench

The tested map-first Public / Educator / Planner application is in [`navigator/`](navigator/README.md). The existing static shell, branding and About page remain unchanged.

```bash
cd navigator
npm ci
npm run dev
```

Open http://127.0.0.1:4317/. For a host that runs Next.js, choose **`navigator` as the project root**, then use `npm run build` and `npm run start -- --port 4317`. Hosting remains the teammate's responsibility; this change does not change Pages or deployment settings.

A prebuilt disconnected version is [`navigator/public/solarreach-navigator.html`](navigator/public/solarreach-navigator.html). Download the actual HTML file and open it locally; GitHub's file preview is not the application. See [the team handoff](NAVIGATOR-HANDOFF.md) for exact release identity, validation and remaining work.
