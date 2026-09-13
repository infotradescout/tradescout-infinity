import type { Catalog, CatalogQuery, Descriptor } from "./index.js";
import { matchesCapability } from "./index.js";

export type ImplementationGroup = {
  key: string;
  kind: Descriptor["kind"];
  symbolSha256: string;
  names: string[];
  count: number;
  repositories: string[];
  importVariants: string[][];
  evidence: Descriptor[];
  reviewReasons: string[];
};

export type ImplementationIndex = {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    observations: number;
    comparedObservations: number;
    exactTextGroups: number;
    repeatedTextGroups: number;
    /** Additional occurrences after the first in each exact-text group. */
    repeatedObservations: number;
    uncomparedObservations: number;
    observationsAfterTextGrouping: number;
    verifiedUniqueCapabilities: null;
  };
  groups: ImplementationGroup[];
  uncompared: Array<{ descriptor: Descriptor; reason: string }>;
};

export type ImplementationSummary = ImplementationIndex["summary"];

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const distinct = (values: string[]): string[] =>
  [...new Set(values)].sort(compare);

function evidenceKey(descriptor: Descriptor): string {
  return JSON.stringify([
    descriptor.repository,
    descriptor.revision,
    descriptor.path,
    descriptor.line,
    descriptor.kind,
    descriptor.name,
    descriptor.symbolSha256,
    descriptor.fileSha256,
    descriptor.revisionVerified,
    descriptor.dirty,
    descriptor.risk,
    descriptor.disposition,
    descriptor.category,
    descriptor.imports,
  ]);
}

export function isTestContext(path: string): boolean {
  return /(?:^|[\/_.-])(?:tests?|specs?|__tests__|fixtures?|mocks?)(?:[\/_.-]|$)/i.test(
    path,
  );
}

export function declarationComparisonBlocker(
  descriptor: Descriptor,
): string | undefined {
  if (descriptor.dirty)
    return "Dirty source occurrence; text comparison is withheld.";
  if (!descriptor.revisionVerified)
    return "Unverified source revision; text comparison is withheld.";
  if (/\.py$/i.test(descriptor.path))
    return "Legacy Python hashes cover declaration prefixes, not complete implementations.";
  if (descriptor.kind === "domain")
    return "Domain fallback describes a file, not a complete declaration.";
  if (!/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(descriptor.path))
    return "Complete declaration hashing is not established for this file type.";
  if (!/^[a-f\d]{64}$/i.test(descriptor.symbolSha256))
    return "A complete declaration SHA-256 is unavailable.";
  return undefined;
}

/** Group identical declaration text while retaining every source observation. */
export function implementationIndex(catalog: Catalog): ImplementationIndex {
  const grouped = new Map<string, Descriptor[]>();
  const uncompared: ImplementationIndex["uncompared"] = [];
  const observations = [...catalog.descriptors].sort((a, b) =>
    compare(evidenceKey(a), evidenceKey(b)),
  );
  for (const descriptor of observations) {
    const reason = declarationComparisonBlocker(descriptor);
    if (reason) {
      uncompared.push({ descriptor, reason });
      continue;
    }
    const key = `${descriptor.kind}:${descriptor.symbolSha256.toLowerCase()}`;
    const evidence = grouped.get(key) ?? [];
    evidence.push(descriptor);
    grouped.set(key, evidence);
  }
  const groups = [...grouped.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([key, evidence]): ImplementationGroup => {
      const importVariants = distinct(
        evidence.map((item) => JSON.stringify(distinct(item.imports))),
      ).map((value) => JSON.parse(value) as string[]);
      const reviewReasons = [
        "Captured variables and resolved dependencies are not compared; exact text does not prove interchangeable behavior.",
      ];
      if (importVariants.length > 1)
        reviewReasons.push(
          "File import lists differ; dependency resolution and usage need review.",
        );
      if (
        evidence.some(
          (item) => item.risk === "high" || item.disposition !== "candidate",
        )
      )
        reviewReasons.push(
          "Restricted product or adapter boundaries remain in effect.",
        );
      if (
        evidence.some(
          (item) =>
            isTestContext(item.path) ||
            /(?:^|[\/_.-])helpers?(?:[\/_.-]|$)/i.test(item.path),
        )
      )
        reviewReasons.push(
          "Test or helper context is present; production capability status needs review.",
        );
      return {
        key,
        kind: evidence[0]!.kind,
        symbolSha256: evidence[0]!.symbolSha256.toLowerCase(),
        names: distinct(evidence.map((item) => item.name)),
        count: evidence.length,
        repositories: distinct(evidence.map((item) => item.repository)),
        importVariants,
        evidence,
        reviewReasons,
      };
    });
  const comparedObservations = observations.length - uncompared.length;
  return {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    summary: {
      observations: observations.length,
      comparedObservations,
      exactTextGroups: groups.length,
      repeatedTextGroups: groups.filter((group) => group.count > 1).length,
      repeatedObservations: comparedObservations - groups.length,
      uncomparedObservations: uncompared.length,
      observationsAfterTextGrouping: groups.length + uncompared.length,
      verifiedUniqueCapabilities: null,
    },
    groups,
    uncompared,
  };
}

