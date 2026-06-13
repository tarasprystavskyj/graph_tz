import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const graphUiRoot = resolve(root, "graph-ui");
const smokeEditPath = resolve(graphUiRoot, "data", "graph-edits", "smoke-test.json");
const smokeUploadPath = resolve(graphUiRoot, "data", "uploads", "smoke-test");
const graphPath = resolve(
  root,
  "happyuser-visual_link_analisis-c4307a2aa7f8",
  "sample_graphs",
  "job_apply_full_tz_cytoscape.json",
);
const learningGraphPath = resolve(
  root,
  "graph-ui",
  "public",
  "data",
  "current_project_learning_cytoscape.json",
);

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const freePort = address.port;
      server.close(() => resolvePort(freePort));
    });
  });
}

function request(port, pathname, options = {}) {
  return new Promise((resolveResponse, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolveResponse({ statusCode: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`Timed out requesting ${pathname}`));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function waitForServer(child) {
  return new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start in time")), 5000);

    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Graph UI server listening")) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    child.on("exit", (code) => {
      reject(new Error(`Server exited before smoke test completed with code ${code}`));
    });
  });
}

const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const learningGraph = JSON.parse(readFileSync(learningGraphPath, "utf8"));
const agentGuide = readFileSync(resolve(root, "AGENT.md"), "utf8");
await rm(smokeEditPath, { force: true });
await rm(smokeUploadPath, { force: true, recursive: true });
assert.ok(Array.isArray(graph.elements.nodes), "graph nodes must be an array");
assert.ok(Array.isArray(graph.elements.edges), "graph edges must be an array");
assert.ok(graph.elements.nodes.length > 0, "graph must contain nodes");
assert.ok(graph.elements.edges.length > 0, "graph must contain edges");
assert.ok(graph.elements.nodes.every((node) => node.data?.id), "every node needs data.id");
assert.ok(
  graph.elements.edges.every((edge) => edge.data?.source && edge.data?.target),
  "every edge needs data.source and data.target",
);
assert.equal(learningGraph.schema, "job.graph_ui.current_project_learning.v0");
assert.ok(learningGraph.elements.nodes.length >= 12, "learning graph should contain enough tutorial nodes");
assert.ok(learningGraph.elements.edges.length >= 12, "learning graph should contain enough tutorial edges");
assert.match(agentGuide, /every new owner-requested feature must be added/, "agent guide should require graph updates for new features");

