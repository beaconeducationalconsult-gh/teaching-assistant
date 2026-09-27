import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = { title: string; subtitle: string; onClose: () => void; children: ReactNode };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog with the behaviour keyboard and screen-reader users expect:
 * announced as a dialog, labelled by its heading, closes on Escape or a backdrop
 * click, keeps Tab inside while open, scroll-locks the page, and returns focus to
 * whatever opened it.
 */
export default function Modal({ title, subtitle, onClose, children }: Props) {
  const dialog = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => element
      ? Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.getClientRects().length > 0)
      : [];

    // Respect an autoFocus field in the form; otherwise start at the top of the dialog.
    if (element && !element.contains(document.activeElement)) (focusables()[0] ?? element).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !element) return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !element.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !element.contains(active))) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose]);

  return <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog} tabIndex={-1}>
      <button type="button" className="close" onClick={onClose} aria-label="Close dialog"><X size={18} aria-hidden="true"/></button>
      <span className="overline"><i/> {subtitle}</span>
      <h2 id={titleId}>{title}</h2>
      {children}
    </section>
  </div>;
}
