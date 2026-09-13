import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanString,
  collapseWhitespace,
  compactWhitespace,
  truncateWithEllipsis,
} from "../src/index.js";

test("cleanString rejects nonprimitive strings without coercion or object access", () => {
  const poison = {
    toString() {
      throw new Error("must not call toString");
    },
    [Symbol.toPrimitive]() {
      throw new Error("must not coerce objects");
    },
  };
  const inaccessible = new Proxy(
    {},
    {
      get() {
        throw new Error("must not access object properties");
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const value of [
    undefined,
    null,
    false,
    true,
    0,
    42,
    NaN,
    1n,
    Symbol("value"),
    {},
    [],
    [" text "],
    new String(" text "),
    () => " text ",
    poison,
    inaccessible,
    revoked.proxy,
  ]) {
    assert.equal(cleanString(value), "");
  }
});

test("cleanString trims ECMAScript outer whitespace while preserving zero-width spaces", () => {
  assert.equal(cleanString(""), "");
  assert.equal(cleanString(" \t\r\n\uFEFF\u00A0"), "");
  assert.equal(cleanString("\uFEFF\u00A0 \tvalue\r\n\u00A0\uFEFF"), "value");
  assert.equal(cleanString(" \u200B value \u200B "), "\u200B value \u200B");
});

test("cleanString preserves internal spacing, line breaks, control characters and text content", () => {
  const content = "alpha  \t beta\r\n\n gamma\u0000delta\uFEFF\u00A0omega";
  assert.equal(cleanString(` \n${content}\t `), content);
  assert.equal(cleanString(" \u0000value\u0000 "), "\u0000value\u0000");
  const markup = `<script>${"unchanged ".repeat(1000)}</script>`;
  assert.equal(cleanString(` ${markup} `), markup);
});

test("collapseWhitespace normalizes presentation spacing without product semantics", () => {
  assert.equal(
    collapseWhitespace("  hello   world  \r\n\r\n\r\n next   step !  "),
    "hello world\n\n next step!",
  );
  assert.equal(collapseWhitespace("already\n\ncompact"), "already\n\ncompact");
});

test("compactWhitespace collapses all whitespace runs to one space", () => {
  assert.equal(compactWhitespace("  hello \n\t world  "), "hello world");
  assert.equal(compactWhitespace("already\n\ncompact"), "already compact");
});

test("truncateWithEllipsis preserves fitting text and uses one ellipsis character", () => {
  assert.equal(truncateWithEllipsis("short", 5), "short");
  assert.equal(truncateWithEllipsis("hello world", 8), "hello w…");
  assert.equal(truncateWithEllipsis("hello   ", 5), "hell…");
});

test("truncateWithEllipsis preserves the observed edge behavior for non-positive limits", () => {
  assert.equal(truncateWithEllipsis("hello", 0), "…");
  assert.equal(truncateWithEllipsis("hello", -4), "…");
});
