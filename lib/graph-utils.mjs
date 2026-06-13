import { readFile } from "node:fs/promises";

export const fallbackColors = {
  product: "#256f55",
  discovery: "#2f855a",
  platform: "#3a9f71",
  data: "#437f97",
  safety: "#b7791f",
  operations: "#c05621",
  interface: "#5a67d8",
  observability: "#718096",
  quality: "#805ad5",
  unknown: "#6b7280",
};

export const groupIcons = {
  product: "TZ",
  discovery: "SC",
  platform: "PF",
  data: "DB",
  safety: "GT",
  operations: "OP",
  interface: "UI",
  observability: "OB",
  quality: "QA",
  unknown: "ND",
};

export const defaultSuperpowerFlow = {
  schema: "job_apply_tz.superpower_flow.placeholder.v0",
  source: "assumed_placeholder",
  note:
    "No safe local implementation named superpower was found. This contract is the integration seam for the owner's flow once the concrete source is provided.",
  phases: [
    { id: "sense", label: "Sense", description: "Collect public signals, artifacts, and owner intent." },
    { id: "anchor", label: "Anchor", description: "Create or update graph nodes as stable TZ anchors." },
    { id: "thread", label: "Thread", description: "Connect decisions, data, tests, and visual artifacts with typed edges." },
    { id: "branch", label: "Branch", description: "Attach an agent-branch subtree for implementation and verification." },
    { id: "review", label: "Review", description: "Owner inspects a focused visual branch instead of a long document." },
    { id: "release", label: "Release", description: "Branch release/test refreshes node previews and exportable maps." },
  ],
  agentBranchContract: {
    schema: "job_apply_tz.agent_branch_overlay.v0",
    overlayAbove: ["codex", "claude", "other-cli-agent"],
    replacementRule:
      "A branch agent may replace itself when context overflow, degraded reasoning, or stale state is visible to the human; the replacement must preserve branch id, graph anchors, artifacts, and open decisions.",
    requiredFields: ["branchId", "agentType", "status", "rootNodeId", "artifactRefs", "handoff"],
  },
};

export async function readGraphFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function normalizeGraph(payload) {
  const rawNodes = Array.isArray(payload?.elements?.nodes) ? payload.elements.nodes : [];
  const rawEdges = Array.isArray(payload?.elements?.edges) ? payload.elements.edges : [];
  const groups = {};

  const nodes = rawNodes
    .map((item) => {
      const data = item.data || {};
      const id = String(data.id || "");
      if (!id) return null;

      const group = data.group || "unknown";
      const label = data._label || data.label || data.name || data.title || id;
      const color = data.color || fallbackColors[group] || fallbackColors.unknown;
      const icon = data.icon || groupIcons[group] || groupIcons.unknown;

      groups[group] ||= {
        id: group,
        label: data.group_label || group,
        color,
        icon,
      };

      return {
        id,
        label,
        detail: data.detail || data.comment || "",
        group,
        groupLabel: data.group_label || groups[group].label,
        status: data.status || "unknown",
        owner: data.owner || "",
        priority: data.priority || "",
        type: data.type || data.labelV || "",
        color,
        icon,
        position: item.position || null,
        classes: item.classes || "",
        preview: data.preview || previewForNode(data),
        agentBranch: data.agent_branch || defaultAgentBranch(id, group),
      };
    })
    .filter(Boolean);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges
    .map((item, index) => {
      const data = item.data || {};
      const source = String(data.source || "");
      const target = String(data.target || "");
      if (!nodeIds.has(source) || !nodeIds.has(target)) return null;
      return {
        id: String(data.id || `edge:${index}:${source}:${target}`),
        source,
        target,
        label: data.label || data.name || "",
        color: data.color || "#94a3b8",
        status: data.status || "",
        dataFlow: data.data_flow || data.flow || "decision/artifact thread",
      };
    })
    .filter(Boolean);

  return { schema: "job_apply_tz.normalized_graph.v0", nodes, edges, groups };
}

function previewForNode(data) {
  const label = data._label || data.label || data.name || data.title || "Node";
  return {
    type: "placeholder",
    label: "visual key pending",
    alt: `Latest visual artifact preview placeholder for ${label}`,
    artifactRef: "",
    updatedAt: "",
  };
}

