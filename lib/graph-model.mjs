import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const sidecarRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const workspaceRoot = resolve(sidecarRoot, "..");

export const graphFiles = {
  "job-apply-full": {
    label: "JobApply full TZ graph",
    path: resolve(sidecarRoot, "public", "data", "job_apply_full_tz_cytoscape.json"),
    fallbackPath: resolve(workspaceRoot, "happyuser-visual_link_analisis-c4307a2aa7f8", "sample_graphs", "job_apply_full_tz_cytoscape.json"),
  },
  "job-apply-product": {
    label: "JobApply product TZ graph",
    path: resolve(workspaceRoot, "happyuser-visual_link_analisis-c4307a2aa7f8", "sample_graphs", "job_apply_tz_cytoscape.json"),
    fallbackPath: resolve(sidecarRoot, "public", "data", "job_apply_full_tz_cytoscape.json"),
  },
  "server-telemetry": {
    label: "Server telemetry hub TZ graph",
    path: resolve(workspaceRoot, "happyuser-visual_link_analisis-c4307a2aa7f8", "sample_graphs", "server_telemetry_hub_tz_cytoscape.json"),
    fallbackPath: resolve(sidecarRoot, "public", "data", "job_apply_full_tz_cytoscape.json"),
  },
  "current-project-learning": {
    label: "Current project learning graph",
    path: resolve(sidecarRoot, "public", "data", "current_project_learning_cytoscape.json"),
  },
};

const groupFallbacks = {
  product: { label: "Product / TZ", color: "#256f55", icon: "TZ" },
  project: { label: "Project", color: "#256f55", icon: "PR" },
  learn: { label: "How to use", color: "#2f855a", icon: "LR" },
  discovery: { label: "Discovery", color: "#2f855a", icon: "SC" },
  platform: { label: "Platforms", color: "#3a9f71", icon: "PF" },
  data: { label: "Data", color: "#437f97", icon: "DB" },
  safety: { label: "Safety gates", color: "#b7791f", icon: "GT" },
  operations: { label: "Operations", color: "#c05621", icon: "OP" },
  ui: { label: "Interfaces", color: "#5a67d8", icon: "UI" },
  interface: { label: "Interfaces", color: "#5a67d8", icon: "UI" },
  visual: { label: "Visual keys", color: "#b7791f", icon: "VK" },
  observability: { label: "Observability", color: "#718096", icon: "OB" },
  quality: { label: "Quality", color: "#805ad5", icon: "QA" },
  agent_branch: { label: "Agent branch", color: "#0f766e", icon: "AG" },
  subagent_task: { label: "Sub-agent tasks", color: "#0ea5e9", icon: "SA" },
  next: { label: "Next", color: "#d69e2e", icon: "NX" },
};

const keywordIconRules = [
  ["browser", "browser", "fa-solid fa-globe", "BR"],
  ["chrome", "chrome", "fa-brands fa-chrome", "CH"],
  ["github", "github", "fa-brands fa-github", "GH"],
  ["telegram", "telegram", "fa-brands fa-telegram", "TG"],
  ["form", "web form", "fa-regular fa-rectangle-list", "FM"],
  ["field", "field", "fa-solid fa-i-cursor", "FL"],
  ["upload", "upload", "fa-solid fa-upload", "UP"],
  ["submit", "submit", "fa-solid fa-paper-plane", "SB"],
  ["test", "test", "fa-solid fa-vial-circle-check", "TS"],
  ["smoke", "smoke test", "fa-solid fa-fire-flame-simple", "SM"],
  ["visual", "visual key", "fa-solid fa-image", "VK"],
  ["screenshot", "screenshot", "fa-regular fa-image", "IM"],
  ["agent", "agent", "fa-solid fa-user-gear", "AG"],
  ["branch", "branch", "fa-solid fa-code-branch", "BR"],
  ["api", "api", "fa-solid fa-plug", "API"],
  ["data", "data", "fa-solid fa-database", "DB"],
  ["export", "export", "fa-solid fa-file-export", "EX"],
  ["safety", "safety", "fa-solid fa-shield-halved", "SF"],
  ["layout", "layout", "fa-solid fa-diagram-project", "LY"],
  ["flow", "flow", "fa-solid fa-timeline", "FL"],
  ["edit", "edit", "fa-solid fa-pen-to-square", "ED"],
  ["focus", "focus", "fa-solid fa-crosshairs", "FC"],
  ["map", "map", "fa-regular fa-map", "MP"],
  ["time", "time", "fa-regular fa-clock", "TM"],
  ["label", "label", "fa-solid fa-tag", "LB"],
  ["node", "node", "fa-regular fa-circle-dot", "ND"],
];

