import type { Catalog, Descriptor } from "./index.js";
import {
  declarationComparisonBlocker,
  isTestContext,
  implementationIndex,
  implementationSummaryMarkdown,
  type ImplementationSummary,
} from "./implementations.js";

export type CatalogIdentity = {
  observations: number;
  exactDuplicateFileGroups: number;
  extraIdenticalFileCopies: number;
  fileCopyDuplicateObservations: number;
  observationsAfterFileCopyDeduplication: number;
  verifiedUniqueCapabilities: null;
};

/** Count copied source observations without claiming behavioral equivalence. */
export function catalogIdentity(catalog: Catalog): CatalogIdentity {
  const files = new Map<string, Descriptor[]>();
  for (const descriptor of catalog.descriptors) {
    const location = JSON.stringify([
      descriptor.repository,
      descriptor.revision,
      descriptor.path,
      descriptor.fileSha256,
    ]);
    const items = files.get(location) ?? [];
    items.push(descriptor);
    files.set(location, items);
  }
  const seen = new Set<string>();
  let fileCopyDuplicateObservations = 0;
  for (const items of files.values()) {
    // Require the entire file's bytes and descriptor multiset to match. Names
    // alone do not establish equivalence; legacy Python symbol hashes cover
    // declaration prefixes only. Keep repeated declarations within each file.
    const signature = JSON.stringify([
      items[0]!.fileSha256,
      items
        .map((item) =>
          JSON.stringify([item.line, item.kind, item.name, item.symbolSha256]),
        )
        .sort(),
    ]);
    if (seen.has(signature)) fileCopyDuplicateObservations += items.length;
    else seen.add(signature);
  }
  return {
    observations: catalog.descriptors.length,
    exactDuplicateFileGroups: catalog.duplicates.length,
    extraIdenticalFileCopies: catalog.duplicates.reduce(
      (sum, group) => sum + Math.max(0, group.paths.length - 1),
      0,
    ),
    fileCopyDuplicateObservations,
    observationsAfterFileCopyDeduplication:
      catalog.descriptors.length - fileCopyDuplicateObservations,
    verifiedUniqueCapabilities: null,
  };
}

export function catalogIdentityMarkdown(
  identity: CatalogIdentity,
  implementations?: ImplementationSummary,
): string {
  return [
    `- Raw source observations: ${identity.observations}`,
    `- Exact duplicate file groups: ${identity.exactDuplicateFileGroups} (${identity.extraIdenticalFileCopies} additional file copies)`,
    `- Repeated observations in identical file copies: ${identity.fileCopyDuplicateObservations}`,
    `- Source observations after folding identical file copies: ${identity.observationsAfterFileCopyDeduplication}`,
    ...(implementations
      ? ["", implementationSummaryMarkdown(implementations, true), ""]
      : []),
    "- Verified unique capabilities: not established",
    "",
    "All source locations remain in the evidence ledger. Folding identical files is a source-count correction, not proof of independent capabilities or safe reuse. Name-based groups combine kind and normalized name; different behavior can share a name, and equivalent behavior can have different names.",
  ].join("\n");
}

export type NormalizationDecision =
  | "shared_canonical"
  | "reuse_as_is_candidate"
  | "shared_foundation_candidate"
  | "review_extraction"
  | "adapter_only"
  | "product_owned";

export type NormalizationEvidence = {
  repository: string;
  path: string;
  line: number;
  revision: string;
  revisionVerified: boolean;
  symbolSha256: string;
  imports: string[];
};

export type NormalizationGroup = {
  key: string;
  normalized: string;
  representativeName: string;
  kind: Descriptor["kind"];
  categories: string[];
  repositories: string[];
  count: number;
  risk: Descriptor["risk"];
  dispositions: Record<Descriptor["disposition"], number>;
  symbolHashes: string[];
  imports: string[];
  decision: NormalizationDecision;
  reason: string;
  /** Required whenever a capability cannot be shared without an explicit boundary. */
  customizationReason?: string;
  evidence: NormalizationEvidence[];
};

export type NormalizationCategory = {
  category: string;
  total: number;
  byDisposition: Record<Descriptor["disposition"], number>;
  byRisk: Record<Descriptor["risk"], number>;
  repositories: string[];
};

export type NormalizationReport = {
  schemaVersion: 1;
  generatedAt: string;
  identity: CatalogIdentity;
  implementationSummary: ImplementationSummary;
  sourceStatus: {
    scanned: number;
    registeredUnscanned: number;
    dirtyRegistered: number;
  };
  categoryMatrix: NormalizationCategory[];
  groups: {
    total: number;
    byDecision: Record<NormalizationDecision, number>;
    items: NormalizationGroup[];
  };
  collisions: Array<{
    normalized: string;
    kind: Descriptor["kind"];
    count: number;
    repositories: string[];
    paths: string[];
  }>;
};

export type ReusableCandidateIndex = {
  schemaVersion: 1;
  generatedAt: string;
  identity: CatalogIdentity;
  implementationSummary: ImplementationSummary;
  sourceStatus: NormalizationReport["sourceStatus"];
  counts: {
    sharedCanonical: number;
    reuseAsIsCandidates: number;
    sharedFoundationCandidates: number;
    reviewExtraction: number;
    excludedAdapterOnly: number;
    excludedProductOwned: number;
  };
  candidates: NormalizationGroup[];
  note: string;
};

export type NormalizationMapLink = {
  catalogKey?: string;
  sourceName?: string;
  status?: string;
  customizationReason?: string;
};

export type NormalizedFamilyState =
  "shared-foundation" | "review" | "edge-specific" | "unclassified";

export type NormalizedFamilyCapability = {
  key: string;
  name: string;
  kind: Descriptor["kind"];
  count: number;
  repositories: string[];
  decision: NormalizationDecision;
  risk: Descriptor["risk"];
  categories: string[];
  customizationReason?: string;
};

export type NormalizedFamily = {
  key: string;
  label: string;
  description: string;
  classificationBasis: {
    categories: string[];
    pathSignals: string[];
  };
  state: NormalizedFamilyState;
  groupCount: number;
  descriptorCount: number;
  repositories: string[];
  kinds: Record<Descriptor["kind"], number>;
  decisions: Record<NormalizationDecision, number>;
  risks: Record<Descriptor["risk"], number>;
  categories: string[];
  customizationReasons: string[];
  topCapabilities: NormalizedFamilyCapability[];
};

export type NormalizedCapabilityIndex = {
  schemaVersion: 1;
  generatedAt: string;
  identity: CatalogIdentity;
  implementationSummary: ImplementationSummary;
  sourceStatus: NormalizationReport["sourceStatus"];
  totals: {
    descriptors: number;
    groups: number;
    families: number;
    states: Record<NormalizedFamilyState, number>;
  };
  families: NormalizedFamily[];
  note: string;
  detailSources: {
    implementations: string;
    catalog: string;
    normalizationReport: string;
    candidateIndex: string;
  };
};

export type NormalizedPillarState =
  "shared-foundation" | "review" | "mixed" | "edge-specific" | "unclassified";

