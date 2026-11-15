"use client";
import type { ReactNode } from "react";
import { useUiTheme } from "../ui-theme-toggle";
import { LUNARIO_WORDMARK, LUNARIO_WORDMARK_ON_DARK } from "./lunario-vendor.generated";
import "./branding.css";

export type LunarWindowBrandProps = { icon?: ReactNode };

/** Legacy call signature retained; the upstream SVG contains its own mark. */
export function LunarWindowBrand(props: LunarWindowBrandProps = {}) {
  void props.icon;
  const theme = useUiTheme();
  // A data URI preserves the original outlined SVG in the disconnected bundle.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="lunario-wordmark" src={theme === "dark" ? LUNARIO_WORDMARK_ON_DARK : LUNARIO_WORDMARK} alt="Lunario" width={303} height={64} />;
}
