"use client";

import {useLayoutEffect, useRef, type ReactNode} from "react";

/** Native modal focus/escape handling; the underlying lunar scene stays mounted. */
export function WorkspaceDialog({label, onClose, children, open = true}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  open?: boolean;
}) {
  const element = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = element.current;
    if (!dialog) return;
    if (!open) { if (dialog.open) dialog.close(); return; }
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // Layout cleanup runs before React detaches the dialog. Passive cleanup ran
    // too late for the browser to return focus when a lazy workspace unmounted.
    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus({preventScroll: true});
    };
  }, [open]);

  return <dialog ref={element} className="workspace-dialog" aria-label={label}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    {children}
  </dialog>;
}
