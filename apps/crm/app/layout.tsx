import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "../components/navigation";
import { Providers } from "../components/providers";
import { CommandPalette } from "../components/command-palette";

export const metadata: Metadata = { title: "Northstar CRM", description: "AI-native customer campaign operations" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): JSX.Element {
  return <html lang="en"><body><Providers><Navigation /><main className="min-h-screen md:pl-60"><div className="mx-auto max-w-[1500px] p-4 md:p-8">{children}</div></main><CommandPalette /></Providers></body></html>;
}
