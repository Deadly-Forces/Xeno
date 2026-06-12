import type { HTMLAttributes } from "react";
export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>): JSX.Element { return <article className={`panel ${className}`} {...props} />; }
