import { createPostgresRuntime } from "./runtime.js";
import { createInfinityServer } from "./server.js";

const { pool, ...dependencies } = createPostgresRuntime();
const server = createInfinityServer(dependencies);
const port = Number(process.env.PORT || 4100);

server.listen(port, () => {
  console.log(`TradeScout Infinity API listening on port ${port}`);
});

async function shutdown() {
  server.close();
  await pool.end();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
