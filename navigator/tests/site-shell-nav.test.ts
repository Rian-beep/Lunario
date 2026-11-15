import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { resolveSiteShellNav } from "../lib/site-shell-nav";

test("offline HTML under navigator/public resolves Dashboard and About to the site root", () => {
  const nav = resolveSiteShellNav(
    "/Lunario/navigator/public/solarreach-navigator.html",
    "https://rian-beep.github.io/Lunario/navigator/public/solarreach-navigator.html",
  );
  assert.equal(nav.dashboardHref, "https://rian-beep.github.io/Lunario/");
  assert.equal(nav.aboutHref, "https://rian-beep.github.io/Lunario/about.html");
  assert.equal(nav.current, "dashboard");
});

test("navigator header mounts cream site shell links beside the brand", () => {
  const source = readFileSync(join(process.cwd(), "components/navigator.tsx"), "utf8");
  assert.match(source, /SiteShellBrandLink/);
  assert.match(source, /SiteShellNavLinks/);
  assert.match(source, /header-brand-cluster/);
  const nav = readFileSync(join(process.cwd(), "components/site-shell-nav.tsx"), "utf8");
  assert.match(nav, /About the project/);
  assert.doesNotMatch(nav, /Dashboard/);
});

test("Dashboard page drops the dark double nav shell", () => {
  const index = readFileSync(join(process.cwd(), "../index.html"), "utf8");
  assert.doesNotMatch(index, /<header class="nav">/);
  assert.match(index, /dash-page/);
  assert.match(index, /navigator-frame/);
  assert.match(index, /About the project/);
  assert.match(index, /logo\.svg/);
  // Offline HTML paints the cream header after frame "load" — parent must retry inject.
  assert.match(index, /ensureCreamSiteNav/);
  assert.match(index, /MutationObserver/);
});

test("dark wordmark keeps the amber arc on the mark", () => {
  const gen = readFileSync(join(process.cwd(), "components/branding/generate-lunario.mjs"), "utf8");
  assert.match(gen, /LUNARIO_WORDMARK_ON_DARK:\s*data\("assets\/logo\.svg"/);
});
