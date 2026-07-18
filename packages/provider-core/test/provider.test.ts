import assert from "node:assert/strict";
import test from "node:test";

import type { WatermarkProvider } from "../src/index.js";

test("provider contract compiles without a concrete vendor", async () => {
  const unavailableProvider: WatermarkProvider = {
    async issueOverlay() {
      throw new Error("provider unavailable");
    },
    async embedAsset() {
      throw new Error("provider unavailable");
    },
    async detectAsset() {
      return [];
    },
    async healthCheck() {
      return {
        provider: "unconfigured",
        status: "unavailable",
        checkedAt: new Date(0).toISOString(),
      };
    },
  };

  assert.deepEqual(await unavailableProvider.detectAsset({} as any), []);
  assert.equal((await unavailableProvider.healthCheck()).status, "unavailable");
});
