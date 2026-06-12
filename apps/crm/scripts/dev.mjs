import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commands = [
  spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "dev", "-p", "3000"], { cwd, stdio: "inherit" }),
  spawn(process.execPath, ["../../node_modules/tsx/dist/cli.mjs", "watch", "ws-server.ts"], { cwd, stdio: "inherit" })
];
const stop = () => commands.forEach((child) => child.kill("SIGTERM"));
process.on("SIGINT", stop); process.on("SIGTERM", stop);
const exit = await Promise.race(commands.map((child) => new Promise((resolveExit) => child.on("exit", (code) => resolveExit(code ?? 0)))));
stop(); process.exit(Number(exit));
