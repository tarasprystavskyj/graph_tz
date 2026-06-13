import { createReadStream, promises as fs } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { graphFiles, readGraphModel, readGraphPayload } from "./lib/graph-model.mjs";
import { exportFreeMind, exportMarkmapMarkdown, exportOpml } from "./lib/mindmap-export.mjs";
import {
  defaultSuperpowerFlow,
  graphToFreeMind,
  graphToMarkmap,
  graphToOpml,
  normalizeGraph,
  readGraphFile,
} from "./lib/graph-utils.mjs";

const modulePath = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");
const dataDir = resolve(__dirname, "data");
const docsDir = resolve(__dirname, "docs");
const port = Number(process.env.PORT || 8173);
const host = process.env.HOST || "127.0.0.1";
const basePath = normalizeBasePath(process.env.BASE_PATH || "");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
}

function normalizeBasePath(value) {
  const clean = String(value || "").trim().replace(/\/+$/g, "");
  if (!clean || clean === "/") return "";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function stripBasePath(pathname) {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || "/";
  return pathname;
}

function readRequestBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request_body_too_large"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolveBody(body));
    req.on("error", reject);
  });
}

function safeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 180);
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match || !match[2]) return null;
  return {
    mime: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[3], "base64"),
  };
}

async function saveGraphEdit(res, req, graphId, nodeId) {
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(req));
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json", message: error.message });
    return;
  }

  const graphKey = safeId(graphId);
  const nodeKey = String(nodeId || "");
  const editsDir = resolve(dataDir, "graph-edits");
  const uploadsDir = resolve(dataDir, "uploads", graphKey);
  const editsPath = resolve(editsDir, `${graphKey}.json`);
  await fs.mkdir(editsDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });

  let edits = { schema: "job.graph_ui.edits.v0", nodes: {} };
  try {
    edits = JSON.parse(await fs.readFile(editsPath, "utf8"));
    edits.nodes ||= {};
  } catch {
    // First edit for this graph.
  }

  const existing = edits.nodes[nodeKey] || {};
  const attachments = Array.isArray(existing.attachments) ? [...existing.attachments] : [];
  const testComments = Array.isArray(existing.testComments) ? [...existing.testComments] : [];
  const updatedAt = new Date().toISOString();
  for (const attachment of payload.attachments || []) {
    const decoded = dataUrlToBuffer(attachment.dataUrl);
    if (!decoded) continue;
    const ext = extname(attachment.name || "") || extensionForMime(decoded.mime);
    const base = safeId((attachment.name || "attachment").replace(/\.[^.]+$/, ""));
    const fileName = `${Date.now()}-${base}${ext}`;
    const filePath = resolve(uploadsDir, fileName);
    if (!filePath.startsWith(uploadsDir + sep)) continue;
    await fs.writeFile(filePath, decoded.buffer);
    attachments.push({
      name: attachment.name || fileName,
      type: decoded.mime,
      url: `/graph-data/uploads/${graphKey}/${fileName}`,
      updatedAt: new Date().toISOString(),
    });
  }
  for (const comment of payload.testComments || []) {
    if (!comment || typeof comment.text !== "string" || !comment.text.trim()) continue;
    testComments.push({
      text: comment.text.trim(),
      author: typeof comment.author === "string" && comment.author.trim() ? comment.author.trim() : "human",
      role: comment.role === "agent" ? "agent" : "human",
      createdAt: updatedAt,
    });
  }

  const nodeEdit = {
    ...existing,
    label: typeof payload.label === "string" ? payload.label : existing.label || "",
    detail: typeof payload.detail === "string" ? payload.detail : existing.detail || "",
    workState: typeof payload.workState === "string" ? payload.workState : existing.workState || "",
    workflowState: typeof payload.workflowState === "string" ? payload.workflowState : existing.workflowState || "",
    seenAt: typeof payload.seenAt === "string" ? payload.seenAt : existing.seenAt || "",
    testFlow: payload.testFlow && typeof payload.testFlow === "object" ? payload.testFlow : existing.testFlow || null,
    attachments,
    testComments,
    updatedAt,
  };
  if (attachments.length) {
    const latest = attachments[attachments.length - 1];
    nodeEdit.visualKey = {
      kind: "attachment",
      label: latest.name,
      artifactRef: latest.url,
      type: latest.type,
    };
  }

  edits.nodes[nodeKey] = nodeEdit;
  edits.updatedAt = updatedAt;
  await fs.writeFile(editsPath, JSON.stringify(edits, null, 2), "utf8");
  sendJson(res, 200, { ok: true, graphId, nodeId, edit: nodeEdit });
}

