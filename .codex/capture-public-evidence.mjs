import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.argv[2];
const label = process.argv[3];
if (!base || !label) throw new Error("Usage: node capture-public-evidence.mjs URL label");

const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  const directory = resolve(".codex/evidence");
  await mkdir(directory, { recursive: true });
  for (const [name, route] of [["home", "/"], ["login", "/login"], ["privacy", "/privacy"], ["terms", "/terms"], ["deletion", "/data-deletion"], ["muse", "/connect/muse"]]) {
    const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    if (!response) throw new Error(`No response for ${route}`);
    await page.screenshot({ path: resolve(directory, `oauth-${name}-${label}.png`), clip: { x: 0, y: 0, width: 1280, height: 820 } });
    console.log(`${name}: ${response.status()} ${page.url()}`);
  }
} finally {
  await browser.close();
}