const groupKeywords = {
  project: [["project", "fa-solid fa-bullseye", "PR"]],
  learn: [["learn", "fa-solid fa-graduation-cap", "LR"]],
  ui: [["ui", "fa-solid fa-window-maximize", "UI"]],
  interface: [["ui", "fa-solid fa-window-maximize", "UI"]],
  data: [["data", "fa-solid fa-database", "DB"]],
  safety: [["safety", "fa-solid fa-shield-halved", "SF"]],
  quality: [["test", "fa-solid fa-vial-circle-check", "QA"]],
  visual: [["visual", "fa-solid fa-image", "VK"]],
  agent_branch: [["agent", "fa-solid fa-user-gear", "AG"]],
  subagent_task: [["sub-agent", "fa-solid fa-people-arrows", "SA"]],
  next: [["next", "fa-solid fa-forward-step", "NX"]],
};

const workflowStates = [
  { id: "not_done", label: "1. Не зроблено", color: "#ef4444" },
  { id: "approved", label: "2. Заапрувлено у роботу", color: "#f97316" },
  { id: "in_progress", label: "3. У роботі", color: "#f59e0b", animateTo: "#facc15" },
  { id: "ready_for_test", label: "4. Для тестування", color: "#facc15" },
  { id: "testing_agent", label: "5. Тестує агент", color: "#facc15", animateTo: "#a3e635" },
  { id: "tested_agent", label: "6. Перевірено агентом", color: "#a3e635" },
  { id: "tested_human", label: "7. Перевірено людиною", color: "#22c55e" },
];

export const superpowerFlow = {
  schema: "job.graph_superpower_flow.v0",
  source: "placeholder_local_contract",
  note:
    "No local superpower implementation was found in the safe search scope. This contract is the integration point to replace once the owner points to the canonical pattern.",
  stages: [
    "focus",
    "attach_agent_branch",
    "produce_artifact",
    "visual_key_update",
    "human_review",
    "release_or_replace_agent",
  ],
  agentBranchModel: {
    overlayClass: "agent_branch",
    cliAgentTypes: ["codex", "claude", "human"],
    replacementSignals: ["context_overflow", "degraded_reasoning", "stale_branch", "owner_requested_replace"],
    replacementRule:
      "A branch may replace its CLI agent while preserving node id, parent task, artifacts, decisions, and visual keys.",
  },
};

export function normalizeCytoscapeGraph(payload) {
  const rawNodes = Array.isArray(payload?.elements?.nodes) ? payload.elements.nodes : [];
  const rawEdges = Array.isArray(payload?.elements?.edges) ? payload.elements.edges : [];
  const groups = {};

  const nodes = rawNodes
    .map((item) => {
      const data = item.data || {};
      const id = String(data.id || "");
      if (!id) return null;
      const group = String(data.group || "unknown");
      const fallback = groupFallbacks[group] || { label: group, color: data.color || "#64748b", icon: "ND" };
      const color = data.color || fallback.color;
      const type = data.type || data.labelV || "round";
      const label = data._label || data.label || data.name || data.title || id;
      const detail = data.detail || data.comment || "";
      const visualKey = buildVisualKey({ id, label, detail, group, status: data.status || "unknown", type, color });
      groups[group] ||= {
        id: group,
        label: data.group_label || fallback.label,
        color,
        icon: data.icon || visualKey.symbol || fallback.icon,
      };
      return {
        id,
        label,
        detail,
        group,
        groupLabel: data.group_label || groups[group].label,
        status: data.status || "unknown",
        workState: data.work_state || data.workState || "",
        owner: data.owner || "system",
        priority: data.priority || "",
        type,
        color,
        icon: data.icon || visualKey.symbol || fallback.icon,
        classes: item.classes || "",
        isNew: Boolean(data.is_new || data.isNew),
        seenAt: data.seen_at || data.seenAt || "",
        testComments: Array.isArray(data.test_comments) ? data.test_comments : [],
        testFlow: data.test_flow || data.testFlow || null,
        position: item.position || null,
        visualKey,
        keywords: deriveKeywords({ id, label, detail, group, type }),
        workflowState: normalizeWorkflowState(data.workflow_state || data.work_state || data.workState || data.status),
        agentBranch: {
          enabled: true,
          overlayClass: "agent_branch",
          cliAgentType: "codex",
          status: "available",
          replacementSignals: superpowerFlow.agentBranchModel.replacementSignals,
          subtreeRoot: `agent:${id}`,
        },
      };
    })
    .filter(Boolean);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges
    .map((item) => {
      const data = item.data || {};
      const source = String(data.source || "");
      const target = String(data.target || "");
      if (!nodeIds.has(source) || !nodeIds.has(target)) return null;
      return {
        id: data.id || `${source}->${target}`,
        source,
        target,
        label: data.label || data.name || "",
        color: data.color || "#94a3b8",
        dataFlow: {
          artifactKinds: ["decision", "status", "visual_key"],
          status: "read_only",
        },
      };
    })
    .filter(Boolean);

  return {
    schema: "job.graph_ui_model.v0",
    sourceSchema: payload?.schema || "cytoscape",
    nodes,
    edges,
    groups,
    workflowStates,
    superpowerFlow,
  };
}

