(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const graphId = params.get("graph") || "job-apply-full";
  const startWithPhysicsPaused = ["off", "paused", "false", "0"].includes(String(params.get("physics") || "").toLowerCase());
  const BASE_PATH = window.GRAPH_UI_BASE_PATH || "";
  const appUrl = (path) => `${BASE_PATH}${path}`;
  const i18n = window.GraphUiI18n || {
    lang: "uk",
    t: (key) => key,
    withLang: (url) => url,
    apiUrl: (path) => appUrl(path),
    translatePage() {},
    wireLanguageSelect() {},
  };
  const GRAPH_URL = i18n.apiUrl(`/api/graph-model/${encodeURIComponent(graphId)}`);
  const INITIAL_SPREAD = 0.044;
  const Z_SPREAD = 46;
  const CENTER_GRAVITY = 0.0035;
  const REPULSION = 82;
  const SPRING_LENGTH = 34;
  const SPRING_STRENGTH = 0.0065;
  const DAMPING = 0.86;
  const MAX_SPEED = 2.4;
  const NODE_RADIUS = 2.2;
  const workflowStateFallbacks = [
    { id: "not_done", label: "1. Not done", color: "#ef4444" },
    { id: "approved", label: "2. Approved for work", color: "#f97316" },
    { id: "in_progress", label: "3. In progress", color: "#f59e0b", animateTo: "#facc15" },
    { id: "ready_for_test", label: "4. Ready for testing", color: "#facc15" },
    { id: "testing_agent", label: "5. Agent testing", color: "#facc15", animateTo: "#a3e635" },
    { id: "tested_agent", label: "6. Agent verified", color: "#a3e635" },
    { id: "tested_human", label: "7. Human verified", color: "#22c55e" },
  ];

  const fallbackColors = {
    project: "#256f55",
    product: "#256f55",
    learn: "#2f855a",
    discovery: "#2f855a",
    platform: "#3a9f71",
    data: "#437f97",
    safety: "#b7791f",
    operations: "#c05621",
    ui: "#5a67d8",
    interface: "#5a67d8",
    visual: "#b7791f",
    observability: "#718096",
    quality: "#805ad5",
    agent_branch: "#0f766e",
    next: "#d69e2e",
  };

  const canvas = document.getElementById("renderCanvas");
  const details = document.getElementById("details");
  const statusbar = document.getElementById("statusbar");
  const hoverLabel = document.getElementById("hoverLabel");
  const cxtmenuBridge = document.getElementById("cxtmenuBridge");
  const contextMenu = document.getElementById("contextMenu");
  const contextWorkflowState = document.getElementById("contextWorkflowState");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsPanel = document.getElementById("settingsPanel");
  const contextMenuStyleSelect = document.getElementById("contextMenuStyleSelect");
  const topbar = document.getElementById("topbar");
  const menuToggle = document.getElementById("menuToggle");
  const timePanel = document.getElementById("timePanel");
  const mapPanel = document.getElementById("mapPanel");
  const graphSelect = document.getElementById("graphSelect");
  const switchView = document.getElementById("switchView");
  const layoutSelect = document.getElementById("layoutSelect");
  const togglePhysics = document.getElementById("togglePhysics");
  const resetLayout = document.getElementById("resetLayout");
  const showAllLabels = document.getElementById("showAllLabels");
  const showTimePanel = document.getElementById("showTimePanel");
  const showMap = document.getElementById("showMap");
  const groupFilter = document.getElementById("groupFilter");
  const workflowFilter = document.getElementById("workflowFilter");
  const cognitiveSlider = document.getElementById("cognitiveSlider");
  const cognitiveValue = document.getElementById("cognitiveValue");
  const degreeFilter = document.getElementById("degreeFilter");
  const searchBox = document.getElementById("searchBox");
  const contextSearchBox = document.getElementById("contextSearchBox");
  const contextSearchButton = document.getElementById("contextSearchButton");
  const legend = document.getElementById("legend");
  const trashButton = document.getElementById("trashButton");
  const trashCount = document.getElementById("trashCount");
  const trashPanel = document.getElementById("trashPanel");
  const trashConfirm = document.getElementById("trashConfirm");
  const trashConfirmText = document.getElementById("trashConfirmText");
  const trashCancel = document.getElementById("trashCancel");
  const trashConfirmButton = document.getElementById("trashConfirmButton");

  let engine;
  let scene;
  let camera;
  let graphState;
  let physicsPaused = startWithPhysicsPaused;
  let labelsVisible = false;
  let pinnedNode = null;
  let hoveredNode = null;
  let contextNode = null;
  let cxtmenuCy = null;
  let cxtmenuProxy = null;
  let cxtmenuGesture = null;
  let focusPullRoot = null;
  let focusPullDistances = new Map();
  let activeGroup = "";
  let activeWorkflow = "";
  let activeSearch = "";
  let activeDegree = 0;
  let frameTick = 0;
  let cognitiveLevel = 3;
  let contextSearchTerms = [];
  let cameraTween = null;
  let pendingTrashNode = null;
  let contextMenuStyle = localStorage.getItem("graphUiContextMenuStyle") === "html" ? "html" : "cytoscape";
  const workflowDescriptions = {
    not_done: i18n.lang === "uk" ? "Фіча або задача відома, але ще не реалізована." : "Feature/task is known but not implemented yet.",
    approved: i18n.lang === "uk" ? "Власник або lead заапрувив її в роботу." : "Owner or lead approved it for implementation.",
    in_progress: i18n.lang === "uk" ? "Агент активно працює; контур анімується з оранжевого у жовтий." : "Agent is actively working; outline animates orange to yellow.",
    ready_for_test: i18n.lang === "uk" ? "Реалізація готова для фокусного тестування." : "Implementation is ready for a focused test pass.",
    testing_agent: i18n.lang === "uk" ? "Агент тестує зараз; контур анімується з жовтого у салатовий." : "Agent is testing it now; outline animates yellow to light green.",
    tested_agent: i18n.lang === "uk" ? "Агент перевірив і записав evidence або результат тесту." : "Agent verified it and recorded evidence or a test result.",
    tested_human: i18n.lang === "uk" ? "Людина перевірила; це найсильніший done-сигнал." : "Human verified it; this is the strongest done signal.",
  };

  function setStatus(message) {
    statusbar.textContent = message;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hexToColor3(hex) {
    const clean = String(hex || "#6b7280").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const value = Number.parseInt(full, 16);
    if (Number.isNaN(value)) return BABYLON.Color3.FromHexString("#6b7280");
    return new BABYLON.Color3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
  }

  function normalizeGraphModel(payload) {
    const rawNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
    const rawEdges = Array.isArray(payload?.edges) ? payload.edges : [];
    const groups = payload.groups || {};
    const degree = new Map(rawNodes.map((node) => [node.id, 0]));
    for (const edge of rawEdges) {
      degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    }

    const nodes = rawNodes.map((data, index) => {
      const angle = index * 2.3999632297;
      const position = data.position || {};
      return {
        id: data.id,
        label: data.label || data.id,
        detail: data.detail || "",
        group: data.group || "unknown",
        groupLabel: data.groupLabel || groups[data.group]?.label || data.group || "Unknown",
        status: data.status || "",
        workState: data.workState || "",
        workflowState: data.workflowState || data.workState || "not_done",
        owner: data.owner || "",
        type: data.type || "",
        priority: data.priority || "",
        color: data.color || fallbackColors[data.group] || "#6b7280",
        icon: data.icon || "",
        visualKey: data.visualKey || null,
        keywords: data.keywords || [],
        isNew: Boolean(data.isNew),
        seenAt: data.seenAt || "",
        testComments: data.testComments || [],
        contextScore: 0,
        agentBranch: data.agentBranch || null,
        attachments: data.attachments || [],
        degree: degree.get(data.id) || 0,
        position: new BABYLON.Vector3(
          Number.isFinite(position.x) ? position.x * INITIAL_SPREAD : Math.cos(angle) * 30,
          Number.isFinite(position.y) ? -position.y * INITIAL_SPREAD : Math.sin(angle) * 30,
          Math.sin(angle * 1.7) * Z_SPREAD,
        ),
        velocity: BABYLON.Vector3.Zero(),
        basePosition: null,
        mesh: null,
        labelPlane: null,
        material: null,
        visibleByFilter: true,
      };
    });

    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = rawEdges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({ ...edge, mesh: null }));

    return {
      nodes,
      edges,
      groups,
      workflowStates: payload.workflowStates || workflowStateFallbacks,
      trash: payload.trash || { nodes: [] },
      nodeById: new Map(nodes.map((node) => [node.id, node])),
    };
  }

  function createTextPlane(node) {
    const metrics = labelMetrics(node);
    node.labelMetrics = metrics;
    const texture = new BABYLON.DynamicTexture(`label:${node.id}`, { width: metrics.width, height: metrics.height }, scene, false);
    texture.hasAlpha = true;
    drawLabelTexture(texture, node, metrics);
    const plane = BABYLON.MeshBuilder.CreatePlane(`label-plane:${node.id}`, { width: metrics.planeWidth, height: metrics.planeHeight }, scene);
    const material = new BABYLON.StandardMaterial(`label-mat:${node.id}`, scene);
    material.diffuseTexture = texture;
    material.emissiveColor = new BABYLON.Color3(0.72, 0.72, 0.72);
    material.opacityTexture = texture;
    plane.material = material;
    plane.position.copyFrom(labelPosition(node));
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = true;
    plane.metadata = { kind: "node-label", node };
    plane.setEnabled(false);
    node.labelPlane = plane;
    loadPreviewImageForLabel(node);
  }

  function labelPosition(node) {
    const cameraDirection = camera
      ? camera.position.subtract(node.position).normalize().scale(NODE_RADIUS * 0.5)
      : BABYLON.Vector3.Zero();
    return node.position.add(new BABYLON.Vector3(0, 3.4, 0)).add(cameraDirection);
  }

  function loadPreviewImageForLabel(node) {
    const ref = imagePreviewRef(node);
    if (!ref || node.previewImageSrc === ref) return;
    node.previewImageSrc = ref;
    const image = new Image();
    image.onload = () => {
      node.previewImage = image;
      redrawLabelTexture(node);
    };
    image.src = assetUrl(ref);
  }

  function imagePreviewRef(node) {
    if (node.visualKey?.artifactRef && String(node.visualKey.type || "").startsWith("image/")) return node.visualKey.artifactRef;
    const latestImage = [...(node.attachments || [])].reverse().find((item) => String(item.type || "").startsWith("image/"));
    return latestImage?.url || "";
  }

  function assetUrl(ref) {
    if (!ref || /^https?:\/\//i.test(ref)) return ref || "";
    return ref.startsWith("/") ? appUrl(ref) : ref;
  }

  function labelMetrics(node) {
    const key = node.visualKey || {};
    const labelLength = String(node.label || "").length;
    const detailLength = cognitiveLevel >= 4 ? String(node.detail || "").length : 0;
    const keyLength = String(key.label || node.groupLabel || node.group || "").length;
    const keywordLength = (node.keywords || []).slice(0, 4).reduce((sum, item) => sum + String(item.term || "").length, 0);
    const textWidth = Math.max(labelLength * 18, keyLength * 11, keywordLength * 11, Math.min(80, detailLength) * 9);
    const width = Math.min(1024, Math.max(cognitiveLevel <= 1 ? 260 : 430, 188 + textWidth * (cognitiveLevel >= 4 ? 1.1 : 0.9)));
    const detailHeight = cognitiveLevel >= 5 ? 92 : cognitiveLevel >= 4 ? 54 : 0;
    const baseHeight = cognitiveLevel <= 1 ? 136 : labelLength > 42 || (node.keywords || []).length ? 248 : 184;
    const height = Math.min(372, baseHeight + detailHeight);
    return {
      width,
      height,
      planeWidth: width / 40,
      planeHeight: height / 40,
    };
  }

  function drawLabelTexture(texture, node, metrics) {
    const ctx = texture.getContext();
    const key = node.visualKey || {};
    const level = Math.max(1, Math.min(cognitiveLevel, node.detailLevel || cognitiveLevel));
    const width = metrics.width;
    const height = metrics.height;
    const unseen = isUnseenNewNode(node);
    const state = workflowStateFor(node.workflowState);
    const borderColor = node.contextScore > 0 ? contextHighlightColor(node.contextScore) : unseen ? animatedRed() : animatedStateColor(state);
    ctx.clearRect(0, 0, width, height);
    roundRect(ctx, 8, 12, width - 16, height - 32, 22);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = state ? 8 : 3;
    ctx.stroke();

    const badgeSize = Math.min(104, height - 52);
    const badgeX = 28;
    const badgeY = 34;
    drawBadge(ctx, node, badgeX, badgeY, badgeSize);

    ctx.textAlign = "left";
    ctx.fillStyle = "#111827";
    ctx.font = "bold 34px Arial";
    ctx.textBaseline = "alphabetic";
    const textX = badgeX + badgeSize + 24;
    const available = width - textX - 30;
    const lines = wrapText(ctx, String(node.label || node.id), available, level >= 4 && height > 190 ? 2 : 1);
    lines.forEach((line, index) => ctx.fillText(line, textX, 66 + index * 36));
    let lowerY = height - 62;
    if (level >= 4 && node.detail) {
      ctx.fillStyle = "#334155";
      ctx.font = "20px Arial";
      const maxDetailLines = level >= 5 ? 2 : 1;
      const detailLines = wrapText(ctx, String(node.detail), available, maxDetailLines);
      detailLines.forEach((line, index) => ctx.fillText(line, textX, 132 + index * 27));
      lowerY = height - 66;
    }
    if (level >= 2) {
      ctx.fillStyle = "#475569";
      ctx.font = "22px Arial";
      ctx.fillText(fitText(ctx, String(key.label || node.groupLabel || node.group || "visual key"), available), textX, lowerY);
    }
    if (level >= 3) drawKeywordPills(ctx, node, textX, height - 38, available, level);
    texture.update();
  }

  function drawBadge(ctx, node, x, y, size) {
    const key = node.visualKey || {};
    roundRect(ctx, x, y, size, size, 18);
    ctx.fillStyle = key.bg || node.color || "#64748b";
    ctx.fill();
    const img = node.previewImage;
    if (img) {
      ctx.save();
      roundRect(ctx, x + 3, y + 3, size - 6, size - 6, 14);
      ctx.clip();
      ctx.drawImage(img, x + 3, y + 3, size - 6, size - 6);
      ctx.restore();
    } else {
      ctx.fillStyle = key.fg || "#ffffff";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(key.symbol || node.icon || "ND").slice(0, 5), x + size / 2, y + size / 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function drawKeywordPills(ctx, node, x, y, maxWidth, level) {
    const keywords = (node.keywords || []).slice(0, Math.max(1, level));
    let cursor = x;
    ctx.font = "bold 17px Arial";
    for (const keyword of keywords) {
      const symbol = String(keyword.symbol || "KW").slice(0, 4);
      const term = String(keyword.term || "").slice(0, 18);
      const text = `${symbol} ${term}`;
      const pillWidth = Math.min(150, Math.max(58, ctx.measureText(text).width + 18));
      if (cursor + pillWidth > x + maxWidth) break;
      roundRect(ctx, cursor, y - 18, pillWidth, 28, 10);
      ctx.fillStyle = "rgba(15,23,42,0.08)";
      ctx.fill();
      ctx.fillStyle = "#334155";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, cursor + 9, y + 2);
      cursor += pillWidth + 8;
    }
  }

  function workflowStateFor(id) {
    return (graphState?.workflowStates || workflowStateFallbacks).find((state) => state.id === id)
      || workflowStateFallbacks.find((state) => state.id === id)
      || workflowStateFallbacks[0];
  }

  function animatedStateColor(state) {
    if (!state?.animateTo) return state?.color || "rgba(15,23,42,0.22)";
    const phase = (Math.sin(frameTick / 14) + 1) / 2;
    return mixHex(state.color, state.animateTo, phase);
  }

  function animatedRed() {
    const phase = (Math.sin(frameTick / 8) + 1) / 2;
    return mixHex("#ef4444", "#7f1d1d", phase);
  }

  function contextHighlightColor(score) {
    const phase = (Math.sin(frameTick / 12) + 1) / 2;
    return score >= 4 ? mixHex("#facc15", "#2563eb", phase) : "#2563eb";
  }

  function isUnseenNewNode(node) {
    return Boolean(node?.isNew && !node?.seenAt);
  }

  function mixHex(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    if (!ca || !cb) return a;
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  function hexToRgb(hex) {
    const value = Number.parseInt(String(hex || "").replace("#", ""), 16);
    if (Number.isNaN(value)) return null;
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let clipped = text;
    while (clipped.length > 6 && ctx.measureText(`${clipped}...`).width > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    return `${clipped}...`;
  }

  function wrapText(ctx, text, maxWidth, maxLines) {
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words.length ? words : [text]) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && words.length) {
      lines[lines.length - 1] = fitText(ctx, lines[lines.length - 1], maxWidth);
    }
    return lines.slice(0, maxLines);
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function createNodeMesh(node) {
    const shape = node.type.toLowerCase();
    let mesh;
    if (shape.includes("box") || shape.includes("diamond")) {
      mesh = BABYLON.MeshBuilder.CreateBox(`node:${node.id}`, { size: NODE_RADIUS * 1.9 }, scene);
      if (shape.includes("diamond")) {
        mesh.rotation.z = Math.PI / 4;
        mesh.rotation.x = Math.PI / 4;
      }
    } else if (shape.includes("cylinder")) {
      mesh = BABYLON.MeshBuilder.CreateCylinder(`node:${node.id}`, { height: NODE_RADIUS * 2.2, diameter: NODE_RADIUS * 1.7, tessellation: 20 }, scene);
    } else {
      mesh = BABYLON.MeshBuilder.CreateSphere(`node:${node.id}`, { diameter: NODE_RADIUS * 2.1, segments: 24 }, scene);
    }

    const material = new BABYLON.StandardMaterial(`mat:${node.id}`, scene);
    material.diffuseColor = hexToColor3(node.color);
    material.specularColor = new BABYLON.Color3(0.32, 0.32, 0.32);
    material.emissiveColor = material.diffuseColor.scale(0.18);
    mesh.material = material;
    mesh.position.copyFrom(node.position);
    mesh.metadata = { kind: "node", node };
    node.mesh = mesh;
    node.material = material;
    node.basePosition = node.position.clone();
    applyNodeWorkState(node);
    createTextPlane(node);
  }

  function applyNodeWorkState(node) {
    if (!node?.mesh || !node?.material) return;
    node.mesh.renderOutline = false;
    node.material.emissiveColor = hexToColor3(node.color).scale(0.16);
  }

  function createEdgeMesh(edge) {
    const source = graphState.nodeById.get(edge.source);
    const target = graphState.nodeById.get(edge.target);
    edge.mesh = BABYLON.MeshBuilder.CreateLines(`edge:${edge.id}`, { points: [source.position, target.position], updatable: true }, scene);
    edge.mesh.color = new BABYLON.Color3(0.62, 0.68, 0.74);
    edge.mesh.alpha = 0.46;
    edge.mesh.isPickable = false;
  }

  function syncNode(node) {
    node.mesh.position.copyFrom(node.position);
    if (node.labelPlane) node.labelPlane.position.copyFrom(labelPosition(node));
  }

  function updateEdgeMesh(edge) {
    const source = graphState.nodeById.get(edge.source);
    const target = graphState.nodeById.get(edge.target);
    if (!source || !target || !edge.mesh) return;
    BABYLON.MeshBuilder.CreateLines(null, { points: [source.position, target.position], instance: edge.mesh });
  }

  function showNodeDetails(node, editMode = false) {
    if (!node) {
      details.innerHTML = `
        <h1>${escapeHtml(graphId)} graph</h1>
        <div class="meta">
          <span class="pill">${graphState.nodes.length} ${i18n.lang === "uk" ? "вузлів" : "nodes"}</span>
          <span class="pill">${graphState.edges.length} ${i18n.lang === "uk" ? "ребер" : "edges"}</span>
          <span class="pill">${physicsPaused ? (i18n.lang === "uk" ? "пауза" : "paused") : (i18n.lang === "uk" ? "працює" : "running")}</span>
        </div>
        <p>${i18n.lang === "uk" ? "Спочатку пошук/фільтр. Правий клік по вузлу відкриває контекстні дії. Клік по вузлу дає перегляд або редагування." : "Search/filter first. Right-click a node for context actions. Click a node to inspect or edit it."}</p>
      `;
      return;
    }

    const parts = [
      node.groupLabel || node.group,
      node.status || (i18n.lang === "uk" ? "без статусу" : "no status"),
        node.workflowState ? `${i18n.lang === "uk" ? "стан" : "state"}: ${workflowStateFor(node.workflowState).label}` : "",
      `degree: ${node.degree}`,
      node.owner ? `${i18n.lang === "uk" ? "власник" : "owner"}: ${node.owner}` : "",
    ].filter(Boolean);
    const attachments = (node.attachments || [])
      .map((item) => `<a href="${escapeHtml(assetUrl(item.url))}" target="_blank" rel="noreferrer">${escapeHtml(item.name)}</a>`)
      .join("");
    const comments = (node.testComments || [])
      .map((item) => `<p><strong>${escapeHtml(item.role || "human")}:</strong> ${escapeHtml(item.text)} <span class="muted">${escapeHtml(item.createdAt || "")}</span></p>`)
      .join("");
    const canComment = ["ready_for_test", "testing_agent", "tested_agent", "tested_human"].includes(node.workflowState);

    if (editMode) {
      details.innerHTML = `
        <h1>${i18n.lang === "uk" ? "Редагувати вузол" : "Edit node"}</h1>
        <form id="nodeEditForm" class="edit-form">
          <label>${i18n.lang === "uk" ? "Назва" : "Title"}<input id="editLabel" value="${escapeHtml(node.label)}"></label>
          <label>${i18n.lang === "uk" ? "Деталі" : "Detail"}<textarea id="editDetail">${escapeHtml(node.detail)}</textarea></label>
          <label>${i18n.lang === "uk" ? "Встав скріншот тут або завантаж файл" : "Paste screenshot here or upload file"}<input id="editFiles" type="file" multiple></label>
          <button type="submit">${i18n.lang === "uk" ? "Зберегти вузол" : "Save node"}</button>
          <div id="editHint">${i18n.lang === "uk" ? "Вставка з буфера підтримує зображення, поки ця панель відкрита." : "Clipboard paste supports image files while this panel is open."}</div>
        </form>
        <div class="attachment-list">${attachments || (i18n.lang === "uk" ? "Вкладень ще немає." : "No attachments yet.")}</div>
      `;
      wireEditForm(node);
      return;
    }

    details.innerHTML = `
      <h1>${escapeHtml(node.label)}</h1>
      <div class="meta">${parts.map((part) => `<span class="pill">${escapeHtml(part)}</span>`).join("")}</div>
      <p>${escapeHtml(node.detail || (i18n.lang === "uk" ? "Деталі до цього вузла графа ще не додані." : "No detail is attached to this graph node."))}</p>
      <div class="attachment-list">
        <strong>${i18n.lang === "uk" ? "Візуальний ключ" : "Visual key"}</strong>
        ${escapeHtml(node.visualKey?.label || i18n.t("visualKeyPending"))}
        <strong>${i18n.lang === "uk" ? "Ключові слова" : "Keywords"}</strong>
        ${(node.keywords || []).map((item) => `<span><i class="${escapeHtml(item.faClass || "fa-solid fa-tag")}"></i> ${escapeHtml(item.term)}</span>`).join("") || (i18n.lang === "uk" ? "Ключових слів немає" : "No keywords")}
        ${attachments ? `<strong>${i18n.lang === "uk" ? "Вкладення" : "Attachments"}</strong>${attachments}` : ""}
      </div>
      <div class="work-key" aria-label="Work state color key">
        ${(graphState.workflowStates || workflowStateFallbacks).map((state) => `<span title="${escapeHtml(workflowDescriptions[state.id] || "")}"><i class="work-dot" style="background:${escapeHtml(state.color)}"></i>${escapeHtml(state.label)}</span>`).join("")}
      </div>
      <button id="editNodeButton" type="button">${i18n.lang === "uk" ? "Редагувати назву/деталі/файли" : "Edit title/detail/files"}</button>
      <button id="treeTextButton" type="button">${i18n.lang === "uk" ? "Текст дерева" : "Tree text"}</button>
      <button id="treeTableButton" type="button">${i18n.lang === "uk" ? "Таблиця дерева" : "Tree table"}</button>
      ${canComment ? `<button id="testCommentButton" type="button">${i18n.lang === "uk" ? "Додати тест-коментар" : "Add test comment"}</button>` : ""}
      <div class="attachment-list">${comments ? `<strong>${i18n.lang === "uk" ? "Тест-коментарі" : "Test comments"}</strong>${comments}` : ""}</div>
      <div id="treeOutput" class="attachment-list"></div>
    `;
    document.getElementById("editNodeButton").addEventListener("click", () => showNodeDetails(node, true));
    document.getElementById("treeTextButton").addEventListener("click", () => showTreeText(node));
    document.getElementById("treeTableButton").addEventListener("click", () => showTreeTable(node));
    document.getElementById("testCommentButton")?.addEventListener("click", () => showTestCommentForm(node));
  }

  function showTestCommentForm(node) {
    const target = document.getElementById("treeOutput");
    target.innerHTML = `
      <strong>${i18n.lang === "uk" ? "Коментар тестування" : "Testing comment"}</strong>
      <form id="testCommentForm" class="edit-form">
        <label>${i18n.lang === "uk" ? "Роль автора" : "Author role"}
          <select id="testCommentRole">
            <option value="human">${i18n.lang === "uk" ? "Людина" : "Human"}</option>
            <option value="agent">${i18n.lang === "uk" ? "Агент" : "Agent"}</option>
          </select>
        </label>
        <label>${i18n.lang === "uk" ? "Коментар" : "Comment"}<textarea id="testCommentText" placeholder="${i18n.lang === "uk" ? "Що тестувалось, що пройшло, що лишилось незрозумілим" : "What was tested, what passed, what remains unclear"}"></textarea></label>
        <button type="submit">${i18n.lang === "uk" ? "Зберегти коментар" : "Save comment"}</button>
      </form>
    `;
    document.getElementById("testCommentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveTestComment(node, document.getElementById("testCommentText").value, document.getElementById("testCommentRole").value);
    });
  }

  async function saveTestComment(node, text, role) {
    const clean = String(text || "").trim();
    if (!clean) return;
    const payload = {
      label: node.label,
      detail: node.detail,
      workflowState: node.workflowState,
      workState: node.workState,
      seenAt: node.seenAt || "",
      attachments: [],
      testComments: [{ text: clean, role }],
    };
    const response = await fetch(appUrl(`/api/graph-edits/${encodeURIComponent(graphId)}/${encodeURIComponent(node.id)}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setStatus(i18n.lang === "uk" ? `Не вдалось зберегти тест-коментар для ${node.label}.` : `Could not save test comment for ${node.label}.`);
      return;
    }
    const result = await response.json();
    node.testComments = result.edit.testComments || node.testComments || [];
    showNodeDetails(node);
    setStatus(i18n.lang === "uk" ? `Тест-коментар для ${node.label} збережено.` : `Saved test comment for ${node.label}.`);
  }

  function updateTrashButton() {
    const trashed = Array.isArray(graphState?.trash?.nodes) ? graphState.trash.nodes : [];
    const count = trashed.length;
    trashCount.textContent = String(count);
    trashButton.classList.toggle("active", count > 0);
    const title = count
      ? (i18n.lang === "uk" ? `Кошик: ${count} видалених вузлів` : `Trash: ${count} deleted node${count === 1 ? "" : "s"}`)
      : i18n.t("trashEmpty");
    trashButton.title = title;
    trashButton.setAttribute("aria-label", title);
    if (!count) trashPanel.classList.remove("open");
  }

  function showTrashPanel() {
    const trashed = Array.isArray(graphState?.trash?.nodes) ? graphState.trash.nodes : [];
    if (!trashed.length) {
      trashPanel.classList.remove("open");
      return;
    }
    trashPanel.innerHTML = `
      <strong>${i18n.t("trashTitle")}</strong>
      <ul>
        ${trashed.map((node) => `<li><strong>${escapeHtml(node.label || node.id)}</strong><br><span class="muted">${escapeHtml(node.deletedAt || "")}</span></li>`).join("")}
      </ul>
    `;
    trashPanel.classList.toggle("open");
    trashConfirm.classList.remove("open");
  }

  function requestTrashConfirmation(node) {
    if (!node) return;
    pendingTrashNode = node;
    hideHtmlContextMenu();
    trashPanel.classList.remove("open");
    trashConfirmText.textContent = i18n.lang === "uk"
      ? `${node.label} буде приховано з активного графа і збережено в кошику.`
      : `${node.label} will be hidden from the active graph and kept in trash.`;
    trashConfirm.classList.add("open");
  }

  async function moveNodeToTrash(node) {
    if (!node) return;
    const deletedAt = new Date().toISOString();
    const response = await fetch(appUrl(`/api/graph-edits/${encodeURIComponent(graphId)}/${encodeURIComponent(node.id)}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: node.label,
        detail: node.detail,
        workflowState: node.workflowState,
        workState: node.workState,
        seenAt: node.seenAt || "",
        attachments: [],
        deletedAt,
        deletedBy: "human",
      }),
    });
    if (!response.ok) {
      setStatus(i18n.lang === "uk" ? `Не вдалось перемістити ${node.label} у кошик.` : `Could not move ${node.label} to trash.`);
      return;
    }
    graphState.trash ||= { nodes: [] };
    graphState.trash.nodes ||= [];
    graphState.trash.nodes.push({ id: node.id, label: node.label, group: node.group, deletedAt, deletedBy: "human" });
    removeNodeFromScene(node);
    trashConfirm.classList.remove("open");
    pendingTrashNode = null;
    updateTrashButton();
    applyFilters();
    showNodeDetails(null);
    setStatus(i18n.lang === "uk" ? `${node.label} переміщено у кошик.` : `${node.label} moved to trash.`);
  }

  function removeNodeFromScene(node) {
    pinnedNode = pinnedNode?.id === node.id ? null : pinnedNode;
    hoveredNode = hoveredNode?.id === node.id ? null : hoveredNode;
    contextNode = contextNode?.id === node.id ? null : contextNode;
    if (node.labelPlane) node.labelPlane.dispose();
    if (node.mesh) node.mesh.dispose();
    const removedEdges = graphState.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
    for (const edge of removedEdges) edge.mesh?.dispose();
    graphState.edges = graphState.edges.filter((edge) => edge.source !== node.id && edge.target !== node.id);
    graphState.nodes = graphState.nodes.filter((item) => item.id !== node.id);
    graphState.nodeById.delete(node.id);
    renderTimePanel();
    drawMap();
  }

  function showTreeText(node) {
    document.getElementById("treeOutput").innerHTML = `<strong>Tree text</strong><pre>${escapeHtml(generateTreeText(node))}</pre>`;
  }

  function showTreeTable(node) {
    const rows = subtreeRows(node).map((row) => `
      <tr>
        <td>${escapeHtml(String(row.depth))}</td>
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(row.state)}</td>
        <td>${escapeHtml(row.owner)}</td>
        <td>${escapeHtml(row.keywords)}</td>
      </tr>
    `).join("");
    document.getElementById("treeOutput").innerHTML = `
      <strong>Tree table</strong>
      <table>
        <thead><tr><th>D</th><th>Node</th><th>State</th><th>Owner</th><th>Keywords</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function generateTreeText(node) {
    return subtreeRows(node)
      .map((row) => `${"  ".repeat(row.depth)}- ${row.label} [${row.state}] owner=${row.owner}; keywords=${row.keywords}\n${"  ".repeat(row.depth + 1)}${row.detail}`)
      .join("\n");
  }

  function subtreeRows(root, maxDepth = 4) {
    const rows = [];
    const visited = new Set();
    const walk = (node, depth) => {
      if (!node || visited.has(node.id) || depth > maxDepth) return;
      visited.add(node.id);
      rows.push({
        depth,
        id: node.id,
        label: node.label,
        detail: node.detail || "",
        state: workflowStateFor(node.workflowState).label,
        owner: node.owner || "system",
        keywords: (node.keywords || []).map((item) => item.term).join(", "),
      });
      graphState.edges
        .filter((edge) => edge.source === node.id)
        .map((edge) => graphState.nodeById.get(edge.target))
        .forEach((child) => walk(child, depth + 1));
    };
    walk(root, 0);
    return rows;
  }

  function wireEditForm(node) {
    const form = document.getElementById("nodeEditForm");
    const fileInput = document.getElementById("editFiles");
    const attachments = [];
    fileInput.addEventListener("change", async () => {
      attachments.push(...await readFilesAsDataUrls([...fileInput.files]));
      setStatus(`${attachments.length} attachment(s) staged for ${node.label}.`);
    });
    form.addEventListener("paste", async (event) => {
      const files = [...(event.clipboardData?.files || [])];
      if (!files.length) return;
      attachments.push(...await readFilesAsDataUrls(files));
      setStatus(`${attachments.length} pasted/uploaded attachment(s) staged.`);
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        label: document.getElementById("editLabel").value,
        detail: document.getElementById("editDetail").value,
        workflowState: node.workflowState,
        workState: node.workState,
        seenAt: node.seenAt || "",
        attachments,
      };
      const response = await fetch(appUrl(`/api/graph-edits/${encodeURIComponent(graphId)}/${encodeURIComponent(node.id)}`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setStatus(`Save failed with HTTP ${response.status}.`);
        return;
      }
      const result = await response.json();
      node.label = payload.label;
      node.detail = payload.detail;
      node.attachments = result.edit.attachments || node.attachments || [];
      if (typeof result.edit.workState === "string") node.workState = result.edit.workState;
      if (typeof result.edit.workflowState === "string") node.workflowState = result.edit.workflowState;
      if (typeof result.edit.seenAt === "string") node.seenAt = result.edit.seenAt;
      if (Array.isArray(result.edit.testComments)) node.testComments = result.edit.testComments;
      if (result.edit.visualKey) node.visualKey = result.edit.visualKey;
      applyNodeWorkState(node);
      refreshLabel(node);
      showNodeDetails(node);
      setStatus(`Saved ${node.label}.`);
    });
  }

  function readFilesAsDataUrls(files) {
    return Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name || "clipboard-image.png", type: file.type, dataUrl: reader.result });
      reader.readAsDataURL(file);
    })));
  }

  function refreshLabel(node) {
    if (node.labelPlane) node.labelPlane.dispose();
    createTextPlane(node);
  }

  function updateHoverLabel(pointerEvent, node) {
    if (!node) {
      hoverLabel.style.display = "none";
      return;
    }
    hoverLabel.style.left = `${pointerEvent.clientX}px`;
    hoverLabel.style.top = `${pointerEvent.clientY}px`;
    hoverLabel.textContent = `${node.label} | ${node.groupLabel || node.group} | degree ${node.degree}`;
    hoverLabel.style.display = "block";
  }

  function visibleLabelBudget() {
    if (!labelsVisible) return 0;
    if (cognitiveLevel <= 1) return 0;
    if (cognitiveLevel === 2) return 8;
    if (cognitiveLevel === 3) return 18;
    if (cognitiveLevel === 4) return 36;
    return Number.POSITIVE_INFINITY;
  }

  function isNodeInViewport(node) {
    if (!node?.mesh?.isEnabled?.()) return false;
    const point = screenPointFor(node.mesh);
    return point.x >= 0 && point.x <= window.innerWidth && point.y >= 0 && point.y <= window.innerHeight;
  }

  function labelPriority(node) {
    let score = node.degree || 0;
    if (node === pinnedNode) score += 1000;
    if (node === hoveredNode) score += 600;
    if (node.contextScore > 0) score += 120 + node.contextScore * 20;
    if (isUnseenNewNode(node)) score += 90;
    if (["testing", "needed"].includes(node.workState)) score += 55;
    if (["ready_for_test", "testing_agent"].includes(node.workflowState)) score += 45;
    if (isNodeInViewport(node)) score += 25;
    return score;
  }

  function updateLabelVisibility() {
    if (!graphState) return;
    const budget = visibleLabelBudget();
    const visibleLabels = new Set();
    if (budget > 0) {
      const visibleNodes = graphState.nodes.filter((node) => node.visibleByFilter && node.labelPlane);
      const inViewport = visibleNodes.filter(isNodeInViewport);
      const pool = inViewport.length >= Math.min(budget, visibleNodes.length) ? inViewport : visibleNodes;
      pool
        .sort((a, b) => labelPriority(b) - labelPriority(a))
        .slice(0, budget)
        .forEach((node) => visibleLabels.add(node.id));
      if (pinnedNode?.visibleByFilter) visibleLabels.add(pinnedNode.id);
      if (hoveredNode?.visibleByFilter) visibleLabels.add(hoveredNode.id);
    }
    for (const node of graphState.nodes) {
      if (node.labelPlane) node.labelPlane.setEnabled(visibleLabels.has(node.id));
    }
  }

  function applyFilters() {
    const search = activeSearch.trim().toLowerCase();
    for (const node of graphState.nodes) {
      const text = `${node.label} ${node.detail} ${node.group} ${node.status} ${(node.keywords || []).map((item) => item.term).join(" ")}`.toLowerCase();
      node.visibleByFilter = (!activeGroup || node.group === activeGroup)
        && (!activeWorkflow || node.workflowState === activeWorkflow)
        && node.degree >= activeDegree
        && (!search || text.includes(search));
      node.mesh.setEnabled(node.visibleByFilter);
      if (node.visibleByFilter && node.contextScore > 0) {
        node.material.emissiveColor = hexToColor3(node.contextScore >= 4 ? "#facc15" : "#2563eb").scale(0.62);
        node.mesh.renderOutline = true;
        node.mesh.outlineColor = hexToColor3(node.contextScore >= 4 ? "#facc15" : "#2563eb");
        node.mesh.outlineWidth = 0.08 + Math.min(0.16, node.contextScore * 0.02);
      } else if (node.visibleByFilter && search) {
        node.material.emissiveColor = hexToColor3("#f59e0b").scale(0.55);
      } else {
        applyNodeWorkState(node);
      }
    }
    updateLabelVisibility();

    for (const edge of graphState.edges) {
      const source = graphState.nodeById.get(edge.source);
      const target = graphState.nodeById.get(edge.target);
      edge.mesh.setEnabled(Boolean(source?.visibleByFilter && target?.visibleByFilter));
    }

    drawMap();
    const visibleCount = graphState.nodes.filter((node) => node.visibleByFilter).length;
    setStatus(`${visibleCount}/${graphState.nodes.length} nodes visible; state ${activeWorkflow || "all"}; degree >= ${activeDegree}; physics ${physicsPaused ? "paused" : "running"}.`);
  }

  function runContextSearch() {
    const question = contextSearchBox.value.trim();
    contextSearchTerms = tokenize(question);
    for (const node of graphState.nodes) node.contextScore = 0;
    if (!contextSearchTerms.length) {
      refreshLabels();
      applyFilters();
      setStatus("Context search cleared.");
      return;
    }
    for (const node of graphState.nodes) {
      node.contextScore = scoreNodeForContext(node, contextSearchTerms);
    }
    for (const edge of graphState.edges) {
      const source = graphState.nodeById.get(edge.source);
      const target = graphState.nodeById.get(edge.target);
      if (!source || !target) continue;
      if (source.contextScore > 0 && target.contextScore === 0) target.contextScore = 0.75;
      if (target.contextScore > 0 && source.contextScore === 0) source.contextScore = 0.75;
    }
    const matches = graphState.nodes
      .filter((node) => node.contextScore > 0)
      .sort((a, b) => b.contextScore - a.contextScore)
      .slice(0, 8);
    refreshLabels();
    applyFilters();
    if (matches[0]) {
      showNodeDetails(matches[0]);
      animateCameraToNode(matches[0]);
    }
    setStatus(`Context search highlighted ${matches.length} top nodes for: ${question}`);
  }

  function tokenize(value) {
    return [...new Set(String(value || "").toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((term) => term.length >= 3))];
  }

  function scoreNodeForContext(node, terms) {
    const keywordText = (node.keywords || []).map((item) => item.term).join(" ");
    const text = `${node.id} ${node.label} ${node.detail} ${node.group} ${node.groupLabel} ${node.status} ${node.workflowState} ${node.owner} ${keywordText}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (node.label.toLowerCase().includes(term)) score += 3;
      if (keywordText.toLowerCase().includes(term)) score += 2.5;
      if (text.includes(term)) score += 1;
    }
    return score;
  }

  function refreshLabels() {
    for (const node of graphState.nodes) refreshLabel(node);
    updateLabelVisibility();
  }

  function resetGraphLayout() {
    for (const node of graphState.nodes) {
      node.position.copyFrom(node.basePosition);
      node.velocity.set(0, 0, 0);
      syncNode(node);
    }
    for (const edge of graphState.edges) updateEdgeMesh(edge);
    setStatus("Layout reset to the source positions.");
  }

  async function populateGraphSelect() {
    const response = await fetch(i18n.apiUrl("/api/graphs"), { cache: "no-store" });
    const graphs = await response.json();
    graphSelect.innerHTML = Object.entries(graphs)
      .map(([id, graph]) => `<option value="${escapeHtml(id)}"${id === graphId ? " selected" : ""}>${escapeHtml(graph.label)}</option>`)
      .join("");
    graphSelect.addEventListener("change", () => {
      window.location.href = i18n.withLang(appUrl(`/babylon-3d.html?graph=${encodeURIComponent(graphSelect.value)}`));
    });
  }

  function populateControls() {
    const groups = Object.entries(graphState.groups).sort((a, b) => a[1].label.localeCompare(b[1].label));
    groupFilter.innerHTML = `<option value="">${escapeHtml(i18n.t("allGroups"))}</option>${groups.map(([id, group]) => `<option value="${escapeHtml(id)}">${escapeHtml(group.label)}</option>`).join("")}`;
    const states = graphState.workflowStates || workflowStateFallbacks;
    workflowFilter.innerHTML = `<option value="">${escapeHtml(i18n.t("allWorkflowStates"))}</option>${states.map((state) => `<option value="${escapeHtml(state.id)}">${escapeHtml(state.label)}</option>`).join("")}`;
    contextWorkflowState.innerHTML = states.map((state) => `<option value="${escapeHtml(state.id)}">${escapeHtml(state.label)}</option>`).join("");
    legend.innerHTML = groups
      .map(([id, group]) => `<span class="legend-item" title="${escapeHtml(group.label)}"><span class="swatch" style="background:${escapeHtml(group.color || fallbackColors[id] || "#6b7280")}"></span>${escapeHtml(group.label)}</span>`)
      .join("");
  }

  function focusSearchResult() {
    const search = activeSearch.trim().toLowerCase();
    if (!search) return;
    const match = graphState.nodes.find((node) => node.visibleByFilter && node.label.toLowerCase().includes(search));
    if (!match) return;
    showNodeDetails(match);
    animateCameraToNode(match, Math.max(48, camera.radius * 0.82));
  }

  function focusLinkedBranch(node) {
    if (!node) return;
    const linked = new Set([node.id]);
    for (const edge of graphState.edges) {
      if (edge.source === node.id) linked.add(edge.target);
      if (edge.target === node.id) linked.add(edge.source);
    }
    for (const item of graphState.nodes) {
      item.visibleByFilter = linked.has(item.id);
      item.mesh.setEnabled(item.visibleByFilter);
    }
    updateLabelVisibility();
    for (const edge of graphState.edges) {
      edge.mesh.setEnabled(linked.has(edge.source) && linked.has(edge.target));
    }
    animateCameraToNode(node);
    showNodeDetails(node);
    setStatus(`Focused linked branch for ${node.label}.`);
  }

  function focusNodeAndPullTree(node) {
    if (!node) return;
    if (isUnseenNewNode(node)) markNodeSeen(node);
    pinnedNode = node;
    focusPullRoot = node;
    focusPullDistances = graphDistances(node.id, 3);
    animateCameraToNode(node, Math.max(32, Math.min(camera.radius, 64)));
    showNodeDetails(node);
    setStatus(`Focused ${node.label}; linked tree is pulled toward the viewport center.`);
  }

  function animateCameraToNode(node, targetRadius = Math.max(32, Math.min(camera.radius, 64))) {
    cameraTween = {
      started: performance.now(),
      duration: 520,
      fromTarget: camera.target.clone(),
      toTarget: node.position.clone(),
      fromRadius: camera.radius,
      toRadius: targetRadius,
    };
  }

  function updateCameraTween() {
    if (!cameraTween) return;
    const raw = Math.min(1, (performance.now() - cameraTween.started) / cameraTween.duration);
    const t = 1 - Math.pow(1 - raw, 3);
    camera.setTarget(BABYLON.Vector3.Lerp(cameraTween.fromTarget, cameraTween.toTarget, t));
    camera.radius = cameraTween.fromRadius + (cameraTween.toRadius - cameraTween.fromRadius) * t;
    if (raw >= 1) cameraTween = null;
  }

  function graphDistances(rootId, maxDepth) {
    const distances = new Map([[rootId, 0]]);
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift();
      const depth = distances.get(id);
      if (depth >= maxDepth) continue;
      for (const edge of graphState.edges) {
        const next = edge.source === id ? edge.target : edge.target === id ? edge.source : null;
        if (!next || distances.has(next)) continue;
        distances.set(next, depth + 1);
        queue.push(next);
      }
    }
    return distances;
  }

  function stepPhysics() {
    if (physicsPaused || !graphState) return;
    const nodes = graphState.nodes.filter((node) => node.visibleByFilter);
    const nodeSet = new Set(nodes.map((node) => node.id));

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const delta = a.position.subtract(b.position);
        const distanceSq = Math.max(delta.lengthSquared(), 24);
        const direction = delta.normalize();
        a.velocity.addInPlace(direction.scale(REPULSION / distanceSq));
        b.velocity.subtractInPlace(direction.scale(REPULSION / distanceSq));
      }
    }

    for (const edge of graphState.edges) {
      if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) continue;
      const source = graphState.nodeById.get(edge.source);
      const target = graphState.nodeById.get(edge.target);
      const delta = target.position.subtract(source.position);
      const distance = Math.max(delta.length(), 0.001);
      const force = delta.normalize().scale((distance - SPRING_LENGTH) * SPRING_STRENGTH);
      source.velocity.addInPlace(force);
      target.velocity.subtractInPlace(force);
    }

    for (const node of nodes) {
      if (focusPullRoot && focusPullDistances.has(node.id)) {
        const depth = focusPullDistances.get(node.id);
        const target = focusPullRoot.position.add(new BABYLON.Vector3((depth + 1) * 18, Math.sin(depth * 1.7) * 8, depth * 10));
        node.velocity.addInPlace(target.subtract(node.position).scale(0.006 / (depth + 1)));
      }
      node.velocity.addInPlace(node.position.scale(-CENTER_GRAVITY));
      node.velocity.scaleInPlace(DAMPING);
      if (node.velocity.length() > MAX_SPEED) node.velocity.normalize().scaleInPlace(MAX_SPEED);
      node.position.addInPlace(node.velocity);
      syncNode(node);
    }

    for (const edge of graphState.edges) if (edge.mesh.isEnabled()) updateEdgeMesh(edge);
  }

  function layoutOptions(layoutValue) {
    const common = {
      animate: false,
      fit: false,
      padding: 20,
      nodeDimensionsIncludeLabels: true,
    };
    if (layoutValue === "breadthfirst") return { ...common, name: "breadthfirst", directed: true, spacingFactor: 1.4 };
    if (layoutValue === "concentric") return { ...common, name: "concentric", minNodeSpacing: 42 };
    if (layoutValue === "circle") return { ...common, name: "circle", radius: 220 };
    if (layoutValue === "grid") return { ...common, name: "grid", spacingFactor: 1.2 };
    if (layoutValue === "cola") {
      return {
        ...common,
        name: "cose",
        idealEdgeLength: 86,
        nodeRepulsion: 9400,
        gravity: 0.22,
        numIter: 1800,
      };
    }
    return {
      ...common,
      name: "cose",
      idealEdgeLength: 112,
      nodeRepulsion: 6800,
      gravity: 0.18,
      numIter: 1400,
    };
  }

  function waitForLayout(layout, timeoutMs = 1200) {
    return new Promise((resolveLayout) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolveLayout();
      };
      layout.on("layoutstop", finish);
      layout.run();
      window.setTimeout(finish, timeoutMs);
    });
  }

  function applyManualLayout(layoutValue, visibleNodes) {
    if (!["circle", "grid", "concentric", "breadthfirst", "development-flow"].includes(layoutValue)) return false;
    const count = Math.max(1, visibleNodes.length);
    const radius = Math.max(42, Math.min(130, count * 4.8));
    const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / columns));
    visibleNodes.forEach((node, index) => {
      if (layoutValue === "circle") {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        node.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(index * 1.618) * 14);
      } else if (layoutValue === "grid") {
        const col = index % columns;
        const row = Math.floor(index / columns);
        node.position.set((col - (columns - 1) / 2) * 28, ((rows - 1) / 2 - row) * 24, Math.sin(index * 1.2) * 10);
      } else if (layoutValue === "concentric") {
        const ring = Math.floor(Math.sqrt(index));
        const ringStart = ring * ring;
        const ringSize = Math.max(1, (ring + 1) * (ring + 1) - ringStart);
        const angle = (Math.PI * 2 * (index - ringStart)) / ringSize;
        node.position.set(Math.cos(angle) * (ring + 1) * 26, Math.sin(angle) * (ring + 1) * 26, ring * 8);
      } else if (layoutValue === "development-flow") {
        const stage = developmentStage(node);
        const stageItems = visibleNodes.filter((item) => developmentStage(item) === stage);
        const stageIndex = stageItems.findIndex((item) => item.id === node.id);
        node.position.set((stage - 3) * 42, 70 - stageIndex * 24, Math.sin(stageIndex * 1.3) * 10);
      } else {
        const depth = Math.floor(index / columns);
        const offset = index % columns;
        node.position.set((offset - (columns - 1) / 2) * 30, -depth * 28 + 44, depth * 10);
      }
      node.velocity.set(0, 0, 0);
      syncNode(node);
    });
    return true;
  }

  function developmentStage(node) {
    const text = `${node.id} ${node.label} ${node.detail} ${node.group} ${node.status} ${(node.keywords || []).map((item) => item.term).join(" ")}`.toLowerCase();
    if (text.includes("learn") || text.includes("require") || text.includes("tz") || text.includes("goal")) return 0;
    if (text.includes("design") || text.includes("architecture") || text.includes("flow") || text.includes("layout")) return 1;
    if (text.includes("data") || text.includes("api") || text.includes("model")) return 2;
    if (text.includes("edit") || text.includes("implement") || text.includes("ui") || text.includes("babylon") || text.includes("cytoscape")) return 3;
    if (text.includes("test") || text.includes("qa") || text.includes("smoke")) return 4;
    if (text.includes("review") || text.includes("human") || text.includes("approve")) return 5;
    return 6;
  }

  async function runCytoscapeLayout() {
    physicsPaused = true;
    const visibleNodes = graphState.nodes.filter((node) => node.visibleByFilter);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    if (applyManualLayout(layoutSelect.value, visibleNodes)) {
      for (const edge of graphState.edges) updateEdgeMesh(edge);
      drawMap();
      setStatus(`Re-arranged visible nodes with manual ${layoutSelect.value}; physics paused for inspection.`);
      return;
    }
    if (!window.cytoscape) {
      setStatus("Cytoscape.js is unavailable; using reset layout.");
      resetGraphLayout();
      return;
    }
    const cy = cytoscape({
      headless: true,
      elements: [
        ...visibleNodes.map((node) => ({ data: { id: node.id } })),
        ...graphState.edges
          .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
          .map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target } })),
      ],
    });
    await waitForLayout(cy.layout(layoutOptions(layoutSelect.value)));

    const positions = visibleNodes.map((node) => cy.getElementById(node.id).position());
    const cx = positions.reduce((sum, pos) => sum + (Number.isFinite(pos.x) ? pos.x : 0), 0) / Math.max(1, positions.length);
    const cyCenter = positions.reduce((sum, pos) => sum + (Number.isFinite(pos.y) ? pos.y : 0), 0) / Math.max(1, positions.length);
    visibleNodes.forEach((node, index) => {
      const pos = cy.getElementById(node.id).position();
      const x = Number.isFinite(pos.x) ? (pos.x - cx) * 0.15 : Math.cos(index) * 32;
      const y = Number.isFinite(pos.y) ? (cyCenter - pos.y) * 0.15 : Math.sin(index) * 32;
      const z = Math.sin(index * 1.618) * (layoutSelect.value === "breadthfirst" ? 18 : 28);
      node.position.set(x, y, z);
      node.velocity.set(0, 0, 0);
      syncNode(node);
    });
    for (const edge of graphState.edges) updateEdgeMesh(edge);
    drawMap();
    setStatus(`Re-arranged visible nodes with Cytoscape ${layoutSelect.value}; physics paused for inspection.`);
  }

  function initScene() {
    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.07, 0.08, 0.1, 1);
    camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2.45, Math.PI / 2.9, 128, BABYLON.Vector3.Zero(), scene);
    camera.lowerRadiusLimit = 18;
    camera.upperRadiusLimit = 260;
    camera.wheelPrecision = 24;
    camera.panningSensibility = 70;
    camera.attachControl(canvas, true);
    new BABYLON.HemisphericLight("hemispheric", new BABYLON.Vector3(0.2, 1, 0.3), scene).intensity = 0.82;
    new BABYLON.PointLight("point", new BABYLON.Vector3(45, 52, -38), scene).intensity = 0.5;
    engine.runRenderLoop(() => {
      frameTick += 1;
      if (frameTick % 18 === 0) refreshAnimatedLabels();
      if (labelsVisible && frameTick % 18 === 0) updateLabelDetailLevels();
      if (labelsVisible && frameTick % 45 === 0) updateLabelVisibility();
      updateCameraTween();
      stepPhysics();
      updateLabelPositions();
      scene.render();
    });
    window.addEventListener("resize", () => engine.resize());
  }

  function refreshAnimatedLabels() {
    for (const node of graphState?.nodes || []) {
      const state = workflowStateFor(node.workflowState);
      if ((state?.animateTo || isUnseenNewNode(node) || node.contextScore > 0) && node.labelPlane?.isEnabled()) redrawLabelTexture(node);
    }
  }

  function updateLabelDetailLevels() {
    if (!camera || !graphState) return;
    const visible = graphState.nodes.filter((node) => node.labelPlane?.isEnabled());
    if (!visible.length) return;
    const maxLevel = Math.max(1, cognitiveLevel);
    const byDistance = visible
      .map((node) => ({ node, distance: BABYLON.Vector3.Distance(camera.position, node.position) }))
      .sort((a, b) => a.distance - b.distance);
    const count = byDistance.length;
    byDistance.forEach(({ node, distance }, index) => {
      const proximity = count > 1 ? 1 - index / (count - 1) : 1;
      const level = Math.max(1, Math.min(maxLevel, Math.round(1 + proximity * (maxLevel - 1))));
      if (node.detailLevel !== level) {
        node.detailLevel = level;
        node.cameraDistance = distance;
        redrawLabelTexture(node);
      }
    });
  }

  function updateLabelPositions() {
    for (const node of graphState?.nodes || []) {
      if (node.labelPlane?.isEnabled()) node.labelPlane.position.copyFrom(labelPosition(node));
    }
  }

  function redrawLabelTexture(node) {
    if (!node.labelPlane?.material?.diffuseTexture) return;
    drawLabelTexture(node.labelPlane.material.diffuseTexture, node, node.labelMetrics || labelMetrics(node));
  }

  function cxtIcon(icon, label) {
    return `<span class="cxtmenu-content"><i class="${icon}"></i><span>${escapeHtml(label)}</span></span>`;
  }

  function initCxtmenuBridge() {
    if (!window.cytoscape || !window.cytoscapeCxtmenu || !cxtmenuBridge) {
      setStatus("cytoscape-cxtmenu did not load; radial context menu is unavailable.");
      return;
    }
    cxtmenuCy = window.cytoscape({
      container: cxtmenuBridge,
      elements: [{ data: { id: "proxy" }, position: { x: 0, y: 0 } }],
      style: [
        {
          selector: "node",
          style: {
            width: 58,
            height: 58,
            "background-opacity": 0,
            "border-opacity": 0,
            label: "",
          },
        },
      ],
      layout: { name: "preset" },
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
    });
    cxtmenuProxy = cxtmenuCy.$id("proxy");
    cxtmenuCy.zoom(1);
    cxtmenuCy.pan({ x: 0, y: 0 });
    cxtmenuCy.cxtmenu({
      selector: "node",
      openMenuEvents: "cxttapstart taphold",
      menuRadius: 78,
      activePadding: 18,
      spotlightPadding: 9,
      minSpotlightRadius: 30,
      maxSpotlightRadius: 30,
      fillColor: "rgba(15, 23, 42, 0.82)",
      activeFillColor: "rgba(37, 99, 235, 0.9)",
      itemColor: "#ffffff",
      itemTextShadowColor: "rgba(15,23,42,0.65)",
      zIndex: 9999,
      outsideMenuCancel: 32,
      commands: () => [
        { content: cxtIcon("fa-solid fa-crosshairs", i18n.t("focus")), select: () => focusLinkedBranch(contextNode) },
        { content: cxtIcon("fa-solid fa-pen-to-square", i18n.t("edit")), select: () => showNodeDetails(contextNode, true) },
        { content: cxtIcon("fa-solid fa-tags", i18n.t("labels")), select: () => toggleLabelLayer() },
        { content: cxtIcon("fa-regular fa-copy", i18n.t("copy")), select: () => copyContextNodeId() },
        { content: cxtIcon("fa-solid fa-vial-circle-check", i18n.t("testing")), fillColor: "rgba(250,204,21,0.86)", select: () => setNodeWorkState(contextNode, "testing") },
        { content: cxtIcon("fa-solid fa-circle-exclamation", i18n.t("needed")), fillColor: "rgba(239,68,68,0.86)", select: () => setNodeWorkState(contextNode, "needed") },
        { content: cxtIcon("fa-solid fa-check", i18n.t("done")), fillColor: "rgba(34,197,94,0.86)", select: () => setNodeWorkState(contextNode, "done") },
        { content: cxtIcon("fa-solid fa-user-check", i18n.lang === "uk" ? "Людина" : "Human"), fillColor: "rgba(20,184,166,0.86)", select: () => setNodeWorkflowState(contextNode, "tested_human") },
        { content: cxtIcon("fa-solid fa-trash", i18n.t("trash")), fillColor: "rgba(153,27,27,0.9)", select: () => requestTrashConfirmation(contextNode) },
      ],
    });
    cxtmenuBridge.addEventListener("contextmenu", (event) => event.preventDefault(), true);
  }

  function toggleLabelLayer() {
    labelsVisible = !labelsVisible;
    showAllLabels.checked = labelsVisible;
    applyFilters();
  }

  async function copyContextNodeId() {
    if (!contextNode) return;
    await navigator.clipboard?.writeText(contextNode.id);
    setStatus(`Copied ${contextNode.id}.`);
  }

  function makeCxtmenuEvent(type, point, originalEvent) {
    return {
      type,
      target: cxtmenuProxy,
      cyTarget: cxtmenuProxy,
      cy: cxtmenuCy,
      renderedPosition: { x: point.x, y: point.y },
      cyRenderedPosition: { x: point.x, y: point.y },
      originalEvent: {
        pageX: point.x + window.pageXOffset,
        pageY: point.y + window.pageYOffset,
        clientX: point.x,
        clientY: point.y,
        button: originalEvent?.button || 0,
        buttons: originalEvent?.buttons || 1,
        preventDefault() {},
        stopPropagation() {},
      },
      preventDefault() {},
      stopPropagation() {},
    };
  }

  function startCxtmenuGesture(node, event) {
    if (!cxtmenuCy || !cxtmenuProxy || !node) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    contextNode = node;
    cxtmenuBridge.style.pointerEvents = "none";
    const point = { x: event.clientX, y: event.clientY };
    cxtmenuProxy.position(point);
    cxtmenuCy.resize();
    cxtmenuCy.zoom(1);
    cxtmenuCy.pan({ x: 0, y: 0 });
    cxtmenuProxy.emit(makeCxtmenuEvent("cxttapstart", point, event));
    cxtmenuGesture = { node, started: performance.now(), startPoint: point, lastPoint: point, moved: false };
    return true;
  }

  function moveCxtmenuGesture(event) {
    if (!cxtmenuGesture || !cxtmenuCy) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    const point = { x: event.clientX, y: event.clientY };
    const dx = point.x - cxtmenuGesture.startPoint.x;
    const dy = point.y - cxtmenuGesture.startPoint.y;
    cxtmenuGesture.moved = cxtmenuGesture.moved || Math.hypot(dx, dy) > 8;
    cxtmenuGesture.lastPoint = point;
    cxtmenuProxy.emit(makeCxtmenuEvent("cxtdrag", point, event));
  }

  function endCxtmenuGesture(event) {
    if (!cxtmenuGesture || !cxtmenuCy) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    const point = { x: event.clientX, y: event.clientY };
    cxtmenuProxy.emit(makeCxtmenuEvent("cxttapend", point, event));
    cxtmenuGesture = null;
    return true;
  }

  function showHtmlContextMenu(event, node) {
    if (!contextMenu || !node) return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    contextNode = node;
    contextWorkflowState.value = node.workflowState || "not_done";
    const center = contextMenu.querySelector(".menu-center");
    if (center) {
      const title = String(node.label || node.id);
      const state = workflowStateFor(node.workflowState);
      center.textContent = `${title.slice(0, 34)}${title.length > 34 ? "..." : ""}\n${state?.label || node.status || "node"}`;
    }
    const x = Math.min(Math.max(event.clientX, 112), window.innerWidth - 112);
    const y = Math.min(Math.max(event.clientY, 112), window.innerHeight - 112);
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = "block";
    return true;
  }

  function hideHtmlContextMenu() {
    if (contextMenu) contextMenu.style.display = "none";
  }

  function openContextMenu(node, event) {
    if (contextMenuStyle === "html") return showHtmlContextMenu(event, node);
    return startCxtmenuGesture(node, event);
  }

  async function setNodeWorkState(node, workState) {
    if (!node) return;
    node.workState = workState;
    node.workflowState = workState === "testing" ? "ready_for_test" : workState === "needed" ? "not_done" : "tested_agent";
    applyNodeWorkState(node);
    refreshLabel(node);
    showNodeDetails(node);
    const response = await fetch(appUrl(`/api/graph-edits/${encodeURIComponent(graphId)}/${encodeURIComponent(node.id)}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: node.label,
        detail: node.detail,
        workState,
        workflowState: node.workflowState,
        seenAt: node.seenAt || "",
        attachments: [],
      }),
    });
    if (!response.ok) {
      setStatus(`Could not save ${workState} state for ${node.label}.`);
      return;
    }
    setStatus(`${node.label} marked ${workState}.`);
  }

  function wirePointerEvents() {
    let touchTapCandidate = null;
    let longPressTimer = null;
    let suppressNativeContextUntil = 0;
    const clearTouchTap = () => {
      if (longPressTimer) window.clearTimeout(longPressTimer);
      longPressTimer = null;
      touchTapCandidate = null;
    };
    canvas.addEventListener("pointerdown", (event) => {
      const node = pickNodeAtClientPoint(event.clientX, event.clientY);
      if (!node) return;
      if (event.button === 2 || event.buttons === 2) {
        suppressNativeContextUntil = performance.now() + 1800;
        openContextMenu(node, event);
        return;
      }
      if (["touch", "pen"].includes(event.pointerType)) {
        event.preventDefault();
        touchTapCandidate = {
          node,
          pointerId: event.pointerId,
          startPoint: { x: event.clientX, y: event.clientY },
          moved: false,
          longPressOpened: false,
        };
        longPressTimer = window.setTimeout(() => {
          if (!touchTapCandidate) return;
          touchTapCandidate.longPressOpened = openContextMenu(node, event);
        }, 520);
      }
    }, true);
    canvas.addEventListener("pointermove", (event) => {
      if (cxtmenuGesture) {
        moveCxtmenuGesture(event);
        return;
      }
      if (!touchTapCandidate || touchTapCandidate.pointerId !== event.pointerId) return;
      const dx = event.clientX - touchTapCandidate.startPoint.x;
      const dy = event.clientY - touchTapCandidate.startPoint.y;
      if (Math.hypot(dx, dy) > 12) {
        touchTapCandidate.moved = true;
        if (!touchTapCandidate.longPressOpened) {
          if (longPressTimer) window.clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    }, true);
    canvas.addEventListener("pointerup", (event) => {
      if (cxtmenuGesture) {
        endCxtmenuGesture(event);
        clearTouchTap();
        return;
      }
      if (touchTapCandidate && touchTapCandidate.pointerId === event.pointerId) {
        const candidate = touchTapCandidate;
        clearTouchTap();
        if (!candidate.longPressOpened && !candidate.moved) focusNodeAndPullTree(candidate.node);
      }
    }, true);
    canvas.addEventListener("pointercancel", () => {
      if (cxtmenuGesture) cxtmenuGesture = null;
      clearTouchTap();
    }, true);
    const suppressNativeContextMenu = (event) => {
      const isCanvasContext = event.target === canvas || event.target?.id === "renderCanvas";
      if (isCanvasContext || performance.now() < suppressNativeContextUntil) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    };
    document.addEventListener("contextmenu", suppressNativeContextMenu, true);
    canvas.addEventListener("contextmenu", suppressNativeContextMenu, true);
    scene.onPointerObservable.add((pointerInfo) => {
      const pick = scene.pick(scene.pointerX, scene.pointerY);
      const node = pick?.pickedMesh?.metadata?.node || null;
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
        hoveredNode = node;
        if (node) showNodeDetails(pinnedNode || node);
        else if (!pinnedNode) showNodeDetails(null);
        updateHoverLabel(pointerInfo.event, node);
      }
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.event.button === 2 && node) {
          pointerInfo.event.preventDefault?.();
          pointerInfo.event.stopPropagation?.();
          return;
        }
        if (["touch", "pen"].includes(pointerInfo.event.pointerType)) return;
        hideHtmlContextMenu();
        if (node) {
          focusNodeAndPullTree(node);
        } else {
          pinnedNode = null;
          showNodeDetails(hoveredNode);
        }
      }
    });
  }

  function pickNodeAtClientPoint(clientX, clientY) {
    if (!scene || !engine) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * engine.getRenderWidth();
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * engine.getRenderHeight();
    const pick = scene.pick(x, y);
    return pick?.pickedMesh?.metadata?.node || null;
  }

  function renderTimePanel() {
    const byStatus = new Map();
    for (const node of graphState.nodes) byStatus.set(node.status || "unknown", (byStatus.get(node.status || "unknown") || 0) + 1);
    timePanel.innerHTML = `<strong>Time/status panel</strong>${[...byStatus.entries()].map(([status, count]) => `<div>${escapeHtml(status)}: ${count}</div>`).join("")}<p>Timeline data is not yet attached; this panel uses status as the current learning timeline.</p>`;
  }

  function drawMap() {
    if (mapPanel.style.display === "none" || !graphState) return;
    const xs = graphState.nodes.map((node) => node.position.x);
    const ys = graphState.nodes.map((node) => node.position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = 200;
    const h = 120;
    const points = graphState.nodes.map((node) => {
      const x = 10 + ((node.position.x - minX) / Math.max(1, maxX - minX)) * (w - 20);
      const y = 10 + ((node.position.y - minY) / Math.max(1, maxY - minY)) * (h - 20);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${node.visibleByFilter ? 3 : 1.5}" fill="${escapeHtml(node.color)}" opacity="${node.visibleByFilter ? 0.9 : 0.18}"/>`;
    }).join("");
    mapPanel.innerHTML = `<strong>Map</strong><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${points}</svg>`;
  }

  async function loadGraph() {
    const response = await fetch(GRAPH_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Graph request failed with HTTP ${response.status}`);
    graphState = normalizeGraphModel(await response.json());
    for (const node of graphState.nodes) createNodeMesh(node);
    for (const edge of graphState.edges) createEdgeMesh(edge);
    populateControls();
    updateTrashButton();
    applyFilters();
    showNodeDetails(null);
    renderTimePanel();
    drawMap();
    installTestHooks();
    setStatus(i18n.lang === "uk"
      ? `Завантажено ${graphState.nodes.length} вузлів і ${graphState.edges.length} ребер з ${graphId}.`
      : `Loaded ${graphState.nodes.length} nodes and ${graphState.edges.length} edges from ${graphId}.`);
  }

  function installTestHooks() {
    window.__graphUi3dTest = {
      firstVisibleNodePoint() {
        const nodes = graphState.nodes.filter((item) => item.visibleByFilter && item.mesh?.isEnabled());
        for (const node of nodes) {
          const point = screenPointFor(node.mesh);
          if (point.x > 380 && point.x < window.innerWidth - 420 && point.y > 40 && point.y < window.innerHeight - 80) {
            return { id: node.id, label: node.label, ...point };
          }
        }
        const node = nodes[0];
        return node ? { id: node.id, label: node.label, ...screenPointFor(node.mesh) } : null;
      },
      visibleLabelPoint() {
        const nodes = graphState.nodes.filter((item) => item.visibleByFilter && item.labelPlane?.isEnabled());
        for (const node of nodes) {
          const point = screenPointFor(node.labelPlane);
          if (point.x > 380 && point.x < window.innerWidth - 420 && point.y > 40 && point.y < window.innerHeight - 80) {
            return { id: node.id, label: node.label, ...point };
          }
        }
        const node = nodes[0];
        return node ? { id: node.id, label: node.label, ...screenPointFor(node.labelPlane) } : null;
      },
      detailsTitle() {
        return details.querySelector("h1")?.textContent || "";
      },
      cxtmenuVisible() {
        return [...cxtmenuBridge.querySelectorAll(".cxtmenu > div")].some((item) => item.style.display === "block");
      },
      cxtmenuReady() {
        return Boolean(cxtmenuCy && cxtmenuProxy && cxtmenuBridge.querySelector(".cxtmenu"));
      },
      htmlCxtmenuVisible() {
        return contextMenu.style.display === "block";
      },
      contextMenuStyle() {
        return contextMenuStyle;
      },
      trashCount() {
        return Number(trashCount.textContent || "0");
      },
      trashButtonActive() {
        return trashButton.classList.contains("active");
      },
      requestTrashForFirstVisibleNode() {
        const point = this.firstVisibleNodePoint();
        const node = point ? graphState.nodeById.get(point.id) : graphState.nodes.find((item) => item.visibleByFilter);
        requestTrashConfirmation(node);
        return node ? { id: node.id, label: node.label } : null;
      },
      confirmTrash() {
        trashConfirmButton.click();
      },
      trashConfirmVisible() {
        return trashConfirm.classList.contains("open");
      },
      setContextMenuStyle(style) {
        contextMenuStyleSelect.value = style === "html" ? "html" : "cytoscape";
        contextMenuStyleSelect.dispatchEvent(new Event("change", { bubbles: true }));
        return contextMenuStyle;
      },
      labelDetailLevels() {
        return graphState.nodes
          .filter((node) => node.labelPlane?.isEnabled())
          .map((node) => ({ id: node.id, distance: node.cameraDistance, level: node.detailLevel }))
          .sort((a, b) => a.distance - b.distance);
      },
    };
  }

  function screenPointFor(mesh) {
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const point = BABYLON.Vector3.Project(mesh.getAbsolutePosition(), BABYLON.Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport);
    return { x: point.x, y: point.y };
  }

  function wireControls() {
    menuToggle.addEventListener("click", () => {
      const collapsed = topbar.classList.toggle("collapsed");
      if (collapsed) settingsPanel.classList.remove("open");
    });
    switchView.addEventListener("click", () => {
      window.location.href = i18n.withLang(appUrl(`/cytoscape-2d.html?graph=${encodeURIComponent(graphId)}`));
    });
    layoutSelect.addEventListener("change", runCytoscapeLayout);
    togglePhysics.addEventListener("change", () => {
      physicsPaused = !togglePhysics.checked;
      applyFilters();
    });
    resetLayout.addEventListener("click", resetGraphLayout);
    showAllLabels.addEventListener("change", () => {
      labelsVisible = showAllLabels.checked;
      applyFilters();
    });
    showTimePanel.addEventListener("change", () => {
      timePanel.style.display = showTimePanel.checked ? "block" : "none";
      renderTimePanel();
    });
    showMap.addEventListener("change", () => {
      mapPanel.style.display = showMap.checked ? "block" : "none";
      drawMap();
    });
    groupFilter.addEventListener("change", () => {
      activeGroup = groupFilter.value;
      pinnedNode = null;
      applyFilters();
      showNodeDetails(null);
    });
    workflowFilter.addEventListener("change", () => {
      activeWorkflow = workflowFilter.value;
      pinnedNode = null;
      applyFilters();
      showNodeDetails(null);
    });
    degreeFilter.addEventListener("input", () => {
      activeDegree = Number.parseInt(degreeFilter.value || "0", 10) || 0;
      applyFilters();
    });
    cognitiveSlider.addEventListener("input", () => {
      cognitiveLevel = Number.parseInt(cognitiveSlider.value || "3", 10) || 3;
      cognitiveValue.textContent = String(cognitiveLevel);
      labelsVisible = cognitiveLevel >= 2;
      showAllLabels.checked = labelsVisible;
      for (const node of graphState.nodes) refreshLabel(node);
      applyFilters();
      setStatus(i18n.lang === "uk" ? `Інформаційну щільність встановлено на ${cognitiveLevel}.` : `Viewport information density set to ${cognitiveLevel}.`);
    });
    searchBox.addEventListener("input", () => {
      activeSearch = searchBox.value;
      pinnedNode = null;
      applyFilters();
      focusSearchResult();
    });
    contextSearchButton.addEventListener("click", runContextSearch);
    contextSearchBox.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runContextSearch();
    });
    contextMenu.addEventListener("click", async (event) => {
      const actionButton = event.target?.closest?.("button[data-action]");
      const action = actionButton?.dataset?.action;
      hideHtmlContextMenu();
      if (!contextNode || !action) return;
      if (action === "focus") focusLinkedBranch(contextNode);
      if (action === "edit") showNodeDetails(contextNode, true);
      if (action === "labels") toggleLabelLayer();
      if (action === "copy-id") await copyContextNodeId();
      if (action === "mark-testing") await setNodeWorkState(contextNode, "testing");
      if (action === "mark-needed") await setNodeWorkState(contextNode, "needed");
      if (action === "mark-done") await setNodeWorkState(contextNode, "done");
      if (action === "trash") requestTrashConfirmation(contextNode);
    });
    contextWorkflowState.addEventListener("change", async () => {
      if (!contextNode) return;
      await setNodeWorkflowState(contextNode, contextWorkflowState.value);
      hideHtmlContextMenu();
    });
    contextWorkflowState.addEventListener("click", (event) => event.stopPropagation());
    trashButton.addEventListener("click", (event) => {
      event.stopPropagation();
      showTrashPanel();
    });
    trashCancel.addEventListener("click", () => {
      pendingTrashNode = null;
      trashConfirm.classList.remove("open");
    });
    trashConfirmButton.addEventListener("click", async () => {
      const node = pendingTrashNode;
      if (!node) return;
      await moveNodeToTrash(node);
    });
    document.addEventListener("click", (event) => {
      if (contextMenu.style.display === "block" && !contextMenu.contains(event.target)) hideHtmlContextMenu();
      if (trashPanel.classList.contains("open") && !trashPanel.contains(event.target) && !trashButton.contains(event.target)) {
        trashPanel.classList.remove("open");
      }
      if (trashConfirm.classList.contains("open") && !trashConfirm.contains(event.target)) {
        trashConfirm.classList.remove("open");
        pendingTrashNode = null;
      }
      if (settingsPanel.classList.contains("open") && !settingsPanel.contains(event.target) && !settingsToggle.contains(event.target)) {
        settingsPanel.classList.remove("open");
      }
    });
    settingsToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      settingsPanel.classList.toggle("open");
    });
    contextMenuStyleSelect.value = contextMenuStyle;
    contextMenuStyleSelect.addEventListener("change", () => {
      contextMenuStyle = contextMenuStyleSelect.value === "html" ? "html" : "cytoscape";
      localStorage.setItem("graphUiContextMenuStyle", contextMenuStyle);
      hideHtmlContextMenu();
      setStatus(i18n.lang === "uk"
        ? `Стиль контекстного меню: ${contextMenuStyle === "html" ? "HTML кнопки" : "радіальне Cytoscape"}.`
        : `Context menu style set to ${contextMenuStyle === "html" ? "HTML buttons" : "cytoscape radial"}.`);
    });
  }

  async function setNodeWorkflowState(node, workflowState) {
    node.workflowState = workflowState;
    refreshLabel(node);
    showNodeDetails(node);
    const response = await fetch(appUrl(`/api/graph-edits/${encodeURIComponent(graphId)}/${encodeURIComponent(node.id)}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: node.label,
        detail: node.detail,
        workflowState,
        workState: workflowState,
        seenAt: node.seenAt || "",
        attachments: [],
      }),
    });
    setStatus(response.ok
      ? (i18n.lang === "uk" ? `Workflow-стан ${node.label} змінено.` : `${node.label} workflow state changed.`)
      : (i18n.lang === "uk" ? `Не вдалось зберегти workflow-стан для ${node.label}.` : `Could not save workflow state for ${node.label}.`));
  }

  async function markNodeSeen(node) {
    node.seenAt = new Date().toISOString();
    refreshLabel(node);
    const response = await fetch(appUrl(`/api/graph-edits/${encodeURIComponent(graphId)}/${encodeURIComponent(node.id)}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: node.label,
        detail: node.detail,
        workflowState: node.workflowState,
        workState: node.workState,
        seenAt: node.seenAt,
        attachments: [],
      }),
    });
    if (!response.ok) setStatus(i18n.lang === "uk" ? `Seen-стан не збережено для ${node.label}.` : `Seen state was not saved for ${node.label}.`);
  }

  async function main() {
    i18n.translatePage();
    i18n.wireLanguageSelect();
    if (!window.BABYLON) {
      setStatus(i18n.lang === "uk" ? "Babylon.js не завантажився. Перевір доступ до https://cdn.babylonjs.com/babylon.js." : "Babylon.js did not load. Check network access to https://cdn.babylonjs.com/babylon.js.");
      details.innerHTML = i18n.lang === "uk"
        ? "<h1>Babylon.js недоступний</h1><p>Цей прототип використовує Babylon.js CDN. Запусти Node sidecar і дозволь цей CDN script, або пізніше завендор Babylon локально.</p>"
        : "<h1>Babylon.js unavailable</h1><p>This prototype uses the Babylon.js CDN. Start the Node sidecar and allow that CDN script, or vendor Babylon locally later.</p>";
      return;
    }
    togglePhysics.checked = !physicsPaused;
    initScene();
    await populateGraphSelect();
    wireControls();
    initCxtmenuBridge();
    wirePointerEvents();
    await loadGraph();
  }

  main().catch((error) => {
    console.error(error);
    setStatus(error.message);
    details.innerHTML = `<h1>${i18n.lang === "uk" ? "Граф не завантажився" : "Graph load failed"}</h1><p>${escapeHtml(error.message)}</p>`;
  });
})();
