import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  catalogMarkdown,
  catalogSummary,
  catalogSummaryMarkdown,
  implementationIndex,
  implementationMarkdown,
  normalizationMarkdown,
  normalizationReport,
  normalizedCapabilityIndex,
  normalizedCapabilityMarkdown,
  normalizedOverview,
  normalizedOverviewMarkdown,
  reusableCandidateIndex,
  reusableCandidateMarkdown,
  scanCatalog,
  validateNormalizationMapLinks,
  validateSourceRegistry,
  type Catalog,
  type SourceRoot,
} from "./index.js";

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, contents.replace(/\n+$/, "\n"));
  await rename(tmp, path);
}

try {
  // Rebuild derived views of a saved snapshot without rescanning changed roots
  // or replacing the historical provenance ledger during a count audit.
  const fromCatalog = process.argv[2] === "--from-catalog";
  const out =
    process.argv[3] ??
    (fromCatalog ? "ecosystem/catalog.json" : "catalog.json");
  const outputs: Array<[string, string]> = [];
  const pathKey = (path: string) => {
    const absolute = resolve(path);
    return process.platform === "win32" ? absolute.toLowerCase() : absolute;
  };
  const stageOutput = (path: string, contents: string) => {
    if (fromCatalog && pathKey(path) === pathKey(out))
      throw new Error(
        `derived output would overwrite the input catalog: ${path}`,
      );
    outputs.push([path, contents]);
  };
  const parsed: unknown = JSON.parse(
    await readFile(
      fromCatalog ? out : (process.argv[2] ?? "catalog.sources.json"),
      "utf8",
    ),
  );
  let c: Catalog;
  if (fromCatalog) {
    c = parsed as Catalog;
    if (
      c?.schemaVersion !== 2 ||
      !Array.isArray(c.sources) ||
      !Array.isArray(c.descriptors) ||
      !Array.isArray(c.duplicates) ||
      !Array.isArray(c.nameCollisions) ||
      typeof c.generatedAt !== "string"
    )
      throw new Error("--from-catalog requires a schemaVersion 2 catalog");
  } else {
    const errors = validateSourceRegistry(parsed);
    if (errors.length) throw new Error(errors.join("; "));
    c = await scanCatalog(parsed as SourceRoot[]);
    stageOutput(out, JSON.stringify(c, null, 2) + "\n");
  }
  const md = out.replace(/\.json$/i, ".md");
  stageOutput(md, catalogMarkdown(c));
  const summary = out.replace(/\.json$/i, "-summary.json");
  const summaryData = catalogSummary(c);
  stageOutput(summary, JSON.stringify(summaryData, null, 2) + "\n");
  const summaryMarkdown = summary.replace(/\.json$/i, ".md");
  stageOutput(summaryMarkdown, catalogSummaryMarkdown(summaryData));

  const implementations = implementationIndex(c);
  stageOutput(
    join(dirname(out), "implementation-index.json"),
    JSON.stringify(implementations, null, 2) + "\n",
  );
  stageOutput(
    join(dirname(out), "implementation-index.md"),
    implementationMarkdown(implementations),
  );

  const report = normalizationReport(c);
  const normalizationMapPath = join(dirname(out), "normalization-map.json");
  try {
    const normalizationMap = JSON.parse(
      await readFile(normalizationMapPath, "utf8"),
    );
    const mapErrors = validateNormalizationMapLinks(report, normalizationMap);
    if (mapErrors.length) throw new Error(mapErrors.join("; "));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const reportPath = join(dirname(out), "normalization-report.json");
  const reportMarkdownPath = join(dirname(out), "normalization-report.md");
  stageOutput(reportPath, JSON.stringify(report, null, 2) + "\n");
  stageOutput(reportMarkdownPath, normalizationMarkdown(report));

  // Keep the everyday browsing surface compact. The raw catalog and report
  // remain available as provenance detail, while this index collapses them
  // into a small set of stable capability families.
  const normalizedIndex = normalizedCapabilityIndex(report);
  const normalizedIndexPath = join(dirname(out), "normalized-index.json");
  const normalizedIndexMarkdownPath = join(dirname(out), "normalized-index.md");
  stageOutput(
    normalizedIndexPath,
    JSON.stringify(normalizedIndex, null, 2) + "\n",
  );
  stageOutput(
    normalizedIndexMarkdownPath,
    normalizedCapabilityMarkdown(normalizedIndex),
  );

  // Put an even smaller portfolio overview in front of the family drill-down.
  // It is the default human control surface; no individual symbols are listed.
  const overview = normalizedOverview(normalizedIndex);
  const overviewPath = join(dirname(out), "overview.json");
  const overviewMarkdownPath = join(dirname(out), "overview.md");
  stageOutput(overviewPath, JSON.stringify(overview, null, 2) + "\n");
  stageOutput(overviewMarkdownPath, normalizedOverviewMarkdown(overview));

  // Keep the reusable directory as a reviewable candidate index. Implementations
  // stay in their owning packages; this file contains metadata and provenance.
  const candidateIndex = join(
    process.cwd(),
    "reusable",
    "candidate-index.json",
  );
  const candidateIndexMarkdown = join(
    process.cwd(),
    "reusable",
    "candidate-index.md",
  );
  const familyIndex = join(process.cwd(), "reusable", "family-index.json");
  const familyIndexMarkdown = join(
    process.cwd(),
    "reusable",
    "family-index.md",
  );
  const reusableOverview = join(process.cwd(), "reusable", "overview.json");
  const reusableOverviewMarkdown = join(
    process.cwd(),
    "reusable",
    "overview.md",
  );
  stageOutput(reusableOverview, JSON.stringify(overview, null, 2) + "\n");
  stageOutput(reusableOverviewMarkdown, normalizedOverviewMarkdown(overview));
  stageOutput(familyIndex, JSON.stringify(normalizedIndex, null, 2) + "\n");
  stageOutput(
    familyIndexMarkdown,
    normalizedCapabilityMarkdown(normalizedIndex),
  );
  const candidateIndexData = reusableCandidateIndex(report);
  stageOutput(
    candidateIndex,
    JSON.stringify(candidateIndexData, null, 2) + "\n",
  );
  stageOutput(
    candidateIndexMarkdown,
    reusableCandidateMarkdown(candidateIndexData),
  );
  // Validate every destination before writing any derived view.
  for (const [path, contents] of outputs) await writeAtomic(path, contents);
} catch (error) {
  console.error(
    `catalog failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
