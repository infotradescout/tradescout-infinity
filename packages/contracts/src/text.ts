/** Trim primitive strings; return an empty string for every other value. */
export function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalize spacing and line breaks for plain text presentation.
 *
 * This is a dependency-free formatting primitive. It does not interpret
 * product, identity, attribution, or payment semantics.
 */
export function collapseWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

/**
 * Collapse every whitespace run to one ASCII space and trim the result.
 * Callers own any response, brand, or layout policy around the compact text.
 */
export function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Truncate text to a character budget and append a Unicode ellipsis when it
 * does not fit. The caller owns any product-specific title, brand, or SEO
 * policy that chooses the budget.
 */
export function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const truncated = value.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${truncated}…`;
}
