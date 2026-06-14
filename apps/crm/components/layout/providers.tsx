"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } } }));
  return <SessionProvider><QueryClientProvider client={client}><ToastProvider>{children}</ToastProvider></QueryClientProvider></SessionProvider>;
}
