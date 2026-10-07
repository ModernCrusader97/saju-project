"use client";

import { useEffect, useRef, type RefObject } from 'react';

const focusableSelector = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

/** Focus belongs to the opened dialog and returns to its trigger on dismissal. */
export function useDialogFocus(open: boolean, dialogRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.focus({ preventScroll: true });
    let lastFocused: HTMLElement = dialog;
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) lastFocused = event.target;
    };
    // Form submission can remove/disable its focused control before the next
    // keyboard event. Recover locally rather than trapping the whole document.
    const observer = new window.MutationObserver(() => {
      if (dialog.isConnected && document.activeElement === document.body
        && (!lastFocused.isConnected || lastFocused.matches(':disabled') || lastFocused.closest('[hidden], [inert]'))) {
        dialog.focus({ preventScroll: true });
      }
    });
    observer.observe(dialog, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'inert'] });
    dialog.addEventListener('focusin', onFocusIn);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // Recompute for loading/error states, which enable or remove controls.
      const controls = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter(element => {
        const style = window.getComputedStyle(element);
        return element.tabIndex >= 0 && !element.matches(':disabled')
          && !element.closest('[hidden], [inert], [aria-hidden="true"]')
          && style.display !== 'none' && style.visibility !== 'hidden';
      });
      const first = controls[0], last = controls.at(-1), active = document.activeElement;
      if (!first) {
        event.preventDefault(); dialog.focus({ preventScroll: true });
      } else if (active === dialog || !controls.includes(active as HTMLElement)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault(); first.focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('focusin', onFocusIn);
      observer.disconnect();
      if (previous?.isConnected && (dialog.contains(document.activeElement) || document.activeElement === document.body)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, dialogRef]);
}
