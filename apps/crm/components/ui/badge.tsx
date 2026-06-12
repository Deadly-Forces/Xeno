import type { HTMLAttributes } from "react";
export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>): JSX.Element { return <span className={`inline-flex rounded-full bg-[#e6f3ee] px-3 py-1 text-xs font-bold text-accent ${className}`} {...props} />; }
