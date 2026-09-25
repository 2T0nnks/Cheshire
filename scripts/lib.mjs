// Shared helpers for the build scripts.
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const QUANTUM_JS = path.join(ROOT, "engine", "quantum.js");
export const LEVELS_DIR = path.join(ROOT, "levels");
export const GLOSSARY = path.join(ROOT, "content", "glossary.json");

/** Loads engine/quantum.js (a browser script) into an isolated context. */
export async function loadQuantum() {
  const code = await fs.readFile(QUANTUM_JS, "utf-8");
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: "engine/quantum.js" });
  return sandbox.Quantum;
}

/** Every levels/*.json as { file, data }, sorted by `order`. Throws on bad JSON. */
export async function readLevels() {
  const files = (await fs.readdir(LEVELS_DIR)).filter(f => f.endsWith(".json"));
  const levels = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(LEVELS_DIR, file), "utf-8");
    try {
      levels.push({ file, data: JSON.parse(raw) });
    } catch (e) {
      throw new Error(`Invalid JSON in levels/${file}: ${e.message}`);
    }
  }
  return levels.sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
}
