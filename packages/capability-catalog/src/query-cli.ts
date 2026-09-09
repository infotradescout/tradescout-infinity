import { readFile } from "node:fs/promises";
import {
  findCapabilities,
  findImplementations,
  implementationIndex,
  matchesCapability,
  type Catalog,
  type CatalogQuery,
} from "./index.js";

try {
  const catalog = JSON.parse(
    await readFile(process.argv[2] ?? "ecosystem/catalog.json", "utf8"),
  ) as Catalog;
  let view = "occurrences";
  const args = process.argv.slice(3).filter((arg) => {
    if (arg === "--") return false;
    if (/^(?:--)?view=/.test(arg)) {
      view = arg.split("=").slice(1).join("=");
      return false;
    }
    return true;
  });
  let query: CatalogQuery;
  if (args.length === 0) {
    query = {};
  } else if (args.length === 1 && args[0]!.trimStart().startsWith("{")) {
    const parsed = JSON.parse(args[0]!);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("query must be an object");
    const { view: requestedView, ...filters } = parsed;
    if (requestedView !== undefined) view = requestedView;
    query = filters;
  } else {
    query = {};
    for (const argument of args) {
      const [key, ...parts] = argument.replace(/^--/, "").split("=");
      const value = parts.join("=");
      if (
        !value ||
        ![
          "repository",
          "name",
          "category",
          "kind",
          "risk",
          "disposition",
        ].includes(key!)
      )
        throw new Error(`query filter must be key=value: ${argument}`);
      (query as Record<string, string>)[key!] = value;
    }
  }
  if (view !== "occurrences" && view !== "implementations")
    throw new Error("view must be occurrences or implementations");
  if (view === "implementations") {
    const index = implementationIndex(catalog);
    console.log(
      JSON.stringify(
        {
          view,
          catalogSnapshot: catalog.generatedAt,
          groups: findImplementations(index, query),
          uncompared: index.uncompared.filter((item) =>
            matchesCapability(item.descriptor, query),
          ),
          note: "Exact declaration-text groups retain all locations; equivalence and migration remain unverified. Uncompared observations remain separate.",
        },
        null,
        2,
      ),
    );
  } else console.log(JSON.stringify(findCapabilities(catalog, query), null, 2));
} catch (error) {
  console.error(
    `catalog query failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
