import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#17201d", canvas: "#f5f7f5", line: "#dce3df", accent: "#147d64", coral: "#d9674f" } } }, plugins: [] } satisfies Config;