const port = await getFreePort();
const child = spawn(process.execPath, ["server.js"], {
  cwd: graphUiRoot,
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForServer(child);

  const page = await request(port, "/babylon-3d.html");
  assert.equal(page.statusCode, 200, "babylon page should be served");
  assert.match(page.body, /cdn\.babylonjs\.com\/babylon\.js/, "page documents Babylon CDN usage");
  assert.match(page.body, /cytoscape@3\.34\.0/, "3D page should load Cytoscape.js under the hood");
  assert.match(page.body, /\/js\/babylon-3d\.js/, "page should load local graph script");
  assert.match(page.body, /degreeFilter/, "3D page should include degree filter control");
  assert.match(page.body, /workflowFilter/, "3D page should include workflow status filter");
  assert.match(page.body, /font-awesome\/6\.7\.2/, "3D page should load Font Awesome icons from CDN");
  assert.match(page.body, /cxtmenuBridge/, "3D page should include cxtmenu bridge");
  assert.match(page.body, /cytoscape-cxtmenu@3\.5\.0/, "3D page should load the cytoscape-cxtmenu extension");
  assert.match(page.body, /cxtmenu-content/, "3D cxtmenu commands should use extension content slots");
  assert.doesNotMatch(page.body, /id="runLayout"/, "3D page should switch layouts directly from select");

  const cytoscapePage = await request(port, "/cytoscape-2d.html");
  assert.equal(cytoscapePage.statusCode, 200, "cytoscape page should be served");
  assert.match(cytoscapePage.body, /cytoscape\.min\.js/, "cytoscape page should load modern Cytoscape.js");
  assert.match(cytoscapePage.body, /graphSelect/, "cytoscape page should include graph menu");
  assert.match(cytoscapePage.body, /switch3d/, "cytoscape page should include 3D switch");
  assert.match(cytoscapePage.body, /development-flow/, "cytoscape page should include development flow layout");
  assert.doesNotMatch(cytoscapePage.body, /id="runLayout"/, "2D page should switch layouts directly from select");

  const flowPage = await request(port, "/flow-variant-b.html");
  assert.equal(flowPage.statusCode, 200, "flow variant B page should be served");
  assert.match(flowPage.body, /flow-variant-b\.js/, "variant B should load local script");

  const learningCytoscapePage = await request(port, "/cytoscape-2d.html?graph=current-project-learning");
  assert.equal(learningCytoscapePage.statusCode, 200, "learning cytoscape page should be served");

  const learningBabylonPage = await request(port, "/babylon-3d.html?graph=current-project-learning");
  assert.equal(learningBabylonPage.statusCode, 200, "learning babylon page should be served");

  const learningFlowPage = await request(port, "/flow-variant-b.html?graph=current-project-learning");
  assert.equal(learningFlowPage.statusCode, 200, "learning flow page should be served");

  const script = await request(port, "/js/babylon-3d.js");
  assert.equal(script.statusCode, 200, "local graph script should be served");
  assert.match(learningBabylonPage.body, /contextSearchBox/, "3D page should include context search input");
  assert.match(learningBabylonPage.body, /menuToggle/, "3D page should include collapsible left menu");
  assert.match(learningBabylonPage.body, /fa-bars/, "3D page should include hamburger icon");
  assert.match(script.body, /SPRING_STRENGTH/, "script should include force spring constants");
  assert.match(script.body, /runCytoscapeLayout/, "3D script should include Cytoscape layout bridge");
  assert.match(script.body, /applyManualLayout/, "3D script should include manual layout fallback");
  assert.match(script.body, /layoutValue === "circle"/, "3D script should explicitly handle circle layout");
  assert.match(script.body, /development-flow/, "3D script should include development flow layout");
  assert.match(script.body, /focusNodeAndPullTree/, "3D script should focus clicked nodes and pull linked tree");
  assert.match(script.body, /waitForLayout/, "3D script should wait for Cytoscape layout completion");
  assert.match(script.body, /workflowStateFallbacks/, "3D script should include workflow-state label outline colors");
  assert.match(script.body, /labelMetrics/, "3D script should size label plaques from content");
  assert.match(script.body, /drawLabelTexture/, "3D script should render visual keys on label plaques");
  assert.match(script.body, /imagePreviewRef/, "3D script should use image attachments as label previews");
  assert.match(script.body, /isUnseenNewNode/, "3D script should detect unseen new nodes");
  assert.match(script.body, /markNodeSeen/, "3D script should persist seen state after owner clicks a new node");
  assert.match(script.body, /generateTreeText/, "3D script should generate subtree text");
  assert.match(script.body, /showTreeTable/, "3D script should show subtree table");
  assert.match(script.body, /cognitiveLevel/, "3D script should include cognitive-load density control");
  assert.match(script.body, /visibleLabelBudget/, "3D script should use cognitive-load label budgets");
  assert.match(script.body, /isNodeInViewport/, "3D script should prioritize labels in the viewport");
  assert.match(script.body, /cognitiveLevel >= 4 && node\.detail/, "3D labels should add descriptions at high density");
  assert.match(script.body, /camera\.wheelPrecision = 24/, "3D mouse wheel zoom should be 50 percent more active");
  assert.match(script.body, /initCxtmenuBridge/, "3D script should initialise the cytoscape-cxtmenu bridge");
  assert.match(script.body, /cxttapstart/, "3D script should open cxtmenu on press start");
  assert.match(script.body, /cxttapend/, "3D script should select cxtmenu commands on release");
  assert.match(script.body, /setNodeWorkState\(contextNode, "testing"\)/, "3D cxtmenu should include testing state action");
  assert.match(script.body, /setNodeWorkState\(contextNode, "needed"\)/, "3D cxtmenu should include needed state action");
  assert.match(script.body, /setNodeWorkState\(contextNode, "done"\)/, "3D cxtmenu should include done state action");
  assert.match(script.body, /pointerType/, "3D context menu should support touch or pen long-press");
  assert.match(script.body, /startWithPhysicsPaused/, "3D script should allow browser tests to start with physics paused");
  assert.match(script.body, /runContextSearch/, "3D script should include contextual agent search");
  assert.match(script.body, /saveTestComment/, "3D script should save testing comments");
  assert.match(script.body, /animateCameraToNode/, "3D script should animate node focus camera movement");
  assert.match(script.body, /labelPosition/, "3D script should keep labels in front of nodes");
  assert.match(script.body, /workflowDescriptions/, "3D script should explain workflow states");
  assert.doesNotMatch(script.body, /GlowLayer/, "3D script should not use glow layer for work-state labels");
  assert.match(script.body, /graph-edits/, "3D script should save node edits");

  const cytoscapeScript = await request(port, "/js/cytoscape-2d.js");
  assert.equal(cytoscapeScript.statusCode, 200, "cytoscape script should be served");
  assert.match(cytoscapeScript.body, /layoutOptions/, "cytoscape script should include layout controls");
  assert.match(cytoscapeScript.body, /visualBadgeDataUrl/, "cytoscape script should render visual key badges");
  assert.match(cytoscapeScript.body, /applyDevelopmentFlow/, "cytoscape script should include development flow layout");

  const flowScript = await request(port, "/js/flow-variant-b.js");
  assert.equal(flowScript.statusCode, 200, "flow variant script should be served");
  assert.match(flowScript.body, /drawMinimap/, "variant B should include minimap rendering");
  assert.match(flowScript.body, /preview-badge/, "variant B should include visual key preview badges");

  const api = await request(port, "/api/graphs/job-apply-full");
  assert.equal(api.statusCode, 200, "graph API should be served");
  const servedGraph = JSON.parse(api.body);
  assert.equal(servedGraph.elements.nodes.length, graph.elements.nodes.length, "served node count should match");
  assert.equal(servedGraph.elements.edges.length, graph.elements.edges.length, "served edge count should match");

  const normalized = await request(port, "/api/normalized-graphs/job-apply-full");
  assert.equal(normalized.statusCode, 200, "normalized graph API should be served");
  const normalizedGraph = JSON.parse(normalized.body);
  assert.equal(normalizedGraph.schema, "job_apply_tz.normalized_graph.v0");
  assert.ok(normalizedGraph.nodes.every((node) => node.agentBranch?.branchId), "nodes should have agent branches");
  assert.ok(normalizedGraph.nodes.every((node) => node.preview?.label), "nodes should have preview slots");

  const graphModel = await request(port, "/api/graph-model/job-apply-full");
  assert.equal(graphModel.statusCode, 200, "enriched graph model API should be served");
  const graphModelJson = JSON.parse(graphModel.body);
  assert.equal(graphModelJson.schema, "job.graph_ui_model.v0");
  assert.ok(graphModelJson.nodes.every((node) => node.visualKey?.label), "graph-model nodes should have visual keys");
  assert.ok(graphModelJson.nodes.every((node) => node.visualKey?.symbol), "graph-model nodes should have visual key symbols");
  assert.ok(graphModelJson.nodes.every((node) => Array.isArray(node.keywords) && node.keywords.length), "graph-model nodes should have keyword icon cues");
  assert.ok(Array.isArray(graphModelJson.workflowStates) && graphModelJson.workflowStates.length >= 7, "graph-model should expose workflow states");

  const learningRaw = await request(port, "/api/graphs/current-project-learning");
  assert.equal(learningRaw.statusCode, 200, "learning raw graph API should be served");
  const learningRawJson = JSON.parse(learningRaw.body);
  assert.equal(learningRawJson.schema, "job.graph_ui.current_project_learning.v0");
  assert.ok(
    learningRawJson.elements.nodes.some((node) => node.data?.id === "task:3d_cytoscape_underhood"),
    "learning graph should include delegated 3D task",
  );
  assert.ok(
    learningRawJson.elements.nodes.some((node) => node.data?.id === "task:browser_qa_agent"),
    "learning graph should include delegated browser QA task",
  );
  assert.ok(
    learningRawJson.elements.nodes.some((node) => node.data?.id === "task:visual_key_best_practices"),
    "learning graph should include delegated visual UX task",
  );
  assert.ok(
    learningRawJson.elements.nodes.some((node) => node.data?.work_state === "testing"),
    "learning graph should include a yellow testing work-state node",
  );
  assert.ok(
    learningRawJson.elements.nodes.some((node) => node.data?.id === "task:cognitive_load_slider"),
    "learning graph should include cognitive-load slider task",
  );
  assert.ok(
    learningRawJson.elements.nodes.some((node) => node.data?.id === "task:new_node_seen_blink" && node.data?.is_new === true),
    "learning graph should include unseen new-node blink task",
  );
  for (const id of [
    "task:contextual_agent_search",
    "task:test_comment_form",
    "task:superpowers_flow_research",
    "task:labels_camera_front",
    "task:workflow_status_explainer",
    "task:left_icon_toolbar",
    "task:focus_camera_animation",
    "task:cxtmenu_style_inheritance",
    "task:mobile_long_press_menu",
    "task:zoom_wheel_sensitivity",
    "task:cognitive_label_density_budget",
    "task:cxtmenu_extension_gesture_agent",
  ]) {
    assert.ok(
      learningRawJson.elements.nodes.some((node) => node.data?.id === id && node.data?.is_new === true),
      `learning graph should include new task ${id}`,
    );
  }

  const learningNormalized = await request(port, "/api/normalized-graphs/current-project-learning");
  assert.equal(learningNormalized.statusCode, 200, "learning normalized graph API should be served");
  const learningNormalizedJson = JSON.parse(learningNormalized.body);
  assert.ok(
    learningNormalizedJson.nodes.some((node) => node.id === "learn:goal"),
    "learning normalized graph should include the tutorial goal",
  );

  const learningModel = await request(port, "/api/graph-model/current-project-learning");
  assert.equal(learningModel.statusCode, 200, "learning graph model API should be served");
  const learningModelJson = JSON.parse(learningModel.body);
  assert.ok(
    learningModelJson.nodes.every((node) => node.agentBranch?.subtreeRoot),
    "learning graph-model nodes should include agent branch attach points",
  );

  const superpower = await request(port, "/api/superpower-flow");
  assert.equal(superpower.statusCode, 200, "superpower placeholder should be served");
  assert.equal(JSON.parse(superpower.body).schema, "job_apply_tz.superpower_flow.placeholder.v0");

  const markmap = await request(port, "/api/exports/markmap.md");
  assert.equal(markmap.statusCode, 200, "markmap export should be served");
  assert.match(markmap.body, /^# JobApply TZ graph/m);
  assert.match(markmap.body, /branch:/);

  const opml = await request(port, "/api/exports/job-apply-tz.opml");
  assert.equal(opml.statusCode, 200, "opml export should be served");
  assert.match(opml.body, /<opml version="2.0">/);
  assert.match(opml.body, /agentBranch=/);

  const freemind = await request(port, "/api/exports/job-apply-tz.mm");
  assert.equal(freemind.statusCode, 200, "freemind export should be served");
  assert.match(freemind.body, /<map version="1.0.1">/);
  assert.match(freemind.body, /<richcontent TYPE="NOTE">/);

  const modelMarkmap = await request(port, "/api/exports/job-apply-full/markmap");
  assert.equal(modelMarkmap.statusCode, 200, "graph-model markmap export should be served");
  assert.match(modelMarkmap.body, /visual key:/);

  const modelOpml = await request(port, "/api/exports/job-apply-full/opml");
  assert.equal(modelOpml.statusCode, 200, "graph-model opml export should be served");
  assert.match(modelOpml.body, /<opml version="2.0">/);

  const modelFreemind = await request(port, "/api/exports/job-apply-full/freemind");
  assert.equal(modelFreemind.statusCode, 200, "graph-model freemind export should be served");
  assert.match(modelFreemind.body, /<map version="1.0.1">/);

  const learningMarkmap = await request(port, "/api/exports/current-project-learning/markmap");
  assert.equal(learningMarkmap.statusCode, 200, "learning markmap export should be served");
  assert.match(learningMarkmap.body, /Task: 3D uses Cytoscape under hood/);

  const editPayload = JSON.stringify({
    label: "Smoke edited node",
    detail: "Smoke edit detail",
    attachments: [
      {
        name: "smoke.txt",
        type: "text/plain",
        dataUrl: `data:text/plain;base64,${Buffer.from("smoke attachment", "utf8").toString("base64")}`,
      },
    ],
    workState: "testing",
    workflowState: "ready_for_test",
    seenAt: "2026-06-13T00:00:00.000Z",
    testFlow: {
      actor: "browser-qa-agent",
      selectors: ["#renderCanvas", "#details"],
      steps: ["Click a graph node", "Verify details load"],
      expected: "Details panel shows the node title",
    },
    testComments: [{ text: "Smoke human verification comment", role: "human" }],
  });
  const edit = await request(port, "/api/graph-edits/smoke-test/smoke%3Anode", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(editPayload),
    },
    body: editPayload,
  });
  assert.equal(edit.statusCode, 200, "graph edit endpoint should save node edits");
  const editJson = JSON.parse(edit.body);
  assert.equal(editJson.ok, true);
  assert.equal(editJson.edit.workState, "testing");
  assert.equal(editJson.edit.workflowState, "ready_for_test");
  assert.equal(editJson.edit.seenAt, "2026-06-13T00:00:00.000Z");
  assert.equal(editJson.edit.testFlow.actor, "browser-qa-agent");
  assert.equal(editJson.edit.testComments[0].text, "Smoke human verification comment");
  assert.ok(editJson.edit.attachments[0].url.includes("/graph-data/uploads/smoke-test/"));
} finally {
  child.kill();
  await rm(smokeEditPath, { force: true });
  await rm(smokeUploadPath, { force: true, recursive: true });
}

console.log(`smoke ok: ${graph.elements.nodes.length} nodes, ${graph.elements.edges.length} edges`);