export type NormalizedPillar = {
  key: string;
  label: string;
  description: string;
  familyKeys: string[];
  state: NormalizedPillarState;
  groupCount: number;
  descriptorCount: number;
  repositories: string[];
  decisions: Record<NormalizationDecision, number>;
  customizationReasons: string[];
};

export type NormalizedOverview = {
  schemaVersion: 1;
  generatedAt: string;
  identity: CatalogIdentity;
  implementationSummary: ImplementationSummary;
  sourceStatus: NormalizationReport["sourceStatus"];
  totals: {
    descriptors: number;
    groups: number;
    families: number;
    pillars: number;
    states: Record<NormalizedPillarState, number>;
  };
  pillars: NormalizedPillar[];
  note: string;
  detailSources: {
    implementations: string;
    families: string;
    catalog: string;
    normalizationReport: string;
    candidateIndex: string;
  };
};

const restrictedCategories = new Set([
  "auth",
  "affiliate",
  "idempotency",
  "payment",
  "roles",
  "session",
  "webhook",
  "rate-limit",
]);

const portableUtilityName =
  /^(?:collapseWhitespace|compact|compactWhitespace|truncateWithEllipsis|normalize(?:Value|String|Text|Whitespace|Input|Number|Boolean|Date|Id)?|parse(?:Json|Number|Boolean|Date)?|format(?:Date|Number|Currency|Bytes|Duration)?|serialize(?:Json)?|deserialize(?:Json)?|encode(?:Base64|Uri|Url)?|decode(?:Base64|Uri|Url)?|hash|checksum|clamp|round(?:To)?|floor|ceil|compare|sort|dedupe|unique|chunk|partition|group|flatten|escape|unescape|slugify|trim|capitalize|truncate|coerce|convert(?:Value|Type)?)$/i;

const sharedUiPrimitiveNames = new Set([
  "Accordion",
  "AlertDialog",
  "AlertDialogCancel",
  "AlertDialogContent",
  "AlertDialogDescription",
  "AlertDialogFooter",
  "AlertDialogHeader",
  "AlertDialogTitle",
  "Avatar",
  "Badge",
  "Breadcrumb",
  "Button",
  "Calendar",
  "Card",
  "CardContent",
  "CardDescription",
  "CardFooter",
  "CardHeader",
  "CardTitle",
  "Checkbox",
  "Collapsible",
  "Command",
  "Dialog",
  "DialogClose",
  "DialogContent",
  "DialogDescription",
  "DialogFooter",
  "DialogHeader",
  "DialogTitle",
  "Drawer",
  "DropdownMenu",
  "Form",
  "HoverCard",
  "Input",
  "Label",
  "Pagination",
  "Popover",
  "RadioGroup",
  "ScrollArea",
  "Select",
  "Separator",
  "Sheet",
  "Skeleton",
  "Slider",
  "Switch",
  "Table",
  "Tabs",
  "Textarea",
  "Toast",
  "Toggle",
  "Tooltip",
]);

const explicitCustomizationPattern =
  /(?:credential|secret|private.?key|oauth|stripe|paypal|bank|payout|wallet|tax|commission|reward|pricing|legal|compliance|regulat|tenant.?policy|brand|theme|landing|homepage|journey|flow|copy|marketing|widget|admin.?page|dashboard)/i;

type FamilyDefinition = {
  key: string;
  label: string;
  description: string;
  categories?: readonly string[];
  pathSignals?: readonly string[];
};

/**
 * A deliberately small, stable taxonomy for browsing the catalog. The raw
 * report keeps every group; this layer gives humans a useful first level of
 * navigation without pretending that a name collision proves equivalence.
 */
const familyDefinitions: readonly FamilyDefinition[] = [
  {
    key: "identity-access",
    label: "Identity & access",
    description:
      "Authentication, sessions, roles, permissions, account identity, and access gates.",
    categories: ["auth", "session", "roles"],
    pathSignals: ["identity", "account", "login", "permission", "role"],
  },
  {
    key: "affiliate-growth",
    label: "Affiliate & growth",
    description:
      "Attribution, referral, partner, conversion, and reward evidence mechanics.",
    categories: ["affiliate"],
    pathSignals: ["referral", "partner", "attribution", "conversion", "reward"],
  },
  {
    key: "payments-money",
    label: "Payments & money",
    description:
      "Checkout, payment, billing, wallet, payout, and money-movement surfaces.",
    categories: ["payment"],
    pathSignals: ["checkout", "billing", "invoice", "wallet", "payout"],
  },
  {
    key: "reliability-guards",
    label: "Reliability & guards",
    description:
      "Idempotency, webhook verification, replay protection, rate limits, retries, and safety gates.",
    categories: ["idempotency", "webhook", "rate-limit"],
    pathSignals: [
      "idempot",
      "webhook",
      "ratelimit",
      "throttle",
      "retry",
      "guard",
    ],
  },
  {
    key: "ui-experience",
    label: "UI & experience",
    description:
      "Renderer-facing components, hooks, screens, forms, and interaction primitives.",
    categories: ["ui"],
    pathSignals: [
      "component",
      "screen",
      "form",
      "button",
      "dialog",
      "layout",
      "page",
    ],
  },
  {
    key: "ai-intelligence",
    label: "AI & intelligence",
    description:
      "Model adapters, synthesis, recommendations, embeddings, and intelligence workflows.",
    pathSignals: [
      "gemini",
      "openai",
      "llm",
      "embedding",
      "synthesis",
      "recommendation",
      "intelligence",
    ],
  },
  {
    key: "communication",
    label: "Communication",
    description:
      "Email, messaging, notifications, inboxes, SMS, and outbound communication.",
    pathSignals: [
      "email",
      "message",
      "notification",
      "inbox",
      "sms",
      "push",
      "chat",
    ],
  },
  {
    key: "media-assets",
    label: "Media & assets",
    description:
      "Images, audio, video, uploads, files, object media, and asset processing.",
    pathSignals: [
      "image",
      "audio",
      "video",
      "upload",
      "asset",
      "media",
      "objectstorage",
    ],
  },
  {
    key: "data-storage",
    label: "Data & storage",
    description:
      "Database access, repositories, schemas, migrations, queries, caching, and persistence.",
    pathSignals: [
      "database",
      "storage",
      "repository",
      "migration",
      "query",
      "cache",
      "postgres",
      "drizzle",
    ],
  },
  {
    key: "search-discovery",
    label: "Search & discovery",
    description:
      "Search, indexing, SEO, sitemaps, directories, listings, profiles, and publication.",
    pathSignals: [
      "search",
      "sitemap",
      "seo",
      "discovery",
      "directory",
      "listing",
      "profile",
      "publication",
    ],
  },
  {
    key: "operations-observability",
    label: "Operations & observability",
    description:
      "Jobs, queues, workers, health, metrics, telemetry, audits, runtime, and deployment operations.",
    pathSignals: [
      "observability",
      "metric",
      "telemetry",
      "health",
      "audit",
      "worker",
      "queue",
      "runtime",
      "deploy",
    ],
  },
  {
    key: "testing-tooling",
    label: "Testing & tooling",
    description:
      "Fixtures, mocks, contract tests, smoke checks, scripts, and developer tooling.",
    pathSignals: [
      "test",
      "fixture",
      "mock",
      "smoke",
      "contract",
      "script",
      "tool",
      "verify",
    ],
  },
  {
    key: "location-domain",
    label: "Location & domain data",
    description:
      "Geography, addresses, counties, maps, venues, food, trades, events, and scheduling.",
    pathSignals: [
      "location",
      "address",
      "county",
      "state",
      "geocode",
      "map",
      "venue",
      "restaurant",
      "event",
      "booking",
    ],
  },
  {
    key: "core-utilities",
    label: "Core utilities",
    description:
      "Small framework-neutral parsing, formatting, normalization, serialization, and math helpers.",
    pathSignals: [
      "utils",
      "helper",
      "normalize",
      "parse",
      "serialize",
      "format",
      "slug",
      "string",
      "text",
      "math",
    ],
  },
  {
    key: "uncategorized",
    label: "Unclassified",
    description:
      "Observed capabilities without a reliable family signal yet; retained for deliberate review.",
  },
];