function extensionForMime(mime) {
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "text/plain") return ".txt";
  return ".bin";
}

function safePublicPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }

  const relative = decoded === "/" ? "/babylon-3d.html" : decoded;
  if (relative === "/README.md") return resolve(__dirname, "README.md");
  if (relative.startsWith("/docs/")) {
    const target = resolve(docsDir, "." + normalize(relative.replace("/docs/", "/")));
    if (target === docsDir || !target.startsWith(docsDir + sep)) return null;
    return target;
  }
  const target = resolve(publicDir, "." + normalize(relative));
  if (target !== publicDir && !target.startsWith(publicDir + sep)) {
    return null;
  }
  return target;
}

async function serveGraph(res, graphId) {
  try {
    const data = await readGraphPayload(graphId);
    sendJson(res, 200, data);
  } catch (error) {
    if (error.code === "UNKNOWN_GRAPH") {
      sendJson(res, 404, { error: "unknown_graph", graphId });
      return;
    }
    sendJson(res, 404, { error: "graph_not_found", graphId });
  }
}

async function serveGraphModel(res, graphId) {
  try {
    sendJson(res, 200, await readGraphModel(graphId));
  } catch (error) {
    if (error.code === "UNKNOWN_GRAPH") {
      sendJson(res, 404, { error: "unknown_graph", graphId });
      return;
    }
    sendJson(res, 404, { error: "graph_model_not_found", graphId });
  }
}

async function serveMindmapExport(res, graphId, format) {
  let model;
  try {
    model = await readGraphModel(graphId);
  } catch (error) {
    if (error.code === "UNKNOWN_GRAPH") {
      sendJson(res, 404, { error: "unknown_graph", graphId });
      return;
    }
    sendJson(res, 404, { error: "graph_model_not_found", graphId });
    return;
  }

  const exporters = {
    markmap: {
      filename: "job-apply-tz-markmap.md",
      contentType: "text/markdown; charset=utf-8",
      render: exportMarkmapMarkdown,
    },
    opml: {
      filename: "job-apply-tz.opml",
      contentType: "text/xml; charset=utf-8",
      render: exportOpml,
    },
    freemind: {
      filename: "job-apply-tz.mm",
      contentType: "application/xml; charset=utf-8",
      render: exportFreeMind,
    },
  };

  const exporter = exporters[format];
  if (!exporter) {
    sendJson(res, 404, { error: "unknown_export_format", format });
    return;
  }

  send(res, 200, exporter.render(model), {
    "content-type": exporter.contentType,
    "content-disposition": `attachment; filename="${exporter.filename}"`,
    "cache-control": "no-store",
  });
}

