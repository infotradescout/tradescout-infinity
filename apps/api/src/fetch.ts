import {
  createInfinityRequestHandler,
  type InfinityApiDependencies,
} from "./server.js";

async function* readBody(request: Request): AsyncGenerator<Uint8Array> {
  if (!request.body) return;
  const reader = request.body.getReader();
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        completed = true;
        return;
      }
      yield chunk.value;
    }
  } finally {
    // The canonical byte limit can stop iteration before the stream ends.
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createInfinityFetchHandler(params: InfinityApiDependencies) {
  const handleRequest = createInfinityRequestHandler(params);
  return {
    async fetch(request: Request): Promise<Response> {
      let status = 500;
      const headers = new Headers();
      let response: Response | undefined;
      await handleRequest(
        {
          method: request.method,
          url: request.url,
          headers: Object.fromEntries(request.headers),
          [Symbol.asyncIterator]: () => readBody(request),
        },
        {
          setHeader: (name, value) => {
            headers.set(name, value);
          },
          writeHead: (code, values) => {
            status = code;
            for (const [name, value] of Object.entries(values)) {
              headers.set(name, String(value));
            }
          },
          end: (body) => {
            response = new Response(request.method === "HEAD" ? null : body, {
              status,
              headers,
            });
          },
        },
        // Fetch has no authenticated peer address. Never trust forwarding
        // headers from callers; share the existing per-path bucket per isolate.
        "unknown",
      );
      if (!response)
        throw new Error("Infinity handler did not return a response");
      return response;
    },
  };
}
