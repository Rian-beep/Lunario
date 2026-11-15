"use client";

import { useEffect, useState, type ReactNode } from "react";
import { resolveSiteShellNav, type SiteShellNav } from "@/lib/site-shell-nav";

const SSR_FALLBACK: SiteShellNav = {
  dashboardHref: "../../",
  aboutHref: "../../about.html",
  current: "dashboard",
};

function useSiteShellNav(): SiteShellNav {
  const [nav, setNav] = useState<SiteShellNav>(SSR_FALLBACK);
  useEffect(() => {
    setNav(resolveSiteShellNav());
  }, []);
  return nav;
}

/** Logo / brand → site home (dashboard when embedded). */
export function SiteShellBrandLink({ children }: { children: ReactNode }) {
  const nav = useSiteShellNav();
  return (
    <a href={nav.dashboardHref} className="brand" target="_top" aria-label="Lunario home">
      {children}
    </a>
  );
}

/** Clean site action in the header: About the project. */
export function SiteShellNavLinks() {
  const nav = useSiteShellNav();

  return (
    <nav className="site-shell-nav" aria-label="Site">
      <a
        className="site-shell-nav__about"
        href={nav.aboutHref}
        target="_top"
        aria-label="About the project"
      >
        About the project
      </a>
    </nav>
  );
}
