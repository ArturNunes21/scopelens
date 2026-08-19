import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env.local loader for integration tests (no dotenv dependency).
// Only sets variables not already present in process.env.
const envPath = resolve(process.cwd(), ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
