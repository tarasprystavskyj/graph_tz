(async function () {
  "use strict";

  const graphId = new URLSearchParams(window.location.search).get("graph") || "job-apply-full";
  const BASE_PATH = window.GRAPH_UI_BASE_PATH || "";
  const appUrl = (path) => `${BASE_PATH}${path}`;
  const i18n = window.GraphUiI18n || {
    lang: "uk",
    t: (key) => key,
    apiUrl: (path) => appUrl(path),
    translatePage() {},
    wireLanguageSelect() {},
  };
  i18n.translatePage();
  i18n.wireLanguageSelect();
  const model = await fetch(i18n.apiUrl(`/api/graph-model/${encodeURIComponent(graphId)}`), { cache: "no-store" }).then((res) => res.json());
  const board = document.getElementById("board");
  const svg = document.getElementById("edges");
  const minimap = document.getElementById("minimap");
  const details = document.getElementById("details");
  const searchBox = document.getElementById("searchBox");
  const groups = [...new Set(model.nodes.map((node) => node.group))];
  const groupIndex = new Map(groups.map((group, index) => [group, index]));
  const positions = new Map();

  board.style.width = `${Math.max(1400, groups.length * 285 + 100)}px`;
  board.style.height = `${Math.max(900, model.nodes.length * 48)}px`;

  for (const [index, group] of groups.entries()) {
    const title = document.createElement("div");
    title.className = "lane-title";
    title.style.left = `${44 + index * 285}px`;
    title.textContent = model.groups[group]?.label || group;
    board.appendChild(title);
  }

  const byGroupCount = new Map();
  for (const node of model.nodes) {
    const lane = groupIndex.get(node.group) || 0;
    const row = byGroupCount.get(node.group) || 0;
    byGroupCount.set(node.group, row + 1);
    const x = 40 + lane * 285;
    const y = 48 + row * 148;
    positions.set(node.id, { x, y });
    board.appendChild(cardForNode(node, x, y));
  }

  drawEdges();
  drawMinimap();
  setDetails(null);

  function cardForNode(node, x, y) {
    const card = document.createElement("article");
    card.className = "node-card";
    card.dataset.id = node.id;
    card.dataset.search = `${node.label} ${node.detail} ${node.group} ${node.status} ${node.agentBranch?.subtreeRoot || ""} ${node.visualKey?.label || ""}`.toLowerCase();
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.innerHTML = `
      <div class="handle in"></div>
      <div class="handle out"></div>
      <header class="node-head" style="background:${escapeHtml(node.color)}">
        <span class="icon">${escapeHtml(node.icon || "•")}</span>
        <span>${escapeHtml(node.label)}</span>
      </header>
      <div class="node-body">
        <div>${escapeHtml(node.status)} | ${i18n.lang === "uk" ? "власник" : "owner"}=${escapeHtml(node.owner || "system")}</div>
        <div>${escapeHtml(node.agentBranch?.subtreeRoot || i18n.t("agentBranchAttachPoint"))}</div>
        <div class="preview">
          <span class="preview-badge" style="--vk-bg:${escapeHtml(node.visualKey?.bg || node.color)}; --vk-fg:${escapeHtml(node.visualKey?.fg || "#ffffff")}">${escapeHtml(node.visualKey?.symbol || node.icon || "ND")}</span>
          <span>${escapeHtml(node.visualKey?.label || i18n.t("visualKeyPending"))}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      document.querySelectorAll(".node-card").forEach((item) => item.classList.remove("selected"));
      card.classList.add("selected");
      setDetails(node);
    });
    return card;
  }

  function drawEdges() {
    svg.setAttribute("viewBox", `0 0 ${board.scrollWidth} ${board.scrollHeight}`);
    svg.innerHTML = `<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#94a3b8"/></marker></defs>`;
    for (const edge of model.edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const x1 = source.x + 235;
      const y1 = source.y + 58;
      const x2 = target.x;
      const y2 = target.y + 58;
      const mid = Math.max(36, Math.abs(x2 - x1) / 2);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#94a3b8");
      path.setAttribute("stroke-width", "1.6");
      path.setAttribute("marker-end", "url(#arrow)");
      svg.appendChild(path);
    }
  }

  function drawMinimap() {
    const boardWidth = Number.parseFloat(board.style.width) || 1400;
    const boardHeight = Number.parseFloat(board.style.height) || 900;
    const width = 210;
    const height = 132;
    const scale = Math.min(width / boardWidth, height / boardHeight);
    minimap.setAttribute("viewBox", `0 0 ${width} ${height}`);
    minimap.innerHTML = `<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#f8fafc"/>`;
    for (const node of model.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(6 + pos.x * scale));
      rect.setAttribute("y", String(6 + pos.y * scale));
      rect.setAttribute("width", String(Math.max(5, 235 * scale)));
      rect.setAttribute("height", String(Math.max(4, 116 * scale)));
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", node.color || "#64748b");
      rect.setAttribute("opacity", "0.78");
      minimap.appendChild(rect);
    }
  }

  function setDetails(node) {
    if (!node) {
      details.innerHTML = `<strong>${escapeHtml(i18n.t("readableCards"))}</strong>${model.nodes.length} ${i18n.t("nodesArranged")}`;
      return;
    }
    details.innerHTML = `
      <strong>${escapeHtml(node.label)}</strong>
      <div>${escapeHtml(node.groupLabel)} | ${escapeHtml(node.status)} | ${i18n.lang === "uk" ? "власник" : "owner"}=${escapeHtml(node.owner || "system")}</div>
      <div>${i18n.lang === "uk" ? "оверлей гілки" : "branch overlay"}: ${escapeHtml(node.agentBranch?.overlayClass || "agent_branch")}</div>
      <div>CLI agent: ${escapeHtml(node.agentBranch?.cliAgentType || "codex")}</div>
      <div>${i18n.lang === "uk" ? "візуальний ключ" : "visual key"}: ${escapeHtml(node.visualKey?.label || "pending")}</div>
      <p>${escapeHtml(node.detail || i18n.t("noDetailAttached"))}</p>
    `;
  }

  searchBox.addEventListener("input", () => {
    const query = searchBox.value.trim().toLowerCase();
    document.querySelectorAll(".node-card").forEach((card) => {
      card.classList.toggle("dimmed", Boolean(query) && !card.dataset.search.includes(query));
    });
  });
  document.getElementById("fitBtn").addEventListener("click", () => document.getElementById("viewport").scrollTo({ left: 0, top: 0, behavior: "smooth" }));
  document.getElementById("resetBtn").addEventListener("click", () => {
    searchBox.value = "";
    document.querySelectorAll(".node-card").forEach((card) => card.classList.remove("dimmed", "selected"));
    setDetails(null);
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
