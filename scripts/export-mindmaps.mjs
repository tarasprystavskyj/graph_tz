import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exportAllMindmaps } from "../lib/mindmap-export.mjs";
import { readGraphModel } from "../lib/graph-model.mjs";

const graphId = process.argv[2] || "job-apply-full";
const outputDir = resolve("exports", graphId);
const model = await readGraphModel(graphId);
const exportsByName = exportAllMindmaps(model);

await mkdir(outputDir, { recursive: true });
for (const [name, content] of Object.entries(exportsByName)) {
  await writeFile(resolve(outputDir, name), content, "utf8");
  console.log(`wrote exports/${graphId}/${name}`);
}