type OverviewDefinition = {
  key: string;
  label: string;
  description: string;
  familyKeys: readonly string[];
};

/**
 * The top-level human view is intentionally smaller than the family index.
 * These pillars are navigation, not a second ownership decision: every family
 * still remains available in the drill-down index and raw report.
 */
const overviewDefinitions: readonly OverviewDefinition[] = [
  {
    key: "trust-and-identity",
    label: "Trust & identity",
    description:
      "Who can act, what can be trusted, and how replay, verification, and access are guarded.",
    familyKeys: ["identity-access", "reliability-guards"],
  },
  {
    key: "commerce-and-money",
    label: "Commerce & money",
    description:
      "Attribution, checkout, payouts, and the policy boundaries around money movement.",
    familyKeys: ["affiliate-growth", "payments-money"],
  },
  {
    key: "experience-and-content",
    label: "Experience & content",
    description:
      "Customer-facing components, communication, media, and the product journey at the edge.",
    familyKeys: ["ui-experience", "communication", "media-assets"],
  },
  {
    key: "intelligence-and-discovery",
    label: "Intelligence & discovery",
    description:
      "AI-assisted behavior, search, publication, geography, and domain discovery capabilities.",
    familyKeys: ["ai-intelligence", "search-discovery", "location-domain"],
  },
  {
    key: "data-and-operations",
    label: "Data & operations",
    description:
      "Persistence, schemas, queries, jobs, health, metrics, and runtime operations.",
    familyKeys: ["data-storage", "operations-observability"],
  },
  {
    key: "platform-and-tooling",
    label: "Platform & tooling",
    description:
      "Portable utilities, tests, developer tooling, and capabilities still waiting for a stronger signal.",
    familyKeys: ["testing-tooling", "core-utilities", "uncategorized"],
  },
];

const familyKindKeys: readonly Descriptor["kind"][] = [
  "function",
  "hook",
  "component",
  "class",
  "domain",
];

const familyDecisionKeys: readonly NormalizationDecision[] = [
  "shared_canonical",
  "reuse_as_is_candidate",
  "shared_foundation_candidate",
  "review_extraction",
  "adapter_only",
  "product_owned",
];

const familyRiskKeys: readonly Descriptor["risk"][] = ["low", "medium", "high"];

const lowSignalNames = new Set([
  "assert",
  "cleanup",
  "close",
  "handleclick",
  "log",
  "main",
  "read",
  "run",
  "sleep",
  "test",
  "write",
]);