function defaultAgentBranch(nodeId, group) {
  return {
    branchId: `agent-branch:${nodeId}`,
    rootNodeId: nodeId,
    agentType: group === "quality" ? "codex-qa" : "codex",
    status: "placeholder",
    artifactRefs: [],
    handoff: "Attach branch handoff and latest visual test artifact here.",
  };
}

export function buildHierarchy(graph) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));

  for (const edge of graph.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    outgoing.get(edge.source).push(edge.target);
  }

  const preferredRoot =
    graph.nodes.find((node) => node.id.endsWith(":goal") || node.id === "goal") ||
    graph.nodes.find((node) => (incoming.get(node.id) || 0) === 0) ||
    graph.nodes[0];
  const visited = new Set();

  function walk(nodeId) {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);
    const node = nodesById.get(nodeId);
    if (!node) return null;
    const children = outgoing
      .get(nodeId)
      .map((childId) => walk(childId))
      .filter(Boolean);
    return { node, children };
  }

  const roots = [];
  if (preferredRoot) roots.push(walk(preferredRoot.id));
  for (const node of graph.nodes) {
    if (!visited.has(node.id)) roots.push(walk(node.id));
  }

  return roots.filter(Boolean);
}

export function graphToMarkmap(graph) {
  const roots = buildHierarchy(graph);
  const lines = ["# JobApply TZ graph", ""];
  for (const root of roots) writeMarkdownNode(lines, root, 0);
  return `${lines.join("\n")}\n`;
}

function writeMarkdownNode(lines, tree, depth) {
  const indent = "  ".repeat(depth);
  const node = tree.node;
  lines.push(
    `${indent}- ${node.label} [${node.status}; ${node.group}; owner=${node.owner || "system"}]`,
  );
  if (node.detail) lines.push(`${indent}  - detail: ${node.detail}`);
  if (node.agentBranch) lines.push(`${indent}  - branch: ${node.agentBranch.branchId}`);
  if (node.preview?.label) lines.push(`${indent}  - preview: ${node.preview.label}`);
  for (const child of tree.children) writeMarkdownNode(lines, child, depth + 1);
}

export function graphToOpml(graph) {
  const roots = buildHierarchy(graph);
  const body = roots.map((root) => writeOpmlNode(root, 2)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>JobApply TZ graph</title>\n  </head>\n  <body>\n${body}\n  </body>\n</opml>\n`;
}

function writeOpmlNode(tree, depth) {
  const indent = "  ".repeat(depth);
  const node = tree.node;
  const attrs = [
    `text="${xmlEscape(node.label)}"`,
    `status="${xmlEscape(node.status)}"`,
    `group="${xmlEscape(node.group)}"`,
    `owner="${xmlEscape(node.owner || "system")}"`,
    `detail="${xmlEscape(node.detail)}"`,
    `agentBranch="${xmlEscape(node.agentBranch?.branchId || "")}"`,
  ].join(" ");
  if (!tree.children.length) return `${indent}<outline ${attrs}/>`;
  return `${indent}<outline ${attrs}>\n${tree.children.map((child) => writeOpmlNode(child, depth + 1)).join("\n")}\n${indent}</outline>`;
}

export function graphToFreeMind(graph) {
  const roots = buildHierarchy(graph);
  const children = roots.map((root) => writeFreeMindNode(root, 2)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<map version="1.0.1">\n  <node TEXT="JobApply TZ graph">\n${children}\n  </node>\n</map>\n`;
}

function writeFreeMindNode(tree, depth) {
  const indent = "  ".repeat(depth);
  const node = tree.node;
  const text = `${node.label} [${node.status}; ${node.group}]`;
  const notes = [node.detail, `owner=${node.owner || "system"}`, `branch=${node.agentBranch?.branchId || ""}`]
    .filter(Boolean)
    .join(" | ");
  if (!tree.children.length) {
    return `${indent}<node TEXT="${xmlEscape(text)}"><richcontent TYPE="NOTE"><html><body><p>${xmlEscape(notes)}</p></body></html></richcontent></node>`;
  }
  return `${indent}<node TEXT="${xmlEscape(text)}">\n${indent}  <richcontent TYPE="NOTE"><html><body><p>${xmlEscape(notes)}</p></body></html></richcontent>\n${tree.children.map((child) => writeFreeMindNode(child, depth + 1)).join("\n")}\n${indent}</node>`;
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
