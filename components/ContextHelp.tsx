"use client";

import { CircleHelp } from "lucide-react";
import { useId, useState } from "react";

export default function ContextHelp({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="context-help">
      <button
        type="button"
        className="context-help-button"
        aria-label={`Ayuda: ${label}`}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(value => !value)}
      >
        <CircleHelp size={13} />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`context-help-tooltip ${open ? "open" : ""}`}
      >
        {text}
      </span>
    </span>
  );
}
