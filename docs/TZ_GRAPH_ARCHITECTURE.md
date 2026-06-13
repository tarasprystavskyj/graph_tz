# TZ Graph UI Architecture

## Goal

The graph is the practical source of truth for TZ/spec work. It should let the
owner inspect only the needed branch, gradually reveal detail, and work from
visual keys instead of long text documents.

## Variants

- Variant A: `babylon-3d.html`
  - Babylon.js 3D force-directed graph.
  - Best for spatial overview, dense relations, and "web thread" motion.
- Variant 2D: `cytoscape-2d.html`
  - Modern Cytoscape.js direction for the old PHP viewer replacement.
  - Covers filters, layouts, node focus, color styling, import/export, and local
    graph interactions without carrying PHP upload/proxy endpoints forward.
- Variant B: `flow-variant-b.html`
  - ReactFlow-style dense cards and minimap prototype.
  - Dependency-free now; migration target is `@xyflow/react` when npm
    dependencies/build tooling are approved.

## Superpower Flow Placeholder

Safe local search did not find a concrete owner `superpower` implementation.
The sidecar therefore exposes a placeholder integration contract at:

```text
/api/superpower-flow
```

Assumed flow:

1. Sense: collect public signals, artifacts, and owner intent.
2. Anchor: create or update graph nodes as stable TZ anchors.
3. Thread: connect decisions, data, tests, and visual artifacts with typed
   edges.
4. Branch: attach an agent-branch subtree for implementation and verification.
5. Review: owner inspects a focused visual branch instead of a long document.
6. Release: branch release/test refreshes node previews and exportable maps.

## Agent-Branch Subtree Contract

Every normalized graph node can carry:

```json
{
  "agentBranch": {
    "branchId": "agent-branch:<node-id>",
    "rootNodeId": "<node-id>",
    "agentType": "codex",
    "status": "placeholder",
    "artifactRefs": [],
    "handoff": "Attach branch handoff and latest visual test artifact here."
  }
}
```

An agent branch is an overlay above a CLI agent type such as Codex or Claude.
When context overflow or degraded reasoning is visible, the branch agent may
replace itself only if it preserves the branch id, graph anchors, artifact
references, open decisions, and handoff.

## Visual Artifact Keys

Each node has a `preview` slot:

```json
{
  "preview": {
    "type": "placeholder",
    "label": "visual key pending",
    "artifactRef": "",
    "updatedAt": ""
  }
}
```

Release/test automation should update that slot with the latest screenshot,
diff image, UI capture, or generated visual placeholder for the node. Leaf
nodes representing forms, fields, UI states, or test results should show this
preview in all variants.

## Exports

The sidecar exports the default graph to:

- Markmap Markdown: `/api/exports/markmap.md`
- OPML: `/api/exports/job-apply-tz.opml`
- FreeMind: `/api/exports/job-apply-tz.mm`

Exports preserve hierarchy, label, status, group, owner, detail, branch id, and
preview label where the target format allows it.

## Next Implementation Steps

1. Replace placeholder visual keys with real latest-artifact references from a
   safe test artifact folder.
2. Define the concrete owner `superpower` source once provided, then map it to
   `/api/superpower-flow`.
3. Add graph editing persistence for node comments, branch metadata, preview
   refs, and edge thread types.
4. If dependencies are approved, build Variant B with `@xyflow/react`, custom
   nodes, MiniMap, Controls, subflows, and edge labels.
