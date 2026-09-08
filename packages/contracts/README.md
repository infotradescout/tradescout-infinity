# Text contracts

Import portable text helpers from `@tradescout-infinity/contracts/text`. This
subpath has no package or platform dependencies and can be bundled for browsers
and servers.

- `cleanString` trims primitive strings and returns an empty string for other
  values, without coercion, sanitization, or truncation.
- `collapseWhitespace` normalizes presentation spacing and line breaks.
- `compactWhitespace` replaces whitespace runs with one ASCII space.
- `truncateWithEllipsis` preserves the observed character-budget behavior,
  including a single ellipsis for nonempty text with a nonpositive budget.

Callers retain their product policies, content limits, and validation. Functions
with the same name but different behavior require separate comparison.

From the repository root, run `corepack pnpm install --frozen-lockfile`,
`corepack pnpm run typecheck`, and `corepack pnpm test`. Run `npm pack` from
`packages/contracts` after the build to produce the compiled package. The
package includes only `dist/src`, its manifest, and this README. Consumers using
a checked-in archive should record the source commit and archive integrity.