function familyTokens(group: NormalizationGroup): string[] {
  return [
    group.representativeName,
    group.key,
    ...group.categories,
    ...group.imports,
    ...group.evidence.map((item) => item.path),
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function signalMatches(tokens: string[], signal: string): boolean {
  const normalized = signal.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!normalized) return false;
  return tokens.some(
    (token) =>
      token === normalized ||
      (normalized.length >= 3 && token.includes(normalized)),
  );
}

function familyFor(group: NormalizationGroup): {
  definition: FamilyDefinition;
  categoryHits: string[];
  pathHits: string[];
} {
  const tokens = familyTokens(group);
  for (const definition of familyDefinitions) {
    const categoryHits = (definition.categories ?? []).filter((category) =>
      group.categories.includes(category),
    );
    const pathHits = (definition.pathSignals ?? []).filter((signal) =>
      signalMatches(tokens, signal),
    );
    if (categoryHits.length || pathHits.length)
      return { definition, categoryHits, pathHits };
  }
  const fallback = familyDefinitions[familyDefinitions.length - 1]!;
  return { definition: fallback, categoryHits: [], pathHits: [] };
}

function familyState(groups: NormalizationGroup[]): NormalizedFamilyState {
  if (
    groups.some((group) =>
      [
        "shared_canonical",
        "reuse_as_is_candidate",
        "shared_foundation_candidate",
      ].includes(group.decision),
    )
  )
    return "shared-foundation";
  if (groups.some((group) => group.decision === "review_extraction"))
    return "review";
  if (
    groups.some((group) =>
      ["adapter_only", "product_owned"].includes(group.decision),
    )
  )
    return "edge-specific";
  return "unclassified";
}

function emptyFamilyKinds(): Record<Descriptor["kind"], number> {
  return Object.fromEntries(familyKindKeys.map((kind) => [kind, 0])) as Record<
    Descriptor["kind"],
    number
  >;
}

function emptyFamilyDecisions(): Record<NormalizationDecision, number> {
  return Object.fromEntries(
    familyDecisionKeys.map((decision) => [decision, 0]),
  ) as Record<NormalizationDecision, number>;
}

function emptyFamilyRisks(): Record<Descriptor["risk"], number> {
  return Object.fromEntries(familyRiskKeys.map((risk) => [risk, 0])) as Record<
    Descriptor["risk"],
    number
  >;
}

function familyCapabilityScore(group: NormalizationGroup): number {
  const meaningfulName = !lowSignalNames.has(
    normalizeCapabilityName(group.representativeName),
  );
  return (
    group.count * 2 +
    group.repositories.length * 5 +
    group.categories.length * 3 +
    (meaningfulName ? 10 : 0) +
    (group.decision === "shared_canonical" ? 30 : 0) +
    (group.decision === "shared_foundation_candidate" ? 15 : 0)
  );
}

const customizationBoundaryCatalog = [
  {
    key: "provider-execution",
    label: "Provider credentials and execution vary by product.",
    pattern: /provider credentials|payment execution|provider economics/i,
  },
  {
    key: "economic-policy",
    label:
      "Commission, eligibility, payout, and tax economics are policy-configured.",
    pattern: /commission|eligibility|payout|tax economics/i,
  },
  {
    key: "identity-runtime",
    label:
      "Identity provider, account recovery, and session storage vary by deployment.",
    pattern: /identity provider|account-recovery|session storage/i,
  },
  {
    key: "tenant-authority",
    label: "Tenant roles and authority policy are deployment-configured.",
    pattern: /tenant roles|authority policy/i,
  },
  {
    key: "rate-limit-policy",
    label: "Rate-limit thresholds, quotas, and backoff are workload policy.",
    pattern: /limits and backoff thresholds/i,
  },
  {
    key: "brand-journey",
    label:
      "Brand tokens, copy, layout, and customer journey are intentionally product-specific.",
    pattern: /brand tokens|product-specific copy|journey-specific layout/i,
  },
] as const;

function normalizedCustomizationReasons(
  groups: NormalizationGroup[],
): string[] {
  const keys = new Set<string>();
  const fallback = new Set<string>();
  for (const group of groups) {
    for (const reason of group.customizationReason?.split(/;\s*/) ?? []) {
      const trimmed = reason.trim();
      if (!trimmed) continue;
      const boundary = customizationBoundaryCatalog.find((item) =>
        item.pattern.test(trimmed),
      );
      if (boundary) keys.add(boundary.key);
      else fallback.add(trimmed);
    }
  }
  return [
    ...customizationBoundaryCatalog
      .filter((boundary) => keys.has(boundary.key))
      .map((boundary) => boundary.label),
    ...[...fallback].sort(),
  ];
}

function isSharedUiPrimitive(group: Descriptor[]): boolean {
  return group.some(
    (descriptor) =>
      descriptor.category.includes("ui") &&
      (sharedUiPrimitiveNames.has(descriptor.name) ||
        /(?:^|\/)components\/ui(?:\/|$)/i.test(descriptor.path)),
  );
}

function customizationReasonFor(descriptors: Descriptor[]): string | undefined {
  const categories = new Set(
    descriptors.flatMap((descriptor) => descriptor.category),
  );
  const namesAndPaths = descriptors
    .map((descriptor) => `${descriptor.name} ${descriptor.path}`)
    .join(" ");
  const reasons: string[] = [];
  if (categories.has("payment"))
    reasons.push("provider credentials and payment execution vary by product");
  if (categories.has("affiliate"))
    reasons.push(
      "commission, eligibility, payout, and tax economics are policy-configured",
    );
  if (categories.has("auth") || categories.has("session"))
    reasons.push(
      "identity provider, account-recovery, and session storage choices vary by deployment",
    );
  if (categories.has("roles"))
    reasons.push("tenant roles and authority policy are deployment-configured");
  if (categories.has("rate-limit"))
    reasons.push(
      "limits and backoff thresholds are workload policy, not shared execution",
    );
  if (categories.has("ui") && explicitCustomizationPattern.test(namesAndPaths))
    reasons.push(
      "brand tokens, copy, or journey-specific layout is intentionally product-specific",
    );
  if (reasons.length) return reasons.join("; ");
  return undefined;
}

const emptyDispositionCounts = (): Record<
  Descriptor["disposition"],
  number
> => ({
  candidate: 0,
  "adapter-only": 0,
  "product-owned": 0,
});

const emptyRiskCounts = (): Record<Descriptor["risk"], number> => ({
  low: 0,
  medium: 0,
  high: 0,
});

export function normalizeCapabilityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizationKey(
  descriptor: Pick<Descriptor, "kind" | "name">,
): string {
  const normalized = normalizeCapabilityName(descriptor.name);
  return `${descriptor.kind}:${normalized}`;
}

function decisionFor(descriptors: Descriptor[]): {
  decision: NormalizationDecision;
  reason: string;
  customizationReason?: string;
} {
  const categories = new Set(
    descriptors.flatMap((descriptor) => descriptor.category),
  );
  const repositories = new Set(
    descriptors.map((descriptor) => descriptor.repository),
  );
  const hashes = new Set(
    descriptors.map((descriptor) => descriptor.symbolSha256),
  );
  const repeatedEvidence =
    repositories.size > 1 || (descriptors.length > 1 && hashes.size === 1);
  const sharedUiPrimitive = isSharedUiPrimitive(descriptors);
  const customizationReason = customizationReasonFor(descriptors);
  const canonicalMembers = descriptors.filter(
    (descriptor) =>
      descriptor.repository === "infinity-canonical" &&
      !isTestContext(descriptor.path) &&
      /^packages\/(?:contracts|provider-core|auth-core|affiliate-core|ui-core)\/src\//.test(
        descriptor.path,
      ),
  );
  const completeDeclarations = descriptors.every(
    (descriptor) =>
      declarationComparisonBlocker(descriptor) === undefined &&
      !isTestContext(descriptor.path),
  );
  if (
    canonicalMembers.length === descriptors.length &&
    completeDeclarations &&
    hashes.size === 1
  )
    return {
      decision: "shared_canonical",
      reason:
        "Every occurrence of this declaration is in an Infinity canonical shared package. This identifies its existing owner; it does not prove external consumers have migrated.",
    };
  if (canonicalMembers.length)
    return {
      decision: "review_extraction",
      reason:
        "An Infinity canonical occurrence exists, but this name group also contains other source contexts, differing implementations, or incomplete declaration evidence. Compare each implementation before assigning the whole group a shared owner.",
      ...(customizationReason ? { customizationReason } : {}),
    };
  const hasRestrictedSurface = descriptors.some(
    (descriptor) =>
      descriptor.disposition === "adapter-only" ||
      descriptor.risk === "high" ||
      descriptor.category.some((category) =>
        restrictedCategories.has(category),
      ),
  );
  const hasExplicitCustomization = descriptors.some((descriptor) =>
    explicitCustomizationPattern.test(`${descriptor.name} ${descriptor.path}`),
  );

  // A generic UI primitive is shared infrastructure even when its source file
  // carries product theme classes. The theme is a configurable token surface,
  // not a reason to fork the component.
  if (sharedUiPrimitive && !hasExplicitCustomization)
    return {
      decision: "shared_foundation_candidate",
      reason:
        "Generic UI primitives are shared Infinity infrastructure; visual tokens and renderer bindings are configurable at the product edge.",
    };

  // Restricted domains still get a shared foundation by default. Only the
  // deployment-specific boundary (credentials, provider execution, economics,
  // legal policy, or tenant authority) is customized, and that reason is
  // recorded rather than silently excluding the capability.
  if (hasRestrictedSurface && !customizationReason)
    return {
      decision: "shared_foundation_candidate",
      reason:
        "A shared auth, attribution, payment, session, role, webhook, or rate-limit foundation is expected; no concrete customization boundary was detected yet.",
    };
  if (hasRestrictedSurface && customizationReason && !repeatedEvidence)
    return {
      decision: "adapter_only",
      reason:
        "The reusable foundation is shared, but this implementation crosses a deployment-specific boundary and must remain an adapter until that boundary is supplied.",
      customizationReason,
    };
  if (hasRestrictedSurface && customizationReason)
    return {
      decision: "shared_foundation_candidate",
      reason:
        "The shared foundation is evidenced across the ecosystem; only the recorded deployment-specific boundary is customized behind an adapter.",
      customizationReason,
    };
  if (
    descriptors.some(
      (descriptor) => descriptor.disposition === "product-owned",
    ) ||
    (categories.has("ui") && !sharedUiPrimitive)
  )
    return {
      decision: "product_owned",
      reason:
        "Only product-specific copy, brand tokens, layout, or customer-flow behavior is customized; the underlying shared primitives remain Infinity-owned.",
      customizationReason:
        customizationReason ??
        "Product-specific copy, brand tokens, layout, or customer-flow behavior is intentionally differentiated.",
    };
  const allLowRiskCandidates = descriptors.every(
    (descriptor) =>
      descriptor.disposition === "candidate" && descriptor.risk === "low",
  );
  if (
    allLowRiskCandidates &&
    completeDeclarations &&
    hashes.size === 1 &&
    repositories.size > 1 &&
    descriptors.every(
      (descriptor) =>
        descriptor.kind === "function" &&
        descriptor.category.length === 0 &&
        descriptor.imports.length === 0 &&
        portableUtilityName.test(descriptor.name),
    )
  )
    return {
      decision: "reuse_as_is_candidate",
      reason:
        "The same complete declaration text for a low-risk, uncategorized utility appears in multiple clean sources with no recorded imports. Captured variables, resolved dependencies, ownership, and behavioral tests still require review before promotion.",
    };
  return {
    decision: "review_extraction",
    reason:
      "The capability is not yet proven identical or portable; Infinity keeps it in the shared review queue instead of accepting a product fork.",
  };
}

