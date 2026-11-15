"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { glossaryFor, type Audience } from "@/lib/glossary";
import {resolveVariableNotation} from "@/lib/variable-notation";
import { EquationLesson } from "./equation-lesson";
export const AudienceContext = createContext<Audience>("public");

export function Info({ label, extra }: { label: string; extra?: string }) {
  const audience = useContext(AudienceContext),
    entry = glossaryFor(label),
    notation = resolveVariableNotation(label),
    id = useId();
  const button = useRef<HTMLButtonElement>(null),
    tooltip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    pinned = useRef(false);
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({
      left: 12,
      top: 12,
      maxHeight: 320,
      width: 380,
    });
  const cancelHide = () => clearTimeout(timer.current);
  const show = () => {
    cancelHide();
    setOpen(true);
  };
  const close = () => {
    cancelHide();
    pinned.current = false;
    setOpen(false);
  };
  const hide = () => {
    cancelHide();
    timer.current = setTimeout(() => {
      if (
        !pinned.current &&
        document.activeElement !== button.current &&
        !tooltip.current?.contains(document.activeElement)
      )
        setOpen(false);
    }, 250);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const anchor = button.current?.getBoundingClientRect(),
        panel = tooltip.current;
      if (!anchor || !panel) return;
      const viewport = window.visualViewport;
      const minX = (viewport?.offsetLeft ?? 0) + 12,
        minY = (viewport?.offsetTop ?? 0) + 12;
      const maxX = minX + (viewport?.width ?? window.innerWidth) - 24,
        maxY = minY + (viewport?.height ?? window.innerHeight) - 24;
      const maxHeight = Math.max(40, maxY - minY),
        panelHeight = Math.min(panel.scrollHeight, maxHeight);
      let top = anchor.bottom + 8;
      if (top + panelHeight > maxY) top = anchor.top - panelHeight - 8;
      setPosition({
        left: Math.max(
          minX,
          Math.min(maxX - panel.offsetWidth, anchor.left - 24),
        ),
        top: Math.max(minY, Math.min(maxY - panelHeight, top)),
        maxHeight,
        width: Math.max(40, Math.min(380, maxX - minX)),
      });
    };
    reposition();
    const observer = new ResizeObserver(reposition);
    if (tooltip.current) observer.observe(tooltip.current);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, audience, label, extra]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        pinned.current = false;
        clearTimeout(timer.current);
        if (tooltip.current?.contains(document.activeElement))
          button.current?.focus();
        setOpen(false);
      }
    };
    const outside = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        !button.current?.contains(e.target) &&
        !tooltip.current?.contains(e.target)
      ) {
        pinned.current = false;
        clearTimeout(timer.current);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", escape, true);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!entry && !notation && !extra) return null;
  return (
    <span className="info-anchor">
      <button
        ref={button}
        type="button"
        className="info-button"
        aria-label={`About ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && open) {
            e.preventDefault();
            e.stopPropagation();
            tooltip.current?.focus();
          }
        }}
        onBlur={(e) => {
          if (!tooltip.current?.contains(e.relatedTarget)) {
            pinned.current = false;
            hide();
          }
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pinned.current) close();
          else {
            pinned.current = true;
            show();
          }
        }}
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            role="dialog"
            aria-modal={false}
            aria-label={`About ${label}`}
            tabIndex={0}
            className="variable-tooltip"
            style={{
              ...position,
              overflowY: "auto",
              fontSize: 14,
              lineHeight: 1.65,
              overscrollBehavior: "contain",
            }}
            onMouseEnter={cancelHide}
            onMouseLeave={hide}
            onFocus={cancelHide}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Tab") {
                const stops = Array.from(tooltip.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], summary, input, select, textarea, [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
                const active = document.activeElement;
                if ((e.shiftKey && (active === tooltip.current || active === stops[0])) || (!e.shiftKey && (!stops.length || active === stops[stops.length - 1]))) {
                  e.preventDefault();
                  button.current?.focus();
                  close();
                }
              }
            }}
            onBlur={(e) => {
              if (e.relatedTarget !== button.current && !tooltip.current?.contains(e.relatedTarget)) {
                pinned.current = false;
                hide();
              }
            }}
          >
            <strong>{label}</strong>
            <p>{entry?.intuition ?? notation?.intuition ?? extra}</p>
            {audience !== "public" && (entry || notation) && (
              <p>{entry ? (audience === "teach" ? entry.teaching : entry.technical) : notation!.meaning}</p>
            )}
            {(entry || notation) && <div>
              <span>What to check</span>
              <p>{entry?.range ?? notation!.limits}</p>
            </div>}
            {notation && <EquationLesson key={notation.id} expression={notation.equation} notation={notation} mode={audience} />}
            {extra && (entry || notation) && <p className="tooltip-extra">{extra}</p>}
            <p className="tooltip-extra">
              Tap i to keep this open. From i, press ↓ to focus the explanation
              for scrolling. Tab moves through the explanation; Escape or Tab beyond its last control closes it and returns to i.
            </p>
          </div>,
          document.body,
        )}
    </span>
  );
}
