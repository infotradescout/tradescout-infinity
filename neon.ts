import { defineConfig } from "@neon/config/v1";

const signingKeys = process.env.INFINITY_SIGNING_KEYS_JSON?.trim();
if (!signingKeys) throw new Error("INFINITY_SIGNING_KEYS_JSON is required");

export default defineConfig({
  functions: {
    infinity: {
      name: "TradeScout Infinity API",
      source: "apps/api/src/neon.ts",
      env: { INFINITY_SIGNING_KEYS_JSON: signingKeys },
    },
  },
  branch: () => ({ functions: { infinity: { runtime: "nodejs24" } } }),
});
