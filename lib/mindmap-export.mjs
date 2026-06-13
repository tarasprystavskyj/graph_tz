import { buildHierarchy } from "./graph-model.mjs";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanMarkdown(value) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function nodeLine(node) {
  const meta = [node.status, node.owner, node.groupLabel || node.group].filter(Boolean).join(" | ");
  return `${node.icon || "-"} ${node.label}${meta ? ` (${meta})` : ""}`;
}

function walkTree(root, visit, seen = new Set(), depth = 0, via = "") {
  if (seen.has(root.id)) {
    visit(root, depth, via, true);
    return;
  }
  seen.add(root.id);
  visit(root, depth, via, false);
  for (const child of root.children || []) {
    walkTree(child.node, visit, seen, depth + 1, child.edge.label || "");
  }
}

export function exportMarkmapMarkdown(model) {
  const { roots } = buildHierarchy(model);
  const lines = [
    "---",
    "markmap:",
    "  colorFreezeLevel: 2",
    "  maxWidth: 420",
    "---",
    "# JobApply TZ Graph",
    "",
  ];

  for (const root of roots) {
    walkTree(root, (node, depth, via, repeated) => {
      const indent = "  ".repeat(depth);
      const relation = via ? `${via}: ` : "";
      lines.push(`${indent}- ${relation}${nodeLine(node)}${repeated ? " [linked above]" : ""}`);
      if (node.detail && !repeated) {
        lines.push(`${indent}  - detail: ${cleanMarkdown(node.detail)}`);
      }
      if (!repeated) {
        lines.push(`${indent}  - agent branch: ${node.agentBranch.cliAgentType} / ${node.agentBranch.status}`);
        lines.push(`${indent}  - visual key: ${node.visualKey.label}`);
      }
    });
  }

  return `${lines.join("\n")}\n`;
}

function opmlOutline(node, depth, via, repeated) {
  const text = `${via ? `${via}: ` : ""}${nodeLine(node)}${repeated ? " [linked above]" : ""}`;
  const attrs = [
    `text="${escapeXml(text)}"`,
    `status="${escapeXml(node.status)}"`,
    `owner="${escapeXml(node.owner)}"`,
    `group="${escapeXml(node.group)}"`,
    `detail="${escapeXml(node.detail)}"`,
  ].join(" ");
  if (repeated || !node.children?.length) return `${"  ".repeat(depth)}<outline ${attrs}/>`;
  const children = node.children.map((child) => opmlOutline(child.node, depth + 1, child.edge.label, false));
  return [`${"  ".repeat(depth)}<outline ${attrs}>`, ...children, `${"  ".repeat(depth)}</outline>`].join("\n");
}

export function exportOpml(model) {
  const { roots } = buildHierarchy(model);
  const body = roots.map((root) => opmlOutline(root, 3, "", false)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>JobApply TZ Graph</title>
  </head>
  <body>
${body}
  </body>
</opml>
`;
}

function freeMindNode(node, depth, via, repeated) {
  const text = `${via ? `${via}: ` : ""}${nodeLine(node)}${repeated ? " [linked above]" : ""}`;
  const attrs = `TEXT="${escapeXml(text)}" BACKGROUND_COLOR="${escapeXml(node.color)}"`;
  const note = node.detail ? `${"  ".repeat(depth + 1)}<richcontent TYPE="NOTE"><html><body>${escapeXml(node.detail)}</body></html></richcontent>` : "";
  if (repeated || !node.children?.length) {
    return [`${"  ".repeat(depth)}<node ${attrs}>`, note, `${"  ".repeat(depth)}</node>`].filter(Boolean).join("\n");
  }
  const children = node.children.map((child) => freeMindNode(child.node, depth + 1, child.edge.label, false));
  return [`${"  ".repeat(depth)}<node ${attrs}>`, note, ...children, `${"  ".repeat(depth)}</node>`]
    .filter(Boolean)
    .join("\n");
}

export function exportFreeMind(model) {
  const { roots } = buildHierarchy(model);
  const children = roots.map((root) => freeMindNode(root, 2, "", false)).join("\n");
  return `<map version="1.0.1">
  <node TEXT="JobApply TZ Graph">
${children}
  </node>
</map>
`;
}

export function exportAllMindmaps(model) {
  return {
    "job-apply-tz-markmap.md": exportMarkmapMarkdown(model),
    "job-apply-tz.opml": exportOpml(model),
    "job-apply-tz.mm": exportFreeMind(model),
  };
}
