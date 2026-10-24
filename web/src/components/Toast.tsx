import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function Toast({ message, noticeId, onDismiss }: { message: string; noticeId: number; onDismiss: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    setFading(false);
    if (hovered || focused) return;
    let dismissTimer: number | undefined;
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
      dismissTimer = window.setTimeout(onDismiss, 250);
    }, 6000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [message, noticeId, hovered, focused, onDismiss]);

  return <div className={`toast${fading ? " is-fading" : ""}`} role="status" aria-atomic="true" tabIndex={0}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
    <button type="button" className="ghost toast-close" aria-label="Закрити повідомлення" title="Закрити повідомлення" onClick={onDismiss}><X size={16} /></button>
    <p>{message}</p>
  </div>;
}
