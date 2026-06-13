# JobApply Graph UI Sidecar

Contained Node.js sidecar for visualizing the JobApply TZ graph without
touching the job application automation flows.

## Run

```powershell
cd C:\python_scripts\job_apply_automation\graph-ui
npm.cmd start
```

Open:

```text
http://127.0.0.1:8173/babylon-3d.html
```

Additional views:

```text
http://127.0.0.1:8173/cytoscape-2d.html
http://127.0.0.1:8173/flow-variant-b.html
```

Current project learning graph:

```text
http://127.0.0.1:8173/cytoscape-2d.html?graph=current-project-learning
http://127.0.0.1:8173/babylon-3d.html?graph=current-project-learning
http://127.0.0.1:8173/flow-variant-b.html?graph=current-project-learning
```

Optional port override:

```powershell
$env:PORT=8180; npm.cmd start
```

## Smoke Test

```powershell
cd C:\python_scripts\job_apply_automation\graph-ui
npm.cmd run smoke
npm.cmd run browser-smoke
```

The smoke test validates `job_apply_full_tz_cytoscape.json`, starts the Node
server on a temporary local port, and verifies the 3D page, Cytoscape page,
Variant B page, local scripts, graph APIs, superpower placeholder, and mind-map
export routes.

`browser-smoke` is optional. If Playwright is already available in local Node
resolution, it opens the 3D learning graph, exercises search/degree filters,
layout selector modes, and the radial context menu, then writes screenshot
evidence under ignored `graph-ui/data/browser-smoke/`. If Playwright is not
installed, the command exits cleanly with a skip message and does not install
anything.

Generate local mind-map files:

```powershell
npm.cmd run export:mindmaps
npm.cmd run export:mindmaps -- current-project-learning
```

Generated files are written to ignored `exports/`.

## Data Source

The server exposes the existing Cytoscape graph JSON read-only:

- `/api/graphs/job-apply-full`
- `/api/graphs/job-apply-product`
- `/api/graphs/server-telemetry`
- `/api/graphs/current-project-learning`
- `/api/normalized-graphs/job-apply-full`
- `/api/normalized-graphs/current-project-learning`
- `/api/graph-model/job-apply-full`
- `/api/graph-model/current-project-learning`
- `/api/superpower-flow`
- `/api/exports/markmap.md`
- `/api/exports/job-apply-tz.opml`
- `/api/exports/job-apply-tz.mm`
- `/api/exports/job-apply-full/markmap`
- `/api/exports/job-apply-full/opml`
- `/api/exports/job-apply-full/freemind`
- `/api/exports/current-project-learning/markmap`
- `/api/exports/current-project-learning/opml`
- `/api/exports/current-project-learning/freemind`

The default page consumes:

```text
happyuser-visual_link_analisis-c4307a2aa7f8/sample_graphs/job_apply_full_tz_cytoscape.json
```

There is also a static copy under `public/data/` for offline experiments, but
the running page uses the API route above.

The separate learning graph lives at:

```text
graph-ui/public/data/current_project_learning_cytoscape.json
```

Use it as a small editable example before changing the larger JobApply TZ graph.
For `graph-ui/` work, this learning graph is the current project source of
truth: every owner-requested feature should be added as a graph node and wired
to the relevant branch/task edge.

## 3D Interaction Menu

The 3D view now uses Cytoscape.js under the hood for layout/re-arrange actions
while Babylon.js still renders the scene.

Available controls:

- graph/project menu for all registered graphs;
- 2D/3D switching with the active `graph` query parameter preserved;
- Search Filter: text search plus minimum `degree`;
- Show all labels;
- Show time/status panel;
- Show map/minimap panel;
- layout selector: Cola-like iterative mode, Cose, Breadthfirst, Concentric,
  Circle, Grid. Switching the selector immediately applies the layout;