function groupDescriptors(descriptors: Descriptor[]): NormalizationGroup[] {
  const groups = new Map<string, Descriptor[]>();
  for (const descriptor of descriptors) {
    const key = normalizationKey(descriptor);
    const group = groups.get(key) ?? [];
    group.push(descriptor);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const sorted = [...items].sort(
        (a, b) =>
          a.repository.localeCompare(b.repository) ||
          a.path.localeCompare(b.path) ||
          a.line - b.line,
      );
      const categories = [
        ...new Set(sorted.flatMap((item) => item.category)),
      ].sort();
      const repositories = [
        ...new Set(sorted.map((item) => item.repository)),
      ].sort();
      const dispositions = emptyDispositionCounts();
      for (const item of sorted) dispositions[item.disposition]++;
      const risks = [...new Set(sorted.map((item) => item.risk))];
      const risk: Descriptor["risk"] = risks.includes("high")
        ? "high"
        : risks.includes("medium")
          ? "medium"
          : "low";
      const { decision, reason, customizationReason } = decisionFor(sorted);
      const imports = [
        ...new Set(sorted.flatMap((item) => item.imports)),
      ].sort();
      return {
        key,
        normalized: normalizeCapabilityName(sorted[0]!.name),
        representativeName: sorted[0]!.name,
        kind: sorted[0]!.kind,
        categories,
        repositories,
        count: sorted.length,
        risk,
        dispositions,
        symbolHashes: [
          ...new Set(sorted.map((item) => item.symbolSha256)),
        ].sort(),
        imports,
        decision,
        reason,
        ...(customizationReason ? { customizationReason } : {}),
        evidence: sorted.map((item) => ({
          repository: item.repository,
          path: item.path,
          line: item.line,
          revision: item.revision,
          revisionVerified: item.revisionVerified,
          symbolSha256: item.symbolSha256,
          imports: item.imports,
        })),
      };
    });
}

function categoryMatrix(descriptors: Descriptor[]): NormalizationCategory[] {
  const byCategory = new Map<string, Descriptor[]>();
  for (const descriptor of descriptors)
    for (const category of descriptor.category) {
      const items = byCategory.get(category) ?? [];
      items.push(descriptor);
      byCategory.set(category, items);
    }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => {
      const byDisposition = emptyDispositionCounts();
      const byRisk = emptyRiskCounts();
      for (const item of items) {
        byDisposition[item.disposition]++;
        byRisk[item.risk]++;
      }
      return {
        category,
        total: items.length,
        byDisposition,
        byRisk,
        repositories: [...new Set(items.map((item) => item.repository))].sort(),
      };
    });
}

function decisionCounts(
  groups: NormalizationGroup[],
): Record<NormalizationDecision, number> {
  const counts: Record<NormalizationDecision, number> = {
    shared_canonical: 0,
    reuse_as_is_candidate: 0,
    shared_foundation_candidate: 0,
    review_extraction: 0,
    adapter_only: 0,
    product_owned: 0,
  };
  for (const group of groups) counts[group.decision]++;
  return counts;
}

export function normalizationReport(catalog: Catalog): NormalizationReport {
  const groups = groupDescriptors(catalog.descriptors);
  const missingCustomizationReasons = groups.filter(
    (group) =>
      (group.decision === "adapter_only" ||
        group.decision === "product_owned") &&
      !group.customizationReason,
  );
  if (missingCustomizationReasons.length) {
    throw new Error(
      `normalization groups require customization reasons: ${missingCustomizationReasons
        .map((group) => group.key)
        .join(", ")}`,
    );
  }
  return {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    identity: catalogIdentity(catalog),
    implementationSummary: implementationIndex(catalog).summary,
    sourceStatus: {
      scanned: catalog.sources.filter((source) => source.status === "scanned")
        .length,
      registeredUnscanned: catalog.sources.filter(
        (source) => source.status === "registered_unscanned",
      ).length,
      dirtyRegistered: catalog.sources.filter(
        (source) => source.dirty && source.status === "registered_unscanned",
      ).length,
    },
    categoryMatrix: categoryMatrix(catalog.descriptors),
    groups: {
      total: groups.length,
      byDecision: decisionCounts(groups),
      items: groups,
    },
    collisions: catalog.nameCollisions
      .map((collision) => ({
        normalized: collision.normalized,
        kind: collision.kind,
        count: collision.paths.length,
        repositories: [
          ...new Set(collision.paths.map((path) => path.split(":", 1)[0]!)),
        ].sort(),
        paths: [...collision.paths].sort(),
      }))
      .sort(
        (a, b) =>
          a.normalized.localeCompare(b.normalized) ||
          a.kind.localeCompare(b.kind),
      ),
  };
}

type FamilyBucket = {
  definition: FamilyDefinition;
  groups: NormalizationGroup[];
  categoryHits: Set<string>;
  pathHits: Set<string>;
};

function familyTotals(
  groups: NormalizationGroup[],
): Pick<
  NormalizedFamily,
  "repositories" | "kinds" | "decisions" | "risks" | "categories"
> {
  const repositories = new Set<string>();
  const kinds = emptyFamilyKinds();
  const decisions = emptyFamilyDecisions();
  const risks = emptyFamilyRisks();
  const categories = new Set<string>();
  for (const group of groups) {
    group.repositories.forEach((repository) => repositories.add(repository));
    kinds[group.kind] += group.count;
    decisions[group.decision]++;
    risks[group.risk]++;
    group.categories.forEach((category) => categories.add(category));
  }
  return {
    repositories: [...repositories].sort(),
    kinds,
    decisions,
    risks,
    categories: [...categories].sort(),
  };
}

