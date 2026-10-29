import { readFileSync, writeFileSync } from "node:fs";
const worker = readFileSync("public/sw.js", "utf8");
const cache = worker.match(/const CACHE\s*=\s*["']([^"']+)["']/)?.[1];
if (!cache) throw new Error("Versão do app não encontrada no service worker.");
const commit = process.env.VERCEL_GIT_COMMIT_SHA;
const version = commit ? `${cache}-${commit}` : cache;
writeFileSync(
  "src/lib/app-version.ts",
  `// Generated before each build; keep the client and release metadata in sync.\nexport const APP_VERSION = ${JSON.stringify(version)};\n`,
);
writeFileSync("public/app-version.json", JSON.stringify({ version }) + "\n");