function normalizeWorkflowState(value) {
  const text = String(value || "").toLowerCase();
  if (workflowStates.some((state) => state.id === text)) return text;
  if (["done", "tested", "verified", "complete"].some((item) => text.includes(item))) return "tested_agent";
  if (["test", "qa"].some((item) => text.includes(item))) return "ready_for_test";
  if (["active", "progress", "testing"].some((item) => text.includes(item))) return "in_progress";
  if (["approved", "planned"].some((item) => text.includes(item))) return "approved";
  return "not_done";
}

function deriveKeywords(node) {
  const text = `${node.id} ${node.label} ${node.detail} ${node.group} ${node.type}`.toLowerCase();
  const seen = new Set();
  const result = [];
  for (const item of groupKeywords[node.group] || []) {
    pushKeyword(result, seen, item[0], item[1], item[2], "group");
  }
  for (const [needle, term, faClass, symbol] of keywordIconRules) {
    if (text.includes(needle)) pushKeyword(result, seen, term, faClass, symbol, "derived");
    if (result.length >= 5) break;
  }
  if (!result.length) pushKeyword(result, seen, node.group || "node", "fa-regular fa-circle-dot", "ND", "fallback");
  return result.slice(0, 5);
}

function pushKeyword(result, seen, term, faClass, symbol, source) {
  if (seen.has(term)) return;
  seen.add(term);
  result.push({ term, faClass, symbol, source });
}

function buildVisualKey(node) {
  const strongText = `${node.id} ${node.label} ${node.group} ${node.type}`.toLowerCase();
  const text = `${strongText} ${node.detail}`.toLowerCase();
  const siteMatchers = [
    ["github", "GH", "GitHub branch/repo", "#24292f", "#ffffff"],
    ["linkedin", "in", "LinkedIn profile/site", "#0a66c2", "#ffffff"],
    ["djinni", "Dj", "Djinni site", "#0f766e", "#ffffff"],
    ["olx", "OLX", "OLX site", "#002f34", "#ffffff"],
    ["telegram", "TG", "Telegram channel/bot", "#229ed9", "#ffffff"],
    ["chrome", "Ch", "Browser automation", "#f4b400", "#111827"],
    ["browser", "Br", "Browser automation", "#f4b400", "#111827"],
  ];

  for (const [needle, symbol, label, bg, fg] of siteMatchers) {
    if (strongText.includes(needle)) {
      return {
        kind: "site-logo-placeholder",
        label,
        symbol,
        bg,
        fg,
        artifactRef: null,
        source: "derived-from-node-text",
      };
    }
  }

  if (strongText.includes("form") || strongText.includes("field") || strongText.includes("upload") || strongText.includes("submit")) {
    return visualKey("form-preview-placeholder", "Web form preview", "FORM", "#7c3aed", "#ffffff");
  }
  if (strongText.includes("screenshot") || strongText.includes("visual key") || node.group === "visual") {
    return visualKey("artifact-preview-placeholder", "Screenshot/artifact preview", "IMG", "#b7791f", "#ffffff");
  }
  if (strongText.includes("test") || node.group === "quality") {
    return visualKey("qa-preview-placeholder", "Test evidence", "QA", "#805ad5", "#ffffff");
  }
  if (strongText.includes("agent") || node.group === "agent_branch" || node.group === "subagent_task") {
    return visualKey("agent-preview-placeholder", "Agent branch/task", "AG", "#0f766e", "#ffffff");
  }
  if (node.group === "data") return visualKey("data-preview-placeholder", "Data/API artifact", "DB", "#437f97", "#ffffff");
  if (node.group === "safety") return visualKey("safety-preview-placeholder", "Safety gate", "SAFE", "#c05621", "#ffffff");
  if (node.group === "ui" || node.group === "interface") return visualKey("ui-preview-placeholder", "UI surface", "UI", "#5a67d8", "#ffffff");
  if (node.group === "learn") return visualKey("learning-preview-placeholder", "Learning step", "LEARN", "#2f855a", "#ffffff");
  if (node.group === "next") return visualKey("next-step-placeholder", "Next action", "NEXT", "#d69e2e", "#111827");
  return visualKey("symbolic-preview-placeholder", node.status ? `Latest ${node.status} visual key` : "Visual key pending", "NODE", node.color || "#64748b", "#ffffff");
}

