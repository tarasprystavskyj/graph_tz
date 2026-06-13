(async function () {
  "use strict";

  const graphId = new URLSearchParams(window.location.search).get("graph") || "job-apply-full";
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
  i18n.translatePage();
  i18n.wireLanguageSelect();
  const response = await fetch(i18n.apiUrl(`/api/graph-model/${encodeURIComponent(graphId)}`), { cache: "no-store" });
  const model = await response.json();
  const details = document.getElementById("details");
  const status = document.getElementById("status");
  const graphSelect = document.getElementById("graphSelect");
  const switch3d = document.getElementById("switch3d");
  const layoutSelect = document.getElementById("layoutSelect");
  const groupFilter = document.getElementById("groupFilter");
  const statusFilter = document.getElementById("statusFilter");
  const searchBox = document.getElementById("searchBox");
  const encodedGraphId = encodeURIComponent(graphId);

  fetch(i18n.apiUrl("/api/graphs"), { cache: "no-store" })
    .then((res) => res.json())
    .then((graphs) => {
      graphSelect.innerHTML = Object.entries(graphs)
        .map(([id, graph]) => `<option value="${escapeHtml(id)}"${id === graphId ? " selected" : ""}>${escapeHtml(graph.label)}</option>`)
        .join("");
    });
  graphSelect.addEventListener("change", () => {
    window.location.href = i18n.withLang(appUrl(`/cytoscape-2d.html?graph=${encodeURIComponent(graphSelect.value)}`));
  });
  switch3d.addEventListener("click", () => {
    window.location.href = i18n.withLang(appUrl(`/babylon-3d.html?graph=${encodedGraphId}`));
  });

  document.querySelectorAll("[data-export]").forEach((link) => {
    const kind = link.getAttribute("data-export");
    link.href = kind === "model" ? i18n.apiUrl(`/api/graph-model/${encodedGraphId}`) : appUrl(`/api/exports/${encodedGraphId}/${kind}`);
  });

  const groups = Object.values(model.groups || {}).sort((a, b) => a.label.localeCompare(b.label));
  groupFilter.insertAdjacentHTML(
    "beforeend",
    groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.label)}</option>`).join(""),
  );

  const statuses = model.workflowStates || [...new Set(model.nodes.map((node) => node.status).filter(Boolean))].sort().map((item) => ({ id: item, label: item }));
  statusFilter.insertAdjacentHTML(
    "beforeend",
    statuses.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join(""),
  );

  const cy = cytoscape({
    container: document.getElementById("cy"),
    elements: [
      ...model.nodes.map((node) => ({
        data: {
          id: node.id,
          label: `${node.visualKey?.symbol || node.icon || ""} ${node.label}`,
          detail: node.detail,
          group: node.group,
          groupLabel: node.groupLabel,
          status: node.status,
          workState: node.workState || "",
          workflowState: node.workflowState || "not_done",
          owner: node.owner,
          color: node.color,
          visualBadgeUrl: visualBadgeDataUrl(node),
          visualBg: node.visualKey?.bg || node.color,
          visualFg: node.visualKey?.fg || "#ffffff",
          visualSymbol: node.visualKey?.symbol || node.icon || "ND",
          type: node.type,
          visualKey: node.visualKey?.label || "visual key pending",
          branch: node.agentBranch?.subtreeRoot || node.agentBranch?.branchId || "",
        },
        position: node.position ? { x: node.position.x, y: node.position.y } : undefined,
      })),
      ...model.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          color: edge.color,
        },
      })),
    ],
    style: [
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          "background-image": "data(visualBadgeUrl)",
          "background-fit": "contain",
          "background-height": "46%",
          "background-width": "46%",
          "background-position-x": "50%",
          "background-position-y": "38%",
          "border-color": "#ffffff",
          "border-width": 2,
          color: "#17202a",
          content: "data(label)",
          "font-size": 11,
          "min-zoomed-font-size": 6,
          height: 50,
          "overlay-opacity": 0,
          shape: "round-rectangle",
          "text-background-color": "#ffffff",
          "text-background-opacity": 0.82,
          "text-background-padding": "3px",
          "text-margin-y": 20,
          width: 68,
        },
      },
      { selector: 'node[type *= "diamond"]', style: { shape: "diamond" } },
      { selector: 'node[type *= "hex"]', style: { shape: "hexagon" } },
      { selector: 'node[type *= "octagon"]', style: { shape: "octagon" } },
      { selector: 'node[type *= "cylinder"]', style: { shape: "barrel" } },
      { selector: 'node[workState = "testing"]', style: { "border-color": "#facc15", "border-width": 6 } },
      { selector: 'node[workState = "needed"]', style: { "border-color": "#ef4444", "border-width": 6 } },
      { selector: 'node[workState = "done"]', style: { "border-color": "#22c55e", "border-width": 6 } },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "line-color": "#94a3b8",
          "target-arrow-color": "#94a3b8",
          "target-arrow-shape": "triangle",
          "font-size": 9,
          color: "#475569",
          label: "data(label)",
          "text-background-color": "#ffffff",
          "text-background-opacity": 0.74,
          width: 1.6,
        },
      },
      { selector: ".dimmed", style: { opacity: 0.12, "text-opacity": 0.08 } },
      { selector: ".focused", style: { "border-color": "#f59e0b", "border-width": 5, "z-index": 10 } },
      { selector: ".hidden", style: { display: "none" } },
    ],
    layout: layoutOptions("cose"),
  });

  function layoutOptions(name) {
    if (name === "development-flow") return { name: "preset", fit: true, padding: 64 };
    return {
      name,
      animate: true,
      animationDuration: 460,
      fit: true,
      padding: 64,
      nodeDimensionsIncludeLabels: true,
      idealEdgeLength: 96,
      nodeRepulsion: 6200,
    };
  }

  function setDetails(node) {
    if (!node) {
      details.innerHTML = `<strong>${escapeHtml(i18n.t("cytoscapeView"))}</strong>${model.nodes.length} ${i18n.lang === "uk" ? "вузлів" : "nodes"}, ${model.edges.length} ${i18n.lang === "uk" ? "ребер" : "edges"}. ${i18n.lang === "uk" ? "Спочатку фільтруй, потім поступово інспектуй." : "Filter first, then inspect gradually."}`;
      return;
    }
    const data = node.data();
    details.innerHTML = `
      <strong>${escapeHtml(data.label)}</strong>
      <div>${escapeHtml(data.groupLabel)} | ${escapeHtml(data.status)}${data.workState ? ` | work=${escapeHtml(data.workState)}` : ""} | ${i18n.lang === "uk" ? "власник" : "owner"}=${escapeHtml(data.owner || "system")}</div>
      <div>${i18n.lang === "uk" ? "гілка" : "branch"}: ${escapeHtml(data.branch || (i18n.lang === "uk" ? "прив'язка очікує" : "attach pending"))}</div>
      <div>${i18n.lang === "uk" ? "візуальний ключ" : "visual key"}: ${escapeHtml(data.visualSymbol)} - ${escapeHtml(data.visualKey || i18n.t("visualKeyPending"))}</div>
      <p>${escapeHtml(data.detail || i18n.t("noDetailAttached"))}</p>
    `;
  }

  function applyFilters() {
    const group = groupFilter.value;
    const nodeStatus = statusFilter.value;
    const query = searchBox.value.trim().toLowerCase();
    let visible = 0;

    cy.batch(() => {
      cy.elements().removeClass("hidden dimmed focused");
      cy.nodes().forEach((node) => {
        const data = node.data();
        const text = `${data.label} ${data.detail} ${data.group} ${data.status} ${data.workflowState}`.toLowerCase();
        const show = (!group || data.group === group) && (!nodeStatus || data.workflowState === nodeStatus) && (!query || text.includes(query));
        node.toggleClass("hidden", !show);
        if (show) visible += 1;
      });
      cy.edges().forEach((edge) => {
        edge.toggleClass("hidden", edge.source().hasClass("hidden") || edge.target().hasClass("hidden"));
      });
    });
    status.textContent = `${visible}/${model.nodes.length} ${i18n.t("nodesVisible")}`;
  }

  function focusNeighborhood() {
    const selected = cy.$("node:selected")[0] || cy.nodes().not(".hidden")[0];
    if (!selected) return;
    const neighborhood = selected.closedNeighborhood();
    cy.elements().addClass("dimmed");
    neighborhood.removeClass("dimmed hidden");
    selected.addClass("focused");
    cy.animate({ fit: { eles: neighborhood, padding: 80 } }, { duration: 360 });
    setDetails(selected);
  }

  cy.on("tap mouseover", "node", (event) => setDetails(event.target));
  cy.on("tap", "node", (event) => {
    cy.nodes().removeClass("focused");
    event.target.addClass("focused");
  });

  layoutSelect.addEventListener("change", () => {
    if (layoutSelect.value === "development-flow") applyDevelopmentFlow();
    cy.layout(layoutOptions(layoutSelect.value)).run();
    status.textContent = i18n.lang === "uk" ? `Розкладку переключено на ${layoutSelect.value}.` : `Layout switched to ${layoutSelect.value}.`;
  });
  document.getElementById("focusNeighborhood").addEventListener("click", focusNeighborhood);
  document.getElementById("showAll").addEventListener("click", () => {
    searchBox.value = "";
    groupFilter.value = "";
    statusFilter.value = "";
    cy.elements().removeClass("hidden dimmed focused");
    cy.fit(undefined, 64);
    setDetails(null);
    status.textContent = `${model.nodes.length}/${model.nodes.length} ${i18n.t("nodesVisible")}`;
  });
  groupFilter.addEventListener("change", applyFilters);
  statusFilter.addEventListener("change", applyFilters);
  searchBox.addEventListener("input", applyFilters);
  cy.ready(() => status.textContent = `${model.nodes.length}/${model.nodes.length} ${i18n.t("nodesVisible")}`);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function visualBadgeDataUrl(node) {
    const key = node.visualKey || {};
    const bg = key.bg || node.color || "#64748b";
    const fg = key.fg || "#ffffff";
    const symbol = String(key.symbol || node.icon || "ND").slice(0, 5);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72"><rect x="8" y="8" width="80" height="56" rx="12" fill="${escapeXml(bg)}" stroke="rgba(255,255,255,.9)" stroke-width="4"/><text x="48" y="43" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${escapeXml(fg)}">${escapeXml(symbol)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyDevelopmentFlow() {
    const rowsByStage = new Map();
    cy.nodes().forEach((node) => {
      const stage = developmentStage(node.data());
      const row = rowsByStage.get(stage) || 0;
      rowsByStage.set(stage, row + 1);
      node.position({
        x: 140 + stage * 190,
        y: 100 + row * 88,
      });
    });
  }

  function developmentStage(data) {
    const text = `${data.id} ${data.label} ${data.detail} ${data.group} ${data.status} ${data.visualKey}`.toLowerCase();
    if (text.includes("learn") || text.includes("require") || text.includes("tz") || text.includes("goal")) return 0;
    if (text.includes("design") || text.includes("architecture") || text.includes("flow") || text.includes("layout")) return 1;
    if (text.includes("data") || text.includes("api") || text.includes("model")) return 2;
    if (text.includes("edit") || text.includes("implement") || text.includes("ui") || text.includes("babylon") || text.includes("cytoscape")) return 3;
    if (text.includes("test") || text.includes("qa") || text.includes("smoke")) return 4;
    if (text.includes("review") || text.includes("human") || text.includes("approve")) return 5;
    return 6;
  }
})();