- right-click radial context menu on a node;
- edit title/detail in the click details panel;
- paste screenshots from clipboard or upload files into sidecar-only
  `graph-ui/data/` artifacts.
- unseen/new feature nodes blink with a red label outline until the owner
  clicks them; that click saves `seenAt` in sidecar graph edits;
- the right-side `Info` slider controls viewport information density;
- node details can generate a text outline or table from the selected node's
  subtree.

The layout selector pauses live physics, asks Cytoscape.js or the deterministic
manual layout fallback to compute a fresh layout for the currently visible
nodes, then projects that layout back into Babylon's 3D scene with a small Z
spread. Use it when the live force simulation becomes hard to read or when you
want to compare the same graph through different layout algorithms.

The radial context menu can mark a node's work state:

- yellow `testing`: the function/node is being tested now;
- red `needed`: the function/node still needs work, or its description changed
  and must be updated;
- green `done`: the function/node is implemented and main-ready.

In 3D these states render as a colored outline around the label plaque only, so
the node remains readable and the text is not washed out by glow. State edits
are stored only in ignored sidecar files under `graph-ui/data/graph-edits/`.

Every graph-model node also gets a compact `visualKey` with `symbol`, `bg`,
`fg`, `kind`, and optional `artifactRef`. The current implementation renders
safe local symbolic placeholders on the same visual plaque/card as the node
name:

- site work uses stable logo-like text badges such as `GH`, `Dj`, `OLX`, `TG`;
- web form nodes use `FORM`;
- screenshot/artifact nodes use `IMG`;
- tests use `QA`;
- agent branches and delegated tasks use `AG`;
- group defaults cover data, UI, safety, learning, and next-step nodes.

This follows the visual-UX pass: keep cues short, consistent, and filterable;
replace placeholders with latest safe screenshots or artifacts later through
`visualKey.artifactRef` instead of forcing the owner to read long descriptions.
When the owner pastes or uploads an image in the edit panel, the latest image
attachment becomes the label preview badge for that node.

## Hybrid Graph/Text/Table Practices

Use the graph model as the source of truth and generate text/table views from
it, instead of maintaining duplicate documents by hand.

- Keep stable node IDs and edge labels so text, table, mind-map exports, and
  graph views point to the same item.
- Use progressive disclosure: graph first, short label and visual key second,
  full detail only after click, subtree text/table only on demand.
- Preserve bidirectional traceability: from text/table rows back to node IDs,
  and from graph nodes to generated text/table summaries.
- Separate focus from density: search/status filters narrow the graph, while
  the `Info` slider changes how much content is visible per node.
- Prefer generated subtree summaries for reading sessions; prefer graph and
  table views for planning, ownership, status review, and QA passes.
- Export Markmap, OPML, and FreeMind for comparison, but keep edits flowing
  back into the graph model first.

## CDN Strategy

Variant A uses Babylon.js from:

```text
https://cdn.babylonjs.com/babylon.js
```

The 2D variant uses Cytoscape.js from:

```text
https://unpkg.com/cytoscape@3.34.0/dist/cytoscape.min.js
```

No npm dependencies are installed. For an offline or production pass, vendor
specific builds under `graph-ui/public/vendor/` and update the HTML files to
load those local files.

Variant B is dependency-free for now. It follows ReactFlow-style concepts
(cards as nodes, handles, SVG edges, minimap, controls) without installing
`@xyflow/react`.

## Architecture

See [docs/TZ_GRAPH_ARCHITECTURE.md](docs/TZ_GRAPH_ARCHITECTURE.md) and
[docs/GRAPH_TZ_ARCHITECTURE.md](docs/GRAPH_TZ_ARCHITECTURE.md). The first file
was created by the parallel sidecar work; the second captures the richer
visual-key and graph-model integration notes.

## Safety Boundary

This sidecar only serves local static UI assets and existing graph JSON. It does
not read `.env`, cookies, saved browser profiles, private CVs, or runtime
private data, and it does not call any submit/upload/send code.