function visualKey(kind, label, symbol, bg, fg) {
  return {
    kind,
    label,
    symbol,
    bg,
    fg,
    artifactRef: null,
    source: "derived-from-node-group",
  };
}

export async function readGraphPayload(graphId = "job-apply-full") {
  const graph = graphFiles[graphId];
  if (!graph) {
    const error = new Error(`Unknown graph id: ${graphId}`);
    error.code = "UNKNOWN_GRAPH";
    throw error;
  }
  return JSON.parse(await readFile(await existingPath(graph.path, graph.fallbackPath), "utf8"));
}

export async function readGraphModel(graphId = "job-apply-full") {
  const model = normalizeCytoscapeGraph(await readGraphPayload(graphId));
  return applyGraphEdits(model, graphId);
}

async function applyGraphEdits(model, graphId) {
  const editsPath = resolve(sidecarRoot, "data", "graph-edits", `${graphId}.json`);
  let edits;
  try {
    edits = JSON.parse(await readFile(editsPath, "utf8"));
  } catch {
    return model;
  }

  const nodeEdits = edits?.nodes || {};
  const trashNodes = [];
  for (const node of model.nodes) {
    const edit = nodeEdits[node.id];
    if (!edit) continue;
    if (typeof edit.label === "string" && edit.label.trim()) node.label = edit.label.trim();
    if (typeof edit.detail === "string") node.detail = edit.detail;
    if (Array.isArray(edit.attachments)) node.attachments = edit.attachments;
    if (Array.isArray(edit.testComments)) node.testComments = edit.testComments;
    if (edit.testFlow && typeof edit.testFlow === "object") node.testFlow = edit.testFlow;
    if (typeof edit.workState === "string") node.workState = edit.workState;
    if (typeof edit.workflowState === "string") node.workflowState = edit.workflowState;
    if (typeof edit.seenAt === "string") node.seenAt = edit.seenAt;
    if (edit.updatedAt) node.updatedAt = edit.updatedAt;
    if (edit.visualKey) node.visualKey = { ...node.visualKey, ...edit.visualKey };
    if (typeof edit.deletedAt === "string" && edit.deletedAt) {
      trashNodes.push({
        id: node.id,
        label: node.label,
        group: node.group,
        deletedAt: edit.deletedAt,
        deletedBy: edit.deletedBy || "human",
      });
    }
  }
  if (trashNodes.length) {
    const deletedIds = new Set(trashNodes.map((node) => node.id));
    model.nodes = model.nodes.filter((node) => !deletedIds.has(node.id));
    model.edges = model.edges.filter((edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target));
  }
  model.trash = { nodes: trashNodes };
  model.edits = { schema: edits.schema || "job.graph_ui.edits.v0", updatedAt: edits.updatedAt || "" };
  return model;
}

async function existingPath(primary, fallback) {
  try {
    await access(primary);
    return primary;
  } catch {
    if (!fallback) return primary;
  }
  try {
    await access(fallback);
    return fallback;
  } catch {
    return primary;
  }
}

export function buildHierarchy(model) {
  const byId = new Map(model.nodes.map((node) => [node.id, { ...node, children: [] }]));
  const incoming = new Map(model.nodes.map((node) => [node.id, 0]));

  for (const edge of model.edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    source.children.push({ edge, node: target });
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  }

  const preferredRoot = byId.get("main:goal") || byId.get("goal");
  const roots = preferredRoot
    ? [preferredRoot]
    : [...byId.values()].filter((node) => !incoming.get(node.id)).slice(0, 3);

  return { roots, byId };
}
