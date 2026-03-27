// Downloads love.js runtime files from 2dengine/love.js GitHub repo
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { get } from "https";

const BASE_URL =
  "https://raw.githubusercontent.com/2dengine/love.js/main";

const FILES = [
  "player.js",
  "style.css",
  "nogame.love",
  "lua/normalize1.lua",
  "lua/normalize2.lua",
  "11.5/compat/love.js",
  "11.5/compat/love.wasm",
];

const OUT_DIR = join(import.meta.dirname, "..", "love-runtime");

function download(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const file of FILES) {
    const outPath = join(OUT_DIR, file);
    mkdirSync(join(outPath, ".."), { recursive: true });

    if (existsSync(outPath)) {
      console.log(`  skip ${file} (exists)`);
      continue;
    }

    const url = `${BASE_URL}/${file}`;
    console.log(`  fetch ${file}`);
    const data = await download(url);
    writeFileSync(outPath, data);
    console.log(`  wrote ${file} (${(data.length / 1024).toFixed(1)} KB)`);
  }

  // Patch player.js: remove SharedArrayBuffer check (not needed in compat mode)
  const playerPath = join(OUT_DIR, "player.js");
  const playerJs = (await import("fs")).readFileSync(playerPath, "utf-8");
  const patched = playerJs.replace(
    /if \(!window\.SharedArrayBuffer\) \{[\s\S]*?return;\s*\}/,
    "// SharedArrayBuffer check removed for compat mode"
  );
  if (patched !== playerJs) {
    writeFileSync(playerPath, patched);
    console.log("  patched player.js (removed SharedArrayBuffer check)");
  }

  console.log("done!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
