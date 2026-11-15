# Lunario site shell (GitHub Pages)

Static site, no build step. Two pages share one top bar (logo, Dashboard, About):

- `index.html`: Dashboard. The "Prepare for landing" loader plays first (at least three seconds, on each document load or reload — no `data-once="session"`), then embeds Luke's full lunar landing site navigator from `navigator/public/solarreach-navigator.html` inside `#dashboard-root`. GitHub Pages on `main` serves this offline embed as the live Dashboard.
- `about.html`: project summary, team (Luke Dudley, Rian Banting, with LinkedIn links) and the Lunario banner as the footer (HTML + SVG, so it stays crisp at any width).

```
index.html  about.html  .nojekyll
css/site.css             shared styles
fonts/                   Geist + Geist Mono (SIL OFL), self-hosted
loader/                  loader.css, loader.js, font
assets/                  logos, favicons, manifest, og-image, hero-bg.svg, footer-bg.svg
navigator/               Next.js workbench + offline HTML bundle used by Dashboard
```

All paths are relative, so it works on a project site (`https://<user>.github.io/<repo>/`) as well as a custom domain.

The Dashboard tab loads the verified offline navigator (~78 MB). First visit can take a while on slow links; a direct open link is shown while it loads. For a host that can run Next.js, you can still serve `navigator/` with `npm run dev` / `npm run build` instead of the embedded file.

## Deploy

1. Copy the contents of this folder into the root of your repo (or into a `/docs` folder).
2. Commit and push.
3. On GitHub: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, pick your branch and `/ (root)` (or `/docs`), Save.
4. After a minute the site is live at `https://<user>.github.io/<repo>/`.
5. In both HTML files, replace `<user>/<repo>` in the `og:image` tag with your real address so link previews show the image.

## Loader options

In `index.html`:

```html
<script src="loader/loader.js" data-min-duration="3000" data-auto-hide="false"></script>
```

- The entry omits `data-once="session"`, so every document load/reload plays the original animation. The vendor still supports that option for other consumers.
- `data-auto-hide="false"` keeps the loader up until the navigator iframe fires `load` (then `Lunario.loader.hide()` runs). A safety timeout also hides it if load is delayed.
- Visitors with "reduce motion" turned on see a short, still version.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

## Team photos

`about.html` shows initials avatars for now. To use photos, save square images as `assets/team/luke.jpg` and `assets/team/rian.jpg` (at least 144x144), then in `about.html` follow the "Photo slot" comment above each avatar: replace the `<svg class="person__avatar">` with the `<img class="person__photo">` line. Photos show in greyscale and turn to colour on hover.


## Integrated lunar navigator workbench

The tested map-first Public / Educator / Planner application lives in [`navigator/`](navigator/README.md). The site **Dashboard** tab embeds the verified offline build at [`navigator/public/solarreach-navigator.html`](navigator/public/solarreach-navigator.html) so GitHub Pages can serve the full workbench without a Node host. Branding and the About page stay in the static shell.

For local Next.js development:

```bash
cd navigator
npm ci
npm run dev
```

Open http://127.0.0.1:4317/. On a host that runs Next.js, set **`navigator` as the project root**, then `npm run build` and `npm run start -- --port 4317`.

GitHub’s file preview is not the application — open the HTML via the Dashboard tab, a local static server, or download the file. See [the team handoff](NAVIGATOR-HANDOFF.md) for release identity and validation, and [SPACE-APPS-JUDGING-REVIEW.md](SPACE-APPS-JUDGING-REVIEW.md) for the challenge/rubric self-assessment.
