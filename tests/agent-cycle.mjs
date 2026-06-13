import assert from "node:assert/strict";

const graphId = process.env.GRAPH_ID || "current-project-learning";
const appBase = process.env.GRAPH_UI_BASE || "http://127.0.0.1:8173";
const targetUrl = `${appBase}/babylon-3d.html?graph=${encodeURIComponent(graphId)}`;
const cdpHost = process.env.CDP_HOST || "127.0.0.1";
const cdpPort = process.env.CDP_PORT || "9222";
const cdpBase = `http://${cdpHost}:${cdpPort}`;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

async function postEdit(node, testFlow, result) {
  const payload = {
    label: node.label,
    detail: node.detail,
    workState: node.workState || "",
    workflowState: node.workflowState || "",
    seenAt: node.seenAt || "",
    attachments: [],
    testFlow,
    testComments: [{
      role: "agent",
      author: result.pass ? "browser-qa-agent" : "fixer-agent",
      text: result.pass
        ? `browser-qa-agent pass: ${result.summary}`
        : `browser-qa-agent fail: ${result.summary}; fixer-agent next action: inspect and patch ${result.area}`,
    }],
  };
  const response = await fetch(`${appBase}/api/graph-edits/${encodeURIComponent(graphId)}/${encodeURIComponent(node.id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Could not save edit for ${node.id}: HTTP ${response.status}`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      pending.get(payload.id)(payload);
      pending.delete(payload.id);
    } else if (payload.method) {
      events.push(payload);
    }
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({
      events,
      close: () => ws.close(),
      send(method, params = {}) {
        const id = nextId;
        nextId += 1;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((done) => pending.set(id, done));
      },
    }));
    ws.addEventListener("error", reject);
  });
}

async function waitFor(condition, timeoutMs = 12000, label = "browser condition") {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await condition();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function openBrowser() {
  let target;
  try {
    target = await fetchJson(`${cdpBase}/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" });
  } catch {
    console.log(`agent cycle skipped: Chrome DevTools is not available at ${cdpBase}.`);
    process.exit(0);
  }
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: targetUrl });
  await waitFor(() => cdp.events.some((event) => event.method === "Page.loadEventFired"), 12000, "page load");
  await waitFor(async () => {
    const response = await cdp.send("Runtime.evaluate", {
      expression: "document.getElementById('statusbar')?.textContent.includes('Loaded')",
      returnByValue: true,
    });
    return response.result?.result?.value;
  }, 12000, "graph loaded status");
  return cdp;
}

async function evalInPage(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text || "browser eval failed");
  return response.result?.result?.value;
}

async function click(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, clickCount: 1, x, y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, clickCount: 1, x, y });
}

function testFlowFor(node) {
  const text = `${node.id} ${node.label} ${node.detail}`.toLowerCase();
  const selectors = ["#renderCanvas", "#details"];
  const steps = [
    `Open ${targetUrl}`,
    "Wait until #statusbar contains Loaded.",
    "Use context search or click the node/label in the canvas.",
    "Verify #details h1 matches the selected node label and metadata/details are readable.",
  ];
  if (text.includes("context") || text.includes("search")) {
    selectors.push("#contextSearchBox", "#contextSearchButton");
    steps.push("Type a question in #contextSearchBox, click #contextSearchButton, and verify related nodes get highlighted.");
  }
  if (text.includes("comment") || node.group === "quality") {
    selectors.push("#testCommentButton", "#testCommentForm", "#testCommentText");
    steps.push("Move the node to a testing workflow state, click Add test comment, write a human/agent note, and verify it persists after reload.");
  }
  if (text.includes("toolbar") || text.includes("menu")) {
    selectors.push("#menuToggle", "#topbar", "#toolbarBody");
    steps.push("Click #menuToggle twice and verify the left menu collapses and expands.");
  }
  if (text.includes("label")) {
    selectors.push("#showAllLabels");
    steps.push("Enable #showAllLabels and click a label plaque; details should load the same node.");
  }
  if (text.includes("slider") || text.includes("cognitive")) {
    selectors.push("#cognitiveSlider", "#cognitiveValue");
    steps.push("Move #cognitiveSlider and verify #cognitiveValue plus label density change.");
  }
  return {
    actor: "browser-qa-agent",
    fixer: "fixer-agent",
    url: targetUrl,
    selectors,
    steps,
    expected: "The feature is visible, clickable, and updates the graph details/status without console exceptions.",
  };
}

async function runUiAssertions(cdp) {
  const base = await evalInPage(cdp, `(() => ({
    loaded: document.getElementById("statusbar")?.textContent.includes("Loaded"),
    hasContextSearch: !!document.getElementById("contextSearchBox"),
    hasMenuToggle: !!document.getElementById("menuToggle"),
    hasDetails: !!document.getElementById("details"),
    hasCanvas: !!document.getElementById("renderCanvas")
  }))()`);
  assert.deepEqual(base, {
    loaded: true,
    hasContextSearch: true,
    hasMenuToggle: true,
    hasDetails: true,
    hasCanvas: true,
  });
  const point = await evalInPage(cdp, "window.__graphUi3dTest?.firstVisibleNodePoint()");
  assert.ok(point?.label, "click point should exist");
  await click(cdp, point.x, point.y);
  await waitFor(async () => await evalInPage(cdp, "window.__graphUi3dTest?.detailsTitle()") === point.label, 12000, "node details after click");
  await evalInPage(cdp, `(() => {
    const input = document.getElementById("contextSearchBox");
    input.value = "toolbar label search";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("contextSearchButton").click();
    return true;
  })()`);
  const highlighted = await waitFor(async () => await evalInPage(cdp, "document.getElementById('statusbar')?.textContent.includes('Context search highlighted')"), 12000, "context search highlight status");
  assert.equal(highlighted, true);
  await evalInPage(cdp, "document.getElementById('menuToggle').click()");
  assert.equal(await evalInPage(cdp, "document.getElementById('topbar').classList.contains('collapsed')"), true);
  await evalInPage(cdp, "document.getElementById('menuToggle').click()");
  assert.equal(await evalInPage(cdp, "document.getElementById('topbar').classList.contains('collapsed')"), false);
  const exceptions = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown");
  assert.equal(exceptions.length, 0, "browser runtime should have no exceptions");
}

const cdp = await openBrowser();
let uiResult = { pass: true, summary: "core browser controls passed", area: "graph-ui/public/js/babylon-3d.js" };
try {
  await runUiAssertions(cdp);
} catch (error) {
  uiResult = { pass: false, summary: error.message, area: "graph-ui public UI scripts" };
} finally {
  cdp.close();
}

const graph = await fetchJson(`${appBase}/api/graph-model/${encodeURIComponent(graphId)}`);
for (const node of graph.nodes) {
  const testFlow = testFlowFor(node);
  const result = node.group === "ui" || node.group === "ux" || node.group === "quality" || node.group === "visual"
    ? uiResult
    : { pass: true, summary: "test flow documented; no direct browser control required for this metadata node", area: "graph data/model" };
  await postEdit(node, testFlow, result);
}

if (!uiResult.pass) {
  console.log(`agent cycle fail: ${uiResult.summary}`);
  process.exit(1);
}

console.log(`agent cycle ok: wrote testFlow/testComments for ${graph.nodes.length} nodes`);
