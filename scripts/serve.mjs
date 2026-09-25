#!/usr/bin/env node
/**
 * serve.mjs — serves dist/ on http://localhost:8000 for local preview.
 * Opening dist/index.html from disk works too, but self-hosted fonts may
 * not load over file://, so prefer `npm run dev`.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT) || 8000;
const TYPES = { ".json": "application/json", ".html": "text/html; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html";
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`serve: http://localhost:${PORT}`);
});