/** All requested filters must match the same occurrence in a group. */
export function findImplementations(
  index: ImplementationIndex,
  query: CatalogQuery = {},
): ImplementationGroup[] {
  return index.groups.filter((group) =>
    group.evidence.some((item) => matchesCapability(item, query)),
  );
}

export function implementationSummaryMarkdown(
  summary: ImplementationSummary,
  embedded = false,
): string {
  return [
    ...(!embedded ? [`- Source observations: ${summary.observations}`] : []),
    `- Complete declaration observations compared: ${summary.comparedObservations}`,
    `- Exact declaration-text groups: ${summary.exactTextGroups}`,
    `- Groups containing repeated declarations: ${summary.repeatedTextGroups}`,
    `- Repeated declaration observations beyond the first per group: ${summary.repeatedObservations}`,
    `- Uncompared observations retained separately: ${summary.uncomparedObservations}`,
    `- Entries after text grouping: ${summary.observationsAfterTextGrouping}`,
    ...(!embedded ? ["- Verified unique capabilities: not established"] : []),
    "",
    "Counts overlap the identical-file comparison and must not be added together; exact text equality does not prove interchangeable behavior.",
  ].join("\n");
}

export function implementationMarkdown(index: ImplementationIndex): string {
  const cell = (value: string): string =>
    value.replaceAll("|", "\\|").replace(/[\r\n]/g, " ");
  const repeated = index.groups
    .filter((group) => group.count > 1)
    .sort((a, b) => b.count - a.count || compare(a.key, b.key))
    .slice(0, 30);
  return [
    "# Exact declaration-text browsing",
    "",
    `Catalog snapshot: ${index.generatedAt}`,
    "",
    implementationSummaryMarkdown(index.summary),
    "",
    "Equality of declaration text does not prove interchangeable behavior. Captured variables, resolved dependencies, configuration, and product boundaries still require review. No group establishes a canonical implementation or authorizes reuse.",
    "",
    "All provenance remains in the JSON index. Python prefix hashes, domain fallback files, and unverified or dirty occurrences remain separate and uncompared.",
    "",
    "## Largest repeated-text groups (up to 30)",
    "",
    "| Names | Kind | Occurrences | Additional repeats | Evidence (first 3) | Review reasons |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...repeated.map((group) => {
      const evidence = group.evidence
        .slice(0, 3)
        .map((item) => `${item.repository}:${item.path}:${item.line}`)
        .join("; ");
      return `| ${cell(group.names.join(", "))} | ${group.kind} | ${group.count} | ${group.count - 1} | ${cell(evidence)} | ${cell(group.reviewReasons.join(" "))} |`;
    }),
    "",
  ].join("\n");
}