function familyCapabilities(
  groups: NormalizationGroup[],
): NormalizedFamilyCapability[] {
  const sorted = [...groups].sort(
    (a, b) =>
      familyCapabilityScore(b) - familyCapabilityScore(a) ||
      b.count - a.count ||
      a.key.localeCompare(b.key),
  );
  const meaningful = sorted.filter(
    (group) =>
      !lowSignalNames.has(normalizeCapabilityName(group.representativeName)),
  );
  const selected = (meaningful.length >= 3 ? meaningful : sorted).slice(0, 12);
  return selected.map((group) => ({
    key: group.key,
    name: group.representativeName,
    kind: group.kind,
    count: group.count,
    repositories: group.repositories,
    decision: group.decision,
    risk: group.risk,
    categories: group.categories,
    ...(group.customizationReason
      ? { customizationReason: group.customizationReason }
      : {}),
  }));
}

/**
 * Collapse thousands of symbol groups into a small, stable browsing index.
 * This index intentionally stores counts, family signals, and representative
 * capabilities only. Exact evidence remains addressable through the raw
 * catalog and normalization report paths listed in `detailSources`.
 */
export function normalizedCapabilityIndex(
  report: NormalizationReport,
): NormalizedCapabilityIndex {
  const buckets = new Map<string, FamilyBucket>();
  for (const group of report.groups.items) {
    const match = familyFor(group);
    const bucket =
      buckets.get(match.definition.key) ??
      ({
        definition: match.definition,
        groups: [],
        categoryHits: new Set<string>(),
        pathHits: new Set<string>(),
      } satisfies FamilyBucket);
    bucket.groups.push(group);
    match.categoryHits.forEach((category) => bucket.categoryHits.add(category));
    match.pathHits.forEach((signal) => bucket.pathHits.add(signal));
    buckets.set(match.definition.key, bucket);
  }

  const families = familyDefinitions
    .map((definition) => buckets.get(definition.key))
    .filter((bucket): bucket is FamilyBucket => Boolean(bucket))
    .map((bucket) => {
      const totals = familyTotals(bucket.groups);
      return {
        key: bucket.definition.key,
        label: bucket.definition.label,
        description: bucket.definition.description,
        classificationBasis: {
          categories: [...bucket.categoryHits].sort(),
          pathSignals: [...bucket.pathHits].sort(),
        },
        state: familyState(bucket.groups),
        groupCount: bucket.groups.length,
        descriptorCount: bucket.groups.reduce(
          (sum, group) => sum + group.count,
          0,
        ),
        ...totals,
        customizationReasons: normalizedCustomizationReasons(bucket.groups),
        topCapabilities: familyCapabilities(bucket.groups),
      } satisfies NormalizedFamily;
    });

  const states: Record<NormalizedFamilyState, number> = {
    "shared-foundation": 0,
    review: 0,
    "edge-specific": 0,
    unclassified: 0,
  };
  for (const family of families) states[family.state]++;
  return {
    schemaVersion: 1,
    generatedAt: report.generatedAt,
    identity: report.identity,
    implementationSummary: report.implementationSummary,
    sourceStatus: report.sourceStatus,
    totals: {
      descriptors: families.reduce(
        (sum, family) => sum + family.descriptorCount,
        0,
      ),
      groups: families.reduce((sum, family) => sum + family.groupCount, 0),
      families: families.length,
      states,
    },
    families,
    note: "This is the family drill-down layer. Start with ecosystem/overview.md for the six-pillar control view. It intentionally collapses repeated symbol groups and low-signal names; use the linked detail sources for exact provenance, line-level evidence, and full comparisons.",
    detailSources: {
      implementations: "ecosystem/implementation-index.json",
      catalog: "ecosystem/catalog.json",
      normalizationReport: "ecosystem/normalization-report.json",
      candidateIndex: "reusable/candidate-index.json",
    },
  };
}

const overviewStateKeys: readonly NormalizedPillarState[] = [
  "shared-foundation",
  "review",
  "mixed",
  "edge-specific",
  "unclassified",
];

function emptyOverviewStates(): Record<NormalizedPillarState, number> {
  return Object.fromEntries(
    overviewStateKeys.map((state) => [state, 0]),
  ) as Record<NormalizedPillarState, number>;
}

function pillarState(families: NormalizedFamily[]): NormalizedPillarState {
  const states = new Set(families.map((family) => family.state));
  if (states.size === 0) return "unclassified";
  if (states.size === 1) return [...states][0]!;
  return "mixed";
}

/**
 * Collapse the family drill-down into six portfolio pillars. This is the
 * default human control view; it deliberately has no individual symbol rows.
 */
export function normalizedOverview(
  index: NormalizedCapabilityIndex,
): NormalizedOverview {
  const familiesByKey = new Map(
    index.families.map((family) => [family.key, family]),
  );
  const coveredFamilyKeys = new Set(
    overviewDefinitions.flatMap((definition) => definition.familyKeys),
  );
  const uncoveredFamilies = index.families.filter(
    (family) => !coveredFamilyKeys.has(family.key),
  );
  if (uncoveredFamilies.length) {
    throw new Error(
      `overview definitions missing families: ${uncoveredFamilies
        .map((family) => family.key)
        .join(", ")}`,
    );
  }
  const pillars = overviewDefinitions
    .map((definition) => {
      const families = definition.familyKeys
        .map((key) => familiesByKey.get(key))
        .filter((family): family is NormalizedFamily => Boolean(family));
      if (!families.length) return undefined;
      const repositories = new Set<string>();
      const decisions = emptyFamilyDecisions();
      const customizationReasons = new Set<string>();
      for (const family of families) {
        family.repositories.forEach((repository) =>
          repositories.add(repository),
        );
        for (const decision of familyDecisionKeys)
          decisions[decision] += family.decisions[decision];
        family.customizationReasons.forEach((reason) =>
          customizationReasons.add(reason),
        );
      }
      return {
        key: definition.key,
        label: definition.label,
        description: definition.description,
        familyKeys: families.map((family) => family.key),
        state: pillarState(families),
        groupCount: families.reduce(
          (sum, family) => sum + family.groupCount,
          0,
        ),
        descriptorCount: families.reduce(
          (sum, family) => sum + family.descriptorCount,
          0,
        ),
        repositories: [...repositories].sort(),
        decisions,
        customizationReasons: [...customizationReasons],
      } satisfies NormalizedPillar;
    })
    .filter((pillar): pillar is NormalizedPillar => Boolean(pillar));
  const states = emptyOverviewStates();
  for (const pillar of pillars) states[pillar.state]++;
  return {
    schemaVersion: 1,
    generatedAt: index.generatedAt,
    identity: index.identity,
    implementationSummary: index.implementationSummary,
    sourceStatus: index.sourceStatus,
    totals: {
      descriptors: index.totals.descriptors,
      groups: index.totals.groups,
      families: index.totals.families,
      pillars: pillars.length,
      states,
    },
    pillars,
    note: "This is Infinity's smallest useful control view: six portfolio pillars summarize the normalized family index without repeating individual symbols. Use the family index for domain drill-down and the raw catalog/report for exact provenance.",
    detailSources: {
      implementations: "ecosystem/implementation-index.json",
      families: "ecosystem/normalized-index.json",
      catalog: "ecosystem/catalog.json",
      normalizationReport: "ecosystem/normalization-report.json",
      candidateIndex: "reusable/candidate-index.json",
    },
  };
}

