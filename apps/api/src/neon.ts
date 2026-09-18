import { attachDatabasePool } from "@neon/functions";

import { createInfinityFetchHandler } from "./fetch.js";
import { createPostgresRuntime } from "./runtime.js";

// Neon injects the branch's pooled DATABASE_URL. One small pool per isolate;
// no listening socket and no in-memory replacement for the durable registry.
const { pool, ...dependencies } = createPostgresRuntime({ max: 5 });
attachDatabasePool(pool);

export default createInfinityFetchHandler(dependencies);
