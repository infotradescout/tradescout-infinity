import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import * as ts from "typescript";
import {
  implementationIndex,
  type ImplementationSummary,
} from "./implementations.js";
import {
  catalogIdentity,
  catalogIdentityMarkdown,
  type CatalogIdentity,
} from "./normalization.js";

export type SourceRoot = {
  repository: string;
  path: string;
  expectedRevision?: string;
  revision?: string;
  scan?: boolean;
  sourceKind?: "canonical" | "snapshot" | "wip" | "secondary";
};
export type Descriptor = {
  name: string;
  kind: "function" | "hook" | "component" | "class" | "domain";
  category: string[];
  path: string;
  line: number;
  repository: string;
  revision: string;
  revisionVerified: boolean;
  dirty: boolean;
  fileSha256: string;
  symbolSha256: string;
  imports: string[];
  risk: "low" | "medium" | "high";
  disposition: "candidate" | "adapter-only" | "product-owned";
};
export type SourceRecord = SourceRoot & {
  status: "scanned" | "registered_unscanned";
  scanBlockedReason?:
    | "missing"
    | "unsafe_root"
    | "scan_disabled"
    | "wip_source"
    | "dirty"
    | "revision_unpinned"
    | "revision_mismatch";
  revision: string;
  revisionVerified: boolean;
  dirty: boolean;
  dirtyFiles: string[];
  excludedFiles: number;
};
export type Catalog = {
  schemaVersion: 2;
  generatedAt: string;
  sources: SourceRecord[];
  descriptors: Descriptor[];
  duplicates: Array<{ sha256: string; paths: string[] }>;
  nameCollisions: Array<{
    normalized: string;
    kind: Descriptor["kind"];
    paths: string[];
  }>;
};

export function validateSourceRegistry(roots: unknown): string[] {
  if (!Array.isArray(roots)) return ["source registry must be an array"];
  const errors: string[] = [];
  for (const [index, root] of roots.entries()) {
    if (!root || typeof root !== "object") {
      errors.push(`source[${index}] must be an object`);
      continue;
    }
    const candidate = root as Record<string, unknown>;
    if (
      typeof candidate.repository !== "string" ||
      !/^[a-z0-9][a-z0-9-]*$/i.test(candidate.repository)
    )
      errors.push(`source[${index}].repository must be a stable identifier`);
    if (typeof candidate.path !== "string" || !candidate.path.trim())
      errors.push(`source[${index}].path is required`);
    else if (isAbsolute(candidate.path))
      errors.push(`source[${index}].path must be workspace-relative`);
    if (candidate.scan !== undefined && typeof candidate.scan !== "boolean")
      errors.push(`source[${index}].scan must be boolean`);
    const sourceKind = candidate.sourceKind;
    if (sourceKind === undefined)
      errors.push(`source[${index}].sourceKind is required`);
    else if (
      !["canonical", "snapshot", "wip", "secondary"].includes(
        String(sourceKind),
      )
    )
      errors.push(`source[${index}].sourceKind is invalid`);
    if (sourceKind === "wip" && candidate.scan !== false)
      errors.push(`source[${index}] must set scan=false for a wip source`);
    for (const key of ["expectedRevision", "revision"]) {
      if (candidate[key] !== undefined && typeof candidate[key] !== "string")
        errors.push(`source[${index}].${key} must be a string`);
    }
    if (
      candidate.expectedRevision !== undefined &&
      typeof candidate.expectedRevision === "string" &&
      !isImmutableGitRevision(candidate.expectedRevision)
    )
      errors.push(
        `source[${index}].expectedRevision must be a full immutable git object id`,
      );
    if (
      candidate.scan === true &&
      (typeof candidate.expectedRevision !== "string" ||
        !isImmutableGitRevision(candidate.expectedRevision))
    )
      errors.push(
        `source[${index}].expectedRevision is required when scan=true`,
      );
  }
  return errors;
}

const ignored = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "vendor",
]);
const extensions = new Set([".js", ".jsx", ".mjs", ".py", ".ts", ".tsx"]);
const secretName =
  /(^|[._-])(env|secret|secrets|credential|credentials|token)([._-]|$)|\.(pem|pfx|key|db|dump)$/i;
const maxBytes = 512 * 1024;
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const isImmutableGitRevision = (value: string | undefined): value is string =>
  typeof value === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
