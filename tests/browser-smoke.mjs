import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const graphUiRoot = resolve(root, "graph-ui");
const evidenceDir = resolve(graphUiRoot, "data", "browser-smoke");

let playwright;
try {
  playwright = await import("playwright");
} catch {
  console.log("browser smoke skipped: Playwright is not installed in graph-ui or parent Node resolution.");
  process.exit(0);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

function request(port, pathname) {
  return new Promise((resolveResponse, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: pathname, timeout: 5000 }, (res) => {
      res.resume();
      res.on("end", () => resolveResponse(res.statusCode));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error(`Timed out requesting ${pathname}`)));
    req.end();
  });
}

async function waitForServer(port, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 7000) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      if ((await request(port, "/babylon-3d.html")) === 200) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error("Server did not start in time");
}

const port = await getFreePort();
const child = spawn(process.execPath, ["server.js"], {
  cwd: graphUiRoot,
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let browser;
try {
  await waitForServer(port, child);
  await mkdir(evidenceDir, { recursive: true });

  browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  await page.goto(`http://127.0.0.1:${port}/babylon-3d.html?graph=current-project-learning`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("#renderCanvas");
  await page.waitForFunction(() => document.querySelector("#statusbar")?.textContent.includes("Loaded"));

  await page.click("#showAllLabels");
  await page.fill("#searchBox", "Task");
  await page.fill("#degreeFilter", "1");
  await page.fill("#degreeFilter", "0");

  for (const layout of ["grid", "circle", "concentric", "breadthfirst", "cose", "cola"]) {
    await page.selectOption("#layoutSelect", layout);
    await page.waitForFunction(
      (layoutName) => {
        const text = document.querySelector("#statusbar")?.textContent || "";
        const manual = ["grid", "circle", "concentric", "breadthfirst"].includes(layoutName);
        return text.includes(`${manual ? "manual" : "Cytoscape"} ${layoutName}`);
      },
      layout,
    );
  }

  await page.click("#resetLayout");
  await page.mouse.click(720, 460, { button: "right" });
  await page.waitForSelector("#contextMenu", { state: "visible", timeout: 2500 });
  await page.locator('#contextMenu [data-action="labels"]').click();
  await page.waitForFunction(() => document.querySelector("#statusbar")?.textContent.includes("nodes visible"));

  const status = await page.textContent("#statusbar");
  assert.match(status || "", /nodes visible/);
  await page.screenshot({ path: resolve(evidenceDir, "babylon-3d-learning.png"), fullPage: true });
  console.log(`browser smoke ok: evidence ${resolve(evidenceDir, "babylon-3d-learning.png")}`);
} finally {
  if (browser) await browser.close();
  child.kill();
}