function pillarDecisionSummary(pillar: NormalizedPillar): string {
  return familyDecisionKeys
    .filter((decision) => pillar.decisions[decision] > 0)
    .map((decision) => `${decision}:${pillar.decisions[decision]}`)
    .join(", ");
}

export function normalizedOverviewMarkdown(
  overview: NormalizedOverview,
): string {
  const sharedByDefault = overview.pillars.reduce(
    (sum, pillar) =>
      sum +
      pillar.decisions.shared_canonical +
      pillar.decisions.reuse_as_is_candidate +
      pillar.decisions.shared_foundation_candidate,
    0,
  );
  const reviewBeforePromotion = overview.pillars.reduce(
    (sum, pillar) => sum + pillar.decisions.review_extraction,
    0,
  );
  const edgeExceptions = overview.pillars.reduce(
    (sum, pillar) =>
      sum + pillar.decisions.adapter_only + pillar.decisions.product_owned,
    0,
  );
  const rows = overview.pillars.map(
    (pillar) =>
      `| ${pillar.label} | ${pillar.state} | ${pillar.familyKeys.join(", ")} | ${pillar.groupCount} | ${pillar.descriptorCount} | ${pillar.repositories.length} |`,
  );
  const sections = overview.pillars.flatMap((pillar) => [
    `## ${pillar.label}`,
    "",
    pillar.description,
    "",
    `Families: ${pillar.familyKeys.join(", ")}. State: **${pillar.state}**. Decisions: ${pillarDecisionSummary(pillar)}.`,
    pillar.customizationReasons.length
      ? `Customization boundaries: ${pillar.customizationReasons.join("; ")}`
      : "Customization boundaries: none recorded; shared by default.",
    "",
  ]);
  return [
    "# Infinity Ecosystem Overview",
    "",
    `Catalog snapshot: ${overview.generatedAt}`,
    "",
    overview.note,
    "",
    catalogIdentityMarkdown(overview.identity, overview.implementationSummary),
    "",
    `- Name-based groups (not verified unique capabilities): ${overview.totals.groups}`,
    `- Capability families: ${overview.totals.families}`,
    `- Portfolio pillars: ${overview.totals.pillars}`,
    "",
    "| Pillar | State | Families | Name groups | Observations | Repositories |",
    "| --- | --- | --- | ---: | ---: | ---: |",
    ...rows,
    "",
    "## Decision posture",
    "",
    "| Bucket | Name-based groups | Next action |",
    "| --- | ---: | --- |",
    `| Shared by default | ${sharedByDefault} | Consolidate behind Infinity-owned foundations; keep only explicit edge configuration. |`,
    `| Review before promotion | ${reviewBeforePromotion} | Compare semantics, dependencies, tests, owners, and licenses before extraction. |`,
    `| Edge exceptions | ${edgeExceptions} | Keep as adapters or product-owned surfaces only with a recorded customization reason. |`,
    "",
    "## Shared-by-default posture",
    "",
    "Infinity owns the shared foundation by default. Product differences stay at explicit provider, policy, tenant, runtime, brand, copy, layout, or journey boundaries; the family and raw detail layers retain the evidence behind each decision.",
    "",
    ...sections,
    "Drill down: `ecosystem/implementation-index.md` (exact declaration-text groups), `ecosystem/normalized-index.md` (families), `ecosystem/normalization-report.json` (name groups), and `ecosystem/catalog.json` (all observations).",
    "",
  ].join("\n");
}

function familyDecisionSummary(family: NormalizedFamily): string {
  return familyDecisionKeys
    .filter((decision) => family.decisions[decision] > 0)
    .map((decision) => `${decision}:${family.decisions[decision]}`)
    .join(", ");
}

export function normalizedCapabilityMarkdown(
  index: NormalizedCapabilityIndex,
): string {
  const rows = index.families.map(
    (family) =>
      `| ${family.label} | ${family.state} | ${family.groupCount} | ${family.descriptorCount} | ${family.repositories.length} | ${familyDecisionSummary(family)} |`,
  );
  const sections = index.families.flatMap((family) => [
    `## ${family.label}`,
    "",
    family.description,
    "",
    `Classification signals: categories=${family.classificationBasis.categories.join(", ") || "none"}; path/name=${family.classificationBasis.pathSignals.join(", ") || "none"}.`,
    "",
    `State: **${family.state}**. ${family.groupCount} name-based groups contain ${family.descriptorCount} source observations across ${family.repositories.length} repositories. These are not verified unique capabilities.`,
    "",
    family.customizationReasons.length
      ? `Customization boundaries: ${family.customizationReasons.join("; ")}`
      : "Customization boundaries: none recorded; shared by default.",
    "",
    "Representative name groups (not the complete evidence set):",
    "",
    "| Name | Kind | Occurrences | Decision | Risk | Repositories |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...family.topCapabilities.map(
      (capability) =>
        `| ${capability.name} | ${capability.kind} | ${capability.count} | ${capability.decision} | ${capability.risk} | ${capability.repositories.join(", ")} |`,
    ),
    "",
  ]);
  return [
    "# Infinity Normalized Capability Index",
    "",
    `Catalog snapshot: ${index.generatedAt}`,
    "",
    index.note,
    "",
    catalogIdentityMarkdown(index.identity, index.implementationSummary),
    "",
    `- Name-based groups (not verified unique capabilities): ${index.totals.groups}`,
    `- Browsable families: ${index.totals.families}`,
    `- Family states: ${Object.entries(index.totals.states)
      .map(([state, count]) => `${state}=${count}`)
      .join(", ")}`,
    "",
    "| Family | State | Name groups | Observations | Repositories | Decisions |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...rows,
    "",
    ...sections,
    "Detail sources: `ecosystem/catalog.json`, `ecosystem/normalization-report.json`, and `reusable/candidate-index.json`.",
    "",
  ].join("\n");
}

/**
 * Validate the optional machine join from normalization-map.json back to the
 * generated report. Entries without a catalogKey are policy-only rows and do
 * not require a report group.
 */
export function validateNormalizationMapLinks(
  report: NormalizationReport,
  map: unknown,
): string[] {
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return ["normalization map must be an object"];
  }
  const capabilities = (map as { capabilities?: unknown }).capabilities;
  if (!Array.isArray(capabilities)) {
    return ["normalization map capabilities must be an array"];
  }
  const groups = new Map(
    report.groups.items.map((group) => [group.key, group]),
  );
  const errors: string[] = [];
  capabilities.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`normalization map capability[${index}] must be an object`);
      return;
    }
    const link = entry as NormalizationMapLink;
    if (
      typeof link.status === "string" &&
      /(?:adapter|customization|required|product-owned)/i.test(link.status) &&
      (!link.customizationReason || !link.customizationReason.trim())
    ) {
      errors.push(
        `normalization map capability[${index}].customizationReason is required for status ${link.status}`,
      );
    }
    if (link.catalogKey === undefined) return;
    if (typeof link.catalogKey !== "string" || !link.catalogKey) {
      errors.push(
        `normalization map capability[${index}].catalogKey must be a non-empty string`,
      );
      return;
    }
    const group = groups.get(link.catalogKey);
    if (!group) {
      errors.push(
        `normalization map capability[${index}].catalogKey does not match a report group: ${link.catalogKey}`,
      );
      return;
    }
    if (
      link.sourceName !== undefined &&
      (typeof link.sourceName !== "string" ||
        link.sourceName !== group.representativeName)
    ) {
      errors.push(
        `normalization map capability[${index}].sourceName does not match ${link.catalogKey}`,
      );
    }
  });
  return errors;
}