async function serveStatic(res, urlPath) {
  const target = safePublicPath(urlPath);
  if (!target) {
    send(res, 403, "Forbidden", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) {
      send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
      return;
    }
  } catch {
    send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  res.writeHead(200, {
    "content-type": contentTypes[extname(target)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(target).pipe(res);
}

async function legacyServeGraph(res, graphId) {
  const graph = graphFiles[graphId];
  if (!graph) {
    sendJson(res, 404, { error: "unknown_graph", graphId });
    return;
  }

  try {
    const data = await fs.readFile(graph.path, "utf8");
    send(res, 200, data, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
  } catch {
    sendJson(res, 404, { error: "graph_not_found", graphId });
  }
}

async function loadNormalizedGraph(graphId = "job-apply-full") {
  const graph = graphFiles[graphId];
  if (!graph) return null;
  return normalizeGraph(await readGraphFile(graph.path));
}

async function serveNormalizedGraph(res, graphId) {
  try {
    const graph = await loadNormalizedGraph(graphId);
    if (!graph) {
      sendJson(res, 404, { error: "unknown_graph", graphId });
      return;
    }
    sendJson(res, 200, graph);
  } catch {
    sendJson(res, 404, { error: "graph_not_found", graphId });
  }
}

async function serveExport(res, format) {
  try {
    const graph = await loadNormalizedGraph("job-apply-full");
    if (!graph) {
      sendJson(res, 404, { error: "graph_not_found" });
      return;
    }

    if (format === "markmap.md") {
      send(res, 200, graphToMarkmap(graph), {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'attachment; filename="job-apply-tz-markmap.md"',
        "cache-control": "no-store",
      });
      return;
    }

    if (format === "job-apply-tz.opml") {
      send(res, 200, graphToOpml(graph), {
        "content-type": "text/xml; charset=utf-8",
        "content-disposition": 'attachment; filename="job-apply-tz.opml"',
        "cache-control": "no-store",
      });
      return;
    }

    if (format === "job-apply-tz.mm") {
      send(res, 200, graphToFreeMind(graph), {
        "content-type": "application/xml; charset=utf-8",
        "content-disposition": 'attachment; filename="job-apply-tz.mm"',
        "cache-control": "no-store",
      });
      return;
    }

    sendJson(res, 404, { error: "unknown_export", format });
  } catch (error) {
    sendJson(res, 500, { error: "export_failed", message: error.message });
  }
}

export function createServer() {
  return createHttpServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const routePath = stripBasePath(requestUrl.pathname);

    const editMatch = routePath.match(/^\/api\/graph-edits\/([a-z0-9-]+)\/(.+)$/);
    if (req.method === "POST" && editMatch) {
      await saveGraphEdit(res, req, editMatch[1], decodeURIComponent(editMatch[2]));
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    if (routePath.startsWith("/graph-data/uploads/")) {
      const target = resolve(dataDir, "." + normalize(routePath.replace("/graph-data/", "/")));
      if (!target.startsWith(dataDir + sep)) {
        send(res, 403, "Forbidden", { "content-type": "text/plain; charset=utf-8" });
        return;
      }
      try {
        await fs.stat(target);
        res.writeHead(200, {
          "content-type": contentTypes[extname(target)] || "application/octet-stream",
          "cache-control": "no-store",
        });
        createReadStream(target).pipe(res);
      } catch {
        send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
      }
      return;
    }

    if (routePath === "/api/graphs") {
      sendJson(
        res,
        200,
        Object.fromEntries(
          Object.entries(graphFiles).map(([id, graph]) => [
            id,
            { label: graph.label, url: `/api/graphs/${id}` },
          ]),
        ),
      );
      return;
    }

    if (routePath === "/api/superpower-flow") {
      sendJson(res, 200, defaultSuperpowerFlow);
      return;
    }

    const modelMatch = routePath.match(/^\/api\/graph-model\/([a-z0-9-]+)$/);
    if (modelMatch) {
      await serveGraphModel(res, modelMatch[1]);
      return;
    }

    const graphExportMatch = routePath.match(/^\/api\/exports\/([a-z0-9-]+)\/(markmap|opml|freemind)$/);
    if (graphExportMatch) {
      await serveMindmapExport(res, graphExportMatch[1], graphExportMatch[2]);
      return;
    }

    const graphMatch = routePath.match(/^\/api\/graphs\/([a-z0-9-]+)$/);
    if (graphMatch) {
      await serveGraph(res, graphMatch[1]);
      return;
    }

    const normalizedGraphMatch = routePath.match(/^\/api\/normalized-graphs\/([a-z0-9-]+)$/);
    if (normalizedGraphMatch) {
      await serveNormalizedGraph(res, normalizedGraphMatch[1]);
      return;
    }

    const fileExportMatch = routePath.match(/^\/api\/exports\/([a-z0-9.-]+)$/);
    if (fileExportMatch) {
      await serveExport(res, fileExportMatch[1]);
      return;
    }

    await serveStatic(res, routePath);
  });
}

export function startServer(listenPort = port, listenHost = host) {
  const server = createServer();
  server.listen(listenPort, listenHost, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : listenPort;
    console.log(`Graph UI server listening on http://${listenHost}:${actualPort}${basePath}/babylon-3d.html`);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  startServer();
}