const git = (root: string, args: string[], fallback: string) => {
  try {
    return (
      execFileSync("git", ["-C", root, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || fallback
    );
  } catch {
    return fallback;
  }
};

function gitState(root: string) {
  const revision = git(root, ["rev-parse", "HEAD"], "unknown");
  let status = "";
  try {
    status = execFileSync(
      "git",
      ["-C", root, "status", "--porcelain", "--untracked-files=all"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    status = "";
  }
  const dirtyFiles = new Set<string>();
  for (const line of status.split(/\r?\n/))
    if (line.slice(3).trim())
      dirtyFiles.add(line.slice(3).trim().replaceAll("\\", "/"));
  return { revision, dirty: status.length > 0, dirtyFiles };
}

async function collectFiles(
  root: string,
): Promise<{ paths: string[]; excludedFiles: number }> {
  const paths: string[] = [];
  let excludedFiles = 0;
  async function visit(dir: string): Promise<void> {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (entry.name.startsWith(".") || ignored.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        excludedFiles++;
        continue;
      }
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (
        !entry.isFile() ||
        secretName.test(entry.name) ||
        !extensions.has(extname(entry.name).toLowerCase())
      )
        continue;
      if ((await lstat(path)).size > maxBytes) {
        excludedFiles++;
        continue;
      }
      paths.push(relative(root, path).replaceAll(sep, "/"));
    }
  }
  await visit(root);
  return { paths, excludedFiles };
}

function categories(name: string, text: string): string[] {
  const haystack = `${name} ${text}`.toLowerCase();
  const terms: Record<string, string[]> = {
    auth: ["auth", "passport", "jwt", "login"],
    affiliate: ["affiliate", "referral", "commission", "partner"],
    idempotency: ["idempotency", "idempotent", "replay"],
    "rate-limit": ["rate-limit", "ratelimit", "throttle"],
    webhook: ["webhook", "signature"],
    ui: ["jsx", "tsx", "component", "button", "dialog"],
    payment: ["payment", "stripe", "payout", "wallet"],
    session: ["session", "cookie", "csrf"],
    roles: ["role", "permission", "tenant"],
  };
  return Object.entries(terms)
    .filter(([, needles]) =>
      needles.some((needle) => haystack.includes(needle)),
    )
    .map(([term]) => term);
}
function riskFor(category: string[]): Descriptor["risk"] {
  return category.some((value) =>
    [
      "auth",
      "affiliate",
      "idempotency",
      "webhook",
      "payment",
      "session",
      "roles",
    ].includes(value),
  )
    ? "high"
    : category.includes("ui")
      ? "medium"
      : "low";
}
function dispositionFor(category: string[]): Descriptor["disposition"] {
  return category.some((value) =>
    ["auth", "affiliate", "payment", "roles"].includes(value),
  )
    ? "adapter-only"
    : category.includes("ui")
      ? "product-owned"
      : "candidate";
}
function importsFor(text: string): string[] {
  return [
    ...new Set(
      [
        ...text.matchAll(
          /(?:from\s+|import\s*\(|require\s*\()(["'])([^"']+)\1/g,
        ),
      ]
        .map((match) => match[2]!)
        .filter(Boolean),
    ),
  ].sort();
}
function lineAt(text: string, position: number) {
  return text.slice(0, position).split("\n").length;
}
function descriptorsFor(
  text: string,
  absolute: string,
  scanRoot: string,
  source: SourceRecord,
  fileSha256: string,
): Descriptor[] {
  const relativePath = relative(scanRoot, absolute).replaceAll(sep, "/");
  const imports = importsFor(text);
  const found: Descriptor[] = [];
  const add = (name: string, kind: Descriptor["kind"], node: ts.Node) => {
    const category = categories(name, `${relativePath}\n${node.getText()}`);
    found.push({
      name,
      kind,
      category,
      path: relativePath,
      line: lineAt(text, node.getStart()),
      repository: source.repository,
      revision: source.revision,
      revisionVerified: source.revisionVerified,
      dirty: source.dirty,
      fileSha256,
      symbolSha256: sha256(node.getText()),
      imports,
      risk: riskFor(category),
      disposition: dispositionFor(category),
    });
  };
  if (extname(absolute).toLowerCase() === ".py") {
    for (const match of text.matchAll(
      /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)|^\s*class\s+([A-Za-z_]\w*)/gm,
    )) {
      const name = match[1] ?? match[2];
      if (name && match.index !== undefined)
        add(
          name,
          match[2] ? "class" : /^use[A-Z]/.test(name) ? "hook" : "function",
          {
            getStart: () => match.index!,
            getText: () => match[0],
          } as unknown as ts.Node,
        );
    }
  } else {
    const sourceFile = ts.createSourceFile(
      absolute,
      text,
      ts.ScriptTarget.Latest,
      true,
      absolute.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name)
        add(
          node.name.text,
          /^use[A-Z]/.test(node.name.text)
            ? "hook"
            : node.name.text[0] === node.name.text[0]?.toUpperCase()
              ? "component"
              : "function",
          node,
        );
      else if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      )
        add(
          node.name.text,
          /^use[A-Z]/.test(node.name.text)
            ? "hook"
            : node.name.text[0] === node.name.text[0]?.toUpperCase()
              ? "component"
              : "function",
          node,
        );
      else if (ts.isClassDeclaration(node) && node.name)
        add(node.name.text, "class", node);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  if (found.length === 0) {
    const category = categories(relativePath, text);
    if (category.length)
      add(relativePath.split("/").pop() ?? "domain", "domain", {
        getStart: () => 0,
        getText: () => text,
      } as unknown as ts.Node);
  }
  return found;
}

export async function scanCatalog(
  roots: SourceRoot[],
  now = new Date(),
): Promise<Catalog> {
  const sources: SourceRecord[] = [];
  const descriptors: Descriptor[] = [];
  const files: Array<{ sha256: string; path: string }> = [];
  for (const input of [...roots].sort(
    (a, b) =>
      a.repository.localeCompare(b.repository) || a.path.localeCompare(b.path),
  )) {
    const requested = resolve(process.cwd(), input.path);
    let root: string;
    try {
      if ((await lstat(requested)).isSymbolicLink())
        throw new Error("source root is a symlink");
      root = await realpath(requested);
    } catch (error) {
      sources.push({
        ...input,
        status: "registered_unscanned",
        scanBlockedReason:
          error instanceof Error && error.message.includes("symlink")
            ? "unsafe_root"
            : "missing",
        revision: input.revision ?? "unavailable",
        revisionVerified: false,
        dirty: false,
        dirtyFiles: [],
        excludedFiles: 0,
      });
      continue;
    }
    const state = gitState(root);
    const revision =
      state.revision === "unknown"
        ? (input.revision ?? "unknown")
        : state.revision;
    const wipSource = input.sourceKind === "wip";
    const revisionPinned = isImmutableGitRevision(input.expectedRevision);
    const revisionMatchesPin =
      state.revision !== "unknown" &&
      revisionPinned &&
      input.expectedRevision === state.revision;
    const revisionVerified = revisionMatchesPin && !wipSource && !state.dirty;
    const status =
      input.scan === false || wipSource || state.dirty || !revisionVerified
        ? "registered_unscanned"
        : "scanned";
    const scanBlockedReason = wipSource
      ? "wip_source"
      : input.scan === false
        ? "scan_disabled"
        : state.dirty
          ? "dirty"
          : !revisionPinned
            ? "revision_unpinned"
            : !revisionVerified
              ? "revision_mismatch"
              : undefined;
    const source: SourceRecord = {
      ...input,
      path: input.path,
      status,
      ...(scanBlockedReason ? { scanBlockedReason } : {}),
      revision,
      revisionVerified,
      dirty: state.dirty,
      dirtyFiles: [...state.dirtyFiles].sort(),
      excludedFiles: 0,
    };
    sources.push(source);
    if (status === "registered_unscanned") continue;
    const inventory = await collectFiles(root);
    source.excludedFiles = inventory.excludedFiles;
    for (const relativePath of inventory.paths) {
      const absolute = join(root, relativePath);
      const text = await readFile(absolute, "utf8");
      const fileSha256 = sha256(text);
      files.push({
        sha256: fileSha256,
        path: `${source.repository}:${relativePath}`,
      });
      descriptors.push(
        ...descriptorsFor(text, absolute, root, source, fileSha256),
      );
    }
  }
  descriptors.sort(
    (a, b) =>
      a.repository.localeCompare(b.repository) ||
      a.path.localeCompare(b.path) ||
      a.line - b.line ||
      a.name.localeCompare(b.name),
  );
  const filesByDigest = new Map<string, Set<string>>();
  for (const file of files) {
    const paths = filesByDigest.get(file.sha256) ?? new Set<string>();
    paths.add(file.path);
    filesByDigest.set(file.sha256, paths);
  }
  const duplicates = [...filesByDigest]
    .filter(([, paths]) => paths.size > 1)
    .map(([sha256, paths]) => ({ sha256, paths: [...paths].sort() }));
  const names = new Map<string, Set<string>>();
  for (const descriptor of descriptors) {
    const normalized = `${descriptor.kind}:${descriptor.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const paths = names.get(normalized) ?? new Set<string>();
    paths.add(`${descriptor.repository}:${descriptor.path}:${descriptor.line}`);
    names.set(normalized, paths);
  }
  const nameCollisions = [...names]
    .filter(([, paths]) => {
      const repositories = new Set(
        [...paths].map((path) => path.split(":", 1)[0]),
      );
      return repositories.size > 1;
    })
    .map(([normalized, paths]) => {
      const [kind, name] = normalized.split(":");
      return {
        normalized: name ?? normalized,
        kind: (kind ?? "function") as Descriptor["kind"],
        paths: [...paths].sort(),
      };
    });
  return {
    schemaVersion: 2,
    generatedAt: now.toISOString(),
    sources,
    descriptors,
    duplicates,
    nameCollisions,
  };
}

export function catalogMarkdown(catalog: Catalog): string {
  const previewLimit = 100;
  const preview = catalog.descriptors.slice(0, previewLimit);
  return [
    "# Infinity Ecosystem Capability Catalog",
    "",
    `Catalog snapshot: ${catalog.generatedAt}`,
    "",
    "## Registered sources",
    "",
    ...catalog.sources.map(
      (source) =>
        `- ${source.repository}: ${source.status} (${source.revision}${source.dirty ? ", dirty" : ""}${source.scanBlockedReason ? `, ${source.scanBlockedReason}` : ""})`,
    ),
    "",
    "## Discovered capability preview",
    "",
    "This markdown view is intentionally compact. The complete descriptor ledger remains in `catalog.json`; start with `overview.md`, use the normalized family index for drill-down, or use `ecosystem:find` for exact descriptor queries.",
    "",
    "| Name | Kind | Repository | Path | Risk | Disposition |",
    "| --- | --- | --- | --- | --- | --- |",
    ...preview.map(
      (descriptor) =>
        `| ${descriptor.name} | ${descriptor.kind} | ${descriptor.repository} | ${descriptor.path}:${descriptor.line} | ${descriptor.risk} | ${descriptor.disposition} |`,
    ),
    catalog.descriptors.length > previewLimit
      ? `| … | … | … | … | ${catalog.descriptors.length - previewLimit} additional descriptors remain in catalog.json | … |`
      : "",
    "",
    "## Comparison findings",
    "",
    catalogIdentityMarkdown(
      catalogIdentity(catalog),
      implementationIndex(catalog).summary,
    ),
    `- Normalized symbol collisions: ${catalog.nameCollisions.length}`,
    "",
  ].join("\n");
}

export type CatalogSummary = {
  schemaVersion: 1;
  generatedAt: string;
  identity: CatalogIdentity;
  implementationSummary: ImplementationSummary;
  sources: {
    scanned: number;
    registeredUnscanned: number;
    dirtyRegistered: number;
  };
  descriptors: {
    total: number;
    byRepository: Record<string, number>;
    byKind: Record<string, number>;
    byCategory: Record<string, number>;
    byRisk: Record<string, number>;
    byDisposition: Record<string, number>;
  };
  comparison: { exactDuplicateFiles: number; normalizedCollisions: number };
};

export type CatalogQuery = {
  repository?: string;
  name?: string;
  category?: string;
  kind?: Descriptor["kind"];
  risk?: Descriptor["risk"];
  disposition?: Descriptor["disposition"];
};

export function findCapabilities(
  catalog: Catalog,
  query: CatalogQuery = {},
): Descriptor[] {
  return catalog.descriptors.filter((descriptor) =>
    matchesCapability(descriptor, query),
  );
}

export function matchesCapability(
  descriptor: Descriptor,
  query: CatalogQuery = {},
): boolean {
  const name = query.name?.toLowerCase();
  if (query.repository && descriptor.repository !== query.repository)
    return false;
  if (name && !descriptor.name.toLowerCase().includes(name)) return false;
  if (query.category && !descriptor.category.includes(query.category))
    return false;
  if (query.kind && descriptor.kind !== query.kind) return false;
  if (query.risk && descriptor.risk !== query.risk) return false;
  if (query.disposition && descriptor.disposition !== query.disposition)
    return false;
  return true;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function catalogSummary(catalog: Catalog): CatalogSummary {
  return {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    identity: catalogIdentity(catalog),
    implementationSummary: implementationIndex(catalog).summary,
    sources: {
      scanned: catalog.sources.filter((source) => source.status === "scanned")
        .length,
      registeredUnscanned: catalog.sources.filter(
        (source) => source.status === "registered_unscanned",
      ).length,
      dirtyRegistered: catalog.sources.filter(
        (source) => source.dirty && source.status === "registered_unscanned",
      ).length,
    },
    descriptors: {
      total: catalog.descriptors.length,
      byRepository: countBy(catalog.descriptors.map((item) => item.repository)),
      byKind: countBy(catalog.descriptors.map((item) => item.kind)),
      byCategory: countBy(catalog.descriptors.flatMap((item) => item.category)),
      byRisk: countBy(catalog.descriptors.map((item) => item.risk)),
      byDisposition: countBy(
        catalog.descriptors.map((item) => item.disposition),
      ),
    },
    comparison: {
      exactDuplicateFiles: catalog.duplicates.length,
      normalizedCollisions: catalog.nameCollisions.length,
    },
  };
}

export function catalogSummaryMarkdown(summary: CatalogSummary): string {
  const rows = (values: Record<string, number>) =>
    Object.entries(values)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `| ${key} | ${value} |`);
  return [
    "# Infinity Ecosystem Catalog Summary",
    "",
    `Catalog snapshot: ${summary.generatedAt}`,
    "",
    "## Sources",
    "",
    `- Clean scanned: ${summary.sources.scanned}`,
    `- Registered but unscanned: ${summary.sources.registeredUnscanned}`,
    `- Dirty registrations: ${summary.sources.dirtyRegistered}`,
    "",
    "## Descriptor totals",
    "",
    catalogIdentityMarkdown(summary.identity, summary.implementationSummary),
    "",
    `- Normalized collisions: ${summary.comparison.normalizedCollisions}`,
    "- Everyday browsing: `ecosystem/overview.md` (six-pillar control view)",
    "- Family drill-down: `ecosystem/normalized-index.md` (15 normalized families)",
    "",
    "## By repository",
    "",
    "| Repository | Count |",
    "| --- | ---: |",
    ...rows(summary.descriptors.byRepository),
    "",
    "## By kind",
    "",
    "| Kind | Count |",
    "| --- | ---: |",
    ...rows(summary.descriptors.byKind),
    "",
    "## By category",
    "",
    "| Category | Count |",
    "| --- | ---: |",
    ...rows(summary.descriptors.byCategory),
    "",
    "## By risk",
    "",
    "| Risk | Count |",
    "| --- | ---: |",
    ...rows(summary.descriptors.byRisk),
    "",
    "## By disposition",
    "",
    "| Disposition | Count |",
    "| --- | ---: |",
    ...rows(summary.descriptors.byDisposition),
    "",
  ].join("\n");
}

export {
  catalogIdentity,
  catalogIdentityMarkdown,
  normalizationKey,
  normalizationMarkdown,
  normalizationReport,
  normalizeCapabilityName,
  normalizedCapabilityIndex,
  normalizedCapabilityMarkdown,
  normalizedOverview,
  normalizedOverviewMarkdown,
  reusableCandidateIndex,
  reusableCandidateMarkdown,
  validateNormalizationMapLinks,
} from "./normalization.js";
export type {
  CatalogIdentity,
  NormalizationCategory,
  NormalizationDecision,
  NormalizationEvidence,
  NormalizationGroup,
  NormalizationMapLink,
  NormalizationReport,
  NormalizedCapabilityIndex,
  NormalizedFamily,
  NormalizedFamilyCapability,
  NormalizedFamilyState,
  NormalizedOverview,
  NormalizedPillar,
  NormalizedPillarState,
  ReusableCandidateIndex,
} from "./normalization.js";

export {
  implementationIndex,
  implementationMarkdown,
  implementationSummaryMarkdown,
  findImplementations,
} from "./implementations.js";
export type {
  ImplementationIndex,
  ImplementationGroup,
  ImplementationSummary,
} from "./implementations.js";