export function reusableCandidateIndex(
  report: NormalizationReport,
): ReusableCandidateIndex {
  const candidates = report.groups.items.filter(
    (group) =>
      group.decision === "reuse_as_is_candidate" ||
      group.decision === "shared_foundation_candidate" ||
      group.decision === "review_extraction",
  );
  return {
    schemaVersion: 1,
    generatedAt: report.generatedAt,
    identity: report.identity,
    implementationSummary: report.implementationSummary,
    sourceStatus: report.sourceStatus,
    counts: {
      sharedCanonical: report.groups.byDecision.shared_canonical,
      reuseAsIsCandidates: report.groups.byDecision.reuse_as_is_candidate,
      sharedFoundationCandidates:
        report.groups.byDecision.shared_foundation_candidate,
      reviewExtraction: report.groups.byDecision.review_extraction,
      excludedAdapterOnly: report.groups.byDecision.adapter_only,
      excludedProductOwned: report.groups.byDecision.product_owned,
    },
    candidates,
    note: "Metadata and provenance only. Infinity owns the shared-by-default queue. Each candidate still requires owner, dependency, test, and license review; any customization boundary must carry an explicit reason.",
  };
}

export function reusableCandidateMarkdown(
  index: ReusableCandidateIndex,
): string {
  const rows = index.candidates
    .slice(0, 200)
    .map(
      (group) =>
        `| ${group.representativeName} | ${group.decision} | ${group.kind} | ${group.count} | ${group.repositories.join(", ")} | ${group.categories.join(", ") || "uncategorized"} | ${group.customizationReason ?? "shared by default"} |`,
    );
  return [
    "# Reusable Candidate Index",
    "",
    `Catalog snapshot: ${index.generatedAt}`,
    "",
    index.note,
    "",
    catalogIdentityMarkdown(index.identity, index.implementationSummary),
    "",
    `- Shared canonical: ${index.counts.sharedCanonical}`,
    `- Reuse-as-is candidates: ${index.counts.reuseAsIsCandidates}`,
    `- Shared foundation candidates: ${index.counts.sharedFoundationCandidates}`,
    `- Review extraction: ${index.counts.reviewExtraction}`,
    `- Excluded adapter-only: ${index.counts.excludedAdapterOnly}`,
    `- Excluded product-owned: ${index.counts.excludedProductOwned}`,
    "",
    "| Name | Decision | Kind | Evidence count | Repositories | Categories | Customization reason |",
    "| --- | --- | --- | ---: | --- | --- | --- |",
    ...rows,
    index.candidates.length > 200
      ? "| … | … | … | … | additional candidates remain in candidate-index.json | … |"
      : "",
    "",
    "The complete evidence set, including shared foundations and the explicit customization-boundary reasons for auth, affiliate, payment, session, role, webhook, rate-limit, idempotency, UI, and product-specific groups, is in `ecosystem/normalization-report.json`.",
    "",
  ].join("\n");
}

function tableRows(
  groups: NormalizationGroup[],
  decision: NormalizationDecision,
): string[] {
  return groups
    .filter((group) => group.decision === decision)
    .slice(0, 200)
    .map(
      (group) =>
        `| ${group.representativeName} | ${group.kind} | ${group.count} | ${group.repositories.join(", ")} | ${group.categories.join(", ") || "uncategorized"} | ${group.customizationReason ?? "shared by default"} |`,
    );
}

export function normalizationMarkdown(report: NormalizationReport): string {
  const { byDecision } = report.groups;
  const categoryRows = report.categoryMatrix.map(
    (item) =>
      `| ${item.category} | ${item.total} | ${item.byDisposition.candidate} | ${item.byDisposition["adapter-only"]} | ${item.byDisposition["product-owned"]} | ${item.byRisk.high} | ${item.repositories.join(", ")} |`,
  );
  const section = (
    title: string,
    decision: NormalizationDecision,
    note: string,
  ) => [
    `## ${title}`,
    "",
    note,
    "",
    "| Name | Kind | Evidence count | Repositories | Categories | Customization reason |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...tableRows(report.groups.items, decision),
    report.groups.items.filter((group) => group.decision === decision).length >
    200
      ? "| … | … | … | … | additional groups remain in normalization-report.json | … |"
      : "",
    "",
  ];
  return [
    "# Infinity Normalization Report",
    "",
    `Catalog snapshot: ${report.generatedAt}`,
    "",
    "This report contains metadata and provenance only. It never copies source bodies or authorizes automatic product-code reuse.",
    "",
    catalogIdentityMarkdown(report.identity, report.implementationSummary),
    "",
    `- Name-based groups (not verified unique capabilities): ${report.groups.total}`,
    "",
    "## Decision totals",
    "",
    `- Shared canonical: ${byDecision.shared_canonical}`,
    `- Reuse-as-is candidates: ${byDecision.reuse_as_is_candidate}`,
    `- Shared foundation candidates: ${byDecision.shared_foundation_candidate}`,
    `- Review extraction: ${byDecision.review_extraction}`,
    `- Adapter-only: ${byDecision.adapter_only}`,
    `- Product-owned: ${byDecision.product_owned}`,
    "",
    "## Category matrix",
    "",
    "| Category | Total | Candidate | Adapter-only | Product-owned | High risk | Repositories |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...categoryRows,
    "",
    ...section(
      "Shared foundation candidates",
      "shared_foundation_candidate",
      "These auth, attribution, payment, session, role, rate-limit, webhook, and generic UI surfaces belong in Infinity's shared foundation. Any provider, policy, economics, or theme boundary is recorded explicitly on the group.",
    ),
    ...section(
      "Reuse-as-is candidates",
      "reuse_as_is_candidate",
      "These are repeated low-risk symbol hashes. They still require owner, import, test, and license review before extraction.",
    ),
    ...section(
      "Review extraction",
      "review_extraction",
      "These groups are plausible normalization candidates but have semantic or dependency differences to resolve.",
    ),
    "## Restricted surfaces",
    "",
    "Infinity owns the shared foundation for auth, affiliate attribution, payment, wallets, payouts, roles, sessions, webhooks, rate limiting, and generic UI. Only a concrete provider, legal, economic, tenant-policy, brand-token, copy, or journey boundary may remain customized, and every such group carries a customizationReason in the JSON report.",
    "",
    `- Adapter-only groups: ${byDecision.adapter_only}`,
    `- Product-owned groups: ${byDecision.product_owned}`,
    `- Cross-repository normalized collisions: ${report.collisions.length}`,
    "",
    ...section(
      "Shared canonical",
      "shared_canonical",
      "These declaration groups belong entirely to Infinity's canonical shared source packages. Ownership does not imply low risk, interchangeable external behavior, or completed consumer migrations.",
    ),
  ].join("\n");
}
