import { config } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const localEnv = resolve(process.cwd(), ".env.local");
config({ path: existsSync(localEnv) ? localEnv : resolve(process.cwd(), "../../.env") });
