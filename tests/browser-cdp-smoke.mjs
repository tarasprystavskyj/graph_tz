import assert from "node:assert/strict";

const targetUrl = process.env.GRAPH_UI_URL || "http://127.0.0.1:8173/babylon-3d.html?graph=current-project-learning&physics=off";
const cdpHost = process.env.CDP_HOST || "127.0.0.1";
const cdpPort = process.env.CDP_PORT || "9222";
const endpoint = `http://${cdpHost}:${cdpPort}`;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

async function createTarget() {
  try {
    return await fetchJson(`${endpoint}/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" });
  } catch (error) {
    console.log(`browser CDP smoke skipped: Chrome DevTools is not available at ${endpoint}.`);
    process.exit(0);
  }
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
    ws.addEventListener("open", () => {
      resolve({
        events,
        close: () => ws.close(),
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((done) => pending.set(id, done));
        },
      });
    });
    ws.addEventListener("error", reject);
  });
}

async function waitFor(condition, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await condition();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("Timed out waiting for browser condition");
}

const target = await createTarget();
const cdp = await connect(target.webSocketDebuggerUrl);
try {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: targetUrl });
  await waitFor(() => cdp.events.some((event) => event.method === "Page.loadEventFired"));
  const result = await waitFor(async () => {
    const response = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const status = document.getElementById("statusbar")?.textContent || "";
        return {
          ready: status.includes("Loaded") && !!window.__graphUi3dTest,
          title: document.title,
          hasCanvas: !!document.getElementById("renderCanvas"),
          hasCognitiveSlider: !!document.getElementById("cognitiveSlider"),
          hasWorkflowFilter: !!document.getElementById("workflowFilter"),
          hasContextSearch: !!document.getElementById("contextSearchBox"),
          hasMenuToggle: !!document.getElementById("menuToggle"),
          hasCxtmenuBridge: !!document.getElementById("cxtmenuBridge"),
          physicsChecked: !!document.getElementById("togglePhysics")?.checked,
          hasTreeButtonsSource: [...document.scripts].some((script) => script.src.includes("babylon-3d.js")),
          babylonLoaded: !!window.BABYLON,
          cytoscapeLoaded: !!window.cytoscape,
          status
        };
      })()`,
      returnByValue: true,
    });
    const value = response.result?.result?.value;
    return value?.ready ? value : null;
  });
  assert.equal(result.hasCanvas, true, "3D page should include render canvas");
  assert.equal(result.hasCognitiveSlider, true, "3D page should include cognitive slider");
  assert.equal(result.hasWorkflowFilter, true, "3D page should include workflow filter");
  assert.equal(result.hasContextSearch, true, "3D page should include context search");
  assert.equal(result.hasMenuToggle, true, "3D page should include menu collapse toggle");
  assert.equal(result.hasCxtmenuBridge, true, "3D page should include cxtmenu bridge");
  assert.equal(result.physicsChecked, false, "browser tests should start with physics checkbox off");
  assert.equal(result.hasTreeButtonsSource, true, "3D page should load local script");
  assert.equal(result.babylonLoaded, true, "Babylon CDN should load in browser");
  assert.equal(result.cytoscapeLoaded, true, "Cytoscape CDN should load in browser");
  const pointResponse = await cdp.send("Runtime.evaluate", {
    expression: "window.__graphUi3dTest?.firstVisibleNodePoint()",
    returnByValue: true,
  });
  const point = pointResponse.result?.result?.value;
  assert.ok(point?.label, "3D test hook should expose a clickable node point");
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, clickCount: 1, x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, clickCount: 1, x: point.x, y: point.y });
  const clicked = await waitFor(async () => {
    const response = await cdp.send("Runtime.evaluate", {
      expression: "window.__graphUi3dTest?.detailsTitle()",
      returnByValue: true,
    });
    return response.result?.result?.value === point.label ? response.result.result.value : null;
  }, 5000);
  assert.equal(clicked, point.label, "clicking a visible node should load that node's details");
  const rightClickPointResponse = await cdp.send("Runtime.evaluate", {
    expression: "window.__graphUi3dTest?.firstVisibleNodePoint()",
    returnByValue: true,
  });
  const rightClickPoint = rightClickPointResponse.result?.result?.value || point;
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rightClickPoint.x, y: rightClickPoint.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "right", buttons: 2, clickCount: 1, x: rightClickPoint.x, y: rightClickPoint.y });
  const rightPressResult = await cdp.send("Runtime.evaluate", {
    expression: `(() => ({
      visible: window.__graphUi3dTest?.cxtmenuVisible?.() === true,
      ready: window.__graphUi3dTest?.cxtmenuReady?.() === true
    }))()`,
    returnByValue: true,
  });
  assert.equal(rightPressResult.result?.result?.value?.ready, true, "cytoscape-cxtmenu bridge should be ready");
  assert.equal(rightPressResult.result?.result?.value?.visible, true, "real right-button mousePressed should open cytoscape-cxtmenu");
  const nativeContextResult = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("renderCanvas");
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: ${rightClickPoint.x},
        clientY: ${rightClickPoint.y},
        button: 2,
        buttons: 2
      });
      return { prevented: !canvas.dispatchEvent(event) };
    })()`,
    returnByValue: true,
  });
  assert.equal(nativeContextResult.result?.result?.value?.prevented, true, "native contextmenu should still be prevented");
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", button: "right", buttons: 2, x: rightClickPoint.x - 44, y: rightClickPoint.y - 100 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "right", buttons: 0, clickCount: 1, x: rightClickPoint.x - 44, y: rightClickPoint.y - 100 });
  const touchTapResult = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      const canvas = document.getElementById("renderCanvas");
      const point = window.__graphUi3dTest?.firstVisibleNodePoint() || { x: ${rightClickPoint.x}, y: ${rightClickPoint.y}, label: ${JSON.stringify(rightClickPoint.label || "")} };
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
        pointerId: 8,
        clientX: point.x,
        clientY: point.y
      }));
      canvas.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
        pointerId: 8,
        clientX: point.x,
        clientY: point.y
      }));
      await new Promise((resolve) => setTimeout(resolve, 80));
      return {
        label: point.label,
        detailsTitle: window.__graphUi3dTest?.detailsTitle?.(),
        menuVisible: window.__graphUi3dTest?.cxtmenuVisible?.() === true
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  assert.equal(touchTapResult.result?.result?.value?.detailsTitle, touchTapResult.result?.result?.value?.label, "short touch tap should focus on pointerup");
  assert.equal(touchTapResult.result?.result?.value?.menuVisible, false, "short touch tap should not open cxtmenu");
  const longPressResult = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      const canvas = document.getElementById("renderCanvas");
      const point = window.__graphUi3dTest?.firstVisibleNodePoint() || { x: ${rightClickPoint.x}, y: ${rightClickPoint.y} };
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
        pointerId: 7,
        clientX: point.x,
        clientY: point.y
      }));
      await new Promise((resolve) => setTimeout(resolve, 640));
      const visibleBeforeRelease = window.__graphUi3dTest?.cxtmenuVisible?.() === true;
      canvas.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
        pointerId: 7,
        clientX: point.x,
        clientY: point.y
      }));
      return {
        visibleBeforeRelease,
        visibleAfterRelease: window.__graphUi3dTest?.cxtmenuVisible?.() === true
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  assert.equal(longPressResult.result?.result?.value?.visibleBeforeRelease, true, "touch long-pressing a visible node should open cytoscape-cxtmenu before release");
  assert.equal(longPressResult.result?.result?.value?.visibleAfterRelease, false, "touch release should close cytoscape-cxtmenu");
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const labels = document.getElementById("showAllLabels");
      labels.checked = true;
      labels.dispatchEvent(new Event("change", { bubbles: true }));
    })()`,
  });
  const labelPointResponse = await waitFor(async () => {
    const response = await cdp.send("Runtime.evaluate", {
      expression: "window.__graphUi3dTest?.visibleLabelPoint()",
      returnByValue: true,
    });
    return response.result?.result?.value?.label ? response.result.result.value : null;
  }, 5000);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: labelPointResponse.x, y: labelPointResponse.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, clickCount: 1, x: labelPointResponse.x, y: labelPointResponse.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, clickCount: 1, x: labelPointResponse.x, y: labelPointResponse.y });
  const labelClicked = await waitFor(async () => {
    const response = await cdp.send("Runtime.evaluate", {
      expression: "window.__graphUi3dTest?.detailsTitle()",
      returnByValue: true,
    });
    return response.result?.result?.value === labelPointResponse.label ? response.result.result.value : null;
  }, 5000);
  assert.equal(labelClicked, labelPointResponse.label, "clicking a visible label should load that node's details");
  const consoleErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown");
  assert.equal(consoleErrors.length, 0, "browser should not report runtime exceptions");
  console.log(`browser CDP smoke ok: ${result.title}; ${result.status}`);
} finally {
  cdp.close();
}
