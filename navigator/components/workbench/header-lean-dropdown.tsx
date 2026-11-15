"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** A small disclosure with ordinary keyboard-focusable controls, not an OS menu. */
export function HeaderLeanDropdown({ label, children, className = "", openRequest }: {
  label: string; children: ReactNode; className?: string; openRequest?: number;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  useEffect(() => { if(openRequest&&ref.current)ref.current.open=true; }, [openRequest]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = ref.current?.querySelector('summary')?.getBoundingClientRect();
      if (!anchor || !panel.current) return;
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 12;
      const top = (viewport?.offsetTop ?? 0) + 12;
      const width = Math.min(440, (viewport?.width ?? innerWidth) - 24);
      const maxHeight = Math.min(580, (viewport?.height ?? innerHeight) - 24);
      const height = Math.min(panel.current.scrollHeight, maxHeight);
      setPosition({ position: 'fixed', right: 'auto', marginTop: 0, width, maxHeight,
        left: Math.max(left, Math.min(anchor.left, left + (viewport?.width ?? innerWidth) - 24 - width)),
        top: Math.max(top, Math.min(anchor.bottom + 8, top + (viewport?.height ?? innerHeight) - 24 - height)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); observer.disconnect(); };
  }, [open]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <details ref={ref} onToggle={event => setOpen(event.currentTarget.open)} className={`header-dropdown ${className}`} onKeyDown={event => {
    if (event.key === "Escape") {
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
      event.stopPropagation();
    }
  }}>
    <summary>{label}<ChevronDown size={14} aria-hidden="true" /></summary>
    <div ref={panel} className="header-dropdown-content" style={position}>{children}</div>
  </details>;
}
