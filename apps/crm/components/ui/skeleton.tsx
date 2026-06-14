import { cn } from "../../lib/core/utils";

export function Skeleton({ className = "" }: { className?: string }): JSX.Element {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-[#e7ece9]", className)} />;
}
