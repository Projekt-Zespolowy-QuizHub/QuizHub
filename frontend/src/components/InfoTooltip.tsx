'use client';

import { ReactNode, useState } from 'react';

interface Props {
  content: string;
  children: ReactNode;
  className?: string;
}

export function InfoTooltip({ content, children, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(v => !v)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 rounded-lg bg-black/95 border border-white/10 text-white text-xs font-normal leading-snug shadow-xl z-50 pointer-events-none"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[6px] border-transparent border-t-black/95" />
        </span>
      )}
    </span>
  );
}
