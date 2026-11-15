"use client";

import { useEffect, useState } from "react";
import { resolveSiteShellNav, type SiteShellNav } from "@/lib/site-shell-nav";

const SSR_FALLBACK: SiteShellNav = {
  dashboardHref: "../../",
  aboutHref: "../../about.html",
  current: "dashboard",
};

/** Cream-header Dashboard / About links (replaces the dark site-shell bar when embedded). */
export function SiteShellNavLinks() {
  const [nav, setNav] = useState<SiteShellNav>(SSR_FALLBACK);

  useEffect(() => {
    setNav(resolveSiteShellNav());
  }, []);

  return (
    <nav className="site-shell-nav" aria-label="Site">
      <a
        className="site-shell-nav__link"
        href={nav.dashboardHref}
        target="_top"
        aria-current={nav.current === "dashboard" ? "page" : undefined}
      >
        Dashboard
      </a>
      <a className="site-shell-nav__link" href={nav.aboutHref} target="_top">
        About
      </a>
    </nav>
  );
}
